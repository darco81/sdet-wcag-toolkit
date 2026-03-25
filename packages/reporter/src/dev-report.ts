/**
 * Dev-facing markdown report. Structured for quick triage:
 *
 *   - Header with grade, counts, and detected WCAG principle breakdown
 *   - Top-priority section for the "start here" list
 *   - Full findings grouped by WCAG principle, each with SC ref,
 *     location, message, rationale, and fix hint
 *
 * No HTML - the output is plain markdown so it renders wherever code
 * lives (PR descriptions, GitHub issues, internal wikis).
 */

import {
  countBySeverity,
  scoreAndGrade,
  sortByPriority,
  type SeverityBreakdown,
  type WcagFinding,
  type WcagGrade,
  type WcagPrinciple,
} from '@sdet-wcag-toolkit/core';

export interface DevReportOptions {
  /** Title to show at the top of the report. */
  readonly title?: string;
  /** Number of findings to call out in the "Top priority" section. */
  readonly topCount?: number;
}

export function formatDevReport(
  findings: readonly WcagFinding[],
  options: DevReportOptions = {},
): string {
  const title = options.title ?? 'WCAG 2.2 AA audit';
  const top = options.topCount ?? 10;

  const breakdown = countBySeverity(findings);
  const { score, grade } = scoreAndGrade(findings);

  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`**Score:** ${score} · **Grade:** ${grade} · **Findings:** ${breakdown.total}`);
  lines.push('');
  lines.push(renderSeverityTable(breakdown));

  if (findings.length === 0) {
    lines.push('');
    lines.push('_No findings. Clean audit._');
    lines.push('');
    lines.push('## Positive findings');
    lines.push('');
    lines.push('_(reserved for v0.4+ - surface what the audit confirmed is working)_');
    return lines.join('\n') + '\n';
  }

  lines.push('');
  lines.push(`## Top ${Math.min(top, findings.length)} findings`);
  lines.push('');
  const prioritized = sortByPriority(findings).slice(0, top);
  lines.push(...prioritized.map(renderFindingListItem));

  lines.push('');
  lines.push('## All findings by WCAG principle');
  lines.push('');
  for (const principle of ['perceivable', 'operable', 'understandable', 'robust'] as const) {
    const group = findings.filter((f) => f.successCriterion.principle === principle);
    if (group.length === 0) continue;
    lines.push(`### ${capitalize(principle)} (${group.length})`);
    lines.push('');
    for (const finding of sortByPriority(group)) {
      lines.push(...renderFullFindingBlock(finding));
      lines.push('');
    }
  }

  lines.push('');
  lines.push('## Positive findings');
  lines.push('');
  lines.push('_(reserved for v0.4+ - surface what the audit confirmed is working)_');

  return lines.join('\n') + '\n';
}

function renderSeverityTable(b: SeverityBreakdown): string {
  return [
    '| Severity | Count |',
    '| --- | ---: |',
    `| Critical | ${b.critical} |`,
    `| Serious | ${b.serious} |`,
    `| Moderate | ${b.moderate} |`,
    `| Minor | ${b.minor} |`,
  ].join('\n');
}

function renderFindingListItem(finding: WcagFinding): string {
  const location = renderLocation(finding);
  return `- **[${finding.severity.toUpperCase()}] SC ${finding.successCriterion.id}** - ${location}  \n  ${finding.message}`;
}

function renderFullFindingBlock(finding: WcagFinding): string[] {
  const sc = finding.successCriterion;
  const title = `#### \`${finding.ruleId}\` - SC ${sc.id} ${sc.name}`;
  const meta = `_Severity: ${finding.severity} · Level: ${sc.level} · Source: ${finding.source}_`;
  const location = `**Location:** ${renderLocation(finding)}`;
  const body: string[] = [title, '', meta, '', location, '', finding.message];
  if (finding.rationale) body.push('', `_${finding.rationale}_`);
  if (finding.remediation) body.push('', `**Fix:** ${finding.remediation}`);
  if (finding.location.snippet) {
    body.push('', '```', finding.location.snippet, '```');
  }
  body.push('', `[Reference](${finding.helpUrl ?? sc.url})`);
  return body;
}

function renderLocation(finding: WcagFinding): string {
  const { location } = finding;
  if (location.file) {
    return location.line ? `\`${location.file}:${location.line}\`` : `\`${location.file}\``;
  }
  if (location.url) {
    return location.selector ? `${location.url} - \`${location.selector}\`` : location.url;
  }
  return '(no location)';
}

function capitalize(p: WcagPrinciple): string {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

/** Only exported so tests can assert on grade colouring logic. */
export function gradeBadge(grade: WcagGrade): string {
  return `\`${grade}\``;
}
