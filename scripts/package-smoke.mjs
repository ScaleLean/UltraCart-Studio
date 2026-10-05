import { spawnSync } from 'node:child_process';
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
const data = await mkdtemp(join(tmpdir(), 'studio-package-smoke-'));
try {
  const result = spawnSync(executable, [join(root, 'scripts/package-smoke.cjs'), resources, data], {
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
