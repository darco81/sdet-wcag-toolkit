# Architecture

> Status: draft. Will expand as packages land.

## Shape

`sdet-wcag-toolkit` is a pnpm monorepo. Each package has a single
responsibility and its own semver, so they can be published and consumed
independently.

```
packages/
├── core/               shared types, WCAG catalog, scoring
├── static-analyzer/    AST/CSS analysis of source code
├── dynamic-tester/     Playwright + axe-core browser checks (v0.2+)
├── reporter/           markdown / JSON report generation (v0.2+)
└── cli/                wcag-toolkit entry point
```

## Data flow

```
source code + optional URL
        │
        ▼
┌──────────────────────┐     ┌──────────────────────┐
│ static-analyzer      │     │ dynamic-tester       │
│  - semantic          │     │  - axe-runner        │
│  - aria              │     │  - keyboard-flow     │
│  - keyboard          │     │  - focus-visibility  │
│  - contrast          │     │                      │
└─────────┬────────────┘     └──────────┬───────────┘
          │                             │
          └──────────────┬──────────────┘
                         ▼
                WcagFinding[] (core types)
                         │
                         ▼
                   reporter
                         │
                         ▼
              markdown / JSON / exec summary
```

All analyzers emit the same `WcagFinding` shape, so merging static + dynamic
findings is a simple concat + dedupe by `(successCriterion, location)`.
