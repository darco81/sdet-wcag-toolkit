import { describe, expect, it, vi } from 'vitest';

import {
  requireSuccessCriterion,
  type WcagFinding,
  type WcagSeverity,
} from '@sdet-wcag-toolkit/core';
import type {
  AgentResult,
  AgentSpec,
  RuntimeAdapter,
  SpecialistAgentId,
} from '@sdet-wcag-toolkit/runtime-core';

import { LeadOrchestrator, mergeFindings } from './lead-orchestrator.js';

function fixtureFinding(
  agentId: string,
  ruleId: string,
  severity: WcagSeverity,
  scId: string,
  file: string,
  line: number,
): WcagFinding {
  return {
    id: `${agentId}:${ruleId}:${file}:${line}`,
    successCriterion: requireSuccessCriterion(scId),
    severity,
    message: `${ruleId} on ${file}:${line}`,
    location: { file, line },
    source: 'static',
    ruleId,
  };
}

function makeAgentResult(
  agentId: string,
  findings: WcagFinding[],
  errors: string[] = [],
): AgentResult {
  return {
    agentId,
    findings,
    rawOutput: '',
    toolCalls: [],
    durationMs: 1,
    errors,
  };
}

interface FakeRuntimeMockOptions {
  perAgent?: Partial<Record<SpecialistAgentId, AgentResult>>;
  defaultResult?: AgentResult;
}

function fakeRuntime(opts: FakeRuntimeMockOptions = {}): RuntimeAdapter & {
  runAgent: ReturnType<typeof vi.fn>;
} {
  const init = vi.fn().mockResolvedValue(undefined);
  const shutdown = vi.fn().mockResolvedValue(undefined);
  const runAgent = vi.fn(async (spec: AgentSpec) => {
    const id = spec.agentId as SpecialistAgentId;
    return opts.perAgent?.[id] ?? opts.defaultResult ?? makeAgentResult(id, []);
  });
  return {
    id: 'claude-code',
    name: 'fake',
    initialize: init,
    runAgent,
    shutdown,
  };
}

const FAKE_PROMPTS: Record<SpecialistAgentId, string> = {
  'semantic-structure': 'system-semantic',
  'aria-patterns': 'system-aria',
  'keyboard-interaction': 'system-keyboard',
  'color-contrast-static': 'system-contrast',
  'forms-accessibility': 'system-forms',
};

