/**
 * Astro route detector.
 *
 * Astro's file-based router maps `src/pages/**\/*.astro` (and `.md`,
 * `.mdx` for content collections) to URL paths. This detector handles
 * the `.astro` form - content-collection routes are resolved by the AI
 * strategy in Phase 4 since they require parsing `getStaticPaths()`.
 *
 * Conventions (from https://docs.astro.build/en/guides/routing/):
 *
 *   src/pages/index.astro                  → /
 *   src/pages/about.astro                  → /about
 *   src/pages/blog/index.astro             → /blog
 *   src/pages/blog/[slug].astro            → /blog/[slug]   (dynamic)
 *   src/pages/blog/[...slug].astro         → /blog/[...slug] (catch-all)
 *
 * Files under `src/pages/api/` are typically endpoints (API routes)
 * and skipped - auditing them with axe makes no sense.
 */

import type { DiscoveredRoute } from '@sdet-wcag-toolkit/core';

import { type DirectoryReader, extensionFilter, walkSubTree } from '../walker.js';

const ASTRO_EXTENSIONS = ['.astro'];

export interface AstroDetectorOptions {
  readonly rootDir: string;
  readonly reader?: DirectoryReader;
}

export async function detectAstroRoutes(
  options: AstroDetectorOptions,
): Promise<readonly DiscoveredRoute[]> {
  const files = await walkSubTree({
    rootDir: options.rootDir,
    subTree: 'src/pages',
    include: extensionFilter(ASTRO_EXTENSIONS),
    ...(options.reader !== undefined && { reader: options.reader }),
  });

  const routes: DiscoveredRoute[] = [];
  for (const file of files) {
    const route = astroFileToRoute(file.path);
    if (route) routes.push(route);
  }
  return routes;
}

/**
 * Translate `src/pages/foo/[bar].astro` → `/foo/[bar]`. Exported for
 * unit-testing the path-rewriting rules independently of the walker.
 */
export function astroFileToRoute(relPath: string): DiscoveredRoute | null {
  const PREFIX = 'src/pages/';
  if (!relPath.startsWith(PREFIX)) return null;

  const trimmed = relPath.slice(PREFIX.length).replace(/\.astro$/, '');

  // Skip API endpoints - they're not browser-navigable pages.
  if (trimmed.startsWith('api/') || trimmed === 'api') return null;

  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length === 0) return null;

  // index.astro at any depth collapses out of the URL:
  //   pages/index.astro       → /
  //   pages/blog/index.astro  → /blog
  if (parts[parts.length - 1] === 'index') {
    parts.pop();
  }

  const path = parts.length === 0 ? '/' : `/${parts.join('/')}`;
  const isDynamic = path.includes('[');

  return {
    path,
    source: relPath,
    isDynamic,
  };
}
