import { describe, expect, it, vi } from 'vitest';

import type { AgentSpec } from '@sdet-wcag-toolkit/runtime-core';

import { ClaudeCodeRuntime } from './cc-runtime.js';

function baseSpec(overrides: Partial<AgentSpec> = {}): AgentSpec {
  return {
    agentId: 'semantic-structure',
    systemPrompt: 'system',
    userPrompt: 'user',
    tools: [
      { name: 'Read', description: 'read' },
      { name: 'Grep', description: 'grep' },
    ],
    ...overrides,
  };
}

const SAMPLE_OUTPUT = `Here are my findings:

\`\`\`json
[
  {
    "ruleId": "img-alt-missing",
    "successCriterionId": "1.1.1",
    "severity": "serious",
    "message": "<img> missing alt",
    "location": { "file": "src/App.jsx", "line": 12 }
  }
]
\`\`\`
`;

describe('ClaudeCodeRuntime', () => {
  it('has the correct id and name', () => {
    const runtime = new ClaudeCodeRuntime();
    expect(runtime.id).toBe('claude-code');
    expect(runtime.name).toContain('Claude Code');
  });

  it('initialize and shutdown are no-ops', async () => {
    const runtime = new ClaudeCodeRuntime();
    await expect(runtime.initialize({})).resolves.toBeUndefined();
    await expect(runtime.shutdown()).resolves.toBeUndefined();
  });

  it('runAgent forwards spec to Task invoker', async () => {
    const invoker = vi.fn().mockResolvedValue({ text: SAMPLE_OUTPUT, durationMs: 42 });
    const runtime = new ClaudeCodeRuntime({ taskInvoker: invoker });
    const result = await runtime.runAgent(baseSpec());

    expect(invoker).toHaveBeenCalledOnce();
    const call = invoker.mock.calls[0]![0] as {
      subagentType: string;
      prompt: string;
    };
    expect(call.subagentType).toBe('semantic-structure');
    expect(call.prompt).toBe('user');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.ruleId).toBe('img-alt-missing');
    expect(result.durationMs).toBe(42);
    expect(result.errors).toEqual([]);
  });

  it('returns empty findings with error entry when parsing fails', async () => {
    const invoker = vi.fn().mockResolvedValue({ text: '```json\nnot-json\n```', durationMs: 10 });
    const runtime = new ClaudeCodeRuntime({ taskInvoker: invoker });
    const result = await runtime.runAgent(baseSpec());

    expect(result.findings).toEqual([]);
    expect(result.errors[0]).toMatch(/invalid JSON/);
  });

  it('captures thrown runtime errors into AgentResult.errors', async () => {
    const invoker = vi.fn().mockRejectedValue(new Error('Task failed: network'));
    const runtime = new ClaudeCodeRuntime({ taskInvoker: invoker });
    const result = await runtime.runAgent(baseSpec());

    expect(result.findings).toEqual([]);
    expect(result.errors[0]).toMatch(/network/);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('throws in strict HardGuard mode when a denied tool slips through', async () => {
    const invoker = vi.fn();
    const runtime = new ClaudeCodeRuntime({ taskInvoker: invoker });
    await expect(
      runtime.runAgent(
        baseSpec({
          tools: [{ name: 'Bash', description: 'shell' }],
        }),
      ),
    ).rejects.toThrow(/HardGuard/);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('handles empty output as zero findings, zero errors', async () => {
    const invoker = vi.fn().mockResolvedValue({ text: '', durationMs: 5 });
    const runtime = new ClaudeCodeRuntime({ taskInvoker: invoker });
    const result = await runtime.runAgent(baseSpec());
    expect(result.findings).toEqual([]);
    expect(result.errors).toEqual([]);
  });
});
