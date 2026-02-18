---
description: Run a dynamic browser-based WCAG 2.2 AA audit against a URL
argument-hint: <url>
---

Run the dynamic audit against the URL: $ARGUMENTS

Use the `wcag-dynamic-test` skill to orchestrate:

1. Validate that `$ARGUMENTS` is a full URL with scheme (http/https).
   If it's missing, ask the user.
2. Build the toolkit (`pnpm -r build`) if `packages/cli/dist` is missing.
3. Invoke the CLI with `--url $ARGUMENTS --json` and feed the results to
   `wcag-dynamic-lead`.
4. Present the grade, top findings, and takeaway from the lead.

If the page is a heavy SPA and the audit returns few findings, retry
with `--wait-for <selector>` - ask the user for a selector that appears
only after hydration.

Do not fix anything; this is an audit-only command.
