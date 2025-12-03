import { describe, expect, it } from 'vitest';

import type { AnalysisContext, SourceFile } from '../types.js';

import { keyboardAnalyzer } from './keyboard.js';

function html(content: string, path = 'test.html'): SourceFile {
  return { path, kind: 'html', content };
}

function ctx(files: SourceFile[]): AnalysisContext {
  return { html: files, jsx: [], tsx: [], css: [] };
}

function run(body: string): ReturnType<typeof keyboardAnalyzer.analyze> {
  const doc = `<!doctype html><html lang="en"><head><title>x</title></head><body>${body}</body></html>`;
  return keyboardAnalyzer.analyze(ctx([html(doc)]));
}

describe('keyboardAnalyzer - positive tabindex', () => {
  it('flags tabindex="1"', () => {
    const findings = run('<button tabindex="1">x</button>');
    expect(findings.some((f) => f.ruleId === 'tabindex-positive')).toBe(true);
  });

  it('flags tabindex="5" on a div', () => {
    const findings = run('<div tabindex="5">x</div>');
    expect(findings.some((f) => f.ruleId === 'tabindex-positive')).toBe(true);
  });

  it('does not flag tabindex="0"', () => {
    const findings = run('<div tabindex="0" role="button">x</div>');
    expect(findings.some((f) => f.ruleId === 'tabindex-positive')).toBe(false);
  });

  it('does not flag tabindex="-1"', () => {
    const findings = run('<div tabindex="-1">x</div>');
    expect(findings.some((f) => f.ruleId === 'tabindex-positive')).toBe(false);
  });

  it('ignores non-numeric tabindex values', () => {
    const findings = run('<div tabindex="abc">x</div>');
    expect(findings.some((f) => f.ruleId === 'tabindex-positive')).toBe(false);
  });
});

describe('keyboardAnalyzer - interactive role not focusable', () => {
  it('flags role="button" on a <div> without tabindex', () => {
    const findings = run('<div role="button">Go</div>');
    expect(findings.some((f) => f.ruleId === 'interactive-role-not-focusable')).toBe(true);
  });

  it('does not flag role="button" on a <div> with tabindex="0"', () => {
    const findings = run('<div role="button" tabindex="0">Go</div>');
    expect(findings.some((f) => f.ruleId === 'interactive-role-not-focusable')).toBe(false);
  });

  it('does not flag role="button" on a native <button>', () => {
    const findings = run('<button role="button">Go</button>');
    expect(findings.some((f) => f.ruleId === 'interactive-role-not-focusable')).toBe(false);
  });

  it('flags role="checkbox" on a <div>', () => {
    const findings = run('<div role="checkbox" aria-checked="false">A</div>');
    expect(findings.some((f) => f.ruleId === 'interactive-role-not-focusable')).toBe(true);
  });

  it('ignores non-interactive roles (e.g. role="region")', () => {
    const findings = run('<div role="region">Panel</div>');
    expect(findings.some((f) => f.ruleId === 'interactive-role-not-focusable')).toBe(false);
  });
});

describe('keyboardAnalyzer - click without keyboard affordance', () => {
  it('flags <div onclick> without role or keyboard handler', () => {
    const findings = run('<div onclick="go()">Go</div>');
    const hit = findings.find((f) => f.ruleId === 'click-without-keyboard');
    expect(hit).toBeDefined();
    expect(hit?.message).toContain('interactive role');
    expect(hit?.message).toContain('keyboard event handler');
  });

  it('still flags <div onclick> with role but no keyboard handler', () => {
    const findings = run('<div role="button" tabindex="0" onclick="go()">Go</div>');
    const hit = findings.find((f) => f.ruleId === 'click-without-keyboard');
    expect(hit?.message).toContain('keyboard event handler');
    expect(hit?.message).not.toContain('interactive role');
  });

  it('does not flag <div onclick role="button" onkeydown>', () => {
    const findings = run(
      '<div role="button" tabindex="0" onclick="go()" onkeydown="onKey(event)">Go</div>',
    );
    expect(findings.some((f) => f.ruleId === 'click-without-keyboard')).toBe(false);
  });

  it('does not flag onclick on a native <button>', () => {
    const findings = run('<button onclick="go()">Go</button>');
    expect(findings.some((f) => f.ruleId === 'click-without-keyboard')).toBe(false);
  });

  it('does not flag onclick on a native <a href>', () => {
    const findings = run('<a href="#" onclick="go()">Go</a>');
    expect(findings.some((f) => f.ruleId === 'click-without-keyboard')).toBe(false);
  });
});

describe('keyboardAnalyzer - edge cases', () => {
  it('returns no findings for empty context', () => {
    expect(keyboardAnalyzer.analyze({ html: [], jsx: [], tsx: [], css: [] })).toEqual([]);
  });
});
