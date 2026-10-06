import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/main/database';
import { StudioServices, workspaceId } from '../src/main/services';
import { sampleBody, samplePages } from '../src/shared/sample';
import { draftHash } from '../src/main/domain/draft-service';
import type { Selection, Workspace } from '../src/shared/types';

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'studio-publish-'));
  const store = new Store(directory);
  const service = new StudioServices(store, () => {}, directory);
  const selection: Selection = {
    profileId: 'test',
    merchantId: 'TEST',
    storefront: { id: 10, host: 'test.example', themeId: 5 },
    verifiedAt: new Date().toISOString(),
  };
  const workspace: Workspace = { id: workspaceId(selection), kind: 'live', label: 'Test store', selection };
  store.set('workspace', workspace);
  store.set(`pages:${workspace.id}`, samplePages);
  let remote = sampleBody('/');
  let pushes = 0;
  let failAfterWrite = false;
  let rejectPush = false;
  service.connection.verify = async () => selection.storefront;
  service.connection.validateLocal = async () =>
    JSON.stringify({ valid: true, errors: 0, warnings: 0, diagnostics: [] });
  service.connection.run = async (args) => {
    if (args.includes('pull')) {
      const file = args[args.indexOf('--out') + 1];
      await writeFile(file, remote, { flag: 'wx' });
      await writeFile(
        file + '.sf.json',
        JSON.stringify({
          version: 1,
          merchant: 'TEST',
          storefront: 10,
          to: '/body.cjson',
          hash: draftHash(remote),
          content: remote,
        }),
        { flag: 'wx' }
      );
      return '{}';
    }
    if (args.includes('push')) {
      pushes++;
      if (rejectPush) throw new Error('403 Forbidden');
      remote = await readFile(args[args.indexOf('push') + 1], 'utf8');
      if (failAfterWrite) throw new Error('Connection lost after write');
      return '{}';
    }
    if (args.includes('start')) return JSON.stringify({ preview_session_id: 'a'.repeat(32) });
    if (args.includes('stage')) return JSON.stringify({ themeOid: 5 });
    if (args.includes('open')) return JSON.stringify({ access_url: 'https://test.example/' });
    if (args.includes('end')) return '{}';
    throw new Error('Unexpected fake toolkit operation');
  };
  return {
    store,
    service,
    pushes: () => pushes,
    disconnectAfterWrite: () => {
      failAfterWrite = true;
    },
    rejectPushes: (value = true) => {
      rejectPush = value;
    },
    setRemote: (text: string) => {
      remote = text;
    },
    remote: () => remote,
    changeRemote: () => {
      remote = sampleBody('/shop/');
    },
    cleanup: async () => {
      store.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
async function edited(f: Awaited<ReturnType<typeof fixture>>) {
  const scope = f.service.scope('/');
  const baseline = await f.service.pull(scope);
  const draft = await f.service.save({
    ...scope,
    id: baseline.id,
    revision: 1,
    edits: [{ pointer: baseline.fields[1].pointer, value: 'A reviewed change.' }],
  });
  return { scope, draft };
}
test('publishing requires the exact host, an applied preview, and a current remote baseline', async () => {
  const f = await fixture();
  try {
    const { scope, draft } = await edited(f);
    await assert.rejects(
      f.service.publish(scope, draft.id, draft.revision, 'wrong.example'),
      /exact storefront/
    );
    await assert.rejects(
      f.service.publish(scope, draft.id, draft.revision, 'test.example'),
      /exact revision/
    );
    await f.service.stage(scope, draft.id, draft.revision);
    await assert.rejects(
      f.service.publish(scope, draft.id, draft.revision, 'test.example'),
      /exact revision/
    );
    f.service.markPreview(draft.id, draft.revision);
    f.changeRemote();
    await assert.rejects(
      f.service.publish(scope, draft.id, draft.revision, 'test.example'),
      /remote content changed/
    );
    assert.equal(f.pushes(), 0);
  } finally {
    await f.cleanup();
  }
});
test('an uncertain write is verified without replay, and a new draft preserves revision history', async () => {
  const f = await fixture();
  try {
    const { scope, draft } = await edited(f);
    await f.service.stage(scope, draft.id, draft.revision);
    f.service.markPreview(draft.id, draft.revision);
    f.disconnectAfterWrite();
    await assert.rejects(
      f.service.publish(scope, draft.id, draft.revision, 'test.example'),
      /Connection lost/
    );
    assert.equal(f.service.getChange(draft.id).publishPending, true);
    await assert.rejects(
      f.service.publish(scope, draft.id, draft.revision, 'test.example'),
      /already started/
    );
    await assert.rejects(
      f.service.save({ ...scope, id: draft.id, revision: draft.revision, edits: [] }),
      /needs verification/
    );
    await f.service.verifyPublish(scope, draft.id, draft.revision);
    assert.equal(f.service.getChange(draft.id).status, 'published');
    assert.equal(f.pushes(), 1);
    const next = await f.service.nextDraft(scope, draft.id, draft.revision);
    assert.equal(next.revision, 3);
    assert.equal(next.changedFields, 0);
    assert.equal(next.fields[1].before, 'A reviewed change.');
    assert.deepEqual(
      f.service.history(draft.id).map((r) => r.revision),
      [3, 2, 1]
    );
    await f.service.save({
      ...scope,
      id: draft.id,
      revision: 3,
      edits: [{ pointer: draft.fields[1].pointer, value: 'The next change.' }],
    });
    assert.equal(f.service.getChange(draft.id).draft.revision, 4);
  } finally {
    await f.cleanup();
  }
});
async function previewed(f: Awaited<ReturnType<typeof fixture>>) {
  const { scope, draft } = await edited(f);
  await f.service.stage(scope, draft.id, draft.revision);
  f.service.markPreview(draft.id, draft.revision);
  return { scope, draft };
}
test('a rejected push with an unchanged live page clears the attempt and allows a retry', async () => {
  const f = await fixture();
  try {
    const { scope, draft } = await previewed(f);
    f.rejectPushes();
    await assert.rejects(f.service.publish(scope, draft.id, draft.revision, 'test.example'), /403/);
    assert.equal(f.service.getChange(draft.id).status, 'unverified');
    const settled = await f.service.verifyPublish(scope, draft.id, draft.revision);
    assert.equal(settled.publishPending, false);
    assert.equal(settled.publishedAt, null);
    assert(f.store.activity(workspaceId(scope.selection)).some((a) => a.text === 'Publish not applied'));
    f.rejectPushes(false);
    const published = await f.service.publish(scope, draft.id, draft.revision, 'test.example');
    assert.equal(published.status, 'published');
    assert.equal(f.pushes(), 2);
  } finally {
    await f.cleanup();
  }
});
test('a push the server ignores reports a retryable result instead of success', async () => {
  const f = await fixture();
  try {
    const { scope, draft } = await previewed(f);
    const before = f.remote();
    const run = f.service.connection.run;
    f.service.connection.run = async (args, options) => {
      if (!args.includes('push')) return run(args, options);
      f.setRemote(before);
      return '{}';
    };
    await assert.rejects(
      f.service.publish(scope, draft.id, draft.revision, 'test.example'),
      /left the live page unchanged/
    );
    assert.equal(f.service.getChange(draft.id).publishPending, false);
  } finally {
    await f.cleanup();
  }
});
test('a live page matching neither revision nor baseline requires a confirmed abandon', async () => {
  const f = await fixture();
  try {
    const { scope, draft } = await previewed(f);
    f.rejectPushes();
    await assert.rejects(f.service.publish(scope, draft.id, draft.revision, 'test.example'));
    f.changeRemote();
    await assert.rejects(f.service.verifyPublish(scope, draft.id, draft.revision), /matches neither/);
    assert.equal(f.service.getChange(draft.id).publishPending, true);
    await assert.rejects(f.service.abandonPublish(scope, draft.id, draft.revision), /exact storefront host/);
    await assert.rejects(
      f.service.abandonPublish(scope, draft.id, draft.revision, 'wrong.example'),
      /exact storefront host/
    );
    assert.equal(f.service.getChange(draft.id).publishPending, true);
    const change = await f.service.abandonPublish(scope, draft.id, draft.revision, 'test.example');
    assert.equal(change.publishPending, false);
    assert.equal(change.draft.revision, draft.revision + 1);
    assert.equal(change.draft.changedFields, 0);
    assert.equal(f.service.exportDraft(scope, draft.id, change.draft.revision), f.remote());
    assert.deepEqual(
      f.service.history(draft.id).map((r) => r.revision),
      [3, 2, 1]
    );
    await f.service.save({
      ...scope,
      id: draft.id,
      revision: 3,
      edits: [{ pointer: change.draft.fields[1].pointer, value: 'After abandon.' }],
    });
  } finally {
    await f.cleanup();
  }
});
test('abandoning with an unchanged live page keeps the draft edits without confirmation', async () => {
  const f = await fixture();
  try {
    const { scope, draft } = await previewed(f);
    f.rejectPushes();
    await assert.rejects(f.service.publish(scope, draft.id, draft.revision, 'test.example'));
    const change = await f.service.abandonPublish(scope, draft.id, draft.revision);
    assert.equal(change.publishPending, false);
    assert.equal(change.draft.revision, draft.revision);
    assert.equal(change.draft.fields[1].value, 'A reviewed change.');
    await assert.rejects(
      f.service.abandonPublish(scope, draft.id, draft.revision),
      /No matching publish attempt/
    );
  } finally {
    await f.cleanup();
  }
});
test('a non-JSON pull during verification is a recoverable error', async () => {
  const f = await fixture();
  try {
    const { scope, draft } = await previewed(f);
    f.disconnectAfterWrite();
    await assert.rejects(f.service.publish(scope, draft.id, draft.revision, 'test.example'));
    const written = f.remote();
    f.setRemote('{"truncated":');
    await assert.rejects(
      f.service.verifyPublish(scope, draft.id, draft.revision),
      (error: Error) => !(error instanceof SyntaxError) && /Retry verification/.test(error.message)
    );
    assert.equal(f.service.getChange(draft.id).publishPending, true);
    f.setRemote(written);
    assert.equal((await f.service.verifyPublish(scope, draft.id, draft.revision)).status, 'published');
  } finally {
    await f.cleanup();
  }
});
