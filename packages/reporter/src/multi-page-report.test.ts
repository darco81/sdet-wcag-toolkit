/**
 * Multi-page markdown reporter tests. Builds synthetic
 * MultiPageAuditReport fixtures to drive each rendering branch.
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

import { formatMultiPageDevReport } from './multi-page-report.js';

const SC = requireSuccessCriterion('1.3.1');

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
  durationMs?: number;
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
    durationMs: opts.durationMs ?? 100,
    ...(opts.skip !== undefined && { skipped: opts.skip }),
  };
}

function makeReport(opts: {
  pages?: PageAuditResult[];
  crossPage?: CrossPageFinding[];
  baseUrl?: string;
}): MultiPageAuditReport {
  const pages = opts.pages ?? [];
  const crossPage = opts.crossPage ?? [];
  const auditedPages = pages.filter((p) => p.skipped === undefined);
  return {
    baseUrl: opts.baseUrl ?? 'https://staging.example.com',
    discovery: {
      strategy: 'sitemap',
      routes: pages.map((p) => p.discoveredRoute),
      confidence: 1,
      warnings: [],
    },
    pages,
    crossPage,
    totalDurationMs: 1234,
    summary: {
      pagesAudited: auditedPages.length,
      pagesSkipped: pages.length - auditedPages.length,
      totalFindings: auditedPages.reduce((acc, p) => acc + p.findings.length, 0),
      uniqueFindings: crossPage.length,
    },
  };
}

describe('formatMultiPageDevReport', () => {
  it('renders the header with baseUrl, strategy, and summary', () => {
    const md = formatMultiPageDevReport(makeReport({}));
    expect(md).toContain('# Multi-page WCAG 2.2 AA audit');
    expect(md).toContain('**Base URL:** `https://staging.example.com`');
    expect(md).toContain('**Discovery:** `sitemap`');
    expect(md).toContain('**Audited:** 0 page(s)');
    expect(md).toContain('**Findings:** 0 unique');
  });

  it('renders an explicit empty heat map when no pages were discovered', () => {
    const md = formatMultiPageDevReport(makeReport({}));
    expect(md).toContain('## Heat map');
    expect(md).toContain('_No pages were discovered._');
  });

  it('renders the heat map sorted by total findings DESC', () => {
    const finding = makeFinding({ ruleId: 'r1', file: 'src/A.tsx', line: 1 });
    const md = formatMultiPageDevReport(
      makeReport({
        pages: [
          makePage({ path: '/clean', findings: [] }),
          makePage({ path: '/busy', findings: [finding, { ...finding, id: 'r2' }] }),
          makePage({ path: '/half', findings: [finding] }),
        ],
      }),
    );
    const heatMap = md.split('## Cross-page findings')[0] ?? '';
    const busyIdx = heatMap.indexOf('`/busy`');
    const halfIdx = heatMap.indexOf('`/half`');
    const cleanIdx = heatMap.indexOf('`/clean`');
    expect(busyIdx).toBeLessThan(halfIdx);
    expect(halfIdx).toBeLessThan(cleanIdx);
  });

  it('renders skipped pages with strikethrough in the heat map', () => {
    const md = formatMultiPageDevReport(
      makeReport({
        pages: [
          makePage({
            path: '/admin/users',
            skip: { reason: 'dynamic-no-sample', note: 'no sample URL' },
          }),
        ],
      }),
    );
    expect(md).toContain('~~/admin/users~~');
  });

  it('shows the "single fix → many pages green" callout when applicable', () => {
    const finding = makeFinding({ ruleId: 'landmark-main', file: 'src/Layout.astro', line: 12 });
    const md = formatMultiPageDevReport(
      makeReport({
        crossPage: [
          {
            finding,
            affectedPages: ['/a', '/b', '/c'],
            occurrenceCount: 3,
          },
        ],
      }),
    );
    expect(md).toContain('Single fix → many pages green');
    expect(md).toContain('affects **3** page(s)');
  });

  it('omits the callout when no finding spans more than one page', () => {
    const finding = makeFinding({ ruleId: 'r', file: 'src/A.tsx', line: 1 });
    const md = formatMultiPageDevReport(
      makeReport({
        crossPage: [{ finding, affectedPages: ['/only'], occurrenceCount: 1 }],
      }),
    );
    expect(md).not.toContain('Single fix → many pages green');
  });

  it('sorts cross-page findings by reach (affectedPages.length DESC)', () => {
    const md = formatMultiPageDevReport(
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
    );
    const hugeIdx = md.indexOf('`huge`');
    const smallIdx = md.indexOf('`small`');
    expect(hugeIdx).toBeLessThan(smallIdx);
  });

  it('truncates the per-affected-pages list to 5 with a "+more" suffix', () => {
    const md = formatMultiPageDevReport(
      makeReport({
        crossPage: [
          {
            finding: makeFinding({ ruleId: 'huge', file: 'src/Layout.astro', line: 12 }),
            affectedPages: ['/a', '/b', '/c', '/d', '/e', '/f', '/g', '/h'],
            occurrenceCount: 8,
          },
        ],
      }),
    );
    expect(md).toContain('+3 more');
  });

  it('renders per-page details sections for audited pages', () => {
    const md = formatMultiPageDevReport(
      makeReport({
        pages: [
          makePage({
            path: '/about',
            url: 'https://staging.example.com/about',
            findings: [makeFinding({ ruleId: 'r', file: 'src/A.tsx', line: 1 })],
          }),
        ],
      }),
    );
    expect(md).toContain('## Per-page details');
    expect(md).toContain('`/about`');
    expect(md).toContain('Audited URL: https://staging.example.com/about');
  });

  it('collapses per-page details when there are many audited pages', () => {
    const pages = Array.from({ length: 25 }, (_, i) => makePage({ path: `/p${i}`, findings: [] }));
    const md = formatMultiPageDevReport(makeReport({ pages }), { perPageCollapseThreshold: 10 });
    expect(md).toContain('<details>');
    expect(md).toContain('</details>');
    expect(md).toContain('25 page(s) - click to expand');
  });

  it('renders a skipped routes table with reason and note', () => {
    const md = formatMultiPageDevReport(
      makeReport({
        pages: [
          makePage({
            path: '/admin/[id]',
            skip: { reason: 'dynamic-no-sample', note: 'no sample URL' },
          }),
          makePage({
            path: '/secret',
            skip: { reason: 'runner-error', note: 'navigation timeout' },
          }),
        ],
      }),
    );
    expect(md).toContain('## Skipped routes (2)');
    expect(md).toContain('| `/admin/[id]` | `dynamic-no-sample` | no sample URL |');
    expect(md).toContain('| `/secret` | `runner-error` | navigation timeout |');
  });

  it('honors a custom title and topCount', () => {
    const finding = makeFinding({ ruleId: 'r', file: 'src/A.tsx', line: 1 });
    const md = formatMultiPageDevReport(
      makeReport({
        crossPage: Array.from({ length: 15 }, (_, i) => ({
          finding: { ...finding, id: `f${i}`, ruleId: `r${i}` },
          affectedPages: ['/a'],
          occurrenceCount: 1,
        })),
      }),
      { title: 'Staging audit · 2026-04-29', topCount: 3 },
    );
    expect(md).toContain('# Staging audit · 2026-04-29');
    expect(md).toContain('Top 3 by reach');
    expect(md).toContain('…and 12 more');
  });

  it('escapes pipe characters in route paths so they do not break tables', () => {
    const md = formatMultiPageDevReport(
      makeReport({
        pages: [makePage({ path: '/foo|bar', findings: [] })],
      }),
    );
    expect(md).toContain('/foo\\|bar');
  });

  it('handles selector-located findings in per-page sections', () => {
    const md = formatMultiPageDevReport(
      makeReport({
        pages: [
          makePage({
            path: '/x',
            findings: [makeFinding({ ruleId: 'r', selector: 'button.cta', message: '...' })],
          }),
        ],
      }),
    );
    expect(md).toContain('`button.cta`');
  });
});
