import { describe, expect, it } from 'vitest';

import type { WcagFinding } from '@sdet-wcag-toolkit/core';
import { requireSuccessCriterion } from '@sdet-wcag-toolkit/core';

import { StaticAnalyzerOrchestrator, emptyContext } from './orchestrator.js';
import type { Analyzer } from './types.js';

function makeFinding(id: string, ruleId: string): WcagFinding {
  return {
    id,
    successCriterion: requireSuccessCriterion('1.3.1'),
    severity: 'moderate',
    message: ruleId,
    location: { file: 't.html', line: 1 },
    source: 'static',
    ruleId,
  };
}

function stubAnalyzer(name: string, findings: WcagFinding[]): Analyzer {
  return { name, analyze: () => findings };
}

describe('StaticAnalyzerOrchestrator', () => {
  it('starts with no registered analyzers', () => {
    const orch = new StaticAnalyzerOrchestrator();
    expect(orch.list()).toEqual([]);
  });

  it('registers analyzers and reports their names in registration order', () => {
    const orch = new StaticAnalyzerOrchestrator()
      .register(stubAnalyzer('semantic', []))
      .register(stubAnalyzer('aria', []));
    expect(orch.list()).toEqual(['semantic', 'aria']);
  });

  it('throws when registering the same analyzer name twice', () => {
    const orch = new StaticAnalyzerOrchestrator().register(stubAnalyzer('semantic', []));
    expect(() => orch.register(stubAnalyzer('semantic', []))).toThrow(/already registered/);
  });

  it('returns findings from all analyzers, preserving order', () => {
    const a = makeFinding('a-1', 'semantic-landmark');
    const b = makeFinding('b-1', 'aria-invalid-role');
    const orch = new StaticAnalyzerOrchestrator()
      .register(stubAnalyzer('semantic', [a]))
      .register(stubAnalyzer('aria', [b]));
    expect(orch.run(emptyContext())).toEqual([a, b]);
  });

  it('deduplicates findings by id across analyzers', () => {
    const shared = makeFinding('dup-1', 'semantic-heading-order');
    const orch = new StaticAnalyzerOrchestrator()
      .register(stubAnalyzer('semantic', [shared]))
      .register(stubAnalyzer('other', [shared]));
    const result = orch.run(emptyContext());
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(shared);
  });
});
