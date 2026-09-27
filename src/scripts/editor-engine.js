/**
 * M9 编辑器引擎（dev-only 页 /dev/editor 的客户端逻辑，Vanilla JS）。
 * 切片1：文档列表 / 打开 / 块编辑 / 保存（PUT 前服务端跑 gate 重放 + 构建同源渲染）。
 * 切片2：Alt+数字键块格式互斥切换（同键回段落）+ 划选建边注（findQuote 即时
 * 歧义校验——与构建同一份匹配代码）+ frontmatter 表单化编辑。
 * 切片3：防抖 150ms 实时预览——POST /api/dev/render（构建同源管线渲染，白得
 * images.js 尺寸回填）→ 复刻 NoteLayout DOM（.note-layout>.note-main+header h1）
 * → initNotesEngine 真 引擎接管（碰撞/分流/回升真实生效，预览即最终效果）。
 * 切片4：导入（文件/粘贴）——补齐 frontmatter、slug 清洗去重、PUT 前服务端
 * 重放校验，失败不落盘仍载入编辑器回显问题。
 * 块互斥由块模型结构性保证（editor-blocks.js）。
 */
import { countQuoteHits, inlineToText, nextNoteId, normalizeQuote, parseDoc, serializeDoc } from '../lib/editor-blocks.js';
import { initNotesEngine } from './notes-engine.js';

const BLOCK_LABELS = {
  p: '段落',
  h2: '标题 H2',
  h3: '标题 H3',
  essay: '随笔',
  note: '边注',
  code: '代码',
  image: '图片',
};

// Alt+数字 → 目标类型；互斥 = 直接改写块 type（单字段），同键再按回段落
const SHORTCUT_TYPES = { 1: 'p', 2: 'h2', 3: 'h3', 4: 'essay', 5: 'code' };

// 编辑/预览相对布局三态（M9.1）：面板宽度随之改变 → 预览容器查询自动换形态
const LAYOUTS = [
  ['side', '布局：并排'],
  ['stack', '布局：上下'],
  ['stack-rev', '布局：上下·预览上'],
];

function applyLayout(mode) {
  document.getElementById('editor-app').dataset.layout = mode;
  els.layout.textContent = LAYOUTS.find(([m]) => m === mode)?.[1] ?? LAYOUTS[0][1];
  try {
    localStorage.setItem('ed-layout', mode);
  } catch {}
}

// 侧栏收展（M9.2）：open 220px / collapsed 32px 窄轨仅留切换钮；localStorage 记忆承 ed-layout 模式
function applySidebar(open) {
  document.getElementById('editor-app').dataset.sidebar = open ? 'open' : 'collapsed';
  els.sideToggle.textContent = open ? '«' : '»';
  els.sideToggle.title = open ? '收起文档栏（Ctrl+B）' : '展开文档栏（Ctrl+B）';
  try {
    localStorage.setItem('ed-sidebar', open ? 'open' : 'collapsed');
  } catch {}
}

const state = {
  slug: null,
  doc: null,
  dirty: false,
  focusIndex: -1,
  disposePreview: null,
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

// —— 实时预览（切片3）——

let previewTimer = 0;
let previewSeq = 0;

function touch() {
  state.dirty = true;
  status();
  schedulePreview();
}

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 150);
}

async function renderPreview() {
  if (!state.doc) return;
  const seq = ++previewSeq; // 竞态令牌：慢响应不覆盖新文档的预览
  try {
    const { html } = await api('/render', { method: 'POST', body: JSON.stringify({ md: serializeDoc(state.doc) }) });
    if (seq !== previewSeq) return;
    state.disposePreview?.();
    els.preview.innerHTML = '';
    const layout = document.createElement('main');
    layout.className = 'note-layout';
    const article = document.createElement('article');
    article.className = 'note-main';
    const header = document.createElement('header');
    const h1 = document.createElement('h1');
    h1.textContent = String(fmEntry('title')?.value ?? '');
    header.appendChild(h1);
    article.appendChild(header);
    const body = document.createElement('div');
    body.innerHTML = html;
    article.appendChild(body);
    layout.appendChild(article);
    els.preview.appendChild(layout);
    // 容器模式（M9.1）：分支判据 = 预览面板宽度而非浏览器视口，滚动参照 = 面板
    state.disposePreview = initNotesEngine({
      container: layout,
      scrollEl: document.getElementById('ed-preview'),
    });
  } catch (error) {
    if (seq !== previewSeq) return;
    hint((error.problems ?? [error.message]).join('\n'));
  }
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
  renderFm();
  renderBlocks();
  renderPreview();
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
  renderFm();
  renderBlocks();
  renderPreview();
  focusBlock(0);
  loadDocs();
  status();
  hint('新文档：填 slug 后 Ctrl+S 保存到 src/content/notes/');
}

// —— frontmatter 表单（已知字段固定排 + 既有未知键原样保留）——

const FM_FIELDS = [
  { key: 'title', label: '标题' },
  { key: 'description', label: '描述' },
  { key: 'date', label: '日期' },
  { key: 'tags', label: '标签（逗号分隔）', list: true },
  { key: 'series', label: '系列' },
  { key: 'seriesOrder', label: '系列序号' },
];

