import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

const fallbackSite = new URL('https://askdkc.github.io');

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? fallbackSite;
  const posts = (await getCollection('posts', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  return rss({
    title: "dkc's notes",
    description: 'Notes on software, databases, and making things.',
    site: base,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description || post.data.title,
      pubDate: post.data.pubDate,
      link: new URL(`/${post.data.slug}.html`, base).href
    })),
    customData: '<language>ja</language>'
  });
};
