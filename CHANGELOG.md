# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.1] - 2026-04-30

Maintenance pass on top of v0.4.0. Real-world dogfood (portfolio
audit, 2026-04-29 evening) surfaced one user-visible bug + a handful
of documentation gaps. No public API changes; safe drop-in upgrade.

### Fixed

- **`MultiPageOrchestrator` no longer hangs after a multi-page
  audit.** The default audit pipeline lazily started a
  `BrowserManager` but never called `BrowserManager.stop()`, so the
  Chromium process kept Node alive after `run()` resolved (~30 min
  hang reported in real-world dogfood). The orchestrator now wraps
  the run loop in a `try/finally` that invokes a paired cleanup
  hook, with a soft `cleanupTimeoutMs` (default 10 s) and
  swallowed cleanup errors so a hung `browser.close()` cannot poison
  the report.

### Changed

- **Actionable warnings for dynamic routes** - `router-scan`'s
  strategy-level warning and the orchestrator's per-route skip note
  now list every fallback strategy explicitly (sitemap / ai /
  json-config) instead of pointing only at `wcag.config.json`. The
  warning includes a concrete dynamic route from the project as the
  example so users see exactly what was skipped.

### Added

- **Strategy selection guide** in `docs/MULTI-PAGE-AUDIT.md` with a
  decision tree, the `portfolio.sdet.it` real-world example
  (router-scan: 11 routes, sitemap: 35 routes, ai: ≥35), and the
  `docs.astro.build` 5 712-route sitemap-index example.
- **README polish** - strategy selection summary, real-world
  dogfood section, refreshed badges (501 tests passing, version
  v0.4.1).

### Tests

- Test count: 454 → **501** (+47). Highlights: cleanup contract for
  the multi-page orchestrator (cleanup-on-success / -on-throw /
  hung-cleanup-timeout / swallowed cleanup errors), edge cases for
  the sitemap strategy (100+ index children, cycles via seen-set,
  percent-encoded paths, port-mismatch rejection), Next.js optional
  catch-all `[[...rest]]`, dispatcher chain exhaustion, and
  reporter rendering with skipped-only or single-page inputs.

### Internal

- Workspace package versions aligned: every package in the
  monorepo now ships at `0.4.1`. Earlier releases left
  `dynamic-tester` and `static-analyzer` at `0.2.0` as a
  housekeeping miss. Workspace dependencies use `workspace:*` so
  the alignment is purely cosmetic but improves downstream parsing.

## [0.4.0] - 2026-04-29

### Added

- **Multi-page audit** (`--multi-page`) - discover and audit a list
  of pages instead of just `--url`. New
  `@sdet-wcag-toolkit/route-discovery` package with four strategies:
  - **`sitemap`** - fetches `/sitemap.xml`, falls back through
    `sitemap-0.xml` and `sitemap_index.xml`, recurses into
    `<sitemapindex>` documents (depth cap + cycle protection),
    skips HTML 404 fallbacks via content sniff, filters default
    exclusions (`/api/*`, `/og/*`, `/feed.xml`, etc.), rejects
    cross-origin `<loc>` entries.
  - **`router-scan`** - deterministic FS walk keyed off framework
    conventions. Detectors for Astro (`src/pages/**/*.astro`),
    Next.js App + Pages Routers (route groups, private folders, API
    skip), Vue (vite-plugin-pages, with Nuxt riding the same
    detector for now). SvelteKit / Remix / Gatsby / React Router are
    detected from `package.json` but emit a "no detector yet"
    warning so the dispatcher can fall through to AI / json-config.
  - **`ai`** - dispatches the new `route-discovery-agent` through
    Claude Code's `Task` tool. Reads `package.json` + framework
    configs and emits routes plus `sampleUrl` resolved from
    `getStaticPaths` / `generateStaticParams` / content collections.
    Hand-rolled JSON validator (no zod dep).
  - **`json-config`** - reads `wcag.config.json` with an injected
    schema (baseUrl + pages + glob exclusions + auth section). The
    auth section is parsed but ignored in the public toolkit; the
    Pro tier consumes it for cookie / header / `storageState`
    injection. Auto-detected in cwd or via `--config <path>`.
- **Multi-page orchestrator** in `@sdet-wcag-toolkit/dynamic-tester`
  - keeps the browser open across pages, runs the existing axe /
  keyboard-flow / focus-visibility runners per page, tolerates
  per-page errors as `runner-error` skips, honors `--max-pages`.
