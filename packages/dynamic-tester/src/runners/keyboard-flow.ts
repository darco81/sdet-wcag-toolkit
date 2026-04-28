/**
 * Keyboard flow runner: actively exercises Tab navigation against a live
 * page and reports runtime keyboard failures that static analysis and
 * axe cannot detect.
 *
 * What we check (complementary to axe, not duplicative):
 *   - Tab cycles at all - focus actually moves forward on each press.
 *     When it does not, either a handler is blocking default behavior
 *     or a keyboard trap is present.
 *   - The rendered DOM contains no `tabindex > 0`. This duplicates the
 *     static rule but catches values that frameworks set dynamically
 *     after hydration (a common foot-gun in React focus-management libs).
 *   - Open `[role="dialog"][aria-modal="true"]` elements close on Escape.
 *     This is a hard requirement of the dialog pattern; axe does not
 *     exercise it.
 */

import type { Page } from 'playwright';

import { requireSuccessCriterion, type WcagFinding } from '@sdet-wcag-toolkit/core';

import type { DynamicRunner, RunnerContext } from '../types.js';

/** Max number of Tab presses when walking focus. Pragmatic upper bound. */
const MAX_TAB_STEPS = 40;

export class KeyboardFlowRunner implements DynamicRunner {
  readonly name = 'keyboard-flow';

  async run(context: RunnerContext): Promise<WcagFinding[]> {
    const page = context.page as Page;
    const findings: WcagFinding[] = [];
    findings.push(...(await checkPositiveTabindexInDom(page, context.url)));
    findings.push(...(await checkTabAdvances(page, context.url)));
    findings.push(...(await checkEscapeClosesDialog(page, context.url)));
    return findings;
  }
}

async function checkPositiveTabindexInDom(page: Page, url: string): Promise<WcagFinding[]> {
  const offenders = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('[tabindex]')) as HTMLElement[];
    return elements
      .filter((el) => {
        const raw = el.getAttribute('tabindex');
        const n = Number(raw);
        return Number.isInteger(n) && n > 0;
      })
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        tabindex: Number(el.getAttribute('tabindex')),
        selector: uniqueSelectorInDocument(el),
      }));
  });

  return offenders.map((offender) => ({
    id: `dyn-tabindex-positive-${offender.selector}-${offender.tabindex}`,
    successCriterion: requireSuccessCriterion('2.4.3'),
    severity: 'serious' as const,
    message: `<${offender.tag}> has tabindex="${offender.tabindex}" in the rendered DOM.`,
    rationale:
      'Positive tabindex values force a custom tab order that diverges from the visual order. Often added dynamically by JS after hydration, invisible to static analysis.',
    remediation:
      'Use tabindex="0" for elements that should join the natural tab order, or rearrange the DOM so the natural order is correct.',
    location: { url, selector: offender.selector },
    source: 'dynamic' as const,
    ruleId: 'tabindex-positive-runtime',
  }));
}

async function checkTabAdvances(page: Page, url: string): Promise<WcagFinding[]> {
  await page.evaluate(() => (document.body as HTMLElement).focus({ preventScroll: true }));
  const visited = new Set<string>();
  let consecutiveSame = 0;
  let lastLabel = '';

  for (let step = 0; step < MAX_TAB_STEPS; step += 1) {
    await page.keyboard.press('Tab');
    const active = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body || el === document.documentElement) return null;
      return {
        label: el.id || el.getAttribute('data-testid') || el.outerHTML.slice(0, 120),
      };
    });
    if (!active) {
      // Focus rolled back to body - acceptable (end-of-page wrap) unless it
      // happens on the very first press, which would mean Tab is captured.
      if (step === 0) {
        return [tabNoOpFinding(url, 'Pressing Tab from body did not move focus to any element.')];
      }
      return [];
    }
    if (active.label === lastLabel) {
      consecutiveSame += 1;
      if (consecutiveSame >= 3) {
        return [
          tabNoOpFinding(
            url,
            `Focus is stuck on a single element after ${step} Tab presses (possible keyboard trap).`,
          ),
        ];
      }
    } else {
      consecutiveSame = 0;
    }
    visited.add(active.label);
    lastLabel = active.label;
  }
  return [];
}

function tabNoOpFinding(url: string, message: string): WcagFinding {
  return {
    id: `dyn-tab-noop-${url}`,
    successCriterion: requireSuccessCriterion('2.1.2'),
    severity: 'critical',
    message,
    rationale:
      'Keyboard users must be able to navigate away from every element using only the keyboard. A trap leaves them stranded.',
    remediation:
      'Audit key-event handlers - remove any preventDefault()/stopPropagation() on Tab. For custom widgets, implement proper focus management (see WAI-ARIA APG).',
    location: { url },
    source: 'dynamic',
    ruleId: 'keyboard-trap-runtime',
  };
}

async function checkEscapeClosesDialog(page: Page, url: string): Promise<WcagFinding[]> {
  const dialogInfo = await page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll('[role="dialog"][aria-modal="true"], dialog[open]'),
    ) as HTMLElement[];
    const visible = candidates.find(
      (el) => el.offsetWidth > 0 && el.offsetHeight > 0 && getComputedStyle(el).display !== 'none',
    );
    if (!visible) return null;
    return {
      tag: visible.tagName.toLowerCase(),
      label:
        visible.getAttribute('aria-label') ||
        visible.getAttribute('data-testid') ||
        visible.id ||
        'dialog',
    };
  });

  if (!dialogInfo) return [];

  await page.keyboard.press('Escape');
  // Allow the page to settle.
  await page.waitForTimeout(150);

  const stillOpen = await page.evaluate(
    (tag: string) => {
      const candidates = Array.from(document.querySelectorAll(tag));
      return candidates.some((el) => {
        const html = el as HTMLElement;
        return html.offsetWidth > 0 && html.offsetHeight > 0;
      });
    },
    dialogInfo.tag === 'dialog' ? 'dialog[open]' : '[role="dialog"][aria-modal="true"]',
  );

  if (!stillOpen) return [];

  return [
    {
      id: `dyn-escape-no-close-${url}-${dialogInfo.label}`,
      successCriterion: requireSuccessCriterion('2.1.2'),
      severity: 'serious',
      message: `Dialog "${dialogInfo.label}" did not close on Escape.`,
      rationale:
        'The dialog pattern requires Escape to dismiss modal dialogs. Without it, keyboard users must tab through the entire dialog to exit.',
      remediation:
        'Add a keydown listener to the dialog that closes it on Escape. Most component libraries include this behavior out of the box - check you are not overriding it.',
      location: { url },
      source: 'dynamic',
      ruleId: 'dialog-escape-runtime',
    },
  ];
}

/**
 * Serialized unique selector. Runs inside `page.evaluate`, so written
 * to work without our usual imports.
 */
function uniqueSelectorInDocument(el: Element): string {
  if (el.id) return `#${el.id}`;
  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current !== document.body) {
    const name = current.tagName.toLowerCase();
    const index = current.parentElement
      ? Array.from(current.parentElement.children).indexOf(current) + 1
      : 1;
    parts.unshift(`${name}:nth-child(${index})`);
    current = current.parentElement;
  }
  return parts.join(' > ');
}
