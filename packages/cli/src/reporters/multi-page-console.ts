/**
 * Terminal-friendly reporter for multi-page audits.
 *
 * Layout:
 *
 *   1. Headline grade + summary (audited/skipped/findings/time).
 *   2. Heat map: pages × severity counts, sorted by total.
 *   3. Top cross-page findings, sorted by reach (affected page count).
 *   4. Skipped pages, grouped by reason.
 *
 * Returns one string so callers can pipe to console.log or capture
 * for tests. Color is applied via chalk; identical to the terminal
 * console.ts conventions.
 */

import chalk from 'chalk';

import {
  countBySeverity,
  type CrossPageFinding,
  type MultiPageAuditReport,
  type PageAuditResult,
  type PageSkipReason,
  type SeverityBreakdown,
  type WcagSeverity,
} from '@sdet-wcag-toolkit/core';

export interface MultiPageConsoleOptions {
  /** How many cross-page findings to print at the top. Default 10. */
  readonly topCount?: number;
  /** How many pages to include in the heat map. Default 15. */
  readonly heatMapLimit?: number;
}

export function formatMultiPageConsoleReport(
  report: MultiPageAuditReport,
  options: MultiPageConsoleOptions = {},
): string {
  const topCount = options.topCount ?? 10;
  const heatMapLimit = options.heatMapLimit ?? 15;
  const lines: string[] = [];

  lines.push(...renderHeader(report));
  lines.push('');
  lines.push(...renderHeatMap(report.pages, heatMapLimit));

  if (report.crossPage.length > 0) {
    lines.push('');
    lines.push(...renderTopCrossPage(report.crossPage, topCount));
  }

  const skipped = report.pages.filter((p) => p.skipped !== undefined);
  if (skipped.length > 0) {
    lines.push('');
    lines.push(...renderSkipped(skipped));
  }

  return lines.join('\n');
}

function renderHeader(report: MultiPageAuditReport): string[] {
  const { summary } = report;
  return [
    chalk.bold(
      `Multi-page WCAG audit - ${summary.pagesAudited} audited · ${summary.pagesSkipped} skipped · ${summary.uniqueFindings} unique finding(s) (${summary.totalFindings} occurrence(s))`,
    ),
    chalk.dim(
      `Base URL: ${report.baseUrl}  ·  strategy: ${report.discovery.strategy} (confidence ${report.discovery.confidence.toFixed(2)})  ·  ${(report.totalDurationMs / 1000).toFixed(1)}s`,
    ),
  ];
}

function renderHeatMap(pages: readonly PageAuditResult[], limit: number): string[] {
  const lines: string[] = [chalk.bold('Heat map (pages × severity):')];
  if (pages.length === 0) {
    lines.push(chalk.dim('  (no pages)'));
    return lines;
  }

  const rows = pages.map((page) => ({
    page,
    breakdown: countBySeverity(page.findings),
  }));
  // Worst offenders first; pages with zero findings still appear so the
  // user sees the full set, but get pushed to the bottom.
  rows.sort((a, b) => b.breakdown.total - a.breakdown.total);
  const visible = rows.slice(0, limit);
  const truncated = rows.length - visible.length;

  // Column width for path: cap at 50 to keep the table readable.
  const widest = Math.min(
    50,
    Math.max(4, ...visible.map((r) => r.page.discoveredRoute.path.length)),
  );

  lines.push(
    chalk.dim(
      `  ${'PAGE'.padEnd(widest)}   ${'CRIT'.padStart(4)}  ${'SERI'.padStart(4)}  ${'MOD'.padStart(4)}  ${'MIN'.padStart(4)}  ${'TOTAL'.padStart(5)}`,
    ),
  );
  for (const { page, breakdown } of visible) {
    const path = truncatePath(page.discoveredRoute.path, widest);
    const skipped = page.skipped !== undefined;
    const pathRender = skipped ? chalk.strikethrough(chalk.dim(path)) : path;
    lines.push(
      `  ${pathRender.padEnd(widest + (skipped ? 9 : 0))}   ${cellCritical(breakdown.critical).padStart(4)}  ${cellSerious(breakdown.serious).padStart(4)}  ${cellModerate(breakdown.moderate).padStart(4)}  ${cellMinor(breakdown.minor).padStart(4)}  ${chalk.bold(String(breakdown.total)).padStart(5)}`,
    );
  }
  if (truncated > 0) {
    lines.push(chalk.dim(`  …+${truncated} more page(s) (use --json for the full list)`));
  }
  return lines;
}

