/**
 * Multi-page audit orchestrator.
 *
 * Wraps the single-page DynamicTesterOrchestrator with route iteration.
 * The browser stays open across pages - starting Chromium per route
 * would dominate the audit time on any non-trivial site. Per-page work
 * (navigate + run all dynamic runners) is sequential because the
 * runners themselves are not concurrency-safe (keyboard-flow drives
 * Tab while focus-visibility reads computed styles).
 *
 * The audit-page function is injected so unit tests can drive the
 * orchestrator without a real browser. Production wires the default
 * `auditOnePage` impl which builds a `BrowserManager` once and calls
 * the registered runners in order.
 */

import type {
  DiscoveredRoute,
  MultiPageAuditReport,
  PageAuditResult,
  PageSkipReason,
  RouteDiscoveryResult,
  WcagFinding,
} from '@sdet-wcag-toolkit/core';

import { BrowserManager } from './browser-manager.js';
import { buildCrossPageFindings } from './cross-page-dedup.js';
import { AxeRunner } from './runners/axe-runner.js';
import { FocusVisibilityRunner } from './runners/focus-visibility.js';
import { KeyboardFlowRunner } from './runners/keyboard-flow.js';
import type { BrowserOptions, DynamicRunner, DynamicTarget, RunnerContext } from './types.js';

export interface MultiPageAuditOptions {
  /** Replace the default runner set across every page. */
  readonly runners?: readonly DynamicRunner[];
  readonly browser?: BrowserOptions;
  /**
   * Internal seam for tests. Production leaves this unset and the
   * orchestrator uses the real BrowserManager-backed implementation.
   */
  readonly auditPage?: PageAuditFn;
  /**
   * Per-page wait/selector hints applied to every navigation. Useful
   * when the same SPA needs the same hydration wait everywhere.
   */
  readonly pageDefaults?: Pick<DynamicTarget, 'waitForMs' | 'waitForSelector'>;
  /**
   * Cleanup hook invoked from `run()`'s `finally` block - exactly once
   * per `run()` call, regardless of success or failure. Tests inject a
   * spy alongside `auditPage`; production wires it automatically when
   * the default Playwright pipeline is used (`BrowserManager.stop()`).
   */
  readonly cleanup?: () => Promise<void>;
  /**
   * Soft cap for the cleanup hook in milliseconds. If `cleanup()` does
   * not resolve within this many ms the orchestrator gives up and
   * resolves anyway. Prevents a hung `browser.close()` from blocking
   * the entire CLI process. Defaults to 10 000 ms.
   */
  readonly cleanupTimeoutMs?: number;
}

const DEFAULT_CLEANUP_TIMEOUT_MS = 10_000;
const noopCleanup = async (): Promise<void> => {};

/**
 * Result of auditing one page. Either findings + duration, or a skip
 * with reason. Errors during navigation/runners surface as a `runner-error`
 * skip with the message in `note`.
 */
export type PageAuditOutcome =
  | {
      readonly kind: 'audited';
      readonly findings: readonly WcagFinding[];
      readonly durationMs: number;
    }
  | {
      readonly kind: 'skipped';
      readonly reason: PageSkipReason;
      readonly note: string;
      readonly durationMs: number;
    };

/**
 * Function signature for auditing a single page. The orchestrator owns
 * route iteration; the audit fn owns "navigate + run runners". Tests
 * substitute a synchronous fake; production wires the real Playwright
 * pipeline.
 */
export type PageAuditFn = (input: {
  readonly target: DynamicTarget;
  readonly route: DiscoveredRoute;
}) => Promise<PageAuditOutcome>;

export interface RunMultiPageInput {
  readonly baseUrl: string;
  readonly discovery: RouteDiscoveryResult;
  /**
   * Hard cap on pages actually audited. Routes beyond this count are
   * recorded with `skipped.reason = 'max-pages'`. 0 means no limit.
   */
  readonly maxPages?: number;
}

export class MultiPageOrchestrator {
  private readonly runners: DynamicRunner[];
  private readonly browserOptions: BrowserOptions;
  private readonly auditPage: PageAuditFn;
  private readonly pageDefaults: Pick<DynamicTarget, 'waitForMs' | 'waitForSelector'>;
  private readonly cleanup: () => Promise<void>;
  private readonly cleanupTimeoutMs: number;

  constructor(options: MultiPageAuditOptions = {}) {
    this.runners = options.runners
      ? [...options.runners]
      : [new AxeRunner(), new KeyboardFlowRunner(), new FocusVisibilityRunner()];
    this.browserOptions = options.browser ?? {};
    this.pageDefaults = options.pageDefaults ?? {};
    this.cleanupTimeoutMs = options.cleanupTimeoutMs ?? DEFAULT_CLEANUP_TIMEOUT_MS;

    if (options.auditPage) {
      this.auditPage = options.auditPage;
      this.cleanup = options.cleanup ?? noopCleanup;
    } else {
      const pipeline = this.buildDefaultPipeline();
      this.auditPage = pipeline.audit;
      this.cleanup = options.cleanup ?? pipeline.cleanup;
    }
  }

  list(): string[] {
    return this.runners.map((r) => r.name);
  }

