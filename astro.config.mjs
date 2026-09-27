// @ts-check
import { defineConfig } from 'astro/config';
import { mdRehypePlugins, mdRemarkPlugins } from './src/lib/md-pipeline.js';
import { editorDev } from './src/lib/editor-dev.js';

export default defineConfig({
  site: 'https://MNFConde.github.io',
  // AI 协作工作流用不到 Inspect/Audit，其悬浮热区还会拦截自动化点击——关掉（仅 dev，生产本无此件）
  devToolbar: { enabled: false },
  markdown: {
    // 插件列表单一事实源在 src/lib/md-pipeline.js（编辑器 dev 端点同源消费）
    // strict：引用失配/歧义/重复 id 构建即失败（fail loudly，CI 把关）；写作期可临时降级 false
    remarkPlugins: mdRemarkPlugins,
    rehypePlugins: mdRehypePlugins,
  },
  integrations: [editorDev()],
});
