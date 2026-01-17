/**
 * BrowserManager owns the Playwright browser lifecycle for a single audit.
 *
 * One instance → one browser → one context → one page. Keep it narrow:
 * the dynamic runners don't need multi-page orchestration in v0.2, and
 * doing so would complicate timeouts and resource cleanup.
 */

import { chromium, firefox, webkit } from 'playwright';
import type { Browser, BrowserContext, Page, BrowserType } from 'playwright';

import type { BrowserEngine, BrowserOptions, DynamicTarget } from './types.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_VIEWPORT = { width: 1280, height: 720 } as const;

const ENGINE_REGISTRY: Readonly<Record<BrowserEngine, BrowserType>> = {
  chromium,
  firefox,
  webkit,
};

export class BrowserManager {
  private readonly options: Required<
    Pick<BrowserOptions, 'engine' | 'headless' | 'timeoutMs' | 'viewport'>
  > &
    Pick<BrowserOptions, 'userAgent'>;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  constructor(options: BrowserOptions = {}) {
    this.options = {
      engine: options.engine ?? 'chromium',
      headless: options.headless ?? true,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      viewport: options.viewport ?? DEFAULT_VIEWPORT,
      ...(options.userAgent !== undefined && { userAgent: options.userAgent }),
    };
  }

  /** Launches the browser and opens a fresh page. Safe to call once. */
  async start(): Promise<void> {
    if (this.browser) return;
    const engine = ENGINE_REGISTRY[this.options.engine];
    this.browser = await engine.launch({ headless: this.options.headless });
    this.context = await this.browser.newContext({
      viewport: this.options.viewport,
      ...(this.options.userAgent !== undefined && { userAgent: this.options.userAgent }),
    });
    this.context.setDefaultTimeout(this.options.timeoutMs);
    this.page = await this.context.newPage();
  }

  /**
   * Navigate the managed page to the given target and wait for it to
   * settle. `networkidle` is pragmatic for SPAs - it waits until no new
   * network requests fire for 500ms.
   */
  async navigate(target: DynamicTarget): Promise<Page> {
    if (!this.page) {
      throw new Error('BrowserManager.start() must be called before navigate().');
    }
    await this.page.goto(target.url, { waitUntil: 'networkidle' });
    if (target.waitForSelector) {
      await this.page.waitForSelector(target.waitForSelector);
    }
    if (target.waitForMs && target.waitForMs > 0) {
      await this.page.waitForTimeout(target.waitForMs);
    }
    return this.page;
  }

  /** Closes everything and resets. Idempotent. */
  async stop(): Promise<void> {
    try {
      await this.page?.close();
      await this.context?.close();
      await this.browser?.close();
    } finally {
      this.page = null;
      this.context = null;
      this.browser = null;
    }
  }

  /** Current page. Undefined until `start()` has been called. */
  getPage(): Page | null {
    return this.page;
  }
}
