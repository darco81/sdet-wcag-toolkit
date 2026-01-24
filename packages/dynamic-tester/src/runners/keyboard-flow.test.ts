import { describe, expect, it } from 'vitest';

import { KeyboardFlowRunner } from './keyboard-flow.js';

describe('KeyboardFlowRunner', () => {
  it('reports its name as "keyboard-flow"', () => {
    expect(new KeyboardFlowRunner().name).toBe('keyboard-flow');
  });

  it('implements the DynamicRunner interface', () => {
    const runner = new KeyboardFlowRunner();
    expect(typeof runner.run).toBe('function');
  });
});
