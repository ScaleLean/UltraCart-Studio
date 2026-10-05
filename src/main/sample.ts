import { writeFile, readFile } from 'node:fs/promises';
import { draftHash, type DraftToolkit } from './domain/draft-service';
import { sampleBody, samplePages, isSampleSelection } from '../shared/sample';
export { sampleBody, samplePages, sampleWorkspace } from '../shared/sample';

export const sampleToolkit: DraftToolkit = {
  verify: async (selection) => {
    if (!isSampleSelection(selection)) throw new Error('Sample workspace mismatch.');
  },
  run: async (args) => {
    const destination = args[args.indexOf('pull') + 1];
    const path = destination.replace(/body\.cjson$/, '') || '/';
    if (!samplePages.some((p) => p.path === path)) throw new Error('Sample page not found.');
    const content = sampleBody(path);
    const file = args[args.indexOf('--out') + 1];
    await writeFile(file, content, { mode: 0o600 });
    await writeFile(
      file + '.sf.json',
      JSON.stringify({
        version: 1,
        merchant: 'SAMPLE',
        storefront: 1,
        to: destination,
        hash: draftHash(content),
        content,
      }),
      { mode: 0o600 }
    );
    return '{}';
  },
  validateLocal: async (file) => {
    JSON.parse(await readFile(file, 'utf8'));
    return JSON.stringify({ valid: true, errors: 0, warnings: 0, diagnostics: [] });
  },
};
