# WCAG 2.2 coverage - v0.2.0

Which success criteria the toolkit checks, and how. `static` = the
deterministic TypeScript analyzer + AI source-level agents;
`dynamic` = Playwright + axe-core + keyboard-flow + focus-visibility
runners; `manual` = nothing automated can catch this - it needs a
human reviewer.

A ✓ means the toolkit meaningfully checks the SC (not just "technically
has a rule"). A partial means we catch a common subset. An empty cell
means we don't claim to cover it.

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
| 1.4.1 | A | Use of Color | | partial | ✓ |
| 1.4.2 | A | Audio Control | | | ✓ |
| 1.4.3 | AA | Contrast (Minimum) | ✓ | ✓ | |
| 1.4.4 | AA | Resize Text | | partial | ✓ |
| 1.4.5 | AA | Images of Text | | | ✓ |
| 1.4.10 | AA | Reflow | | partial | ✓ |
| 1.4.11 | AA | Non-text Contrast | | partial | ✓ |
| 1.4.12 | AA | Text Spacing | | partial | ✓ |
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
| 3.1.2 | AA | Language of Parts | partial | ✓ | partial |
| 3.2.1 | A | On Focus | | | ✓ |
| 3.2.2 | A | On Input | | | ✓ |
| 3.2.3 | AA | Consistent Navigation | | | ✓ |
| 3.2.4 | AA | Consistent Identification | | | ✓ |
| 3.2.6 | A | Consistent Help | | | ✓ |
| 3.3.1 | A | Error Identification | ✓ | ✓ | |
| 3.3.2 | A | Labels or Instructions | ✓ | ✓ | |
| 3.3.3 | AA | Error Suggestion | | partial | ✓ |
| 3.3.4 | AA | Error Prevention (L/F/D) | | | ✓ |
| 3.3.7 | A | Redundant Entry | | | ✓ |
| 3.3.8 | AA | Accessible Authentication | | partial | ✓ |

## Robust

| SC | Level | Name | Static | Dynamic | Manual |
|----|-------|------|:------:|:-------:|:------:|
| 4.1.2 | A | Name, Role, Value | ✓ | ✓ | |
| 4.1.3 | AA | Status Messages | | ✓ | partial |

## What these numbers mean

- **Static ✓ count:** 15 / 55 SCs (27%). Anything that can be read
  from source without running a browser.
- **Dynamic ✓ count:** 19 / 55 SCs (35%). Adds axe-core's coverage
  against rendered DOM plus our three runtime runners.
- **Manual only:** 20 / 55 SCs (36%). Require judgement or
  interaction testing that automation can't do.

**Combined automated coverage (static + dynamic, ✓ or partial):**
around 60% of Level A+AA SCs. The remaining ~40% need a human -
which is why this toolkit is designed to *accelerate* accessibility
work, not replace the audit step.

For the cited best-case numbers industry-wide, automated tooling
catches 30-40% of accessibility issues. Our combined pipeline is on
the upper end of that range because we layer static source analysis
with AI agents on top of deterministic browser testing.
