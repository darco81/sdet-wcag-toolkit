export type {
  DispatchOptions,
  RouteDiscoveryContext,
  RouteDiscoveryStrategyFn,
  StrategyRegistry,
} from './dispatcher.js';
export { DEFAULT_FALLBACK_CHAIN, dispatchRouteDiscovery } from './dispatcher.js';

export { createDefaultStrategyRegistry } from './strategies/index.js';
export type { SitemapFetcher, SitemapStrategyOptions } from './strategies/sitemap.js';
export {
  DEFAULT_SITEMAP_CANDIDATES,
  DEFAULT_SITEMAP_EXCLUSIONS,
  createSitemapStrategy,
  urlToPath,
} from './strategies/sitemap.js';
