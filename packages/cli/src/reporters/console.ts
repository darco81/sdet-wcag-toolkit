/**
 * Terminal-friendly reporter for the CLI.
 *
 * Prints a headline grade, a severity breakdown, and the top-N findings
 * ordered by priority. This is deliberately brief - full markdown/exec
 * reports arrive in v0.2 via the reporter package.
 */

import chalk from 'chalk';

import {
  countBySeverity,
  gradeWithCriticalPenalty,
  sortByPriority,
  type WcagFinding,
  type WcagGrade,
  type WcagSeverity,
} from '@sdet-wcag-toolkit/core';

export interface ConsoleReportOptions {
  readonly top?: number;
}

export function formatConsoleReport(
  findings: readonly WcagFinding[],
  options: ConsoleReportOptions = {},
): string {
  const grade = gradeWithCriticalPenalty(findings);
  const breakdown = countBySeverity(findings);
  const lines: string[] = [];

  lines.push(header(grade, breakdown.total));
  lines.push('');
  lines.push(severityLine(breakdown));

  if (findings.length === 0) {
    lines.push('');
    lines.push(chalk.green('✓ No static WCAG issues detected.'));
    return lines.join('\n');
  }

  const top = options.top ?? 10;
  const sorted = sortByPriority(findings).slice(0, top);
  lines.push('');
  lines.push(chalk.bold(`Top ${sorted.length} findings (by priority):`));
  lines.push('');
  for (const finding of sorted) {
    lines.push(formatFinding(finding));
  }

  if (findings.length > sorted.length) {
    lines.push('');
    lines.push(
      chalk.dim(`…and ${findings.length - sorted.length} more. Use --json for the full list.`),
    );
  }

  return lines.join('\n');
}

function header(grade: WcagGrade, total: number): string {
  const label = chalk.bold('WCAG 2.2 AA audit');
  const gradeBlock = chalk.bold(gradeColor(grade)(` ${grade} `));
  const count = total === 1 ? '1 finding' : `${total} findings`;
  return `${label}  ${gradeBlock}  ${chalk.dim(count)}`;
}

function severityLine(breakdown: ReturnType<typeof countBySeverity>): string {
  return [
    chalk.red(`Critical: ${breakdown.critical}`),
    chalk.redBright(`Serious: ${breakdown.serious}`),
    chalk.yellow(`Moderate: ${breakdown.moderate}`),
    chalk.blue(`Minor: ${breakdown.minor}`),
  ].join('   ');
}

function formatFinding(finding: WcagFinding): string {
  const sev = severityTag(finding.severity);
  const sc = chalk.cyan(`SC ${finding.successCriterion.id}`);
  const location = formatLocation(finding);
  const rule = chalk.dim(`[${finding.ruleId}]`);
  const lines = [`${sev} ${sc} ${rule} ${location}`, `    ${finding.message}`];
  if (finding.remediation) {
    lines.push(chalk.dim(`    → ${finding.remediation}`));
  }
  return lines.join('\n');
}

function formatLocation(finding: WcagFinding): string {
  const loc = finding.location;
  if (loc.file) {
    const lineInfo = loc.line ? `:${loc.line}` : '';
    return chalk.dim(`${loc.file}${lineInfo}`);
  }
  if (loc.url) {
    const sel = loc.selector ? ` ${loc.selector}` : '';
    return chalk.dim(`${loc.url}${sel}`);
  }
  return '';
}

function severityTag(severity: WcagSeverity): string {
  switch (severity) {
    case 'critical':
      return chalk.bgRed.white.bold(' CRIT ');
    case 'serious':
      return chalk.bgRedBright.white.bold(' SERI ');
    case 'moderate':
      return chalk.bgYellow.black.bold(' MOD  ');
    case 'minor':
      return chalk.bgBlue.white.bold(' MIN  ');
  }
}

function gradeColor(grade: WcagGrade): (s: string) => string {
  switch (grade) {
    case 'A':
      return chalk.bgGreen.black;
    case 'B':
      return chalk.bgGreenBright.black;
    case 'C':
      return chalk.bgYellow.black;
    case 'D':
      return chalk.bgYellowBright.black;
    case 'F':
      return chalk.bgRed.white;
  }
}
