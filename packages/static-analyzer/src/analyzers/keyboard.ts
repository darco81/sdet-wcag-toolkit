/**
 * Keyboard-interaction analyzer.
 *
 * Catches keyboard accessibility issues that are visible in static HTML:
 *
 *   - Positive `tabindex` values (2.4.3 Focus Order)
 *   - Interactive roles on non-focusable elements (2.1.1 Keyboard)
 *   - Inline `onclick` on non-interactive elements without a keyboard
 *     handler or keyboard-reachable role (2.1.1)
 *
 * We deliberately skip focus-trap detection here - that needs runtime
 * inspection of JS behavior, and belongs in dynamic testing.
 */

import type { AnyNode, Element } from 'domhandler';

import { load, type CheerioAPI } from 'cheerio';

import { requireSuccessCriterion, type WcagFinding } from '@sdet-wcag-toolkit/core';

import { createFinding } from '../finding.js';
import type { Analyzer, SourceFile } from '../types.js';

/** Roles that need to land in the tab order to be operable by keyboard. */
const INTERACTIVE_ROLES: ReadonlySet<string> = new Set([
  'button',
  'link',
  'checkbox',
  'radio',
  'switch',
  'combobox',
  'slider',
  'spinbutton',
  'textbox',
  'searchbox',
  'tab',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'treeitem',
  'gridcell',
]);

/** HTML elements that are natively focusable without tabindex. */
const NATIVELY_FOCUSABLE: ReadonlySet<string> = new Set([
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'details',
  'summary',
]);

export const keyboardAnalyzer: Analyzer = {
  name: 'keyboard-interaction',
  analyze(context) {
    const findings: WcagFinding[] = [];
    for (const file of context.html) {
      findings.push(...analyzeHtmlFile(file));
    }
    return findings;
  },
};

function analyzeHtmlFile(file: SourceFile): WcagFinding[] {
  const $ = load(file.content);
  const findings: WcagFinding[] = [];

  $('[tabindex]').each((_, el) => {
    findings.push(...checkPositiveTabindex($, el, file));
  });

  $('[role]').each((_, el) => {
    findings.push(...checkInteractiveRoleFocusable($, el, file));
  });

  $('[onclick]').each((_, el) => {
    findings.push(...checkClickWithoutKeyboardAffordance($, el, file));
  });

  return findings;
}

function checkPositiveTabindex($: CheerioAPI, el: AnyNode, file: SourceFile): WcagFinding[] {
  const raw = $(el as Element).attr('tabindex');
  if (raw === undefined) return [];
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) return [];
  const tag = tagNameOf(el);
  return [
    createFinding({
      successCriterion: requireSuccessCriterion('2.4.3'),
      severity: 'serious',
      ruleId: 'tabindex-positive',
      message: `<${tag}> uses tabindex="${parsed}" (positive values are an anti-pattern).`,
      rationale:
        'Positive tabindex values force a custom tab order that diverges from the visual order. This is fragile, hard to maintain, and confuses keyboard users.',
      remediation:
        'Use tabindex="0" for elements that should join the natural tab order, or tabindex="-1" for programmatically-focusable ones. Rearrange the DOM for the order you want.',
      location: { file: file.path, selector: `${tag}[tabindex="${raw}"]` },
    }),
  ];
}

function checkInteractiveRoleFocusable(
  $: CheerioAPI,
  el: AnyNode,
  file: SourceFile,
): WcagFinding[] {
  const role = ($(el as Element).attr('role') ?? '').trim();
  if (!INTERACTIVE_ROLES.has(role)) return [];
  const tag = tagNameOf(el);
  if (NATIVELY_FOCUSABLE.has(tag)) return [];
  const tabindex = $(el as Element).attr('tabindex');
  const hasFocusableTabindex = tabindex !== undefined && Number.isInteger(Number(tabindex));
  if (hasFocusableTabindex) return [];
  return [
    createFinding({
      successCriterion: requireSuccessCriterion('2.1.1'),
      severity: 'serious',
      ruleId: 'interactive-role-not-focusable',
      message: `<${tag} role="${role}"> is not in the tab order and cannot be reached with the keyboard.`,
      rationale:
        'A role that implies interaction also implies focusability. Without tabindex or a native focusable element, keyboard users cannot operate it.',
      remediation: `Add tabindex="0", or use a native focusable element (e.g. <button> for role="button").`,
      location: { file: file.path, selector: `${tag}[role="${role}"]` },
    }),
  ];
}

function checkClickWithoutKeyboardAffordance(
  $: CheerioAPI,
  el: AnyNode,
  file: SourceFile,
): WcagFinding[] {
  const tag = tagNameOf(el);
  // Native interactive elements already handle Enter/Space - ignore.
  if (NATIVELY_FOCUSABLE.has(tag)) return [];

  const role = ($(el as Element).attr('role') ?? '').trim();
  const hasInteractiveRole = INTERACTIVE_ROLES.has(role);
  const hasKeyboardHandler =
    $(el as Element).attr('onkeydown') !== undefined ||
    $(el as Element).attr('onkeypress') !== undefined ||
    $(el as Element).attr('onkeyup') !== undefined;

  if (hasInteractiveRole && hasKeyboardHandler) return [];

  const missing: string[] = [];
  if (!hasInteractiveRole) missing.push('interactive role');
  if (!hasKeyboardHandler) missing.push('keyboard event handler');

  return [
    createFinding({
      successCriterion: requireSuccessCriterion('2.1.1'),
      severity: 'serious',
      ruleId: 'click-without-keyboard',
      message: `<${tag}> has onclick but is missing: ${missing.join(', ')}.`,
      rationale:
        'Click handlers fire on pointer events only. Keyboard users (and assistive tech) cannot activate the element.',
      remediation:
        'Either use a native interactive element (<button>/<a>), or add role + tabindex + an onkeydown handler that triggers on Enter and Space.',
      location: { file: file.path, selector: `${tag}[onclick]` },
    }),
  ];
}

function tagNameOf(el: AnyNode): string {
  if (el.type === 'tag') return (el as Element).tagName.toLowerCase();
  return 'element';
}
