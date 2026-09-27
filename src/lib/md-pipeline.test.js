import { describe, expect, it } from 'vitest';
import { collectImageProblems, renderMarkdown } from './md-pipeline.js';

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

describe('remarkSoftBreak：软换行渲染为 <br>（M9.4）', () => {
  it('无空行连续两行渲染为 <br>，行尾空格保留（边注检索空间不变）', async () => {
    const html = await renderMarkdown('第一行\n第二行');
    expect(html).toContain('第一行 <br>'); // br 后的 \n 是 remark-rehype 的序列化产物，视觉无差
  }, 60_000);

  it('跨折行的边注引用串仍命中（空格进入段落规范化文本）', async () => {
    const md = ['前半句，\n后半句。', '', ':::note-m{#n1}', '> 前半句， 后半句', '', '注解正文', ':::'].join('\n');
    const html = await renderMarkdown(md);
    expect(html).toContain('data-notes="n1"');
  });
});
