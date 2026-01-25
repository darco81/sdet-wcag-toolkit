import { describe, expect, it } from 'vitest';

import { FocusVisibilityRunner } from './focus-visibility.js';

describe('FocusVisibilityRunner', () => {
  it('reports its name as "focus-visibility"', () => {
    expect(new FocusVisibilityRunner().name).toBe('focus-visibility');
  });

  it('implements the DynamicRunner interface', () => {
    const runner = new FocusVisibilityRunner();
    expect(typeof runner.run).toBe('function');
  });
});
