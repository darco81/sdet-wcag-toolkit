---
name: wcag-toolkit-lead
description: |
  WCAG toolkit orchestrator — front door for all sdet-wcag-toolkit operations.
  Routes between 5 specialist skills (wcag-audit, wcag-static-analyze,
  wcag-dynamic-test, wcag-fix, wcag-report) based on what the user asks.
  Triggers: "audit accessibility", "WCAG audit", "run WCAG", "audyt
  dostępności", "sprawdź dostępność", "fix WCAG findings", "napraw a11y",
  "report from audit", "wygeneruj raport WCAG", "test WCAG na URL",
  "static WCAG check", "/wcag", "/wcag:audit". Do NOT use for component-level
  Vue/Nuxt audits in Crehler projects (use a11y-audit / a11y-orchestrator
  instead — that's the FFCSS-aware sibling).
---

# WCAG toolkit — lead

Front door for the **sdet-wcag-toolkit** ecosystem. Don't run sub-skills
directly — let this skill route based on the user's intent.

## Routing matrix

| User says / intent | Route to | Why |
|---|---|---|
| "full audit", "audit my site", "/wcag:audit", grade me | `wcag-audit` | Full pipeline: 5 AI specialists + static + dynamic, returns A-F grade |
| "static check", "scan code only", "/wcag:audit:static <path>" | `wcag-static-analyze` | Codebase-only — no browser, no URL |
| "test on URL", "audit staging", "audit https://...", "/wcag:audit:dynamic" | `wcag-dynamic-test` | Browser + axe-core + keyboard runner |
| "fix findings", "auto-fix WCAG", "remediate", "/wcag:fix" | `wcag-fix` | Applies fixes (Pro tier) or shows manual steps |
| "write the report", "exec summary", "generate report from findings.json" | `wcag-report` | Markdown report from existing findings JSON |

## Decision rules

1. **URL provided** → `wcag-dynamic-test`. Even if user says just "audit", the URL signals dynamic.
2. **Path to local repo** → `wcag-static-analyze` for fast scan, OR `wcag-audit` if user wants the full graded pipeline (mentions grade/score/release gate).
3. **`findings.json` exists in cwd / user mentions existing audit** → likely `wcag-fix` or `wcag-report`. Ask "do you want to fix or report?".
4. **Ambiguous "audit"** → default to `wcag-audit` (full pipeline). It's the most common ask and the others are subsets.

## When NOT to use this lead

- User is in a Crehler enterprise project (FFCSS, Shopware Frontends, Vue 3/Nuxt e-commerce) — use `a11y-audit` / `a11y-orchestrator` instead. That ecosystem has its own a11y stack with FFCSS conventions.
- User asks about contrast on a single token / color pair — that's `contrast-checker` agent territory, not toolkit.

## Pipeline composition (when the user wants more than one step)

Common chains the lead should suggest:

- **Audit → Fix → Report**: `wcag-audit` → save findings JSON → `wcag-fix` → `wcag-report` (final markdown)
- **Static + Dynamic**: run both, then merge — `wcag-audit` does this natively
- **Pre-release gate**: `wcag-audit` with `--fail-below B` (CI mode)

If the user describes a multi-step flow, dispatch the first skill, then propose the next step at the end.