function fmEntry(key) {
  return state.doc.frontmatter.find((e) => e.key === key);
}

function setFmValue(key, value) {
  const entry = fmEntry(key);
  if (entry) {
    entry.value = value;
    entry.raw = Array.isArray(value) ? `[${value.join(', ')}]` : String(value);
  } else if (value !== '' && !(Array.isArray(value) && value.length === 0)) {
    state.doc.frontmatter.push({
      key,
      value,
      raw: Array.isArray(value) ? `[${value.join(', ')}]` : String(value),
    });
  }
  touch();
}

function renderFm() {
  els.fm.innerHTML = '';
  if (!state.doc) return;
  for (const field of FM_FIELDS) {
    const entry = fmEntry(field.key);
    const label = document.createElement('label');
    label.className = 'ed-fm-field';
    const caption = document.createElement('span');
    caption.textContent = field.label;
    const input = document.createElement('input');
    input.dataset.fmKey = field.key;
    input.dataset.fmList = field.list ? '1' : '';
    input.value =
      entry == null
        ? ''
        : field.list
          ? (entry.value ?? []).join(', ')
          : Array.isArray(entry.value)
            ? entry.value.join(', ')
            : String(entry.value ?? '');
    input.addEventListener('input', () => {
      setFmValue(
        field.key,
        field.list
          ? input.value.split(',').map((s) => s.trim()).filter(Boolean)
          : input.value
      );
    });
    label.append(caption, input);
    els.fm.appendChild(label);
  }
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
    touch();
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

// —— 结构操作（增删移/类型切换/划选建锚）——

function insertIndex() {
  return state.focusIndex >= 0 ? state.focusIndex + 1 : state.doc.blocks.length;
}

/** 互斥切格式：目标即当前 → 回段落；否则改写 type 并搬运文本（note 取 body，
 *  image 取 alt 作文本来源）。数据模型单 type 字段——切换即替换，无嵌套路径。 */
function switchBlockType(i, target) {
  const b = state.doc.blocks[i];
  if (b.type === 'note' && target !== 'note' && !b.body.trim() && !confirm('边注转格式将丢弃引用串，继续？')) return;
  const text = b.type === 'note' ? b.body : b.type === 'image' ? b.alt : b.text ?? '';
  const next = b.type === target ? 'p' : target;
  for (const key of ['id', 'quote', 'body', 'lang', 'src', 'alt', 'title']) delete b[key];
  Object.assign(b, next === 'code' ? { type: 'code', lang: '', text } : { type: next, text });
  touch();
  renderBlocks();
  focusBlock(i);
}

function focusBlock(i) {
  const box = els.blocks.querySelector(`.eb[data-i="${i}"]`);
  const ta = box?.querySelector('textarea, input');
  ta?.focus();
}

/** 划选建边注：选区 → 规范化引用串（经行内语法剥离，与构建检索空间一致）→
 *  countQuoteHits 即时校验（findQuote 与构建同一份代码）→ 唯一命中才落块。 */
function createNoteFromSelection(ta) {
  const raw = ta.value.slice(ta.selectionStart, ta.selectionEnd);
  const quote = inlineToText(raw);
  if (!quote) {
    hint('选区为空或经语法剥离后无内容');
    return;
  }
  const { count, blockIndex } = countQuoteHits(state.doc.blocks, quote);
  if (count === 0) {
    hint('引用串经语法剥离后未命中正文——选区可能跨了行内语法，请调整');
    return;
  }
  if (count > 1) {
    hint(`引用串命中 ${count} 处（歧义）——请扩大选区使其唯一`);
    return;
  }
  const box = ta.closest('.eb');
  const at = Number(box?.dataset.i ?? blockIndex);
  const after = blockIndex >= 0 ? blockIndex : at; // 命中块优先（选区与命中块通常同段）
  const id = nextNoteId(state.doc.blocks);
  state.doc.blocks.splice(after + 1, 0, { type: 'note', id, quote, body: '' });
  touch();
  renderBlocks();
  focusBlock(after + 1);
  hint(`边注 #${id} 已建：「${quote}」`);
}

function addBlock(type) {
  const empty = {
    p: { type: 'p', text: '' },
    h2: { type: 'h2', text: '' },
    h3: { type: 'h3', text: '' },
    essay: { type: 'essay', text: '' },
    code: { type: 'code', lang: '', text: '' },
    image: { type: 'image', src: '/', alt: '', title: '' },
    note: { type: 'note', id: nextNoteId(state.doc.blocks), quote: '', body: '' },
  }[type];
  state.doc.blocks.splice(insertIndex(), 0, structuredClone(empty));
  touch();
  renderBlocks();
  focusBlock(insertIndex() - 1);
}

function removeBlock(i) {
  state.doc.blocks.splice(i, 1);
  state.focusIndex = -1;
  touch();
  renderBlocks();
}

function moveBlock(i, delta) {
  const j = i + delta;
  if (j < 0 || j >= state.doc.blocks.length) return;
  const [b] = state.doc.blocks.splice(i, 1);
  state.doc.blocks.splice(j, 0, b);
  state.focusIndex = j;
  touch();
  renderBlocks();
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

// —— 导入（切片4）：外部 md → 补齐 frontmatter → slug 清洗去重 → 落 notes ——
// 校验失败不落盘但仍载入编辑器（问题回显，修完 Ctrl+S 再落）。

function sanitizeSlug(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/\.(md|markdown)$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function fmHas(key) {
  return state.doc.frontmatter.some((e) => e.key === key);
}

function ensureFm(doc, fallbackTitle) {
  if (!doc.frontmatter.some((e) => e.key === 'title')) {
    const firstHeading = doc.blocks.find((b) => b.type === 'h2' || b.type === 'h3')?.text ?? '';
    const title = String(doc.frontmatter.find((e) => e.key === 'title')?.value ?? '') || firstHeading || fallbackTitle;
    doc.frontmatter.unshift({ key: 'title', raw: title, value: title });
  }
  if (!doc.frontmatter.some((e) => e.key === 'date')) {
    const today = new Date().toISOString().slice(0, 10);
    doc.frontmatter.push({ key: 'date', raw: today, value: today });
  }
}

async function importFromText(mdText, fallbackName) {
  if (state.dirty && !confirm('有未保存改动，放弃并导入？')) return;
  const doc = parseDoc(mdText);
  const { docs } = await api('/notes');
  let slug = sanitizeSlug(fallbackName) || `note-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  const base = slug;
  let n = 2;
  while (docs.some((d) => d.slug === slug)) slug = `${base}-${n++}`;
  state.slug = slug;
  state.doc = doc;
  ensureFm(doc, slug);
  state.dirty = true;
  els.slug.value = slug;
  renderFm();
  renderBlocks();
  renderPreview();
  status();
  try {
    await api(`/notes/${slug}`, { method: 'PUT', body: JSON.stringify({ md: serializeDoc(doc) }) });
    state.dirty = false;
    status();
    hint(`已导入并保存：src/content/notes/${slug}.md`);
    loadDocs();
  } catch (error) {
    hint(`已载入（未落盘，问题如下，修完 Ctrl+S 再存）：\n${(error.problems ?? [error.message]).join('\n')}`);
  }
}

export function initEditor() {
  for (const id of ['docs', 'slug', 'status', 'hint', 'blocks', 'toolbar', 'new', 'save', 'fm', 'preview']) {
    els[id] = $(`ed-${id === 'preview' ? 'preview-mount' : id}`);
  }
  els.importFile = $('ed-import-file');
  els.importPaste = $('ed-import-paste');
  els.file = $('ed-file');
  els.paste = $('ed-paste');
  els.layout = $('ed-layout');
  const savedLayout = localStorage.getItem('ed-layout');
  applyLayout(LAYOUTS.some(([m]) => m === savedLayout) ? savedLayout : LAYOUTS[0][0]);
  els.layout.addEventListener('click', () => {
    const current = document.getElementById('editor-app').dataset.layout;
    const next = LAYOUTS[(LAYOUTS.findIndex(([m]) => m === current) + 1) % LAYOUTS.length];
    applyLayout(next[0]);
  });
  els.sideToggle = $('ed-side-toggle');
  applySidebar(localStorage.getItem('ed-sidebar') !== 'collapsed');
  els.sideToggle.addEventListener('click', () => {
    applySidebar(document.getElementById('editor-app').dataset.sidebar !== 'open');
  });
  els.new.addEventListener('click', newDoc);
  els.save.addEventListener('click', save);
  els.importFile.addEventListener('click', () => els.file.click());
  els.file.addEventListener('change', async () => {
    const file = els.file.files?.[0];
    if (file) importFromText(await file.text(), file.name);
    els.file.value = '';
  });
  els.importPaste.addEventListener('click', () => {
    if (els.paste.value.trim()) importFromText(els.paste.value, 'imported');
  });
  els.toolbar.addEventListener('click', (e) => {
    const type = e.target.closest('button')?.dataset.add;
    if (type) addBlock(type);
  });
  els.slug.addEventListener('input', () => touch());
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      applySidebar(document.getElementById('editor-app').dataset.sidebar !== 'open');
      return;
    }
    if (e.isComposing || !e.altKey || e.ctrlKey || e.metaKey) return;
    const ta = e.target.closest?.('#ed-blocks textarea');
    if (!ta) return;
    const box = ta.closest('.eb');
    const i = Number(box.dataset.i);
    if (e.key.toLowerCase() === 'n') {
      e.preventDefault();
      if (ta.selectionStart !== ta.selectionEnd) createNoteFromSelection(ta);
      else hint('先在段落里划选一段文字，再按 Alt+N 建边注');
      return;
    }
    const target = SHORTCUT_TYPES[e.key];
    if (target) {
      e.preventDefault();
      switchBlockType(i, target);
    }
  });
  loadDocs().catch((error) => hint(`文档列表加载失败：${error.message}`));
}
