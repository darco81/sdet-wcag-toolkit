/**
 * Multi-page markdown reporter.
 *
 * Renders a `MultiPageAuditReport` as plain markdown - no HTML, so it
 * drops into PR descriptions, GitHub issues, and internal wikis without
 * surprises. Sections, in order:
 *
 *   1. Header (baseUrl, strategy, totals, time).
 *   2. Heat map: per-page severity counts, sorted by total impact.
 *   3. Top cross-page findings - the "single fix → many pages green"
 *      callout. Sorted by `affectedPages.length` DESC.
 *   4. Per-page details (collapsed when there are many).
 *   5. Skipped routes (always shown - users want to know what was
 *      excluded and why).
 */

import {
  countBySeverity,
  type CrossPageFinding,
  type MultiPageAuditReport,
  type PageAuditResult,
  type SeverityBreakdown,
  type WcagFinding,
  type WcagSeverity,
} from '@sdet-wcag-toolkit/core';

export interface MultiPageDevReportOptions {
  readonly title?: string;
  /** How many cross-page findings to call out at the top. Default 10. */
  readonly topCount?: number;
  /**
   * Threshold for collapsing the per-page section. When `pages.length`
   * exceeds this, individual page details are rendered in a `<details>`
   * block so the report stays scannable. Default 20.
   */
  readonly perPageCollapseThreshold?: number;
}

const PRINCIPLES = ['perceivable', 'operable', 'understandable', 'robust'] as const;

export function formatMultiPageDevReport(
  report: MultiPageAuditReport,
  options: MultiPageDevReportOptions = {},
): string {
  const title = options.title ?? 'Multi-page WCAG 2.2 AA audit';
  const topCount = options.topCount ?? 10;
  const collapseThreshold = options.perPageCollapseThreshold ?? 20;

  const lines: string[] = [];
  lines.push(...renderHeader(title, report));
  lines.push(...renderHeatMap(report.pages));
  lines.push(...renderCrossPageSection(report.crossPage, topCount));
  lines.push(...renderPerPageSection(report.pages, collapseThreshold));
  lines.push(...renderSkippedSection(report.pages));
  return lines.join('\n') + '\n';
}

function renderHeader(title: string, report: MultiPageAuditReport): string[] {
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`**Base URL:** \`${report.baseUrl}\``);
  lines.push(
    `**Discovery:** \`${report.discovery.strategy}\` - ${report.discovery.routes.length} route(s) (confidence ${report.discovery.confidence.toFixed(2)})`,
  );
  lines.push(
    `**Audited:** ${report.summary.pagesAudited} page(s) · **Skipped:** ${report.summary.pagesSkipped} · **Time:** ${(report.totalDurationMs / 1000).toFixed(1)}s`,
  );
  lines.push(
    `**Findings:** ${report.summary.uniqueFindings} unique across ${report.summary.totalFindings} occurrence(s)`,
  );
  lines.push('');

  if (report.discovery.warnings.length > 0) {
    lines.push('> **Discovery warnings:**');
    for (const warning of report.discovery.warnings) {
      lines.push(`> - ${warning}`);
    }
    lines.push('');
  }
  return lines;
}

/**
 * Heat map: pages × severity counts. Skipped pages still appear so the
 * reader sees the full route set; their counts are zero. Sorted by
 * total findings DESC so the worst offenders bubble to the top.
 */
function renderHeatMap(pages: readonly PageAuditResult[]): string[] {
  const lines: string[] = [];
  lines.push('## Heat map');
  lines.push('');
  if (pages.length === 0) {
    lines.push('_No pages were discovered._');
    lines.push('');
    return lines;
  }

  lines.push('| Page | Critical | Serious | Moderate | Minor | Total |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: |');

  const rows = pages.map((page) => ({
    page,
    breakdown: countBySeverity(page.findings),
  }));
  rows.sort((a, b) => b.breakdown.total - a.breakdown.total);

  for (const { page, breakdown } of rows) {
    const label =
      page.skipped !== undefined
        ? `~~${escapeMd(page.discoveredRoute.path)}~~`
        : `\`${escapeMd(page.discoveredRoute.path)}\``;
    lines.push(
      `| ${label} | ${breakdown.critical} | ${breakdown.serious} | ${breakdown.moderate} | ${breakdown.minor} | **${breakdown.total}** |`,
    );
  }
  lines.push('');
  return lines;
}

/**
 * Top cross-page findings. The narrative is "fix this once, X pages
 * pass" - so we sort by `affectedPages.length` and show the count
 * prominently.
 */
function renderCrossPageSection(
  crossPage: readonly CrossPageFinding[],
  topCount: number,
): string[] {
  const lines: string[] = [];
  lines.push('## Cross-page findings');
  lines.push('');
  if (crossPage.length === 0) {
    lines.push('_No findings spanned multiple pages._');
    lines.push('');
    return lines;
  }

  const sorted = [...crossPage].sort((a, b) => b.affectedPages.length - a.affectedPages.length);
  const multi = sorted.filter((cp) => cp.affectedPages.length > 1);
  if (multi.length > 0) {
    lines.push(
      `> **Single fix → many pages green:** ${multi.length} finding(s) appear on more than one page.`,
    );
    lines.push('');
  }

  const top = sorted.slice(0, topCount);
  lines.push(`### Top ${top.length} by reach`);
  lines.push('');
  for (const entry of top) {
    lines.push(...renderCrossPageEntry(entry));
    lines.push('');
  }

  if (sorted.length > top.length) {
    lines.push(`_…and ${sorted.length - top.length} more in the per-page sections below._`);
    lines.push('');
  }
  return lines;
}

