# sdet-wcag-toolkit

WCAG 2.2 AA accessibility toolkit for modern web applications.

> **Status:** v0.1.1 - static analysis with two complementary paths
> (deterministic TS analyzer + AI specialist agents). Dynamic testing
> lands in v0.2.

## Two analysis paths

- **AI specialist agents (main path).** Four agents dispatched by
  `wcag-lead` read your source (JSX, Vue SFC, Angular templates,
  Svelte, Astro, HTML) with `Read` / `Grep` / `Glob` and find WCAG
  issues framework-aware. Use inside Claude Code.
- **Deterministic TypeScript analyzer.** The `wcag-toolkit audit` CLI
  parses plain HTML and CSS with rule-based checks. Use for CI, or for
  a project's built output. Zero LLM calls.

Both emit the same `WcagFinding` shape. You can run either or both and
merge the findings.

## What gets checked (WCAG 2.2 A/AA)

- **Semantic structure** - title, landmarks, heading order, lists, tables,
  image alt text, `html[lang]`.
- **ARIA patterns** - invalid roles, missing required state attributes,
  dangling `aria-labelledby` / `aria-describedby`, `aria-hidden` on
  focusable elements, redundant roles.
- **Keyboard interaction** - positive `tabindex`, interactive roles on
  non-focusable elements, click handlers without a keyboard equivalent.
- **Color contrast** - CSS rules and inline styles where both foreground
  and background are statically resolvable.

It skips things it can't honestly answer statically (runtime focus order,
hover-state contrast, `var(--…)` token resolution the AI path cannot
resolve either). Those are the target of v0.2 dynamic testing with
Playwright + axe-core.

## Install and run

```bash
git clone https://github.com/darco81/sdet-wcag-toolkit.git
cd sdet-wcag-toolkit
pnpm install
pnpm -r build

# Run the audit
node packages/cli/dist/bin/wcag-toolkit.js audit examples/demo-site

# JSON output for pipelines
node packages/cli/dist/bin/wcag-toolkit.js audit examples/demo-site --json > findings.json

# Show more findings in the console
node packages/cli/dist/bin/wcag-toolkit.js audit ./src --top 25
```

CI-friendly: the process exits non-zero when any Critical or Serious
finding is present.

## Demo

`examples/demo-site/` contains a small static site with 15 intentional
violations spanning all four analyzers. Use it to smoke-test changes or
to see what the output looks like without bringing your own project.

## Claude Code integration

If you use [Claude Code](https://docs.claude.com/en/docs/agents-and-tools/claude-code/overview):

- `/wcag:audit:static <path>` - orchestrates the audit through `wcag-lead`
  and four specialist sub-agents. Each one reads source and reasons about
  it; the lead merges the findings and shows you a prioritized report.
- `/wcag:init <path>` - copy the agents, skills, and commands into another
  project's `.claude/` directory (or use `wcag-toolkit init <path>` from
  the CLI).
- Everything Claude Code needs lives under `.claude/` and loads automatically.

## Monorepo layout

```
packages/
├── core/             shared types, WCAG 2.2 catalog, scoring
├── static-analyzer/  four analyzers + orchestrator + source loader
└── cli/              wcag-toolkit binary
examples/
└── demo-site/        fixture with intentional violations
.claude/
├── agents/           5 agents (lead + 4 specialists)
├── skills/           wcag-static-analyze
└── commands/         /wcag:audit:static
docs/
├── ARCHITECTURE.md
├── CONTRIBUTING.md
└── sprints/
```

## Versioning

- `v0.1` - static analysis (this release).
- `v0.2` - static + dynamic (Playwright + axe-core) + markdown reports.
  **Planned last public release.**
- `v0.3+` - self-fix SDET agent with AST patching. Private; available as
  a commercial engagement.

## License

AGPL-3.0-or-later - see [LICENSE](./LICENSE).

If you need a different license (commercial, proprietary integration), get
in touch.
