# Multi-page audit (V0.4)

> **Status:** V0.4 public - sitemap, router-scan, AI agent, and JSON
> config strategies all wired. Pro tier (V0.4 alpha.4) layers trace
> recording, screenshots, authenticated routes, and parallel
> execution on top.

The `--multi-page` flag turns a single-URL audit into a
discovery-driven, per-page audit loop. Run it from the repo root
with `--url` pointing at a deployed environment, and the toolkit:

1. **Discovers** the route list using one of four strategies.
2. **Audits** each page in turn (Playwright + axe-core + the
   keyboard-flow / focus-visibility runners).
3. **Deduplicates** findings cross-page so a single source-level fix
   collapses many page hits into one entry.
4. **Reports** with a heat map, top cross-page findings, and the
   "single fix → many pages green" callout.

```bash
wcag-toolkit audit ./my-app --url https://staging.example.com --multi-page
```

## The four strategies

The dispatcher tries strategies in a fallback chain - the first one
that returns a non-empty route list wins. You can pin a single
strategy with `--strategy=<name>`.

| Strategy | When to use | Speed | Token cost |
| --- | --- | --- | --- |
| `sitemap` | Production / staging URL with a built sitemap | ⚡ ~1 HTTP request | Zero |
| `router-scan` | Local dev, CI, framework-driven projects | ⚡ ~10ms FS walk | Zero |
| `ai` | Programmatic routing, content collections, custom layouts | 🐌 ~10-30s agent dispatch | Yes (Claude Code session required) |
| `json-config` | SPAs, authenticated areas, hand-curated lists | ⚡ instant | Zero |

### Default fallback chain

When you don't pass `--strategy`, the dispatcher tries:

```
sitemap → router-scan → json-config
```

`ai` is **opt-in** to avoid surprise token spend. Enable it with
`--strategy=ai` or by passing `--use-ai` alongside `--multi-page`.

### Strategy 1: `sitemap`

Fetches `<base>/sitemap.xml`, falling back to `sitemap-0.xml` and
`sitemap_index.xml`. Recurses into `<sitemapindex>` documents up to
depth 5 (with cycle protection). Filters out the usual non-page
exclusions (`/api/*`, `/og/*`, `/feed.xml`, `/rss.xml`,
`/sitemap*.xml`, `/llms*.txt`, `/robots.txt`).

```bash
wcag-toolkit audit . --url https://docs.example.com --multi-page --strategy=sitemap
```

**Gotcha:** SPA hosts often return a 200 OK + HTML 404 fallback for
missing sitemap.xml. The strategy detects this with a content sniff
(`<?xml`, `<urlset`, `<sitemapindex`) and tries the next candidate
rather than choking on HTML.

### Strategy 2: `router-scan`

Walks framework-specific subtrees (`src/pages`, `app/`, `pages/`,
`src/routes`, `src/views`) with a tiny zero-dep recursive walker
and maps files to URL paths via per-framework conventions.

Detectors that ship in V0.4:

- **Astro** - `src/pages/**/*.astro`, with `index` collapse and
  `[slug]`/`[...rest]` dynamics. API endpoints under `src/pages/api/`
  are skipped.
- **Next.js (App Router)** - `app/**/page.{tsx,jsx,ts,js}` with
  route groups `(name)` dropped, private folders `_*` skipped, and
  `layout`/`loading`/`error`/`route` excluded.
- **Next.js (Pages Router)** - `pages/**/*.{tsx,jsx,ts,js}` with
  `_app`/`_document`/`_error`/`404`/`500` and `pages/api/*` skipped.
- **Vue** (vite-plugin-pages convention) - `src/pages/**/*.vue` and
  `src/views/**/*.vue` with the same `[slug]`/`[...rest]` rules.
- **Nuxt** - best-effort via the Vue detector for now; dedicated
  detector lands in alpha.5.

Other frameworks (SvelteKit, Remix, Gatsby, React Router) are
**detected** from `package.json` but emit a "no detector implemented
yet" warning so the dispatcher can move on to the AI or
`json-config` strategy.

