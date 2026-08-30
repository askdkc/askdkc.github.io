import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => readFileSync(join(projectRoot, relativePath), 'utf8');

test('publishing routes and generated-site verifier are present', () => {
  assert.match(read('astro.config.mjs'), /format:\s*'preserve'/);
  for (const relativePath of [
    'src/pages/feed.xml.ts',
    'src/pages/sitemap.xml.ts',
    'src/pages/robots.txt.ts',
    'scripts/verify-build.mjs'
  ]) {
    assert.equal(existsSync(join(projectRoot, relativePath)), true, relativePath);
  }
  assert.match(read('scripts/verify-build.mjs'), /about\/index\.html/);
  assert.match(read('scripts/verify-build.mjs'), /feed\.xml/);
  assert.match(read('scripts/verify-build.mjs'), /sitemap\.xml/);
  assert.match(read('scripts/verify-build.mjs'), /data-language=\"ruby\"/);
  assert.match(read('scripts/verify-build.mjs'), /--shiki-dark:/);
  assert.match(read('scripts/verify-build.mjs'), /BlogPosting/);
});

test('GitHub Pages uses one Node-based deployment workflow', () => {
  const workflow = read('.github/workflows/deploy.yml');
  assert.match(workflow, /branches:\s*\n\s*- main/);
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /actions\/setup-node@v6/);
  assert.match(workflow, /node-version: 22\.12\.0/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run check/);
  assert.match(workflow, /npm run verify:build/);
  assert.match(workflow, /actions\/configure-pages@v6/);
  assert.match(workflow, /actions\/upload-pages-artifact@v5/);
  assert.match(workflow, /actions\/deploy-pages@v5/);
  assert.match(
    workflow,
    /name: Configure Pages\n\s+if: github\.event_name != 'pull_request' && github\.ref == 'refs\/heads\/main'/
  );
  assert.match(
    workflow,
    /name: Upload Pages artifact\n\s+if: github\.event_name != 'pull_request' && github\.ref == 'refs\/heads\/main'/
  );
  for (const oldWorkflow of ['.github/workflows/ci.yaml', '.github/workflows/deploysite.yml', '.github/workflows/jekyll.yml']) {
    assert.equal(existsSync(join(projectRoot, oldWorkflow)), false, oldWorkflow);
  }
});

test('local generated directories are ignored', () => {
  const gitignore = read('.gitignore');
  assert.match(gitignore, /^\.astro\/$/m);
  assert.match(gitignore, /^node_modules\/$/m);
  assert.match(read('README.md'), /npm run verify:build/);
  assert.match(read('README.md'), /content\/org/);
  assert.match(read('README.md'), /Node\.js 22\.12\.0以上/);
});
