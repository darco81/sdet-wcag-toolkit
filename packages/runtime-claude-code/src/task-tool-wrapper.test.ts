import { afterEach, describe, expect, it, vi } from 'vitest';

import { defaultTaskInvoker } from './task-tool-wrapper.js';

describe('defaultTaskInvoker', () => {
  const globalAny = globalThis as { Task?: unknown };

  afterEach(() => {
    delete globalAny.Task;
  });

  it('throws a helpful error when global Task is missing', async () => {
    await expect(
      defaultTaskInvoker({
        subagentType: 'foo',
        description: 'd',
        prompt: 'p',
      }),
    ).rejects.toThrow(/Task tool is not available/);
  });

  it('hint mentions --use-ai when Task is missing', async () => {
    try {
      await defaultTaskInvoker({ subagentType: 'a', description: 'd', prompt: 'p' });
    } catch (err) {
      expect((err as Error).message).toMatch(/--use-ai|wcag:audit/);
    }
  });

  it('maps fields to Task call shape and returns text when string is returned', async () => {
    const taskMock = vi.fn().mockResolvedValue('hello from agent');
    globalAny.Task = taskMock;

    const result = await defaultTaskInvoker({
      subagentType: 'aria-patterns',
      description: 'audit',
      prompt: 'Run it',
    });
    expect(taskMock).toHaveBeenCalledWith({
      subagent_type: 'aria-patterns',
      description: 'audit',
      prompt: 'Run it',
    });
    expect(result.text).toBe('hello from agent');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('extracts .text property from object results', async () => {
    globalAny.Task = vi.fn().mockResolvedValue({ text: 'via object' });
    const result = await defaultTaskInvoker({
      subagentType: 'a',
      description: 'd',
      prompt: 'p',
    });
    expect(result.text).toBe('via object');
  });

  it('falls back to JSON.stringify for unexpected shapes', async () => {
    globalAny.Task = vi.fn().mockResolvedValue({ weird: 1 });
    const result = await defaultTaskInvoker({
      subagentType: 'a',
      description: 'd',
      prompt: 'p',
    });
    expect(result.text).toBe('{"weird":1}');
  });
});
