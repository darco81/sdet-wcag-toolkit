/**
 * Dispatcher unit tests. Exercise the auto-fallback chain, explicit
 * strategy pinning, max-pages truncation, and warning aggregation
 * without depending on any real strategy implementation.
 */

import { describe, expect, it, vi } from 'vitest';

import type {
  DiscoveredRoute,
  RouteDiscoveryResult,
  RouteDiscoveryStrategy,
} from '@sdet-wcag-toolkit/core';

import {
  DEFAULT_FALLBACK_CHAIN,
  dispatchRouteDiscovery,
  type RouteDiscoveryStrategyFn,
  type StrategyRegistry,
} from './dispatcher.js';
import { createDefaultStrategyRegistry } from './strategies/index.js';

function makeRoute(path: string): DiscoveredRoute {
  return { path, source: `test://${path}`, isDynamic: false };
}

function fixedResult(
  strategy: RouteDiscoveryStrategy,
  routes: DiscoveredRoute[],
  warnings: string[] = [],
  confidence = 1,
): RouteDiscoveryResult {
  return { strategy, routes, warnings, confidence };
}

function strategyReturning(
  strategy: RouteDiscoveryStrategy,
  routes: DiscoveredRoute[],
  warnings: string[] = [],
): RouteDiscoveryStrategyFn {
  return vi.fn(async () => fixedResult(strategy, routes, warnings));
}

function emptyStrategy(
  strategy: RouteDiscoveryStrategy,
  warning: string,
): RouteDiscoveryStrategyFn {
  return vi.fn(async () => fixedResult(strategy, [], [warning], 0));
}

