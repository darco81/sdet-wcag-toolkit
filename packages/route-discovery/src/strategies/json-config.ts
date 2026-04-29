/**
 * JSON config route-discovery strategy - the escape hatch.
 *
 * Reads `wcag.config.json` (or whatever path the caller passes via
 * `--config`) and returns the listed pages verbatim. This is the only
 * way to:
 *
 *   - audit SPAs whose routing happens entirely at runtime (no FS or
 *     sitemap to scan, AI agent can't enumerate),
 *   - audit authenticated areas (the auth section travels with the
 *     config; public toolkit accepts the schema but the Pro tier is
 *     what actually wires cookies/headers into Playwright),
 *   - hand-pick a curated subset of routes for fast smoke audits in CI.
 *
 * Schema (hand-rolled - keeps the package free of a Zod dependency):
 *
 *   {
 *     "audit": {
 *       "baseUrl": "https://staging.example.com",
 *       "pages":   ["/", "/about", "/products/top-10"],
 *       "exclude": ["/admin/*"],
 *       "auth":    { "type": "cookie", "name": "session", "value": "..." }
 *     }
 *   }
 *
 * `audit.pages` is the only required field besides `audit.baseUrl`.
 * `exclude` is matched as glob-style suffix patterns (`*` becomes
 * `.*` in a single regex pass). `auth` is parsed and forwarded as
 * metadata; the public strategy itself does not consume it - Pro
 * tier picks it up.
 */

import { readFile } from 'node:fs/promises';

import type { DiscoveredRoute, RouteDiscoveryResult } from '@sdet-wcag-toolkit/core';

import type { RouteDiscoveryContext, RouteDiscoveryStrategyFn } from '../dispatcher.js';

/** Default config filename probed when `--config` is not supplied. */
export const DEFAULT_CONFIG_FILENAME = 'wcag.config.json';

export interface JsonConfigStrategyOptions {
  /**
   * Override the file reader. Tests pass a function that returns a
   * recorded JSON string; production reads from disk.
   */
  readonly reader?: (path: string) => Promise<string>;
}

export interface WcagConfigFile {
  readonly audit: WcagAuditConfig;
}

export interface WcagAuditConfig {
  readonly baseUrl: string;
  readonly pages: readonly string[];
  readonly exclude?: readonly string[];
  readonly auth?: WcagAuthConfig;
}

export type WcagAuthConfig =
  | {
      readonly type: 'cookie';
      readonly name: string;
      readonly value: string;
      readonly domain?: string;
    }
  | { readonly type: 'header'; readonly name: string; readonly value: string }
  | { readonly type: 'storage-state'; readonly path: string };

