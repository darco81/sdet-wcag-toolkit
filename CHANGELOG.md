# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_No unreleased changes yet._

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
