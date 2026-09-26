// @ts-check
import { defineConfig } from 'astro/config';
import remarkDirective from 'remark-directive';
import { remarkNoteMode } from './src/plugins/notes.js';
import { rehypeNoteSegment } from './src/plugins/segment.js';
import { remarkOrig } from './src/plugins/orig.js';
import { rehypeImages } from './src/plugins/images.js';

export default defineConfig({
  site: 'https://MNFConde.github.io',
  markdown: {
    remarkPlugins: [remarkDirective, remarkNoteMode, [remarkOrig, { strict: true }]],
    // strict：引用失配/歧义/重复 id 构建即失败（fail loudly，CI 把关）；写作期可临时降级 false
    rehypePlugins: [
      [rehypeNoteSegment, { strict: true }],
      rehypeImages, // M8 末位：尺寸回填防 CLS + 独图段落 figure 化（对分段结果无感）
    ],
  },
});
