/**
 * Sitemap strategy tests. Use an in-memory fetcher to keep the suite
 * hermetic - every test wires its own URL → XML map.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_SITEMAP_CANDIDATES,
  DEFAULT_SITEMAP_EXCLUSIONS,
  createSitemapStrategy,
  type SitemapFetcher,
  urlToPath,
} from './sitemap.js';

const BASE = 'https://example.com';

function fetcherFromMap(map: Record<string, string | null>): SitemapFetcher {
  return vi.fn(async (url: string) => map[url] ?? null);
}

const SIMPLE_URLSET = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/about</loc></url>
  <url><loc>https://example.com/blog/post-1</loc></url>
  <url><loc>https://example.com/blog/post-1/</loc></url>
</urlset>`;

const ASTRO_STYLE_INDEX = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-0.xml</loc></sitemap>
</sitemapindex>`;

const NEXTJS_STYLE_URLSET = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc><lastmod>2026-04-01</lastmod></url>
  <url><loc>https://example.com/products</loc></url>
  <url><loc>https://example.com/api/health</loc></url>
  <url><loc>https://example.com/og/social.png</loc></url>
  <url><loc>https://example.com/feed.xml</loc></url>
</urlset>`;

const MULTI_INDEX = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-pages.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap-blog.xml</loc></sitemap>
</sitemapindex>`;

describe('createSitemapStrategy', () => {
  it('parses a flat urlset and returns sorted, deduplicated routes', async () => {
    const fetcher = fetcherFromMap({
      [`${BASE}/sitemap.xml`]: SIMPLE_URLSET,
    });
    const strategy = createSitemapStrategy({ fetcher });

    const result = await strategy({ baseUrl: BASE });

    expect(result.strategy).toBe('sitemap');
    expect(result.confidence).toBe(1);
    expect(result.routes.map((r) => r.path)).toEqual(['/', '/about', '/blog/post-1']);
    expect(result.routes.every((r) => !r.isDynamic)).toBe(true);
    expect(result.routes[0]?.source).toBe(`${BASE}/sitemap.xml`);
  });

  it('falls back from sitemap.xml to sitemap-0.xml', async () => {
    const fetcher = fetcherFromMap({
      [`${BASE}/sitemap-0.xml`]: SIMPLE_URLSET,
    });
    const strategy = createSitemapStrategy({ fetcher });

    const result = await strategy({ baseUrl: BASE });

    expect(result.routes).toHaveLength(3);
    expect(result.warnings).toEqual([]);
  });

  it('recurses into a sitemap index document', async () => {
    const fetcher = fetcherFromMap({
      [`${BASE}/sitemap.xml`]: ASTRO_STYLE_INDEX,
      [`${BASE}/sitemap-0.xml`]: SIMPLE_URLSET,
    });
    const strategy = createSitemapStrategy({ fetcher });

    const result = await strategy({ baseUrl: BASE });

    expect(result.routes).toHaveLength(3);
    expect(result.routes[0]?.source).toBe(`${BASE}/sitemap-0.xml`);
  });

  it('merges results from a multi-child sitemap index', async () => {
    const pages = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://example.com/</loc></url>
      <url><loc>https://example.com/about</loc></url>
    </urlset>`;
    const blog = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://example.com/blog/a</loc></url>
      <url><loc>https://example.com/blog/b</loc></url>
    </urlset>`;
    const fetcher = fetcherFromMap({
      [`${BASE}/sitemap.xml`]: MULTI_INDEX,
      [`${BASE}/sitemap-pages.xml`]: pages,
      [`${BASE}/sitemap-blog.xml`]: blog,
    });
    const strategy = createSitemapStrategy({ fetcher });

    const result = await strategy({ baseUrl: BASE });

    expect(result.routes.map((r) => r.path)).toEqual(['/', '/about', '/blog/a', '/blog/b']);
  });

  it('filters default exclusions (api, og, feed, sitemap-self, llms)', async () => {
    const fetcher = fetcherFromMap({
      [`${BASE}/sitemap.xml`]: NEXTJS_STYLE_URLSET,
    });
    const strategy = createSitemapStrategy({ fetcher });

    const result = await strategy({ baseUrl: BASE });

    expect(result.routes.map((r) => r.path)).toEqual(['/', '/products']);
  });

  it('honors custom exclusion list', async () => {
    const fetcher = fetcherFromMap({
      [`${BASE}/sitemap.xml`]: SIMPLE_URLSET,
    });
    const strategy = createSitemapStrategy({
      fetcher,
      exclusions: [/^\/blog/], // exclude all blog paths
    });

    const result = await strategy({ baseUrl: BASE });

    expect(result.routes.map((r) => r.path)).toEqual(['/', '/about']);
  });

  it('rejects URLs from other origins (cross-domain leak protection)', async () => {
    const xml = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://example.com/safe</loc></url>
      <url><loc>https://other.example.org/leak</loc></url>
    </urlset>`;
    const fetcher = fetcherFromMap({ [`${BASE}/sitemap.xml`]: xml });
    const strategy = createSitemapStrategy({ fetcher });

    const result = await strategy({ baseUrl: BASE });

    expect(result.routes.map((r) => r.path)).toEqual(['/safe']);
  });

  it('returns empty + warning when no sitemap is reachable', async () => {
    const fetcher = fetcherFromMap({});
    const strategy = createSitemapStrategy({ fetcher });

    const result = await strategy({ baseUrl: BASE });

    expect(result.routes).toEqual([]);
    expect(result.confidence).toBe(0);
    expect(result.warnings.some((w) => w.includes('No usable sitemap found'))).toBe(true);
  });

  it('skips HTML responses (SPA 404 fallback) and tries the next candidate', async () => {
    const html = '<!doctype html><html><body>Not Found</body></html>';
    const fetcher = fetcherFromMap({
      [`${BASE}/sitemap.xml`]: html,
      [`${BASE}/sitemap-0.xml`]: SIMPLE_URLSET,
    });
    const strategy = createSitemapStrategy({ fetcher });

    const result = await strategy({ baseUrl: BASE });

    expect(result.routes).toHaveLength(3);
    expect(result.warnings.some((w) => w.includes('was not XML'))).toBe(true);
  });

  it('returns empty + warning when every candidate is an HTML fallback', async () => {
    const html = '<!doctype html><html><body>Not Found</body></html>';
    const fetcher = fetcherFromMap({
      [`${BASE}/sitemap.xml`]: html,
      [`${BASE}/sitemap-0.xml`]: html,
      [`${BASE}/sitemap_index.xml`]: html,
    });
    const strategy = createSitemapStrategy({ fetcher });

    const result = await strategy({ baseUrl: BASE });

    expect(result.routes).toEqual([]);
    expect(result.warnings.filter((w) => w.includes('was not XML'))).toHaveLength(3);
    expect(result.warnings.some((w) => w.includes('No usable sitemap found'))).toBe(true);
  });

  it('returns empty + warning when XML is malformed', async () => {
    const fetcher = fetcherFromMap({
      [`${BASE}/sitemap.xml`]: '<?xml version="1.0"?><not-a-real-sitemap></not-a-real-sitemap>',
    });
    const strategy = createSitemapStrategy({ fetcher });

    const result = await strategy({ baseUrl: BASE });

    expect(result.routes).toEqual([]);
    // Looks like XML (starts with `<?xml`) but fails the urlset/sitemapindex shape check.
    expect(result.warnings.some((w) => w.includes('Failed to parse sitemap'))).toBe(true);
  });

  it('captures unexpected fetch errors as warnings, not throws', async () => {
    const fetcher: SitemapFetcher = vi.fn(async () => {
      throw new Error('ENETUNREACH');
    });
    const strategy = createSitemapStrategy({ fetcher });

    const result = await strategy({ baseUrl: BASE });

    expect(result.routes).toEqual([]);
    expect(result.warnings.some((w) => w.includes('ENETUNREACH'))).toBe(true);
  });

  it('returns empty when context has no baseUrl (with explanatory warning)', async () => {
    const strategy = createSitemapStrategy({ fetcher: vi.fn() });

    const result = await strategy({});

    expect(result.routes).toEqual([]);
    expect(result.warnings[0]).toMatch(/requires a baseUrl/);
  });

  it('strips trailing slash on baseUrl so /sitemap.xml is not //sitemap.xml', async () => {
    const fetcher = fetcherFromMap({
      [`${BASE}/sitemap.xml`]: SIMPLE_URLSET,
    });
    const strategy = createSitemapStrategy({ fetcher });

    const result = await strategy({ baseUrl: `${BASE}/` });

    expect(result.routes).toHaveLength(3);
  });

  it('caps recursion depth to defend against pathological cycles', async () => {
    // Two index files pointing at each other.
    const indexA = `<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <sitemap><loc>https://example.com/b.xml</loc></sitemap>
    </sitemapindex>`;
    const indexB = `<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <sitemap><loc>https://example.com/a.xml</loc></sitemap>
    </sitemapindex>`;
    const fetcher = fetcherFromMap({
      [`${BASE}/sitemap.xml`]: indexA,
      [`${BASE}/a.xml`]: indexA,
      [`${BASE}/b.xml`]: indexB,
    });
    const strategy = createSitemapStrategy({ fetcher, maxDepth: 2 });

    const result = await strategy({ baseUrl: BASE });

    // Cycle: deduped via `seen` set; no routes emitted; no infinite loop.
    expect(result.routes).toEqual([]);
  });

  it('exposes default candidate list and exclusions', () => {
    expect(DEFAULT_SITEMAP_CANDIDATES).toContain('/sitemap.xml');
    expect(DEFAULT_SITEMAP_CANDIDATES).toContain('/sitemap-0.xml');
    expect(DEFAULT_SITEMAP_EXCLUSIONS.some((re) => re.test('/api/x'))).toBe(true);
    expect(DEFAULT_SITEMAP_EXCLUSIONS.some((re) => re.test('/og/social.png'))).toBe(true);
    expect(DEFAULT_SITEMAP_EXCLUSIONS.some((re) => re.test('/feed.xml'))).toBe(true);
    expect(DEFAULT_SITEMAP_EXCLUSIONS.some((re) => re.test('/sitemap-0.xml'))).toBe(true);
    expect(DEFAULT_SITEMAP_EXCLUSIONS.some((re) => re.test('/llms.txt'))).toBe(true);
  });
});

describe('urlToPath', () => {
  it('returns the pathname for matching origin', () => {
    expect(urlToPath('https://example.com/about', 'https://example.com')).toBe('/about');
  });

  it('strips trailing slash on non-root paths', () => {
    expect(urlToPath('https://example.com/about/', 'https://example.com')).toBe('/about');
  });

  it('preserves the root slash', () => {
    expect(urlToPath('https://example.com/', 'https://example.com')).toBe('/');
  });

  it('preserves query strings', () => {
    expect(urlToPath('https://example.com/blog?tag=a', 'https://example.com')).toBe('/blog?tag=a');
  });

  it('rejects cross-origin URLs', () => {
    expect(urlToPath('https://other.org/leak', 'https://example.com')).toBeNull();
  });

  it('treats relative paths as already-stripped', () => {
    expect(urlToPath('/relative', 'https://example.com')).toBe('/relative');
  });

  it('returns null for unparseable input', () => {
    expect(urlToPath('not a url', 'https://example.com')).toBeNull();
  });
});
