import { describe, expect, it } from 'vitest';

import {
  SEVERITY_WEIGHT,
  aggregateScore,
  countBySeverity,
  gradeFor,
  gradeWithCriticalPenalty,
} from './severity.js';
import type { WcagFinding, WcagSeverity } from './types.js';
import { requireSuccessCriterion } from './wcag-catalog.js';

function finding(severity: WcagSeverity, index = 0): WcagFinding {
  return {
    id: `test-${severity}-${index}`,
    successCriterion: requireSuccessCriterion('1.3.1'),
    severity,
    message: 'test',
    location: { file: 'test.tsx', line: 1 },
    source: 'static',
    ruleId: 'test',
  };
}

describe('SEVERITY_WEIGHT', () => {
  it('orders weights critical > serious > moderate > minor', () => {
    expect(SEVERITY_WEIGHT.critical).toBeGreaterThan(SEVERITY_WEIGHT.serious);
    expect(SEVERITY_WEIGHT.serious).toBeGreaterThan(SEVERITY_WEIGHT.moderate);
    expect(SEVERITY_WEIGHT.moderate).toBeGreaterThan(SEVERITY_WEIGHT.minor);
  });
});

describe('countBySeverity', () => {
  it('counts an empty list as all zeros', () => {
    expect(countBySeverity([])).toEqual({
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0,
      total: 0,
    });
  });

  it('counts findings by severity', () => {
    const findings = [
      finding('critical', 0),
      finding('critical', 1),
      finding('serious', 0),
      finding('moderate', 0),
      finding('moderate', 1),
      finding('moderate', 2),
      finding('minor', 0),
    ];
    expect(countBySeverity(findings)).toEqual({
      critical: 2,
      serious: 1,
      moderate: 3,
      minor: 1,
      total: 7,
    });
  });
});

describe('aggregateScore', () => {
  it('returns 0 for an empty list', () => {
    expect(aggregateScore([])).toBe(0);
  });

  it('sums weights across findings', () => {
    const findings = [finding('critical'), finding('serious'), finding('minor')];
    expect(aggregateScore(findings)).toBe(
      SEVERITY_WEIGHT.critical + SEVERITY_WEIGHT.serious + SEVERITY_WEIGHT.minor,
    );
  });
});

describe('gradeFor', () => {
  it('returns A for zero findings', () => {
    expect(gradeFor([])).toBe('A');
  });

  it('returns B for a small amount of debt', () => {
    expect(gradeFor([finding('minor'), finding('minor')])).toBe('B'); // score 2
  });

  it('returns C for moderate debt', () => {
    // 3 serious = 15... tier A = 0, so 15 falls into B (maxScore 15). Need 16+.
    const findings = Array.from({ length: 4 }, (_, i) => finding('serious', i));
    expect(gradeFor(findings)).toBe('C'); // score 20
  });

  it('returns F for extensive debt', () => {
    const findings = Array.from({ length: 20 }, (_, i) => finding('critical', i));
    expect(gradeFor(findings)).toBe('F');
  });
});

describe('gradeWithCriticalPenalty', () => {
  it('leaves a clean audit as A', () => {
    expect(gradeWithCriticalPenalty([])).toBe('A');
  });

  it('drags an otherwise-B grade down to D when a Critical is present', () => {
    const findings = [finding('critical'), finding('minor')];
    // base score = 11 → B, but with penalty → D.
    expect(gradeFor(findings)).toBe('B');
    expect(gradeWithCriticalPenalty(findings)).toBe('D');
  });

  it('leaves an F grade as F even with criticals', () => {
    const findings = Array.from({ length: 20 }, (_, i) => finding('critical', i));
    expect(gradeWithCriticalPenalty(findings)).toBe('F');
  });
});