- **Cross-page deduplication** - findings group by
  `(ruleId, file:line)` for source-located, `(ruleId, selector)`
  for DOM-located, with a fallback by message. Each canonical
  finding carries `affectedPages: string[]` so a single source-level
  fix collapses many page hits into one entry. Drives the "single
  fix → many pages green" callout in reports.
- **Multi-page reporters** - `formatMultiPageDevReport` (markdown
  with header / heat map / cross-page section / per-page details
  with auto-collapse beyond 20 routes / skipped routes table) and
  `formatMultiPageConsoleReport` (terminal heat map with
  PAGE/CRIT/SERI/MOD/MIN/TOTAL columns, top cross-page findings
  sorted by reach, skipped pages grouped by reason).
- **CLI flags:** `--multi-page`, `--strategy`, `--max-pages`,
  `--config`, `--dry-run`. JSON output emits the full
  `MultiPageAuditReport`. `audit.baseUrl` from `wcag.config.json`
  is honored when `--url` is omitted. Exit code 1 when any
  cross-page finding is critical or serious.
- **Source-loader extension** - `.astro`, `.vue`, `.svelte` are now
  recognised SourceKinds. Existing accessibility analyzers are
  unaffected; future template-aware analyzers can opt in.
- **`docs/MULTI-PAGE-AUDIT.md`** - long-form guide covering all
  four strategies, the JSON config schema, dry-run + JSON output,
  exit codes, troubleshooting, and example invocations.

### Changed

- **Backward-compat strict** - running without `--multi-page` is
  byte-identical to v0.3 single-page audit. All v0.3 flags
  (`--use-ai`, `--url`, `--wait-for`, `--json`, `--top`) keep their
  exact semantics.
- **Default registry composition** - the AI strategy ships without
  an invoker by default; the CLI wires Claude Code's `TaskInvoker`
  in only when `--use-ai` or `--strategy=ai` is set. Outside that
  opt-in the AI strategy degrades gracefully with a "needs --use-ai"
  warning instead of throwing.

### Deferred to V0.4 alpha.4 (Pro tier)

- Per-page Playwright trace recording.
- Per-page screenshot sequences.
- Authenticated routes (cookie / header / `storageState` injection).
- Parallel page execution via `BrowserContext`-per-page.
- Per-route specialist routing (e.g. `/checkout/*` →
  ecommerce-journey + forms-accessibility only).

## [0.3.0] - 2026-04-25

### Added

- **5 AI specialist agents** dispatched in parallel through the
  Claude Code Task tool (semantic-structure, aria-patterns,
  keyboard-interaction, color-contrast-static, forms-accessibility).
  These are markdown-only prompts in
  `@sdet-wcag-toolkit/runtime-core`; they read source directly via
  `Read` / `Grep` / `Glob`.
- **Lead orchestrator** (`@sdet-wcag-toolkit/orchestrator`) -
  dispatches the 5 specialists in parallel, merges findings with a
  simple (ruleId, file:line, url) dedupe, computes the v0.3 score,
  and renders both reports.
- **A-F grade band based on a 100-point score** in
  `@sdet-wcag-toolkit/core`: severities subtract from 100 (critical
  -15, serious -10, moderate -5, minor -2, floored at 0). New
  exports: `aggregatePenaltyScore`, `gradeFromPenaltyScore`,
  `scoreAndGrade`, `PENALTY_WEIGHT`. Existing v0.2 functions stay.
- **`--use-ai` CLI flag** on `wcag-toolkit audit`. Opt-in (default
  off) so v0.2 CI flows are unchanged. When set, the Lead
  orchestrator chains onto the static + optional dynamic flow.
- **`runtime-core` package** - RuntimeAdapter contract,
  structured JSON parser (fenced ```json``` block + `<think>`
  scrub + zod validation against the WCAG catalog), HardGuard
  tool sanitizer (allowlist Read/Grep/Glob/LS, deny everything
  else).
- **`runtime-claude-code` package** - implements RuntimeAdapter via
  the native Task tool. Parallel-by-default. Throws a friendly
  --use-ai / /wcag:audit hint when called outside a CC session.
- **Bucket-2 prompt quality patches** (~80 lines markdown) over
  the v0.2 specialists:
  - semantic-structure: 3.1.2 Language of Parts, modal heading-rank.
  - aria-patterns: live-region politeness hierarchy + DOM-mounted
    rule, dialog-type taxonomy (aria-modal on non-dialog roles).
  - keyboard-interaction: composite-widget rule with APG keyboard
    table for Tabs / Listbox / Combobox / Menu (roving tabindex).
  - color-contrast-static: 1.4.1 color-only indicator heuristic,
    `prefers-reduced-motion` / `prefers-contrast` / `forced-colors`
    presence checks.
  - forms-accessibility: 3.3.4 review-step rule for checkout /
    payment / financial forms, validation-timing rule (`@input`
    flagged, `@blur` recommended).
