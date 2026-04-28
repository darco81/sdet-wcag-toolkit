/**
 * End-to-end integration test: load the checked-in demo fixture through the
 * source loader, run the default orchestrator, and assert on the aggregate
 * result. Keeps us honest about whether the whole pipeline still works.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { countBySeverity, gradeWithCriticalPenalty } from '@sdet-wcag-toolkit/core';
import { createDefaultOrchestrator, loadSources } from '@sdet-wcag-toolkit/static-analyzer';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEMO_DIR = resolve(HERE, '../../..', 'examples/demo-site');

describe('end-to-end audit on examples/demo-site', () => {
  it('produces at least one finding from every analyzer', async () => {
    const context = await loadSources({ rootDir: DEMO_DIR });
    const findings = createDefaultOrchestrator().run(context);

    const ruleIds = new Set(findings.map((f) => f.ruleId));
    // semantic
    expect(ruleIds.has('html-lang') || ruleIds.has('document-title')).toBe(true);
    expect(ruleIds.has('landmark-main')).toBe(true);
    expect(ruleIds.has('image-alt')).toBe(true);
    expect(ruleIds.has('table-headers')).toBe(true);
    // aria
    expect(ruleIds.has('aria-valid-role')).toBe(true);
    expect(ruleIds.has('aria-hidden-focus')).toBe(true);
    expect(ruleIds.has('aria-idref-describedby')).toBe(true);
    // keyboard
    expect(ruleIds.has('click-without-keyboard')).toBe(true);
    // contrast
    expect(ruleIds.has('color-contrast')).toBe(true);
  });

  it('grades the fixture no better than C (intentional issues are material)', async () => {
    const context = await loadSources({ rootDir: DEMO_DIR });
    const findings = createDefaultOrchestrator().run(context);
    const grade = gradeWithCriticalPenalty(findings);
    expect(['C', 'D', 'F']).toContain(grade);
  });

  it('counts at least 10 findings across severities', async () => {
    const context = await loadSources({ rootDir: DEMO_DIR });
    const findings = createDefaultOrchestrator().run(context);
    const breakdown = countBySeverity(findings);
    expect(breakdown.total).toBeGreaterThanOrEqual(10);
  });
});
