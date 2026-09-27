/**
 * M9 编辑器引擎（dev-only 页 /dev/editor 的客户端逻辑，Vanilla JS）。
 * 切片1：文档列表 / 打开 / 块编辑 / 保存（PUT 前服务端跑 gate 重放 + 构建同源渲染）。
 * 块互斥由块模型结构性保证（editor-blocks.js）；快捷键与划选建锚随切片2、
 * 实时预览随切片3、导入随切片4 接入。
 */
import { parseDoc, serializeDoc } from '../lib/editor-blocks.js';

const BLOCK_LABELS = {
  p: '段落',
  h2: '标题 H2',
  h3: '标题 H3',
  essay: '随笔',
  note: '边注',
  code: '代码',
  image: '图片',
};

const state = {
  slug: null,
  doc: null,
  dirty: false,
  focusIndex: -1,
};

const $ = (id) => document.getElementById(id);
const els = {};

async function api(path, options = {}) {
  const res = await fetch(`/api/dev${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error('请求失败'), { problems: payload.problems ?? [`${res.status}`] });
  return payload;
}

function hint(text = '') {
  els.hint.textContent = text;
}

function status() {
  els.status.textContent = state.doc ? (state.dirty ? '未保存' : '已保存') : '';
}

function autoResize(ta) {
  ta.style.height = 'auto';
  ta.style.height = `${ta.scrollHeight}px`;
}

// —— 文档列表 / 打开 ——

async function loadDocs() {
  const { docs } = await api('/notes');
  els.docs.innerHTML = '';
  for (const d of docs) {
    const li = document.createElement('li');
    li.dataset.slug = d.slug;
    li.className = d.slug === state.slug ? 'is-active' : '';
    const t = document.createElement('span');
    t.textContent = d.title;
    const s = document.createElement('span');
    s.className = 'ed-doc-slug';
    s.textContent = d.slug;
    li.append(t, s);
    li.addEventListener('click', () => openDoc(d.slug));
    els.docs.appendChild(li);
  }
}

async function openDoc(slug) {
  if (state.dirty && !confirm('有未保存改动，放弃并打开其它文档？')) return;
  const { md } = await api(`/notes/${slug}`);
  state.slug = slug;
  state.doc = parseDoc(md);
  state.dirty = false;
  state.focusIndex = -1;
  els.slug.value = slug;
  renderBlocks();
  loadDocs();
  status();
  hint();
}

function newDoc() {
  if (state.dirty && !confirm('有未保存改动，放弃并新建？')) return;
  const today = new Date().toISOString().slice(0, 10);
  state.slug = '';
  state.doc = {
    frontmatter: [
      { key: 'title', raw: '未命名笔记', value: '未命名笔记' },
      { key: 'date', raw: today, value: today },
      { key: 'tags', raw: '[]', value: [] },
    ],
    blocks: [{ type: 'p', text: '' }],
  };
  state.dirty = false;
  els.slug.value = '';
  renderBlocks();
  loadDocs();
  status();
  hint('新文档：填 slug 后 Ctrl+S 保存到 src/content/notes/');
}

// —— 块渲染 ——

function blockHead(b, i) {
  const head = document.createElement('div');
  head.className = 'eb-head';
  const type = document.createElement('span');
  type.className = 'eb-type';
  type.textContent = BLOCK_LABELS[b.type] ?? b.type;
  head.appendChild(type);
  if (b.type === 'note') {
    const id = document.createElement('span');
    id.className = 'eb-id';
    id.textContent = `#${b.id}`;
    head.appendChild(id);
  }
  const spacer = document.createElement('span');
  spacer.className = 'eb-spacer';
  head.appendChild(spacer);
  for (const [label, fn] of [
    ['↑', () => moveBlock(i, -1)],
    ['↓', () => moveBlock(i, 1)],
    ['删', () => removeBlock(i)],
  ]) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.addEventListener('click', fn);
    head.appendChild(btn);
  }
  return head;
}

function bindText(el, block, key) {
  el.addEventListener('input', () => {
    block[key] = el.value;
    state.dirty = true;
    status();
    autoResize(el);
  });
  el.addEventListener('focus', () => {
    state.focusIndex = state.doc.blocks.indexOf(block);
  });
}