```bash
wcag-toolkit audit ./my-astro-app --url https://staging.example.com --multi-page --strategy=router-scan
```

Confidence is **1.0** when every route is static, **0.7** when at
least one dynamic route (`[slug]`, `[...rest]`) leaks through -
those need a `sampleUrl` from the AI strategy or a hand-written
`wcag.config.json`.

### Strategy 3: `ai`

Dispatches the `route-discovery-agent` (defined in
`.claude/agents/route-discovery-agent.md`) through Claude Code's
`Task` tool. The agent reads `package.json`, framework configs, and
routing files; emits a JSON payload of routes plus `sampleUrl`
values resolved from `getStaticPaths` / `generateStaticParams` /
content collections.

```bash
wcag-toolkit audit ./my-app --url https://staging.example.com --multi-page --strategy=ai
```

Requires a Claude Code session - run via the `/wcag:audit` skill or
from inside the `claude` REPL. Outside of CC the strategy returns
gracefully with a "needs --use-ai inside Claude Code" warning.

### Strategy 4: `json-config`

The escape hatch. Hand-write a `wcag.config.json`:

```json
{
  "audit": {
    "baseUrl": "https://staging.example.com",
    "pages": ["/", "/about", "/products/top-10", "/blog/intro"],
    "exclude": ["/admin/*", "/dashboard/*"],
    "auth": { "type": "cookie", "name": "session", "value": "..." }
  }
}
```

The CLI auto-detects `wcag.config.json` in the current working
directory; pass `--config <path>` for a different location.

```bash
# Auto-detect from cwd
wcag-toolkit audit . --multi-page --strategy=json-config

# Explicit path
wcag-toolkit audit . --multi-page --config ./wcag.staging.json
```

**Schema:**

| Field | Type | Required | Notes |
| --- | --- | :---: | --- |
| `audit.baseUrl` | http(s) URL | ✓ | Used as base for relative `pages` |
| `audit.pages` | string[] | ✓ | Page paths (relative to baseUrl) |
| `audit.exclude` | string[] |   | Glob patterns; `*` becomes `.*`, other regex meta is escaped |
| `audit.auth.type` | `'cookie' \| 'header' \| 'storage-state'` |   | Public toolkit accepts the schema; the Pro tier consumes it |

**Auth section is parsed but ignored in the public toolkit.** The
Pro tier (`@sdet-wcag-toolkit-pro/multi-page-pro`) wires it into
Playwright cookies / headers / `storageState`.

## CLI flags

```
wcag-toolkit audit [path]
  --url <url>             Base URL to audit dynamically with Playwright + axe-core
  --multi-page            Discover and audit multiple pages instead of just --url
  --strategy <name>       Pin a discovery strategy: ai | sitemap | router-scan | json-config
  --max-pages <n>         Cap on pages audited (default 50, 0 = no limit)
  --config <path>         Path to wcag.config.json (used by the json-config strategy)
  --dry-run               List the URLs --multi-page would audit and exit
  --json                  Emit findings as JSON (MultiPageAuditReport shape)
  --use-ai                Enable the AI strategies (route-discovery + WCAG specialists)
```

## Output

### Console (default)

```
Multi-page WCAG audit - 12 audited · 3 skipped · 8 unique finding(s) (24 occurrence(s))
Base URL: https://staging.example.com  ·  strategy: sitemap (confidence 1.00)  ·  18.3s

Heat map (pages × severity):
  PAGE                  CRIT  SERI   MOD   MIN  TOTAL
  /products/123            1     2     -     1      4
  /                        -     2     -     -      2
  …+10 more page(s)

Top 5 cross-page findings:
   SERI  SC 1.3.1 [landmark-main] - 12 page(s)
      Document has no <main> landmark.
      ↳ src/Layout.astro:12
        • https://staging.example.com/
        • https://staging.example.com/about
        • https://staging.example.com/products
        …+9 more

Skipped (3):
  dynamic-no-sample (2):
    ! /blog/[slug] - Dynamic route /blog/[slug] has no sampleUrl…
    ! /users/[id] - Dynamic route /users/[id] has no sampleUrl…
  runner-error (1):
    ! /broken - navigation timeout
```

