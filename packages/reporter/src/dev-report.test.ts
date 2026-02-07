import { describe, expect, it } from 'vitest';

import { requireSuccessCriterion, type WcagFinding, type WcagSeverity } from '@sdet-wcag-toolkit/core';

import { formatDevReport } from './dev-report.js';

function finding(
  severity: WcagSeverity,
  scId: string,
  ruleId: string,
  overrides: Partial<WcagFinding> = {},
): WcagFinding {
  return {
    id: `${severity}-${ruleId}`,
    successCriterion: requireSuccessCriterion(scId),
    severity,
    message: `${severity} - ${ruleId} violation`,
    remediation: 'fix it',
    location: { file: 'src/App.tsx', line: 12 },
    source: 'static',
    ruleId,
    ...overrides,
  };
}

describe('formatDevReport', () => {
  it('renders a clean pass message with grade A when there are no findings', () => {
    const out = formatDevReport([]);
    expect(out).toContain('**Grade:** A');
    expect(out).toContain('No findings');
  });

  it('shows the severity breakdown table', () => {
    const out = formatDevReport([
      finding('critical', '1.3.1', 'r1'),
      finding('serious', '1.4.3', 'r2'),
      finding('moderate', '2.1.1', 'r3'),
    ]);
    expect(out).toContain('| Critical | 1 |');
    expect(out).toContain('| Serious | 1 |');
    expect(out).toContain('| Moderate | 1 |');
  });

  it('limits the Top N section to the requested count', () => {
    const findings = Array.from({ length: 8 }, (_, i) => finding('serious', '1.3.1', `r${i}`));
    const out = formatDevReport(findings, { topCount: 3 });
    expect(out).toMatch(/Top 3 findings/);
  });

  it('groups full findings by WCAG principle', () => {
    const out = formatDevReport([
      finding('serious', '1.1.1', 'image-alt'),
      finding('serious', '2.1.1', 'keyboard'),
      finding('serious', '4.1.2', 'name-role-value'),
    ]);
    expect(out).toContain('### Perceivable');
    expect(out).toContain('### Operable');
    expect(out).toContain('### Robust');
  });

  it('includes remediation and SC reference link per finding', () => {
    const out = formatDevReport([finding('serious', '1.4.3', 'color-contrast')]);
    expect(out).toContain('**Fix:** fix it');
    expect(out).toMatch(/\[Reference\]\(https:\/\/www\.w3\.org/);
  });

  it('uses the custom title when provided', () => {
    const out = formatDevReport([], { title: 'Portfolio audit' });
    expect(out).toMatch(/^# Portfolio audit/);
  });
});
