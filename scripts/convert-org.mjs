import { mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const IGNORED_DIRECTIVES = new Set([
  'AUTHOR',
  'CAPTION',
  'DATE',
  'DESCRIPTION',
  'DRAFT',
  'FILETAGS',
  'KEYWORDS',
  'LAST_MODIFIED',
  'NAME',
  'OPTIONS',
  'PROPERTY',
  'RESULTS',
  'SETUPFILE',
  'SLUG',
  'TITLE',
  'TODO'
]);

function directiveValue(directives, key) {
  return directives.get(key)?.trim() ?? '';
}

function normalizeDate(value, sourcePath) {
  const match = value.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (!match) {
    throw new Error(`${sourcePath}: #+DATE must contain YYYY-MM-DD`);
  }

  const [year, month, day] = match[1].split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${sourcePath}: invalid #+DATE value`);
  }

  return match[1];
}

function normalizeSlug(value, sourcePath, fallback) {
  const slug = (value || fallback).trim().replace(/^\/+|\/+$/g, '');
  const segments = slug.split('/');
  if (
    !slug ||
    /[\\?#]/.test(slug) ||
    slug.endsWith('.html') ||
    segments.some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error(`${sourcePath}: #+SLUG must be a relative non-empty path`);
  }

  return slug;
}

function defaultSlug(sourcePath) {
  const fileName = basename(sourcePath, extname(sourcePath)).replace(/^\d{4}-\d{2}-\d{2}-?/, '');
  return `posts/${fileName || 'untitled'}`;
}

function parseTags(value) {
  return [...new Set(value.split(/[:,\s]+/).map((tag) => tag.trim()).filter(Boolean))];
}

function parseBoolean(value, sourcePath) {
  if (!value) return false;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  throw new Error(`${sourcePath}: #+DRAFT must be true or false`);
}

function convertInlineOrgSyntax(line) {
  const protectedValues = [];
  const protect = (value) => {
    const token = `\uE000${protectedValues.length}\uE001`;
    protectedValues.push(value);
    return token;
  };

  return line
    .replace(/\[\[([^\]]+)\]\[([^\]]+)\]\]/g, (_match, target, label) => protect(`[${label}](${target})`))
    .replace(/\[\[([^\]]+)\]\]/g, (_match, target) => protect(`[${target}](${target})`))
    .replace(/\bhttps?:\/\/[^\s<>()]+/g, (url) => protect(url))
    .replace(/\*([^*\n]+)\*/g, '**$1**')
    .replace(/(^|[\s("'「])\/([^/\n]+)\/(?=$|[\s.,!?;:)"'」])/g, '$1*$2*')
    .replace(/\uE000(\d+)\uE001/g, (_match, index) => protectedValues[Number(index)]);
}

function collectDirectives(lines, sourcePath) {
  const directives = new Map();
  let blockEnd = null;

  for (const line of lines) {
    if (blockEnd) {
      if (blockEnd.test(line)) blockEnd = null;
      continue;
    }
    if (/^#\+BEGIN_SRC(?:\s|$)/i.test(line)) {
      blockEnd = /^#\+END_SRC\s*$/i;
      continue;
    }
    if (/^#\+BEGIN_EXAMPLE\s*$/i.test(line)) {
      blockEnd = /^#\+END_EXAMPLE\s*$/i;
      continue;
    }

    const match = line.match(/^#\+([A-Z_]+):\s*(.*)$/i);
    if (!match) continue;
    const key = match[1].toUpperCase();
    if (!IGNORED_DIRECTIVES.has(key)) {
      throw new Error(`${sourcePath}: unsupported Org directive #+${key}`);
    }
    directives.set(key, match[2]);
  }
  return directives;
}

function convertBody(lines, sourcePath) {
  const output = [];
  let activeBlock = null;

  for (const line of lines) {
    if (activeBlock) {
      const closesBlock =
        (activeBlock.kind === 'source' && /^#\+END_SRC\s*$/i.test(line)) ||
        (activeBlock.kind === 'example' && /^#\+END_EXAMPLE\s*$/i.test(line));
      if (closesBlock) {
        output.push('```');
        activeBlock = null;
        continue;
      }
      if (/^#\+END_(?:SRC|EXAMPLE)\s*$/i.test(line)) {
        throw new Error(`${sourcePath}: mismatched Org block terminator`);
      }
      output.push(line);
      continue;
    }

    const beginSource = line.match(/^#\+BEGIN_SRC(?:\s+([^\s]+))?/i);
    if (beginSource) {
      const language = beginSource[1] || 'text';
      activeBlock = { kind: 'source' };
      output.push(`\`\`\`${language}`);
      continue;
    }

    if (/^#\+BEGIN_EXAMPLE\s*$/i.test(line)) {
      activeBlock = { kind: 'example' };
      output.push('```text');
      continue;
    }

    if (/^#\+END_(?:SRC|EXAMPLE)\s*$/i.test(line)) {
      throw new Error(`${sourcePath}: Org block terminator has no matching begin directive`);
    }

    if (/^#\+[A-Z_]+:/i.test(line) || /^#\+RESULTS:?/i.test(line)) {
      continue;
    }

    const heading = line.match(/^(\*+)\s+(.+)$/);
    if (heading) {
      output.push(`${'#'.repeat(heading[1].length)} ${convertInlineOrgSyntax(heading[2])}`);
      continue;
    }

    if (/^\+\s+/.test(line)) {
      output.push(line.replace(/^\+\s+/, '- '));
      continue;
    }

    output.push(convertInlineOrgSyntax(line));
  }

  if (activeBlock) {
    throw new Error(`${sourcePath}: ${activeBlock.kind} block is not closed`);
  }

  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function yamlString(value) {
  return JSON.stringify(value);
}

export function parseOrgDocument(source, { sourcePath = 'article.org' } = {}) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const directives = collectDirectives(lines, sourcePath);
  const title = directiveValue(directives, 'TITLE');
  if (!title) throw new Error(`${sourcePath}: #+TITLE is required`);

  const date = normalizeDate(directiveValue(directives, 'DATE'), sourcePath);
  const updatedDateValue = directiveValue(directives, 'LAST_MODIFIED');
  const updatedDate = updatedDateValue ? normalizeDate(updatedDateValue, sourcePath) : null;
  const tags = parseTags(`${directiveValue(directives, 'FILETAGS')} ${directiveValue(directives, 'KEYWORDS')}`);
  const metadata = {
    title,
    description: directiveValue(directives, 'DESCRIPTION'),
    pubDate: date,
    updatedDate,
    author: directiveValue(directives, 'AUTHOR') || 'dkc',
    tags,
    draft: parseBoolean(directiveValue(directives, 'DRAFT'), sourcePath),
    slug: normalizeSlug(directiveValue(directives, 'SLUG'), sourcePath, defaultSlug(sourcePath))
  };

  return { metadata, body: convertBody(lines, sourcePath) };
}

export function renderMarkdownDocument({ metadata, body }) {
  const lines = [
    '---',
    `title: ${yamlString(metadata.title)}`,
    `description: ${yamlString(metadata.description)}`,
    `pubDate: ${metadata.pubDate}`
  ];

  if (metadata.updatedDate) lines.push(`updatedDate: ${metadata.updatedDate}`);
  lines.push(`author: ${yamlString(metadata.author)}`);
  lines.push('tags:');
  for (const tag of metadata.tags) lines.push(`  - ${yamlString(tag)}`);
  lines.push(`draft: ${metadata.draft}`);
  lines.push(`slug: ${yamlString(metadata.slug)}`);
  lines.push('---', '', body, '');
  return lines.join('\n');
}

function findOrgFiles(directory) {
  const files = [];
  const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0
  );
  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...findOrgFiles(entryPath));
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.org') {
      files.push(entryPath);
    }
  }
  return files;
}

export function convertOrgTree({ sourceRoot, outputRoot }) {
  const resolvedSourceRoot = resolve(sourceRoot);
  const resolvedOutputRoot = resolve(outputRoot);
  if (resolvedSourceRoot === resolvedOutputRoot) {
    throw new Error('Org source and Markdown output directories must be different');
  }

  const orgFiles = findOrgFiles(resolvedSourceRoot);
  const documents = orgFiles.map((sourcePath) => ({
    sourcePath,
    markdown: renderMarkdownDocument(parseOrgDocument(readFileSync(sourcePath, 'utf8'), { sourcePath }))
  }));
  const outputParent = dirname(resolvedOutputRoot);
  mkdirSync(outputParent, { recursive: true });
  const stagingRoot = mkdtempSync(join(outputParent, `.${basename(resolvedOutputRoot)}-`));

  try {
    for (const { sourcePath, markdown } of documents) {
      const outputPath = join(stagingRoot, relative(resolvedSourceRoot, sourcePath).replace(/\.org$/i, '.md'));
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, markdown);
    }
    rmSync(resolvedOutputRoot, { recursive: true, force: true });
    renameSync(stagingRoot, resolvedOutputRoot);
    return orgFiles.length;
  } catch (error) {
    rmSync(stagingRoot, { recursive: true, force: true });
    throw error;
  }
}

export function main({ cwd = process.cwd() } = {}) {
  const sourceRoot = resolve(cwd, 'content/org');
  const outputRoot = resolve(cwd, 'src/content/posts/org');
  mkdirSync(sourceRoot, { recursive: true });
  return convertOrgTree({ sourceRoot, outputRoot });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const count = main();
    console.log(`Converted ${count} Org-mode file(s).`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
