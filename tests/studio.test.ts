import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fauxProvider, fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai/providers/faux';
import { Store } from '../src/main/database';
import { StudioServices } from '../src/main/services';
import { LocalCredentials, Auth } from '../src/main/auth';
import { Agents } from '../src/main/agent';

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'studio-test-'));
  const store = new Store(directory);
  const service = new StudioServices(store, () => {}, join(directory, 'missing-runtime'));
  return {
    directory,
    store,
    service,
    cleanup: async () => {
      store.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
test('sample workspace and agent setup remain available without the optional merchant toolkit', async () => {
  const f = await fixture();
  try {
    assert.equal(f.service.runtimeReady(), false);
    assert.equal(f.service.workspace().kind, 'sample');
    assert(f.service.pages().length > 0);
    const auth = new Auth(
      new LocalCredentials({}, async () => {}),
      f.store,
      () => {},
      async () => {}
    );
    const status = await auth.status();
    assert.equal(status.connected, false);
    assert(status.models.length > 0);
    await assert.rejects(f.service.connection.inspect(), /toolkit is not configured.*Studio settings/);
    const draft = await f.service.pull(f.service.scope('/'));
    assert.equal(draft.revision, 1);
  } finally {
    await f.cleanup();
  }
});
test('moving the app preserves configured toolkit paths when the new app has no bundled toolkit', async () => {
  const f = await fixture();
  try {
    const previous = f.service.settings();
    const moved = new StudioServices(f.store, () => {}, join(f.directory, 'standalone-app'));
    assert.equal(moved.settings().nodePath, previous.nodePath);
    assert.equal(moved.settings().cliPath, previous.cliPath);
  } finally {
    await f.cleanup();
  }
});
test('executable paths change only through savePath and must be absolute', async () => {
  const f = await fixture();
  try {
    const before = f.service.settings();
    const picked = join(f.directory, 'node');
    const next = f.service.savePath('nodePath', picked);
    assert.equal(next.nodePath, picked);
    assert.equal(next.cliPath, before.cliPath);
    assert.equal(f.service.settings().nodePath, picked);
    assert.throws(() => f.service.savePath('cliPath', 'relative/bin.js'));
    assert.equal(f.service.settings().cliPath, before.cliPath);
  } finally {
    await f.cleanup();
  }
});
test('sample drafts persist, invalidate reviews, and restore as a new revision', async () => {
  const f = await fixture();
  try {
    const scope = f.service.scope('/');
    const original = await f.service.pull(scope);
    const pointer = original.fields[1].pointer;
    const edited = await f.service.save({
      ...scope,
      id: original.id,
      revision: original.revision,
      edits: [{ pointer, value: 'A considered everyday.' }],
    });
    assert.equal(edited.revision, 2);
    const review = await f.service.review(scope, edited.id, edited.revision);
    assert.equal(review.validation.valid, true);
    assert.equal(f.service.getChange(edited.id).status, 'reviewed');
    await assert.rejects(f.service.restore(scope, edited.id, 1, 1), /changed in another window/);
    const restored = await f.service.restore(scope, edited.id, 1, edited.revision);
    assert.equal(restored.revision, 3);
    assert.equal(restored.changedFields, 0);
    assert.equal(f.service.getChange(edited.id).review, null);
    assert.deepEqual(
      f.service.history(edited.id).map((v) => v.revision),
      [3, 2, 1]
    );
    assert.equal(f.service.changes().length, 1);
  } finally {
    await f.cleanup();
  }
});
test('stale revisions and mismatched page scopes cannot overwrite drafts', async () => {
  const f = await fixture();
  try {
    const scope = f.service.scope('/');
    const draft = await f.service.pull(scope);
    await f.service.save({
      ...scope,
      id: draft.id,
      revision: 1,
      edits: [{ pointer: draft.fields[0].pointer, value: 'Updated' }],
    });
    await assert.rejects(
      f.service.save({ ...scope, id: draft.id, revision: 1, edits: [] }),
      /changed in another window/
    );
    await assert.rejects(
      f.service.save({ ...scope, path: '/shop/', id: draft.id, revision: 2, edits: [] }),
      /does not belong/
    );
    assert.throws(() => f.service.scope('/not-in-catalog/'), /Select a page/);
    assert.throws(() => f.service.scope('/../'), /Invalid page path/);
  } finally {
    await f.cleanup();
  }
});
test('unreadable stored rows are skipped or reported without crashing the workspace', async () => {
  const f = await fixture();
  const error = console.error;
  console.error = () => {};
  try {
    const scope = f.service.scope('/');
    const draft = await f.service.pull(scope);
    f.store.db.prepare('INSERT INTO storefront_drafts (scope_key, record) VALUES (?, ?)').run('broken', '{');
    f.store.db
      .prepare('INSERT INTO activity (id, workspace_id, at, value) VALUES (?, ?, ?, ?)')
      .run('broken', f.service.workspace().id, '9999', '{');
    f.store.db
      .prepare('INSERT INTO sessions (id, workspace_id, updated_at, value) VALUES (?, ?, ?, ?)')
      .run('broken', f.service.workspace().id, '9999', '{');
    assert.deepEqual(
      f.service.changes().map((c) => c.id),
      [draft.id]
    );
    assert(f.store.activity(f.service.workspace().id).length > 0);
    assert.deepEqual(f.store.sessions(f.service.workspace().id), []);
    assert.deepEqual(f.store.pendingSessions(), []);
    assert.throws(() => f.store.session('broken'), /conversation is unreadable/);
    f.store.db.prepare('UPDATE revisions SET value = ? WHERE draft_id = ?').run('{', draft.id);
    assert.throws(() => f.service.history(draft.id), /Revision 1 is unreadable/);
    await assert.rejects(f.service.restore(scope, draft.id, 1, 1), /revision is unreadable/);
    f.store.db.prepare('INSERT INTO kv (key, value) VALUES (?, ?)').run(`publish-attempt:${draft.id}`, '{');
    assert.throws(() => f.service.getChange(draft.id), /publish-attempt data is unreadable/);
    assert.deepEqual(f.service.changes(), []);
  } finally {
    console.error = error;
    await f.cleanup();
  }
});
test('saved content survives database reopen', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'studio-reopen-'));
  let store = new Store(directory);
  try {
    const services = new StudioServices(store, () => {}, directory);
    const draft = await services.pull(services.scope('/'));
    await services.save({
      ...services.scope('/'),
      id: draft.id,
      revision: 1,
      edits: [{ pointer: draft.fields[0].pointer, value: 'Persisted across restart' }],
    });
    store.close();
    store = new Store(directory);
    const resumed = new StudioServices(store, () => {}, directory);
    assert.equal(resumed.changes()[0].draft.fields[0].value, 'Persisted across restart');
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test('sample workspace cannot publish or stage on a real store', async () => {
  const f = await fixture();
  try {
    const scope = f.service.scope('/');
    const draft = await f.service.pull(scope);
    await assert.rejects(f.service.publish(scope, draft.id, 1, 'fieldwork.example'), /cannot be published/);
    await assert.rejects(f.service.stage(scope, draft.id, 1), /render locally/);
    assert.equal(f.store.get(`publish-attempt:${draft.id}`, null), null);
  } finally {
    await f.cleanup();
  }
});
test('template reads stay pinned to the resolved file and reject a mismatched storefront', async () => {
  const f = await fixture();
  try {
    const sample = f.service.scope('/');
    const scope = { ...sample, selection: { ...sample.selection, profileId: 'test' } };
    const path = '/themes/Test/theme/templates/home.vm';
    f.service.templates = async () => ({
      page: '/',
      themeId: 1,
      group: { name: 'home.vm', path },
      item: null,
      warnings: [],
    });
    f.service.connection.run = async (args) => {
      assert.equal(args[args.indexOf('get') + 1], path);
      assert.equal(args[args.indexOf('--profile') + 1], 'test');
      return JSON.stringify({
        action: 'sf.files.get',
        storefrontOid: scope.selection.storefront.id,
        path,
        content: '#parse("/containers/home.vm")',
      });
    };
    const source = await f.service.templateSource(scope);
    assert.equal(source.path, path);
    assert.equal(source.truncated, false);
    assert.match(source.content, /home.vm/);
    await assert.rejects(f.service.templateSource(scope, 'item'), /does not have/);
    f.service.connection.run = async () =>
      JSON.stringify({ action: 'sf.files.get', storefrontOid: 9999, path, content: 'Wrong store' });
    await assert.rejects(f.service.templateSource(scope));
  } finally {
    await f.cleanup();
  }
});
test('credential writes serialize and failed persistence does not update memory', async () => {
  let writes = 0;
  const credentials = new LocalCredentials({}, async () => {
    writes++;
  });
  await Promise.all(
    Array.from({ length: 5 }, () =>
      credentials.modify('test', async (previous) => ({
        type: 'oauth',
        access: 'not-a-real-token',
        refresh: '',
        expires: ((previous as any)?.expires || 0) + 1,
      }))
    )
  );
  assert.equal(((await credentials.read('test')) as any).expires, 5);
  assert.equal(writes, 5);
  const failing = new LocalCredentials({}, async () => {
    throw new Error('disk unavailable');
  });
  await assert.rejects(
    failing.modify('test', async () => ({
      type: 'oauth',
      access: 'not-a-real-token',
      refresh: '',
      expires: 0,
    })),
    /disk unavailable/
  );
  assert.equal(await failing.read('test'), undefined);
});
test(
  'real Pi harness executes a scoped tool and reopens its persisted transcript',
  { timeout: 15000 },
  async () => {
    const f = await fixture();
    const credentials = new LocalCredentials({}, async () => {});
    const auth = new Auth(
      credentials,
      f.store,
      () => {},
      async () => {}
    );
    const status = auth.status.bind(auth);
    auth.status = async () => ({ ...(await status()), connected: true });
    const faux = fauxProvider({ provider: 'test' });
    auth.models.setProvider(faux.provider);
    f.store.set('settings', { ...f.service.settings(), provider: 'test', model: faux.getModel().id });
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall('storefront_pull_draft', {}), { stopReason: 'toolUse' }),
      fauxAssistantMessage('The local draft is ready. Nothing was published.'),
    ]);
    let agents = new Agents(f.service, auth, () => {});
    try {
      const session = await agents.create('/');
      const requestId = randomUUID();
      await agents.submit(session.id, 'Open the homepage draft.', requestId);
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        const view = await agents.view(session.id);
        if (!view.busy && view.messages.some((m) => m.text.includes('Nothing was published'))) break;
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      const view = await agents.view(session.id);
      assert(
        view.messages.some((m) => m.role === 'tool' && m.tool === 'storefront_pull_draft'),
        JSON.stringify(view)
      );
      assert(view.messages.some((m) => m.text.includes('Nothing was published')));
      assert.equal(f.service.changes().length, 1);
      await agents.close();
      agents = new Agents(f.service, auth, () => {});
      const reopened = await agents.view(session.id);
      assert.deepEqual(reopened.messages, view.messages);
      assert.equal(faux.state.callCount, 2);
    } finally {
      await agents.close();
      await f.cleanup();
    }
  }
);
