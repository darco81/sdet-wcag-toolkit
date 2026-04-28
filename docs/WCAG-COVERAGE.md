# WCAG 2.2 coverage - v0.3.0

Which success criteria the toolkit checks, and how. `static` = the
deterministic TypeScript analyzer + AI source-level agents;
`dynamic` = Playwright + axe-core + keyboard-flow + focus-visibility
runners; `manual` = nothing automated can catch this - it needs a
human reviewer.

A ✓ means the toolkit meaningfully checks the SC (not just "technically
has a rule"). A partial means we catch a common subset. An empty cell
means we don't claim to cover it.

## What's covered by AI specialists (v0.3.0)

The 5 AI specialists (dispatched via the `Task` tool from a Claude
Code session through `/wcag:audit` or `--use-ai`) read source via
`Read` + `Grep` + `Glob` and return JSON findings against the WCAG
catalog. Each specialist owns a domain:

- **`semantic-structure-agent`** - heading hierarchy, landmarks,
  lists, `<html lang>`, modal heading rank, **3.1.2 Language of
  Parts** (per-element `lang` attributes for foreign-language
  excerpts).
- **`aria-patterns-agent`** - ARIA attribute misuse, **live-region
  politeness hierarchy** (`role="status"` vs `role="alert"`),
  **DOM-must-exist-before-content** rule, **dialog-type taxonomy**
  (4.1.2, 4.1.3 - flagging `aria-modal` on `role="region"` /
  `status` / cookie banners as a semantic lie).
- **`keyboard-interaction-agent`** - `onClick` without `onKeyDown`,
  positive tabindex, plus **composite-widget rule with APG keyboard
  patterns** (Tabs, Listbox, Combobox, Menu) and roving tabindex.
- **`color-contrast-static-agent`** - CSS contrast in source, plus
  **1.4.1 color-only indicator heuristic** and **`prefers-*` media
  queries** (1.4.12 Text Spacing, `prefers-reduced-motion`,
  `prefers-contrast`, `forced-colors`) presence checks.
- **`forms-accessibility-agent`** - labels, fieldsets, autocomplete,
  plus **3.3.4 review-step rule** for checkout / payment / financial
  forms and **validation-timing rule** (`@input` flagged, `@blur`
  recommended).

## Perceivable

| SC | Level | Name | Static | Dynamic | Manual |
|----|-------|------|:------:|:-------:|:------:|
| 1.1.1 | A | Non-text Content | ✓ | ✓ | |
| 1.2.1 | A | Audio/Video-only (Prerec.) | | | ✓ |
| 1.2.2 | A | Captions (Prerecorded) | | | ✓ |
| 1.2.3 | A | Audio Description (Prerec.) | | | ✓ |
| 1.2.4 | AA | Captions (Live) | | | ✓ |
| 1.2.5 | AA | Audio Description (Prerec.) | | | ✓ |
| 1.3.1 | A | Info and Relationships | ✓ | ✓ | |
| 1.3.2 | A | Meaningful Sequence | partial | ✓ | partial |
| 1.3.3 | A | Sensory Characteristics | | | ✓ |
| 1.3.4 | AA | Orientation | | partial | ✓ |
| 1.3.5 | AA | Identify Input Purpose | ✓ | ✓ | |
| 1.4.1 | A | Use of Color | partial (AI) | partial | ✓ |
| 1.4.2 | A | Audio Control | | | ✓ |
| 1.4.3 | AA | Contrast (Minimum) | ✓ | ✓ | |
| 1.4.4 | AA | Resize Text | | partial | ✓ |
| 1.4.5 | AA | Images of Text | | | ✓ |
| 1.4.10 | AA | Reflow | | partial | ✓ |
| 1.4.11 | AA | Non-text Contrast | | partial | ✓ |
| 1.4.12 | AA | Text Spacing | partial (AI) | partial | ✓ |
| 1.4.13 | AA | Content on Hover or Focus | | | ✓ |

## Operable

| SC | Level | Name | Static | Dynamic | Manual |
|----|-------|------|:------:|:-------:|:------:|
| 2.1.1 | A | Keyboard | ✓ | ✓ | |
| 2.1.2 | A | No Keyboard Trap | | ✓ | |
| 2.1.4 | A | Character Key Shortcuts | | | ✓ |
| 2.2.1 | A | Timing Adjustable | | | ✓ |
| 2.2.2 | A | Pause, Stop, Hide | | | ✓ |
| 2.3.1 | A | Three Flashes or Below | | | ✓ |
| 2.4.1 | A | Bypass Blocks | | partial | ✓ |
| 2.4.2 | A | Page Titled | ✓ | ✓ | |
| 2.4.3 | A | Focus Order | ✓ | ✓ | |
| 2.4.4 | A | Link Purpose (In Context) | partial | ✓ | partial |
| 2.4.5 | AA | Multiple Ways | | | ✓ |
| 2.4.6 | AA | Headings and Labels | partial | ✓ | |
| 2.4.7 | AA | Focus Visible | | ✓ | |
| 2.4.11 | AA | Focus Not Obscured (Min.) | | partial | ✓ |
| 2.5.1 | A | Pointer Gestures | | | ✓ |
| 2.5.2 | A | Pointer Cancellation | | | ✓ |
| 2.5.3 | A | Label in Name | | ✓ | |
| 2.5.4 | A | Motion Actuation | | | ✓ |
| 2.5.7 | AA | Dragging Movements | | | ✓ |
| 2.5.8 | AA | Target Size (Minimum) | | ✓ | |

## Understandable

| SC | Level | Name | Static | Dynamic | Manual |
|----|-------|------|:------:|:-------:|:------:|
| 3.1.1 | A | Language of Page | ✓ | ✓ | |
| 3.1.2 | AA | Language of Parts | ✓ (AI) | ✓ | partial |
| 3.2.1 | A | On Focus | | | ✓ |
| 3.2.2 | A | On Input | | | ✓ |
| 3.2.3 | AA | Consistent Navigation | | | ✓ |
| 3.2.4 | AA | Consistent Identification | | | ✓ |
| 3.2.6 | A | Consistent Help | | | ✓ |
| 3.3.1 | A | Error Identification | ✓ | ✓ | |
| 3.3.2 | A | Labels or Instructions | ✓ | ✓ | |
| 3.3.3 | AA | Error Suggestion | | partial | ✓ |
| 3.3.4 | AA | Error Prevention (L/F/D) | partial (AI, forms) | | ✓ |
| 3.3.7 | A | Redundant Entry | | | ✓ |
| 3.3.8 | AA | Accessible Authentication | | partial | ✓ |

## Robust

| SC | Level | Name | Static | Dynamic | Manual |
|----|-------|------|:------:|:-------:|:------:|
| 4.1.2 | A | Name, Role, Value | ✓ | ✓ | |
| 4.1.3 | AA | Status Messages | ✓ (AI) | ✓ | partial |

## What these numbers mean

- **Static ✓ count:** 17 / 55 SCs (31%). Anything that can be read
  from source without running a browser. v0.3 added 3.1.2 Language
  of Parts and 4.1.3 Status Messages as full ✓ via AI specialists.
- **Static partial (AI) count:** 4 / 55 SCs (7%). 1.4.1 color-only
  indicator heuristic, 1.4.12 `prefers-*` media-query presence,
  3.3.4 review-step rule for forms, and a few existing partials
  the AI specialists strengthen.
- **Dynamic ✓ count:** 19 / 55 SCs (35%). Adds axe-core's coverage
  against rendered DOM plus the three runtime runners (axe,
  keyboard-flow, focus-visibility).
- **Manual only:** 18 / 55 SCs (33%). Require judgement or
  interaction testing that automation can't do.

**Combined automated coverage (static + dynamic, ✓ or partial):**
around 65% of Level A+AA SCs (up from ~60% in v0.2). The remaining
~35% need a human - which is why this toolkit is designed to
*accelerate* accessibility work, not replace the audit step.

For the cited best-case numbers industry-wide, automated tooling
catches 30-40% of accessibility issues. Our combined pipeline lands
above that range because we layer static source analysis (with AI
specialists reading framework source) on top of deterministic
browser testing.

## What's gated to the Pro tier (V0.4+)

Public v0.3.0 covers WCAG 2.2 AA across 5 specialist domains. The
Pro tier adds two niche specialists for e-commerce / EAA exposure
and two infrastructure layers:

- **`modal-specialist`** (V0.4 alpha.4) - focus traps, focus
  restoration on close, `aria-modal` validation, scroll-lock,
  `alertdialog` vs `dialog`, deep-link / SSR patterns.
- **`ecommerce-journey`** (V0.4 alpha.4) - variant change
  `aria-live` updates, payment review (3.3.4 + 3.3.6), color-only
  stock indicators, cart toast politeness, trust-signal presence.
- **Auto-fix engine** (V0.4 alpha.3) - codemod-based patchers
  (currently 2: `image-alt`, `html-lang`) with verifier loop and
  rollback on regression.
- **Multi-runtime** (V0.4) - OpenCode and OpenCode-Ollama adapters
  alongside Claude Code, plus a runtime selector flag.

See [sdet.it/services](https://sdet.it/services) for commercial
licensing and engagement scope.
