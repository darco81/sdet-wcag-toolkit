/**
 * Framework-detection unit tests. Reader is injected as a fake so the
 * suite stays hermetic - no real package.json is read.
 */

import { describe, expect, it } from 'vitest';

import { detectFramework } from './framework-detection.js';

function makeReader(packageJson: object | null | 'malformed'): (path: string) => Promise<string> {
  return async () => {
    if (packageJson === null) throw new Error('ENOENT');
    if (packageJson === 'malformed') return '{ not really json';
    return JSON.stringify(packageJson);
  };
}

describe('detectFramework', () => {
  it('returns unknown when package.json is missing', async () => {
    const result = await detectFramework('/proj', makeReader(null));
    expect(result.framework).toBe('unknown');
    expect(result.evidence).toMatch(/not found/);
  });

  it('returns unknown when package.json is malformed', async () => {
    const result = await detectFramework('/proj', makeReader('malformed'));
    expect(result.framework).toBe('unknown');
    expect(result.evidence).toMatch(/malformed/);
  });

  it('detects astro from dependencies', async () => {
    const result = await detectFramework(
      '/proj',
      makeReader({ dependencies: { astro: '^4.0.0' } }),
    );
    expect(result.framework).toBe('astro');
    expect(result.evidence).toBe('astro');
    expect(result.scope).toBe('dependencies');
  });

  it('detects next from dependencies', async () => {
    const result = await detectFramework(
      '/proj',
      makeReader({ dependencies: { next: '^14.0.0', react: '^18.0.0' } }),
    );
    expect(result.framework).toBe('next');
    expect(result.evidence).toBe('next');
  });

  it('detects vue from dependencies', async () => {
    const result = await detectFramework('/proj', makeReader({ dependencies: { vue: '^3.4.0' } }));
    expect(result.framework).toBe('vue');
  });

  it('prefers nuxt over plain vue when both are present', async () => {
    const result = await detectFramework(
      '/proj',
      makeReader({ dependencies: { nuxt: '^3.0.0', vue: '^3.4.0' } }),
    );
    expect(result.framework).toBe('nuxt');
  });

  it('prefers next over react-router when both are present', async () => {
    const result = await detectFramework(
      '/proj',
      makeReader({
        dependencies: { next: '^14.0.0', 'react-router-dom': '^6.0.0' },
      }),
    );
    expect(result.framework).toBe('next');
  });

  it('prefers sveltekit over plain svelte (via @sveltejs/kit)', async () => {
    const result = await detectFramework(
      '/proj',
      makeReader({ dependencies: { '@sveltejs/kit': '^2.0.0', svelte: '^4.0.0' } }),
    );
    expect(result.framework).toBe('sveltekit');
    expect(result.evidence).toBe('@sveltejs/kit');
  });

  it('detects remix via @remix-run/react', async () => {
    const result = await detectFramework(
      '/proj',
      makeReader({ dependencies: { '@remix-run/react': '^2.0.0' } }),
    );
    expect(result.framework).toBe('remix');
  });

  it('detects gatsby', async () => {
    const result = await detectFramework(
      '/proj',
      makeReader({ dependencies: { gatsby: '^5.0.0' } }),
    );
    expect(result.framework).toBe('gatsby');
  });

  it('falls back to devDependencies when missing from production deps', async () => {
    const result = await detectFramework(
      '/proj',
      makeReader({ devDependencies: { astro: '^4.0.0' } }),
    );
    expect(result.framework).toBe('astro');
    expect(result.scope).toBe('devDependencies');
  });

  it('returns unknown when no recognised framework is present', async () => {
    const result = await detectFramework(
      '/proj',
      makeReader({ dependencies: { lodash: '^4.0.0', chalk: '^5.0.0' } }),
    );
    expect(result.framework).toBe('unknown');
    expect(result.evidence).toMatch(/no recognised framework/);
  });

  it('detects react-router-dom when next/remix/gatsby are absent', async () => {
    const result = await detectFramework(
      '/proj',
      makeReader({
        dependencies: { react: '^18.0.0', 'react-router-dom': '^6.0.0' },
      }),
    );
    expect(result.framework).toBe('react-router');
  });
});
