import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/main/database';
import { StudioServices, workspaceId } from '../src/main/services';
import { draftHash } from '../src/main/domain/draft-service';
import { WidgetIdsService, type WidgetIdTransport } from '../src/main/widget-ids';
import {
  createPageDocument,
  createSection,
  LOCAL_WIDGET_PREFIX,
  parsePageDocument,
  serializePageDocument,
  type CjsonNode,
} from '../src/shared/page-builder';
import { samplePages, sampleWorkspace } from '../src/shared/sample';
import type { Selection } from '../src/shared/connection';

const selection: Selection = {
  profileId: 'merchant-test',
  merchantId: 'TEST',
  storefront: { id: 42, host: 'shop.example', themeId: 7 },
  verifiedAt: '2026-01-01',
};
const schema = {
  properties: {
    target: { 'x-sfvb-format': 'widget-id' },
    targets: { 'x-sfvb-format': 'widget-id' },
    child: { 'x-sfvb-format': 'child-widget' },
    scopedStyles: { 'x-sfvb-format': 'css' },
  },
};
function document(count = 2) {
  return serializePageDocument({
    id: 'container-1',
    type: 'container',
    config: {},
    childWidgets: Array.from({ length: count }, (_, index) => ({
      id: `${LOCAL_WIDGET_PREFIX}${index}`,
      type: 'text',
      config: { html: `<p>Content ${index}</p>` },
      childWidgets: [],
      parentWidgetId: 'container-1',
      containerId: 'container-1',
    })),
  });
}
function walk(root: CjsonNode): CjsonNode[] {
  return [root, ...(root.childWidgets ?? []).flatMap(walk)];
}
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'studio-widget-ids-'));
  const store = new Store(directory),
    services = new StudioServices(store, () => {}, directory);
  let next = 1000,
    verifyCount = 0;
  const allocations: number[] = [];
  const transport: WidgetIdTransport = {
    verify: async (input) => {
      assert.deepEqual(input, selection);
      verifyCount++;
    },
    reserve: async (input, count) => {
      assert.deepEqual(input, selection);
      allocations.push(count);
      return { ids: Array.from({ length: count }, () => next++), count };
    },
  };
  const options = { transport, schemaFor: async () => schema };
  const ids = new WidgetIdsService(services, options);
  return {
    ids,
    options,
    services,
    store,
    transport,
    allocations,
    verifications: () => verifyCount,
    close: async () => {
      store.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
const input = (content = document(), operationKey = 'draft:test:1') => ({ selection, content, operationKey });
const confirmed = (content = document(), operationKey = 'draft:test:1') => ({
  ...input(content, operationKey),
  confirmedHost: selection.storefront.host,
});

test('native ID preparation changes only local IDs and declared references, with intent saved before allocation', async () => {
  const f = await fixture();
  try {
    const root = parsePageDocument(document());
    root.childWidgets[0].config = {
      target: `${LOCAL_WIDGET_PREFIX}1`,
      targets: [`${LOCAL_WIDGET_PREFIX}1`, 'merchant-existing'],
      child: { small: `${LOCAL_WIDGET_PREFIX}1` },
      scopedStyles: `#${LOCAL_WIDGET_PREFIX}1 { color: red; content: "Leave this copy alone"; }`,
      html: '<p>Unrelated text stays identical.</p>',
    };
    root.childWidgets.push({
      id: 'text-77',
      type: 'text',
      config: { html: '<p>Existing merchant content</p>' },
      childWidgets: [],
    });
    const content = serializePageDocument(root);
    const reserve = f.transport.reserve;
    f.transport.reserve = async (selection, count) => {
      const before = f.ids.inspect(input(content)).receipt!;
      assert.equal(before.status, 'allocating');
      assert.equal(before.batches.at(-1)!.status, 'started');
      return reserve(selection, count);
    };
    const result = await f.ids.reserve(confirmed(content));
    const output = parsePageDocument(result.content);
    assert.equal(output.id, 'container-1');
    assert.equal(output.childWidgets[2].id, 'text-77');
    assert.equal(output.childWidgets[0].id, 'text-1000');
    assert.equal(output.childWidgets[0].config.target, 'text-1001');
    assert.deepEqual(output.childWidgets[0].config.targets, ['text-1001', 'merchant-existing']);
    assert.deepEqual(output.childWidgets[0].config.child, { small: 'text-1001' });
    assert.equal(
      output.childWidgets[0].config.scopedStyles,
      '#text-1001 { color: red; content: "Leave this copy alone"; }'
    );
    assert.equal(output.childWidgets[0].config.html, root.childWidgets[0].config.html);
    assert.equal(result.receipt.status, 'complete');
    assert.equal(result.receipt.batches[0].status, 'confirmed');
    assert.equal(f.verifications(), 2);
    assert.match(result.receipt.provenance, /without ownership fields/);
    const recovered = await new WidgetIdsService(f.services, f.options).reserve(confirmed(content));
    assert.equal(recovered.content, result.content);
    assert.deepEqual(f.allocations, [2]);
    await assert.rejects(f.ids.reserve({ ...confirmed(content), content: document(3) }), /different content/);
    await assert.rejects(
      f.ids.reserve({ ...confirmed(content), selection: { ...selection, merchantId: 'OTHER' } }),
      /different storefront/
    );
  } finally {
    await f.close();
  }
});

test('local root and all new section widgets receive reserved IDs, with matching linkage', async () => {
  const f = await fixture();
  try {
    const root = createPageDocument([createSection('hero')]),
      content = serializePageDocument(root);
    const result = await f.ids.reserve(confirmed(content));
    const output = parsePageDocument(result.content);
    assert.equal(walk(output).length, walk(root).length);
    assert(walk(output).every((node) => !node.id.startsWith(LOCAL_WIDGET_PREFIX)));
    for (const parent of walk(output))
      for (const child of parent.childWidgets) {
        assert.equal(child.parentWidgetId, parent.id);
        assert.equal(child.containerId, output.id);
      }
  } finally {
    await f.close();
  }
});

test('unknown, literal, and CSS string references stop before any IDs are allocated', async () => {
  const f = await fixture();
  try {
    for (const config of [
      { html: `<a href="#${LOCAL_WIDGET_PREFIX}1">Link</a>` },
      { unknownReference: `${LOCAL_WIDGET_PREFIX}1` },
      { target: `${LOCAL_WIDGET_PREFIX}missing` },
      { scopedStyles: `.copy { content: "#${LOCAL_WIDGET_PREFIX}1"; }` },
      { scopedStyles: `.copy { background: url(https://example.com/#${LOCAL_WIDGET_PREFIX}1); }` },
    ]) {
      const root = parsePageDocument(document());
      root.childWidgets[0].config = config;
      await assert.rejects(f.ids.reserve(confirmed(serializePageDocument(root))), /unsupported reference/);
    }
    assert.equal(f.allocations.length, 0);
    assert.equal(f.ids.inspect(input()).receipt, null);
  } finally {
    await f.close();
  }
});

test('partial allocation persists completed and uncertain batches and never retries after restart', async () => {
  const f = await fixture();
  try {
    const reserve = f.transport.reserve;
    f.transport.reserve = async (selection, count) => {
      if (f.allocations.length) throw new Error('Connection lost');
      return reserve(selection, count);
    };
    const content = document(101);
    await assert.rejects(f.ids.reserve(confirmed(content)), /Connection lost/);
    const receipt = f.ids.inspect(input(content)).receipt!;
    assert.equal(receipt.status, 'uncertain');
    assert.equal(receipt.batches[0].status, 'confirmed');
    assert.equal(receipt.batches[0].ids!.length, 100);
    assert.equal(receipt.batches[1].status, 'started');
    const restarted = new WidgetIdsService(f.services, f.options);
    await assert.rejects(restarted.reserve(confirmed(content)), /automatic retry is disabled/);
    assert.deepEqual(f.allocations, [100]);
  } finally {
    await f.close();
  }
});

test('invalid counts, collisions, and post-allocation identity changes retain observed IDs and refuse replay', async () => {
  for (const response of [
    { ids: [1000], count: 1 },
    { ids: [1000, 1000], count: 2 },
    { ids: [1, 1001], count: 2 },
  ]) {
    const f = await fixture();
    try {
      let calls = 0;
      f.transport.reserve = async () => {
        calls++;
        return response;
      };
      await assert.rejects(f.ids.reserve(confirmed()));
      const receipt = f.ids.inspect(input()).receipt!;
      assert.equal(receipt.status, 'uncertain');
      assert.deepEqual(receipt.batches[0].ids, response.ids);
      await assert.rejects(f.ids.reserve(confirmed()), /automatic retry is disabled/);
      assert.equal(calls, 1);
    } finally {
      await f.close();
    }
  }
  const f = await fixture();
  try {
    let verifications = 0;
    f.transport.verify = async () => {
      if (++verifications === 2) throw new Error('Merchant identity changed');
    };
    await assert.rejects(f.ids.reserve(confirmed()), /identity changed/);
    assert.equal(f.ids.inspect(input()).receipt!.batches[0].status, 'received');
    assert.equal(f.ids.inspect(input()).receipt!.status, 'uncertain');
  } finally {
    await f.close();
  }
});

test('host confirmation, sample isolation, and stale preflight guards prevent allocation', async () => {
  const f = await fixture();
  try {
    await assert.rejects(
      f.ids.reserve({ ...confirmed(), confirmedHost: 'other.example' }),
      /exact storefront/
    );
    const sample = { ...input(), selection: sampleWorkspace.selection };
    assert.equal(f.ids.inspect(sample).canReserve, false);
    await assert.rejects(
      f.ids.reserve({ ...sample, confirmedHost: sample.selection.storefront.host }),
      /Sample pages/
    );
    let current = true;
    const guarded = new WidgetIdsService(f.services, {
      ...f.options,
      schemaFor: async () => {
        current = false;
        return schema;
      },
      assertCurrent: () => {
        if (!current) throw new Error('Draft changed');
      },
    });
    await assert.rejects(guarded.reserve(confirmed()), /Draft changed/);
    assert.equal(f.allocations.length, 0);
    assert.equal(f.verifications(), 0);
  } finally {
    await f.close();
  }
});

test('concurrent reservations for the same operation allocate only once', async () => {
  const f = await fixture();
  try {
    const other = new WidgetIdsService(f.services, f.options);
    const outcomes = await Promise.allSettled([f.ids.reserve(confirmed()), other.reserve(confirmed())]);
    assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter((outcome) => outcome.status === 'rejected').length, 1);
    assert.deepEqual(f.allocations, [2]);
  } finally {
    await f.close();
  }
});

async function liveDraft(f: Awaited<ReturnType<typeof fixture>>) {
  const workspace = { id: workspaceId(selection), label: 'Test merchant', kind: 'live' as const, selection };
  f.store.set('workspace', workspace);
  f.store.set(`pages:${workspace.id}`, samplePages);
  const baseline = document(0);
  f.services.connection.verify = async () => selection.storefront;
  f.services.connection.run = async (args) => {
    assert(args.includes('pull'));
    const file = args[args.indexOf('--out') + 1];
    await writeFile(file, baseline);
    await writeFile(
      file + '.sf.json',
      JSON.stringify({
        version: 1,
        merchant: selection.merchantId,
        storefront: selection.storefront.id,
        to: '/body.cjson',
        hash: draftHash(baseline),
        content: baseline,
      })
    );
    return '{}';
  };
  const scope = f.services.scope('/');
  const original = await f.services.pull(scope);
  const draft = await f.services.saveStructure({
    ...scope,
    id: original.id,
    revision: original.revision,
    operation: { kind: 'add', parentId: 'container-1', pattern: 'hero' },
  });
  const content = f.services.exportDraft(scope, draft.id, draft.revision);
  return { workspace, scope, draft, content, baseline };
}

test('a stale draft edit after allocation retains the receipt without overwriting newer content', async (t) => {
  const f = await fixture();
  try {
    const { scope, draft, content, baseline } = await liveDraft(f);
    const actualReserve = WidgetIdsService.prototype.reserve;
    t.mock.method(WidgetIdsService.prototype, 'reserve', function (this: WidgetIdsService, raw: unknown) {
      const assertCurrent = Reflect.get(this, 'options').assertCurrent as () => void;
      return actualReserve.call(new WidgetIdsService(f.services, { ...f.options, assertCurrent }), raw);
    });
    const allocate = f.transport.reserve;
    f.transport.reserve = async (selection, count) => {
      const receipt = await allocate(selection, count);
      await f.services.save({
        ...scope,
        id: draft.id,
        revision: draft.revision,
        edits: [{ pointer: draft.fields[0].pointer, value: 'A newer user edit' }],
      });
      return receipt;
    };
    await assert.rejects(
      f.services.reserveNativeIds(scope, draft.id, draft.revision, selection.storefront.host),
      /draft changed|belongs to another page/i
    );
    const latest = f.services.drafts.readDocument(scope)!;
    assert.equal(latest.draft.revision, draft.revision + 1);
    assert.equal(latest.draft.fields[0].value, 'A newer user edit');
    assert.equal(latest.baseline, baseline);
    assert(latest.draft.localWidgetCount! > 0);
    const receipt = f.ids.inspect(input(content, `draft:${draft.id}:revision:${draft.revision}`)).receipt!;
    assert.equal(receipt.status, 'complete');
    assert(receipt.preparedContent);
    assert.equal(f.allocations.length, 1);
  } finally {
    await f.close();
  }
});

test('a workspace switch after allocation preserves the receipt and recovers without allocating again', async (t) => {
  const f = await fixture();
  try {
    const { workspace, scope, draft, content } = await liveDraft(f);
    const actualReserve = WidgetIdsService.prototype.reserve;
    t.mock.method(WidgetIdsService.prototype, 'reserve', function (this: WidgetIdsService, raw: unknown) {
      const assertCurrent = Reflect.get(this, 'options').assertCurrent as () => void;
      return actualReserve.call(new WidgetIdsService(f.services, { ...f.options, assertCurrent }), raw);
    });
    const allocate = f.transport.reserve;
    f.transport.reserve = async (selection, count) => {
      const receipt = await allocate(selection, count);
      f.services.useSample();
      return receipt;
    };
    await assert.rejects(
      f.services.reserveNativeIds(scope, draft.id, draft.revision, selection.storefront.host),
      /active storefront changed/
    );
    assert.equal(f.services.exportDraft(scope, draft.id, draft.revision), content);
    assert.equal(
      f.ids.inspect(input(content, `draft:${draft.id}:revision:${draft.revision}`)).receipt!.status,
      'complete'
    );
    f.store.set('workspace', workspace);
    const recovered = await f.services.reserveNativeIds(
      scope,
      draft.id,
      draft.revision,
      selection.storefront.host
    );
    assert.equal(recovered.draft.revision, draft.revision + 1);
    assert.equal(recovered.draft.localWidgetCount, 0);
    assert.equal(f.allocations.length, 1);
  } finally {
    await f.close();
  }
});
