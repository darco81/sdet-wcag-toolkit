# react-basic

A minimal React fixture seeded with WCAG 2.2 AA violations. It exists to
demonstrate the **three analysis paths** this toolkit offers:

## Try with --use-ai (v0.3 default)

In a Claude Code session, run the new graded audit:

```bash
node packages/cli/dist/bin/wcag-toolkit.js audit examples/react-basic --use-ai
```

This dispatches the 5 AI specialists in parallel through CC's Task
tool, merges with the deterministic TS analyzer, and prints a report
with **Score** (0-100) and **Grade** (A-F). On this fixture the
expected outcome is a low D / F because the seeded violations are
deliberately material.

## Path A - CLI on built output (deterministic)

The CLI (`wcag-toolkit audit`) analyzes plain HTML and CSS only. Run it
against `index.html` + `src/styles.css` to see what the TypeScript
analyzer can catch without running the app:

```bash
pnpm -r build
node packages/cli/dist/bin/wcag-toolkit.js audit examples/react-basic
```

Expected: roughly 5-8 findings, mostly CSS contrast on `styles.css` and
structural issues on `index.html`. The JSX files are loaded but not
analyzed on this path.

## Path B - AI agents on source (Model C, the main path)

In a Claude Code session with this repo open:

```
/wcag:audit:static examples/react-basic
```

The `wcag-lead` agent dispatches four specialists in parallel. Each
reads the JSX files with `Read` / `Grep` / `Glob` and reasons about
React semantics directly. Expected: 10-14 findings covering:

| # | File | Issue | SC |
|---|------|-------|------|
| 1 | `index.html` | No `<html lang="…">` | 3.1.1 |
| 2 | `index.html` | No `<title>` | 2.4.2 |
| 3 | `App.jsx` | No `<main>` landmark | 1.3.1 |
| 4 | `App.jsx` | `<ul>` contains a `<div>` child | 1.3.1 |
| 5 | `App.jsx` | Heading hierarchy skip (h1 → h3 in child) | 1.3.1 |
| 6 | `Hero.jsx` | `<img>` without `alt` | 1.1.1 |
| 7 | `Hero.jsx` | `<div onClick>` without keyboard handler | 2.1.1 |
| 8 | `Hero.jsx` | `tabIndex={1}` (positive value) | 2.4.3 |
| 9 | `ProductCard.jsx` | `<div role="button">` without `tabIndex` | 2.1.1 |
| 10 | `ProductCard.jsx` | `<button aria-hidden="true">` (focus on silent element) | 4.1.2 |
| 11 | `Checkout.jsx` | `<input>` without associated `<label>` | 3.3.2 |
| 12 | `Checkout.jsx` | `aria-describedby` references missing id | 4.1.2 |
| 13 | `Checkout.jsx` | Invalid ARIA role `"buton"` (typo) | 4.1.2 |
| 14 | `styles.css` | `.tagline` contrast ~2.1:1 | 1.4.3 |
| 15 | `styles.css` | `.price` contrast ~2.6:1 | 1.4.3 |
| 16 | `styles.css` | `.cta` white-on-yellow ~1.65:1 | 1.4.3 |

## Using it in your own project

```bash
node packages/cli/dist/bin/wcag-toolkit.js init /path/to/your-project
```

Commit the `.claude/` directory, then run `/wcag:audit:static` inside
Claude Code.
