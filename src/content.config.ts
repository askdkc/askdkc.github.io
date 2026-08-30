import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const postSlug = z
  .string()
  .min(1)
  .refine(
    (slug) => {
      const segments = slug.split('/');
      return (
        slug === slug.trim() &&
        !slug.startsWith('/') &&
        !slug.endsWith('/') &&
        !slug.endsWith('.html') &&
        !/[\\?#]/.test(slug) &&
        segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..')
      );
    },
    { message: 'slug must be a relative path without .html, query, fragment, or dot segments' }
  );

const posts = defineCollection({
  loader: glob({
    base: './src/content/posts',
    pattern: '**/*.md'
  }),
  schema: z.object({
    title: z.string().trim().min(1),
    description: z.string().default(''),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default('dkc'),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    slug: postSlug
  })
});

export const collections = { posts };
