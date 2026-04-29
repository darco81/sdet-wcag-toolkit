/**
 * Stub registry for route-discovery strategies.
 *
 * Phase 1 ships the dispatcher and a registry whose strategies are all
 * placeholders that report "not implemented yet". Subsequent phases
 * replace each placeholder with a real implementation:
 *
 *   - Phase 2 → `sitemap`
 *   - Phase 3 → `router-scan`
 *   - Phase 4 → `ai`
 *   - Phase 5 → `json-config`
 *
 * The registry shape is locked in here so callers (CLI, Lead
 * orchestrator, tests) can wire against it from day 1.
 */

import type { RouteDiscoveryResult, RouteDiscoveryStrategy } from '@sdet-wcag-toolkit/core';

import type { RouteDiscoveryStrategyFn, StrategyRegistry } from '../dispatcher.js';

function notImplemented(name: RouteDiscoveryStrategy): RouteDiscoveryStrategyFn {
  return async (): Promise<RouteDiscoveryResult> => ({
    routes: [],
    strategy: name,
    confidence: 0,
    warnings: [`Strategy "${name}" is not implemented yet (V0.4 phase pending).`],
  });
}

/**
 * Build the default strategy registry. Tests and Pro extensions can
 * pass in overrides to replace specific strategies (e.g. mock AI in
 * unit tests, swap sitemap fetcher in Pro tier).
 */
export function createDefaultStrategyRegistry(
  overrides: Partial<StrategyRegistry> = {},
): StrategyRegistry {
  return {
    ai: overrides.ai ?? notImplemented('ai'),
    sitemap: overrides.sitemap ?? notImplemented('sitemap'),
    'router-scan': overrides['router-scan'] ?? notImplemented('router-scan'),
    'json-config': overrides['json-config'] ?? notImplemented('json-config'),
  };
}
