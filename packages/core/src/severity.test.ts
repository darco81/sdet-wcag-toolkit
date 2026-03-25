import { describe, expect, it } from 'vitest';

import {
  PENALTY_WEIGHT,
  SEVERITY_WEIGHT,
  aggregatePenaltyScore,
  aggregateScore,
  countBySeverity,
  gradeFor,
  gradeFromPenaltyScore,
  gradeWithCriticalPenalty,
  scoreAndGrade,
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

describe('PENALTY_WEIGHT', () => {
  it('matches the v0.3 lead-orchestrator rubric', () => {
    expect(PENALTY_WEIGHT.critical).toBe(15);
    expect(PENALTY_WEIGHT.serious).toBe(10);
    expect(PENALTY_WEIGHT.moderate).toBe(5);
    expect(PENALTY_WEIGHT.minor).toBe(2);
  });
});

describe('aggregatePenaltyScore', () => {
  it('returns 100 for a clean audit', () => {
    expect(aggregatePenaltyScore([])).toBe(100);
  });

  it('subtracts severity-weighted penalties from 100', () => {
    expect(aggregatePenaltyScore([finding('critical')])).toBe(85);
    expect(aggregatePenaltyScore([finding('serious')])).toBe(90);
    expect(aggregatePenaltyScore([finding('moderate')])).toBe(95);
    expect(aggregatePenaltyScore([finding('minor')])).toBe(98);
  });

  it('combines penalties additively', () => {
    const findings = [finding('critical'), finding('serious'), finding('moderate')];
    // 100 - 15 - 10 - 5 = 70
    expect(aggregatePenaltyScore(findings)).toBe(70);
  });

  it('floors the score at 0 (never negative)', () => {
    const findings = Array.from({ length: 20 }, (_, i) => finding('critical', i));
    expect(aggregatePenaltyScore(findings)).toBe(0);
  });
});

describe('gradeFromPenaltyScore', () => {
  it('A for 90+', () => {
    expect(gradeFromPenaltyScore(100)).toBe('A');
    expect(gradeFromPenaltyScore(95)).toBe('A');
    expect(gradeFromPenaltyScore(90)).toBe('A');
  });

  it('B for 75-89', () => {
    expect(gradeFromPenaltyScore(89)).toBe('B');
    expect(gradeFromPenaltyScore(80)).toBe('B');
    expect(gradeFromPenaltyScore(75)).toBe('B');
  });

  it('C for 50-74', () => {
    expect(gradeFromPenaltyScore(74)).toBe('C');
    expect(gradeFromPenaltyScore(60)).toBe('C');
    expect(gradeFromPenaltyScore(50)).toBe('C');
  });

  it('D for 25-49', () => {
    expect(gradeFromPenaltyScore(49)).toBe('D');
    expect(gradeFromPenaltyScore(30)).toBe('D');
    expect(gradeFromPenaltyScore(25)).toBe('D');
  });

  it('F for below 25', () => {
    expect(gradeFromPenaltyScore(24)).toBe('F');
    expect(gradeFromPenaltyScore(10)).toBe('F');
    expect(gradeFromPenaltyScore(0)).toBe('F');
  });
});

describe('scoreAndGrade', () => {
  it('returns score and grade together', () => {
    const findings = [finding('serious')]; // penalty 10 → score 90 → A
    expect(scoreAndGrade(findings)).toEqual({ score: 90, grade: 'A' });
  });

  it('returns 100/A for empty findings', () => {
    expect(scoreAndGrade([])).toEqual({ score: 100, grade: 'A' });
  });
});
