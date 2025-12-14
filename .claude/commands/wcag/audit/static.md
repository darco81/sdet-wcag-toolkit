---
description: Run the static WCAG 2.2 AA audit on a path
argument-hint: <path>
---

Run the static WCAG 2.2 AA audit on the path: $ARGUMENTS

Use the `wcag-static-analyze` skill to orchestrate the audit:

1. Verify the target path exists. If `$ARGUMENTS` is empty, default to the
   current working directory.
2. Build the toolkit (`pnpm -r build`) if `packages/cli/dist` is missing.
3. Invoke the CLI with `--json` and feed the results to `wcag-lead`.
4. Present the grade, top findings, and takeaway to the user.

Do not fix anything - this is an audit-only command. Remediation lives in a
separate v0.3 command that is not part of this repo.
