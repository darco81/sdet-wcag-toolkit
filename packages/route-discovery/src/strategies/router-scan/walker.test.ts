/**
 * Walker unit tests against the in-memory reader. Verifies the
 * recursion, ignore set, extension filter, and missing-subtree
 * tolerance - kept hermetic so we don't need real fixture directories
 * on disk.
 */

import { describe, expect, it } from 'vitest';

import { createInMemoryReader, extensionFilter, walkSubTree } from './walker.js';

const ROOT = '/proj';

describe('walkSubTree', () => {
  it('returns paths relative to rootDir, sorted, with forward slashes', async () => {
    const reader = createInMemoryReader(ROOT, {
      'src/pages/index.astro': '',
      'src/pages/about.astro': '',
      'src/pages/blog/post.astro': '',
    });

    const result = await walkSubTree({
      rootDir: ROOT,
      subTree: 'src/pages',
      include: extensionFilter(['.astro']),
      reader,
    });

    expect(result.map((e) => e.path)).toEqual([
      'src/pages/about.astro',
      'src/pages/blog/post.astro',
      'src/pages/index.astro',
    ]);
  });

  it('returns [] when the sub-tree is missing', async () => {
    const reader = createInMemoryReader(ROOT, {
      'src/pages/index.astro': '',
    });

    const result = await walkSubTree({
      rootDir: ROOT,
      subTree: 'app',
      include: () => true,
      reader,
    });

    expect(result).toEqual([]);
  });

  it('skips ignored directories by default (node_modules, dist, .next, ...)', async () => {
    const reader = createInMemoryReader(ROOT, {
      'src/pages/keep.astro': '',
      'node_modules/pkg/index.astro': '',
      'dist/index.astro': '',
      '.next/cache/index.astro': '',
      'public/static.astro': '',
    });

    const result = await walkSubTree({
      rootDir: ROOT,
      subTree: '.',
      include: extensionFilter(['.astro']),
      reader,
    });

    const paths = result.map((e) => e.path);
    expect(paths).toContain('src/pages/keep.astro');
    expect(paths.some((p) => p.startsWith('node_modules'))).toBe(false);
    expect(paths.some((p) => p.startsWith('dist'))).toBe(false);
    expect(paths.some((p) => p.startsWith('.next'))).toBe(false);
    expect(paths.some((p) => p.startsWith('public'))).toBe(false);
  });

  it('honors a custom ignore list (overrides defaults entirely)', async () => {
    const reader = createInMemoryReader(ROOT, {
      'src/pages/keep.astro': '',
      'public/static.astro': '',
      'docs/page.astro': '',
    });

    const result = await walkSubTree({
      rootDir: ROOT,
      subTree: '.',
      include: extensionFilter(['.astro']),
      reader,
      ignore: ['docs'], // overrides default - public is now visible.
    });

    const paths = result.map((e) => e.path);
    expect(paths).toContain('src/pages/keep.astro');
    expect(paths).toContain('public/static.astro');
    expect(paths.some((p) => p.startsWith('docs'))).toBe(false);
  });

  it('extensionFilter matches case-insensitively and handles missing dot', async () => {
    const filter = extensionFilter(['astro', '.VUE']);
    expect(filter('src/pages/foo.astro')).toBe(true);
    expect(filter('src/pages/foo.ASTRO')).toBe(true);
    expect(filter('src/pages/foo.vue')).toBe(true);
    expect(filter('src/pages/foo.tsx')).toBe(false);
    expect(filter('Makefile')).toBe(false);
  });
});
