/**
 * Route-discovery dispatcher.
 *
 * The dispatcher is the single entry point that the CLI and the Lead
 * orchestrator call when they need a list of pages to audit. It owns the
 * fallback chain across strategies but stays oblivious to *how* each
 * strategy works - strategies are passed in as a registry so they can be
 * swapped, mocked in tests, or extended in the Pro tier.
 *
 * Default fallback order (no explicit `--strategy`):
 *   1. `sitemap`     - deterministic, fast, framework-agnostic.
 *   2. `router-scan` - deterministic, offline, framework-aware.
 *   3. `json-config` - only if a config file is reachable.
 *
 * `ai` is intentionally NOT in the auto-fallback chain - it costs Claude
 * tokens and should be opt-in. Users get it with `--strategy=ai`.
 *
 * Phase 1 ships the dispatcher itself plus stub strategies; Phases 2-5
 * fill them in.
 */

import type { RouteDiscoveryResult, RouteDiscoveryStrategy } from '@sdet-wcag-toolkit/core';

/**
 * Single strategy implementation. Strategies receive a context with
 * everything they may need (root dir for FS scans, base URL for HTTP
 * fetches, optional config path for JSON mode) and return a result with
 * `routes: []` when they cannot run - that signals the dispatcher to try
 * the next strategy in the chain.
 *
 * Throwing is reserved for unexpected errors. "Strategy not applicable"
 * (no sitemap.xml, no framework detected) is an empty `routes` array.
 */
export type RouteDiscoveryStrategyFn = (
  context: RouteDiscoveryContext,
) => Promise<RouteDiscoveryResult>;

export interface RouteDiscoveryContext {
  /** Project root for FS-based strategies. Absolute path. */
  readonly rootDir?: string;
  /** Base URL for HTTP-based strategies (sitemap fetch, audit targets). */
  readonly baseUrl?: string;
  /** Path to a `wcag.config.json` for the JSON config strategy. */
  readonly configPath?: string;
  /**
   * Hard cap on how many routes the dispatcher should keep. Strategies
   * may emit more; the dispatcher truncates. 0 means no limit.
   */
  readonly maxPages?: number;
}

export type StrategyRegistry = Readonly<Record<RouteDiscoveryStrategy, RouteDiscoveryStrategyFn>>;

export interface DispatchOptions {
  /**
   * Force a single strategy. When set, the dispatcher runs only that
   * strategy and surfaces its result - empty or not - without falling
   * back. Useful for CI pipelines that want predictable behavior.
   */
  readonly strategy?: RouteDiscoveryStrategy;
  /**
   * Override the default fallback chain. Each entry is tried in order
   * until one returns a non-empty `routes` array.
   */
  readonly fallbackChain?: readonly RouteDiscoveryStrategy[];
}

/** Default fallback chain when neither `strategy` nor `fallbackChain` is set. */
export const DEFAULT_FALLBACK_CHAIN: readonly RouteDiscoveryStrategy[] = [
  'sitemap',
  'router-scan',
  'json-config',
];

/**
 * Run the dispatcher. Returns the first strategy result whose `routes`
 * array is non-empty, or - if every strategy comes up empty - the result
 * of the last strategy tried (so the caller still sees `warnings`).
 *
 * `maxPages` truncation is applied to the final result before returning.
 */
export async function dispatchRouteDiscovery(
  context: RouteDiscoveryContext,
  registry: StrategyRegistry,
  options: DispatchOptions = {},
): Promise<RouteDiscoveryResult> {
  if (options.strategy !== undefined) {
    const result = await registry[options.strategy](context);
    return applyMaxPages(result, context.maxPages);
  }

  const chain = options.fallbackChain ?? DEFAULT_FALLBACK_CHAIN;
  if (chain.length === 0) {
    throw new Error('Route discovery fallback chain must not be empty.');
  }

  const aggregatedWarnings: string[] = [];
  let lastResult: RouteDiscoveryResult | undefined;

  for (const name of chain) {
    const result = await registry[name](context);
    aggregatedWarnings.push(...result.warnings);
    lastResult = result;
    if (result.routes.length > 0) {
      return applyMaxPages(
        {
          ...result,
          warnings: aggregatedWarnings,
        },
        context.maxPages,
      );
    }
  }

  // Every strategy returned an empty list. Surface the last attempt
  // (which carries the strategy name useful for diagnostics) but with
  // the merged warnings from every strategy that was tried.
  return {
    ...(lastResult as RouteDiscoveryResult),
    warnings: aggregatedWarnings,
  };
}

function applyMaxPages(
  result: RouteDiscoveryResult,
  maxPages: number | undefined,
): RouteDiscoveryResult {
  if (maxPages === undefined || maxPages <= 0) return result;
  if (result.routes.length <= maxPages) return result;
  return {
    ...result,
    routes: result.routes.slice(0, maxPages),
    warnings: [
      ...result.warnings,
      `Truncated to first ${maxPages} of ${result.routes.length} discovered routes (--max-pages).`,
    ],
  };
}
