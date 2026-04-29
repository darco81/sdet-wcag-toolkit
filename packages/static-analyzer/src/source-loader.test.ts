import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { loadSources } from './source-loader.js';

async function makeTempFixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'wcag-loader-'));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    const dir = full.slice(0, full.lastIndexOf('/'));
    await mkdir(dir, { recursive: true });
    await writeFile(full, content, 'utf8');
  }
  return root;
}

describe('loadSources', () => {
  let root: string;

  beforeEach(async () => {
    root = await makeTempFixture({
      'index.html': '<!doctype html><p>hi</p>',
      'about.htm': '<!doctype html><p>about</p>',
      'src/App.jsx': 'export default () => <div />;',
      'src/Button.tsx': 'export const B = () => <button />;',
      'styles/main.css': 'body { color: #333; }',
      'src/pages/index.astro': '---\n---\n<p>astro home</p>',
      'src/pages/About.vue': '<template><p>vue</p></template>',
      'src/routes/+page.svelte': '<p>svelte</p>',
      'README.md': '# ignored',
      'node_modules/pkg/index.js': '// must be skipped',
      'dist/bundle.js': '// also skipped',
    });
  });

  it('groups files by kind', async () => {
    const ctx = await loadSources({ rootDir: root });
    expect(ctx.html.map((f) => f.path).sort()).toEqual(['about.htm', 'index.html']);
    expect(ctx.jsx.map((f) => f.path)).toEqual(['src/App.jsx']);
    expect(ctx.tsx.map((f) => f.path)).toEqual(['src/Button.tsx']);
    expect(ctx.css.map((f) => f.path)).toEqual(['styles/main.css']);
    expect(ctx.astro.map((f) => f.path)).toEqual(['src/pages/index.astro']);
    expect(ctx.vue.map((f) => f.path)).toEqual(['src/pages/About.vue']);
    expect(ctx.svelte.map((f) => f.path)).toEqual(['src/routes/+page.svelte']);
  });

  it('skips unsupported extensions', async () => {
    const ctx = await loadSources({ rootDir: root });
    const allPaths = [
      ...ctx.html,
      ...ctx.jsx,
      ...ctx.tsx,
      ...ctx.css,
      ...ctx.astro,
      ...ctx.vue,
      ...ctx.svelte,
    ].map((f) => f.path);
    expect(allPaths).not.toContain('README.md');
  });

  it('skips ignored directories by default (node_modules, dist)', async () => {
    const ctx = await loadSources({ rootDir: root });
    const allPaths = [
      ...ctx.html,
      ...ctx.jsx,
      ...ctx.tsx,
      ...ctx.css,
      ...ctx.astro,
      ...ctx.vue,
      ...ctx.svelte,
    ].map((f) => f.path);
    expect(allPaths.some((p) => p.startsWith('node_modules'))).toBe(false);
    expect(allPaths.some((p) => p.startsWith('dist'))).toBe(false);
  });

  it('respects a custom ignore list', async () => {
    const ctx = await loadSources({ rootDir: root, ignore: ['styles'] });
    expect(ctx.css).toHaveLength(0);
  });

  it('loads file content into each SourceFile', async () => {
    const ctx = await loadSources({ rootDir: root });
    const cssFile = ctx.css[0];
    expect(cssFile?.content).toContain('color: #333');
  });

  it('uses forward-slash paths regardless of OS separator', async () => {
    const ctx = await loadSources({ rootDir: root });
    const jsxFile = ctx.jsx[0];
    expect(jsxFile?.path).toBe('src/App.jsx');
  });
});
