---
name: wcag-static-analyze
description: Run a static WCAG 2.2 AA audit on a directory of HTML and CSS source. Use when the user asks for an accessibility check, "audit a11y", "run WCAG", "check accessibility", or explicitly invokes /wcag:audit:static. Only covers static analysis - dynamic browser testing is a separate skill (v0.2+).
---

This skill runs the static WCAG 2.2 AA audit pipeline and reports the
findings. It wraps the `wcag-toolkit` CLI and the `wcag-lead` agent.

## When to use

- The user asks to audit / check / review accessibility.
- The user runs `/wcag:audit:static <path>`.
- Before a release, as part of a quality gate.

Do **not** use this skill for:
- Remediation / fixing issues (that is the v0.3 `wcag-fix` skill, not public).
- Dynamic testing in a browser (that is the v0.2 `wcag-dynamic-test` skill).

## How to run

1. Resolve the target path from the user's prompt. Default to the current
   workspace root if unspecified.
2. Ensure the toolkit is built:
   ```bash
   pnpm -r build
   ```
3. Run the CLI with JSON output so the result can be piped into the lead agent:
   ```bash
   node packages/cli/dist/bin/wcag-toolkit.js audit <path> --json > /tmp/wcag-findings.json
   ```
4. Dispatch `wcag-lead` with the findings file. The lead agent summarizes,
   prioritizes, and formats the user-facing report.
5. Show the user-facing report back to them. Exit with status 0 if the grade
   is A/B; warn if it is C/D/F.

## Output the user sees

```
## WCAG 2.2 AA audit: <target>

Grade: <A-F> - <N> findings (<critical>/<serious>/<moderate>/<minor>)

### Top findings
1. [SC x.y.z] <severity> - <file>:<line>
   <message>
   → <remediation>
2. …

### Takeaway
<one paragraph on where to start>
```

## Scope reminders

- WCAG 2.2 A + AA only. AAA is not tracked.
- Static findings only - anything requiring a running browser is deferred.
- Four analyzers: semantic, aria, keyboard, contrast. See per-agent docs
  for the rules each one checks.
