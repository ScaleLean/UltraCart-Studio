import packager from '@electron/packager';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const paths = await packager({
  dir: projectRoot,
  out: join(projectRoot, 'release'),
  overwrite: true,
  name: 'UltraCart Studio',
  appBundleId: 'com.scalelean.ultracart-studio',
  platform: 'darwin',
  arch: 'arm64',
  asar: true,
  icon: join(projectRoot, 'assets/icon.icns'),
  appCategoryType: 'public.app-category.developer-tools',
  // Package runtime files only. Merchant tooling and credentials stay external.
  ignore: [
    /^\/(?!(?:dist|assets|node_modules)(?:\/|$)|(?:package\.json|LICENSE|THIRD_PARTY_NOTICES\.md)$)/,
    /^\/node_modules\/(?:electron|@electron)(?:\/|$)/,
  ],
});
for (const path of paths) console.log(`Built ${path}/UltraCart Studio.app`);
