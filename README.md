# sdet-wcag-toolkit

WCAG 2.2 AA accessibility toolkit for modern web applications.

> **Status:** v0.3.0 - **5 AI specialists, Lead orchestrator, A-F
> grade.** Static + AI source-reading + dynamic analysis, markdown
> reports with score, Claude Code integration. Self-fix engine and
> multi-runtime support are commercial offerings (Pro tier); see
> "Commercial engagement" below.

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
├── core/                 shared types, WCAG 2.2 catalog, scoring
├── static-analyzer/      TS rule analyzer + orchestrator + source loader
├── dynamic-tester/       Playwright + axe-core + keyboard-flow + focus-visibility
├── reporter/             dev + exec markdown generators
├── runtime-core/         RuntimeAdapter contract + parser + HardGuard + 5 prompts
├── runtime-claude-code/  CC adapter via the native Task tool
├── orchestrator/         Lead orchestrator that dispatches 5 specialists
└── cli/                  wcag-toolkit binary (with --use-ai flag)
.claude/
├── agents/               12 agents (2 leads + 5 static + 3 dynamic + 2 report)
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
| **v0.3** | + 5 AI specialists, Lead orchestrator, A-F grade, --use-ai | **This release.** |
| Pro v0.4+ | + modal-specialist, ecommerce-journey, multi-runtime, auto-fix | Private; commercial |

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

| What's public (this repo, v0.3) | What's commercial (Pro v0.4+) |
|---------------------------------|-------------------------------|
| 5 specialist agents (CC-only) | + modal + ecommerce specialists |
| Lead orchestrator + grading | + deep dedupe, three-mode audit |
| Static + dynamic + AI source-reading | + multi-runtime (OpenCode, Ollama) |
| Manual fix walkthrough via /wcag:fix | + AST auto-fix + verifier + PR |
| AGPL-3.0 license | Commercial license, on-prem option |

## License

AGPL-3.0-or-later - see [LICENSE](./LICENSE).

If AGPL is a blocker for your deployment, commercial licensing is
available on request.
