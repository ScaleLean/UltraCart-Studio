import { build } from 'esbuild';
import { build as viteBuild } from 'vite';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const projectRoot = fileURLToPath(new URL('..', import.meta.url));
await mkdir(join(projectRoot, 'dist'), { recursive: true });
await build({
  absWorkingDir: projectRoot,
  entryPoints: ['src/main/main.ts'],
  outfile: 'dist/main.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
  sourcemap: true,
});
await build({
  absWorkingDir: projectRoot,
  entryPoints: ['src/main/preload.ts'],
  outfile: 'dist/preload.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
});
await build({
  absWorkingDir: projectRoot,
  entryPoints: ['src/main/worker.ts'],
  outfile: 'dist/worker.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  sourcemap: true,
});
await viteBuild({ root: projectRoot, configFile: join(projectRoot, 'vite.config.ts') });
