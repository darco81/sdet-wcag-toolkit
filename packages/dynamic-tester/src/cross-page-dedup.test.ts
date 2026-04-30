/**
 * Cross-page dedup unit tests. Synthesises PageAuditResult input so
 * the suite stays pure (no orchestrator, no browser).
 */

import { describe, expect, it } from 'vitest';

import type { PageAuditResult, WcagFinding } from '@sdet-wcag-toolkit/core';
import { requireSuccessCriterion } from '@sdet-wcag-toolkit/core';

import { buildCrossPageFindings, groupingKey } from './cross-page-dedup.js';

const SC = requireSuccessCriterion('1.3.1');

function sourceFinding(opts: {
  ruleId: string;
  file: string;
  line: number;
  message: string;
  url?: string;
}): WcagFinding {
  return {
    id: `f-${opts.ruleId}-${opts.file}-${opts.line}`,
    ruleId: opts.ruleId,
    successCriterion: SC,
    severity: 'serious',
    source: 'static',
    message: opts.message,
    location: { file: opts.file, line: opts.line },
  };
}

function selectorFinding(opts: { ruleId: string; selector: string; message: string }): WcagFinding {
  return {
    id: `s-${opts.ruleId}-${opts.selector}`,
    ruleId: opts.ruleId,
    successCriterion: SC,
    severity: 'serious',
    source: 'dynamic',
    message: opts.message,
    location: { selector: opts.selector },
  };
}

function page(url: string, findings: WcagFinding[]): PageAuditResult {
  return {
    discoveredRoute: { path: url, source: 'test', isDynamic: false },
    auditedUrl: url,
    findings,
    durationMs: 1,
  };
}

