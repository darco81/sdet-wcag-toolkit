---
description: Generate a markdown report from a saved WCAG findings JSON
argument-hint: <findings.json> [--format dev|exec] [--output out.md]
---

Generate a markdown report from a previously-run audit.
Arguments: $ARGUMENTS

Use the `wcag-report` skill:

1. Validate that the `--from` file exists and is JSON.
2. Pick the format:
   - `--format dev` (default) → dispatch `dev-report-agent`
   - `--format exec` → dispatch `exec-summary-agent`
3. Pass through `--output`, `--title`, and (for exec) `--target`.
4. After the agent reports back, show the user:
   - Output file path (if written to disk)
   - Grade and top-3 finding headlines
   - Suggestion: commit or share the report

Do not re-run the audit - this command only formats existing findings.
