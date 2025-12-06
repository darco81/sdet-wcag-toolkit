/**
 * Convenience factory wiring every built-in analyzer in one orchestrator.
 *
 * Callers who want a reduced or custom pipeline can build their own
 * {@link StaticAnalyzerOrchestrator} instead.
 */

import { ariaAnalyzer } from './analyzers/aria.js';
import { contrastAnalyzer } from './analyzers/contrast.js';
import { keyboardAnalyzer } from './analyzers/keyboard.js';
import { semanticAnalyzer } from './analyzers/semantic.js';
import { StaticAnalyzerOrchestrator } from './orchestrator.js';

export function createDefaultOrchestrator(): StaticAnalyzerOrchestrator {
  return new StaticAnalyzerOrchestrator()
    .register(semanticAnalyzer)
    .register(ariaAnalyzer)
    .register(keyboardAnalyzer)
    .register(contrastAnalyzer);
}
