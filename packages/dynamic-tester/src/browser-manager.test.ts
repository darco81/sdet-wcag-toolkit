import { describe, expect, it } from 'vitest';

import { BrowserManager } from './browser-manager.js';

describe('BrowserManager', () => {
  it('constructs with default options without launching a browser', () => {
    const manager = new BrowserManager();
    expect(manager.getPage()).toBeNull();
  });

  it('throws when navigate() is called before start()', async () => {
    const manager = new BrowserManager();
    await expect(manager.navigate({ url: 'data:text/html,<p>hi</p>' })).rejects.toThrow(
      /start\(\) must be called/,
    );
  });

  it('stop() is safe to call before start()', async () => {
    const manager = new BrowserManager();
    await expect(manager.stop()).resolves.toBeUndefined();
  });

  it('accepts custom options and exposes them at construct time', () => {
    // Constructor should not reject unusual - but valid - option combinations.
    const manager = new BrowserManager({
      engine: 'firefox',
      headless: false,
      timeoutMs: 5_000,
      viewport: { width: 1920, height: 1080 },
      userAgent: 'wcag-toolkit/0.2.0',
    });
    expect(manager.getPage()).toBeNull();
  });
});