function renderTopCrossPage(crossPage: readonly CrossPageFinding[], top: number): string[] {
  const sorted = [...crossPage].sort((a, b) => b.affectedPages.length - a.affectedPages.length);
  const visible = sorted.slice(0, top);
  const lines: string[] = [chalk.bold(`Top ${visible.length} cross-page findings:`)];
  for (const entry of visible) {
    const sev = severityTag(entry.finding.severity);
    const reach = chalk.bold(`${entry.affectedPages.length} page(s)`);
    lines.push(
      `  ${sev} ${chalk.cyan(`SC ${entry.finding.successCriterion.id}`)} ${chalk.dim(`[${entry.finding.ruleId}]`)} - ${reach}`,
    );
    lines.push(`      ${entry.finding.message}`);
    if (entry.finding.location.file) {
      const lineRef = entry.finding.location.line ? `:${entry.finding.location.line}` : '';
      lines.push(chalk.dim(`      ↳ ${entry.finding.location.file}${lineRef}`));
    } else if (entry.finding.location.selector) {
      lines.push(chalk.dim(`      ↳ ${entry.finding.location.selector}`));
    }
    const sample = entry.affectedPages.slice(0, 3);
    for (const url of sample) lines.push(chalk.dim(`        • ${url}`));
    if (entry.affectedPages.length > sample.length) {
      lines.push(chalk.dim(`        …+${entry.affectedPages.length - sample.length} more`));
    }
  }
  if (sorted.length > visible.length) {
    lines.push(
      chalk.dim(`  …+${sorted.length - visible.length} more (use --json for the full list)`),
    );
  }
  return lines;
}

function renderSkipped(skipped: readonly PageAuditResult[]): string[] {
  const lines: string[] = [chalk.yellow.bold(`Skipped (${skipped.length}):`)];
  // Group by reason so users see "ah, 12 dynamic-no-sample, 1 runner-error"
  // at a glance.
  const groups = new Map<PageSkipReason, PageAuditResult[]>();
  for (const page of skipped) {
    const reason = page.skipped?.reason ?? 'runner-error';
    const list = groups.get(reason) ?? [];
    list.push(page);
    groups.set(reason, list);
  }
  for (const [reason, group] of groups) {
    lines.push(chalk.yellow(`  ${reason} (${group.length}):`));
    for (const page of group.slice(0, 5)) {
      lines.push(chalk.dim(`    ! ${page.discoveredRoute.path} - ${page.skipped?.note ?? ''}`));
    }
    if (group.length > 5) {
      lines.push(chalk.dim(`    …+${group.length - 5} more`));
    }
  }
  return lines;
}

function truncatePath(path: string, width: number): string {
  if (path.length <= width) return path;
  return `${path.slice(0, width - 1)}…`;
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

function cellCritical(n: number): string {
  return n === 0 ? chalk.dim('-') : chalk.red.bold(String(n));
}
function cellSerious(n: number): string {
  return n === 0 ? chalk.dim('-') : chalk.redBright(String(n));
}
function cellModerate(n: number): string {
  return n === 0 ? chalk.dim('-') : chalk.yellow(String(n));
}
function cellMinor(n: number): string {
  return n === 0 ? chalk.dim('-') : chalk.blue(String(n));
}

// Re-export SeverityBreakdown shape for tests that build fixtures.
export type { SeverityBreakdown };
