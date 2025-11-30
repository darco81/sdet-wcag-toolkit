import { describe, expect, it } from 'vitest';

import type { AnalysisContext, SourceFile } from '../types.js';

import { ariaAnalyzer } from './aria.js';

function html(content: string, path = 'test.html'): SourceFile {
  return { path, kind: 'html', content };
}

function ctx(files: SourceFile[]): AnalysisContext {
  return { html: files, jsx: [], tsx: [], css: [] };
}

function run(body: string): ReturnType<typeof ariaAnalyzer.analyze> {
  const doc = `<!doctype html><html lang="en"><head><title>x</title></head><body>${body}</body></html>`;
  return ariaAnalyzer.analyze(ctx([html(doc)]));
}

describe('ariaAnalyzer - invalid roles', () => {
  it('flags completely unknown roles', () => {
    const findings = run('<div role="buton">x</div>');
    expect(findings.some((f) => f.ruleId === 'aria-valid-role')).toBe(true);
  });

  it('accepts valid landmark roles', () => {
    const findings = run('<div role="navigation">x</div>');
    expect(findings.filter((f) => f.ruleId === 'aria-valid-role')).toHaveLength(0);
  });

  it('accepts valid widget roles', () => {
    const findings = run('<div role="combobox" aria-expanded="false">x</div>');
    expect(findings.filter((f) => f.ruleId === 'aria-valid-role')).toHaveLength(0);
  });
});

describe('ariaAnalyzer - required attributes', () => {
  it('flags role="checkbox" without aria-checked', () => {
    const findings = run('<div role="checkbox" tabindex="0">x</div>');
    const hit = findings.find((f) => f.ruleId === 'aria-required-attr');
    expect(hit).toBeDefined();
    expect(hit?.message).toContain('aria-checked');
  });

  it('does not flag role="checkbox" with aria-checked', () => {
    const findings = run('<div role="checkbox" aria-checked="false" tabindex="0">x</div>');
    expect(findings.some((f) => f.ruleId === 'aria-required-attr')).toBe(false);
  });

  it('flags role="slider" without aria-valuenow', () => {
    const findings = run('<div role="slider" tabindex="0">x</div>');
    expect(findings.some((f) => f.ruleId === 'aria-required-attr')).toBe(true);
  });
});

describe('ariaAnalyzer - id reference integrity', () => {
  it('flags aria-labelledby pointing to a missing id', () => {
    const findings = run('<button aria-labelledby="does-not-exist">x</button>');
    expect(findings.some((f) => f.ruleId === 'aria-idref-labelledby')).toBe(true);
  });

  it('does not flag aria-labelledby pointing to an existing id', () => {
    const findings = run('<span id="lbl">Label</span><button aria-labelledby="lbl">x</button>');
    expect(findings.some((f) => f.ruleId === 'aria-idref-labelledby')).toBe(false);
  });

  it('flags aria-describedby pointing to a missing id', () => {
    const findings = run('<button aria-describedby="nope">x</button>');
    expect(findings.some((f) => f.ruleId === 'aria-idref-describedby')).toBe(true);
  });

  it('handles multiple space-separated id refs', () => {
    const findings = run(
      '<span id="a">A</span><button aria-labelledby="a missing">x</button>',
    );
    const hit = findings.find((f) => f.ruleId === 'aria-idref-labelledby');
    expect(hit?.message).toContain('missing');
  });
});

describe('ariaAnalyzer - redundant role', () => {
  it('flags role="button" on <button>', () => {
    const findings = run('<button role="button">x</button>');
    expect(findings.some((f) => f.ruleId === 'aria-redundant-role')).toBe(true);
  });

  it('flags role="navigation" on <nav>', () => {
    const findings = run('<nav role="navigation">x</nav>');
    expect(findings.some((f) => f.ruleId === 'aria-redundant-role')).toBe(true);
  });

  it('does not flag role="button" on <div>', () => {
    const findings = run('<div role="button" tabindex="0">x</div>');
    expect(findings.some((f) => f.ruleId === 'aria-redundant-role')).toBe(false);
  });
});

describe('ariaAnalyzer - aria-hidden on focusable', () => {
  it('flags aria-hidden="true" on a <button>', () => {
    const findings = run('<button aria-hidden="true">x</button>');
    expect(findings.some((f) => f.ruleId === 'aria-hidden-focus')).toBe(true);
  });

  it('flags aria-hidden="true" on a tabindex="0" div', () => {
    const findings = run('<div tabindex="0" aria-hidden="true">x</div>');
    expect(findings.some((f) => f.ruleId === 'aria-hidden-focus')).toBe(true);
  });

  it('does not flag aria-hidden="true" on a non-focusable <span>', () => {
    const findings = run('<span aria-hidden="true">icon</span>');
    expect(findings.some((f) => f.ruleId === 'aria-hidden-focus')).toBe(false);
  });

  it('does not flag aria-hidden="true" when tabindex="-1"', () => {
    const findings = run('<div tabindex="-1" aria-hidden="true">x</div>');
    expect(findings.some((f) => f.ruleId === 'aria-hidden-focus')).toBe(false);
  });
});

describe('ariaAnalyzer - edge cases', () => {
  it('returns no findings for empty context', () => {
    expect(ariaAnalyzer.analyze({ html: [], jsx: [], tsx: [], css: [] })).toEqual([]);
  });

  it('produces findings with source="static"', () => {
    const findings = run('<div role="xxxx">x</div>');
    expect(findings[0]?.source).toBe('static');
  });
});
