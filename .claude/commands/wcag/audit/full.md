---
description: Run the full WCAG 2.2 AA audit - static + dynamic - and merge findings
argument-hint: <path> --url <url>
---

Run the full audit pipeline against both source and the rendered site.
Arguments: $ARGUMENTS (e.g. `./src --url https://staging.example.com`).

1. Parse `$ARGUMENTS` into a path and a URL. Both are required for this
   command; error out if one is missing (suggest the single-mode
   commands `/wcag:audit:static` or `/wcag:audit:dynamic`).
2. Build the toolkit if needed.
3. Run the CLI in combined mode:
   ```bash
   node packages/cli/dist/bin/wcag-toolkit.js audit <path> --url <url> --json > /tmp/wcag-findings.json
   ```
4. Dispatch `wcag-lead` (for the static slice) and `wcag-dynamic-lead`
   (for the dynamic slice) in parallel via Task. Each returns its own
   narrative.
5. Merge the two narratives and produce a single report.

The CLI already dedupes findings by id across paths, so the two leads
read the same JSON and attribute findings by `source === "static"` vs
`source === "dynamic"`.
