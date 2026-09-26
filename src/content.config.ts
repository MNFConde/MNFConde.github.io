import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 标签/系列（M7）：双 collection 通用；全可选/缺省——存量文章零改动，既有渲染产物不变。
// tags 做 trim + 去重 + 滤空；跨字段一致性（order 配 series、同系列序号唯一）归 content-gate
const taxonomyFields = {
  tags: z
    .array(z.string())
    .default([])
    .transform((tags) => [...new Set(tags.map((t) => t.trim()).filter(Boolean))]),
  series: z.string().trim().min(1).optional(),
  seriesOrder: z.number().int().optional(),
};

// 笔记模式文章：三栏边注布局（NoteLayout + 边注引擎）
const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date().optional(),
    ...taxonomyFields,
  }),
});

// 常规文章：单栏布局（BaseLayout 直排，无边注引擎）
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date().optional(),
    original: z.boolean().optional(),
    originalDefault: z.enum(['hidden', 'expanded']).optional(),
    ...taxonomyFields,
  }),
});

export const collections = { notes, posts };
