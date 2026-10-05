import packager from '@electron/packager';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { chmod, copyFile, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const metadata = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'));
const platform = process.platform;
const arch = process.arch;
const labels = { darwin: 'macos', win32: 'windows', linux: 'linux' };
if (!['darwin-arm64', 'darwin-x64', 'win32-x64', 'linux-x64'].includes(`${platform}-${arch}`))
  throw new Error(`Unsupported native packaging host: ${platform}-${arch}. Use the release CI runners.`);
if (process.argv.slice(2).some((argument) => argument !== '--no-archive'))
  throw new Error('Use package.mjs [--no-archive]. Release packages must be built on their native host.');
if (!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(metadata.version))
  throw new Error('Use a SemVer release version in package.json.');
if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME !== `v${metadata.version}`)
  throw new Error('The release tag must match the version in package.json.');
for (const file of ['dist/main.cjs', 'dist/worker.mjs', 'dist/preload.cjs', 'dist/renderer/index.html'])
  if (!existsSync(join(projectRoot, file))) throw new Error(`Missing ${file}. Run npm run build first.`);

const windowsIcon = join(projectRoot, 'assets/icon.ico');
const paths = await packager({
  dir: projectRoot,
  out: join(projectRoot, 'release'),
  overwrite: true,
  name: 'UltraCart Studio',
  executableName: platform === 'linux' ? 'ultracart-studio' : 'UltraCart Studio',
  appBundleId: 'com.scalelean.ultracart-studio',
  platform,
  arch,
  asar: true,
  ...(platform === 'darwin' ? { icon: join(projectRoot, 'assets/icon.icns') } : {}),
  ...(platform === 'win32' && existsSync(windowsIcon) ? { icon: windowsIcon } : {}),
  appCategoryType: 'public.app-category.developer-tools',
  win32metadata: {
    CompanyName: 'Scale Lean',
    FileDescription: metadata.description,
    ProductName: 'UltraCart Studio',
  },
  // Only public runtime files enter the package. Merchant tooling remains external.
  ignore: [
    /^\/(?!(?:dist|assets|node_modules)(?:\/|$)|(?:package\.json|LICENSE|THIRD_PARTY_NOTICES\.md)$)/,
    /^\/node_modules\/(?:electron|@electron)(?:\/|$)/,
  ],
});

const require = createRequire(import.meta.url);
const { listPackage } = createRequire(require.resolve('@electron/packager'))('@electron/asar');
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status ?? result.signal}.`);
}
for (const directory of paths) {
  const resources =
    platform === 'darwin'
      ? join(directory, 'UltraCart Studio.app/Contents/Resources')
      : join(directory, 'resources');
  const files = listPackage(join(resources, 'app.asar')).map((path) => path.replaceAll('\\', '/'));
  for (const required of [
    '/dist/main.cjs',
    '/dist/worker.mjs',
    '/dist/preload.cjs',
    '/dist/renderer/index.html',
    '/LICENSE',
  ])
    if (!files.includes(required)) throw new Error(`Packaged runtime is missing ${required}.`);
  if (
    files.some((path) =>
      /(?:^|\/)\.toolkit(?:\/|$)|\/node_modules\/@ultracart\/|(?:^|\/)credentials\.enc(?:\.|$)|^\/\.(?:env|studio-data|local)(?:[./]|$)/.test(
        path
      )
    )
  )
    throw new Error('Private toolkit or local credential files must not be packaged.');

  await copyFile(join(projectRoot, 'LICENSE'), join(directory, 'STUDIO-LICENSE.txt'));
  await copyFile(join(projectRoot, 'THIRD_PARTY_NOTICES.md'), join(directory, 'THIRD_PARTY_NOTICES.md'));
  await copyFile(join(projectRoot, 'docs/install.md'), join(directory, 'INSTALL.md'));
  if (platform === 'linux') {
    await copyFile(join(projectRoot, 'assets/icon.png'), join(directory, 'ultracart-studio.png'));
    for (const file of ['launch-ultracart-studio', 'install-desktop.sh']) {
      await copyFile(join(projectRoot, 'scripts/linux', file), join(directory, file));
      await chmod(join(directory, file), 0o755);
    }
  }
  const info = {
    name: 'UltraCart Studio',
    version: metadata.version,
    platform,
    arch,
    electron: JSON.parse(await readFile(join(projectRoot, 'node_modules/electron/package.json'), 'utf8'))
      .version,
    commit: /^[a-f0-9]{40}$/i.test(process.env.GITHUB_SHA ?? '') ? process.env.GITHUB_SHA : null,
    builtAt: new Date().toISOString(),
    developerSigned: false,
    notarized: false,
    privateToolkitIncluded: false,
  };
  await writeFile(join(directory, 'build-info.json'), JSON.stringify(info, null, 2) + '\n');
  console.log(`Built ${directory}`);
  if (process.argv.includes('--no-archive')) continue;
  const assetName = `UltraCart-Studio-${metadata.version}-${labels[platform]}-${arch}`;
  const archive = join(projectRoot, 'release', assetName + (platform === 'linux' ? '.tar.gz' : '.zip'));
  await rm(archive, { force: true });
  if (platform === 'darwin')
    run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', directory, archive]);
  else if (platform === 'win32')
    run(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Compress-Archive -LiteralPath $env:STUDIO_PACKAGE_DIRECTORY -DestinationPath $env:STUDIO_PACKAGE_ARCHIVE -CompressionLevel Optimal',
      ],
      { env: { ...process.env, STUDIO_PACKAGE_DIRECTORY: directory, STUDIO_PACKAGE_ARCHIVE: archive } }
    );
  else run('tar', ['-czf', archive, '-C', join(projectRoot, 'release'), basename(directory)]);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(archive)) hash.update(chunk);
  await writeFile(archive + '.sha256', `${hash.digest('hex')}  ${basename(archive)}\n`);
  await writeFile(join(projectRoot, 'release', assetName + '.json'), JSON.stringify(info, null, 2) + '\n');
  console.log(`Archived ${archive}`);
}
