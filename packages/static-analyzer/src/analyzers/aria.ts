/**
 * ARIA pattern analyzer.
 *
 * Covers the subset of ARIA mistakes that are common and statically
 * detectable:
 *
 *   - Invalid `role` attribute values (4.1.2 Name, Role, Value)
 *   - Roles missing their required state/property attributes (4.1.2)
 *   - aria-labelledby / aria-describedby pointing to non-existent IDs (4.1.2)
 *   - `aria-hidden="true"` on natively focusable elements (4.1.2)
 *   - Redundant roles (e.g. role="button" on <button>) - minor cleanup
 *
 * Dynamic tests (axe-core) catch the remaining long tail.
 */

import type { AnyNode, Element } from 'domhandler';

import { load, type CheerioAPI } from 'cheerio';

import { requireSuccessCriterion, type WcagFinding } from '@sdet-wcag-toolkit/core';

import { createFinding } from '../finding.js';
import type { Analyzer, SourceFile } from '../types.js';

import { NATIVELY_FOCUSABLE_TAGS, REQUIRED_ARIA_ATTRS, VALID_ARIA_ROLES } from './aria-spec.js';

export const ariaAnalyzer: Analyzer = {
  name: 'aria-patterns',
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
  const idIndex = collectIds($);

  $('[role]').each((_, el) => {
    const role = ($(el).attr('role') ?? '').trim();
    if (!role) return;
    const tag = tagNameOf(el);
    findings.push(...checkRoleValidity(tag, role, file));
    findings.push(...checkRequiredAttrs($, el, tag, role, file));
    findings.push(...checkRedundantRole(tag, role, file));
  });

  $('[aria-labelledby], [aria-describedby]').each((_, el) => {
    findings.push(...checkIdRefAttrs($, el, idIndex, file));
  });

  $('[aria-hidden="true"]').each((_, el) => {
    findings.push(...checkHiddenOnFocusable($, el, file));
  });

  return findings;
}

function collectIds($: CheerioAPI): Set<string> {
  const ids = new Set<string>();
  $('[id]').each((_, el) => {
    const id = $(el).attr('id');
    if (id) ids.add(id);
  });
  return ids;
}

function checkRoleValidity(tag: string, role: string, file: SourceFile): WcagFinding[] {
  // A role attribute may hold a space-separated fallback list; each token
  // must be a recognizable role even though only the first match is used.
  const tokens = role.split(/\s+/).filter(Boolean);
  const unknown = tokens.filter((t) => !VALID_ARIA_ROLES.has(t));
  if (unknown.length === 0) return [];
  return [
    createFinding({
      successCriterion: requireSuccessCriterion('4.1.2'),
      severity: 'serious',
      ruleId: 'aria-valid-role',
      message: `<${tag}> has unknown ARIA role(s): ${unknown.map((r) => `"${r}"`).join(', ')}.`,
      rationale:
        'Invalid roles are ignored by assistive tech, which means the element falls back to its default (often generic) semantics.',
      remediation: `Use a valid WAI-ARIA 1.2 role, or drop the attribute to fall back to the native semantics of <${tag}>.`,
      location: { file: file.path, selector: `${tag}[role="${role}"]` },
    }),
  ];
}

function checkRequiredAttrs(
  $: CheerioAPI,
  el: AnyNode,
  tag: string,
  role: string,
  file: SourceFile,
): WcagFinding[] {
  const required = REQUIRED_ARIA_ATTRS.get(role);
  if (!required) return [];
  const missing = required.filter((attr) => typeof $(el as Element).attr(attr) !== 'string');
  if (missing.length === 0) return [];
  return [
    createFinding({
      successCriterion: requireSuccessCriterion('4.1.2'),
      severity: 'serious',
      ruleId: 'aria-required-attr',
      message: `role="${role}" is missing required attribute(s): ${missing.join(', ')}.`,
      rationale:
        'Widgets with role-specific state need those states announced. Without them, assistive tech sees a widget it cannot describe.',
      remediation: `Add ${missing.map((a) => `${a}="..."`).join(' ')} to the element, or use a native element (<${tag}>).`,
      location: { file: file.path, selector: `${tag}[role="${role}"]` },
    }),
  ];
}

function checkRedundantRole(tag: string, role: string, file: SourceFile): WcagFinding[] {
  const redundant: Readonly<Record<string, string>> = {
    button: 'button',
    a: 'link',
    nav: 'navigation',
    main: 'main',
    header: 'banner',
    footer: 'contentinfo',
    aside: 'complementary',
    form: 'form',
    section: 'region',
    article: 'article',
  };
  if (redundant[tag] !== role) return [];
  return [
    createFinding({
      successCriterion: requireSuccessCriterion('4.1.2'),
      severity: 'minor',
      ruleId: 'aria-redundant-role',
      message: `<${tag}> already has an implicit role of "${role}"; the explicit role is redundant.`,
      rationale:
        'Redundant roles are not harmful but add noise to the accessibility tree and can mask real issues in audits.',
      remediation: `Remove role="${role}" from <${tag}>.`,
      location: { file: file.path, selector: `${tag}[role="${role}"]` },
    }),
  ];
}

function checkIdRefAttrs(
  $: CheerioAPI,
  el: AnyNode,
  idIndex: ReadonlySet<string>,
  file: SourceFile,
): WcagFinding[] {
  const findings: WcagFinding[] = [];
  const tag = tagNameOf(el);
  for (const attr of ['aria-labelledby', 'aria-describedby'] as const) {
    const value = $(el as Element).attr(attr);
    if (!value) continue;
    const missingIds = value.split(/\s+/).filter((id) => id && !idIndex.has(id));
    if (missingIds.length === 0) continue;
    findings.push(
      createFinding({
        successCriterion: requireSuccessCriterion('4.1.2'),
        severity: 'serious',
        ruleId: `aria-idref-${attr.slice(5)}`,
        message: `${attr} references missing id(s): ${missingIds.map((i) => `"${i}"`).join(', ')}.`,
        rationale:
          'Id references that point nowhere produce empty announcements - the element ends up unlabelled or undescribed.',
        remediation: `Either add matching id="..." attributes to the referenced elements, or remove the dangling ids from ${attr}.`,
        location: { file: file.path, selector: `${tag}[${attr}]` },
      }),
    );
  }
  return findings;
}

function checkHiddenOnFocusable($: CheerioAPI, el: AnyNode, file: SourceFile): WcagFinding[] {
  const tag = tagNameOf(el);
  const tabIndex = $(el as Element).attr('tabindex');
  const isFocusableViaTabindex = tabIndex !== undefined && Number(tabIndex) >= 0;
  const isNativelyFocusable = NATIVELY_FOCUSABLE_TAGS.has(tag);
  if (!isFocusableViaTabindex && !isNativelyFocusable) return [];
  return [
    createFinding({
      successCriterion: requireSuccessCriterion('4.1.2'),
      severity: 'critical',
      ruleId: 'aria-hidden-focus',
      message: `<${tag}> is focusable but marked aria-hidden="true".`,
      rationale:
        'Focus lands on an element that screen readers cannot describe - the user is stuck on "nothing".',
      remediation:
        'Remove aria-hidden="true", or make the element unfocusable (tabindex="-1" and inert).',
      location: { file: file.path, selector: `${tag}[aria-hidden="true"]` },
    }),
  ];
}

function tagNameOf(el: AnyNode): string {
  if (el.type === 'tag') return (el as Element).tagName.toLowerCase();
  return 'element';
}
