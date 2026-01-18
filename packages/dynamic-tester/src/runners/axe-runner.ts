/**
 * Axe runner: wraps `@axe-core/playwright` and maps violations to
 * {@link WcagFinding}.
 *
 * Axe covers almost the entire WCAG 2.0/2.1/2.2 rule surface that can be
 * detected from a rendered DOM. We rely on it as the workhorse of the
 * dynamic path and pair it with smaller specialised runners (keyboard
 * flow, focus visibility) for behaviours axe does not check.
 */

import { AxeBuilder } from '@axe-core/playwright';
import type { NodeResult, Result } from 'axe-core';
import type { Page } from 'playwright';

import {
  findSuccessCriterion,
  type WcagFinding,
  type WcagSeverity,
  type WcagSuccessCriterion,
} from '@sdet-wcag-toolkit/core';

import type { DynamicRunner, RunnerContext } from '../types.js';

/** WCAG tags Axe understands for conformance level A and AA across 2.0/2.1/2.2. */
export const AXE_WCAG_TAGS: readonly string[] = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22a',
  'wcag22aa',
];

export interface AxeRunnerOptions {
  /** Override the tag list (advanced; most users should not need to). */
  readonly tags?: readonly string[];
  /** Include `best-practice` rules in addition to WCAG AA. */
  readonly includeBestPractice?: boolean;
}

export class AxeRunner implements DynamicRunner {
  readonly name = 'axe-runner';
  private readonly tags: readonly string[];

  constructor(options: AxeRunnerOptions = {}) {
    this.tags = options.tags ?? [
      ...AXE_WCAG_TAGS,
      ...(options.includeBestPractice ? ['best-practice'] : []),
    ];
  }

  async run(context: RunnerContext): Promise<WcagFinding[]> {
    const page = context.page as Page;
    const builder = new AxeBuilder({ page }).withTags([...this.tags]);
    const results = await builder.analyze();

    const findings: WcagFinding[] = [];
    for (const violation of results.violations) {
      for (const node of violation.nodes) {
        const finding = mapViolation(violation, node, context.url);
        if (finding) findings.push(finding);
      }
    }
    return findings;
  }
}

function mapViolation(
  violation: Result,
  node: NodeResult,
  url: string,
): WcagFinding | null {
  const sc = resolveSuccessCriterion(violation.tags);
  if (!sc) {
    return null;
  }
  const severity = mapSeverity(violation.impact);
  const selector = flattenSelector(node.target);
  const snippet = node.html;
  const id = `dyn-${violation.id}-${hashLocation(url, selector, snippet)}`;

  return {
    id,
    successCriterion: sc,
    severity,
    message: violation.help,
    rationale: violation.description,
    ...(node.failureSummary !== undefined && {
      remediation: node.failureSummary.replace(/^Fix any of the following:\s*/i, '').trim(),
    }),
    location: {
      url,
      ...(selector !== undefined && { selector }),
      ...(snippet !== undefined && { snippet }),
    },
    source: 'dynamic',
    ruleId: violation.id,
    helpUrl: violation.helpUrl,
  };
}

function resolveSuccessCriterion(tags: readonly string[]): WcagSuccessCriterion | undefined {
  for (const tag of tags) {
    const match = /^wcag(\d)(\d)(\d{1,2})$/.exec(tag);
    if (!match) continue;
    const [, principle, guideline, criterion] = match;
    const id = `${principle}.${guideline}.${criterion}`;
    const sc = findSuccessCriterion(id);
    if (sc) return sc;
  }
  return undefined;
}

function mapSeverity(impact: string | null | undefined): WcagSeverity {
  switch (impact) {
    case 'critical':
      return 'critical';
    case 'serious':
      return 'serious';
    case 'moderate':
      return 'moderate';
    case 'minor':
      return 'minor';
    default:
      return 'moderate';
  }
}

function flattenSelector(target: NodeResult['target']): string | undefined {
  if (!target || target.length === 0) return undefined;
  const first = target[0] as unknown;
  if (typeof first === 'string') return first;
  if (Array.isArray(first) && first.length > 0) {
    return first.filter((p): p is string => typeof p === 'string').join(' ');
  }
  return undefined;
}

function hashLocation(
  url: string,
  selector: string | undefined,
  snippet: string | undefined,
): string {
  const key = `${url}|${selector ?? ''}|${(snippet ?? '').slice(0, 64)}`;
  let hash = 5381;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 33) ^ key.charCodeAt(i);
  return (hash >>> 0).toString(36);
}
