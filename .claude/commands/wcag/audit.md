---
description: Run the v0.3 audit (static + 5 AI specialists + optional dynamic) and produce a graded report
argument-hint: <path> [--url <url>]
---

Run the full v0.3 WCAG 2.2 AA audit on `$ARGUMENTS`. Steps:

1. Parse `$ARGUMENTS` - first positional is the source path; optional
   `--url <url>` adds the dynamic axe slice. Reject if the path is
   missing.
2. Build the toolkit if `packages/cli/dist/` is empty:
   ```bash
   pnpm install && pnpm -r build
   ```
3. Invoke the CLI with `--use-ai` so the Lead orchestrator dispatches
   the 5 specialists:
   ```bash
   node packages/cli/dist/bin/wcag-toolkit.js audit <path> [--url <url>] --use-ai --json > /tmp/wcag-audit-findings.json
   ```
4. Read `/tmp/wcag-audit-findings.json` and present:
   - **Score** (0-100) and **Grade** (A-F)
   - Severity breakdown
   - Top 5-10 findings (ruleId, location, severity)
5. End with the next-step recommendation (manual fix vs Pro auto-fix).

If `--use-ai` fails (no Task tool / outside CC), fall back to the
static + dynamic flow without `--use-ai` and report the partial
result.

This command delegates the audit logic to the `wcag-audit` skill,
which contains the full orchestration and fallback rules.
