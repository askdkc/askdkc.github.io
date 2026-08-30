import type { APIRoute } from 'astro';

const fallbackSite = new URL('https://askdkc.github.io');

export const GET: APIRoute = ({ site }) => {
  const base = site ?? fallbackSite;
  const body = ['User-agent: *', 'Allow: /', '', `Sitemap: ${new URL('/sitemap.xml', base).href}`, ''].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
};
