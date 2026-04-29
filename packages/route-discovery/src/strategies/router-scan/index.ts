/**
 * Router-scan strategy - deterministic, offline route discovery driven
 * by framework conventions.
 *
 * Pipeline:
 *
 *   1. Detect the framework from package.json deps.
 *   2. Run the matching detector against the project tree.
 *   3. Map detector output to `RouteDiscoveryResult`, scoring confidence
 *      based on the framework + how many dynamic segments leaked
 *      through (high-confidence detectors deflate to 0.7 when the file
 *      tree contains `[...catchall]` placeholders).
 *
 * Phase 3 ships detectors for Astro, Next.js (both routers), and Vue
 * (vite-plugin-pages). Other frameworks fall through to a "framework
 * detected but no detector implemented yet" warning so the dispatcher
 * can move on to the next strategy.
 */

import type { DiscoveredRoute, RouteDiscoveryResult } from '@sdet-wcag-toolkit/core';

import type { RouteDiscoveryContext, RouteDiscoveryStrategyFn } from '../../dispatcher.js';

import { detectAstroRoutes } from './detectors/astro.js';
import { detectNextjsRoutes } from './detectors/nextjs.js';
import { detectVueRoutes } from './detectors/vue.js';
import {
  type DetectedFramework,
  type FrameworkDetection,
  detectFramework,
} from './framework-detection.js';
import type { DirectoryReader } from './walker.js';

export interface RouterScanStrategyOptions {
  /**
   * Override the framework-detection step. Tests pass a function that
   * returns a fixed `FrameworkDetection`; production wires the
   * package.json reader.
   */
  readonly detect?: (rootDir: string) => Promise<FrameworkDetection>;
  /**
   * Custom directory reader. Tests inject `createInMemoryReader`;
   * production uses the default fs-backed reader.
   */
  readonly reader?: DirectoryReader;
}

const SUPPORTED_FRAMEWORKS: ReadonlySet<DetectedFramework> = new Set([
  'astro',
  'next',
  'vue',
  'nuxt',
]);

export function createRouterScanStrategy(
  options: RouterScanStrategyOptions = {},
): RouteDiscoveryStrategyFn {
  const detect = options.detect ?? detectFramework;

  return async (context: RouteDiscoveryContext): Promise<RouteDiscoveryResult> => {
    if (!context.rootDir) {
      return emptyResult([
        'router-scan strategy requires a project rootDir (pass a path argument)',
      ]);
    }

    const detection = await detect(context.rootDir);
    if (detection.framework === 'unknown') {
      return emptyResult([
        `router-scan: ${detection.evidence}. Skipped - try --strategy=ai for source-aware discovery.`,
      ]);
    }

    if (!SUPPORTED_FRAMEWORKS.has(detection.framework)) {
      return emptyResult([
        `router-scan: detected ${detection.framework} (via "${detection.evidence}") but no detector is implemented yet (V0.4 alpha.5+). Try --strategy=ai or --config wcag.config.json.`,
      ]);
    }

    const detectorOpts = {
      rootDir: context.rootDir,
      ...(options.reader !== undefined && { reader: options.reader }),
    };

    let routes: readonly DiscoveredRoute[] = [];
    switch (detection.framework) {
      case 'astro':
        routes = await detectAstroRoutes(detectorOpts);
        break;
      case 'next':
        routes = await detectNextjsRoutes(detectorOpts);
        break;
      case 'vue':
      case 'nuxt':
        // Nuxt projects share Vue's `pages/` convention - same detector,
        // narrower path (Nuxt uses top-level `pages/` rather than
        // `src/pages/`, but vite-plugin-pages also supports custom
        // bases). For Phase 3, treat as Vue best-effort.
        routes = await detectVueRoutes(detectorOpts);
        break;
      default:
        // The supported-set guard above keeps this unreachable, but the
        // exhaustive switch is a compile-time safety net.
        routes = [];
    }

    const sorted = sortRoutes(routes);
    const dynamicCount = sorted.filter((r) => r.isDynamic).length;

    return {
      strategy: 'router-scan',
      routes: sorted,
      confidence: computeConfidence(sorted.length, dynamicCount),
      warnings: buildWarnings(detection, sorted, dynamicCount),
    };
  };
}

function buildWarnings(
  detection: FrameworkDetection,
  routes: readonly DiscoveredRoute[],
  dynamicCount: number,
): readonly string[] {
  const warnings: string[] = [
    `router-scan: detected ${detection.framework} (via "${detection.evidence}").`,
  ];
  if (routes.length === 0) {
    warnings.push(
      `router-scan: no route files found for ${detection.framework}. Project may use programmatic routing - try --strategy=ai or --config wcag.config.json.`,
    );
  }
  if (dynamicCount > 0) {
    warnings.push(
      `router-scan: ${dynamicCount} of ${routes.length} routes are dynamic (e.g. [slug]). The audit will skip them unless --config wcag.config.json supplies sample URLs.`,
    );
  }
  return warnings;
}

/**
 * Confidence model:
 *   - 0 routes      → 0
 *   - all static    → 1
 *   - any dynamic   → 0.7 (caller still gets routes; lower number signals
 *                          that some need manual sample URLs)
 */
function computeConfidence(total: number, dynamic: number): number {
  if (total === 0) return 0;
  if (dynamic === 0) return 1;
  return 0.7;
}

function sortRoutes(routes: readonly DiscoveredRoute[]): readonly DiscoveredRoute[] {
  return [...routes].sort((a, b) => a.path.localeCompare(b.path, 'en', { numeric: true }));
}

function emptyResult(warnings: readonly string[]): RouteDiscoveryResult {
  return {
    strategy: 'router-scan',
    routes: [],
    confidence: 0,
    warnings,
  };
}
