---
name: wcag-audit
description: Run a WCAG 2.2 AA audit using v0.3 - 5 AI specialist agents (dispatched via Task tool from this session) + static TypeScript analyzer + optional dynamic axe-core. Returns findings, A-F grade, and 0-100 score. Use when the user invokes /wcag:audit, says "audit accessibility", "WCAG audit", "run WCAG", or asks to grade a site.
---

This skill runs the v0.3 audit pipeline. CC dispatches the 5 AI
specialists directly through the Task tool (this session). Static
and dynamic analysis run separately via the CLI (Node subprocess).
Findings merge, dedupe, score, and grade.

## When to use

- User invokes `/wcag:audit <path>` or `/wcag:audit <path> --url <url>`.
- User says "audit accessibility", "run WCAG", "grade my site for WCAG".
- Pre-release quality gate, with a graded executive summary.

Use the v0.2 `wcag-static-analyze` skill instead if the user explicitly
asks for the deterministic-only path (CI gate, no LLM, no Task tool).

## What it does

The audit has three parallel sources:

1. **AI specialists (5 agents, dispatched via Task tool from this session):**
   - `semantic-structure-agent`
   - `aria-patterns-agent`
   - `keyboard-interaction-agent`
   - `color-contrast-static-agent`
   - `forms-accessibility-agent`

2. **Static TypeScript analyzer (via CLI subprocess):**
   - HTML/CSS pattern matching (img-alt, html-lang, landmarks)
   - Always runs alongside AI agents, deterministic

3. **Dynamic Playwright + axe-core (via CLI subprocess, if --url provided):**
   - Runtime DOM checks (computed contrast, focus visibility, keyboard flow)

Findings from all three sources merge and dedupe by `(ruleId, file, line, url)`.
Score is severity-weighted (critical -15, serious -10, moderate -5, minor -2;
floored at 0). Grade band: A 90+, B 75-89, C 50-74, D 25-49, F <25.

## How to orchestrate

### Step 1: Resolve target

Parse `$ARGUMENTS`:
- First positional → `<path>` (default: cwd if running inside target repo)
- `--url <url>` → optional dynamic target
- If neither path nor url → ask user which to audit

### Step 2: Verify build artifacts

If `packages/cli/dist/bin/wcag-toolkit.js` is missing:

```bash
cd <path-to-sdet-wcag-toolkit>
pnpm install && pnpm -r build
```

### Step 3: Dispatch 5 AI specialists in parallel (via Task tool, from this session)

Use the Task tool DIRECTLY from this CC session. Send a SINGLE message
with 5 parallel Task calls - they run in parallel and you collect all
results before continuing.

For each specialist, the Task call shape is:

```
Task({
  subagent_type: "<agent-id>",
  description: "WCAG audit: <agent-id>",
  prompt: "Audit the WCAG 2.2 AA <scope> issues in <path>. Read source files using Read/Grep/Glob. Return findings as JSON array per the WcagFinding schema (id, ruleId, severity, wcagSC, file, line, snippet, message)."
})
```

Five invocations, parameters per agent:

| subagent_type | scope phrase |
|---|---|
| semantic-structure-agent | semantic structure |
| aria-patterns-agent | ARIA pattern misuse |
| keyboard-interaction-agent | keyboard interaction |
| color-contrast-static-agent | color contrast (static, in source CSS) |
| forms-accessibility-agent | forms accessibility |

Send all 5 Task calls in a single message (parallel dispatch).

For each Task response:
- Extract JSON block from text (in ` ```json ... ``` ` fence, or raw array)
- If parse fails or response is empty, log warning, continue with others
- Collect successful findings into a list
- Track failed agents separately for the final report (do not block - partial
  results are still useful)

### Step 4: Run static analyzer (via CLI subprocess)

```bash
node packages/cli/dist/bin/wcag-toolkit.js audit <path> --json > /tmp/wcag-static.json
```

This runs deterministic HTML/CSS analysis. **DO NOT pass `--use-ai` flag**
- AI was already dispatched directly in Step 3. Passing `--use-ai` here
would re-attempt Task lookup inside Node subprocess, where Task is
unavailable, and silently fail.

Parse `/tmp/wcag-static.json` (JSON array), add findings to the running list.

### Step 5: Run dynamic tester (only if --url provided)

```bash
node packages/cli/dist/bin/wcag-toolkit.js audit --url <url> --json > /tmp/wcag-dynamic.json
```

Parse JSON output, add findings to the list.

### Step 6: Merge, dedupe, score, grade

- Dedupe by `(ruleId, file, line, url)` - same key = same finding, keep first
- Sort by severity priority (critical → serious → moderate → minor)
- Score: 100 - (critical × 15) - (serious × 10) - (moderate × 5) - (minor × 2),
  floored at 0
- Grade band: A 90+, B 75-89, C 50-74, D 25-49, F <25

### Step 7: Present report

Format Top-N findings (default 5-10) in a concise table:
- Rule ID
- WCAG SC reference
- Severity
- Location (file:line, or selector for dynamic)

Followed by:
- Severity breakdown table (critical / serious / moderate / minor)
- Score and grade
- Top 3 priority recommendations

If any agent failed in Step 3, mention it briefly:
"N agent(s) returned errors - results from M specialists + static + dynamic."

Don't block on agent errors - partial results are still useful.

### Step 8: Save findings JSON for downstream tools

Write merged findings to `/tmp/wcag-audit-findings.json` (JSON array).
Subsequent `/wcag:fix` calls can read this file.

## Outside-of-CC fallback

If user runs CLI directly outside CC session (e.g. CI):

```bash
node packages/cli/dist/bin/wcag-toolkit.js audit <path> --json
```

This skips AI specialists (no Task tool available), runs static + dynamic
only (~60% of v0.3 capability). For full AI tier, invoke this skill from
within a Claude Code session.

## Architecture note

The 5 AI specialists are dispatched DIRECTLY via the Task tool from the
CC session running this skill. We do NOT call `--use-ai` on the CLI
subprocess - that flag re-attempts Task lookup inside Node subprocess
where `globalThis.Task` is unavailable, causing silent agent failures
and a fall-through to static + dynamic only. Bash subprocess is used
here only for static and dynamic analysis (which do not need Task).

## Scope reminders

- WCAG 2.2 Level AA only. AAA is not tracked.
- 5 specialists in public toolkit. Pro tier adds modal-specialist,
  ecommerce-journey, and multi-runtime support.
- Dedupe is simple (ruleId + file:line + url). Pro tier adds deep
  semantic dedupe.
- No auto-fix in public - see `/wcag:fix` skill for the Pro tier
  wrapper or manual remediation guidance.
