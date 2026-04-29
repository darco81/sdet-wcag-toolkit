/**
 * JSON config strategy tests. Reader is injected so the suite stays
 * hermetic - no real disk reads.
 */

import { describe, expect, it, vi } from 'vitest';

import { createJsonConfigStrategy, parseConfig, DEFAULT_CONFIG_FILENAME } from './json-config.js';

const CONFIG_PATH = '/proj/wcag.config.json';

function readerOf(value: string | Error): (path: string) => Promise<string> {
  return vi.fn(async () => {
    if (value instanceof Error) throw value;
    return value;
  });
}

const VALID_CONFIG = JSON.stringify({
  audit: {
    baseUrl: 'https://staging.example.com',
    pages: ['/', '/about', '/products/top-10', '/blog/[slug]'],
    exclude: ['/admin/*', '/dashboard/*'],
  },
});

describe('createJsonConfigStrategy', () => {
  it('returns routes for a valid config', async () => {
    const strategy = createJsonConfigStrategy({ reader: readerOf(VALID_CONFIG) });

    const result = await strategy({ configPath: CONFIG_PATH });

    expect(result.strategy).toBe('json-config');
    expect(result.confidence).toBe(1);
    expect(result.routes.map((r) => r.path)).toEqual([
      '/',
      '/about',
      '/products/top-10',
      '/blog/[slug]',
    ]);
    expect(result.routes.every((r) => r.source === CONFIG_PATH)).toBe(true);
  });

  it('marks dynamic routes (paths containing [, :, or *)', async () => {
    const strategy = createJsonConfigStrategy({ reader: readerOf(VALID_CONFIG) });

    const result = await strategy({ configPath: CONFIG_PATH });

    expect(result.routes.find((r) => r.path === '/blog/[slug]')?.isDynamic).toBe(true);
    expect(result.routes.find((r) => r.path === '/about')?.isDynamic).toBe(false);
  });

  it('filters pages matching exclude patterns (glob-style)', async () => {
    const config = JSON.stringify({
      audit: {
        baseUrl: 'https://example.com',
        pages: ['/', '/admin/users', '/admin/posts', '/about'],
        exclude: ['/admin/*'],
      },
    });
    const strategy = createJsonConfigStrategy({ reader: readerOf(config) });

    const result = await strategy({ configPath: CONFIG_PATH });

    expect(result.routes.map((r) => r.path)).toEqual(['/', '/about']);
    expect(result.warnings.some((w) => w.includes('excluded 2 page(s)'))).toBe(true);
  });

  it('escapes regex metacharacters in exclusions', async () => {
    const config = JSON.stringify({
      audit: {
        baseUrl: 'https://example.com',
        pages: ['/page.html', '/pageXhtml'],
        exclude: ['/page.html'], // dot is literal, not "any char"
      },
    });
    const strategy = createJsonConfigStrategy({ reader: readerOf(config) });

    const result = await strategy({ configPath: CONFIG_PATH });

    expect(result.routes.map((r) => r.path)).toEqual(['/pageXhtml']);
  });

  it('surfaces an auth-section warning for the public toolkit', async () => {
    const config = JSON.stringify({
      audit: {
        baseUrl: 'https://example.com',
        pages: ['/'],
        auth: { type: 'cookie', name: 'session', value: 'abc' },
      },
    });
    const strategy = createJsonConfigStrategy({ reader: readerOf(config) });

    const result = await strategy({ configPath: CONFIG_PATH });

    expect(result.routes).toHaveLength(1);
    expect(result.warnings.some((w) => w.includes('auth section present'))).toBe(true);
  });

  it('returns empty + warning when configPath is missing from context', async () => {
    const reader = vi.fn();
    const strategy = createJsonConfigStrategy({ reader });

    const result = await strategy({});

    expect(result.routes).toEqual([]);
    expect(result.warnings[0]).toMatch(/requires --config/);
    expect(reader).not.toHaveBeenCalled();
  });

  it('returns empty + warning when the config file cannot be read', async () => {
    const strategy = createJsonConfigStrategy({
      reader: readerOf(new Error('ENOENT: no such file')),
    });

    const result = await strategy({ configPath: CONFIG_PATH });

    expect(result.routes).toEqual([]);
    expect(result.warnings[0]).toMatch(/could not read.*ENOENT/);
  });

  it('returns empty + warning for malformed JSON', async () => {
    const strategy = createJsonConfigStrategy({ reader: readerOf('{ not json') });

    const result = await strategy({ configPath: CONFIG_PATH });

    expect(result.routes).toEqual([]);
    expect(result.warnings[0]).toMatch(/json-config:.*not valid JSON/);
  });

  it('exposes DEFAULT_CONFIG_FILENAME for the CLI auto-detect', () => {
    expect(DEFAULT_CONFIG_FILENAME).toBe('wcag.config.json');
  });
});

