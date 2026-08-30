import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

const fallbackSite = new URL('https://askdkc.github.io');

interface SitemapUrl {
  loc: string;
  lastmod?: string;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'\"]/g, (character) => {
    const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
    return entities[character as keyof typeof entities];
  });
}

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? fallbackSite;
  const posts = (await getCollection('posts', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );
  const urls: SitemapUrl[] = [
    { loc: new URL('/', base).href },
    { loc: new URL('/about/', base).href },
    ...posts.map((post) => ({
      loc: new URL(`/${post.data.slug}.html`, base).href,
      lastmod: (post.data.updatedDate ?? post.data.pubDate).toISOString().slice(0, 10)
    }))
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.flatMap(({ loc, lastmod }) => [
      '  <url>',
      `    <loc>${escapeXml(loc)}</loc>`,
      ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
      '  </url>'
    ]),
    '</urlset>',
    ''
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' }
  });
};
