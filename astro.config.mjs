// @ts-check
import { defineConfig } from 'astro/config';
import remarkDirective from 'remark-directive';
import { remarkNoteMode } from './src/plugins/notes.js';
import { rehypeNoteSegment } from './src/plugins/segment.js';

export default defineConfig({
  site: 'https://MNFConde.github.io',
  markdown: {
    remarkPlugins: [remarkDirective, remarkNoteMode],
    // strict：引用失配/歧义/重复 id 构建即失败（fail loudly，CI 把关）；写作期可临时降级 false
    rehypePlugins: [[rehypeNoteSegment, { strict: true }]],
  },
});
