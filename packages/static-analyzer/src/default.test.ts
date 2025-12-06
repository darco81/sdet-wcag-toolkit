import { describe, expect, it } from 'vitest';

import { createDefaultOrchestrator } from './default.js';

describe('createDefaultOrchestrator', () => {
  it('registers the four built-in analyzers in a stable order', () => {
    const orch = createDefaultOrchestrator();
    expect(orch.list()).toEqual([
      'semantic-structure',
      'aria-patterns',
      'keyboard-interaction',
      'color-contrast',
    ]);
  });

  it('returns an orchestrator that runs end-to-end without throwing on an empty context', () => {
    const orch = createDefaultOrchestrator();
    expect(() => orch.run({ html: [], jsx: [], tsx: [], css: [] })).not.toThrow();
  });

  it('produces findings across multiple analyzers from a single HTML file', () => {
    const orch = createDefaultOrchestrator();
    const findings = orch.run({
      html: [
        {
          path: 'demo.html',
          kind: 'html',
          content: `<!doctype html>
            <html>
              <head></head>
              <body>
                <div onclick="go()">Go</div>
                <button role="button" aria-hidden="true">Hidden button</button>
                <img src="broken.png">
              </body>
            </html>`,
        },
      ],
      jsx: [],
      tsx: [],
      css: [],
    });
    const ruleIds = new Set(findings.map((f) => f.ruleId));
    // Semantic: missing lang + title + main + image-alt
    expect(ruleIds.has('html-lang')).toBe(true);
    expect(ruleIds.has('landmark-main')).toBe(true);
    expect(ruleIds.has('image-alt')).toBe(true);
    // Keyboard: click without keyboard affordance
    expect(ruleIds.has('click-without-keyboard')).toBe(true);
    // ARIA: hidden focusable + redundant role
    expect(ruleIds.has('aria-hidden-focus')).toBe(true);
    expect(ruleIds.has('aria-redundant-role')).toBe(true);
  });
});
