---
name: wcag-static-analyze
description: Run a static WCAG 2.2 AA audit on a project. Combines two paths - AI specialist agents that read source code (JSX, Vue, Angular, Svelte, HTML) and the deterministic TypeScript analyzer that scans HTML+CSS. Use when the user asks for an accessibility check, "audit a11y", "run WCAG", "check accessibility", or explicitly invokes /wcag:audit:static.
---

This skill runs the static WCAG 2.2 AA audit pipeline and reports the
findings. It wraps two analysis paths and lets the user choose - or run
both - depending on what they're auditing.

## When to use

- The user asks to audit / check / review accessibility on a codebase.
- The user runs `/wcag:audit:static <path>`.
- Before a release, as part of a quality gate.

Do **not** use this skill for:
- Remediation / fixing issues (that is the v0.3 `wcag-fix` skill, private).
- Dynamic testing in a browser (that is the v0.2 `wcag-dynamic-test` skill).

## Two paths, pick intelligently

### Path A - TypeScript analyzer (deterministic, HTML + CSS only)

Best for:
- CI gates (zero tokens, zero LLM calls, deterministic exit code)
- Built output of a framework app (`dist/`, `build/`, `.next/out/`)
- Plain static sites

```bash
node packages/cli/dist/bin/wcag-toolkit.js audit <path> --json
```

### Path B - AI specialist agents (source-level, any framework)

Best for:
- Application source code with JSX, Vue SFCs, Angular templates, Svelte,
  Astro - anything the TS analyzer cannot parse
- Framework-idiomatic issues (Next.js `layout.tsx`, Vue `useHead`, Angular
  routing titles)
- Tailwind / design-token resolution where the TS analyzer would skip

The lead agent `wcag-lead` dispatches four specialists via the `Task` tool:
- `semantic-structure-agent`
- `aria-patterns-agent`
- `keyboard-interaction-agent`
- `color-contrast-static-agent`

Each reads source with `Read` / `Grep` / `Glob` and returns WcagFinding JSON.
The lead merges, scores, and produces the user-facing report.

## How to orchestrate the skill

1. **Resolve target.** The path argument or the current workspace root.
2. **Detect what's there.** Check for `package.json`, framework deps, and
   a built-output directory. That decides which paths to run.
3. **Run Path A** if HTML/CSS or a built output exists:
   ```bash
   pnpm -r build   # only if packages/cli/dist is missing
   node packages/cli/dist/bin/wcag-toolkit.js audit <path> --json > /tmp/wcag-static.json
   ```
4. **Run Path B** by dispatching `wcag-lead` via the Task tool. Pass the
   target path and the detected frameworks. Let `wcag-lead` spawn its own
   sub-agents in parallel.
5. **Merge findings** (Path A JSON + Path B JSON), deduplicate by
   (ruleId + file + line), sort by priority.
6. **Present the report** in the format `wcag-lead` produces.
7. **Exit code.** If any Critical or Serious finding is present, warn the
   user and suggest fixing before deploy.

## Installation into other projects

If the user runs `/wcag:audit:static` inside a project that does not have
`.claude/` yet, run:

```bash
node <path-to-this-repo>/packages/cli/dist/bin/wcag-toolkit.js init <target-project>
```

Or invoke the `/wcag:init` command from this skill's parent repo.

## Scope reminders

- WCAG 2.2 A + AA only. AAA is not tracked.
- Static findings only - anything requiring a running browser (focus traps,
  hover contrast, live regions) is deferred to v0.2 dynamic tester.
- Four specialists: semantic, aria, keyboard, contrast. No forms specialist
  in v0.1 - planned for v0.2.
