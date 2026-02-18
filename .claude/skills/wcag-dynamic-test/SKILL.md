---
name: wcag-dynamic-test
description: Run a browser-based WCAG 2.2 AA audit against a URL using Playwright + axe-core, plus keyboard-flow and focus-visibility runners. Use when the user asks for a dynamic check ("audit the staging site", "run WCAG on https://..."), or invokes /wcag:audit:dynamic.
---

This skill drives the dynamic audit pipeline. It's the runtime
counterpart to `wcag-static-analyze`.

## When to use

- The user provides a URL.
- The user asks to audit a running site, staging environment, or
  production page.
- The user explicitly runs `/wcag:audit:dynamic <url>`.

## How to run

1. Validate the URL. Reject bare `localhost:3000` (missing scheme);
   accept full URLs with `http://` or `https://`.
2. Ensure the toolkit is built:
   ```bash
   pnpm -r build
   ```
3. Run the CLI:
   ```bash
   node packages/cli/dist/bin/wcag-toolkit.js audit \
     --url <url> \
     --json > /tmp/wcag-dynamic-findings.json
   ```
   Pass `--wait-for <css-selector>` if the page is a heavy SPA whose
   DOM is not settled when `networkidle` resolves.
4. Dispatch `wcag-dynamic-lead` to interpret the JSON and optionally
   spawn its three interpretation sub-agents (`axe-runner-agent`,
   `keyboard-flow-agent`, `focus-visibility-agent`).
5. Present the lead's markdown report.

## Runners active in dynamic mode

| Runner | What it catches |
|---|---|
| axe-core | Almost all rendered-DOM WCAG violations (colors, labels, landmarks, roles, contrast against computed styles) |
| keyboard-flow | Positive tabindex in the runtime DOM, keyboard traps, Escape-closes-dialog |
| focus-visibility | Missing focus indicator on keyboard-focused elements |

## Limits

- A single page per run. Multi-page crawls arrive in v0.3+.
- The audit is a snapshot - transient states (hover, open modals
  triggered only by user action) need manual setup via `--wait-for`.
- Authenticated pages require the browser to already have a session;
  v0.2 does not manage login flows.

## Output

Standard WCAG report (grade, top findings, by-runner breakdown,
takeaway) from `wcag-dynamic-lead`.
