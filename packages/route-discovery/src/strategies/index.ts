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

import type { StrategyRegistry } from '../dispatcher.js';
import { createAiAgentStrategy } from './ai-agent.js';
import { createJsonConfigStrategy } from './json-config.js';
import { createRouterScanStrategy } from './router-scan/index.js';
import { createSitemapStrategy } from './sitemap.js';

/**
 * Build the default strategy registry. Tests and Pro extensions can
 * pass in overrides to replace specific strategies (e.g. mock AI in
 * unit tests, swap sitemap fetcher in Pro tier).
 *
 * The default `ai` strategy ships without an invoker - it returns a
 * helpful warning telling the user to enable `--use-ai` from a Claude
 * Code session. The CLI replaces it with a wired version when running
 * inside CC.
 */
export function createDefaultStrategyRegistry(
  overrides: Partial<StrategyRegistry> = {},
): StrategyRegistry {
  return {
    ai: overrides.ai ?? createAiAgentStrategy(),
    sitemap: overrides.sitemap ?? createSitemapStrategy(),
    'router-scan': overrides['router-scan'] ?? createRouterScanStrategy(),
    'json-config': overrides['json-config'] ?? createJsonConfigStrategy(),
  };
}
