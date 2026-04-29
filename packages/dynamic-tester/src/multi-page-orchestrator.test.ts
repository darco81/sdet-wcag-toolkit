/**
 * Multi-page orchestrator tests. Inject a fake `auditPage` so the
 * suite never touches Playwright - keeps the test runtime under 100ms
 * and makes the orchestration logic the unit under test (route
 * iteration, skip handling, max-pages cap, error tolerance).
 */

import { describe, expect, it, vi } from 'vitest';

import type { DiscoveredRoute, RouteDiscoveryResult, WcagFinding } from '@sdet-wcag-toolkit/core';
import { requireSuccessCriterion } from '@sdet-wcag-toolkit/core';

import {
  MultiPageOrchestrator,
  type PageAuditFn,
  resolveAuditUrl,
} from './multi-page-orchestrator.js';

const SC = requireSuccessCriterion('1.3.1');
const BASE = 'https://staging.example.com';

function makeRoute(overrides: Partial<DiscoveredRoute>): DiscoveredRoute {
  return {
    path: '/',
    source: 'test',
    isDynamic: false,
    ...overrides,
  };
}

function makeDiscovery(routes: DiscoveredRoute[]): RouteDiscoveryResult {
  return {
    strategy: 'sitemap',
    routes,
    confidence: 1,
    warnings: [],
  };
}

function makeFinding(id: string, file: string, line: number): WcagFinding {
  return {
    id,
    ruleId: 'landmark-main',
    successCriterion: SC,
    severity: 'serious',
    source: 'dynamic',
    message: 'No <main> landmark.',
    location: { file, line },
  };
}

