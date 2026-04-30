import { describe, expect, it } from 'vitest';

import { createInMemoryReader } from '../walker.js';

import { appRouterFileToRoute, detectNextjsRoutes, pagesRouterFileToRoute } from './nextjs.js';

const ROOT = '/proj';

describe('appRouterFileToRoute', () => {
  it.each([
    ['app/page.tsx', '/'],
    ['app/about/page.tsx', '/about'],
    ['app/blog/[slug]/page.tsx', '/blog/[slug]'],
    ['app/blog/[...all]/page.tsx', '/blog/[...all]'],
    ['app/(marketing)/about/page.tsx', '/about'],
    ['app/(marketing)/(landing)/page.tsx', '/'],
    ['app/team/[id]/page.jsx', '/team/[id]'],
  ])('%s → %s', (input, expected) => {
    expect(appRouterFileToRoute(input)?.path).toBe(expected);
  });

  it('skips non-page files (layout, loading, error, route)', () => {
    expect(appRouterFileToRoute('app/layout.tsx')).toBeNull();
    expect(appRouterFileToRoute('app/loading.tsx')).toBeNull();
    expect(appRouterFileToRoute('app/error.tsx')).toBeNull();
    expect(appRouterFileToRoute('app/api/foo/route.ts')).toBeNull();
    expect(appRouterFileToRoute('app/template.tsx')).toBeNull();
  });

  it('skips private folders (segments starting with _)', () => {
    expect(appRouterFileToRoute('app/_internal/page.tsx')).toBeNull();
    expect(appRouterFileToRoute('app/about/_partial/page.tsx')).toBeNull();
  });

  it('marks dynamic segments', () => {
    expect(appRouterFileToRoute('app/page.tsx')?.isDynamic).toBe(false);
    expect(appRouterFileToRoute('app/blog/[slug]/page.tsx')?.isDynamic).toBe(true);
  });
});

describe('pagesRouterFileToRoute', () => {
  it.each([
    ['pages/index.tsx', '/'],
    ['pages/about.tsx', '/about'],
    ['pages/blog/index.jsx', '/blog'],
    ['pages/blog/[slug].tsx', '/blog/[slug]'],
    ['pages/blog/[...rest].tsx', '/blog/[...rest]'],
  ])('%s → %s', (input, expected) => {
    expect(pagesRouterFileToRoute(input)?.path).toBe(expected);
  });

  it('skips _app, _document, _error, 404, 500', () => {
    expect(pagesRouterFileToRoute('pages/_app.tsx')).toBeNull();
    expect(pagesRouterFileToRoute('pages/_document.tsx')).toBeNull();
    expect(pagesRouterFileToRoute('pages/_error.tsx')).toBeNull();
    expect(pagesRouterFileToRoute('pages/404.tsx')).toBeNull();
    expect(pagesRouterFileToRoute('pages/500.tsx')).toBeNull();
  });

  it('skips API routes', () => {
    expect(pagesRouterFileToRoute('pages/api/health.ts')).toBeNull();
    expect(pagesRouterFileToRoute('pages/api/blog/list.ts')).toBeNull();
  });
});

describe('detectNextjsRoutes', () => {
  it('discovers App Router routes', async () => {
    const reader = createInMemoryReader(ROOT, {
      'app/page.tsx': '',
      'app/about/page.tsx': '',
      'app/blog/[slug]/page.tsx': '',
      'app/(marketing)/contact/page.tsx': '',
      'app/api/health/route.ts': '', // skipped
      'app/_internal/page.tsx': '', // skipped
      'app/layout.tsx': '', // skipped
    });

    const routes = await detectNextjsRoutes({ rootDir: ROOT, reader });

    expect(routes.map((r) => r.path).sort()).toEqual(['/', '/about', '/blog/[slug]', '/contact']);
  });

  it('discovers Pages Router routes', async () => {
    const reader = createInMemoryReader(ROOT, {
      'pages/index.tsx': '',
      'pages/about.tsx': '',
      'pages/_app.tsx': '',
      'pages/api/health.ts': '',
      'pages/blog/[slug].tsx': '',
    });

    const routes = await detectNextjsRoutes({ rootDir: ROOT, reader });

    expect(routes.map((r) => r.path).sort()).toEqual(['/', '/about', '/blog/[slug]']);
  });

  it('combines App and Pages routers (App takes precedence on conflict)', async () => {
    const reader = createInMemoryReader(ROOT, {
      'app/about/page.tsx': '', // App: /about
      'pages/about.tsx': '', // Pages: /about (deduped, App wins)
      'pages/legacy.tsx': '', // Pages-only
    });

    const routes = await detectNextjsRoutes({ rootDir: ROOT, reader });

    expect(routes.map((r) => r.path).sort()).toEqual(['/about', '/legacy']);
    // App router wins for /about - its source path is recorded.
    const aboutRoute = routes.find((r) => r.path === '/about');
    expect(aboutRoute?.source).toBe('app/about/page.tsx');
  });

  it('returns [] when neither app/ nor pages/ exists', async () => {
    const reader = createInMemoryReader(ROOT, {
      'src/components/Foo.tsx': '',
    });

    const routes = await detectNextjsRoutes({ rootDir: ROOT, reader });

    expect(routes).toEqual([]);
  });

  it('handles optional catch-all routes [[...rest]] in App Router', () => {
    const route = appRouterFileToRoute('app/shop/[[...slug]]/page.tsx');
    expect(route?.path).toBe('/shop/[[...slug]]');
    expect(route?.isDynamic).toBe(true);
  });

  it('handles optional catch-all routes [[...rest]] in Pages Router', () => {
    const route = pagesRouterFileToRoute('pages/shop/[[...slug]].tsx');
    expect(route?.path).toBe('/shop/[[...slug]]');
    expect(route?.isDynamic).toBe(true);
  });

  it('skips not-found.tsx, default.tsx, and other non-page files in App Router', () => {
    expect(appRouterFileToRoute('app/not-found.tsx')).toBeNull();
    expect(appRouterFileToRoute('app/default.tsx')).toBeNull();
    expect(appRouterFileToRoute('app/(group)/global-error.tsx')).toBeNull();
  });

  it('drops nested route groups while keeping the rest of the path', () => {
    expect(appRouterFileToRoute('app/(marketing)/(landing)/about/page.tsx')?.path).toBe('/about');
    expect(appRouterFileToRoute('app/(a)/(b)/(c)/page.tsx')?.path).toBe('/');
  });

  it('returns [] for an App Router that only contains api routes', async () => {
    const reader = createInMemoryReader(ROOT, {
      'app/api/health/route.ts': '',
      'app/api/v1/users/route.ts': '',
    });

    const routes = await detectNextjsRoutes({ rootDir: ROOT, reader });

    expect(routes).toEqual([]);
  });
});
