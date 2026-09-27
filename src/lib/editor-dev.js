/**
 * M9 编辑器 dev 集成：仅 dev server 存在，build 零新增页面/端点。
 *  - astro:config:setup（command==='dev'）：injectRoute /dev/editor → src/editor/editor-page.astro
 *    （页面放 pages 外，build 不产出路由，兑现「生产 build 零新增」验收）
 *  - astro:server:setup：挂 /api/dev 中间件四端点（列表 / 读 / 写 / 渲染）
 *
 * 写入防线：slug 白名单防路径穿越；PUT 前跑 content-gate 同款 remark 重放 +
 * 构建同源渲染（rehype strict 失配即抛），失配 400 回显不落盘——承 M2/M5
 * strict 哲学（file.fail 被 content layer 吞，离线重放才是执行点）。
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import matter from 'gray-matter';
import { collectRemarkProblems, renderMarkdown } from './md-pipeline.js';

const NOTES_DIR = resolve(process.cwd(), 'src/content/notes');
const SLUG_RE = /^[a-z0-9-]+$/;
const RESERVED_SLUGS = new Set(['tags', 'series', 'archive']); // M7 路由保留前缀

const json = (res, code, payload) => {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

async function readBody(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 2_000_000) throw new Error('请求体超限（2MB）');
  }
  return data ? JSON.parse(data) : {};
}

/** md → 失配问题列表（remark 重放 + 渲染重放）；空数组 = 可落盘 */
async function validateDoc(md, slug) {
  const { content, data } = matter(md);
  const problems = collectRemarkProblems(content, `src/content/notes/${slug}.md`, data);
  if (problems.length === 0) {
    try {
      await renderMarkdown(content, { frontmatter: data });
    } catch (error) {
      problems.push(String(error.message ?? error).replace(/^Failed to parse Markdown file [^\n]*\n?/, ''));
    }
  }
  return problems;
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