describe('parseConfig schema validation', () => {
  it('rejects non-object root', () => {
    const result = parseConfig('"hi"');
    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') expect(result.reason).toMatch(/root must be an object/);
  });

  it('rejects missing audit object', () => {
    const result = parseConfig('{}');
    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') expect(result.reason).toMatch(/audit/);
  });

  it('rejects empty baseUrl', () => {
    const result = parseConfig('{"audit": {"baseUrl": "", "pages": []}}');
    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') expect(result.reason).toMatch(/baseUrl/);
  });

  it('rejects non-http baseUrl', () => {
    const result = parseConfig('{"audit": {"baseUrl": "ftp://example.com", "pages": ["/"]}}');
    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') expect(result.reason).toMatch(/http\(s\) URL/);
  });

  it('rejects pages that is not an array', () => {
    const result = parseConfig('{"audit": {"baseUrl": "https://x.com", "pages": "/about"}}');
    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') expect(result.reason).toMatch(/pages must be an array/);
  });

  it('rejects empty page entries', () => {
    const result = parseConfig('{"audit": {"baseUrl": "https://x.com", "pages": ["", "/about"]}}');
    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') expect(result.reason).toMatch(/non-empty string/);
  });

  it('accepts a minimal valid config', () => {
    const result = parseConfig('{"audit": {"baseUrl": "https://x.com", "pages": ["/"]}}');
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.config.audit.pages).toEqual(['/']);
      expect(result.config.audit.exclude).toBeUndefined();
      expect(result.config.audit.auth).toBeUndefined();
    }
  });

  describe('auth schema', () => {
    it('accepts cookie auth with name + value', () => {
      const result = parseConfig(
        JSON.stringify({
          audit: {
            baseUrl: 'https://x.com',
            pages: ['/'],
            auth: { type: 'cookie', name: 'sid', value: 'abc' },
          },
        }),
      );
      expect(result.kind).toBe('ok');
      if (result.kind === 'ok') {
        expect(result.config.audit.auth).toEqual({ type: 'cookie', name: 'sid', value: 'abc' });
      }
    });

    it('accepts header auth', () => {
      const result = parseConfig(
        JSON.stringify({
          audit: {
            baseUrl: 'https://x.com',
            pages: ['/'],
            auth: { type: 'header', name: 'Authorization', value: 'Bearer xyz' },
          },
        }),
      );
      expect(result.kind).toBe('ok');
    });

    it('accepts storage-state auth', () => {
      const result = parseConfig(
        JSON.stringify({
          audit: {
            baseUrl: 'https://x.com',
            pages: ['/'],
            auth: { type: 'storage-state', path: './auth.json' },
          },
        }),
      );
      expect(result.kind).toBe('ok');
    });

    it('rejects unknown auth type', () => {
      const result = parseConfig(
        JSON.stringify({
          audit: {
            baseUrl: 'https://x.com',
            pages: ['/'],
            auth: { type: 'oauth', token: 'xyz' },
          },
        }),
      );
      expect(result.kind).toBe('invalid');
      if (result.kind === 'invalid') expect(result.reason).toMatch(/cookie, header, storage-state/);
    });

    it('rejects cookie auth missing required fields', () => {
      const result = parseConfig(
        JSON.stringify({
          audit: {
            baseUrl: 'https://x.com',
            pages: ['/'],
            auth: { type: 'cookie', name: 'sid' }, // missing value
          },
        }),
      );
      expect(result.kind).toBe('invalid');
    });
  });
});
