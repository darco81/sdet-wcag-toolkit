/**
 * Sitemap.xml route-discovery strategy.
 *
 * Fetches `<base>/sitemap.xml` (with `sitemap-0.xml` as a common
 * Astro/Next fallback), recurses into `<sitemapindex>` documents, and
 * extracts `<urlset>/<url>/<loc>` entries. The strategy is fully
 * deterministic when a sitemap is available - confidence 1.0.
 *
 * The XML fetcher is injectable so tests can run hermetically; the
 * default uses the Node 20+ global `fetch`.
 */

import { XMLParser } from 'fast-xml-parser';

import type { DiscoveredRoute, RouteDiscoveryResult } from '@sdet-wcag-toolkit/core';

import type { RouteDiscoveryContext, RouteDiscoveryStrategyFn } from '../dispatcher.js';

/** Path patterns that should never appear in an audit set. */
export const DEFAULT_SITEMAP_EXCLUSIONS: readonly RegExp[] = [
  /^\/og(\/|$)/,
  /^\/api(\/|$)/,
  /^\/feed(\.xml)?$/,
  /^\/rss(\.xml)?$/,
  /^\/sitemap.*\.xml$/,
  /^\/llms.*\.txt$/,
  /^\/robots\.txt$/,
];

/** Common candidate filenames, tried in order. */
export const DEFAULT_SITEMAP_CANDIDATES: readonly string[] = [
  '/sitemap.xml',
  '/sitemap-0.xml',
  '/sitemap_index.xml',
];

export interface SitemapStrategyOptions {
  /**
   * Fetches a sitemap URL and returns its raw XML body, or `null` when
   * the URL is unreachable / not a sitemap. Tests inject a recorded
   * map; production wires the default fetch.
   */
  readonly fetcher?: SitemapFetcher;
  /**
   * Override the candidate filenames probed under the base URL. Useful
   * for sites with non-standard sitemap names. Order matters - first
   * hit wins.
   */
  readonly candidates?: readonly string[];
  /**
   * Path patterns to exclude from the audit set. Defaults to the
   * project-level `DEFAULT_SITEMAP_EXCLUSIONS` list.
   */
  readonly exclusions?: readonly RegExp[];
  /**
   * Maximum depth when recursing into sitemap-index documents. Hard
   * cap protects against pathological cycles. Default 5.
   */
  readonly maxDepth?: number;
}

/**
 * Fetches a sitemap URL. Returns the body string for 2xx responses or
 * `null` when the URL is missing / unreachable. Exceptions are
 * reserved for unexpected errors (e.g. DNS failure during a transient
 * outage) and surfaced to the caller as warnings.
 */
export type SitemapFetcher = (url: string) => Promise<string | null>;

const DEFAULT_MAX_DEPTH = 5;

/**
 * Build the sitemap discovery strategy. The resulting function plugs
 * directly into the dispatcher's strategy registry.
 */
export function createSitemapStrategy(
  options: SitemapStrategyOptions = {},
): RouteDiscoveryStrategyFn {
  const fetcher = options.fetcher ?? defaultFetcher;
  const candidates = options.candidates ?? DEFAULT_SITEMAP_CANDIDATES;
  const exclusions = options.exclusions ?? DEFAULT_SITEMAP_EXCLUSIONS;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;

  return async (context: RouteDiscoveryContext): Promise<RouteDiscoveryResult> => {
    if (!context.baseUrl) {
      return emptyResult(['sitemap strategy requires a baseUrl (pass --url)']);
    }

    const base = stripTrailingSlash(context.baseUrl);
    const warnings: string[] = [];

    const seen = new Set<string>();
    const collected = new Map<string, DiscoveredRoute>();
    let sitemapHit = false;

    for (const candidate of candidates) {
      const url = `${base}${candidate}`;
      const body = await safeFetch(url, fetcher, warnings);
      if (body === null) continue;
      if (!looksLikeXml(body)) {
        warnings.push(
          `Skipped ${url}: response was not XML (likely an HTML 404 fallback or SPA shell).`,
        );
        continue;
      }

      sitemapHit = true;
      await collectFromSitemap({
        sitemapUrl: url,
        body,
        base,
        depth: 0,
        maxDepth,
        seen,
        collected,
        warnings,
        fetcher,
        exclusions,
      });
      break;
    }

    if (!sitemapHit) {
      warnings.push(`No usable sitemap found at ${base} (tried: ${candidates.join(', ')}).`);
    }

    const routes = Array.from(collected.values()).sort((a, b) =>
      a.path.localeCompare(b.path, 'en', { numeric: true }),
    );

    return {
      strategy: 'sitemap',
      routes,
      confidence: routes.length > 0 ? 1 : 0,
      warnings,
    };
  };
}

interface CollectArgs {
  readonly sitemapUrl: string;
  readonly body: string;
  readonly base: string;
  readonly depth: number;
  readonly maxDepth: number;
  readonly seen: Set<string>;
  readonly collected: Map<string, DiscoveredRoute>;
  readonly warnings: string[];
  readonly fetcher: SitemapFetcher;
  readonly exclusions: readonly RegExp[];
}

