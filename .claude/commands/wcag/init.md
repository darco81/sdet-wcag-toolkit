---
description: Copy the sdet-wcag-toolkit Claude Code agents/skills/commands into this project's .claude/
argument-hint: [target-path]
---

Install the WCAG toolkit agents, skills, and commands into the target
project so Claude Code picks them up automatically. Target path: $ARGUMENTS
(defaults to the current working directory if empty).

Run this from a cloned sdet-wcag-toolkit repo:

```bash
pnpm -r build
node packages/cli/dist/bin/wcag-toolkit.js init $ARGUMENTS
```

Report back to the user:
- How many files were copied.
- Which files were skipped (already exist).
- The three next steps: commit `.claude/`, open the project in Claude Code,
  run `/wcag:audit:static`.

Do not overwrite existing files unless the user passed `--force`.
