---
name: wcag-audit
description: Run a WCAG 2.2 AA audit using the v0.3 Lead orchestrator with 5 AI specialist agents (semantic-structure, aria-patterns, keyboard-interaction, color-contrast-static, forms-accessibility). Combines source-reading AI agents with static TypeScript analyzer and optional dynamic axe-core. Returns findings, A-F grade, and 0-100 score. Use when the user invokes /wcag:audit, says "audit accessibility", "WCAG audit", "run WCAG", or asks to grade a site.
---

This skill runs the v0.3 audit pipeline - static TypeScript analyzer +
5 AI specialists (via Lead orchestrator) + optional dynamic axe-core -
and produces a graded report.

## When to use

- User invokes `/wcag:audit <path>` or `/wcag:audit <path> --url <url>`.
- User says "audit accessibility", "run WCAG", "grade my site for WCAG".
- Pre-release quality gate, with a graded executive summary.

Use the v0.2 `wcag-static-analyze` skill instead if the user explicitly
asks for the deterministic-only path (CI gate, no LLM, no Task tool).

## What it does

1. Detects the audit target - a path, a URL, or both - from
   `$ARGUMENTS` or the current workspace.
2. Builds the toolkit if `packages/cli/dist/` is missing.
3. Runs the CLI with `--use-ai`:
   ```bash
   node packages/cli/dist/bin/wcag-toolkit.js audit <path> [--url <url>] --use-ai --json > /tmp/wcag-audit-findings.json
   ```
   The `--use-ai` flag dispatches the Lead orchestrator, which fans
   out to 5 WCAG specialists in parallel via the Task tool:
   - `semantic-structure-agent`
   - `aria-patterns-agent`
   - `keyboard-interaction-agent`
   - `color-contrast-static-agent`
   - `forms-accessibility-agent`
4. Reads the resulting `findings.json` and presents:
   - **Score:** 0-100 (severity-weighted: critical -15, serious -10,
     moderate -5, minor -2; floored at 0)
   - **Grade:** A 90+, B 75-89, C 50-74, D 25-49, F <25
   - Top-N findings sorted by priority
   - Severity breakdown table

## How to orchestrate

```
1. Parse $ARGUMENTS - extract path (first positional) and --url (if present).
2. If neither is provided, ask the user which they want to audit.
3. Verify packages/cli/dist exists; if not, run `pnpm install && pnpm -r build`.
4. Run the CLI command above. Capture stdout JSON.
5. Read /tmp/wcag-audit-findings.json. If empty, say "Clean audit, Grade A".
6. Otherwise, summarize:
   - Top 5 findings (rule id, file:line, severity)
   - Score and grade
   - Severity breakdown
7. End with the next-step suggestion: fix the Top 1-3 manually or
   try the v0.4 Pro auto-fix engine (if installed).
```

## Outside-of-CC fallback

If the user runs `/wcag:audit` outside a Claude Code session (e.g. via
direct shell), `--use-ai` will fail with a clear error message. In
that case, drop `--use-ai` and run the static + dynamic pipeline only:

```bash
node packages/cli/dist/bin/wcag-toolkit.js audit <path> --json
```

The output won't include the 5 AI specialists, but static + dynamic
still cover ~60% of the v0.3 capability.

## Scope reminders

- WCAG 2.2 Level AA only. AAA is not tracked.
- 5 specialists in public toolkit. Pro tier adds modal-specialist,
  ecommerce-journey, and multi-runtime support.
- The Lead orchestrator's dedupe is simple (ruleId + file:line + url).
  Pro tier adds deep semantic dedupe.
- No auto-fix in public - see `/wcag:fix` skill for the Pro tier
  wrapper or manual remediation guidance.