describe('MultiPageOrchestrator.run', () => {
  it('audits each static route against the resolved URL', async () => {
    const auditPage: PageAuditFn = vi.fn(async ({ target }) => ({
      kind: 'audited',
      findings: [makeFinding(`${target.url}-1`, 'src/Layout.astro', 12)],
      durationMs: 5,
    }));
    const orch = new MultiPageOrchestrator({ auditPage });

    const report = await orch.run({
      baseUrl: BASE,
      discovery: makeDiscovery([makeRoute({ path: '/' }), makeRoute({ path: '/about' })]),
    });

    expect(auditPage).toHaveBeenCalledTimes(2);
    const calls = (auditPage as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0]?.[0].target.url).toBe(`${BASE}/`);
    expect(calls[1]?.[0].target.url).toBe(`${BASE}/about`);
    expect(report.summary).toEqual({
      pagesAudited: 2,
      pagesSkipped: 0,
      totalFindings: 2,
      uniqueFindings: 1, // same source-file finding on both pages
    });
    expect(report.crossPage[0]?.affectedPages).toEqual([`${BASE}/`, `${BASE}/about`]);
  });

  it('skips dynamic routes that have no sampleUrl', async () => {
    const auditPage: PageAuditFn = vi.fn(async () => ({
      kind: 'audited',
      findings: [],
      durationMs: 1,
    }));
    const orch = new MultiPageOrchestrator({ auditPage });

    const report = await orch.run({
      baseUrl: BASE,
      discovery: makeDiscovery([
        makeRoute({ path: '/', isDynamic: false }),
        makeRoute({ path: '/blog/[slug]', isDynamic: true }), // skipped
        makeRoute({ path: '/users/[id]', isDynamic: true, sampleUrl: '/users/42' }), // audited
      ]),
    });

    expect(auditPage).toHaveBeenCalledTimes(2); // / and /users/42
    expect(report.pages).toHaveLength(3);

    const skipped = report.pages.find((p) => p.discoveredRoute.path === '/blog/[slug]');
    expect(skipped?.skipped?.reason).toBe('dynamic-no-sample');
    expect(skipped?.findings).toEqual([]);

    const sampled = report.pages.find((p) => p.discoveredRoute.path === '/users/[id]');
    expect(sampled?.auditedUrl).toBe(`${BASE}/users/42`);
  });

  it('records runner errors as skipped pages without aborting the run', async () => {
    const auditPage: PageAuditFn = vi.fn(async ({ target }) => {
      if (target.url.endsWith('/break')) {
        return {
          kind: 'skipped',
          reason: 'runner-error',
          note: 'navigation timeout',
          durationMs: 2,
        };
      }
      return { kind: 'audited', findings: [], durationMs: 1 };
    });
    const orch = new MultiPageOrchestrator({ auditPage });

    const report = await orch.run({
      baseUrl: BASE,
      discovery: makeDiscovery([
        makeRoute({ path: '/' }),
        makeRoute({ path: '/break' }),
        makeRoute({ path: '/after-break' }),
      ]),
    });

    expect(auditPage).toHaveBeenCalledTimes(3); // even after the failure
    expect(report.summary.pagesAudited).toBe(2);
    expect(report.summary.pagesSkipped).toBe(1);
    const broken = report.pages.find((p) => p.discoveredRoute.path === '/break');
    expect(broken?.skipped?.reason).toBe('runner-error');
    expect(broken?.skipped?.note).toMatch(/timeout/);
  });

  it('honors maxPages and records the overflow as max-pages skips', async () => {
    const auditPage: PageAuditFn = vi.fn(async () => ({
      kind: 'audited',
      findings: [],
      durationMs: 1,
    }));
    const orch = new MultiPageOrchestrator({ auditPage });

    const report = await orch.run({
      baseUrl: BASE,
      discovery: makeDiscovery(Array.from({ length: 5 }, (_, i) => makeRoute({ path: `/p${i}` }))),
      maxPages: 3,
    });

    expect(auditPage).toHaveBeenCalledTimes(3);
    expect(report.summary.pagesAudited).toBe(3);
    expect(report.summary.pagesSkipped).toBe(2);
    const overflow = report.pages.filter((p) => p.skipped?.reason === 'max-pages');
    expect(overflow).toHaveLength(2);
  });

  it('does not double-count skipped pages against maxPages', async () => {
    // Mix of dynamic-no-sample skips + audited pages - only audited
    // ones should consume the cap.
    const auditPage: PageAuditFn = vi.fn(async () => ({
      kind: 'audited',
      findings: [],
      durationMs: 1,
    }));
    const orch = new MultiPageOrchestrator({ auditPage });

    const report = await orch.run({
      baseUrl: BASE,
      discovery: makeDiscovery([
        makeRoute({ path: '/[a]', isDynamic: true }), // skip → no count
        makeRoute({ path: '/about' }), // audit 1
        makeRoute({ path: '/[b]', isDynamic: true }), // skip
        makeRoute({ path: '/contact' }), // audit 2
        makeRoute({ path: '/blog' }), // audit 3 (cap)
        makeRoute({ path: '/team' }), // overflow
      ]),
      maxPages: 3,
    });

    expect(auditPage).toHaveBeenCalledTimes(3);
    expect(report.summary.pagesAudited).toBe(3);
    expect(report.pages.filter((p) => p.skipped?.reason === 'max-pages')).toHaveLength(1);
  });

  it('treats maxPages=0 as no limit', async () => {
    const auditPage: PageAuditFn = vi.fn(async () => ({
      kind: 'audited',
      findings: [],
      durationMs: 1,
    }));
    const orch = new MultiPageOrchestrator({ auditPage });

    const report = await orch.run({
      baseUrl: BASE,
      discovery: makeDiscovery(Array.from({ length: 7 }, (_, i) => makeRoute({ path: `/p${i}` }))),
      maxPages: 0,
    });

    expect(auditPage).toHaveBeenCalledTimes(7);
    expect(report.summary.pagesAudited).toBe(7);
  });

  it('preserves the originating discovery in the report', async () => {
    const discovery = makeDiscovery([makeRoute({ path: '/' })]);
    const auditPage: PageAuditFn = vi.fn(async () => ({
      kind: 'audited',
      findings: [],
      durationMs: 1,
    }));
    const orch = new MultiPageOrchestrator({ auditPage });

    const report = await orch.run({ baseUrl: BASE, discovery });

    expect(report.discovery).toBe(discovery);
    expect(report.baseUrl).toBe(BASE);
  });

  it('strips trailing slash from baseUrl so /about is not //about', async () => {
    const auditPage: PageAuditFn = vi.fn(async () => ({
      kind: 'audited',
      findings: [],
      durationMs: 1,
    }));
    const orch = new MultiPageOrchestrator({ auditPage });

    await orch.run({
      baseUrl: `${BASE}/`,
      discovery: makeDiscovery([makeRoute({ path: '/about' })]),
    });

    const calls = (auditPage as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0]?.[0].target.url).toBe(`${BASE}/about`);
  });

  it('forwards pageDefaults (waitForMs / waitForSelector) to every navigation', async () => {
    const auditPage: PageAuditFn = vi.fn(async () => ({
      kind: 'audited',
      findings: [],
      durationMs: 1,
    }));
    const orch = new MultiPageOrchestrator({
      auditPage,
      pageDefaults: { waitForMs: 250, waitForSelector: 'main' },
    });

    await orch.run({
      baseUrl: BASE,
      discovery: makeDiscovery([makeRoute({ path: '/' }), makeRoute({ path: '/x' })]),
    });

    const calls = (auditPage as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0]?.[0].target.waitForMs).toBe(250);
    expect(calls[0]?.[0].target.waitForSelector).toBe('main');
    expect(calls[1]?.[0].target.waitForMs).toBe(250);
  });
});

describe('resolveAuditUrl', () => {
  it('joins baseUrl + path for static routes', () => {
    expect(resolveAuditUrl(BASE, makeRoute({ path: '/about' }))).toBe(`${BASE}/about`);
  });

  it('handles paths without a leading slash', () => {
    expect(resolveAuditUrl(BASE, makeRoute({ path: 'about' }))).toBe(`${BASE}/about`);
  });

  it('returns null for dynamic routes without sampleUrl', () => {
    expect(resolveAuditUrl(BASE, makeRoute({ path: '/blog/[slug]', isDynamic: true }))).toBeNull();
  });

  it('uses sampleUrl as the audit target for dynamic routes', () => {
    expect(
      resolveAuditUrl(
        BASE,
        makeRoute({ path: '/blog/[slug]', isDynamic: true, sampleUrl: '/blog/intro' }),
      ),
    ).toBe(`${BASE}/blog/intro`);
  });

  it('respects absolute sampleUrl values', () => {
    expect(
      resolveAuditUrl(
        BASE,
        makeRoute({
          path: '/blog/[slug]',
          isDynamic: true,
          sampleUrl: 'https://other.example.com/blog/intro',
        }),
      ),
    ).toBe('https://other.example.com/blog/intro');
  });
});
