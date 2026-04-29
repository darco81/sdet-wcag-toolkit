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

/**
 * Strategy used to discover the list of pages to audit when running a
 * multi-page audit. Listed in the auto-fallback order used by the
 * dispatcher when the user does not pin a specific strategy.
 *
 * - `ai` - Claude Code agent reads framework files and emits routes.
 * - `sitemap` - fetches and parses `<base>/sitemap.xml`.
 * - `router-scan` - deterministic FS scan keyed off framework conventions.
 * - `json-config` - explicit `wcag.config.json` page list (escape hatch).
 */
export type RouteDiscoveryStrategy = 'ai' | 'sitemap' | 'router-scan' | 'json-config';

/**
 * One page that a route-discovery strategy proposes for auditing.
 *
 * Static routes resolve directly to a URL. Dynamic routes (e.g.
 * `/products/[slug]`) carry the unresolved `path` and, if the strategy
 * could resolve a representative parameter, a `sampleUrl`.
 */
export interface DiscoveredRoute {
  /** Route path, e.g. `/about` or `/products/[slug]`. */
  readonly path: string;
  /**
   * Where the route was discovered - a source file path, a sitemap URL,
   * or `wcag.config.json`. Surfaced in reports for provenance.
   */
  readonly source: string;
  /** True when `path` contains unresolved dynamic parameters. */
  readonly isDynamic: boolean;
  /**
   * Concrete URL to audit when `isDynamic` is true. Omitted when the
   * route is static (the audit URL can be derived from `path`) or when
   * the strategy could not resolve a representative parameter.
   */
  readonly sampleUrl?: string;
}

/**
 * Result of a single route-discovery run. The dispatcher returns one of
 * these regardless of which underlying strategy succeeded; `strategy`
 * records which one actually ran.
 */
export interface RouteDiscoveryResult {
  readonly routes: readonly DiscoveredRoute[];
  readonly strategy: RouteDiscoveryStrategy;
  /**
   * Confidence in the discovered route list, 0..1. Sitemap and JSON
   * config are deterministic (1). AI agent confidence varies with how
   * much of the route list came from heuristics vs. enumerated sources.
   */
  readonly confidence: number;
  /**
   * Non-fatal warnings - strategies that were tried and failed, dynamic
   * routes that could not be resolved, exclusions that matched nothing.
   */
  readonly warnings: readonly string[];
}

/**
 * Why a discovered route was not audited. `dynamic-no-sample` covers
 * `/blog/[slug]` without a `sampleUrl`; `runner-error` covers cases
 * where the browser threw during navigation or a runner blew up.
 */
export type PageSkipReason = 'dynamic-no-sample' | 'runner-error' | 'max-pages';

/**
 * Outcome for a single page in a multi-page audit.
 *
 * `auditedUrl` is the full URL the browser visited (baseUrl + path or
 * sampleUrl). `discoveredRoute.path` keeps the templated form so the
 * report can show "/blog/[slug]" alongside the resolved URL.
 *
 * Skipped pages still appear in the report so users see the full set
 * the discovery layer proposed; `findings` is empty when `skipped` is
 * populated.
 */
export interface PageAuditResult {
  readonly discoveredRoute: DiscoveredRoute;
  readonly auditedUrl?: string;
  readonly findings: readonly WcagFinding[];
  readonly durationMs: number;
  readonly skipped?: { readonly reason: PageSkipReason; readonly note: string };
}

/**
 * Aggregated finding shared across multiple pages - produced by the
 * cross-page deduper. The canonical `finding` is the first occurrence;
 * `affectedPages` lists every URL where it appeared. The grouping key
 * is `(ruleId + location.file/line OR location.selector)` so a single
 * source-level fix collapses many page hits into one entry.
 */
export interface CrossPageFinding {
  readonly finding: WcagFinding;
  readonly affectedPages: readonly string[];
  readonly occurrenceCount: number;
}

/** Top-level report for a multi-page audit. */
export interface MultiPageAuditReport {
  readonly baseUrl: string;
  readonly discovery: RouteDiscoveryResult;
  readonly pages: readonly PageAuditResult[];
  /** Cross-page deduplicated findings (single fix → many pages green). */
  readonly crossPage: readonly CrossPageFinding[];
  /** Wall-clock time for the full audit, including discovery + per-page work. */
  readonly totalDurationMs: number;
  /** Counts that summarise the run for the console + JSON outputs. */
  readonly summary: {
    readonly pagesAudited: number;
    readonly pagesSkipped: number;
    readonly totalFindings: number;
    readonly uniqueFindings: number;
  };
}