describe('dispatchRouteDiscovery', () => {
  it('uses the explicit strategy and skips the fallback chain entirely', async () => {
    const aiFn = strategyReturning('ai', [makeRoute('/from-ai')]);
    const sitemapFn = strategyReturning('sitemap', [makeRoute('/from-sitemap')]);
    const registry: StrategyRegistry = createDefaultStrategyRegistry({
      ai: aiFn,
      sitemap: sitemapFn,
    });

    const result = await dispatchRouteDiscovery({}, registry, { strategy: 'ai' });

    expect(result.strategy).toBe('ai');
    expect(result.routes).toEqual([makeRoute('/from-ai')]);
    expect(aiFn).toHaveBeenCalledOnce();
    expect(sitemapFn).not.toHaveBeenCalled();
  });

  it('falls back through the default chain until a strategy returns routes', async () => {
    const sitemapFn = emptyStrategy('sitemap', 'no sitemap.xml at base URL');
    const routerFn = strategyReturning('router-scan', [
      makeRoute('/from-router-1'),
      makeRoute('/from-router-2'),
    ]);
    const jsonFn = strategyReturning('json-config', [makeRoute('/from-json')]);
    const registry = createDefaultStrategyRegistry({
      sitemap: sitemapFn,
      'router-scan': routerFn,
      'json-config': jsonFn,
    });

    const result = await dispatchRouteDiscovery({}, registry);

    expect(result.strategy).toBe('router-scan');
    expect(result.routes).toHaveLength(2);
    expect(sitemapFn).toHaveBeenCalledOnce();
    expect(routerFn).toHaveBeenCalledOnce();
    expect(jsonFn).not.toHaveBeenCalled();
  });

  it('aggregates warnings from every strategy tried before the winner', async () => {
    const sitemapFn = emptyStrategy('sitemap', 'no sitemap.xml at base URL');
    const routerFn = strategyReturning(
      'router-scan',
      [makeRoute('/winner')],
      ['detected Astro project'],
    );
    const registry = createDefaultStrategyRegistry({
      sitemap: sitemapFn,
      'router-scan': routerFn,
    });

    const result = await dispatchRouteDiscovery({}, registry);

    expect(result.warnings).toEqual(['no sitemap.xml at base URL', 'detected Astro project']);
  });

  it('surfaces the last strategy result when every strategy is empty', async () => {
    const sitemapFn = emptyStrategy('sitemap', 'no sitemap.xml');
    const routerFn = emptyStrategy('router-scan', 'no framework detected');
    const jsonFn = emptyStrategy('json-config', 'no wcag.config.json found');
    const registry = createDefaultStrategyRegistry({
      sitemap: sitemapFn,
      'router-scan': routerFn,
      'json-config': jsonFn,
    });

    const result = await dispatchRouteDiscovery({}, registry);

    expect(result.routes).toEqual([]);
    expect(result.strategy).toBe('json-config'); // last in chain
    expect(result.warnings).toEqual([
      'no sitemap.xml',
      'no framework detected',
      'no wcag.config.json found',
    ]);
  });

  it('honors a custom fallback chain', async () => {
    const aiFn = strategyReturning('ai', [makeRoute('/ai-first')]);
    const sitemapFn = strategyReturning('sitemap', [makeRoute('/sitemap-second')]);
    const registry = createDefaultStrategyRegistry({ ai: aiFn, sitemap: sitemapFn });

    const result = await dispatchRouteDiscovery({}, registry, {
      fallbackChain: ['ai', 'sitemap'],
    });

    expect(result.strategy).toBe('ai');
    expect(aiFn).toHaveBeenCalledOnce();
    expect(sitemapFn).not.toHaveBeenCalled();
  });

  it('truncates routes when maxPages is set and adds a warning', async () => {
    const sitemapFn = strategyReturning('sitemap', [
      makeRoute('/1'),
      makeRoute('/2'),
      makeRoute('/3'),
      makeRoute('/4'),
      makeRoute('/5'),
    ]);
    const registry = createDefaultStrategyRegistry({ sitemap: sitemapFn });

    const result = await dispatchRouteDiscovery({ maxPages: 3 }, registry, {
      strategy: 'sitemap',
    });

    expect(result.routes).toHaveLength(3);
    expect(result.routes.map((r) => r.path)).toEqual(['/1', '/2', '/3']);
    expect(result.warnings.some((w) => w.includes('Truncated to first 3 of 5'))).toBe(true);
  });

  it('does not truncate when maxPages is 0 (no limit) or omitted', async () => {
    const routes = Array.from({ length: 10 }, (_, i) => makeRoute(`/p${i}`));
    const sitemapFn = strategyReturning('sitemap', routes);
    const registry = createDefaultStrategyRegistry({ sitemap: sitemapFn });

    const noLimit = await dispatchRouteDiscovery({ maxPages: 0 }, registry, {
      strategy: 'sitemap',
    });
    expect(noLimit.routes).toHaveLength(10);

    const omitted = await dispatchRouteDiscovery({}, registry, { strategy: 'sitemap' });
    expect(omitted.routes).toHaveLength(10);
  });

  it('throws when an explicit fallback chain is empty', async () => {
    const registry = createDefaultStrategyRegistry();
    await expect(dispatchRouteDiscovery({}, registry, { fallbackChain: [] })).rejects.toThrow(
      /fallback chain must not be empty/,
    );
  });

  it('exposes a stable default fallback chain that excludes ai (token cost)', () => {
    expect(DEFAULT_FALLBACK_CHAIN).toEqual(['sitemap', 'router-scan', 'json-config']);
    expect(DEFAULT_FALLBACK_CHAIN).not.toContain('ai');
  });
});

describe('createDefaultStrategyRegistry', () => {
  it('returns a strategy fn for every RouteDiscoveryStrategy value', () => {
    const registry = createDefaultStrategyRegistry();
    expect(typeof registry.ai).toBe('function');
    expect(typeof registry.sitemap).toBe('function');
    expect(typeof registry['router-scan']).toBe('function');
    expect(typeof registry['json-config']).toBe('function');
  });

  it('default strategies degrade gracefully (no throws, helpful warnings)', async () => {
    const registry = createDefaultStrategyRegistry();
    // ai needs an invoker that the default registry does not wire.
    const aiResult = await registry.ai({ rootDir: '/proj' });
    expect(aiResult.routes).toEqual([]);
    expect(aiResult.warnings[0]).toMatch(/--use-ai/);
    // json-config is the only strategy still stubbed in Phase 4.
    const jsonResult = await registry['json-config']({});
    expect(jsonResult.routes).toEqual([]);
    expect(jsonResult.warnings[0]).toMatch(/not implemented yet/);
  });

  it('overrides take precedence over defaults', async () => {
    const customAi: RouteDiscoveryStrategyFn = async () =>
      fixedResult('ai', [makeRoute('/custom')]);
    const registry = createDefaultStrategyRegistry({ ai: customAi });
    const result = await registry.ai({});
    expect(result.routes).toEqual([makeRoute('/custom')]);
  });
});
