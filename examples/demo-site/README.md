# demo-site

A tiny static site deliberately seeded with WCAG 2.2 AA violations, used as
the end-to-end fixture for the static analyzer.

## How to run the audit

```bash
pnpm -r build
node packages/cli/dist/bin/wcag-toolkit.js audit examples/demo-site
```

Expected grade: **D** or **F**.

## Intentional issues

| # | File | Issue | SC |
|---|------|-------|------|
| 1 | `index.html` | No `lang` attribute on `<html>` | 3.1.1 |
| 2 | `index.html` | No `<title>` | 2.4.2 |
| 3 | `index.html` | No `<main>` landmark | 1.3.1 |
| 4 | `index.html` | Heading skip (`h1` → `h3`) | 1.3.1 |
| 5 | `index.html` | `<img>` without `alt` | 1.1.1 |
| 6 | `index.html` | `<ul>` contains a `<div>` child | 1.3.1 |
| 7 | `index.html` | `<div onclick>` without keyboard handler | 2.1.1 |
| 8 | `index.html` | `<button aria-hidden="true">` (focusable + hidden) | 4.1.2 |
| 9 | `index.html` | `<table>` without `<th>` or caption | 1.3.1 |
| 10 | `index.html` | Inline low-contrast footer text | 1.4.3 |
| 11 | `about.html` | Invalid role (`role="buton"`) | 4.1.2 |
| 12 | `about.html` | `aria-describedby` references missing id | 4.1.2 |
| 13 | `styles.css` | `.fine-print` contrast ~1.9:1 | 1.4.3 |
| 14 | `styles.css` | `.price` contrast ~2.7:1 | 1.4.3 |
| 15 | `styles.css` | `.cta` white on yellow (~1.65:1) | 1.4.3 |
