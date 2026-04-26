# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_No unreleased changes yet._

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
