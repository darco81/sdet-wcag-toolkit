import { describe, expect, it } from 'vitest';

import {
  WCAG_2_2_AA_CATALOG,
  findSuccessCriterion,
  requireSuccessCriterion,
} from './wcag-catalog.js';

describe('WCAG 2.2 AA catalog', () => {
  it('contains 55 success criteria (31 Level A + 24 Level AA)', () => {
    expect(WCAG_2_2_AA_CATALOG).toHaveLength(55);

    const levelA = WCAG_2_2_AA_CATALOG.filter((c) => c.level === 'A');
    const levelAA = WCAG_2_2_AA_CATALOG.filter((c) => c.level === 'AA');
    expect(levelA).toHaveLength(31);
    expect(levelAA).toHaveLength(24);
  });

  it('has no duplicate ids', () => {
    const ids = WCAG_2_2_AA_CATALOG.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('includes the six new criteria added in 2.2', () => {
    const newIn22 = WCAG_2_2_AA_CATALOG.filter((c) => c.introducedIn === '2.2').map((c) => c.id);
    expect(newIn22.sort()).toEqual(['2.4.11', '2.5.7', '2.5.8', '3.2.6', '3.3.7', '3.3.8']);
  });

  it('does not include 4.1.1 Parsing (removed in 2.2)', () => {
    expect(findSuccessCriterion('4.1.1')).toBeUndefined();
  });

  it('assigns a principle to every criterion consistent with its id prefix', () => {
    const expectedPrinciple = {
      '1': 'perceivable',
      '2': 'operable',
      '3': 'understandable',
      '4': 'robust',
    } as const;
    for (const criterion of WCAG_2_2_AA_CATALOG) {
      const prefix = criterion.id.charAt(0) as keyof typeof expectedPrinciple;
      expect(criterion.principle).toBe(expectedPrinciple[prefix]);
    }
  });

  it('points every criterion to a w3.org Understanding page', () => {
    for (const criterion of WCAG_2_2_AA_CATALOG) {
      expect(criterion.url).toMatch(/^https:\/\/www\.w3\.org\/WAI\/WCAG22\/Understanding\//);
    }
  });
});

describe('findSuccessCriterion', () => {
  it('returns the matching criterion for a known id', () => {
    const sc = findSuccessCriterion('1.4.3');
    expect(sc).toBeDefined();
    expect(sc?.name).toBe('Contrast (Minimum)');
    expect(sc?.level).toBe('AA');
  });

  it('returns undefined for an unknown id', () => {
    expect(findSuccessCriterion('9.9.9')).toBeUndefined();
  });

  it('returns undefined for AAA-only criteria not tracked here', () => {
    // 2.4.8 Location is Level AAA, not in our AA catalog.
    expect(findSuccessCriterion('2.4.8')).toBeUndefined();
  });
});

describe('requireSuccessCriterion', () => {
  it('returns the matching criterion', () => {
    const sc = requireSuccessCriterion('2.1.1');
    expect(sc.name).toBe('Keyboard');
  });

  it('throws for unknown ids', () => {
    expect(() => requireSuccessCriterion('9.9.9')).toThrow(/Unknown WCAG 2.2 A\/AA/);
  });
});