function renderCrossPageEntry(entry: CrossPageFinding): string[] {
  const f = entry.finding;
  const sev = severityBadge(f.severity);
  const lines: string[] = [];
  lines.push(
    `- ${sev} **\`${f.ruleId}\`** (SC ${f.successCriterion.id}) - affects **${entry.affectedPages.length}** page(s)`,
  );
  lines.push(`  - ${escapeMd(f.message)}`);
  if (f.location.file !== undefined) {
    const lineRef = f.location.line !== undefined ? `:${f.location.line}` : '';
    lines.push(`  - Source: \`${f.location.file}${lineRef}\``);
  } else if (f.location.selector !== undefined) {
    lines.push(`  - Selector: \`${f.location.selector}\``);
  }
  if (f.remediation) {
    lines.push(`  - Fix: ${escapeMd(f.remediation)}`);
  }
  const sample = entry.affectedPages.slice(0, 5);
  lines.push(
    `  - Pages: ${sample.map((u) => `\`${u}\``).join(', ')}${entry.affectedPages.length > 5 ? `, …+${entry.affectedPages.length - 5} more` : ''}`,
  );
  return lines;
}

/**
 * Per-page detail section. Collapsed inside `<details>` when the route
 * count gets large so a 200-page audit doesn't overwhelm the reader.
 */
function renderPerPageSection(
  pages: readonly PageAuditResult[],
  collapseThreshold: number,
): string[] {
  const lines: string[] = [];
  const audited = pages.filter((p) => p.skipped === undefined);
  if (audited.length === 0) return lines;

  lines.push('## Per-page details');
  lines.push('');

  const collapse = audited.length > collapseThreshold;
  if (collapse) {
    lines.push(`<details><summary>${audited.length} page(s) - click to expand</summary>`);
    lines.push('');
  }

  for (const page of audited) {
    lines.push(...renderPageBlock(page));
    lines.push('');
  }

  if (collapse) {
    lines.push('</details>');
    lines.push('');
  }
  return lines;
}

function renderPageBlock(page: PageAuditResult): string[] {
  const lines: string[] = [];
  const url = page.auditedUrl ?? page.discoveredRoute.path;
  const breakdown = countBySeverity(page.findings);
  lines.push(
    `### \`${escapeMd(page.discoveredRoute.path)}\` - ${breakdown.total} finding(s) · ${(page.durationMs / 1000).toFixed(1)}s`,
  );
  lines.push('');
  lines.push(`- Audited URL: ${url}`);
  lines.push(`- Severity: ${renderSeverityInline(breakdown)}`);
  if (page.findings.length === 0) {
    lines.push('- _No findings on this page._');
    return lines;
  }

  for (const principle of PRINCIPLES) {
    const group = page.findings.filter((f) => f.successCriterion.principle === principle);
    if (group.length === 0) continue;
    lines.push('');
    lines.push(`**${capitalize(principle)} (${group.length})**`);
    lines.push('');
    for (const finding of group) {
      lines.push(...renderFindingListItem(finding));
    }
  }
  return lines;
}

function renderFindingListItem(finding: WcagFinding): string[] {
  const sev = severityBadge(finding.severity);
  const lines: string[] = [];
  const location = finding.location.file
    ? `\`${finding.location.file}${finding.location.line !== undefined ? `:${finding.location.line}` : ''}\``
    : finding.location.selector
      ? `\`${finding.location.selector}\``
      : '_no location_';
  lines.push(`- ${sev} \`${finding.ruleId}\` (SC ${finding.successCriterion.id}) at ${location}`);
  lines.push(`  - ${escapeMd(finding.message)}`);
  if (finding.remediation) {
    lines.push(`  - Fix: ${escapeMd(finding.remediation)}`);
  }
  return lines;
}

function renderSkippedSection(pages: readonly PageAuditResult[]): string[] {
  const skipped = pages.filter((p) => p.skipped !== undefined);
  if (skipped.length === 0) return [];

  const lines: string[] = [];
  lines.push(`## Skipped routes (${skipped.length})`);
  lines.push('');
  lines.push('| Route | Reason | Note |');
  lines.push('| --- | --- | --- |');
  for (const page of skipped) {
    const reason = page.skipped?.reason ?? 'unknown';
    const note = page.skipped?.note ?? '';
    lines.push(
      `| \`${escapeMd(page.discoveredRoute.path)}\` | \`${reason}\` | ${escapeMd(note)} |`,
    );
  }
  lines.push('');
  return lines;
}

function severityBadge(severity: WcagSeverity): string {
  switch (severity) {
    case 'critical':
      return '**`CRIT`**';
    case 'serious':
      return '**`SERI`**';
    case 'moderate':
      return '`MOD`';
    case 'minor':
      return '`MIN`';
  }
}

function renderSeverityInline(breakdown: SeverityBreakdown): string {
  const parts: string[] = [];
  if (breakdown.critical > 0) parts.push(`**${breakdown.critical} critical**`);
  if (breakdown.serious > 0) parts.push(`${breakdown.serious} serious`);
  if (breakdown.moderate > 0) parts.push(`${breakdown.moderate} moderate`);
  if (breakdown.minor > 0) parts.push(`${breakdown.minor} minor`);
  return parts.length === 0 ? '_clean_' : parts.join(' · ');
}

/**
 * Escape characters that would break markdown table cells or
 * surrounding code-fence pairs. Conservative: backticks become escaped
 * ones, pipes become entities so they don't terminate a table row, and
 * raw underscores in identifiers stay readable inside code spans.
 */
function escapeMd(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
