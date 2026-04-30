import { describe, expect, it } from 'vitest';

import { createInMemoryReader } from '../walker.js';

import { detectVueRoutes, vueFileToRoute } from './vue.js';

const ROOT = '/proj';

describe('vueFileToRoute', () => {
  it.each([
    ['src/pages/index.vue', '/'],
    ['src/pages/about.vue', '/about'],
    ['src/pages/blog/index.vue', '/blog'],
    ['src/pages/blog/[slug].vue', '/blog/[slug]'],
    ['src/pages/blog/[...rest].vue', '/blog/[...rest]'],
  ])('src/pages: %s → %s', (input, expected) => {
    expect(vueFileToRoute(input, 'src/pages')?.path).toBe(expected);
  });

  it('also handles src/views convention', () => {
    expect(vueFileToRoute('src/views/Login.vue', 'src/views')?.path).toBe('/Login');
    expect(vueFileToRoute('src/views/index.vue', 'src/views')?.path).toBe('/');
  });

  it('marks dynamic segments (both [param] and :param)', () => {
    expect(vueFileToRoute('src/pages/blog/[slug].vue', 'src/pages')?.isDynamic).toBe(true);
    // vue-router's traditional notation; preserved as-is by the walker
    // when the user uses programmatic-style filenames.
    expect(vueFileToRoute('src/pages/user/:id.vue', 'src/pages')?.isDynamic).toBe(true);
  });

  it('returns null for files outside the base dir', () => {
    expect(vueFileToRoute('src/components/Header.vue', 'src/pages')).toBeNull();
  });
});

describe('detectVueRoutes', () => {
  it('discovers vite-plugin-pages tree', async () => {
    const reader = createInMemoryReader(ROOT, {
      'src/pages/index.vue': '',
      'src/pages/about.vue': '',
      'src/pages/blog/index.vue': '',
      'src/pages/blog/[slug].vue': '',
      'src/components/Header.vue': '', // ignored
    });

    const routes = await detectVueRoutes({ rootDir: ROOT, reader });

    expect(routes.map((r) => r.path).sort()).toEqual(['/', '/about', '/blog', '/blog/[slug]']);
  });

  it('also picks up src/views', async () => {
    const reader = createInMemoryReader(ROOT, {
      'src/views/Home.vue': '',
      'src/views/Login.vue': '',
    });

    const routes = await detectVueRoutes({ rootDir: ROOT, reader });

    expect(routes.map((r) => r.path).sort()).toEqual(['/Home', '/Login']);
  });

  it('dedupes when src/pages and src/views both have the same name', async () => {
    const reader = createInMemoryReader(ROOT, {
      'src/pages/about.vue': '',
      'src/views/about.vue': '',
    });

    const routes = await detectVueRoutes({ rootDir: ROOT, reader });

    expect(routes).toHaveLength(1);
    expect(routes[0]?.path).toBe('/about');
    // src/pages comes first in the iteration order, so it wins on dedupe.
    expect(routes[0]?.source).toBe('src/pages/about.vue');
  });

  it('returns [] when neither src/pages nor src/views exist', async () => {
    const reader = createInMemoryReader(ROOT, {
      'package.json': '',
    });

    const routes = await detectVueRoutes({ rootDir: ROOT, reader });

    expect(routes).toEqual([]);
  });

  it('handles deeply nested dynamic routes', () => {
    expect(vueFileToRoute('src/pages/[lang]/blog/[slug].vue', 'src/pages')?.path).toBe(
      '/[lang]/blog/[slug]',
    );
  });

  it('treats catch-all routes as dynamic', () => {
    const route = vueFileToRoute('src/pages/[...path].vue', 'src/pages');
    expect(route?.path).toBe('/[...path]');
    expect(route?.isDynamic).toBe(true);
  });

  it('detector filters non-.vue files at the walker level', async () => {
    const reader = createInMemoryReader(ROOT, {
      'src/pages/about.vue': '',
      'src/pages/about.tsx': '', // not a .vue page - must be skipped by the detector
      'src/pages/README.md': '',
    });

    const routes = await detectVueRoutes({ rootDir: ROOT, reader });

    expect(routes.map((r) => r.path)).toEqual(['/about']);
  });
});
