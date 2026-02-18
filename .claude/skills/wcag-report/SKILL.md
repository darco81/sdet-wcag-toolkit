---
name: wcag-report
description: Generate a markdown report (developer long-form or executive one-pager) from a saved WCAG findings JSON file. Use when the user asks to produce a report, write up an audit, or invokes /wcag:report.
---

This skill produces the human-readable artifact from a previously-run
audit. It does not run the audit - for that, use `wcag-static-analyze`
or `wcag-dynamic-test`.

## When to use

- The user has a `findings.json` (from `wcag-toolkit audit --json`) and
  wants a markdown report.
- The user asks to "write up the audit", "generate a report", "make
  the exec summary".
- The user runs `/wcag:report <findings.json>`.

## Two formats

- **`dev`** (default): long-form markdown for engineers. Severity table,
  top-N priority list, findings grouped by WCAG principle with SC refs,
  rationale, remediation, code snippets.
- **`exec`**: one-page markdown for non-tech stakeholders. Headline
  grade, user-impact phrasing, EAA legal context, next-step
  recommendation. Hard-capped at 60 lines.

## How to run

Dispatch `dev-report-agent` or `exec-summary-agent` depending on the
requested format. Each agent wraps the CLI:

```bash
node packages/cli/dist/bin/wcag-toolkit.js report \
  --from <findings.json> \
  --format dev|exec \
  --output <out.md> \
  [--title "..."] \
  [--target "product name"]    # exec format only
```

## Output location

- If `--output` is given, the agent writes the file and reports the
  path.
- Otherwise, stream to stdout so the user sees it inline.

For a full audit cycle - run both formats:

```bash
wcag-toolkit report --from findings.json --format dev --output audit.md
wcag-toolkit report --from findings.json --format exec --target "MyApp" --output audit-summary.md
```
