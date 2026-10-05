import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../src/main/database';
import { parseContentMap } from '../src/shared/content-map';
import { readContentMap } from '../src/main/content-map';
import { sampleBody, sampleWorkspace } from '../src/shared/sample';
import { DraftService, draftHash } from '../src/main/domain/draft-service';
import type { DraftScope } from '../src/shared/drafts';

const scope: DraftScope = {
  selection: {
    profileId: 'test',
    merchantId: 'TEST',
    storefront: { id: 42, host: 'store.example', themeId: 7 },
    verifiedAt: '',
  },
  path: '/offer/',
  slot: 'body',
};
function report() {
  return {
    action: 'sf.locate',
    storefrontOid: 42,
    page: '/offer/',
    themeOid: 7,
    themePath: '/themes/Main/',
    template: '/themes/Main/templates/offer.vm',
    searchedTheme: false,
    containers: [
      {
        file: '/themes/Main/containers/layout.cjson',
        kind: 'theme container',
        reached: true,
        via: ['/themes/Main/templates/offer.vm'],
      },
      {
        file: '/offer/main_content.cjson',
        kind: 'page container',
        reached: true,
        via: ['pagecontainer-123'],
      },
    ],
    warnings: [],
    notFollowed: ['Dynamic include $partial was not followed'],
    unresolved: 1,
    results: [{ input: 'html', status: 'not_widget_rooted' }],
  };
}
test('content map exposes only exact page-owned slots and preserves inspection limits', () => {
  const parsed = parseContentMap(report(), scope);
  assert.equal(parsed.sources[0].slot, null);
  assert.equal(parsed.sources[1].slot, 'main_content');
  assert.equal(parsed.notFollowed[0], 'Dynamic include $partial was not followed');
  assert.equal(parsed.sample, false);
});
test('content map rejects foreign identity, nested paths, encoded traversal, and broadened scans', () => {
  for (const patch of [{ storefrontOid: 43 }, { page: '/different/' }, { searchedTheme: true }])
    assert.throws(() => parseContentMap({ ...report(), ...patch }, scope));
  for (const file of [
    '/other/body.cjson',
    '/offer/nested/body.cjson',
    '/offer/../body.cjson',
    '/offer/%2e%2e.cjson',
    '/offer/%252e%252e.cjson',
  ]) {
    const value = report();
    value.containers[1].file = file;
    assert.throws(() => parseContentMap(value, scope), file);
  }
  const duplicate = report();
  duplicate.containers.push(duplicate.containers[1]);
  assert.throws(() => parseContentMap(duplicate, scope), /duplicate/);
});
test('content discovery uses bounded read-only locate and verifies identity before and after', async () => {
  const calls: string[] = [];
  const map = await readContentMap(
    {
      verify: async (selection) => {
        assert.deepEqual(selection, scope.selection);
        calls.push('verify');
        return selection.storefront;
      },
      run: async (args, options) => {
        calls.push('read');
        assert.deepEqual(args, [
          '--format',
          'json',
          '--profile',
          'test',
          'sf',
          'locate',
          'html',
          '--storefront',
          '42',
          '--uri',
          '/offer/',
        ]);
        assert.deepEqual(options?.acceptedExitCodes, [0, 1]);
        return JSON.stringify(report());
      },
    },
    scope
  );
  assert.deepEqual(calls, ['verify', 'read', 'verify']);
  assert.equal(map.sources.length, 2);
  let verifies = 0;
  await assert.rejects(
    readContentMap(
      {
        verify: async () => {
          if (++verifies === 2) throw new Error('identity changed');
          return scope.selection.storefront;
        },
        run: async () => JSON.stringify(report()),
      },
      scope
    ),
    /identity changed/
  );
});
test('sample content map stays local', async () => {
  const fail = async (): Promise<never> => {
    throw new Error('unexpected toolkit call');
  };
  const map = await readContentMap(
    { verify: fail, run: fail },
    { ...scope, path: '/', selection: sampleWorkspace.selection }
  );
  assert.equal(map.sample, true);
  assert.equal(map.sources[0].file, '/body.cjson');
});
test('different slots keep independent drafts and reject cross-slot saves', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-slots-'));
  const store = new Store(dir);
  const db = store.db;
  try {
    const service = new DraftService(db, {
      verify: async () => {},
      run: async (args) => {
        const destination = args[args.indexOf('pull') + 1],
          file = args[args.indexOf('--out') + 1];
        const content = sampleBody('/');
        await writeFile(file, content);
        await writeFile(
          file + '.sf.json',
          JSON.stringify({
            version: 1,
            merchant: 'TEST',
            storefront: 42,
            to: destination,
            hash: draftHash(content),
            content,
          })
        );
        return '{}';
      },
      validateLocal: async () => JSON.stringify({ valid: true, errors: 0, warnings: 0, diagnostics: [] }),
    });
    const other = { ...scope, slot: 'main_content' };
    const body = await service.pull(scope),
      main = await service.pull(other);
    assert.notEqual(body.id, main.id);
    assert.equal(main.container, '/offer/main_content.cjson');
    await assert.rejects(
      service.update({
        ...other,
        id: body.id,
        revision: 1,
        edits: [{ pointer: body.fields[0].pointer, value: 'Wrong slot' }],
      })
    );
    await service.update({
      ...other,
      id: main.id,
      revision: 1,
      edits: [{ pointer: main.fields[0].pointer, value: 'Updated main slot' }],
    });
    assert.equal(service.read(scope)?.revision, 1);
    assert.equal(service.read(other)?.revision, 2);
    assert.notEqual(service.read(scope)?.fields[0].value, 'Updated main slot');
  } finally {
    store.close();
    await rm(dir, { recursive: true, force: true });
  }
});
