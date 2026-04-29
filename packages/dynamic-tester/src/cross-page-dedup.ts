/**
 * Cross-page deduplication.
 *
 * Multi-page audits surface the same source-level issue many times -
 * one component imported on every page produces the same finding per
 * URL. Reporting raw counts is noise; what users want is "this finding
 * affects 12 pages, fix once."
 *
 * Grouping key:
 *   - source-located findings  → ruleId + file + line
 *   - DOM-located findings     → ruleId + selector
 *   - everything else          → ruleId + message (last-resort fallback)
 *
 * The first occurrence wins as the canonical `finding` because the
 * downstream reporter prefers stable IDs.
 */

import type { CrossPageFinding, PageAuditResult, WcagFinding } from '@sdet-wcag-toolkit/core';

interface Bucket {
  readonly canonical: WcagFinding;
  readonly affectedPages: Set<string>;
  count: number;
}

/**
 * Build the cross-page finding list from per-page results. Pages that
 * were skipped contribute nothing. Order is stable by first-seen so
 * snapshot tests stay reliable.
 */
export function buildCrossPageFindings(
  pages: readonly PageAuditResult[],
): readonly CrossPageFinding[] {
  const buckets = new Map<string, Bucket>();
  for (const page of pages) {
    if (page.skipped !== undefined) continue;
    const url = page.auditedUrl ?? page.discoveredRoute.path;
    for (const finding of page.findings) {
      const key = groupingKey(finding);
      const existing = buckets.get(key);
      if (existing) {
        existing.affectedPages.add(url);
        existing.count += 1;
      } else {
        buckets.set(key, {
          canonical: finding,
          affectedPages: new Set([url]),
          count: 1,
        });
      }
    }
  }

  const out: CrossPageFinding[] = [];
  for (const bucket of buckets.values()) {
    out.push({
      finding: bucket.canonical,
      affectedPages: Array.from(bucket.affectedPages).sort(),
      occurrenceCount: bucket.count,
    });
  }
  return out;
}

/**
 * Stable grouping key. Exposed so reporters can derive the same key
 * when correlating fix suggestions back to source.
 */
export function groupingKey(finding: WcagFinding): string {
  const { location, ruleId } = finding;
  if (location.file !== undefined) {
    return `file::${ruleId}::${location.file}::${location.line ?? 0}`;
  }
  if (location.selector !== undefined) {
    return `selector::${ruleId}::${location.selector}`;
  }
  return `fallback::${ruleId}::${finding.message}`;
}
