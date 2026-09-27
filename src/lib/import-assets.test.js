import { describe, expect, it } from 'vitest';
import {
  collectRelativeRefs,
  isRelativeImageRef,
  normalizeAssetPath,
  planAssetImport,
  rewriteRelativeImages,
} from './import-assets.js';

describe('isRelativeImageRef：Astro 内容层「条目静态资源」判定', () => {
  it('相对路径为真（这正是炸站的那一类）', () => {
    expect(isRelativeImageRef('images/a.png')).toBe(true);
    expect(isRelativeImageRef('./images/a.png')).toBe(true);
  });
  it('站点绝对路径 / 远程 / 锚点为假', () => {
    expect(isRelativeImageRef('/img/a.png')).toBe(false);
    expect(isRelativeImageRef('https://x.example/a.png')).toBe(false);
    expect(isRelativeImageRef('data:image/png;base64,AAAA')).toBe(false);
    expect(isRelativeImageRef('#fig-1')).toBe(false);
    expect(isRelativeImageRef('')).toBe(false);
  });
});

describe('normalizeAssetPath：白名单与穿越防护', () => {
  it('反斜杠归一为 /', () => {
    expect(normalizeAssetPath('images\\a.png')).toBe('images/a.png');
  });
  it('图片扩展名（含大写）通过', () => {
    expect(normalizeAssetPath('a.JPG')).toBe('a.JPG');
    expect(normalizeAssetPath('deep/dir/b.svg')).toBe('deep/dir/b.svg');
  });
  it('穿越 / 绝对路径 / 盘符 / 非图片 / 无扩展名一律拒绝', () => {
    expect(normalizeAssetPath('../secret.png')).toBeNull();
    expect(normalizeAssetPath('a/../../b.png')).toBeNull();
    expect(normalizeAssetPath('/etc/passwd.png')).toBeNull();
    expect(normalizeAssetPath('C:/x.png')).toBeNull();
    expect(normalizeAssetPath('a/script.sh')).toBeNull();
    expect(normalizeAssetPath('noext')).toBeNull();
    expect(normalizeAssetPath('')).toBeNull();
  });
});

describe('collectRelativeRefs：只挑出会被内容层劫持的引用', () => {
  it('相对引用入列并去重，绝对/远程不入列', () => {
    const md = [
      '![a](images/a.png)',
      '![b](images/a.png)',
      '![c](/img/ok.svg)',
      '![d](https://x.example/d.png)',
    ].join('\n\n');
    expect(collectRelativeRefs(md)).toEqual(['images/a.png']);
  });

  it('代码块内的图片语法是字面文本，不计入', () => {
    const md = ['```md', '![a](images/in-code.png)', '```', '', '![b](images/real.png)'].join('\n');
    expect(collectRelativeRefs(md)).toEqual(['images/real.png']);
  });

  it('title 与尖括号写法都能识别', () => {
    const md = '![a](<images/a b.png> "图注")';
    expect(collectRelativeRefs(md)).toEqual(['images/a b.png']);
  });
});

describe('planAssetImport：相对引用 → /img/<slug>/ 改写计划', () => {
  it('按相对路径精确配对，配不上的进 missing', () => {
    const md = '![a](images/a.png)\n\n![b](images/b.png)';
    const plan = planAssetImport(md, ['images/a.png'], 'my-slug');
    expect([...plan.matches.keys()]).toEqual(['images/a.png']);
    expect(plan.matches.get('images/a.png').url).toBe('/img/my-slug/images/a.png');
    expect(plan.missing).toEqual(['images/b.png']);
  });

  it('basename 唯一时回退配对（用户只选了图片文件夹本体）', () => {
    const md = '![a](images/a.png)';
    const plan = planAssetImport(md, ['a.png'], 's');
    expect(plan.matches.get('images/a.png').path).toBe('a.png');
    expect(plan.missing).toEqual([]);
    expect(plan.unused).toEqual([]);
  });

  it('basename 不唯一 → 不猜，进 missing', () => {
    const md = '![a](images/a.png)';
    const plan = planAssetImport(md, ['p1/a.png', 'p2/a.png'], 's');
    expect(plan.missing).toEqual(['images/a.png']);
    expect(plan.unused).toEqual(['p1/a.png', 'p2/a.png']);
  });

  it('未被引用的随选文件进 unused（提示不误报）', () => {
    const md = '![a](images/a.png)';
    const plan = planAssetImport(md, ['images/a.png', 'images/extra.png'], 's');
    expect(plan.unused).toEqual(['images/extra.png']);
  });

  it('URL 路径分段编码（空格等），与 plugins/images.js 的 decode 对齐', () => {
    const plan = planAssetImport('![a](<images/a b.png>)', ['images/a b.png'], 's');
    expect(plan.matches.get('images/a b.png').url).toBe('/img/s/images/a%20b.png');
  });

  it('空文档 / 空文件列表边界', () => {
    expect(planAssetImport('', [], 's').missing).toEqual([]);
    expect(planAssetImport('![a](images/a.png)', [], 's').missing).toEqual(['images/a.png']);
  });
});

describe('rewriteRelativeImages：仅改表内引用，其余原样', () => {
  const rewrites = new Map([['images/a.png', '/img/s/images/a.png']]);

  it('相对引用被替换，title 保留', () => {
    const out = rewriteRelativeImages('![a](images/a.png "图注")', rewrites);
    expect(out).toBe('![a](/img/s/images/a.png "图注")');
  });

  it('绝对路径 / 远程 / 表外引用不动', () => {
    const md = '![x](/img/ok.svg)\n![y](https://e.example/y.png)\n![z](images/other.png)';
    expect(rewriteRelativeImages(md, rewrites)).toBe(md);
  });

  it('代码块内的同名字面文本不动（防示例被篡改）', () => {
    const md = ['```md', '![a](images/a.png)', '```', '', '![a](images/a.png)'].join('\n');
    expect(rewriteRelativeImages(md, rewrites)).toBe(
      ['```md', '![a](images/a.png)', '```', '', '![a](/img/s/images/a.png)'].join('\n'),
    );
  });

  it('空改写表 → 原样返回', () => {
    const md = '![a](images/a.png)';
    expect(rewriteRelativeImages(md, new Map())).toBe(md);
  });
});
