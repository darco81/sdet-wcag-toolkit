import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EFFORT,
  DEFAULT_RULE_EFFORT,
  effortOf,
  priorityOf,
  sortByPriority,
} from './priority.js';
import type { WcagFinding, WcagSeverity } from './types.js';
import { requireSuccessCriterion } from './wcag-catalog.js';

function finding(severity: WcagSeverity, ruleId: string): WcagFinding {
  return {
    id: `${ruleId}-${severity}`,
    successCriterion: requireSuccessCriterion('1.3.1'),
    severity,
    message: 'test',
    location: { file: 't.tsx', line: 1 },
    source: 'static',
    ruleId,
  };
}

describe('effortOf', () => {
  it('returns the mapped effort for known rule ids', () => {
    expect(effortOf('image-alt')).toBe(1);
    expect(effortOf('color-contrast')).toBe(3);
    expect(effortOf('heading-order')).toBe(4);
    expect(effortOf('captions')).toBe(5);
  });

  it('falls back to DEFAULT_EFFORT for unknown rule ids', () => {
    expect(effortOf('some-unknown-rule-id')).toBe(DEFAULT_EFFORT);
  });
});

describe('priorityOf', () => {
  it('is higher for higher severity at the same effort', () => {
    const critical = finding('critical', 'color-contrast'); // 10/3
    const minor = finding('minor', 'color-contrast'); // 1/3
    expect(priorityOf(critical)).toBeGreaterThan(priorityOf(minor));
  });

  it('is higher for lower effort at the same severity', () => {
    const cheapFix = finding('serious', 'image-alt'); // 5/1 = 5
    const hardFix = finding('serious', 'captions'); // 5/5 = 1
    expect(priorityOf(cheapFix)).toBeGreaterThan(priorityOf(hardFix));
  });

  it('computes severity/effort exactly', () => {
    expect(priorityOf(finding('critical', 'image-alt'))).toBe(10); // 10/1
    expect(priorityOf(finding('moderate', 'color-contrast'))).toBeCloseTo(2 / 3); // 2/3
  });

  it('accepts a custom effortFn', () => {
    const f = finding('critical', 'image-alt');
    expect(priorityOf(f, () => 5)).toBe(2); // 10/5
  });
});

describe('sortByPriority', () => {
  it('sorts findings by priority descending', () => {
    const cheapSerious = finding('serious', 'image-alt'); // 5
    const expensiveCritical = finding('critical', 'captions'); // 2
    const moderate = finding('moderate', 'heading-order'); // 0.5
    const sorted = sortByPriority([moderate, expensiveCritical, cheapSerious]);
    expect(sorted.map((f) => f.ruleId)).toEqual(['image-alt', 'captions', 'heading-order']);
  });

  it('preserves original order for findings with equal priority', () => {
    const a = finding('moderate', 'color-contrast'); // 2/3
    const b = finding('moderate', 'non-text-contrast'); // 2/3
    const c = finding('moderate', 'focus-visible'); // 2/3
    const sorted = sortByPriority([a, b, c]);
    expect(sorted).toEqual([a, b, c]);
  });

  it('returns a new array (does not mutate input)', () => {
    const input = [finding('minor', 'image-alt'), finding('critical', 'image-alt')];
    const sorted = sortByPriority(input);
    expect(input[0]?.severity).toBe('minor'); // input unchanged
    expect(sorted[0]?.severity).toBe('critical');
  });
});

describe('DEFAULT_RULE_EFFORT', () => {
  it('only contains effort values in the 1-5 range', () => {
    for (const value of Object.values(DEFAULT_RULE_EFFORT)) {
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(5);
    }
  });
});
