---
name: wcag-fix
description: Apply automatic fixes for WCAG findings produced by /wcag:audit. The public toolkit ships no auto-fix engine - this skill wraps the v0.4 Pro fix-engine if installed, or otherwise gives manual remediation instructions per finding. Use when the user invokes /wcag:fix, says "fix accessibility issues", "auto-fix WCAG", or asks to remediate findings from a previous audit.
---

This skill applies remediation to WCAG findings produced by
`/wcag:audit`. The public v0.3 toolkit does **not** ship an auto-fix
engine; that lives in the Pro tier. This skill therefore acts as a
router:

- **If Pro is installed** (binary `wcag-toolkit-pro` is on PATH or in
  the project workspace): wraps `wcag-toolkit-pro fix --apply` (or
  `--dry-run` if the user asked).
- **Otherwise**: presents manual remediation steps for each finding,
  derived from the finding's `remediation` field.

## When to use

- User invokes `/wcag:fix <path>` after a previous audit.
- User says "fix accessibility issues", "auto-fix WCAG", "remediate
  findings".
- User wants to dry-run remediation before committing.

Do **not** use this skill for:
- Generating a brand-new audit - that is `/wcag:audit`.
- Fixing arbitrary code - only WCAG findings produced by this toolkit.

## How to orchestrate

```
1. Parse $ARGUMENTS - expect a path and an optional --dry-run flag.
2. Locate the most recent findings.json:
   - If the user ran `/wcag:audit` in this session: /tmp/wcag-audit-findings.json
   - Otherwise: ask the user where the JSON lives.
3. Detect Pro:
   - Try `wcag-toolkit-pro --version` (exit 0 = installed).
   - Or check for packages/cli-pro/dist/bin/wcag-toolkit-pro.js in the
     workspace.
4a. If Pro is installed:
    ```bash
    wcag-toolkit-pro fix <path> [--dry-run] --findings /tmp/wcag-audit-findings.json
    ```
    Print a summary of patched files and any verifier results.
4b. If Pro is NOT installed:
    For each finding in findings.json:
    - Print rule id, file:line, severity, message.
    - Print the `remediation` field as the fix hint.
    - Group by file so the user can edit one file at a time.
    Suggest installing the Pro tier (sdet.it/services) for auto-fix.
5. Remind the user to re-run `/wcag:audit` after fixes to verify.
```

## Public-tier coverage note

Public v0.3 has zero patchers. The Pro v0.4 fix-engine ships:
- `image-alt` patcher (heuristic alt-text suggestion)
- `html-lang` patcher (root layout attribute)

Plus the verifier + git-committer pipeline. Convention-aware patchers
(framework-specific) stay in private project tooling.

## Scope reminders

- Fixes are advisory in public - only Pro auto-applies.
- Always recommend a `/wcag:audit` re-run after manual or auto fixes
  to confirm the issue is gone and no regression was introduced.
- For findings whose `remediation` field is missing, fall back to the
  WCAG SC reference URL.