async function collectFromSitemap(args: CollectArgs): Promise<void> {
  if (args.depth > args.maxDepth) {
    args.warnings.push(
      `Sitemap recursion depth exceeded at ${args.sitemapUrl} (max ${args.maxDepth}).`,
    );
    return;
  }
  if (args.seen.has(args.sitemapUrl)) return;
  args.seen.add(args.sitemapUrl);

  const parsed = parseXml(args.body);
  if (!parsed) {
    args.warnings.push(`Failed to parse sitemap at ${args.sitemapUrl}.`);
    return;
  }

  // sitemap index → recurse
  if (parsed.kind === 'sitemapindex') {
    for (const childUrl of parsed.locs) {
      const childBody = await safeFetch(childUrl, args.fetcher, args.warnings);
      if (childBody === null) continue;
      await collectFromSitemap({
        ...args,
        sitemapUrl: childUrl,
        body: childBody,
        depth: args.depth + 1,
      });
    }
    return;
  }

  // urlset → collect
  for (const loc of parsed.locs) {
    const route = locToRoute(loc, args.base, args.sitemapUrl, args.exclusions);
    if (!route) continue;
    if (args.collected.has(route.path)) continue;
    args.collected.set(route.path, route);
  }
}

interface ParsedSitemap {
  readonly kind: 'sitemapindex' | 'urlset';
  readonly locs: readonly string[];
}

function parseXml(body: string): ParsedSitemap | null {
  let raw: unknown;
  try {
    const parser = new XMLParser({
      ignoreAttributes: true,
      isArray: (name) => name === 'sitemap' || name === 'url',
    });
    raw = parser.parse(body);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (obj.sitemapindex && typeof obj.sitemapindex === 'object') {
    const sitemaps = (obj.sitemapindex as Record<string, unknown>).sitemap;
    return {
      kind: 'sitemapindex',
      locs: extractLocs(sitemaps),
    };
  }
  if (obj.urlset && typeof obj.urlset === 'object') {
    const urls = (obj.urlset as Record<string, unknown>).url;
    return {
      kind: 'urlset',
      locs: extractLocs(urls),
    };
  }
  return null;
}

function extractLocs(value: unknown): readonly string[] {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  const locs: string[] = [];
  for (const entry of arr) {
    if (entry && typeof entry === 'object') {
      const loc = (entry as Record<string, unknown>).loc;
      if (typeof loc === 'string' && loc.trim()) {
        locs.push(loc.trim());
      }
    }
  }
  return locs;
}

function locToRoute(
  loc: string,
  base: string,
  sourceSitemap: string,
  exclusions: readonly RegExp[],
): DiscoveredRoute | null {
  const path = urlToPath(loc, base);
  if (path === null) return null;
  for (const re of exclusions) {
    if (re.test(path)) return null;
  }
  return {
    path,
    source: sourceSitemap,
    isDynamic: false,
  };
}

/**
 * Convert an absolute sitemap `<loc>` to a path under `base`. URLs from
 * other origins (e.g. cross-domain entries that sometimes leak into
 * sitemaps) are rejected - auditing them is outside the scope of a
 * single-base-URL audit.
 */
export function urlToPath(loc: string, base: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(loc);
  } catch {
    // Some sitemaps emit relative paths; treat them as already-stripped.
    if (loc.startsWith('/')) return normalizePath(loc);
    return null;
  }
  let baseParsed: URL;
  try {
    baseParsed = new URL(base);
  } catch {
    return null;
  }
  if (parsed.origin !== baseParsed.origin) return null;
  return normalizePath(`${parsed.pathname}${parsed.search}`);
}

function normalizePath(raw: string): string {
  if (raw === '') return '/';
  // Collapse trailing slash on non-root paths so /about and /about/ dedupe.
  if (raw.length > 1 && raw.endsWith('/')) {
    return raw.slice(0, -1);
  }
  return raw;
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * Quick content sniff to reject HTML fallback responses dressed up as
 * 200 OK by SPA hosts (Astro static, Vercel SPA mode, etc). A real
 * sitemap always begins with an XML declaration or one of the two
 * sitemaps.org root elements.
 */
function looksLikeXml(body: string): boolean {
  const head = body.trimStart().slice(0, 200).toLowerCase();
  if (head.startsWith('<?xml')) return true;
  if (head.startsWith('<urlset')) return true;
  if (head.startsWith('<sitemapindex')) return true;
  return false;
}

async function safeFetch(
  url: string,
  fetcher: SitemapFetcher,
  warnings: string[],
): Promise<string | null> {
  try {
    return await fetcher(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`Failed to fetch ${url}: ${message}`);
    return null;
  }
}

const defaultFetcher: SitemapFetcher = async (url) => {
  const response = await fetch(url, { headers: { Accept: 'application/xml,text/xml' } });
  if (!response.ok) return null;
  const body = await response.text();
  return body.length > 0 ? body : null;
};

function emptyResult(warnings: readonly string[]): RouteDiscoveryResult {
  return {
    strategy: 'sitemap',
    routes: [],
    confidence: 0,
    warnings,
  };
}
