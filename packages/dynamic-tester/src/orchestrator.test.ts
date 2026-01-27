import { describe, expect, it } from 'vitest';

import {
  DynamicTesterOrchestrator,
  createDefaultDynamicOrchestrator,
} from './orchestrator.js';

describe('DynamicTesterOrchestrator', () => {
  it('registers the three built-in runners by default', () => {
    const orch = new DynamicTesterOrchestrator();
    expect(orch.list()).toEqual(['axe-runner', 'keyboard-flow', 'focus-visibility']);
  });

  it('accepts a custom runner set', () => {
    const orch = new DynamicTesterOrchestrator({
      runners: [{ name: 'only-me', async run() { return []; } }],
    });
    expect(orch.list()).toEqual(['only-me']);
  });

  it('createDefaultDynamicOrchestrator returns the same shape as new DynamicTesterOrchestrator()', () => {
    expect(createDefaultDynamicOrchestrator().list()).toEqual(
      new DynamicTesterOrchestrator().list(),
    );
  });
});
