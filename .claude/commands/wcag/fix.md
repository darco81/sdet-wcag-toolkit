---
description: Apply automatic or guided fixes to WCAG findings produced by /wcag:audit
argument-hint: <path> [--dry-run]
---

Apply remediation to WCAG findings produced by a previous `/wcag:audit`
run. The public toolkit has no auto-fix engine; this command routes to
the Pro tier if installed, or presents manual remediation steps
otherwise.

Steps:

1. Locate the most recent findings JSON. If `/wcag:audit` was just run
   in this session, `/tmp/wcag-audit-findings.json` is the default;
   otherwise ask the user.
2. Detect Pro: try `wcag-toolkit-pro --version`. If installed:
   ```bash
   wcag-toolkit-pro fix $ARGUMENTS --findings /tmp/wcag-audit-findings.json
   ```
3. If Pro is **not** installed: read the JSON, group findings by file,
   and print each finding's rule id, location, severity, and
   `remediation` field as a guided fix list. Suggest the user inspect
   the Pro tier (sdet.it/services) for auto-fix.
4. Remind the user to re-run `/wcag:audit` after fixes to verify.

This command delegates to the `wcag-fix` skill, which has the full
detection + remediation logic.
