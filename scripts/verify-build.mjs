import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = join(projectRoot, 'dist');
const site = new URL('https://askdkc.github.io');
const coreHtmlPages = [
  { relativePath: 'index.html', path: '/', type: 'website' },
  { relativePath: 'about/index.html', path: '/about/', type: 'website' },
  { relativePath: '404.html', path: '/404.html', type: 'website' }
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

for (const relativePath of ['feed.xml', 'sitemap.xml', 'robots.txt', ...coreHtmlPages.map(({ relativePath }) => relativePath)]) {
  readBuildFile(relativePath);
}

const feed = readBuildFile('feed.xml');
assertContains(feed, '<rss', 'RSS root');
assertContains(feed, '<language>ja</language>', 'RSS language');

const sitemap = readBuildFile('sitemap.xml');
assertContains(sitemap, '<urlset', 'sitemap root');

const robots = readBuildFile('robots.txt');
assertContains(robots, `Sitemap: ${new URL('/sitemap.xml', site).href}`, 'robots sitemap');

for (const { relativePath, path, type } of coreHtmlPages) {
  const html = readBuildFile(relativePath);
  const canonical = new URL(path, site).href;
  assert.match(html, /<title>[^<]+<\/title>/, `title for ${relativePath}`);
  assert.match(html, /<meta name="description" content="[^"]*"/, `description for ${relativePath}`);
  assertContains(html, `<link rel="canonical" href="${canonical}">`, `canonical for ${relativePath}`);
  assertContains(html, `<meta property="og:type" content="${type}">`, `OGP type for ${relativePath}`);
  assertContains(html, `<meta property="og:url" content="${canonical}">`, `OGP URL for ${relativePath}`);
  assertContains(html, 'id="main-content"', `main landmark target for ${relativePath}`);
}

console.log('Verified core publishing artifacts.');
