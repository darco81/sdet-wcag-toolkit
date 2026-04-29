/**
 * Vue route detector - vite-plugin-pages convention.
 *
 * The vite-plugin-pages router (https://github.com/hannoeru/vite-plugin-pages)
 * is the de-facto FS-based router for Vite + Vue apps. Convention:
 *
 *   src/pages/index.vue              → /
 *   src/pages/about.vue              → /about
 *   src/pages/blog/index.vue         → /blog
 *   src/pages/blog/[slug].vue        → /blog/[slug]   (dynamic)
 *   src/pages/blog/[...all].vue      → /blog/[...all] (catch-all)
 *
 * Projects that use programmatic routing (manual `createRouter` with a
 * hand-rolled `routes` array in `src/router/index.ts`) are not covered
 * here - Phase 4's AI agent fills the gap. The detector also probes
 * `src/views/` because it's a common alternate convention even when
 * programmatic routing is in play; the Lead orchestrator (Phase 4)
 * will reconcile any duplicates.
 */

import type { DiscoveredRoute } from '@sdet-wcag-toolkit/core';

import { type DirectoryReader, extensionFilter, walkSubTree } from '../walker.js';

const VUE_EXTENSIONS = ['.vue'];
const VUE_PAGE_DIRECTORIES = ['src/pages', 'src/views'] as const;

export interface VueDetectorOptions {
  readonly rootDir: string;
  readonly reader?: DirectoryReader;
}

export async function detectVueRoutes(
  options: VueDetectorOptions,
): Promise<readonly DiscoveredRoute[]> {
  const filter = extensionFilter(VUE_EXTENSIONS);
  const baseOptions = {
    rootDir: options.rootDir,
    include: filter,
    ...(options.reader !== undefined && { reader: options.reader }),
  };

  const allFiles = await Promise.all(
    VUE_PAGE_DIRECTORIES.map((dir) => walkSubTree({ ...baseOptions, subTree: dir })),
  );

  const routes: DiscoveredRoute[] = [];
  const seen = new Set<string>();
  for (const dir of VUE_PAGE_DIRECTORIES) {
    const files = allFiles[VUE_PAGE_DIRECTORIES.indexOf(dir)] ?? [];
    for (const file of files) {
      const route = vueFileToRoute(file.path, dir);
      if (route && !seen.has(route.path)) {
        seen.add(route.path);
        routes.push(route);
      }
    }
  }
  return routes;
}

/**
 * Translate a Vue file under `src/pages` (or `src/views`) to a route.
 * Exported so detector tests can verify the rewriting rules without
 * touching the walker.
 */
export function vueFileToRoute(relPath: string, baseDir: string): DiscoveredRoute | null {
  const prefix = `${baseDir}/`;
  if (!relPath.startsWith(prefix)) return null;

  const trimmed = relPath.slice(prefix.length).replace(/\.vue$/, '');
  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length === 0) return null;

  if (parts[parts.length - 1] === 'index') {
    parts.pop();
  }

  const path = parts.length === 0 ? '/' : `/${parts.join('/')}`;
  const isDynamic = path.includes('[') || path.includes(':');

  return {
    path,
    source: relPath,
    isDynamic,
  };
}
