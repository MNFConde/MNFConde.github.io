import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  countQuoteHits,
  inlineToText,
  nextNoteId,
  noteRails,
  normalizeQuote,
  parseBlocks,
  parseDoc,
  serializeBlock,
  serializeDoc,
} from './editor-blocks.js';

const demo = readFileSync('src/content/notes/notes-demo.md', 'utf8');

describe('M9 块模型：md ⇄ blocks 往返', () => {
  it('notes-demo.md 字节级往返（既有文档打开→保存零脏diff）', () => {
    expect(serializeDoc(parseDoc(demo))).toBe(demo);
  });

  it('全类型构造：序列化 → 再解析还原', () => {
    const md = [
      '---',
      'title: t',
      'tags: [a, b]',
      '---',
      '',
      '## 标题',
      '',
      '段落 :note-m[词句]{#n1} 内联锚。',
      '',
      ':::essay',
      '随笔',
      ':::',
      '',
      ':::note-m{#n2}',
      '> 引用 串',
      '',
      '边注正文',
      ':::',
      '',
      '```js',
      'const a = 1;',
      '```',
      '',
      '![图注](/img.svg "标题")',
      '',
    ].join('\n');
    const once = parseDoc(md);
    const twice = parseDoc(serializeDoc(once));
    expect(twice).toEqual(once);
    expect(once.blocks.map((b) => b.type)).toEqual(['h2', 'p', 'essay', 'note', 'code', 'image']);
    expect(once.blocks[3]).toMatchObject({ id: 'n2', quote: '引用 串', body: '边注正文' });
    expect(once.blocks[5]).toMatchObject({ src: '/img.svg', alt: '图注', title: '标题' });
  });

  it('未识别行（引用块）原样并入 p 块，往返不变', () => {
    const md = '> 引用一行\n';
    expect(serializeDoc(parseDoc(md))).toBe(md);
  });

  it('多行引用串合并为单空格（与构建 textOf 规范化一致）', () => {
    const b = parseBlocks(':::note-m{#n1}\n> 甲\n> 乙\n\n正文\n:::')[0];
    expect(b.quote).toBe('甲 乙');
    expect(serializeBlock(b)).toBe(':::note-m{#n1}\n> 甲 乙\n\n正文\n:::');
  });

  it('frontmatter 解析 + 原序序列化', () => {
    const { frontmatter } = parseDoc('---\ntitle: 甲\ndate: 2026-09-16\ntags: [x, y]\n---\n');
    expect(frontmatter.map((e) => [e.key, e.value])).toEqual([
      ['title', '甲'],
      ['date', '2026-09-16'],
      ['tags', ['x', 'y']],
    ]);
  });
});

describe('M9 块模型：边注 id 与引用命中', () => {
  it('nextNoteId 跳过既有最大号（note 块与行内锚同计）', () => {
    const blocks = parseBlocks('前 :note-m[x]{#n7} 文\n\n:::note-m{#n3}\n> q\n\nb\n:::');
    expect(nextNoteId(blocks)).toBe('n8');
    expect(nextNoteId([])).toBe('n1');
  });

  it('countQuoteHits：唯一命中 / 零命中 / 歧义（与 strict 判定同构）', () => {
    const blocks = parseBlocks('甲段有 目标词 在此。\n\n乙段也有 目标词 出现。\n\n丙段无关。');
    expect(countQuoteHits(blocks, '目标词')).toEqual({ count: 2, blockIndex: 0 });
    expect(countQuoteHits(blocks, '不存在')).toEqual({ count: 0, blockIndex: -1 });
    expect(countQuoteHits(blocks, '目标词 在此')).toEqual({ count: 1, blockIndex: 0 });
  });

  it('inlineToText 剥离行内语法后统计（行内锚/链接不遮蔽命中）', () => {
    const blocks = parseBlocks('前缀 :note-m[目标]{#n1} 后缀，[链接](/x) 与 *强调*。');
    expect(countQuoteHits(blocks, '前缀 目标 后缀，链接 与 强调。')).toEqual({ count: 1, blockIndex: 0 });
  });

  it('normalizeQuote 空白折叠', () => {
    expect(normalizeQuote('  a\n\t b   c \n')).toBe('a b c');
  });
});