- **Two new Claude Code skills**: `.claude/skills/wcag-audit/` and
  `.claude/skills/wcag-fix/`. Two new slash commands: `/wcag:audit`
  and `/wcag:fix`.
- **Reports now show the score**: exec summary opens with
  `## Score: N (Grade X)` plus a per-severity penalty breakdown.
  Dev report header reads `Score · Grade · Findings`. Both
  reserve a `## Positive findings` section (placeholder for v0.4+).

### Changed

- `core`, `reporter`, `cli` bumped to `0.3.0`. New packages
  (`runtime-core`, `runtime-claude-code`, `orchestrator`) ship at
  `0.3.0`.

### Notes

- AI agents require a Claude Code session (Task tool dependency).
  Outside CC, `--use-ai` aborts with a helpful error. Static +
  dynamic still work without `--use-ai`.
- The Pro tier (V0.4+, private) adds modal-specialist and
  ecommerce-journey agents, multi-runtime support (OpenCode, local
  LLM), and the auto-fix engine. See `README.md` § Commercial
  engagement.

## [0.2.0] - 2026-02-28

**v0.2 highlight: dynamic + reports + Claude Code integration.**
Was originally framed as the last public release; v0.3 reverses
that - public toolkit now ships the AI specialists alongside.

### Added

- `@sdet-wcag-toolkit/dynamic-tester` - Playwright + axe-core +
  keyboard-flow + focus-visibility runners, plus
  `DynamicTesterOrchestrator`.
- `@sdet-wcag-toolkit/reporter` - markdown generators for developer and
  executive audiences (`formatDevReport`, `formatExecSummary`).
- CLI: `audit --url <url>` for dynamic runs, combined `audit <path>
  --url <url>` mode, `--wait-for <selector>`, `report` command.
- 7 Claude Code agents (forms-accessibility, wcag-dynamic-lead, axe-
  runner-agent, keyboard-flow-agent, focus-visibility-agent, dev-
  report-agent, exec-summary-agent).
- 2 skills (`wcag-dynamic-test`, `wcag-report`), 3 commands
  (`/wcag:audit:dynamic`, `/wcag:audit` full, `/wcag:report`).
- `docs/WCAG-COVERAGE.md` - SC-by-SC coverage matrix with honest manual
  column.
- `docs/sprints/v0.2-sprint-report.md`.

### Changed

- README restructured around v0.2 scope and the commercial gate.
- `wcag-toolkit` CLI bumped to 0.2.0; all workspace packages to 0.2.0.

## [0.1.1] - 2026-01-10

### Changed

- **Pivot from Model A to Model C.** Specialist agents were thin wrappers
  over the TypeScript analyzer (which only parses HTML/CSS). Rewrote the
  four specialists to read source directly via `Read` / `Grep` / `Glob`,
  understand JSX, Vue SFC, Angular templates, Svelte, and Astro, and emit
  `WcagFinding` JSON. `wcag-lead` now dispatches them in parallel via the
  `Task` tool. The TypeScript analyzer stays as the deterministic CI path.

### Added

- `wcag-toolkit init [path]` - copies `.claude/` agents, skills, and
  commands into a target project.
- `/wcag:init` slash command.
- `examples/react-basic/` - JSX fixture with 14+ intentional issues
  demonstrating both analysis paths.

### Notes

See `docs/sprints/v0.1-sprint-report.md` section "Pivot mid-sprint: Model
A → Model C" for the full story. Planned case study material.

## [0.1.0] - 2025-12-20

### Added

- Monorepo scaffold: pnpm workspaces, TypeScript, prettier, editorconfig, CI.
- `@sdet-wcag-toolkit/core`: shared types, WCAG 2.2 A/AA catalog (55 criteria),
  severity weights with A-F grading, per-finding priority scoring.
- `@sdet-wcag-toolkit/static-analyzer`: orchestrator, file-system source
  loader, and four analyzers - semantic structure, ARIA patterns, keyboard
  interaction, and color contrast. `createDefaultOrchestrator` factory.
- `@sdet-wcag-toolkit/cli`: `wcag-toolkit audit <path>` with console + JSON
  output and CI-friendly exit code.
- Demo fixture `examples/demo-site/` with 15 intentional violations.
- Claude Code integration: `wcag-lead` + 4 specialist agents, the
  `wcag-static-analyze` skill, and `/wcag:audit:static` command.
- 125 unit and integration tests across packages.
