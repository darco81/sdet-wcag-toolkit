/**
 * Next.js route detector covering both routers.
 *
 * App Router (Next 13+):
 *   app/page.tsx                   → /
 *   app/about/page.tsx             → /about
 *   app/blog/[slug]/page.tsx       → /blog/[slug]   (dynamic)
 *   app/blog/[...all]/page.tsx     → /blog/[...all] (catch-all)
 *   app/(marketing)/about/page.tsx → /about         (route group: parens dropped)
 *   app/_internal/page.tsx         → skipped        (private folder)
 *   app/api/foo/route.ts           → skipped        (API handler, not a page)
 *
 * Pages Router (legacy):
 *   pages/index.tsx                → /
 *   pages/about.tsx                → /about
 *   pages/blog/[slug].tsx          → /blog/[slug]
 *   pages/_app.tsx                 → skipped
 *   pages/_document.tsx            → skipped
 *   pages/_error.tsx               → skipped
 *   pages/api/...                  → skipped
 *
 * Both routers can coexist in one project; the detector returns routes
 * from whichever directory exists. The App Router takes precedence on
 * route conflicts in Next.js itself, but the route-discovery layer
 * doesn't try to dedupe - surface both, let the audit reporter handle
 * it.
 */

import type { DiscoveredRoute } from '@sdet-wcag-toolkit/core';

import { type DirectoryReader, extensionFilter, walkSubTree } from '../walker.js';

const NEXT_EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js'];
const PAGES_ROUTER_SKIP = new Set(['_app', '_document', '_error', '404', '500']);

export interface NextjsDetectorOptions {
  readonly rootDir: string;
  readonly reader?: DirectoryReader;
}

export async function detectNextjsRoutes(
  options: NextjsDetectorOptions,
): Promise<readonly DiscoveredRoute[]> {
  const filter = extensionFilter(NEXT_EXTENSIONS);
  const baseOptions = {
    rootDir: options.rootDir,
    include: filter,
    ...(options.reader !== undefined && { reader: options.reader }),
  };

  const [appFiles, pagesFiles] = await Promise.all([
    walkSubTree({ ...baseOptions, subTree: 'app' }),
    walkSubTree({ ...baseOptions, subTree: 'pages' }),
  ]);

  const routes: DiscoveredRoute[] = [];
  const seen = new Set<string>();

  for (const file of appFiles) {
    const route = appRouterFileToRoute(file.path);
    if (route && !seen.has(route.path)) {
      seen.add(route.path);
      routes.push(route);
    }
  }

  for (const file of pagesFiles) {
    const route = pagesRouterFileToRoute(file.path);
    if (route && !seen.has(route.path)) {
      seen.add(route.path);
      routes.push(route);
    }
  }

  return routes;
}

/**
 * Map an App Router file path to a route. Only `page.{tsx,jsx,ts,js}`
 * counts as a page; `layout`, `loading`, `error`, `template`, and
 * `route` are infrastructure files and skipped.
 */
export function appRouterFileToRoute(relPath: string): DiscoveredRoute | null {
  const PREFIX = 'app/';
  if (!relPath.startsWith(PREFIX)) return null;

  const trimmed = relPath.slice(PREFIX.length);
  const lastSlash = trimmed.lastIndexOf('/');
  const file = lastSlash === -1 ? trimmed : trimmed.slice(lastSlash + 1);
  const dirParts = lastSlash === -1 ? [] : trimmed.slice(0, lastSlash).split('/');

  const basename = stripExtension(file);
  if (basename !== 'page') return null;

  // Skip private folders (any segment starting with `_`).
  if (dirParts.some((p) => p.startsWith('_'))) return null;

  // Drop route groups: any segment of the form `(name)`.
  const filtered = dirParts.filter((p) => !(p.startsWith('(') && p.endsWith(')')));

  const path = filtered.length === 0 ? '/' : `/${filtered.join('/')}`;
  const isDynamic = path.includes('[');

  return {
    path,
    source: relPath,
    isDynamic,
  };
}

/**
 * Map a Pages Router file path to a route. Skips `_app`, `_document`,
 * `_error`, `404`, `500`, and anything under `pages/api/`.
 */
export function pagesRouterFileToRoute(relPath: string): DiscoveredRoute | null {
  const PREFIX = 'pages/';
  if (!relPath.startsWith(PREFIX)) return null;

  const trimmed = relPath.slice(PREFIX.length);
  if (trimmed.startsWith('api/') || trimmed === 'api') return null;

  const withoutExt = stripExtension(trimmed);
  const parts = withoutExt.split('/').filter(Boolean);

  // Drop pages-router infrastructure files.
  if (parts.length > 0 && PAGES_ROUTER_SKIP.has(parts[parts.length - 1] ?? '')) {
    return null;
  }

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

function stripExtension(file: string): string {
  const dot = file.lastIndexOf('.');
  return dot === -1 ? file : file.slice(0, dot);
}
