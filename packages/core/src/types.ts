/**
 * Core types for the sdet-wcag-toolkit.
 *
 * Every analyzer - static, dynamic, or manual - emits findings in this shape
 * so the reporter and fix engine can work uniformly.
 */

/** WCAG conformance level. Level AA is the legal target in most jurisdictions. */
export type WcagLevel = 'A' | 'AA' | 'AAA';

/** Four high-level principles from WCAG. */
export type WcagPrinciple = 'perceivable' | 'operable' | 'understandable' | 'robust';

/**
 * Severity tiers. Aligned with axe-core taxonomy so violations from axe can
 * be mapped 1:1.
 */
export type WcagSeverity = 'critical' | 'serious' | 'moderate' | 'minor';

/** Where a finding came from. */
export type WcagFindingSource = 'static' | 'dynamic' | 'manual';

/**
 * A single WCAG 2.x Success Criterion (SC). Identified by its dotted number
 * (e.g. "1.3.1") and bound to a principle, level, and published version.
 */
export interface WcagSuccessCriterion {
  /** Dotted number, e.g. "1.3.1". */
  readonly id: string;
  /** Human-readable title, e.g. "Info and Relationships". */
  readonly name: string;
  readonly level: WcagLevel;
  readonly principle: WcagPrinciple;
  /** WCAG version in which the SC was introduced. */
  readonly introducedIn: '2.0' | '2.1' | '2.2';
  /** Canonical W3C URL for the SC. */
  readonly url: string;
}

/**
 * Location of a finding in source (static) or in a running page (dynamic).
 * Exactly one of `file`/`url` is populated.
 */
export interface WcagFindingLocation {
  /** Absolute or workspace-relative file path (static analysis). */
  readonly file?: string;
  /** 1-based line number in `file`. */
  readonly line?: number;
  /** 1-based column number in `file`. */
  readonly column?: number;
  /** Page URL (dynamic analysis). */
  readonly url?: string;
  /** CSS selector of the offending element (dynamic analysis). */
  readonly selector?: string;
  /** Snippet of the offending source (for context in reports). */
  readonly snippet?: string;
}

/**
 * A single violation or suspected violation, ready to be reported or fixed.
 *
 * `id` is a stable deterministic hash of (successCriterion + location) so
 * findings can be deduplicated when merging static + dynamic runs.
 */
export interface WcagFinding {
  readonly id: string;
  readonly successCriterion: WcagSuccessCriterion;
  readonly severity: WcagSeverity;
  /** Short, developer-facing description of what is wrong. */
  readonly message: string;
  /** Longer explanation: why this matters, who it affects. */
  readonly rationale?: string;
  /** Concrete suggestion for how to fix it. */
  readonly remediation?: string;
  readonly location: WcagFindingLocation;
  readonly source: WcagFindingSource;
  /** Name of the rule that produced the finding, e.g. "color-contrast". */
  readonly ruleId: string;
  /** Optional link to extended docs for the rule. */
  readonly helpUrl?: string;
}
