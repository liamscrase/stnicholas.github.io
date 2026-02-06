import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content', // This tells Astro it's Markdown
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date().optional(),
    image: z.string().optional(),
  }),
});

export const collections = {
  'posts': posts, // This key MUST match your folder name
};