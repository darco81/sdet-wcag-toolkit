import { describe, expect, it } from 'vitest';

import type { AnalysisContext, SourceFile } from '../types.js';

import { semanticAnalyzer } from './semantic.js';

function html(content: string, path = 'test.html'): SourceFile {
  return { path, kind: 'html', content };
}

function ctx(files: SourceFile[]): AnalysisContext {
  return { html: files, jsx: [], tsx: [], css: [] };
}

describe('semanticAnalyzer', () => {
  it('emits no findings for a well-formed document', () => {
    const doc = `<!doctype html>
      <html lang="en">
        <head><title>Clean</title></head>
        <body>
          <main>
            <h1>Heading</h1>
            <h2>Sub</h2>
            <ul><li>a</li><li>b</li></ul>
            <img src="ok.png" alt="logo">
          </main>
        </body>
      </html>`;
    expect(semanticAnalyzer.analyze(ctx([html(doc)]))).toEqual([]);
  });

  it('flags a missing <title>', () => {
    const doc = '<!doctype html><html lang="en"><head></head><body><main>x</main></body></html>';
    const findings = semanticAnalyzer.analyze(ctx([html(doc)]));
    expect(findings.some((f) => f.ruleId === 'document-title')).toBe(true);
  });

  it('flags an empty <title>', () => {
    const doc =
      '<!doctype html><html lang="en"><head><title>  </title></head><body><main>x</main></body></html>';
    const findings = semanticAnalyzer.analyze(ctx([html(doc)]));
    expect(findings.some((f) => f.ruleId === 'document-title')).toBe(true);
  });

  it('flags a missing <html lang>', () => {
    const doc =
      '<!doctype html><html><head><title>x</title></head><body><main>x</main></body></html>';
    const findings = semanticAnalyzer.analyze(ctx([html(doc)]));
    expect(findings.some((f) => f.ruleId === 'html-lang')).toBe(true);
  });

  it('flags a missing <main> landmark', () => {
    const doc =
      '<!doctype html><html lang="en"><head><title>x</title></head><body><p>hello</p></body></html>';
    const findings = semanticAnalyzer.analyze(ctx([html(doc)]));
    expect(findings.some((f) => f.ruleId === 'landmark-main')).toBe(true);
  });

  it('flags multiple <main> landmarks', () => {
    const doc =
      '<!doctype html><html lang="en"><head><title>x</title></head><body><main>a</main><main>b</main></body></html>';
    const findings = semanticAnalyzer.analyze(ctx([html(doc)]));
    expect(findings.some((f) => f.ruleId === 'landmark-unique')).toBe(true);
  });

  it('flags a heading skip (h1 -> h3)', () => {
    const doc = `<!doctype html><html lang="en"><head><title>x</title></head><body><main>
      <h1>One</h1>
      <h3>Jumped</h3>
    </main></body></html>`;
    const findings = semanticAnalyzer.analyze(ctx([html(doc)]));
    const skip = findings.find((f) => f.ruleId === 'heading-order');
    expect(skip).toBeDefined();
    expect(skip?.message).toContain('h1 to h3');
  });

  it('allows h1 -> h2 -> h4 when h2 existed between (strict level skip detection)', () => {
    const doc = `<!doctype html><html lang="en"><head><title>x</title></head><body><main>
      <h1>One</h1>
      <h2>Two</h2>
      <h4>Skip!</h4>
    </main></body></html>`;
    const findings = semanticAnalyzer.analyze(ctx([html(doc)]));
    expect(findings.some((f) => f.ruleId === 'heading-order')).toBe(true);
  });

  it('flags <ul> containing non-<li> children', () => {
    const doc = `<!doctype html><html lang="en"><head><title>x</title></head><body><main>
      <ul>
        <li>ok</li>
        <div>not a list item</div>
      </ul>
    </main></body></html>`;
    const findings = semanticAnalyzer.analyze(ctx([html(doc)]));
    expect(findings.some((f) => f.ruleId === 'list-structure')).toBe(true);
  });

  it('flags <img> without an alt attribute but allows alt=""', () => {
    const doc = `<!doctype html><html lang="en"><head><title>x</title></head><body><main>
      <img src="decorative.svg" alt="">
      <img src="broken.png">
    </main></body></html>`;
    const findings = semanticAnalyzer.analyze(ctx([html(doc)]));
    const altFindings = findings.filter((f) => f.ruleId === 'image-alt');
    expect(altFindings).toHaveLength(1);
    expect(altFindings[0]?.message).toContain('broken.png');
  });

  it('flags <table> without <th> or role="presentation"', () => {
    const doc = `<!doctype html><html lang="en"><head><title>x</title></head><body><main>
      <table><tr><td>data</td></tr></table>
    </main></body></html>`;
    const findings = semanticAnalyzer.analyze(ctx([html(doc)]));
    expect(findings.some((f) => f.ruleId === 'table-headers')).toBe(true);
  });

  it('does not flag <table role="presentation">', () => {
    const doc = `<!doctype html><html lang="en"><head><title>x</title></head><body><main>
      <table role="presentation"><tr><td>layout</td></tr></table>
    </main></body></html>`;
    const findings = semanticAnalyzer.analyze(ctx([html(doc)]));
    expect(findings.some((f) => f.ruleId === 'table-headers')).toBe(false);
  });

  it('produces stable ids so the same violation dedups across runs', () => {
    const doc = '<!doctype html><html lang="en"><head></head><body><p>no main</p></body></html>';
    const a = semanticAnalyzer.analyze(ctx([html(doc)]));
    const b = semanticAnalyzer.analyze(ctx([html(doc)]));
    expect(a.map((f) => f.id).sort()).toEqual(b.map((f) => f.id).sort());
  });

  it('ignores empty context (no html files)', () => {
    expect(semanticAnalyzer.analyze({ html: [], jsx: [], tsx: [], css: [] })).toEqual([]);
  });
});
