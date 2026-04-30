# sdet-wcag-toolkit

WCAG 2.2 AA accessibility toolkit for modern web applications.

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-501%20passing-green.svg)](#)
[![Version](https://img.shields.io/badge/version-v0.4.1-blue.svg)](CHANGELOG.md)

> **Status:** v0.4.1 - **multi-page audit with 4-strategy
> auto-discovery,** plus a maintenance pass on top of v0.4.0:
> graceful Playwright cleanup (no more 30-min hang after multi-page
> audits), actionable warnings for dynamic routes, real-world
> strategy selection guide. Static + AI source-reading + dynamic
> analysis, sitemap / router-scan / AI agent / JSON-config route
> discovery, cross-page deduplication, heat-map reports, plus the
> v0.3 5 specialists and Lead orchestrator. Self-fix engine,
> per-page traces, authenticated routes, and parallel execution are
> commercial offerings (Pro tier); see "Commercial engagement"
> below.

## What it does

Audits a project against WCAG 2.2 Level A and AA across three paths
that emit the same `WcagFinding` shape and merge into a single report:

- **Static (deterministic)** - TypeScript rule-based analyzer for
  plain HTML/CSS. Zero LLM calls, zero tokens, CI-friendly.
- **Static (AI specialists)** - 5 source-reading agents (semantic-
  structure, aria-patterns, keyboard-interaction, color-contrast-
  static, forms-accessibility) dispatched in parallel through the
  Claude Code Task tool. They read JSX / Vue SFC / Angular templates
  / Svelte / Astro / HTML directly via `Read` + `Grep` + `Glob` and
  return JSON findings.
- **Dynamic** - Playwright + axe-core runner for issues that only
  surface at runtime: rendered-DOM ARIA, keyboard traps, focus
  indicators, contrast computed against actual styles.

**v0.4 adds multi-page** - `--multi-page` discovers the route list
(sitemap → router-scan → AI agent → JSON config), audits each page
in turn, and deduplicates findings cross-page so a single
source-level fix collapses many page hits into one entry. See
[docs/MULTI-PAGE-AUDIT.md](./docs/MULTI-PAGE-AUDIT.md) for the
full guide.

Reports lead with a 100-point **Score** and an A-F **Grade**
(critical -15, serious -10, moderate -5, minor -2; A: 90+,
B: 75-89, C: 50-74, D: 25-49, F: <25).

## Five specialists (static) + three runners (dynamic)

| Layer | Unit | Covers |
|-------|------|--------|
| Static | semantic-structure | Title, landmarks, heading order, lists, tables, alt |
| Static | aria-patterns | Invalid roles, required attrs, id refs, aria-hidden on focusables |
| Static | keyboard-interaction | Positive tabindex, unfocusable roles, click without keys |
| Static | color-contrast | CSS + inline styles where both fg+bg are resolvable |
| Static | forms-accessibility | Labels, error association, autocomplete, required signalling |
| Dynamic | axe-runner | All WCAG 2.0/2.1/2.2 A+AA rules axe covers |
| Dynamic | keyboard-flow | Tab cycle sanity, keyboard traps, Escape on dialog |
| Dynamic | focus-visibility | Visible focus indicator per focusable element |

See [docs/WCAG-COVERAGE.md](./docs/WCAG-COVERAGE.md) for the full
success-criterion-by-criterion matrix and honest "manual only" list.

## Install and run

```bash
git clone https://github.com/darco81/sdet-wcag-toolkit.git
cd sdet-wcag-toolkit
pnpm install
pnpm -r build

# Static (deterministic) - zero LLM, CI-friendly
node packages/cli/dist/bin/wcag-toolkit.js audit examples/react-basic

# Static + 5 AI specialists (requires Claude Code session)
node packages/cli/dist/bin/wcag-toolkit.js audit ./src --use-ai

# Dynamic only
node packages/cli/dist/bin/wcag-toolkit.js audit --url https://example.com

# Full v0.3 pipeline - static + AI + dynamic
node packages/cli/dist/bin/wcag-toolkit.js audit ./src --url http://localhost:3000 --use-ai

# v0.4: Multi-page audit (sitemap → router-scan → json-config fallback chain)
node packages/cli/dist/bin/wcag-toolkit.js audit . --url https://staging.example.com --multi-page

# v0.4: Pin a strategy and preview without launching the browser
node packages/cli/dist/bin/wcag-toolkit.js audit . --url https://staging.example.com --multi-page --strategy=sitemap --dry-run

# v0.4: Hand-curated route list (auto-detects wcag.config.json in cwd)
node packages/cli/dist/bin/wcag-toolkit.js audit . --multi-page --strategy=json-config

# Reports - dev long-form or one-page exec summary
node packages/cli/dist/bin/wcag-toolkit.js audit ./src --json > findings.json
node packages/cli/dist/bin/wcag-toolkit.js report --from findings.json --format dev --output audit.md
node packages/cli/dist/bin/wcag-toolkit.js report --from findings.json --format exec --target "MyApp" --output summary.md
```

CI-friendly: the process exits non-zero when any Critical or Serious
finding is present. `--use-ai` is opt-in so v0.2 CI flows keep
identical behavior.

### What v0.3 finds that v0.2 doesn't

The 5 AI specialists read source code with full framework awareness.
They catch issues the static analyzer cannot resolve (CSS custom
properties, design tokens, framework-idiomatic head/title/lang,
markdown content heading hierarchy) and the dynamic analyzer cannot
see (any URL not navigated). On a real Astro portfolio site, v0.2
static-only flagged 2 false positives in test artifacts; v0.3 with
`--use-ai` surfaced 16 real findings with file:line precision -
including 8 systematic design-token contrast issues and 8
heading-skip violations in markdown content.

### What v0.4 finds that v0.3 doesn't

v0.3 audits one page per `--url`. Real production sites have 20-50+
pages; the same source-level issue manifests on every page that
imports the offending component. v0.4's `--multi-page` discovers the
full route list across four strategies and deduplicates findings
cross-page - one entry per (`ruleId`, file:line) with an
`affectedPages: string[]` array showing the reach. The console
report leads with the heat map and the **single fix → many pages
green** callout so the user immediately sees which fixes pay back
the most.

Verified end-to-end on `docs.astro.build`: 5712 routes discovered
via sitemap-index recursion, capped at 3 with `--max-pages`,
real Playwright + axe scan per page. On synthesised Astro / Next /
Vue fixtures the router-scan strategy correctly resolves
`[slug]` / `[...rest]` / route groups / private folders / API
exclusions in under 10ms.

### Choosing a discovery strategy

The four strategies trade off **completeness** (sees post-build
routes) against **speed** and **dependency surface**. See
[docs/MULTI-PAGE-AUDIT.md](./docs/MULTI-PAGE-AUDIT.md) §Choosing a
strategy for the full decision tree; the short version:

- **`sitemap`** - recommended for production audits. Fetches the
  built sitemap and sees every dynamic route already resolved
  (articles, content collections, generated pages).
- **`router-scan`** - recommended for local dev. Walks
  `src/pages/**` in milliseconds. Skeleton-true; misses routes that
  depend on data.
- **`ai`** (opt-in) - for projects with programmatic routing or
  content collections that aren't in the sitemap yet. Costs Claude
  Code tokens.
- **`json-config`** - escape hatch for authenticated areas, complex
  selection rules, or hand-curated CI smokes.

Without `--strategy=` the dispatcher tries
`sitemap → router-scan → json-config` in order; AI is opt-in.

### Real-world dogfood

- **portfolio.sdet.it** (Astro) - single-page audit took the site
  from F → A in 8 commits during v0.3. Round 4 with `--multi-page`
  surfaced 9 additional cross-page findings on 3 routes that the
  single-page run missed.
- **docs.astro.build** - 5 712 routes discovered via
  `sitemap-index` recursion (8 nested sitemaps) in roughly one
  second. Pair with `--max-pages` for a representative smoke;
  Pro-tier parallel `BrowserContext` execution scales the rest.
- **Strategy gap on portfolio.sdet.it** - same project, same day:
  `router-scan` found 11 routes from `src/pages/**`, while
  `sitemap` returned 35 (post-build with 6 articles + 4 episodes +
  24 archive entries). Documented as a built-in trade-off; see the
  strategy guide above.

## Claude Code integration

If you use [Claude Code](https://docs.claude.com/en/docs/agents-and-tools/claude-code/overview):

- `/wcag:audit <path> [--url <url>]` - **v0.3 default.** Lead
  orchestrator dispatches 5 specialists in parallel; merges with
  static TS analyzer + optional dynamic. Returns score + grade.
- `/wcag:fix <path>` - manual remediation walkthrough (or wraps
  the Pro auto-fix CLI if installed).
- `/wcag:audit:static <path>` - same five specialists without the
  static TS analyzer / dynamic slice. Use when you want only
  source-reading.
- `/wcag:audit:dynamic <url>` - Playwright + axe-core against a
  live site.
- `/wcag:audit:full <path> --url <url>` - v0.2 path (static TS +
  dynamic, no AI). Useful for CI gates that have no CC session.
- `/wcag:report <findings.json>` - markdown report (dev or exec format).
- `/wcag:init <path>` - copy agents, skills, and commands into another
  project's `.claude/`.

## Demo fixtures

- `examples/demo-site/` - plain HTML/CSS with 15 intentional violations.
- `examples/react-basic/` - JSX components showcasing both analysis
  paths side by side.

## Monorepo layout

```
packages/
├── core/                 shared types, WCAG 2.2 catalog, scoring,
│                          MultiPageAuditReport / CrossPageFinding
├── static-analyzer/      TS rule analyzer + source loader (.astro, .vue, .svelte added in v0.4)
├── dynamic-tester/       Playwright + axe-core + keyboard-flow + focus-visibility,
│                          MultiPageOrchestrator + cross-page dedup (v0.4)
├── reporter/             dev + exec markdown generators + multi-page heat-map report (v0.4)
├── route-discovery/      v0.4 - dispatcher + sitemap, router-scan, AI agent, json-config strategies
├── runtime-core/         RuntimeAdapter contract + parser + HardGuard + 5 prompts
├── runtime-claude-code/  CC adapter via the native Task tool
├── orchestrator/         Lead orchestrator that dispatches 5 specialists
└── cli/                  wcag-toolkit binary (--use-ai, --multi-page, --strategy, --config, --max-pages)
.claude/
├── agents/               13 agents (2 leads + 5 static + 3 dynamic + 2 report
│                          + route-discovery-agent in v0.4)
├── skills/               wcag-audit, wcag-fix, wcag-static-analyze,
│                          wcag-dynamic-test, wcag-report
└── commands/             /wcag:audit, /wcag:fix, /wcag:audit:static|:dynamic|:full,
                           /wcag:report, /wcag:init
examples/
├── demo-site/            HTML fixture
└── react-basic/          JSX fixture
docs/
├── ARCHITECTURE.md
├── CONTRIBUTING.md
├── WCAG-COVERAGE.md
└── sprints/              per-release retrospective reports
```

## Versioning

| Version | Scope | Status |
|---------|-------|--------|
| v0.1 | Static analysis (TS + AI agents) | Released |
| v0.2 | + Dynamic (Playwright + axe-core) + reports | Released |
| v0.3 | + 5 AI specialists, Lead orchestrator, A-F grade, --use-ai | Released |
| v0.4.0 | + Multi-page audit (4 strategies), cross-page dedup, heat map | Released |
| **v0.4.1** | + Playwright cleanup fix, actionable dynamic-route warnings, strategy selection guide | **This release.** |
| Pro v0.4 alpha.4+ | + per-page traces, screenshots, auth, parallel, per-route routing, modal + ecommerce specialists, multi-runtime, auto-fix | Private; commercial |

## Commercial engagement

The Pro tier (v0.4+, private) extends what's in this repo with the
features that are most expensive to build, hardest to keep portable,
and highest-value for production use:

- **Two more specialists**: modal-specialist (focus trap, restoration,
  Escape, aria-modal on non-dialog) and ecommerce-journey
  (cart / checkout / product variant aria-live, payment review step,
  EAA framing).
- **Multi-runtime adapters** beyond Claude Code: OpenCode (local
  subprocess) and OpenCode-Ollama (fully on-prem with deepseek-r1,
  qwen-coder).
- **Auto-fix engine**: atomic patchers (image-alt, html-lang) with a
  verifier loop that re-audits after each patch and a git-committer
  that drops a clean PR.
- **`wcag.config.ts`** loader, `audit --scope component|page|full`,
  `fix --type aria|forms|keyboard`.

If you're auditing or building a product at scale and want the
remediation loop and full agent stack on top of what this repo
provides, get in touch via **sdet.it/services**.

| What's public (this repo, v0.4) | What's commercial (Pro V0.4 alpha.4+) |
|---------------------------------|---------------------------------------|
| 5 specialist agents (CC-only) | + modal + ecommerce specialists |
| Lead orchestrator + grading | + deep dedupe, three-mode audit |
| Static + dynamic + AI source-reading | + multi-runtime (OpenCode, Ollama) |
| Multi-page audit (4 strategies, sequential) | + per-page traces, screenshots, parallel BrowserContexts |
| `audit.auth` schema parsed (ignored) | + cookie / header / `storageState` injection wired into Playwright |
| Cross-page dedup + heat-map reports | + per-route specialist routing (saves AI cost) |
| Manual fix walkthrough via /wcag:fix | + AST auto-fix + verifier + PR |
| AGPL-3.0 license | Commercial license, on-prem option |

## Built with sdet-wcag-toolkit?

- ⭐ **Star the repo** if you find it useful
- 🐛 **Open an issue** if you find a bug or missed SC
- 💬 **Discussions** for usage questions and architecture talk
- 💼 **Commercial support** at [sdet.it/services](https://sdet.it/services)

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the v0.3
pipeline diagrams and skill design pattern, and
[docs/sprints/](./docs/sprints/) for per-release retrospectives.

## License

AGPL-3.0-or-later - see [LICENSE](./LICENSE).

If AGPL is a blocker for your deployment, commercial licensing is
available on request.
