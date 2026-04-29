/**
 * Source loader: walks a directory and returns an {@link AnalysisContext}
 * grouped by file kind. Keeps the walk dependency-free (node:fs only) so
 * the package stays lightweight and portable.
 */

import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';

import type { AnalysisContext, SourceFile, SourceKind } from './types.js';

const EXTENSION_MAP: Readonly<Record<string, SourceKind>> = {
  '.html': 'html',
  '.htm': 'html',
  '.jsx': 'jsx',
  '.tsx': 'tsx',
  '.css': 'css',
  '.astro': 'astro',
  '.vue': 'vue',
  '.svelte': 'svelte',
};

/** Directory names skipped during recursion by default. */
export const DEFAULT_IGNORE: readonly string[] = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'coverage',
  '.turbo',
  '.next',
  '.nuxt',
];

export interface LoadOptions {
  /** Absolute path to the directory to walk. */
  readonly rootDir: string;
  /** Directory names to skip. Defaults to {@link DEFAULT_IGNORE}. */
  readonly ignore?: readonly string[];
}

/**
 * Walk `rootDir` recursively and return every file with a supported extension,
 * grouped by kind. Paths in the returned context are relative to `rootDir` and
 * always use `/` as separator for stable display across platforms.
 */
export async function loadSources(options: LoadOptions): Promise<AnalysisContext> {
  const ignore = new Set(options.ignore ?? DEFAULT_IGNORE);
  const collected: SourceFile[] = [];
  await walk(options.rootDir, options.rootDir, ignore, collected);
  return groupByKind(collected);
}

async function walk(
  root: string,
  dir: string,
  ignore: Set<string>,
  out: SourceFile[],
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (ignore.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(root, full, ignore, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const kind = EXTENSION_MAP[extname(entry.name).toLowerCase()];
    if (!kind) continue;
    const content = await readFile(full, 'utf8');
    out.push({ path: relative(root, full).split(sep).join('/'), kind, content });
  }
}

function groupByKind(files: readonly SourceFile[]): AnalysisContext {
  const html: SourceFile[] = [];
  const jsx: SourceFile[] = [];
  const tsx: SourceFile[] = [];
  const css: SourceFile[] = [];
  const astro: SourceFile[] = [];
  const vue: SourceFile[] = [];
  const svelte: SourceFile[] = [];
  for (const file of files) {
    switch (file.kind) {
      case 'html':
        html.push(file);
        break;
      case 'jsx':
        jsx.push(file);
        break;
      case 'tsx':
        tsx.push(file);
        break;
      case 'css':
        css.push(file);
        break;
      case 'astro':
        astro.push(file);
        break;
      case 'vue':
        vue.push(file);
        break;
      case 'svelte':
        svelte.push(file);
        break;
    }
  }
  return { html, jsx, tsx, css, astro, vue, svelte };
}
