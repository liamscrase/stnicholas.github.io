import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date().optional(),
  }),
});

export const collections = {
  'posts': posts, // Make sure this matches your folder name in src/content/
};