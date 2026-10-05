import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  applyBuilderOperation,
  createPageDocument,
  createSection,
  inspectBuilderContent,
  LOCAL_WIDGET_PREFIX,
  parsePageDocument,
  safeSectionHref,
  structureChanges,
  serializePageDocument,
  type CjsonNode,
} from '../src/shared/page-builder';
import { sampleBody } from '../src/shared/sample';
import { DraftService, draftChanges, draftHash, type DraftToolkit } from '../src/main/domain/draft-service';
import { Store } from '../src/main/database';
import { StudioServices } from '../src/main/services';
import { PageBuilderService } from '../src/main/page-builder';

function walk(root: CjsonNode): CjsonNode[] {
  return [root, ...(root.childWidgets ?? []).flatMap(walk)];
}
test('native section patterns have unique local IDs and correct parent/container references', () => {
  const root = createPageDocument(
    ['hero', 'benefits', 'faq', 'cta'].map((pattern) => createSection(pattern as 'hero'))
  );
  const nodes = walk(root);
  assert.equal(new Set(nodes.map((node) => node.id)).size, nodes.length);
  assert(nodes.every((node) => node.id.startsWith(LOCAL_WIDGET_PREFIX)));
  for (const parent of nodes)
    for (const [index, child] of parent.childWidgets.entries()) {
      assert.equal(child.parentWidgetId, parent.id);
      assert.equal(child.containerId, root.id);
      assert.equal(child.x, index);
    }
  const text = nodes.find((node) => node.type === 'text')!;
  assert.equal(typeof text.config.html, 'string');
  const button = nodes.find((node) => node.type === 'button')!;
  assert.equal(button.config.buttonAction, 'URL Action');
  assert.equal(button.config.buttonUrlAction, '/shop/');
  assert(
    nodes
      .filter((node) => node.type === 'column')
      .every((node) => typeof node.config.gridColumnCountSmall === 'number')
  );
  assert.doesNotThrow(() => parsePageDocument(serializePageDocument(root)));
});
test('new section copy is escaped and unsafe button destinations are rejected', () => {
  const root = createSection('hero', { title: '<script>alert(1)</script>', href: '/shop/' });
  assert(walk(root).some((node) => String(node.config.html).includes('&lt;script&gt;')));
  assert(!serializePageDocument(root).includes('<script>'));
  assert.equal(safeSectionHref('/shop/?campaign=spring%20collection'), '/shop/?campaign=spring%20collection');
  for (const href of [
    'javascript:alert(1)',
    'data:text/html,test',
    '//evil.example',
    '/\\evil.example',
    'https://user:password@example.com',
    '/%2f%2fevil.example',
    '/%255c%255cevil.example',
    '/path%0ato',
  ])
    assert.throws(() => createSection('cta', { href }));
});
test('a queued structural edit stops if publishing starts before its turn', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'studio-builder-queued-'));
  const store = new Store(directory);
  try {
    const services = new StudioServices(store, () => {}, directory);
    const scope = services.scope('/');
    const draft = await services.pull(scope);
    const queued = services.saveStructure({
      ...scope,
      id: draft.id,
      revision: 1,
      operation: { kind: 'add', parentId: 'page-body', pattern: 'hero' },
    });
    store.set(`publish-attempt:${draft.id}`, { revision: 1 });
    await assert.rejects(queued, /needs verification/);
    assert.equal(services.getChange(draft.id).draft.revision, 1);
    assert.equal(services.history(draft.id).length, 1);
    await assert.rejects(services.restore(scope, draft.id, 1), /needs verification/);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test('adding a section preserves existing widget identities and parent relationships', () => {
  const original = createPageDocument([createSection('hero'), createSection('faq')]);
  const parents = new Map(walk(original).map((node) => [node.id, node.parentWidgetId]));
  const content = applyBuilderOperation(serializePageDocument(original), {
    kind: 'add',
    parentId: original.id,
    afterId: original.childWidgets[0].id,
    pattern: 'benefits',
  });
  const result = parsePageDocument(content);
  assert.equal(result.childWidgets[0].id, original.childWidgets[0].id);
  assert.equal(result.childWidgets[2].id, original.childWidgets[1].id);
  for (const node of walk(result))
    if (parents.has(node.id)) assert.equal(node.parentWidgetId, parents.get(node.id));
});
test('moving a widget preserves its identity and does not report unrelated text as changed', () => {
  const original = sampleBody('/');
  const moved = applyBuilderOperation(original, { kind: 'move', nodeId: 'headline', direction: 'up' });
  assert.equal(parsePageDocument(moved).childWidgets[0].id, 'headline');
  assert.equal(draftChanges(original, moved).length, 0);
  assert(
    inspectBuilderContent(moved, original).structureChanges.some(
      (change) => change.kind === 'moved' && change.id === 'headline'
    )
  );
  assert.equal(applyBuilderOperation(moved, { kind: 'move', nodeId: 'headline', direction: 'up' }), moved);
});
test('inserting or removing a section does not mark unchanged siblings as moved', () => {
  const original = sampleBody('/');
  const added = applyBuilderOperation(original, {
    kind: 'add',
    parentId: 'page-body',
    afterId: 'eyebrow',
    pattern: 'faq',
  });
  const changes = structureChanges(original, added);
  assert.equal(changes.length, 11);
  assert(changes.every((change) => change.kind === 'added'));
  const inserted = parsePageDocument(added).childWidgets[1];
  const removed = applyBuilderOperation(added, { kind: 'remove', nodeId: inserted.id });
  assert.deepEqual(structureChanges(original, removed), []);
  const removalChanges = structureChanges(added, removed);
  assert.equal(removalChanges.length, 11);
  assert(removalChanges.every((change) => change.kind === 'removed'));
  const moved = applyBuilderOperation(added, { kind: 'move', nodeId: 'headline', direction: 'down' });
  const actualMoves = structureChanges(original, moved)
    .filter((change) => change.kind === 'moved')
    .map((change) => change.id);
  assert.deepEqual(actualMoves, ['description', 'headline']);
});
test('the section canvas receives existing sample text and button labels', () => {
  const nodes = inspectBuilderContent(sampleBody('/')).root.children;
  assert.equal(nodes.find((node) => node.id === 'eyebrow')?.text, 'LESS, BUT BETTER.');
  assert.equal(nodes.find((node) => node.id === 'headline')?.text, 'Good things.\nSimple rituals.');
  assert.equal(nodes.find((node) => node.id === 'cta')?.text, 'Find your everyday');
  assert(nodes.every((node) => node.text.length > 0));
});
test('duplicating a subtree remaps internal widget references, including lists and scoped selectors', () => {
  const original = JSON.stringify({
    id: 'root',
    type: 'container',
    config: {},
    childWidgets: [
      {
        id: 'group-1',
        type: 'section',
        config: {},
        childWidgets: [
          {
            id: 'button-1',
            type: 'button',
            config: { buttonShowThese: ['target-1'], scopedStyles: '#target-1 { color:red }' },
            childWidgets: [],
          },
          { id: 'target-1', type: 'text', config: { html: '<p>Original</p>' }, childWidgets: [] },
        ],
      },
    ],
  });
  const result = parsePageDocument(applyBuilderOperation(original, { kind: 'duplicate', nodeId: 'group-1' }));
  assert.equal(result.childWidgets[0].id, 'group-1');
  const copy = result.childWidgets[1];
  assert(copy.id.startsWith(LOCAL_WIDGET_PREFIX));
  assert.deepEqual(copy.childWidgets[0].config.buttonShowThese, [copy.childWidgets[1].id]);
  assert.equal(copy.childWidgets[0].config.scopedStyles, `#${copy.childWidgets[1].id} { color:red }`);
  assert.equal(copy.childWidgets[1].parentWidgetId, copy.id);
  assert.equal(copy.childWidgets[1].containerId, result.id);
});
test('removal rejects dangling references and root mutations', () => {
  const original = JSON.stringify({
    id: 'root',
    type: 'container',
    config: {},
    childWidgets: [
      { id: 'button-1', type: 'button', config: { buttonShowThese: ['target-1'] }, childWidgets: [] },
      { id: 'target-1', type: 'text', config: { html: '<p>Original</p>' }, childWidgets: [] },
    ],
  });
  assert.throws(() => applyBuilderOperation(original, { kind: 'remove', nodeId: 'target-1' }), /references/);
  assert.throws(() => applyBuilderOperation(original, { kind: 'remove', nodeId: 'root' }), /root/);
  assert.throws(
    () => applyBuilderOperation(original, { kind: 'add', parentId: 'target-1', pattern: 'hero' }),
    /inside the page body/
  );
  assert.throws(
    () =>
      applyBuilderOperation(original, { kind: 'add', parentId: 'root', afterId: 'absent', pattern: 'hero' }),
    /insertion point/
  );
});
test('tree parser rejects duplicate IDs, unsafe top-level keys, and oversized bodies', () => {
  assert.throws(
    () =>
      parsePageDocument(
        JSON.stringify({
          id: 'root',
          type: 'container',
          config: {},
          childWidgets: [{ id: 'root', type: 'text', config: {} }],
        })
      ),
    /Duplicate widget ID/
  );
  assert.throws(
    () => parsePageDocument('{"id":"root","type":"container","config":{},"childWidgets":[],"__proto__":{}}'),
    /Unsupported widget property/
  );
  assert.throws(
    () =>
      parsePageDocument(
        JSON.stringify({ id: 'root', type: 'text', config: { html: 'x'.repeat(530000) }, childWidgets: [] })
      ),
    /512 KiB/
  );
});
test('structural draft revisions enforce scope/CAS and preserve the immutable baseline', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'studio-builder-'));
  const store = new Store(directory);
  try {
    const services = new StudioServices(store, () => {}, directory);
    const scope = services.scope('/');
    const draft = await services.pull(scope);
    const before = services.sampleDrafts.readDocument(scope)!;
    const builder = new PageBuilderService(services);
    const added = await builder.apply({
      ...scope,
      id: draft.id,
      revision: draft.revision,
      operation: { kind: 'add', parentId: 'page-body', pattern: 'hero' },
    });
    assert.equal(added.draft.revision, 2);
    assert(added.localNodeIds.length > 0);
    assert.equal(services.sampleDrafts.readDocument(scope)!.baseline, before.baseline);
    await assert.rejects(
      builder.apply({
        ...scope,
        id: draft.id,
        revision: 1,
        operation: { kind: 'remove', nodeId: 'headline' },
      }),
      /changed in another window/
    );
    await assert.rejects(
      builder.apply({
        ...scope,
        path: '/our-story/',
        id: draft.id,
        revision: 2,
        operation: { kind: 'remove', nodeId: 'headline' },
      }),
      /does not belong/
    );
    await assert.rejects(
      services.drafts.updateStructure({
        ...scope,
        selection: { ...scope.selection, merchantId: 'OTHER' },
        id: draft.id,
        revision: 2,
        operation: { kind: 'remove', nodeId: 'headline' },
      }),
      /does not belong/
    );
    await services.review(scope, draft.id, 2);
    assert.equal(services.getChange(draft.id).status, 'reviewed');
    const moved = await builder.apply({
      ...scope,
      id: draft.id,
      revision: 2,
      operation: { kind: 'move', nodeId: 'headline', direction: 'up' },
    });
    assert.equal(moved.draft.revision, 3);
    assert.equal(services.getChange(draft.id).review, null);
    const restored = await services.restore(scope, draft.id, 1);
    assert.equal(restored.revision, 4);
    assert.equal(restored.localWidgetCount, 0);
    assert.deepEqual(restored.structureChanges, []);
    assert.equal(services.sampleDrafts.readDocument(scope)!.content, before.content);
    assert.deepEqual(
      services.history(draft.id).map((item) => item.revision),
      [4, 3, 2, 1]
    );
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test('live validation cannot approve new local widget IDs even when the toolkit reports no errors', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE storefront_drafts (scope_key TEXT PRIMARY KEY, record TEXT NOT NULL)');
  const content = JSON.stringify({ id: 'container-123', type: 'container', config: {}, childWidgets: [] });
  const scope = {
    selection: {
      profileId: 'test',
      merchantId: 'TEST',
      storefront: { id: 2, host: 'shop.example', themeId: 3 },
      verifiedAt: new Date().toISOString(),
    },
    path: '/',
    slot: 'body',
  };
  const toolkit: DraftToolkit = {
    verify: async () => {},
    validateLocal: async (file) => {
      assert((await readFile(file, 'utf8')).includes(LOCAL_WIDGET_PREFIX));
      return JSON.stringify({ valid: true, errors: 0, warnings: 0, diagnostics: [] });
    },
    run: async (args) => {
      const file = args[args.indexOf('--out') + 1];
      await writeFile(file, content);
      await writeFile(
        `${file}.sf.json`,
        JSON.stringify({
          version: 1,
          merchant: 'TEST',
          storefront: 2,
          to: '/body.cjson',
          hash: draftHash(content),
          content,
        })
      );
      return '{}';
    },
  };
  try {
    const drafts = new DraftService(db, toolkit);
    const draft = await drafts.pull(scope);
    const edited = await drafts.updateStructure({
      ...scope,
      id: draft.id,
      revision: 1,
      operation: { kind: 'add', parentId: 'container-123', pattern: 'faq' },
    });
    const review = await drafts.review({ ...scope, id: draft.id, revision: edited.revision });
    assert.equal(review.validation.valid, false);
    assert(review.validation.diagnostics.some((item) => item.code === 'STUDIO_LOCAL_WIDGET_IDS'));
  } finally {
    db.close();
  }
});
