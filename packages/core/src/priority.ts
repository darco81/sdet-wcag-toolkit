/**
 * Priority scoring for individual findings.
 *
 * `priority = severityWeight / effort` - so the top of the list is always
 * "high impact, cheap to fix". That's where we want teams to start. Fixing
 * a Critical that takes a week is useful; fixing three Serious-level issues
 * that take 10 minutes each is often *more* useful.
 *
 * Effort is a 1-5 scale:
 *   1 - one-line attribute fix (e.g. add alt="", add label htmlFor)
 *   2 - localized refactor (e.g. swap div for button, add onKeyDown)
 *   3 - cross-cutting change (e.g. color token update across CSS)
 *   4 - structural change (e.g. rework heading hierarchy, add landmark)
 *   5 - requires design or product decision (e.g. add captions, translate)
 */

import { SEVERITY_WEIGHT } from './severity.js';
import type { WcagFinding } from './types.js';

export type FixEffort = 1 | 2 | 3 | 4 | 5;

/**
 * Per-rule effort estimates. Keys are rule ids emitted by analyzers. Missing
 * keys fall through to {@link DEFAULT_EFFORT}.
 */
export const DEFAULT_RULE_EFFORT: Readonly<Record<string, FixEffort>> = {
  // One-attribute fixes
  'image-alt': 1,
  'input-label': 1,
  'html-lang': 1,
  'document-title': 1,
  'autocomplete-attribute': 1,
  // Localized refactors
  'button-over-div': 2,
  'keyboard-event-handler': 2,
  'aria-required-attr': 2,
  'aria-valid-attr': 2,
  'landmark-unique': 2,
  // Cross-cutting
  'color-contrast': 3,
  'non-text-contrast': 3,
  'focus-visible': 3,
  'focus-trap': 3,
  'target-size-minimum': 3,
  // Structural
  'heading-order': 4,
  'landmark-main': 4,
  'focus-not-obscured': 4,
  // Design/product decisions
  'captions': 5,
  'audio-description': 5,
  'consistent-navigation': 5,
};

export const DEFAULT_EFFORT: FixEffort = 3;

/** Look up the estimated effort for a rule id, with a sensible default. */
export function effortOf(ruleId: string): FixEffort {
  return DEFAULT_RULE_EFFORT[ruleId] ?? DEFAULT_EFFORT;
}

/** Function mapping a finding's rule id to an effort estimate. */
export type EffortFn = (ruleId: string) => FixEffort;

/**
 * Priority of a single finding. Higher is more important to fix first.
 * Math: severity weight divided by effort. Range is (0, 10].
 */
export function priorityOf(finding: WcagFinding, effortFn: EffortFn = effortOf): number {
  const severity = SEVERITY_WEIGHT[finding.severity];
  const effort = effortFn(finding.ruleId);
  return severity / effort;
}

/**
 * Return a new array of findings sorted by priority, highest first. Findings
 * with equal priority preserve their original relative order (stable sort).
 */
export function sortByPriority(
  findings: readonly WcagFinding[],
  effortFn: EffortFn = effortOf,
): WcagFinding[] {
  return findings
    .map((finding, index) => ({ finding, index, priority: priorityOf(finding, effortFn) }))
    .sort((a, b) => b.priority - a.priority || a.index - b.index)
    .map(({ finding }) => finding);
}
