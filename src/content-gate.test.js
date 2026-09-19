import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkDirective from 'remark-directive';
import { remarkNoteMode } from './plugins/notes.js';
import { remarkOrig } from './plugins/orig.js';

/**
 * 内容门槛（strict 的真正执行点）。
 * 坑：Astro 7 content layer 会吞掉 remark/rehype 管线里的 file.fail——渲染错误仅记
 * 日志、空正文页照常产出、build exit 0，插件内 strict 形同虚设。故配对校验在此
 * 以同一套 remark 管线离线重放：任何失配/提醒直接测试红，deploy.yml 的 pnpm test
 * 步骤（先于 build）守住 CI。
 */

function collectMarkdown(dir) {
  return readdirSync(dir, { recursive: true })
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(dir, f));
}

const files = [
  ...collectMarkdown('src/content/posts'),
  ...collectMarkdown('src/content/notes'),
];

function checkFile(path) {
  const { content, data } = matter(readFileSync(path, 'utf8'));
  const problems = [];
  const vfile = {
    path,
    data: { astro: { frontmatter: data } },
    fail(msg) {
      throw new Error(`${path}: ${msg}`);
    },
    message(msg) {
      problems.push(`${path}: ${msg}`);
    },
  };
  const processor = unified()
    .use(remarkParse)
    .use(remarkDirective)
    .use(remarkNoteMode)
    .use(remarkOrig, { strict: true });
  try {
    processor.runSync(processor.parse(content), vfile);
  } catch (error) {
    problems.push(String(error.message ?? error));
  }
  return problems;
}

describe('内容门槛：:::orig 配对 strict（构建前 CI 把关）', () => {
  it('全部内容文件零失配、零提醒', () => {
    const problems = files.flatMap((path) => checkFile(path));
    expect(problems).toEqual([]);
  });
});
