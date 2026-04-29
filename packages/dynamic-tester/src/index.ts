export type {
  BrowserEngine,
  BrowserOptions,
  DynamicRunner,
  DynamicTarget,
  RunnerContext,
} from './types.js';
export { BrowserManager } from './browser-manager.js';
export type { AxeRunnerOptions } from './runners/axe-runner.js';
export { AXE_WCAG_TAGS, AxeRunner } from './runners/axe-runner.js';
export { KeyboardFlowRunner } from './runners/keyboard-flow.js';
export { FocusVisibilityRunner } from './runners/focus-visibility.js';
export type { DynamicAuditOptions } from './orchestrator.js';
export { DynamicTesterOrchestrator, createDefaultDynamicOrchestrator } from './orchestrator.js';

export type {
  MultiPageAuditOptions,
  PageAuditFn,
  PageAuditOutcome,
  RunMultiPageInput,
} from './multi-page-orchestrator.js';
export {
  MultiPageOrchestrator,
  createMultiPageOrchestrator,
  resolveAuditUrl,
} from './multi-page-orchestrator.js';

export { buildCrossPageFindings, groupingKey } from './cross-page-dedup.js';
