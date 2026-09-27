import { describe, expect, it } from 'vitest';
import { collectImageProblems } from './md-pipeline.js';

const P = 'src/content/notes/t.md';

describe('collectImageProblems：禁止相对图片引用（26-09-27 事故门禁）', () => {
  it('相对引用报错（Astro 内容层会当条目资源 import）', () => {
    const problems = collectImageProblems('![a](images/a.png)', P);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('相对引用');
    expect(problems[0]).toContain('images/a.png');
    expect(problems[0]).toContain(P);
  });

  it('多张图片逐条报出', () => {
    const md = '![a](images/a.png)\n\n![b](images/b.png)';
    expect(collectImageProblems(md, P)).toHaveLength(2);
  });

  it('站点绝对路径 / 远程 URL / 无图文档 → 零问题', () => {
    expect(collectImageProblems('![a](/img/a.svg)', P)).toEqual([]);
    expect(collectImageProblems('![a](https://e.example/a.png)', P)).toEqual([]);
    expect(collectImageProblems('纯文本，无图。', P)).toEqual([]);
  });

  it('HTML <img> 不在此门禁范围（Astro 不劫持该语法）', () => {
    expect(collectImageProblems('<img src="images/a.png" />', P)).toEqual([]);
  });

  it('引用式图片语法（imageReference）也被拦截', () => {
    const md = '![a][ref]\n\n[ref]: images/a.png';
    expect(collectImageProblems(md, P).length).toBeGreaterThan(0);
  });

  it('带 title 的相对引用仍被识别', () => {
    expect(collectImageProblems('![a](images/a.png "图注")', P)).toHaveLength(1);
  });
});
