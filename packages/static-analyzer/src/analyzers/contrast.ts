/**
 * Color-contrast analyzer.
 *
 * Static contrast analysis has a fundamental limitation: the background of
 * an element often comes from an ancestor selector, a :hover state, or a
 * custom property resolved at runtime. We can only flag what we can *see*:
 *
 *   1. A single selector sets both `color` and a background in the same rule.
 *   2. A single element has both in an inline `style` attribute.
 *
 * Anything involving `var(--...)`, layered backgrounds, or dark mode toggles
 * is left to dynamic testing (axe-core). Better to be quiet and correct than
 * loud and wrong.
 */

import { colord, extend } from 'colord';
import a11yPluginDefault from 'colord/plugins/a11y';
import namesPluginDefault from 'colord/plugins/names';
import { load } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import postcss from 'postcss';
import type { Declaration, Rule } from 'postcss';

import { requireSuccessCriterion, type WcagFinding } from '@sdet-wcag-toolkit/core';

import { createFinding } from '../finding.js';
import type { Analyzer, SourceFile } from '../types.js';

// colord's TS types don't play well with NodeNext default-import resolution;
// the plugins are callable at runtime, so cast to the expected shape.
type ColordPlugin = Parameters<typeof extend>[0][number];
extend([namesPluginDefault as unknown as ColordPlugin, a11yPluginDefault as unknown as ColordPlugin]);

/** WCAG 2.2 AA minimum contrast for normal-sized body text. */
export const AA_NORMAL_MIN_RATIO = 4.5;
/** WCAG 2.2 AA minimum contrast for large text (18pt regular or 14pt bold). */
export const AA_LARGE_MIN_RATIO = 3.0;

export const contrastAnalyzer: Analyzer = {
  name: 'color-contrast',
  analyze(context) {
    const findings: WcagFinding[] = [];
    for (const file of context.css) {
      findings.push(...analyzeCssFile(file));
    }
    for (const file of context.html) {
      findings.push(...analyzeInlineStyles(file));
    }
    return findings;
  },
};

function analyzeCssFile(file: SourceFile): WcagFinding[] {
  const findings: WcagFinding[] = [];
  let root: ReturnType<typeof postcss.parse>;
  try {
    root = postcss.parse(file.content);
  } catch {
    return [];
  }

  root.walkRules((rule) => {
    findings.push(...analyzeRule(rule, file));
  });

  return findings;
}

function analyzeRule(rule: Rule, file: SourceFile): WcagFinding[] {
  const declarations = collectColorDeclarations(rule);
  if (!declarations.color || !declarations.background) return [];

  if (containsVar(declarations.color.value) || containsVar(declarations.background.value)) {
    return [];
  }

  const fg = colord(declarations.color.value);
  const bg = colord(declarations.background.value);
  if (!fg.isValid() || !bg.isValid()) return [];

  const ratio = fg.contrast(bg);
  if (ratio >= AA_NORMAL_MIN_RATIO) return [];

  const severity = ratio >= AA_LARGE_MIN_RATIO ? 'moderate' : 'serious';
  const target = ratio >= AA_LARGE_MIN_RATIO ? 'large text' : 'normal text';

  const line = rule.source?.start?.line;
  return [
    createFinding({
      successCriterion: requireSuccessCriterion('1.4.3'),
      severity,
      ruleId: 'color-contrast',
      message: `Selector "${rule.selector}" has contrast ratio ${ratio.toFixed(2)}:1 (below ${AA_NORMAL_MIN_RATIO}:1 required for ${target}).`,
      rationale:
        'Low contrast text is unreadable for users with low vision, color-blindness, or in bright ambient light.',
      remediation: `Darken the foreground, lighten the background, or change the pair until the ratio is at least ${AA_NORMAL_MIN_RATIO}:1 for body text (${AA_LARGE_MIN_RATIO}:1 for large text).`,
      location: {
        file: file.path,
        selector: rule.selector,
        ...(line !== undefined && { line }),
      },
    }),
  ];
}

interface ColorPair {
  color?: Declaration;
  background?: Declaration;
}

function collectColorDeclarations(rule: Rule): ColorPair {
  const pair: ColorPair = {};
  rule.walkDecls((decl) => {
    const prop = decl.prop.toLowerCase();
    if (prop === 'color') pair.color = decl;
    else if (prop === 'background-color') pair.background = decl;
    else if (prop === 'background' && !pair.background) {
      const candidate = firstColorToken(decl.value);
      if (candidate) pair.background = { ...decl, value: candidate } as Declaration;
    }
  });
  return pair;
}

function firstColorToken(value: string): string | null {
  const trimmed = value.trim();
  const hex = /#[0-9a-fA-F]{3,8}\b/.exec(trimmed);
  if (hex) return hex[0];
  const rgb = /rgba?\([^)]+\)/i.exec(trimmed);
  if (rgb) return rgb[0];
  const hsl = /hsla?\([^)]+\)/i.exec(trimmed);
  if (hsl) return hsl[0];
  if (/^[a-z]+$/i.test(trimmed)) return trimmed;
  return null;
}

function containsVar(value: string): boolean {
  return /\bvar\s*\(/.test(value);
}

function analyzeInlineStyles(file: SourceFile): WcagFinding[] {
  const $ = load(file.content);
  const findings: WcagFinding[] = [];

  $('[style]').each((_, el) => {
    const raw = $(el).attr('style') ?? '';
    const pair = parseInlineStylePair(raw);
    if (!pair.color || !pair.background) return;
    if (containsVar(pair.color) || containsVar(pair.background)) return;

    const fg = colord(pair.color);
    const bg = colord(pair.background);
    if (!fg.isValid() || !bg.isValid()) return;

    const ratio = fg.contrast(bg);
    if (ratio >= AA_NORMAL_MIN_RATIO) return;

    const severity = ratio >= AA_LARGE_MIN_RATIO ? 'moderate' : 'serious';
    const target = ratio >= AA_LARGE_MIN_RATIO ? 'large text' : 'normal text';
    const tag = tagNameOf(el);
    findings.push(
      createFinding({
        successCriterion: requireSuccessCriterion('1.4.3'),
        severity,
        ruleId: 'color-contrast-inline',
        message: `Inline style on <${tag}> has contrast ratio ${ratio.toFixed(2)}:1 (below ${AA_NORMAL_MIN_RATIO}:1 required for ${target}).`,
        rationale:
          'Inline colors are the most common source of accidental low-contrast pairs because they skip the design system entirely.',
        remediation:
          'Move the color pair into the stylesheet (ideally into design tokens) and raise the contrast ratio to at least 4.5:1.',
        location: { file: file.path, selector: `${tag}[style]` },
      }),
    );
  });

  return findings;
}

interface InlineStylePair {
  color?: string;
  background?: string;
}

function parseInlineStylePair(style: string): InlineStylePair {
  const pair: InlineStylePair = {};
  for (const decl of style.split(';')) {
    const [rawProp, ...rest] = decl.split(':');
    if (!rawProp || rest.length === 0) continue;
    const prop = rawProp.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (!value) continue;
    if (prop === 'color') pair.color = value;
    else if (prop === 'background-color') pair.background = value;
    else if (prop === 'background' && !pair.background) {
      const candidate = firstColorToken(value);
      if (candidate) pair.background = candidate;
    }
  }
  return pair;
}

function tagNameOf(el: AnyNode): string {
  if (el.type === 'tag') return (el as Element).tagName.toLowerCase();
  return 'element';
}
