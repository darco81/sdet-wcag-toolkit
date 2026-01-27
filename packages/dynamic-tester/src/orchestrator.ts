/**
 * Dynamic orchestrator: owns the browser, navigates to a target, and runs
 * every registered {@link DynamicRunner} against the page.
 *
 * Runners are invoked sequentially. Parallel execution is tempting but
 * burns isolation - `keyboard-flow` hammers `Tab` while `focus-visibility`
 * reads `getComputedStyle`; they can't share a page safely. Sequential
 * runs are deterministic and the overhead is negligible on real audits.
 */

import type { WcagFinding } from '@sdet-wcag-toolkit/core';

import { BrowserManager } from './browser-manager.js';
import { AxeRunner } from './runners/axe-runner.js';
import { FocusVisibilityRunner } from './runners/focus-visibility.js';
import { KeyboardFlowRunner } from './runners/keyboard-flow.js';
import type { BrowserOptions, DynamicRunner, DynamicTarget } from './types.js';

export interface DynamicAuditOptions {
  readonly browser?: BrowserOptions;
  /** Replace the default runner set. */
  readonly runners?: readonly DynamicRunner[];
}

export class DynamicTesterOrchestrator {
  private readonly runners: DynamicRunner[];
  private readonly browserOptions: BrowserOptions;

  constructor(options: DynamicAuditOptions = {}) {
    this.runners = options.runners
      ? [...options.runners]
      : [new AxeRunner(), new KeyboardFlowRunner(), new FocusVisibilityRunner()];
    this.browserOptions = options.browser ?? {};
  }

  /** Registered runner names in dispatch order. */
  list(): string[] {
    return this.runners.map((r) => r.name);
  }

  /**
   * Run every registered runner against `target`. Findings are merged and
   * deduplicated by id so overlaps (e.g. axe and keyboard-flow both
   * flagging a `tabindex="1"`) collapse to one entry.
   */
  async run(target: DynamicTarget): Promise<WcagFinding[]> {
    const manager = new BrowserManager(this.browserOptions);
    const merged: WcagFinding[] = [];
    const seen = new Set<string>();
    try {
      await manager.start();
      const page = await manager.navigate(target);
      const context = { page, url: target.url };
      for (const runner of this.runners) {
        const findings = await runner.run(context);
        for (const finding of findings) {
          if (seen.has(finding.id)) continue;
          seen.add(finding.id);
          merged.push(finding);
        }
      }
    } finally {
      await manager.stop();
    }
    return merged;
  }
}

/** Build an orchestrator with the default (Axe + keyboard-flow + focus-visibility). */
export function createDefaultDynamicOrchestrator(
  options: DynamicAuditOptions = {},
): DynamicTesterOrchestrator {
  return new DynamicTesterOrchestrator(options);
}
