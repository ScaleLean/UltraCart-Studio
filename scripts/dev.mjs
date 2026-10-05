import { build } from 'esbuild';
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import electron from 'electron';
const projectRoot = fileURLToPath(new URL('..', import.meta.url));
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
const server = await createServer({ root: projectRoot, configFile: join(projectRoot, 'vite.config.ts') });
await server.listen();
server.printUrls();
const child = spawn(electron, [projectRoot], {
  cwd: projectRoot,
  env: {
    ...process.env,
    UC_STUDIO_DEV: '1',
    UC_STUDIO_ROOT: process.env.UC_STUDIO_ROOT || projectRoot,
  },
  stdio: 'inherit',
});
child.on('exit', async (code) => {
  await server.close();
  process.exit(code || 0);
});
process.on('SIGINT', () => child.kill());
