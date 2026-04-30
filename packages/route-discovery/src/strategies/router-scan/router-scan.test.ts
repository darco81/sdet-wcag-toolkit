/**
 * Integration tests for the router-scan strategy. Pairs the framework
 * detector with the directory walker via injected fakes - exercises the
 * full strategy pipeline from rootDir to RouteDiscoveryResult.
 */

import { describe, expect, it } from 'vitest';

import { createInMemoryReader } from './walker.js';
import type { FrameworkDetection } from './framework-detection.js';
import { createRouterScanStrategy } from './index.js';

const ROOT = '/proj';

function fixedDetect(
  detection: FrameworkDetection,
): (rootDir: string) => Promise<FrameworkDetection> {
  return async () => detection;
}

describe('createRouterScanStrategy', () => {
  it('emits routes for an Astro project', async () => {
    const reader = createInMemoryReader(ROOT, {
      'src/pages/index.astro': '',
      'src/pages/about.astro': '',
      'src/pages/blog/[slug].astro': '',
    });
    const strategy = createRouterScanStrategy({
      detect: fixedDetect({ framework: 'astro', evidence: 'astro', scope: 'dependencies' }),
      reader,
    });

    const result = await strategy({ rootDir: ROOT });

    expect(result.strategy).toBe('router-scan');
    expect(result.routes.map((r) => r.path)).toEqual(['/', '/about', '/blog/[slug]']);
    expect(result.confidence).toBe(0.7); // dynamic route present
    expect(result.warnings.some((w) => w.includes('detected astro'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('1 of 3 routes are dynamic'))).toBe(true);
  });

  it('emits an actionable dynamic-route warning listing every fallback strategy', async () => {
    const reader = createInMemoryReader(ROOT, {
      'src/pages/index.astro': '',
      'src/pages/blog/[slug].astro': '',
    });
    const strategy = createRouterScanStrategy({
      detect: fixedDetect({ framework: 'astro', evidence: 'astro', scope: 'dependencies' }),
      reader,
    });

    const result = await strategy({ rootDir: ROOT });

    const dynamicWarning = result.warnings.find((w) => w.includes('dynamic'));
    expect(dynamicWarning).toBeDefined();
    expect(dynamicWarning).toMatch(/--strategy=sitemap/);
    expect(dynamicWarning).toMatch(/--strategy=ai/);
    expect(dynamicWarning).toMatch(/--strategy=json-config/);
    expect(dynamicWarning).toMatch(/\[slug\]/); // example offered to reader
  });

  it('emits routes for Next.js (App Router)', async () => {
    const reader = createInMemoryReader(ROOT, {
      'app/page.tsx': '',
      'app/about/page.tsx': '',
    });
    const strategy = createRouterScanStrategy({
      detect: fixedDetect({ framework: 'next', evidence: 'next', scope: 'dependencies' }),
      reader,
    });

    const result = await strategy({ rootDir: ROOT });

    expect(result.routes.map((r) => r.path)).toEqual(['/', '/about']);
    expect(result.confidence).toBe(1); // all static
  });

  it('emits routes for Vue (vite-plugin-pages)', async () => {
    const reader = createInMemoryReader(ROOT, {
      'src/pages/index.vue': '',
      'src/pages/login.vue': '',
    });
    const strategy = createRouterScanStrategy({
      detect: fixedDetect({ framework: 'vue', evidence: 'vue', scope: 'dependencies' }),
      reader,
    });

    const result = await strategy({ rootDir: ROOT });

    expect(result.routes.map((r) => r.path)).toEqual(['/', '/login']);
  });

  it('treats Nuxt as Vue (best-effort) until a dedicated detector ships', async () => {
    const reader = createInMemoryReader(ROOT, {
      'src/pages/index.vue': '',
      'src/pages/about.vue': '',
    });
    const strategy = createRouterScanStrategy({
      detect: fixedDetect({ framework: 'nuxt', evidence: 'nuxt', scope: 'dependencies' }),
      reader,
    });

    const result = await strategy({ rootDir: ROOT });

    expect(result.routes.map((r) => r.path)).toEqual(['/', '/about']);
  });

  it('returns empty + warning for unsupported frameworks (sveltekit, remix, gatsby)', async () => {
    const reader = createInMemoryReader(ROOT, {});
    const strategy = createRouterScanStrategy({
      detect: fixedDetect({
        framework: 'sveltekit',
        evidence: '@sveltejs/kit',
        scope: 'dependencies',
      }),
      reader,
    });

    const result = await strategy({ rootDir: ROOT });

    expect(result.routes).toEqual([]);
    expect(result.warnings[0]).toMatch(/sveltekit/);
    expect(result.warnings[0]).toMatch(/no detector is implemented yet/);
  });

  it('returns empty + warning for unknown framework', async () => {
    const reader = createInMemoryReader(ROOT, {});
    const strategy = createRouterScanStrategy({
      detect: fixedDetect({
        framework: 'unknown',
        evidence: 'no recognised framework in dependencies',
        scope: 'dependencies',
      }),
      reader,
    });

    const result = await strategy({ rootDir: ROOT });

    expect(result.routes).toEqual([]);
    expect(result.warnings[0]).toMatch(/no recognised framework/);
  });

  it('returns empty + warning when context has no rootDir', async () => {
    const strategy = createRouterScanStrategy();

    const result = await strategy({});

    expect(result.routes).toEqual([]);
    expect(result.warnings[0]).toMatch(/requires a project rootDir/);
  });

  it('warns when framework is detected but route files are missing', async () => {
    const reader = createInMemoryReader(ROOT, {
      'src/components/Header.astro': '', // not under src/pages
    });
    const strategy = createRouterScanStrategy({
      detect: fixedDetect({ framework: 'astro', evidence: 'astro', scope: 'dependencies' }),
      reader,
    });

    const result = await strategy({ rootDir: ROOT });

    expect(result.routes).toEqual([]);
    expect(result.warnings.some((w) => w.includes('no route files found'))).toBe(true);
  });
});
