import { describe, expect, it } from 'vitest';

import type { AnalysisContext, SourceFile } from '../types.js';

import { contrastAnalyzer } from './contrast.js';

function css(content: string, path = 'styles.css'): SourceFile {
  return { path, kind: 'css', content };
}

function html(content: string, path = 'index.html'): SourceFile {
  return { path, kind: 'html', content };
}

function ctx(partial: Partial<AnalysisContext>): AnalysisContext {
  return { html: partial.html ?? [], jsx: [], tsx: [], css: partial.css ?? [] };
}

describe('contrastAnalyzer - CSS rules', () => {
  it('flags a low-contrast pair in the same rule', () => {
    const findings = contrastAnalyzer.analyze(
      ctx({ css: [css('.btn { color: #888888; background-color: #ffffff; }')] }),
    );
    const hit = findings.find((f) => f.ruleId === 'color-contrast');
    expect(hit).toBeDefined();
    expect(hit?.message).toMatch(/contrast ratio \d+\.\d+:1/);
  });

  it('does not flag a high-contrast pair', () => {
    const findings = contrastAnalyzer.analyze(
      ctx({ css: [css('.btn { color: #000000; background-color: #ffffff; }')] }),
    );
    expect(findings).toHaveLength(0);
  });

  it('flags <3:1 as serious and 3-4.49:1 as moderate', () => {
    // #767676 on #ffffff ≈ 4.54 - passes normal AA, but #777777 ≈ 4.48 fails
    const serious = contrastAnalyzer.analyze(
      ctx({ css: [css('.x { color: #bbbbbb; background-color: #ffffff; }')] }), // ~1.86 -> serious
    );
    const moderate = contrastAnalyzer.analyze(
      ctx({ css: [css('.x { color: #949494; background-color: #ffffff; }')] }), // ~3.22 -> moderate
    );
    expect(serious.find((f) => f.ruleId === 'color-contrast')?.severity).toBe('serious');
    expect(moderate.find((f) => f.ruleId === 'color-contrast')?.severity).toBe('moderate');
  });

  it('parses rgb() color values', () => {
    const findings = contrastAnalyzer.analyze(
      ctx({
        css: [css('.x { color: rgb(180, 180, 180); background-color: rgb(255, 255, 255); }')],
      }),
    );
    expect(findings.some((f) => f.ruleId === 'color-contrast')).toBe(true);
  });

  it('parses named CSS colors', () => {
    const findings = contrastAnalyzer.analyze(
      ctx({ css: [css('.x { color: lightgray; background-color: white; }')] }),
    );
    expect(findings.some((f) => f.ruleId === 'color-contrast')).toBe(true);
  });

  it('extracts color from the `background` shorthand', () => {
    const findings = contrastAnalyzer.analyze(
      ctx({ css: [css('.x { color: #bbbbbb; background: #ffffff url(x.png) no-repeat; }')] }),
    );
    expect(findings.some((f) => f.ruleId === 'color-contrast')).toBe(true);
  });

  it('skips rules that use var(--token) for either color', () => {
    const findings = contrastAnalyzer.analyze(
      ctx({ css: [css('.x { color: var(--fg); background-color: #ffffff; }')] }),
    );
    expect(findings).toHaveLength(0);
  });

  it('skips rules without both color and background', () => {
    const findings = contrastAnalyzer.analyze(ctx({ css: [css('.x { color: #bbbbbb; }')] }));
    expect(findings).toHaveLength(0);
  });

  it('does not crash on invalid CSS', () => {
    const findings = contrastAnalyzer.analyze(ctx({ css: [css('this is not css {{{')] }));
    expect(findings).toEqual([]);
  });

  it('includes the line number where available', () => {
    const source = '.x {\n  color: #bbbbbb;\n  background-color: #ffffff;\n}';
    const findings = contrastAnalyzer.analyze(ctx({ css: [css(source)] }));
    const hit = findings.find((f) => f.ruleId === 'color-contrast');
    expect(hit?.location.line).toBe(1);
  });
});

describe('contrastAnalyzer - inline styles', () => {
  it('flags a low-contrast pair in a style attribute', () => {
    const doc =
      '<!doctype html><html lang="en"><head><title>x</title></head><body><main><p style="color: #aaaaaa; background-color: white">hi</p></main></body></html>';
    const findings = contrastAnalyzer.analyze(ctx({ html: [html(doc)] }));
    expect(findings.some((f) => f.ruleId === 'color-contrast-inline')).toBe(true);
  });

  it('does not flag a high-contrast inline pair', () => {
    const doc =
      '<!doctype html><html lang="en"><head><title>x</title></head><body><main><p style="color: #000; background-color: #fff">hi</p></main></body></html>';
    const findings = contrastAnalyzer.analyze(ctx({ html: [html(doc)] }));
    expect(findings.some((f) => f.ruleId === 'color-contrast-inline')).toBe(false);
  });

  it('skips inline styles that use var()', () => {
    const doc =
      '<!doctype html><html lang="en"><head><title>x</title></head><body><p style="color: var(--fg); background-color: #fff">hi</p></body></html>';
    const findings = contrastAnalyzer.analyze(ctx({ html: [html(doc)] }));
    expect(findings.some((f) => f.ruleId === 'color-contrast-inline')).toBe(false);
  });
});

describe('contrastAnalyzer - edge cases', () => {
  it('returns no findings for empty context', () => {
    expect(contrastAnalyzer.analyze({ html: [], jsx: [], tsx: [], css: [] })).toEqual([]);
  });
});