function renderBlock(b, i) {
  const box = document.createElement('div');
  box.className = 'eb';
  box.dataset.type = b.type;
  box.dataset.i = i;
  box.appendChild(blockHead(b, i));

  if (b.type === 'note') {
    const meta = document.createElement('div');
    meta.className = 'eb-note-meta';
    const quote = document.createElement('input');
    quote.value = b.quote;
    quote.placeholder = '引用串（构建时在正文检索定位）';
    quote.title = '留空 = 行内锚配对形态';
    bindText(quote, b, 'quote');
    meta.appendChild(quote);
    box.appendChild(meta);
    const body = document.createElement('textarea');
    body.value = b.body;
    body.placeholder = '边注正文';
    bindText(body, b, 'body');
    box.appendChild(body);
    queueMicrotask(() => autoResize(body));
  } else if (b.type === 'code') {
    const lang = document.createElement('input');
    lang.value = b.lang;
    lang.placeholder = '语言（如 js）';
    bindText(lang, b, 'lang');
    box.appendChild(lang);
    const text = document.createElement('textarea');
    text.className = 'eb-code';
    text.value = b.text;
    bindText(text, b, 'text');
    box.appendChild(text);
    queueMicrotask(() => autoResize(text));
  } else if (b.type === 'image') {
    for (const [key, label] of [
      ['src', '路径（如 /wide-demo.svg，public/ 下）'],
      ['alt', '替代文本'],
      ['title', '图注 title（可选）'],
    ]) {
      const input = document.createElement('input');
      input.value = b[key];
      input.placeholder = label;
      bindText(input, b, key);
      box.appendChild(input);
    }
  } else {
    const text = document.createElement('textarea');
    if (b.type === 'p') text.placeholder = '正文（markdown 源文本，可含 :note-m[词句]{#id} 行内锚）';
    text.value = b.text;
    bindText(text, b, 'text');
    box.appendChild(text);
    queueMicrotask(() => autoResize(text));
  }
  return box;
}

function renderBlocks() {
  if (!state.doc) {
    els.blocks.innerHTML = '';
    return;
  }
  els.blocks.innerHTML = '';
  state.doc.blocks.forEach((b, i) => els.blocks.appendChild(renderBlock(b, i)));
}

// —— 结构操作（增删移；type 切换随切片2 快捷键接入，同走 renderBlocks）——

function insertIndex() {
  return state.focusIndex >= 0 ? state.focusIndex + 1 : state.doc.blocks.length;
}

function addBlock(type) {
  const empty = {
    p: { type: 'p', text: '' },
    h2: { type: 'h2', text: '' },
    h3: { type: 'h3', text: '' },
    essay: { type: 'essay', text: '' },
    code: { type: 'code', lang: '', text: '' },
    image: { type: 'image', src: '/', alt: '', title: '' },
    note: { type: 'note', id: '', quote: '', body: '' },
  }[type];
  state.doc.blocks.splice(insertIndex(), 0, structuredClone(empty));
  state.dirty = true;
  renderBlocks();
  status();
}

function removeBlock(i) {
  state.doc.blocks.splice(i, 1);
  state.focusIndex = -1;
  state.dirty = true;
  renderBlocks();
  status();
}

function moveBlock(i, delta) {
  const j = i + delta;
  if (j < 0 || j >= state.doc.blocks.length) return;
  const [b] = state.doc.blocks.splice(i, 1);
  state.doc.blocks.splice(j, 0, b);
  state.focusIndex = j;
  state.dirty = true;
  renderBlocks();
  status();
}

// —— 保存 ——

async function save() {
  if (!state.doc) return;
  const slug = els.slug.value.trim();
  if (!/^[a-z0-9-]+$/.test(slug)) {
    hint('slug 只允许 [a-z0-9-]');
    return;
  }
  try {
    await api(`/notes/${slug}`, { method: 'PUT', body: JSON.stringify({ md: serializeDoc(state.doc) }) });
    state.slug = slug;
    state.dirty = false;
    status();
    hint();
    loadDocs();
  } catch (error) {
    hint((error.problems ?? [error.message]).join('\n'));
  }
}

export function initEditor() {
  for (const id of ['docs', 'slug', 'status', 'hint', 'blocks', 'toolbar', 'new', 'save']) {
    els[id] = $(`ed-${id}`);
  }
  els.new.addEventListener('click', newDoc);
  els.save.addEventListener('click', save);
  els.toolbar.addEventListener('click', (e) => {
    const type = e.target.closest('button')?.dataset.add;
    if (type) addBlock(type);
  });
  els.slug.addEventListener('input', () => {
    state.dirty = true;
    status();
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  });
  loadDocs().catch((error) => hint(`文档列表加载失败：${error.message}`));
}
