import { describe, expect, it } from 'vitest';

import { requireSuccessCriterion } from '@sdet-wcag-toolkit/core';

import { createFinding } from './finding.js';

describe('createFinding', () => {
  it('produces a WcagFinding with source=static by default', () => {
    const f = createFinding({
      successCriterion: requireSuccessCriterion('1.3.1'),
      severity: 'serious',
      message: 'missing main landmark',
      ruleId: 'landmark-main',
      location: { file: 'a.html' },
    });
    expect(f.source).toBe('static');
    expect(f.severity).toBe('serious');
    expect(f.ruleId).toBe('landmark-main');
  });

  it('generates identical ids for identical inputs (dedup key)', () => {
    const input = {
      successCriterion: requireSuccessCriterion('1.3.1'),
      severity: 'moderate' as const,
      message: 'x',
      ruleId: 'heading-order',
      location: { file: 'a.html', selector: 'h3' },
    };
    expect(createFinding(input).id).toBe(createFinding(input).id);
  });

  it('generates different ids when ruleId differs', () => {
    const base = {
      successCriterion: requireSuccessCriterion('1.3.1'),
      severity: 'moderate' as const,
      message: 'x',
      location: { file: 'a.html' },
    };
    const a = createFinding({ ...base, ruleId: 'rule-a' });
    const b = createFinding({ ...base, ruleId: 'rule-b' });
    expect(a.id).not.toBe(b.id);
  });

  it('generates different ids when location differs', () => {
    const base = {
      successCriterion: requireSuccessCriterion('1.3.1'),
      severity: 'moderate' as const,
      message: 'x',
      ruleId: 'r',
    };
    const a = createFinding({ ...base, location: { file: 'a.html' } });
    const b = createFinding({ ...base, location: { file: 'b.html' } });
    expect(a.id).not.toBe(b.id);
  });

  it('omits optional fields when not provided', () => {
    const f = createFinding({
      successCriterion: requireSuccessCriterion('1.3.1'),
      severity: 'minor',
      message: 'x',
      ruleId: 'r',
      location: { file: 'a.html' },
    });
    expect(f.rationale).toBeUndefined();
    expect(f.remediation).toBeUndefined();
    expect(f.helpUrl).toBeUndefined();
  });
});
