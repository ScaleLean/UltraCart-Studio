import { spawnSync } from 'node:child_process';
import { getCurrentFuseWire, FuseV1Options, FuseState } from '@electron/fuses';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const directory = join(root, 'release', `UltraCart Studio-${process.platform}-${process.arch}`);
const resources =
  process.platform === 'darwin'
    ? join(directory, 'UltraCart Studio.app/Contents/Resources')
    : join(directory, 'resources');
const executable =
  process.platform === 'darwin'
    ? join(directory, 'UltraCart Studio.app/Contents/MacOS/UltraCart Studio')
    : join(directory, process.platform === 'win32' ? 'UltraCart Studio.exe' : 'ultracart-studio');
const bundle = process.platform === 'darwin' ? join(directory, 'UltraCart Studio.app') : executable;
const fuses = await getCurrentFuseWire(bundle);
const expected = {
  RunAsNode: false,
  EnableNodeOptionsEnvironmentVariable: false,
  EnableNodeCliInspectArguments: false,
  EnableEmbeddedAsarIntegrityValidation: true,
  OnlyLoadAppFromAsar: true,
};
for (const [name, enabled] of Object.entries(expected)) {
  const state = fuses[FuseV1Options[name]];
  if (state !== (enabled ? FuseState.ENABLE : FuseState.DISABLE))
    throw new Error(`Electron fuse ${name} must be ${enabled ? 'enabled' : 'disabled'}.`);
}
console.log('Electron fuses verified on the packaged executable.');
// RunAsNode is off in the packaged binary, so run the worker checks with the matching unfused
// development Electron runtime against the packaged app.asar.
const runtime = createRequire(import.meta.url)('electron');
if (typeof runtime !== 'string') throw new Error('Could not resolve the development Electron runtime.');
const data = await mkdtemp(join(tmpdir(), 'studio-package-smoke-'));
try {
  const result = spawnSync(runtime, [join(root, 'scripts/package-smoke.cjs'), resources, data], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'inherit',
    timeout: 60000,
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Packaged runtime smoke failed: ${result.status ?? result.signal}`);
} finally {
  await rm(data, { recursive: true, force: true });
}
