import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import matter from 'gray-matter';
import { collectRemarkProblems } from './lib/md-pipeline.js';

/**
 * 内容门槛（strict 的真正执行点）。
 * 坑：Astro 7 content layer 会吞掉 remark/rehype 管线里的 file.fail——渲染错误仅记
 * 日志、空正文页照常产出、build exit 0，插件内 strict 形同虚设。故配对校验在此
 * 以同一套 remark 管线离线重放：任何失配/提醒直接测试红，deploy.yml 的 pnpm test
 * 步骤（先于 build）守住 CI。重放实现共享自 md-pipeline.js（M9 起编辑器保存校验
 * 同源消费——编辑器即时校验、gate 落盘把关，同一份代码）。
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
  return collectRemarkProblems(content, path, data);
}

describe('内容门槛：:::orig 配对 strict（构建前 CI 把关）', () => {
  it('全部内容文件零失配、零提醒', () => {
    const problems = files.flatMap((path) => checkFile(path));
    expect(problems).toEqual([]);
  });
});

// 标签/系列（M7）：frontmatter 一致性。zod schema 管字段类型，跨字段关系在此把关
// （承 M5 哲学：schema 管字段、gate 管跨字段；gate 读的是 raw frontmatter，不经 schema transform）
describe('内容门槛：系列 frontmatter 一致性（M7）', () => {
  it('seriesOrder 与 series 同现、同系列序号唯一', () => {
    const problems = [];
    const seenOrders = new Map(); // series -> Set(seriesOrder)
    for (const path of files) {
      const { data } = matter(readFileSync(path, 'utf8'));
      if (data.seriesOrder !== undefined && data.series === undefined) {
        problems.push(`${path}: seriesOrder 须与 series 同现（有 order 无 series）`);
      }
      if (data.series !== undefined && data.seriesOrder !== undefined) {
        const name = String(data.series).trim();
        const orders = seenOrders.get(name) ?? new Set();
        if (orders.has(data.seriesOrder)) {
          problems.push(`${path}: 系列「${name}」seriesOrder=${data.seriesOrder} 与其它文章重复`);
        }
        orders.add(data.seriesOrder);
        seenOrders.set(name, orders);
      }
    }
    expect(problems).toEqual([]);
  });

  it('slug 避开保留前缀（防与站点路由遮蔽）', () => {
    const problems = files
      .map((path) => {
        const slug = path
          .replace(/\\/g, '/')
          .replace(/^src\/content\/(?:notes|posts)\//, '')
          .replace(/\.md$/, '');
        return ['tags', 'series', 'archive'].includes(slug.split('/')[0]) ? `${path}: slug 保留前缀「${slug.split('/')[0]}」与站点路由冲突` : null;
      })
      .filter(Boolean);
    expect(problems).toEqual([]);
  });
});
