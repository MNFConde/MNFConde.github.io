/**
 * 图片导入支撑（纯函数，浏览器编辑页与 dev 中间件共用，无 node 依赖）。
 *
 * 背景（26-09-27 事故）：Markdown 里的**相对**图片引用（`images/x.png`）会被 Astro
 * content layer 当作「与条目同目录的静态资源」生成 import，文件不存在即在
 * vite-plugin-content-assets.js 抛 ImageNotFound——该模块被 content 虚拟模块链式导入，
 * 于是**整个 dev 站点 500**（也含 build）。根治 = 导入时把图片搬进 public/img/<slug>/
 * 并把引用改写成 `/img/<slug>/...` 绝对路径，同时由 content-gate 禁绝一切相对引用。
 *
 * 本模块只做「配对 + 改写」的纯逻辑；文件搬运由 dev 中间件端点负责（浏览器侧读不到盘）。
 */

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.bmp', '.ico']);

/** md 图片 url 是否属「本地相对引用」（Astro 会当条目资源静态 import 的那一类） */
export function isRelativeImageRef(url) {
  const s = String(url ?? '').trim();
  if (!s) return false;
  if (s.startsWith('/') || s.startsWith('#')) return false; // 站点绝对路径 / 页内锚
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) return false; // http: data: mailto: 等
  return true;
}

/** 多字节安全解码（decodeURIComponent 对裸 % 会抛，回退原串） */
function decodeRef(url) {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

/** URL 路径逐段编码（保留 `/` 分隔），对齐 plugins/images.js 的 decodeURIComponent */
function encodePath(rel) {
  return rel.split('/').map(encodeURIComponent).join('/');
}

/**
 * 规范化随选图片的相对路径：去 `\`、拒绝对路径/盘符/`..`、限定图片扩展名。
 * @returns 规范化相对路径（`/` 分隔）或 null（非法即弃）
 */
export function normalizeAssetPath(path) {
  const raw = String(path ?? '').replace(/\\/g, '/').trim();
  if (!raw || raw.startsWith('/') || /^[a-zA-Z]:/.test(raw)) return null;
  const parts = raw.split('/').filter((p) => p !== '' && p !== '.');
  if (parts.length === 0 || parts.some((p) => p === '..')) return null;
  const name = parts[parts.length - 1];
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return null;
  if (!IMAGE_EXT.has(name.slice(dot).toLowerCase())) return null;
  return parts.join('/');
}

/** 逐行遍历，跳过围栏代码块（``` / ~~~）；图片语法在代码块里是字面文本，不可改写 */
function mapOutsideFences(text, fn) {
  const lines = String(text ?? '').split('\n');
  let fenced = false;
  const out = [];
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      out.push(line);
      continue;
    }
    out.push(fenced ? line : fn(line));
  }
  return out.join('\n');
}

const IMAGE_SYNTAX = /!\[([^\]]*)\]\(\s*(<[^>]*>|[^)\s]+)([^)]*)\)/g;

/** 文档内全部本地相对图片引用（去重、已解码），代码块内的不计 */
export function collectRelativeRefs(mdText) {
  const refs = [];
  const seen = new Set();
  mapOutsideFences(mdText, (line) => {
    for (const m of line.matchAll(IMAGE_SYNTAX)) {
      const bare = m[2].replace(/^<|>$/g, '');
      if (!isRelativeImageRef(bare)) continue;
      const key = decodeRef(bare);
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push(key);
    }
    return line;
  });
  return refs;
}

/** basename（用于「目录被拍平」时的回退配对） */
const baseName = (p) => p.slice(p.lastIndexOf('/') + 1);

/**
 * 导入计划：把 md 里的相对引用与随选文件配对，并算出改写后的站点 URL。
 *
 * 配对顺序：① 相对路径精确相等；② basename 在**未配对**文件里唯一时回退配对
 * （用户常只选中图片文件夹本体，路径前缀与 md 不一致）。配不上的进 missing——
 * 调用方必须中止导入：放过即重演「相对引用 → 全站 500」。
 *
 * @param mdText  md 全文
 * @param filePaths 随选图片的相对路径（已相对 md 所在目录；`\` 或 `/` 分隔）
 * @param slug  目标文档 slug（决定 /img/<slug>/ 落位）
 * @returns {{ matches: Map<string, {path: string, url: string}>, missing: string[], unused: string[] }}
 */
export function planAssetImport(mdText, filePaths, slug) {
  const refs = collectRelativeRefs(mdText);
  const available = [];
  for (const p of filePaths ?? []) {
    const norm = normalizeAssetPath(p);
    if (norm && !available.includes(norm)) available.push(norm);
  }

  const matches = new Map();
  const taken = new Set();

  for (const ref of refs) {
    const exact = available.find((p) => p === ref && !taken.has(p));
    if (exact) {
      taken.add(exact);
      matches.set(ref, { path: exact, url: `/img/${slug}/${encodePath(exact)}` });
      continue;
    }
    const sameBase = available.filter((p) => baseName(p) === baseName(ref) && !taken.has(p));
    if (sameBase.length === 1) {
      taken.add(sameBase[0]);
      matches.set(ref, { path: sameBase[0], url: `/img/${slug}/${encodePath(sameBase[0])}` });
    }
  }

  return {
    matches,
    missing: refs.filter((r) => !matches.has(r)),
    unused: available.filter((p) => !taken.has(p)),
  };
}

/**
 * 按改写表重写文档内的相对引用；代码块内不动，站点绝对路径/远程 URL 不动，
 * 图片 title 原样保留。
 */
export function rewriteRelativeImages(mdText, rewrites) {
  if (!rewrites || rewrites.size === 0) return String(mdText ?? '');
  return mapOutsideFences(mdText, (line) =>
    line.replace(IMAGE_SYNTAX, (full, alt, url, rest) => {
      const bare = url.replace(/^<|>$/g, '');
      const target = rewrites.get(decodeRef(bare));
      return target ? `![${alt}](${target}${rest})` : full;
    }),
  );
}