  async run(input: RunMultiPageInput): Promise<MultiPageAuditReport> {
    const totalStart = Date.now();
    const baseUrl = stripTrailingSlash(input.baseUrl);
    const cap = normaliseCap(input.maxPages);

    const pages: PageAuditResult[] = [];
    let auditedCount = 0;

    try {
      for (const route of input.discovery.routes) {
        // Honor max-pages - record overflow as skipped so the report
        // surfaces what the user truncated away.
        if (cap !== undefined && auditedCount >= cap) {
          pages.push({
            discoveredRoute: route,
            findings: [],
            durationMs: 0,
            skipped: {
              reason: 'max-pages',
              note: `--max-pages=${cap} cap reached; remaining routes skipped.`,
            },
          });
          continue;
        }

        const url = resolveAuditUrl(baseUrl, route);
        if (url === null) {
          pages.push({
            discoveredRoute: route,
            findings: [],
            durationMs: 0,
            skipped: {
              reason: 'dynamic-no-sample',
              note:
                `Dynamic route ${route.path} has no sample URL. ` +
                `Try --strategy=sitemap (post-build URLs), --strategy=ai (resolve from content collections), ` +
                `or --strategy=json-config with explicit URLs in wcag.config.json.`,
            },
          });
          continue;
        }

        const outcome = await this.auditPage({
          target: { url, ...this.pageDefaults },
          route,
        });

        if (outcome.kind === 'skipped') {
          pages.push({
            discoveredRoute: route,
            auditedUrl: url,
            findings: [],
            durationMs: outcome.durationMs,
            skipped: { reason: outcome.reason, note: outcome.note },
          });
        } else {
          pages.push({
            discoveredRoute: route,
            auditedUrl: url,
            findings: outcome.findings,
            durationMs: outcome.durationMs,
          });
          auditedCount += 1;
        }
      }

      const crossPage = buildCrossPageFindings(pages);
      const totalDurationMs = Date.now() - totalStart;
      const auditedPages = pages.filter((p) => p.skipped === undefined);
      const totalFindings = auditedPages.reduce((acc, p) => acc + p.findings.length, 0);

      return {
        baseUrl,
        discovery: input.discovery,
        pages,
        crossPage,
        totalDurationMs,
        summary: {
          pagesAudited: auditedPages.length,
          pagesSkipped: pages.length - auditedPages.length,
          totalFindings,
          uniqueFindings: crossPage.length,
        },
      };
    } finally {
      await this.runCleanup();
    }
  }

  /**
   * Invokes the cleanup hook with two safety nets:
   *
   *   - `Promise.race` against a timeout so a hung Playwright
   *     `browser.close()` cannot block the CLI process forever.
   *   - try/catch swallowing - cleanup errors are non-fatal and must
   *     not poison the report.
   */
  private async runCleanup(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.cleanup(),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, this.cleanupTimeoutMs);
        }),
      ]);
    } catch {
      // Intentionally swallowed - cleanup failures (closed browser, lost
      // connection, etc.) shouldn't break a successful audit report.
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Real audit pipeline - keeps the browser open across pages. The
   * first audit call lazily starts the browser; subsequent calls reuse
   * the same Page. The paired `cleanup` closes everything when the
   * orchestrator's `run()` finishes (success OR failure path).
   *
   * In Phase 6 we keep this simple: one browser, one page, sequential
   * navigation. Pro tier (V0.4 alpha.4) layers parallelism via
   * BrowserContext-per-page.
   */
  private buildDefaultPipeline(): { audit: PageAuditFn; cleanup: () => Promise<void> } {
    let manager: BrowserManager | null = null;
    const audit: PageAuditFn = async ({ target }) => {
      const start = Date.now();
      try {
        if (!manager) {
          manager = new BrowserManager(this.browserOptions);
          await manager.start();
        }
        const page = await manager.navigate(target);
        const findings: WcagFinding[] = [];
        const seen = new Set<string>();
        const ctx: RunnerContext = { page, url: target.url };
        for (const runner of this.runners) {
          const out = await runner.run(ctx);
          for (const f of out) {
            if (seen.has(f.id)) continue;
            seen.add(f.id);
            findings.push(f);
          }
        }
        return { kind: 'audited', findings, durationMs: Date.now() - start };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          kind: 'skipped',
          reason: 'runner-error',
          note: message,
          durationMs: Date.now() - start,
        };
      }
    };
    const cleanup = async (): Promise<void> => {
      if (!manager) return;
      const m = manager;
      manager = null;
      await m.stop();
    };
    return { audit, cleanup };
  }
}

/**
 * Resolve the URL to actually audit for a discovered route.
 *
 *   - Static path "/about"     → `${baseUrl}/about`
 *   - Dynamic with sampleUrl   → respect sampleUrl (absolute or rooted)
 *   - Dynamic without sample   → null (caller skips)
 */
export function resolveAuditUrl(baseUrl: string, route: DiscoveredRoute): string | null {
  if (route.isDynamic) {
    if (!route.sampleUrl) return null;
    if (/^https?:\/\//.test(route.sampleUrl)) return route.sampleUrl;
    return `${baseUrl}${ensureLeadingSlash(route.sampleUrl)}`;
  }
  return `${baseUrl}${ensureLeadingSlash(route.path)}`;
}

function ensureLeadingSlash(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function normaliseCap(maxPages: number | undefined): number | undefined {
  if (maxPages === undefined || maxPages <= 0) return undefined;
  return maxPages;
}

/** Convenience factory matching the single-page orchestrator's pattern. */
export function createMultiPageOrchestrator(
  options: MultiPageAuditOptions = {},
): MultiPageOrchestrator {
  return new MultiPageOrchestrator(options);
}
