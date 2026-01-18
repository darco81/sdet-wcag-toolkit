import { describe, expect, it } from 'vitest';

import { AXE_WCAG_TAGS, AxeRunner } from './axe-runner.js';

describe('AxeRunner', () => {
  it('exports the six WCAG tags covering 2.0/2.1/2.2 Level A + AA', () => {
    expect(AXE_WCAG_TAGS).toEqual([
      'wcag2a',
      'wcag2aa',
      'wcag21a',
      'wcag21aa',
      'wcag22a',
      'wcag22aa',
    ]);
  });

  it('reports its name as "axe-runner"', () => {
    expect(new AxeRunner().name).toBe('axe-runner');
  });

  it('accepts a custom tag override', () => {
    // No crash on custom tags; observable behaviour is covered by e2e.
    const runner = new AxeRunner({ tags: ['wcag22aa'] });
    expect(runner.name).toBe('axe-runner');
  });

  it('opt-in best-practice tag appends to defaults', () => {
    // Unit test limited to construction; behaviour verified via integration.
    expect(() => new AxeRunner({ includeBestPractice: true })).not.toThrow();
  });
});
