import { describe, expect, it } from 'vitest';

import { createInMemoryReader } from '../walker.js';

import { astroFileToRoute, detectAstroRoutes } from './astro.js';

const ROOT = '/proj';

describe('astroFileToRoute', () => {
  it.each([
    ['src/pages/index.astro', '/'],
    ['src/pages/about.astro', '/about'],
    ['src/pages/blog/index.astro', '/blog'],
    ['src/pages/blog/post-1.astro', '/blog/post-1'],
    ['src/pages/blog/[slug].astro', '/blog/[slug]'],
    ['src/pages/blog/[...rest].astro', '/blog/[...rest]'],
    ['src/pages/team/[id]/profile.astro', '/team/[id]/profile'],
  ])('%s → %s', (input, expected) => {
    const route = astroFileToRoute(input);
    expect(route?.path).toBe(expected);
  });

  it('marks dynamic segments', () => {
    expect(astroFileToRoute('src/pages/about.astro')?.isDynamic).toBe(false);
    expect(astroFileToRoute('src/pages/blog/[slug].astro')?.isDynamic).toBe(true);
    expect(astroFileToRoute('src/pages/blog/[...rest].astro')?.isDynamic).toBe(true);
  });

  it('skips API endpoints', () => {
    expect(astroFileToRoute('src/pages/api/health.ts')).toBeNull();
    expect(astroFileToRoute('src/pages/api/blog/list.json')).toBeNull();
  });

  it('returns null for files outside src/pages', () => {
    expect(astroFileToRoute('src/components/Header.astro')).toBeNull();
    expect(astroFileToRoute('layouts/Default.astro')).toBeNull();
  });

  it('records the source file path for provenance', () => {
    expect(astroFileToRoute('src/pages/about.astro')?.source).toBe('src/pages/about.astro');
  });
});

describe('detectAstroRoutes', () => {
  it('discovers a typical Astro tree end-to-end', async () => {
    const reader = createInMemoryReader(ROOT, {
      'src/pages/index.astro': '',
      'src/pages/about.astro': '',
      'src/pages/blog/index.astro': '',
      'src/pages/blog/[slug].astro': '',
      'src/pages/blog/[...rest].astro': '',
      'src/pages/api/health.ts': '',
      'src/components/Header.astro': '', // not under pages → ignored
    });

    const routes = await detectAstroRoutes({ rootDir: ROOT, reader });

    expect(routes.map((r) => r.path).sort()).toEqual([
      '/',
      '/about',
      '/blog',
      '/blog/[...rest]',
      '/blog/[slug]',
    ]);
    expect(routes.find((r) => r.path === '/blog/[slug]')?.isDynamic).toBe(true);
  });

  it('returns [] when src/pages is missing', async () => {
    const reader = createInMemoryReader(ROOT, {
      'src/components/Header.astro': '',
    });

    const routes = await detectAstroRoutes({ rootDir: ROOT, reader });

    expect(routes).toEqual([]);
  });

  it('handles index.astro inside a dynamic folder', () => {
    const route = astroFileToRoute('src/pages/[lang]/index.astro');
    expect(route?.path).toBe('/[lang]');
    expect(route?.isDynamic).toBe(true);
  });

  it('handles deeply nested dynamic routes', () => {
    const route = astroFileToRoute('src/pages/[lang]/blog/[slug]/comments.astro');
    expect(route?.path).toBe('/[lang]/blog/[slug]/comments');
    expect(route?.isDynamic).toBe(true);
  });

  it('returns [] for an empty src/pages directory', async () => {
    const reader = createInMemoryReader(ROOT, {
      'src/pages/.keep': '',
    });

    const routes = await detectAstroRoutes({ rootDir: ROOT, reader });

    expect(routes).toEqual([]);
  });
});
