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

export type {
  AiAgentInvoker,
  AiAgentStrategyOptions,
  RouteDiscoveryAgentPayload,
} from './strategies/ai-agent.js';
export { createAiAgentStrategy, parseAiResponse } from './strategies/ai-agent.js';

export type {
  JsonConfigStrategyOptions,
  WcagAuditConfig,
  WcagAuthConfig,
  WcagConfigFile,
} from './strategies/json-config.js';
export {
  DEFAULT_CONFIG_FILENAME,
  createJsonConfigStrategy,
  parseConfig,
} from './strategies/json-config.js';

export type { RouterScanStrategyOptions } from './strategies/router-scan/index.js';
export { createRouterScanStrategy } from './strategies/router-scan/index.js';
export type {
  DetectedFramework,
  FrameworkDetection,
} from './strategies/router-scan/framework-detection.js';
export { detectFramework } from './strategies/router-scan/framework-detection.js';
export type { DirectoryReader, FileFilter, WalkOptions } from './strategies/router-scan/walker.js';
export {
  DEFAULT_WALK_IGNORE,
  createInMemoryReader,
  extensionFilter,
  walkSubTree,
} from './strategies/router-scan/walker.js';
