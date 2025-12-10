import { describe, expect, it } from 'vitest';

import { requireSuccessCriterion, type WcagFinding, type WcagSeverity } from '@sdet-wcag-toolkit/core';

import { formatConsoleReport } from './console.js';

function finding(severity: WcagSeverity, scId = '1.3.1', ruleId = 'r'): WcagFinding {
  return {
    id: `${severity}-${ruleId}`,
    successCriterion: requireSuccessCriterion(scId),
    severity,
    message: `${severity} problem`,
    remediation: 'fix it',
    location: { file: 'x.html', line: 1 },
    source: 'static',
    ruleId,
  };
}

function strip(ansi: string): string {
  // Remove color escape sequences so assertions don't depend on chalk internals.
  return ansi.replace(/\u001b\[[0-9;]*m/g, '');
}

describe('formatConsoleReport', () => {
  it('shows an A grade and a success line when findings are empty', () => {
    const out = strip(formatConsoleReport([]));
    expect(out).toContain(' A ');
    expect(out).toContain('No static WCAG issues detected');
  });

  it('shows the total finding count in the header', () => {
    const out = strip(formatConsoleReport([finding('minor'), finding('minor', '1.4.3', 'r2')]));
    expect(out).toContain('2 findings');
  });

  it('uses the singular "1 finding" for a single finding', () => {
    const out = strip(formatConsoleReport([finding('minor')]));
    expect(out).toContain('1 finding');
  });

  it('downgrades to D when a Critical finding is present', () => {
    const out = strip(formatConsoleReport([finding('critical')]));
    // Grade renders as " D " with padding.
    expect(out).toMatch(/ D /);
  });

  it('prints a severity breakdown line', () => {
    const out = strip(
      formatConsoleReport([
        finding('critical'),
        finding('serious', '1.4.3', 'r2'),
        finding('moderate', '2.1.1', 'r3'),
        finding('minor', '2.4.1', 'r4'),
      ]),
    );
    expect(out).toContain('Critical: 1');
    expect(out).toContain('Serious: 1');
    expect(out).toContain('Moderate: 1');
    expect(out).toContain('Minor: 1');
  });

  it('limits the listed findings to the top option', () => {
    const findings = Array.from({ length: 5 }, (_, i) => finding('serious', '1.3.1', `r${i}`));
    const out = strip(formatConsoleReport(findings, { top: 2 }));
    expect(out).toContain('Top 2 findings');
    expect(out).toContain('and 3 more');
  });

  it('includes the remediation hint when available', () => {
    const out = strip(formatConsoleReport([finding('serious')]));
    expect(out).toContain('fix it');
  });
});