export function createJsonConfigStrategy(
  options: JsonConfigStrategyOptions = {},
): RouteDiscoveryStrategyFn {
  const reader = options.reader ?? defaultReader;

  return async (context: RouteDiscoveryContext): Promise<RouteDiscoveryResult> => {
    if (!context.configPath) {
      return emptyResult([
        'json-config strategy requires --config <path> (or a wcag.config.json in the current directory).',
      ]);
    }

    let raw: string;
    try {
      raw = await reader(context.configPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return emptyResult([`json-config: could not read ${context.configPath} - ${message}`]);
    }

    const parsed = parseConfig(raw);
    if (parsed.kind === 'invalid') {
      return emptyResult([`json-config: ${parsed.reason}`]);
    }

    const audit = parsed.config.audit;
    const exclusions = compileExclusions(audit.exclude ?? []);
    const routes: DiscoveredRoute[] = [];
    const skipped: string[] = [];

    for (const page of audit.pages) {
      if (excluded(page, exclusions)) {
        skipped.push(page);
        continue;
      }
      routes.push({
        path: page,
        source: context.configPath,
        isDynamic: hasDynamicSegment(page),
      });
    }

    const warnings: string[] = [
      `json-config: loaded ${audit.pages.length} page(s) from ${context.configPath} (baseUrl ${audit.baseUrl}).`,
    ];
    if (skipped.length > 0) {
      warnings.push(`json-config: excluded ${skipped.length} page(s) by patterns.`);
    }
    if (audit.auth) {
      warnings.push(
        `json-config: auth section present (type "${audit.auth.type}"). Public toolkit ignores auth - install @sdet-wcag-toolkit-pro/multi-page-pro to consume it.`,
      );
    }

    return {
      strategy: 'json-config',
      routes,
      confidence: routes.length > 0 ? 1 : 0,
      warnings,
    };
  };
}

/**
 * Parse a config file body into a validated `WcagConfigFile`. Returns
 * a tagged union so callers always handle both branches; mirrors the
 * AI strategy's parser shape.
 */
export function parseConfig(
  raw: string,
): { kind: 'ok'; config: WcagConfigFile } | { kind: 'invalid'; reason: string } {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (e) {
    return { kind: 'invalid', reason: `config is not valid JSON - ${(e as Error).message}` };
  }
  if (!value || typeof value !== 'object') {
    return { kind: 'invalid', reason: 'config root must be an object' };
  }
  const root = value as Record<string, unknown>;
  if (!root.audit || typeof root.audit !== 'object') {
    return { kind: 'invalid', reason: 'config is missing required object "audit"' };
  }
  const auditRaw = root.audit as Record<string, unknown>;
  if (typeof auditRaw.baseUrl !== 'string' || auditRaw.baseUrl === '') {
    return { kind: 'invalid', reason: 'audit.baseUrl must be a non-empty string' };
  }
  if (!isHttpUrl(auditRaw.baseUrl)) {
    return {
      kind: 'invalid',
      reason: `audit.baseUrl is not a valid http(s) URL: ${auditRaw.baseUrl}`,
    };
  }
  if (!Array.isArray(auditRaw.pages)) {
    return { kind: 'invalid', reason: 'audit.pages must be an array of strings' };
  }
  for (let i = 0; i < auditRaw.pages.length; i++) {
    const page = auditRaw.pages[i];
    if (typeof page !== 'string' || page === '') {
      return { kind: 'invalid', reason: `audit.pages[${i}] must be a non-empty string` };
    }
  }
  let exclude: readonly string[] | undefined;
  if (auditRaw.exclude !== undefined) {
    if (!Array.isArray(auditRaw.exclude)) {
      return { kind: 'invalid', reason: 'audit.exclude must be an array of patterns' };
    }
    for (const pattern of auditRaw.exclude) {
      if (typeof pattern !== 'string') {
        return { kind: 'invalid', reason: 'audit.exclude entries must be strings' };
      }
    }
    exclude = auditRaw.exclude as readonly string[];
  }

  let auth: WcagAuthConfig | undefined;
  if (auditRaw.auth !== undefined) {
    const authResult = parseAuth(auditRaw.auth);
    if (authResult.kind === 'invalid') return authResult;
    auth = authResult.auth;
  }

  return {
    kind: 'ok',
    config: {
      audit: {
        baseUrl: auditRaw.baseUrl,
        pages: auditRaw.pages as readonly string[],
        ...(exclude !== undefined && { exclude }),
        ...(auth !== undefined && { auth }),
      },
    },
  };
}

function parseAuth(
  value: unknown,
): { kind: 'ok'; auth: WcagAuthConfig } | { kind: 'invalid'; reason: string } {
  if (!value || typeof value !== 'object') {
    return { kind: 'invalid', reason: 'audit.auth must be an object' };
  }
  const auth = value as Record<string, unknown>;
  if (auth.type === 'cookie') {
    if (typeof auth.name !== 'string' || typeof auth.value !== 'string') {
      return { kind: 'invalid', reason: 'audit.auth (cookie) requires string fields name + value' };
    }
    return {
      kind: 'ok',
      auth: {
        type: 'cookie',
        name: auth.name,
        value: auth.value,
        ...(typeof auth.domain === 'string' && { domain: auth.domain }),
      },
    };
  }
  if (auth.type === 'header') {
    if (typeof auth.name !== 'string' || typeof auth.value !== 'string') {
      return { kind: 'invalid', reason: 'audit.auth (header) requires string fields name + value' };
    }
    return { kind: 'ok', auth: { type: 'header', name: auth.name, value: auth.value } };
  }
  if (auth.type === 'storage-state') {
    if (typeof auth.path !== 'string') {
      return { kind: 'invalid', reason: 'audit.auth (storage-state) requires string field path' };
    }
    return { kind: 'ok', auth: { type: 'storage-state', path: auth.path } };
  }
  return {
    kind: 'invalid',
    reason: `audit.auth.type must be one of: cookie, header, storage-state`,
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Convert exclusion glob patterns to regex. `*` becomes `.*`, every
 * other regex meta is escaped. Pattern is anchored to the start; users
 * can put `*` at the end to match suffixes.
 */
function compileExclusions(patterns: readonly string[]): readonly RegExp[] {
  return patterns.map((pattern) => {
    const escaped = pattern.replace(/[.+?^${}()|\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`);
  });
}

function excluded(path: string, exclusions: readonly RegExp[]): boolean {
  for (const re of exclusions) {
    if (re.test(path)) return true;
  }
  return false;
}

function hasDynamicSegment(path: string): boolean {
  for (const ch of ['[', ']', ':', '*']) {
    if (path.includes(ch)) return true;
  }
  return false;
}

async function defaultReader(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

function emptyResult(warnings: readonly string[]): RouteDiscoveryResult {
  return {
    strategy: 'json-config',
    routes: [],
    confidence: 0,
    warnings,
  };
}
