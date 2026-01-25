/**
 * Focus-visibility runner: focuses each focusable element on a live page
 * and checks that the browser renders a discernible focus indicator.
 *
 * Covers WCAG 2.4.7 Focus Visible at runtime. We deliberately do not
 * screenshot + diff (that belongs in v0.3 where we'll capture evidence
 * for reports). Instead we compare `getComputedStyle` before and after
 * focus - if neither `outline` nor `box-shadow` nor `border` changes in
 * any observable way, the browser is showing no focus ring.
 *
 * Frameworks that rely on `:focus-visible` for styling are common, so
 * this runner drives focus with keyboard (Tab) rather than
 * `element.focus()` - the latter does not trigger `:focus-visible` in
 * Chromium.
 */

import type { Page } from 'playwright';

import { requireSuccessCriterion, type WcagFinding } from '@sdet-wcag-toolkit/core';

import type { DynamicRunner, RunnerContext } from '../types.js';

const MAX_ELEMENTS_CHECKED = 30;

export class FocusVisibilityRunner implements DynamicRunner {
  readonly name = 'focus-visibility';

  async run(context: RunnerContext): Promise<WcagFinding[]> {
    const page = context.page as Page;
    await page.evaluate(() => (document.body as HTMLElement).focus({ preventScroll: true }));
    const findings: WcagFinding[] = [];

    for (let step = 0; step < MAX_ELEMENTS_CHECKED; step += 1) {
      await page.keyboard.press('Tab');
      const result = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body || el === document.documentElement) return null;
        const style = getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
          outline: style.outlineStyle + ' ' + style.outlineWidth + ' ' + style.outlineColor,
          boxShadow: style.boxShadow,
          border: style.borderStyle + ' ' + style.borderWidth + ' ' + style.borderColor,
          hasIndicator: hasVisibleFocusIndicator(style),
        };

        function hasVisibleFocusIndicator(s: CSSStyleDeclaration): boolean {
          const outlineVisible =
            s.outlineStyle !== 'none' &&
            s.outlineStyle !== '' &&
            parseFloat(s.outlineWidth || '0') > 0;
          const shadowVisible = s.boxShadow !== 'none' && s.boxShadow !== '';
          // A thick colored border can also function as a focus indicator; we
          // trust it if >= 2px.
          const borderVisible =
            s.borderStyle !== 'none' && parseFloat(s.borderWidth || '0') >= 2;
          return outlineVisible || shadowVisible || borderVisible;
        }
      });

      if (!result) break;
      if (result.hasIndicator) continue;

      findings.push({
        id: `dyn-focus-invisible-${result.selector}-${step}`,
        successCriterion: requireSuccessCriterion('2.4.7'),
        severity: 'serious',
        message: `<${result.tag}> has no visible focus indicator when focused via keyboard.`,
        rationale:
          'Users relying on keyboard navigation cannot tell which element currently has focus. Browsers supply a default outline; CSS that removes it without replacement breaks 2.4.7.',
        remediation:
          'Add an outline or box-shadow to the `:focus-visible` (or `:focus`) state with contrast ratio of at least 3:1 against the background.',
        location: { url: context.url, selector: result.selector },
        source: 'dynamic',
        ruleId: 'focus-indicator-missing',
      });
    }

    return findings;
  }
}
