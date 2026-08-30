import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = join(projectRoot, 'dist');
const site = new URL('https://askdkc.github.io');
const postPaths = [
  '/blog/2023/08/14/ブログ開始.html',
  '/blog/2023/09/10/PGroongaで異なる漢字検索.html',
  '/emacs/2025/07/12/how-to-build-emacs.html',
  '/supabase/pgroonga/svelte/2023/08/22/Supabase-pgroonga.html',
  '/xtra/2023/08/14/what-is-this.html'
];
const htmlPages = [
  { relativePath: 'index.html', path: '/', type: 'website' },
  { relativePath: 'about/index.html', path: '/about/', type: 'website' },
  { relativePath: '404.html', path: '/404.html', type: 'website' },
  ...postPaths.map((path) => ({
    relativePath: decodeURIComponent(new URL(path, site).pathname).slice(1),
    path,
    type: 'article'
  }))
];

function readBuildFile(relativePath) {
  const filePath = join(distRoot, relativePath);
  assert.ok(existsSync(filePath) && statSync(filePath).isFile(), `missing build file: ${relativePath}`);
  return readFileSync(filePath, 'utf8');
}

function assertContains(value, expected, description) {
  assert.ok(value.includes(expected), `${description}: ${expected}`);
}

assert.ok(existsSync(distRoot), 'dist/ does not exist; run npm run build first');

for (const relativePath of ['feed.xml', 'sitemap.xml', 'robots.txt', ...htmlPages.map(({ relativePath }) => relativePath)]) {
  readBuildFile(relativePath);
}

const feed = readBuildFile('feed.xml');
assertContains(feed, '<rss', 'RSS root');
assertContains(feed, '<language>ja</language>', 'RSS language');
for (const postPath of postPaths) {
  assertContains(feed, new URL(postPath, site).href, `RSS link for ${postPath}`);
}
assert.equal((feed.match(/<item>/g) ?? []).length, postPaths.length, 'RSS must contain only known public posts');

const sitemap = readBuildFile('sitemap.xml');
for (const pagePath of ['/', '/about/', ...postPaths]) {
  assertContains(sitemap, `<loc>${new URL(pagePath, site).href}</loc>`, `sitemap URL for ${pagePath}`);
}

const robots = readBuildFile('robots.txt');
assertContains(robots, `Sitemap: ${new URL('/sitemap.xml', site).href}`, 'robots sitemap');

for (const { relativePath, path, type } of htmlPages) {
  const html = readBuildFile(relativePath);
  const canonical = new URL(path, site).href;
  assert.match(html, /<title>[^<]+<\/title>/, `title for ${relativePath}`);
  assert.match(html, /<meta name="description" content="[^"]*"/, `description for ${relativePath}`);
  assertContains(html, `<link rel="canonical" href="${canonical}">`, `canonical for ${relativePath}`);
  assertContains(html, `<meta property="og:type" content="${type}">`, `OGP type for ${relativePath}`);
  assertContains(html, `<meta property="og:url" content="${canonical}">`, `OGP URL for ${relativePath}`);
  assertContains(html, 'id="main-content"', `main landmark target for ${relativePath}`);

  if (type === 'article') {
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
    assert.ok(jsonLdMatch, `Article JSON-LD for ${relativePath}`);
    const jsonLd = JSON.parse(jsonLdMatch[1]);
    assert.equal(jsonLd['@type'], 'BlogPosting', `Article JSON-LD type for ${relativePath}`);
    assert.equal(jsonLd.url, canonical, `Article JSON-LD URL for ${relativePath}`);
    assert.equal(typeof jsonLd.headline, 'string', `Article JSON-LD headline for ${relativePath}`);
    assert.match(jsonLd.datePublished, /^\d{4}-\d{2}-\d{2}T/, `Article publication date for ${relativePath}`);
  }
}

const article = readBuildFile(decodeURIComponent(new URL(postPaths[0], site).pathname).slice(1));
assertContains(article, 'class="astro-code astro-code-themes', 'Shiki dual-theme rendering marker');
assertContains(article, 'data-language="ruby"', 'Shiki source language');
assertContains(article, '--shiki-dark:', 'Shiki dark-theme token data');

console.log(`Verified ${postPaths.length} article URLs and publishing metadata.`);
