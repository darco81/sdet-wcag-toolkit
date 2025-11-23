/**
 * Severity scoring and aggregation for WCAG findings.
 *
 * We keep the taxonomy aligned with axe-core (critical/serious/moderate/minor)
 * so violations from axe can be ingested without translation. Weights are
 * chosen so that one Critical is roughly equivalent to two Serious or five
 * Moderate - rough, but directionally useful for sorting and reporting.
 */

import type { WcagFinding, WcagSeverity } from './types.js';

/** Overall audit grade. `A` is clean; `F` is a crisis. */
export type WcagGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/** Numeric weight for each severity - used for scoring and sorting. */
export const SEVERITY_WEIGHT: Readonly<Record<WcagSeverity, number>> = {
  critical: 10,
  serious: 5,
  moderate: 2,
  minor: 1,
};

/**
 * Breakdown of a finding list by severity. Handy for report tables and
 * exec-summary headlines.
 */
export interface SeverityBreakdown {
  readonly critical: number;
  readonly serious: number;
  readonly moderate: number;
  readonly minor: number;
  readonly total: number;
}

export function countBySeverity(findings: readonly WcagFinding[]): SeverityBreakdown {
  const counts: Record<WcagSeverity, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const f of findings) counts[f.severity] += 1;
  return {
    critical: counts.critical,
    serious: counts.serious,
    moderate: counts.moderate,
    minor: counts.minor,
    total: findings.length,
  };
}

/**
 * Weighted score: sum of {@link SEVERITY_WEIGHT} across all findings.
 *
 * This is a single number that correlates with "how much pain would it take
 * to remediate this". Lower is better; zero is perfect.
 */
export function aggregateScore(findings: readonly WcagFinding[]): number {
  let score = 0;
  for (const f of findings) score += SEVERITY_WEIGHT[f.severity];
  return score;
}

/**
 * Thresholds for each grade, in weighted-score units. A finding list whose
 * aggregate score is `<= threshold[grade]` gets that grade (smallest match
 * wins).
 *
 * The thresholds are deliberately lenient so a large site can still earn a
 * C or D rather than always hitting F. Tune as we gather data.
 */
const GRADE_THRESHOLDS: ReadonlyArray<{ grade: WcagGrade; maxScore: number }> = [
  { grade: 'A', maxScore: 0 },
  { grade: 'B', maxScore: 15 },
  { grade: 'C', maxScore: 50 },
  { grade: 'D', maxScore: 150 },
  { grade: 'F', maxScore: Number.POSITIVE_INFINITY },
];

/** Single-letter grade for a finding list. */
export function gradeFor(findings: readonly WcagFinding[]): WcagGrade {
  const score = aggregateScore(findings);
  for (const tier of GRADE_THRESHOLDS) {
    if (score <= tier.maxScore) return tier.grade;
  }
  // Unreachable: the last threshold is +Infinity.
  return 'F';
}

/**
 * Hard fail: any Critical finding always drags the grade to at least D,
 * regardless of aggregate score, because "one showstopper" is a different
 * problem from "lots of small issues".
 */
export function gradeWithCriticalPenalty(findings: readonly WcagFinding[]): WcagGrade {
  const base = gradeFor(findings);
  const hasCritical = findings.some((f) => f.severity === 'critical');
  if (!hasCritical) return base;
  // Drag anything better than D down to D.
  if (base === 'A' || base === 'B' || base === 'C') return 'D';
  return base;
}