### `--json`

Full `MultiPageAuditReport` shape (see
`@sdet-wcag-toolkit/core` types). Include this in CI artefacts to
power historical dashboards.

### `--dry-run`

Prints the route list the audit *would* visit, with strategy and
confidence, then exits. No browser launch, no findings.

## Exit codes

- `0` - no critical/serious cross-page findings.
- `1` - at least one critical or serious cross-page finding (CI gate).

## Cross-page deduplication

Findings group by:

- `(ruleId, file:line)` for source-located findings.
- `(ruleId, selector)` for DOM-located findings.
- `(ruleId, message)` as last-resort fallback.

The first occurrence wins as the canonical finding; `affectedPages`
holds every URL where it appeared. This is what powers the **single
fix → many pages green** narrative - fix one component, watch the
report drop a dozen entries.

## Skipped routes

The report always shows what was skipped and why:

| Reason | When |
| --- | --- |
| `dynamic-no-sample` | `[slug]` route without a `sampleUrl` (use `--strategy=ai` or `wcag.config.json`) |
| `runner-error` | Navigation or runner exception (timeout, network) |
| `max-pages` | Truncated by the `--max-pages` cap |

## Troubleshooting

**"No usable sitemap found at https://...":**
The strategy probed `/sitemap.xml`, `/sitemap-0.xml`, and
`/sitemap_index.xml` - none returned XML. Either the site has no
sitemap, or it's served as HTML 404 fallback. Try
`--strategy=router-scan` (if running locally) or write a
`wcag.config.json`.

**"router-scan: no recognised framework in dependencies":**
Your `package.json` doesn't list any of the supported frameworks.
Try `--strategy=ai` (needs `--use-ai` and a Claude Code session) or
write a `wcag.config.json`.

**"router-scan: detected next but no detector implemented yet":**
Lies - Next has a detector. If you actually see this, you hit
SvelteKit / Remix / Gatsby / React Router. Use `--strategy=ai` or
`json-config`.

**Audit takes forever:**
Each page is sequential by design (the runners share a Page).
For 50+ routes that's minutes, not seconds. Cap with
`--max-pages=10` for a quick smoke, or upgrade to the Pro tier for
parallel BrowserContexts.

**`--strategy=ai` says "Claude Code Task tool is not available":**
Run from a Claude Code session (`/wcag:audit` skill) or from inside
the `claude` REPL. The agent dispatch needs the native `Task` tool,
which only exists inside CC.

## Examples

### Audit a deployed Astro site (sitemap path)

```bash
wcag-toolkit audit . --url https://docs.astro.build --multi-page --max-pages=20
```

### Audit a local Next.js dev server (router-scan)

```bash
pnpm dev &              # start dev server on :3000
wcag-toolkit audit . --url http://localhost:3000 --multi-page --strategy=router-scan
```

### Hand-curated CI smoke (json-config)

`wcag.config.json`:

```json
{
  "audit": {
    "baseUrl": "https://staging.example.com",
    "pages": ["/", "/checkout", "/account/orders"]
  }
}
```

```bash
wcag-toolkit audit . --multi-page --json > audit-report.json
```

### AI-assisted discovery for a programmatic-routing project

```bash
# From inside the Claude Code REPL or via /wcag:audit skill
wcag-toolkit audit . --url https://app.example.com --multi-page --use-ai
```

## What's next

Pro tier (V0.4 alpha.4) adds:

- **Per-page Playwright traces** for replay debugging.
- **Per-page screenshot sequences** (page load → focus walk → modal open).
- **Authenticated routes** - wires the `audit.auth` section into
  Playwright cookies / headers / `storageState`.
- **Parallel page execution** via `BrowserContext`-per-page.
- **Per-route specialist routing** - `/checkout/*` gets the
  ecommerce-journey + forms-accessibility specialists; `/blog/*`
  gets semantic-structure only. Saves AI cost.
