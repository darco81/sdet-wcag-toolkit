/**
 * Executive summary. One page, no technical jargon. Audience: product
 * owner, legal counsel, exec stakeholder. The goal is that someone who
 * has never read WCAG understands the shape of the risk in under 2
 * minutes.
 */

import {
  PENALTY_WEIGHT,
  countBySeverity,
  scoreAndGrade,
  sortByPriority,
  type WcagFinding,
  type WcagGrade,
} from '@sdet-wcag-toolkit/core';

export interface ExecSummaryOptions {
  readonly title?: string;
  /** Short name of the product/site being audited. */
  readonly target?: string;
  /** Number of "top risks" to call out. */
  readonly topRiskCount?: number;
}

export function formatExecSummary(
  findings: readonly WcagFinding[],
  options: ExecSummaryOptions = {},
): string {
  const title = options.title ?? 'Accessibility audit - executive summary';
  const target = options.target ?? 'this site';
  const topN = options.topRiskCount ?? 5;

  const breakdown = countBySeverity(findings);
  const { score, grade } = scoreAndGrade(findings);

  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(headlineSentence(grade, breakdown.total, target));
  lines.push('');
  lines.push(`## Score: ${score} (Grade ${grade})`);
  lines.push('');
  lines.push('Severity breakdown:');
  if (breakdown.critical > 0)
    lines.push(
      `- ${breakdown.critical} critical (-${breakdown.critical * PENALTY_WEIGHT.critical})`,
    );
  if (breakdown.serious > 0)
    lines.push(`- ${breakdown.serious} serious (-${breakdown.serious * PENALTY_WEIGHT.serious})`);
  if (breakdown.moderate > 0)
    lines.push(
      `- ${breakdown.moderate} moderate (-${breakdown.moderate * PENALTY_WEIGHT.moderate})`,
    );
  if (breakdown.minor > 0)
    lines.push(`- ${breakdown.minor} minor (-${breakdown.minor * PENALTY_WEIGHT.minor})`);
  if (breakdown.total === 0) lines.push('- (none - perfect score)');

  lines.push('');
  lines.push('## What we found');
  lines.push('');
  lines.push(countSentence(breakdown));

  if (findings.length > 0) {
    lines.push('');
    lines.push('## Top risks');
    lines.push('');
    const top = sortByPriority(findings).slice(0, topN);
    top.forEach((finding, index) => {
      lines.push(`${index + 1}. **${plainTitle(finding)}** - ${nonTechnicalConsequence(finding)}`);
    });
  }

  lines.push('');
  lines.push('## Why this matters');
  lines.push('');
  lines.push(legalNote(grade));

  lines.push('');
  lines.push('## Next step');
  lines.push('');
  lines.push(nextStep(grade, findings.length));

  return lines.join('\n') + '\n';
}

function headlineSentence(grade: WcagGrade, total: number, target: string): string {
  if (grade === 'A') {
    return `${target} passes our WCAG 2.2 Level AA static audit (grade A, no findings).`;
  }
  if (grade === 'B') {
    return `${target} scores a **B** on WCAG 2.2 Level AA - ${total} minor issues, low risk.`;
  }
  if (grade === 'C') {
    return `${target} scores a **C** on WCAG 2.2 Level AA - ${total} findings worth addressing before the next release.`;
  }
  if (grade === 'D') {
    return `${target} scores a **D** on WCAG 2.2 Level AA - ${total} findings including at least one critical blocker.`;
  }
  return `${target} scores an **F** on WCAG 2.2 Level AA - ${total} findings. Substantial remediation required.`;
}

function countSentence(b: ReturnType<typeof countBySeverity>): string {
  return `${b.critical} critical, ${b.serious} serious, ${b.moderate} moderate, ${b.minor} minor.`;
}

function plainTitle(finding: WcagFinding): string {
  // Strip the trailing period and technical filler from the dev message.
  return finding.message.replace(/\.$/, '');
}

function nonTechnicalConsequence(finding: WcagFinding): string {
  switch (finding.successCriterion.principle) {
    case 'perceivable':
      return 'users with low vision or using screen readers may not see or hear this content.';
    case 'operable':
      return 'keyboard-only and assistive-tech users may be unable to complete this task.';
    case 'understandable':
      return 'the content is confusing or inconsistent for users who rely on predictability.';
    case 'robust':
      return 'assistive technology cannot accurately interpret the element.';
  }
}

function legalNote(grade: WcagGrade): string {
  const baseline =
    'Level AA conformance is the baseline referenced by the European Accessibility Act (EAA, effective 2025 for consumer-facing digital products) and by most US state accessibility regulations.';
  if (grade === 'A' || grade === 'B') {
    return `${baseline} This audit indicates the site is at or near that baseline.`;
  }
  return `${baseline} The current findings put the site below that baseline. Remediating the Critical and Serious items is the priority - they correspond to failure modes that are typically cited in accessibility complaints.`;
}

function nextStep(grade: WcagGrade, total: number): string {
  if (grade === 'A') {
    return 'Add this audit to the CI pipeline so regressions are caught on every PR.';
  }
  if (total === 0) {
    return 'Re-run against the live site after the next release to catch regressions.';
  }
  return 'Review the detailed developer report, triage the top-priority findings, and plan a remediation cycle. Running the full pipeline (static + dynamic) quarterly is a reasonable cadence for mature products.';
}
