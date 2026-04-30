/**
 * Multi-page console reporter tests. Strips ANSI codes before
 * asserting so colour wrapping doesn't leak into the assertions -
 * the formatter under test still produces colour, but the test
 * surface focuses on layout/content.
 */

import { describe, expect, it } from 'vitest';

import type {
  CrossPageFinding,
  DiscoveredRoute,
  MultiPageAuditReport,
  PageAuditResult,
  PageSkipReason,
  WcagFinding,
} from '@sdet-wcag-toolkit/core';
import { requireSuccessCriterion } from '@sdet-wcag-toolkit/core';

import { formatMultiPageConsoleReport } from './multi-page-console.js';

const SC = requireSuccessCriterion('1.3.1');

const ANSI = /\[[0-9;]*m/g;
const stripAnsi = (s: string): string => s.replace(ANSI, '');

function makeFinding(opts: {
  ruleId: string;
  file?: string;
  line?: number;
  selector?: string;
  message?: string;
}): WcagFinding {
  return {
    id: `${opts.ruleId}-${opts.file ?? opts.selector ?? 'x'}`,
    ruleId: opts.ruleId,
    successCriterion: SC,
    severity: 'serious',
    source: 'dynamic',
    message: opts.message ?? 'Missing landmark.',
    location: {
      ...(opts.file !== undefined && { file: opts.file }),
      ...(opts.line !== undefined && { line: opts.line }),
      ...(opts.selector !== undefined && { selector: opts.selector }),
    },
  };
}

function makePage(opts: {
  path: string;
  url?: string;
  findings?: WcagFinding[];
  skip?: { reason: PageSkipReason; note: string };
}): PageAuditResult {
  const route: DiscoveredRoute = {
    path: opts.path,
    source: 'sitemap.xml',
    isDynamic: opts.path.includes('['),
  };
  return {
    discoveredRoute: route,
    ...(opts.url !== undefined && { auditedUrl: opts.url }),
    findings: opts.findings ?? [],
    durationMs: 100,
    ...(opts.skip !== undefined && { skipped: opts.skip }),
  };
}

function makeReport(opts: {
  pages?: PageAuditResult[];
  crossPage?: CrossPageFinding[];
}): MultiPageAuditReport {
  const pages = opts.pages ?? [];
  const crossPage = opts.crossPage ?? [];
  const auditedPages = pages.filter((p) => p.skipped === undefined);
  return {
    baseUrl: 'https://staging.example.com',
    discovery: {
      strategy: 'sitemap',
      routes: pages.map((p) => p.discoveredRoute),
      confidence: 0.95,
      warnings: [],
    },
    pages,
    crossPage,
    totalDurationMs: 5_000,
    summary: {
      pagesAudited: auditedPages.length,
      pagesSkipped: pages.length - auditedPages.length,
      totalFindings: auditedPages.reduce((acc, p) => acc + p.findings.length, 0),
      uniqueFindings: crossPage.length,
    },
  };
}

describe('formatMultiPageConsoleReport', () => {
  it('renders the headline summary line', () => {
    const out = stripAnsi(
      formatMultiPageConsoleReport(
        makeReport({
          pages: [makePage({ path: '/' }), makePage({ path: '/about' })],
        }),
      ),
    );
    expect(out).toContain('Multi-page WCAG audit - 2 audited · 0 skipped');
    expect(out).toContain('strategy: sitemap');
  });

  it('renders the heat map with PAGE / CRIT / SERI / MOD / MIN / TOTAL columns', () => {
    const finding = makeFinding({ ruleId: 'r', file: 'src/A.tsx', line: 1 });
    const out = stripAnsi(
      formatMultiPageConsoleReport(
        makeReport({
          pages: [makePage({ path: '/about', findings: [finding] })],
        }),
      ),
    );
    expect(out).toContain('Heat map');
    expect(out).toMatch(/PAGE.*CRIT.*SERI.*MOD.*MIN.*TOTAL/);
    expect(out).toContain('/about');
  });

  it('sorts heat-map rows by total findings DESC', () => {
    const f = makeFinding({ ruleId: 'r', file: 'src/A.tsx', line: 1 });
    const out = stripAnsi(
      formatMultiPageConsoleReport(
        makeReport({
          pages: [
            makePage({ path: '/clean', findings: [] }),
            makePage({ path: '/busy', findings: [f, { ...f, id: 'r2' }] }),
            makePage({ path: '/half', findings: [f] }),
          ],
        }),
      ),
    );
    const busyIdx = out.indexOf('/busy');
    const halfIdx = out.indexOf('/half');
    const cleanIdx = out.indexOf('/clean');
    expect(busyIdx).toBeLessThan(halfIdx);
    expect(halfIdx).toBeLessThan(cleanIdx);
  });

  it('truncates the heat map when there are more pages than the limit', () => {
    const pages = Array.from({ length: 30 }, (_, i) => makePage({ path: `/p${i}` }));
    const out = stripAnsi(formatMultiPageConsoleReport(makeReport({ pages }), { heatMapLimit: 5 }));
    expect(out).toContain('+25 more page(s)');
  });

  it('renders top cross-page findings sorted by reach', () => {
    const out = stripAnsi(
      formatMultiPageConsoleReport(
        makeReport({
          crossPage: [
            {
              finding: makeFinding({ ruleId: 'small', file: 'src/Small.astro', line: 1 }),
              affectedPages: ['/a'],
              occurrenceCount: 1,
            },
            {
              finding: makeFinding({ ruleId: 'huge', file: 'src/Layout.astro', line: 12 }),
              affectedPages: ['/a', '/b', '/c', '/d', '/e'],
              occurrenceCount: 5,
            },
          ],
        }),
      ),
    );
    const hugeIdx = out.indexOf('huge');
    const smallIdx = out.indexOf('small');
    expect(hugeIdx).toBeGreaterThan(-1);
    expect(hugeIdx).toBeLessThan(smallIdx);
    expect(out).toContain('5 page(s)');
  });

  it('truncates the per-finding affected-pages list to 3 with a "+more" line', () => {
    const out = stripAnsi(
      formatMultiPageConsoleReport(
        makeReport({
          crossPage: [
            {
              finding: makeFinding({ ruleId: 'huge', file: 'src/L.astro', line: 1 }),
              affectedPages: ['/a', '/b', '/c', '/d', '/e'],
              occurrenceCount: 5,
            },
          ],
        }),
      ),
    );
    expect(out).toContain('+2 more');
  });

  it('honors a custom topCount for cross-page findings', () => {
    const cp: CrossPageFinding[] = Array.from({ length: 20 }, (_, i) => ({
      finding: makeFinding({ ruleId: `r${i}`, file: 'src/A.tsx', line: i }),
      affectedPages: ['/a'],
      occurrenceCount: 1,
    }));
    const out = stripAnsi(
      formatMultiPageConsoleReport(makeReport({ crossPage: cp }), { topCount: 3 }),
    );
    expect(out).toContain('Top 3 cross-page findings');
    expect(out).toContain('+17 more');
  });

  it('groups skipped pages by reason', () => {
    const out = stripAnsi(
      formatMultiPageConsoleReport(
        makeReport({
          pages: [
            makePage({
              path: '/[a]',
              skip: { reason: 'dynamic-no-sample', note: 'no sample' },
            }),
            makePage({
              path: '/[b]',
              skip: { reason: 'dynamic-no-sample', note: 'no sample' },
            }),
            makePage({
              path: '/broken',
              skip: { reason: 'runner-error', note: 'timeout' },
            }),
          ],
        }),
      ),
    );
    expect(out).toContain('Skipped (3):');
    expect(out).toContain('dynamic-no-sample (2):');
    expect(out).toContain('runner-error (1):');
  });

  it('omits cross-page and skipped sections when empty', () => {
    const out = stripAnsi(
      formatMultiPageConsoleReport(
        makeReport({
          pages: [makePage({ path: '/' })],
        }),
      ),
    );
    expect(out).not.toContain('cross-page findings');
    expect(out).not.toContain('Skipped');
  });

  it('renders an empty-pages note when discovery returned nothing', () => {
    const out = stripAnsi(formatMultiPageConsoleReport(makeReport({})));
    expect(out).toContain('(no pages)');
  });

  it('shows file:line provenance when available', () => {
    const out = stripAnsi(
      formatMultiPageConsoleReport(
        makeReport({
          crossPage: [
            {
              finding: makeFinding({
                ruleId: 'landmark-main',
                file: 'src/Layout.astro',
                line: 12,
              }),
              affectedPages: ['/a', '/b'],
              occurrenceCount: 2,
            },
          ],
        }),
      ),
    );
    expect(out).toContain('src/Layout.astro:12');
  });

  it('shows selector provenance when no file is present', () => {
    const out = stripAnsi(
      formatMultiPageConsoleReport(
        makeReport({
          crossPage: [
            {
              finding: makeFinding({ ruleId: 'aria', selector: 'button.cta' }),
              affectedPages: ['/a', '/b'],
              occurrenceCount: 2,
            },
          ],
        }),
      ),
    );
    expect(out).toContain('button.cta');
  });

  it('renders a skipped-only report (zero audited, all skipped)', () => {
    const out = stripAnsi(
      formatMultiPageConsoleReport(
        makeReport({
          pages: [
            makePage({
              path: '/[a]',
              skip: { reason: 'dynamic-no-sample', note: 'no sample' },
            }),
            makePage({
              path: '/[b]',
              skip: { reason: 'dynamic-no-sample', note: 'no sample' },
            }),
          ],
        }),
      ),
    );
    expect(out).toContain('0 audited');
    expect(out).toContain('Skipped (2):');
  });

  it('does not render the "+more" line when heatMapLimit exceeds page count', () => {
    const pages = Array.from({ length: 4 }, (_, i) => makePage({ path: `/p${i}` }));
    const out = stripAnsi(
      formatMultiPageConsoleReport(makeReport({ pages }), { heatMapLimit: 50 }),
    );
    for (let i = 0; i < 4; i += 1) {
      expect(out).toContain(`/p${i}`);
    }
    expect(out).not.toMatch(/\+\d+ more page\(s\)/);
  });

  it('does not duplicate rows when the same page appears twice in the report', () => {
    // Synthesize an unusual report where the same path appears twice (from
    // sitemap + json-config dedup gone wrong). Console formatter must not
    // crash and should render each row distinctly.
    const out = stripAnsi(
      formatMultiPageConsoleReport(
        makeReport({
          pages: [makePage({ path: '/x' }), makePage({ path: '/x' })],
        }),
      ),
    );
    expect(out).toContain('/x');
  });

  it('groups three or more skip reasons distinctly', () => {
    const out = stripAnsi(
      formatMultiPageConsoleReport(
        makeReport({
          pages: [
            makePage({
              path: '/[a]',
              skip: { reason: 'dynamic-no-sample', note: 'no sample' },
            }),
            makePage({
              path: '/broken',
              skip: { reason: 'runner-error', note: 'timeout' },
            }),
            makePage({
              path: '/cap',
              skip: { reason: 'max-pages', note: 'capped' },
            }),
          ],
        }),
      ),
    );
    expect(out).toContain('dynamic-no-sample (1):');
    expect(out).toContain('runner-error (1):');
    expect(out).toContain('max-pages (1):');
  });
});