describe('M9.6 树形导轨：noteRails 锚归属', () => {
  it('一段四注（行内锚同段）：前三条 through、末条 end，非注块为 null', () => {
    const blocks = parseBlocks(
      [
        '段有 :note-m[甲]{#n1}:note-m[乙]{#n2}:note-m[丙]{#n3}:note-m[丁]{#n4} 四锚。',
        '',
        ':::note-m{#n1}', '一', ':::',
        '',
        ':::note-m{#n2}', '二', ':::',
        '',
        ':::note-m{#n3}', '三', ':::',
        '',
        ':::note-m{#n4}', '四', ':::',
      ].join('\n'),
    );
    const rails = noteRails(blocks);
    expect(blocks.map((b) => b.type)).toEqual(['p', 'note', 'note', 'note', 'note']);
    expect(rails[0]).toBe(null);
    rails.slice(1).forEach((r) => expect(r.anchor).toBe(0));
    expect(rails.slice(1).map((r) => r.rail)).toEqual(['through', 'through', 'through', 'end']);
    expect(rails.slice(1).every((r) => !r.miss)).toBe(true);
  });

  it('引用式：紧跟锚段唯一命中画线；隔块命中仍锚定不画；歧义失配', () => {
    const uniq = parseBlocks('甲有目标词。\n\n:::note-m{#n1}\n> 目标词\n\nb\n:::');
    expect(noteRails(uniq)[1]).toEqual({ anchor: 0, rail: 'end', miss: false });
    const apart = parseBlocks('甲有目标词。\n\n乙段。\n\n:::note-m{#n1}\n> 目标词\n\nb\n:::');
    expect(noteRails(apart)[2]).toEqual({ anchor: 0, rail: 'none', miss: false });
    const amb = parseBlocks('甲有目标词。\n\n乙也有目标词。\n\n:::note-m{#n1}\n> 目标词\n\nb\n:::');
    expect(noteRails(amb)[2]).toEqual({ anchor: -1, rail: 'none', miss: true });
  });

  it('边注被挪离锚段（中间隔了标题）：仍锚定但不画线', () => {
    const blocks = parseBlocks('段有 :note-m[甲]{#n1} 锚。\n\n## 标题\n\n:::note-m{#n1}\nb\n:::');
    expect(noteRails(blocks)[2]).toEqual({ anchor: 0, rail: 'none', miss: false });
  });

  it('连续组里组前块即锚段：锚到别处的组员仅缩进不画线', () => {
    const blocks = parseBlocks(
      [
        '甲有 :note-m[甲]{#n1} 锚。',
        '',
        ':::note-m{#n1}', '一', ':::',
        '',
        ':::note-m{#n2}', '> 乙文', '', '二', ':::',
        '',
        '乙文。',
      ].join('\n'),
    );
    expect(blocks.map((b) => b.type)).toEqual(['p', 'note', 'note', 'p']);
    expect(noteRails(blocks)[1]).toEqual({ anchor: 0, rail: 'end', miss: false });
    expect(noteRails(blocks)[2]).toEqual({ anchor: 3, rail: 'none', miss: false });
  });

  it('essay 行内锚可配对；引用串不检索 essay（与构建检索空间一致）', () => {
    const inline = parseBlocks(':::essay\n随笔 :note-m[e]{#n1}\n:::\n\n:::note-m{#n1}\nb\n:::');
    expect(noteRails(inline)[1]).toEqual({ anchor: 0, rail: 'end', miss: false });
    const quoted = parseBlocks(':::essay\n目标词\n:::\n\n:::note-m{#n2}\n> 目标词\n\nb\n:::');
    expect(noteRails(quoted)[1]).toEqual({ anchor: -1, rail: 'none', miss: true });
  });

  it('空引用且无行内锚 = 失配', () => {
    const blocks = parseBlocks('段。\n\n:::note-m{#n9}\nb\n:::');
    expect(noteRails(blocks)[1]).toEqual({ anchor: -1, rail: 'none', miss: true });
  });
});