describe('LeadOrchestrator.run', () => {
  it('dispatches all 5 specialists with their system prompt and a target-aware user prompt', async () => {
    const runtime = fakeRuntime();
    const lead = new LeadOrchestrator(runtime, {
      loadPrompts: async () => FAKE_PROMPTS,
    });

    await lead.run('/repo/src');

    expect(runtime.runAgent).toHaveBeenCalledTimes(5);
    const calls = runtime.runAgent.mock.calls.map(([spec]) => spec as AgentSpec);
    const ids = calls.map((c) => c.agentId).sort();
    expect(ids).toEqual([
      'aria-patterns',
      'color-contrast-static',
      'forms-accessibility',
      'keyboard-interaction',
      'semantic-structure',
    ]);
    for (const call of calls) {
      expect(call.userPrompt).toContain('/repo/src');
      expect(call.tools.map((t) => t.name).sort()).toEqual(['Glob', 'Grep', 'Read']);
    }
  });

  it('returns a clean A grade and 100 score when no specialist finds anything', async () => {
    const runtime = fakeRuntime();
    const lead = new LeadOrchestrator(runtime, {
      loadPrompts: async () => FAKE_PROMPTS,
    });

    const result = await lead.run('/repo');
    expect(result.findings).toEqual([]);
    expect(result.score).toBe(100);
    expect(result.grade).toBe('A');
    expect(result.agentErrors).toEqual([]);
  });

  it('merges findings across agents, dedupes by (ruleId, file, line)', async () => {
    const dup = fixtureFinding(
      'semantic-structure',
      'role-redundant',
      'minor',
      '4.1.2',
      'src/Foo.tsx',
      10,
    );
    const dup2 = {
      ...dup,
      id: 'aria-patterns:role-redundant:src/Foo.tsx:10',
    };
    const onlyAria = fixtureFinding(
      'aria-patterns',
      'aria-hidden-on-focusable',
      'critical',
      '4.1.2',
      'src/Bar.tsx',
      4,
    );
    const runtime = fakeRuntime({
      perAgent: {
        'semantic-structure': makeAgentResult('semantic-structure', [dup]),
        'aria-patterns': makeAgentResult('aria-patterns', [dup2, onlyAria]),
      },
    });

    const lead = new LeadOrchestrator(runtime, {
      loadPrompts: async () => FAKE_PROMPTS,
    });
    const result = await lead.run('/repo');

    expect(result.findings).toHaveLength(2);
    const ruleIds = result.findings.map((f) => f.ruleId).sort();
    expect(ruleIds).toEqual(['aria-hidden-on-focusable', 'role-redundant']);
    // critical -15 + minor -2 = 100 - 17 = 83 → B
    expect(result.score).toBe(83);
    expect(result.grade).toBe('B');
  });

  it('penalizes severity correctly: 1 critical + 2 serious = score 65, grade C', async () => {
    const findings = [
      fixtureFinding('a', 'r1', 'critical', '4.1.2', 'a.tsx', 1),
      fixtureFinding('a', 'r2', 'serious', '1.4.3', 'b.tsx', 1),
      fixtureFinding('a', 'r3', 'serious', '2.1.1', 'c.tsx', 1),
    ];
    const runtime = fakeRuntime({
      defaultResult: makeAgentResult('semantic-structure', []),
      perAgent: {
        'aria-patterns': makeAgentResult('aria-patterns', findings),
      },
    });

    const lead = new LeadOrchestrator(runtime, {
      loadPrompts: async () => FAKE_PROMPTS,
    });
    const result = await lead.run('/repo');

    expect(result.findings).toHaveLength(3);
    expect(result.score).toBe(65); // 100 - 15 - 10 - 10
    expect(result.grade).toBe('C');
  });

  it('surfaces agent errors without dropping findings from other agents', async () => {
    const finding = fixtureFinding('a', 'r1', 'serious', '1.1.1', 'a.tsx', 1);
    const runtime = fakeRuntime({
      perAgent: {
        'semantic-structure': makeAgentResult('semantic-structure', [finding], []),
        'aria-patterns': makeAgentResult('aria-patterns', [], ['parsed nothing', 'JSON missing']),
      },
    });

    const lead = new LeadOrchestrator(runtime, {
      loadPrompts: async () => FAKE_PROMPTS,
    });
    const result = await lead.run('/repo');

    expect(result.findings).toHaveLength(1);
    expect(result.agentErrors).toHaveLength(1);
    expect(result.agentErrors[0]?.agentId).toBe('aria-patterns');
  });

  it('formats both reports with score/grade visible', async () => {
    const finding = fixtureFinding('a', 'r1', 'serious', '1.4.3', 'a.tsx', 1);
    const runtime = fakeRuntime({
      defaultResult: makeAgentResult('any', []),
      perAgent: {
        'color-contrast-static': makeAgentResult('color-contrast-static', [finding]),
      },
    });

    const lead = new LeadOrchestrator(runtime, {
      loadPrompts: async () => FAKE_PROMPTS,
    });
    const result = await lead.run('/repo');

    expect(result.execSummary).toContain('Score: 90');
    expect(result.execSummary).toContain('Grade A');
    expect(result.devReport).toContain('**Score:** 90');
    expect(result.devReport).toContain('**Grade:** A');
  });

  it('calls initialize and shutdown on the runtime', async () => {
    const runtime = fakeRuntime();
    const lead = new LeadOrchestrator(runtime, {
      loadPrompts: async () => FAKE_PROMPTS,
    });
    await lead.run('/repo');

    expect(runtime.initialize).toHaveBeenCalledOnce();
    expect(runtime.shutdown).toHaveBeenCalledOnce();
  });

  it('shuts down the runtime even when an agent throws via the adapter contract', async () => {
    // RuntimeAdapter contract: runAgent never throws - but if it does,
    // the lead should still call shutdown.
    const runtime = fakeRuntime();
    runtime.runAgent.mockImplementation(async () => {
      throw new Error('boom');
    });

    const lead = new LeadOrchestrator(runtime, {
      loadPrompts: async () => FAKE_PROMPTS,
    });
    await expect(lead.run('/repo')).rejects.toThrow('boom');
    expect(runtime.shutdown).toHaveBeenCalledOnce();
  });
});

describe('mergeFindings', () => {
  it('dedupes by ruleId + file:line', () => {
    const a = fixtureFinding('a1', 'r1', 'serious', '1.1.1', 'src/x.tsx', 5);
    const b = { ...a, id: 'b1:r1:src/x.tsx:5' };
    const c = fixtureFinding('a1', 'r1', 'serious', '1.1.1', 'src/y.tsx', 5);
    expect(mergeFindings([a, b, c])).toHaveLength(2);
  });

  it('does not collapse findings with different ruleId on the same line', () => {
    const a = fixtureFinding('x', 'r1', 'serious', '1.1.1', 'a.tsx', 5);
    const b = fixtureFinding('x', 'r2', 'serious', '1.1.1', 'a.tsx', 5);
    expect(mergeFindings([a, b])).toHaveLength(2);
  });
});
