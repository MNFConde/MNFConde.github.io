/**
 * M9 编辑器 dev 集成：仅 dev server 存在，build 零新增页面/端点。
 *  - astro:config:setup（command==='dev'）：injectRoute /dev/editor → src/editor/editor-page.astro
 *    （页面放 pages 外，build 不产出路由，兑现「生产 build 零新增」验收）
 *  - astro:server:setup：挂 /api/dev 中间件五端点（列表 / 读 / 写 / 渲染 / 图片搬运）
 *
 * 写入防线：slug 白名单防路径穿越；PUT 前跑 content-gate 同款重放（相对图片引用
 * 检查 + remark 管线 + 构建同源渲染），失配 400 回显不落盘——承 M2/M5 strict 哲学
 * （file.fail 被 content layer 吞，离线重放才是执行点）。
 * 请求体经 http-body.js 整体解码（分片多字节字符见该模块头部教训）。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import matter from 'gray-matter';
import { collectImageProblems, collectRemarkProblems, renderMarkdown } from './md-pipeline.js';
import { readJsonBody, BODY_LIMITS } from './http-body.js';
import { normalizeAssetPath } from './import-assets.js';

const NOTES_DIR = resolve(process.cwd(), 'src/content/notes');
const PUBLIC_DIR = resolve(process.cwd(), 'public');
const IMG_ROOT = join(PUBLIC_DIR, 'img');
const SLUG_RE = /^[a-z0-9-]+$/;
const RESERVED_SLUGS = new Set(['tags', 'series', 'archive']); // M7 路由保留前缀

const json = (res, code, payload) => {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const readBody = (req, options) => readJsonBody(req, options);

/** md → 失配问题列表（图片引用检查 + remark 重放 + 渲染重放）；空数组 = 可落盘 */
async function validateDoc(md, slug) {
  const { content, data } = matter(md);
  const filePath = `src/content/notes/${slug}.md`;
  const problems = [
    ...collectImageProblems(content, filePath),
    ...collectRemarkProblems(content, filePath, data),
  ];
  if (problems.length === 0) {
    try {
      await renderMarkdown(content, { frontmatter: data });
    } catch (error) {
      problems.push(String(error.message ?? error).replace(/^Failed to parse Markdown file [^\n]*\n?/, ''));
    }
  }
  return problems;
}

/**
 * 图片搬运端点：把导入时随选的图片写进 public/img/<slug>/。
 * 请求体 { slug, files: [{ path, base64 }] }；path 走 normalizeAssetPath 白名单
 * （拒绝对路径/盘符/`..`/非图片扩展名），落点用 resolve 二次确认仍在 IMG_ROOT 内。
 * 已存在且内容相同 → 视为幂等（重复导入同目录不报错）；内容不同 → 冲突报错不覆盖。
 * 改写表由调用方（planAssetImport）给出，本端点只负责落盘——URL 编码单一事实源在
 * src/lib/import-assets.js。
 */
async function handleAssets(req, res) {
  const { slug, files } = await readBody(req, { limitBytes: BODY_LIMITS.binary });
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
    return json(res, 400, { problems: ['slug 只允许 [a-z0-9-]'] });
  }
  if (!Array.isArray(files) || files.length === 0) {
    return json(res, 400, { problems: ['缺少 files 字段'] });
  }

  const destDir = resolve(IMG_ROOT, slug);
  if (destDir !== IMG_ROOT && !destDir.startsWith(IMG_ROOT + '\\') && !destDir.startsWith(IMG_ROOT + '/')) {
    return json(res, 403, { problems: ['落点越界'] });
  }

  const problems = [];

  files.forEach((entry, index) => {
    const rel = normalizeAssetPath(entry?.path);
    if (!rel) {
      problems.push(`第 ${index + 1} 个文件路径非法（须为相对路径的图片扩展名）：${entry?.path}`);
      return;
    }
    if (typeof entry.base64 !== 'string' || entry.base64 === '') {
      problems.push(`文件「${rel}」缺少 base64 内容`);
      return;
    }
    const buf = Buffer.from(entry.base64, 'base64');
    const dest = resolve(destDir, rel);
    if (!dest.startsWith(destDir + '\\') && !dest.startsWith(destDir + '/')) {
      problems.push(`文件「${rel}」落点越界`);
      return;
    }
    if (existsSync(dest)) {
      if (!readFileSync(dest).equals(buf)) {
        problems.push(`文件「${rel}」已存在且内容不同，拒绝覆盖`);
      }
      return;
    }
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, buf);
  });

  if (problems.length > 0) return json(res, 400, { problems });
  return json(res, 200, { ok: true });
}

function apiMiddleware() {
  return async (req, res, next) => {
    try {
      const url = req.url ?? '';

      if (req.method === 'GET' && url === '/notes') {
        const docs = readdirSync(NOTES_DIR)
          .filter((f) => f.endsWith('.md'))
          .map((f) => {
            const slug = f.replace(/\.md$/, '');
            const { data } = matter(readFileSync(join(NOTES_DIR, f), 'utf8'));
            return { slug, title: data.title ?? slug };
          })
          .sort((a, b) => a.slug.localeCompare(b.slug));
        return json(res, 200, { docs });
      }

      const item = url.match(/^\/notes\/([a-z0-9-]+)$/);
      if (item) {
        const slug = item[1];
        if (!SLUG_RE.test(slug)) return json(res, 403, { problems: ['slug 只允许 [a-z0-9-]'] });
        const file = join(NOTES_DIR, `${slug}.md`);

        if (req.method === 'GET') {
          if (!existsSync(file)) return json(res, 404, { problems: [`文档不存在：${slug}`] });
          return json(res, 200, { md: readFileSync(file, 'utf8') });
        }

        if (req.method === 'PUT') {
          if (RESERVED_SLUGS.has(slug)) {
            return json(res, 400, { problems: [`slug「${slug}」是站点路由保留前缀（M7）`] });
          }
          const { md } = await readBody(req);
          if (typeof md !== 'string' || !md.trim()) {
            return json(res, 400, { problems: ['缺少 md 字段'] });
          }
          const problems = await validateDoc(md, slug);
          if (problems.length > 0) return json(res, 400, { problems });
          writeFileSync(file, md, 'utf8');
          return json(res, 200, { ok: true, slug });
        }
      }

      if (req.method === 'POST' && url === '/assets') {
        return await handleAssets(req, res);
      }

      if (req.method === 'POST' && url === '/render') {
        const { md } = await readBody(req);
        if (typeof md !== 'string') return json(res, 400, { problems: ['缺少 md 字段'] });
        const { content, data } = matter(md);
        const html = await renderMarkdown(content, { frontmatter: data });
        return json(res, 200, { html });
      }

      next();
    } catch (error) {
      json(res, 500, { problems: [String(error.message ?? error)] });
    }
  };
}

export function editorDev() {
  return {
    name: 'editor-dev',
    hooks: {
      'astro:config:setup': ({ command, injectRoute }) => {
        if (command !== 'dev') return;
        injectRoute({ pattern: '/dev/editor', entrypoint: './src/editor/editor-page.astro' });
      },
      'astro:server:setup': ({ server }) => {
        server.middlewares.use('/api/dev', apiMiddleware());
      },
    },
  };
}
