import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 笔记模式文章：三栏边注布局（NoteLayout + 边注引擎）
const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date().optional(),
  }),
});

// 常规文章：单栏布局（BaseLayout 直排，无边注引擎）
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date().optional(),
  }),
});

export const collections = { notes, posts };
