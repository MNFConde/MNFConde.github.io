import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import matter from 'gray-matter';
import { pathToFileURL } from 'node:url';
import { renderMarkdown } from './lib/md-pipeline.js';

/**
 * 渲染门槛（M9.5 追修固化，26-09-28）：构建同源渲染的产物体检。
 * content-gate 管「源约束」（orig 配对/图片引用/frontmatter），此处管「产物形状」——
 * 用 md-pipeline 的 renderMarkdown（astro.config / 编辑器预览同一入口）离线渲染全部
 * 内容文档，对 HTML 断言四类缺陷：
 *  1. 渲染本身不抛（rehype 层 strict 失配在此红，与 content layer 吞错无关）
 *  2. 残留强调定界符：双星与双下划线全形态零容忍；单星零容忍；下划线仅查成对形态
 *     （词内单 _ 是 URL/标识符合法字符，且 CommonMark 本就不给 _ 词内强调——单查必误报）
 *  3. 空元素零容忍（指令误伤、分段注入等管线事故的空壳产物）
 *  4. 语义指令字面残留（:note-m / :::essay / :::orig 出现在正文 = 指令没被消费——
 *     多为写错语法被 directive-guard 还原成文本，守卫救渲染但不辨意图，此处现形）
 * 动机（26-09-28 事故）：管线级缺陷会以「别处症状」面目出现——remarkDirective 吞
 * 9:11/arXiv 编号先以「滚动联动偏差」暴露。产物级断言让这类缺陷 CI 即红，不等肉眼。
 * 代码区（code/pre）字面星号是合法内容，检查前先剥；tag 整体剥掉后只剩纯文本，
 * URL 里的 _ / : 不会进检查空间（href 在属性里）。
 */

function collectMarkdown(dir) {
  return readdirSync(dir, { recursive: true })
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(dir, f));
}

const files = [...collectMarkdown('src/content/posts'), ...collectMarkdown('src/content/notes')];

const docs = await Promise.all(
  files.map(async (path) => {
    const { content, data } = matter(readFileSync(path, 'utf8'));
    try {
      const html = await renderMarkdown(content, {
        frontmatter: data,
        fileURL: pathToFileURL(join(process.cwd(), path)),
      });
      return { path, html };
    } catch (error) {
      return { path, html: '', error: String(error.message ?? error) };
    }
  }),
);

const proseOf = (html) =>
  html
    .replace(/<(script|style|pre|code)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');

const around = (s, i) => `…${s.slice(Math.max(0, i - 25), i + 25).trim().replace(/\s+/g, ' ')}…`;

describe('渲染门槛：构建同源产物体检（M9.5 追修固化）', () => {
  it('全部文档渲染成功（strict 失配/歧义即红）', () => {
    expect(docs.filter((d) => d.error).map((d) => `${d.path}: ${d.error}`)).toEqual([]);
  });

  it('零残留星号定界符（** 失效 / 单 * 散星，代码区除外）', () => {
    const problems = [];
    for (const { path, html } of docs) {
      const prose = proseOf(html);
      for (const m of prose.matchAll(/\*+|__+/g)) {
        problems.push(`${path}: 残留「${m[0]}」 ${around(prose, m.index)}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('零残留下划线强调对（_词_ 形态；词内单 _ 不查）', () => {
    const problems = [];
    const PAIR = /(^|[^\p{L}\p{N}\\])_[^\s_]+_(?![\p{L}\p{N}])/gu;
    for (const { path, html } of docs) {
      const prose = proseOf(html);
      for (const m of prose.matchAll(PAIR)) {
        problems.push(`${path}: ${around(prose, m.index)}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('零空元素（p/div/ul/figure/aside/span 等空壳 = 管线注入事故）', () => {
    const problems = [];
    const EMPTY = /<(p|div|ul|ol|blockquote|figure|figcaption|section|article|aside|span|h[1-6]|li)\b[^>]*>\s*<\/\1>/gi;
    for (const { path, html } of docs) {
      for (const m of html.matchAll(EMPTY)) {
        problems.push(`${path}: 空元素 ${m[0].slice(0, 40)}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('零语义指令字面残留（:note-m / :::essay / :::orig 出现在正文 = 未被消费）', () => {
    const problems = [];
    const DIRECTIVE = /:{1,3}(note-m|essay|orig)\b/g;
    for (const { path, html } of docs) {
      const prose = proseOf(html);
      for (const m of prose.matchAll(DIRECTIVE)) {
        problems.push(`${path}: 指令字面残留 ${around(prose, m.index)}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
