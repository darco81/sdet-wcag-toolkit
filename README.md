# sdet-wcag-toolkit

WCAG 2.2 AA accessibility toolkit for modern web applications.

> **Status:** v0.1.0 - static analysis. Dynamic testing and reporting land
> in v0.2.

## What it does today

Audits a directory of HTML and CSS source against WCAG 2.2 Level A and AA,
across four analyzers:

- **Semantic structure** - title, landmarks, heading order, lists, tables,
  image alt text, `html[lang]`.
- **ARIA patterns** - invalid roles, missing required state attributes,
  dangling `aria-labelledby` / `aria-describedby`, `aria-hidden` on
  focusable elements, redundant roles.
- **Keyboard interaction** - positive `tabindex`, interactive roles on
  non-focusable elements, click handlers without a keyboard equivalent.
- **Color contrast** - CSS rules and inline styles where both foreground
  and background are statically resolvable.

It skips things it can't honestly answer statically (JSX semantics,
runtime focus order, `var(--…)` token resolution). Those are the target of
v0.2 dynamic testing with Playwright + axe-core.

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
  and four specialist agents, and shows you a summarized report.
- Skills and agents live under `.claude/` and are loaded automatically.

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
