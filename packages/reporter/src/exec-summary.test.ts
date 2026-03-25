import { describe, expect, it } from 'vitest';

import { requireSuccessCriterion, type WcagFinding, type WcagSeverity } from '@sdet-wcag-toolkit/core';

import { formatExecSummary } from './exec-summary.js';

function finding(severity: WcagSeverity, scId: string, ruleId: string): WcagFinding {
  return {
    id: `${severity}-${ruleId}`,
    successCriterion: requireSuccessCriterion(scId),
    severity,
    message: `${severity} - ${ruleId} violation`,
    location: { file: 'a.html', line: 1 },
    source: 'static',
    ruleId,
  };
}

describe('formatExecSummary', () => {
  it('reports a clean pass when there are no findings', () => {
    const out = formatExecSummary([]);
    expect(out).toContain('passes our WCAG 2.2 Level AA static audit');
  });

  it('surfaces the grade in the headline', () => {
    const critical = finding('critical', '4.1.2', 'r1');
    const out = formatExecSummary([critical]);
    expect(out).toMatch(/scores an? \*\*[A-F]\*\*/);
  });

  it('renders a Score (Grade X) section with severity penalties', () => {
    const out = formatExecSummary([
      finding('critical', '4.1.2', 'r1'),
      finding('serious', '1.4.3', 'r2'),
      finding('serious', '1.4.3', 'r3'),
      finding('moderate', '1.3.1', 'r4'),
    ]);
    // critical 15 + 2*serious 20 + moderate 5 = 40, score = 60 → Grade C
    expect(out).toContain('## Score: 60 (Grade C)');
    expect(out).toContain('1 critical (-15)');
    expect(out).toContain('2 serious (-20)');
    expect(out).toContain('1 moderate (-5)');
  });

  it('renders a perfect-score section for empty audit', () => {
    const out = formatExecSummary([]);
    expect(out).toContain('## Score: 100 (Grade A)');
    expect(out).toContain('perfect score');
  });

  it('lists the top risks', () => {
    const findings = [
      finding('critical', '1.1.1', 'image-alt'),
      finding('serious', '1.4.3', 'color-contrast'),
      finding('serious', '2.1.1', 'keyboard'),
    ];
    const out = formatExecSummary(findings, { topRiskCount: 2 });
    expect(out).toContain('## Top risks');
    const riskCount = (out.match(/^\d+\. /gm) ?? []).length;
    expect(riskCount).toBe(2);
  });

  it('mentions EAA / legal context', () => {
    const out = formatExecSummary([finding('moderate', '1.3.1', 'r1')]);
    expect(out).toContain('European Accessibility Act');
  });

  it('uses the provided target name in the headline', () => {
    const out = formatExecSummary([], { target: 'portfolio.sdet.it' });
    expect(out).toContain('portfolio.sdet.it');
  });

  it('fits in under 60 lines (one-page target)', () => {
    const findings = [
      finding('critical', '4.1.2', 'r1'),
      finding('serious', '1.4.3', 'r2'),
      finding('moderate', '1.3.1', 'r3'),
      finding('minor', '2.4.6', 'r4'),
    ];
    const out = formatExecSummary(findings);
    expect(out.split('\n').length).toBeLessThan(60);
  });
});
