export type {
  DispatchOptions,
  RouteDiscoveryContext,
  RouteDiscoveryStrategyFn,
  StrategyRegistry,
} from './dispatcher.js';
export { DEFAULT_FALLBACK_CHAIN, dispatchRouteDiscovery } from './dispatcher.js';

export { createDefaultStrategyRegistry } from './strategies/index.js';
