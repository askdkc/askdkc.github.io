import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { convertOrgTree, parseOrgDocument, renderMarkdownDocument } from '../../scripts/convert-org.mjs';

test('converts Org metadata, headings, links, emphasis, and source blocks', () => {
  const document = parseOrgDocument(`#+TITLE: Example note
#+DATE: 2026-08-30
#+DESCRIPTION: A short description
#+FILETAGS: :astro:notes:
#+SLUG: notes/example

本文の *重要な* 内容。

* Heading
[[https://example.com][Example]]

#+begin_src ts
const value = 1;
#+end_src
`, { sourcePath: 'example.org' });

  assert.deepEqual(document.metadata, {
    title: 'Example note',
    description: 'A short description',
    pubDate: '2026-08-30',
    updatedDate: null,
    author: 'dkc',
    tags: ['astro', 'notes'],
    draft: false,
    slug: 'notes/example'
  });
  assert.match(document.body, /\*\*重要な\*\*/);
  assert.match(document.body, /^# Heading$/m);
  assert.match(document.body, /\[Example\]\(https:\/\/example\.com\)/);
  assert.match(document.body, /```ts\nconst value = 1;\n```/);
});

test('renders converted metadata as Astro-compatible Markdown frontmatter', () => {
  const markdown = renderMarkdownDocument({
    metadata: {
      title: 'Example',
      description: '',
      pubDate: '2026-08-30',
      updatedDate: null,
      author: 'dkc',
      tags: ['notes'],
      draft: false,
      slug: 'posts/example'
    },
    body: 'Content.'
  });

  assert.match(markdown, /^title: "Example"$/m);
  assert.match(markdown, /^pubDate: 2026-08-30$/m);
  assert.match(markdown, /^slug: "posts\/example"$/m);
  assert.match(markdown, /\nContent\.\n$/);
});

test('rejects missing dates and unsupported directives', () => {
  assert.throws(
    () => parseOrgDocument('#+TITLE: Missing date\n\nBody', { sourcePath: 'missing-date.org' }),
    /#\+DATE must contain YYYY-MM-DD/
  );
  assert.throws(
    () => parseOrgDocument('#+TITLE: Unsupported\n#+FOO: value\n#+DATE: 2026-08-30', { sourcePath: 'unsupported.org' }),
    /unsupported Org directive #\+FOO/
  );
});

test('rejects normalized calendar dates and unsafe public slugs', () => {
  assert.throws(
    () => parseOrgDocument('#+TITLE: Invalid date\n#+DATE: 2026-02-30', { sourcePath: 'invalid-date.org' }),
    /invalid #\+DATE value/
  );
  assert.throws(
    () =>
      parseOrgDocument('#+TITLE: Invalid slug\n#+DATE: 2026-08-30\n#+SLUG: notes/../private', {
        sourcePath: 'invalid-slug.org'
      }),
    /#\+SLUG must be a relative non-empty path/
  );
});

test('preserves URLs and converts example blocks without treating their contents as directives', () => {
  const document = parseOrgDocument(`#+TITLE: Literal examples
#+DATE: 2026-08-30

[[https://example.com/docs/start][Nested URL]] and https://example.com/another/path

#+begin_example
#+FOO: this is literal example content
/usr/local/bin
#+end_example
`, { sourcePath: 'examples.org' });

  assert.match(document.body, /\[Nested URL\]\(https:\/\/example\.com\/docs\/start\)/);
  assert.match(document.body, /https:\/\/example\.com\/another\/path/);
  assert.match(document.body, /```text\n#\+FOO: this is literal example content\n\/usr\/local\/bin\n```/);
});

test('keeps the previous generated tree when a source document is invalid', () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'askdkc-org-test-'));
  const sourceRoot = join(temporaryRoot, 'source');
  const outputRoot = join(temporaryRoot, 'output');
  mkdirSync(sourceRoot);
  mkdirSync(outputRoot);
  writeFileSync(join(outputRoot, 'existing.md'), 'previous output\n');
  writeFileSync(join(sourceRoot, 'invalid.org'), '#+TITLE: Missing date\n\nBody.\n');

  try {
    assert.throws(() => convertOrgTree({ sourceRoot, outputRoot }), /#\+DATE must contain YYYY-MM-DD/);
    assert.equal(existsSync(join(outputRoot, 'existing.md')), true);
    assert.equal(readFileSync(join(outputRoot, 'existing.md'), 'utf8'), 'previous output\n');
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
