# sdet-wcag-toolkit

WCAG 2.2 AA accessibility toolkit for modern web applications.

> **Status:** v0.2.0 - **last public release.** Static + dynamic
> analysis, markdown reports, Claude Code integration. Self-fix (v0.3+)
> is a commercial offering; see "Commercial engagement" below.

## What it does

Audits a project against WCAG 2.2 Level A and AA across two paths:

- **Static** - TypeScript rule-based analyzer for plain HTML/CSS (CI-
  friendly, zero LLM calls) + AI specialist agents that read JSX, Vue,
  Angular, Svelte, and Astro source directly.
- **Dynamic** - Playwright + axe-core runner for issues that only
  surface at runtime: rendered-DOM ARIA, keyboard traps, focus
  indicators, contrast computed against actual styles.

Both paths emit the same `WcagFinding` shape and can be merged into a
single report.

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

# Static audit on a source tree
node packages/cli/dist/bin/wcag-toolkit.js audit examples/react-basic

# Dynamic audit on a URL
node packages/cli/dist/bin/wcag-toolkit.js audit --url https://example.com

# Both - merges findings across paths
node packages/cli/dist/bin/wcag-toolkit.js audit ./src --url http://localhost:3000

# Reports - dev long-form or one-page exec summary
node packages/cli/dist/bin/wcag-toolkit.js audit ./src --json > findings.json
node packages/cli/dist/bin/wcag-toolkit.js report --from findings.json --format dev --output audit.md
node packages/cli/dist/bin/wcag-toolkit.js report --from findings.json --format exec --target "MyApp" --output summary.md
```

CI-friendly: the process exits non-zero when any Critical or Serious
finding is present.

## Claude Code integration

If you use [Claude Code](https://docs.claude.com/en/docs/agents-and-tools/claude-code/overview):

- `/wcag:audit:static <path>` - AI agents read your source and find WCAG
  issues framework-aware (React, Vue, Angular, Svelte, Astro, HTML).
- `/wcag:audit:dynamic <url>` - Playwright + axe-core against a live site.
- `/wcag:audit <path> --url <url>` - full pipeline, both paths merged.
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
├── core/             shared types, WCAG 2.2 catalog, scoring
├── static-analyzer/  five specialists + orchestrator + source loader
├── dynamic-tester/   Playwright + axe-core + keyboard-flow + focus-visibility
├── reporter/         dev + exec markdown generators
└── cli/              wcag-toolkit binary
.claude/
├── agents/           12 agents (2 leads + 5 static + 3 dynamic + 2 report)
├── skills/           wcag-static-analyze, wcag-dynamic-test, wcag-report
└── commands/         /wcag:audit[:static|:dynamic], /wcag:report, /wcag:init
examples/
├── demo-site/        HTML fixture
└── react-basic/      JSX fixture
docs/
├── ARCHITECTURE.md
├── CONTRIBUTING.md
├── WCAG-COVERAGE.md
└── sprints/          per-release retrospective reports
```

## Versioning

| Version | Scope | Status |
|---------|-------|--------|
| v0.1 | Static analysis (TS + AI agents) | Released |
| **v0.2** | + Dynamic (Playwright + axe-core) + reports | **This release - last public.** |
| v0.3 | Self-fix SDET agent (AST patching + verifier loop) | Private; commercial offering |
| v0.4+ | Multi-runtime AI agents (OpenCode, API, local LLM) | Planned |

## Commercial engagement

v0.2.0 is the **last public release**. The next step - an agent that
takes an audit and produces accessible code (AST patches, PRs, verifier
loop against the same audit pipeline) - is delivered as a service, not
an open-source release. It runs the full audit + fix cycle against
production codebases, integrated with the client's CI and issue tracker.

If you're auditing or building a product at scale and want the remediation
loop on top of what this repo provides, get in touch via **sdet.it/services**.

| What's public (this repo) | What's commercial |
|---------------------------|-------------------|
| Static source analysis | Auto-fix (AST patches) |
| Dynamic browser testing | Verifier loop (re-audit after each fix) |
| Dev + exec reports | Multi-tenant dashboard |
| Claude Code integration | Jira / Linear integration |
| AGPL-3.0 license | Commercial license |

## License

AGPL-3.0-or-later - see [LICENSE](./LICENSE).

If AGPL is a blocker for your deployment, commercial licensing is
available on request.
