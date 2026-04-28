# Screenshots

Source images for marketing materials, blog posts, and case studies.
All anonymized - no client data, no real production URLs. Targets
limited to `examples/` fixtures or fully-redacted personal projects.

## Files (TODO: capture)

- `exec-summary-example.png` - `exec-summary.md` rendering for
  `examples/react-basic` (showing Score · Grade band + per-severity
  breakdown).
- `dev-report-snippet.png` - top of `dev-report.md` showing the
  `Score · Grade · Findings` header + first 2-3 prioritized findings
  with WCAG SC refs.
- `grade-band-rendering.png` - close-up of the A-F grade band as it
  appears in the terminal CLI summary (post-`wcag-toolkit audit`).
- `cli-help-output.png` - `wcag-toolkit --help` output showing
  `audit` and `report` commands with the `--use-ai` flag visible.
- `skill-flow-output.png` - `/wcag:audit <path>` invocation in a CC
  session with the 5-specialist parallel dispatch + final score block.

## How to regenerate

1. Run an audit on `examples/react-basic` (deterministic source of
   truth - 14 seeded WCAG issues + 5 valid extras).
2. Open generated reports in a markdown preview (VS Code or
   `glow`) or run the CLI inside a terminal with a clean theme.
3. Screenshot the relevant section. Aim for ~1200-1600px wide so
   the image stays sharp in blog posts and social cards.
4. Anonymize if anything beyond `examples/` paths is visible (no
   real project names, no `~/Users/...` home paths).
5. Save as PNG with the descriptive filename listed above.
6. Commit with message `docs(screenshots): <description>`.

## Why this directory exists

Public marketing assets need a stable source of truth. Re-running
the audit on a moving target (a real client project) gives different
numbers each release; `examples/react-basic` is frozen so the
screenshots stay valid across patch releases. Re-capture only when
the report layout itself changes (e.g. new severity column, new
grade-band rendering).
