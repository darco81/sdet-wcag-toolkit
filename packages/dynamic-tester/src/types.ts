/**
 * Shared types for the dynamic tester.
 *
 * Dynamic analysis runs against a live URL (or local HTML served through a
 * Playwright route) and returns findings in the same `WcagFinding` shape
 * the static analyzer emits, so the two pipelines compose cleanly.
 */

import type { WcagFinding } from '@sdet-wcag-toolkit/core';

/** Browser engines Playwright can drive. */
export type BrowserEngine = 'chromium' | 'firefox' | 'webkit';

export interface BrowserOptions {
  /** Browser engine. Defaults to chromium - fastest and most predictable. */
  readonly engine?: BrowserEngine;
  /** Headless (default `true`). Set `false` for debugging runs. */
  readonly headless?: boolean;
  /** Navigation timeout in ms. */
  readonly timeoutMs?: number;
  /** Viewport to open the page in. */
  readonly viewport?: { width: number; height: number };
  /** User agent override. Rarely needed; useful for debugging a11y tools
   *  that behave differently by UA. */
  readonly userAgent?: string;
}

/** Target for a dynamic audit: a page URL plus per-run options. */
export interface DynamicTarget {
  readonly url: string;
  /** Extra wait after navigation (e.g. for SPA hydration). */
  readonly waitForMs?: number;
  /** CSS selector to wait for before starting the audit. */
  readonly waitForSelector?: string;
}

/**
 * A single dynamic runner: orchestrator gives it a ready-to-analyze page,
 * runner returns findings. Runners are framework-agnostic - they see the
 * rendered DOM, not the source tree.
 */
export interface DynamicRunner {
  readonly name: string;
  /** Run against the supplied page (already navigated + settled). */
  run(context: RunnerContext): Promise<WcagFinding[]>;
}

/** Passed to each runner. Deliberately thin to keep runners decoupled. */
export interface RunnerContext {
  /** Playwright Page. Left as `unknown` here to avoid leaking the type
   *  through public surfaces; runners cast it internally. */
  readonly page: unknown;
  readonly url: string;
}