describe('buildCrossPageFindings', () => {
  it('collapses the same source-located finding across pages into one entry', () => {
    const f = sourceFinding({
      ruleId: 'landmark-main',
      file: 'src/Layout.astro',
      line: 12,
      message: 'No <main> landmark.',
    });
    const result = buildCrossPageFindings([
      page('https://x.com/about', [structuredClone(f)]),
      page('https://x.com/contact', [structuredClone(f)]),
      page('https://x.com/blog', [structuredClone(f)]),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.affectedPages).toEqual([
      'https://x.com/about',
      'https://x.com/blog',
      'https://x.com/contact',
    ]);
    expect(result[0]?.occurrenceCount).toBe(3);
  });

  it('keeps distinct findings separate even when ruleId matches', () => {
    const a = sourceFinding({
      ruleId: 'color-contrast',
      file: 'src/A.astro',
      line: 10,
      message: '...',
    });
    const b = sourceFinding({
      ruleId: 'color-contrast',
      file: 'src/B.astro',
      line: 5,
      message: '...',
    });
    const result = buildCrossPageFindings([page('https://x.com/1', [a, b])]);

    expect(result).toHaveLength(2);
  });

  it('groups DOM-located findings by ruleId + selector', () => {
    const a = selectorFinding({
      ruleId: 'aria-label',
      selector: 'button.cta',
      message: '...',
    });
    const result = buildCrossPageFindings([
      page('https://x.com/1', [structuredClone(a)]),
      page('https://x.com/2', [structuredClone(a)]),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.affectedPages).toHaveLength(2);
  });

  it('falls back to ruleId + message when location has neither file nor selector', () => {
    const finding: WcagFinding = {
      id: 'orphan',
      ruleId: 'orphan-rule',
      successCriterion: SC,
      severity: 'minor',
      source: 'manual',
      message: 'orphan',
      location: {},
    };
    const result = buildCrossPageFindings([
      page('https://x.com/1', [structuredClone(finding)]),
      page('https://x.com/2', [structuredClone(finding)]),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.occurrenceCount).toBe(2);
  });

  it('ignores skipped pages entirely', () => {
    const f = sourceFinding({
      ruleId: 'landmark-main',
      file: 'src/Layout.astro',
      line: 12,
      message: '...',
    });
    const skippedPage: PageAuditResult = {
      discoveredRoute: { path: '/admin', source: 'test', isDynamic: false },
      findings: [structuredClone(f)], // should NOT count
      durationMs: 0,
      skipped: { reason: 'runner-error', note: 'navigation timeout' },
    };
    const result = buildCrossPageFindings([
      page('https://x.com/about', [structuredClone(f)]),
      skippedPage,
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.occurrenceCount).toBe(1);
    expect(result[0]?.affectedPages).toEqual(['https://x.com/about']);
  });

  it('returns [] for an empty input', () => {
    expect(buildCrossPageFindings([])).toEqual([]);
  });

  it('keeps the canonical finding stable (first-seen wins)', () => {
    const first = sourceFinding({
      ruleId: 'r',
      file: 'src/Foo.astro',
      line: 1,
      message: 'first message',
    });
    const second = sourceFinding({
      ruleId: 'r',
      file: 'src/Foo.astro',
      line: 1,
      message: 'second message (will be ignored)',
    });
    const result = buildCrossPageFindings([
      page('https://x.com/a', [first]),
      page('https://x.com/b', [second]),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.finding.message).toBe('first message');
  });
});

describe('groupingKey', () => {
  it('prefers file/line when present', () => {
    const f = sourceFinding({ ruleId: 'r', file: 'src/A.tsx', line: 7, message: '...' });
    expect(groupingKey(f)).toBe('file::r::src/A.tsx::7');
  });

  it('uses selector when there is no file', () => {
    const f = selectorFinding({ ruleId: 'r', selector: 'div.x', message: '...' });
    expect(groupingKey(f)).toBe('selector::r::div.x');
  });

  it('falls back to message when neither file nor selector is present', () => {
    const f: WcagFinding = {
      id: 'x',
      ruleId: 'r',
      successCriterion: SC,
      severity: 'minor',
      source: 'manual',
      message: 'msg',
      location: {},
    };
    expect(groupingKey(f)).toBe('fallback::r::msg');
  });
});

describe('buildCrossPageFindings - additional edge cases', () => {
  it('does not duplicate the same page in affectedPages when a finding fires twice on it', () => {
    const f = sourceFinding({
      ruleId: 'landmark-main',
      file: 'src/Layout.astro',
      line: 12,
      message: 'No <main>.',
    });
    // Two findings with the same id-key on the same URL - the orchestrator
    // would normally dedupe by id, but the cross-page builder must also
    // handle the case defensively.
    const result = buildCrossPageFindings([
      page('https://x.com/a', [structuredClone(f), structuredClone(f)]),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.affectedPages).toEqual(['https://x.com/a']);
  });

  it('emits affectedPages sorted lexicographically for stable report output', () => {
    const f = sourceFinding({
      ruleId: 'landmark-main',
      file: 'src/Layout.astro',
      line: 12,
      message: '...',
    });
    const result = buildCrossPageFindings([
      page('https://x.com/zebra', [structuredClone(f)]),
      page('https://x.com/apple', [structuredClone(f)]),
      page('https://x.com/mango', [structuredClone(f)]),
    ]);

    expect(result[0]?.affectedPages).toEqual([
      'https://x.com/apple',
      'https://x.com/mango',
      'https://x.com/zebra',
    ]);
  });

  it('treats different selectors as distinct groupings', () => {
    const a = selectorFinding({ ruleId: 'aria-label', selector: 'button.a', message: '...' });
    const b = selectorFinding({ ruleId: 'aria-label', selector: 'button.b', message: '...' });
    const result = buildCrossPageFindings([
      page('https://x.com/1', [a]),
      page('https://x.com/1', [b]),
    ]);

    expect(result).toHaveLength(2);
  });

  it('uses auditedUrl when present and falls back to discoveredRoute.path otherwise', () => {
    const f = sourceFinding({
      ruleId: 'r',
      file: 'src/A.astro',
      line: 1,
      message: '...',
    });
    const withUrl: PageAuditResult = {
      discoveredRoute: { path: '/from-route', source: 'test', isDynamic: false },
      auditedUrl: 'https://x.com/explicit',
      findings: [structuredClone(f)],
      durationMs: 1,
    };
    const withoutUrl: PageAuditResult = {
      discoveredRoute: { path: '/from-route-only', source: 'test', isDynamic: false },
      findings: [structuredClone(f)],
      durationMs: 1,
    };
    const result = buildCrossPageFindings([withUrl, withoutUrl]);

    expect(result).toHaveLength(1);
    expect(result[0]?.affectedPages).toContain('https://x.com/explicit');
    expect(result[0]?.affectedPages).toContain('/from-route-only');
  });
});
