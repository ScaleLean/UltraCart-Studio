import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/main/database';
import { StudioServices, workspaceId } from '../src/main/services';
import { LandingService } from '../src/main/landing';
import { WidgetIdsService } from '../src/main/widget-ids';
import { sampleWorkspace } from '../src/shared/sample';
import { parsePageDocument, type CjsonNode } from '../src/shared/page-builder';
import {
  parseLandingTemplates,
  safeLandingHref,
  type LandingBrief,
  type LandingProject,
} from '../src/shared/landing';

const brief: LandingBrief = {
  title: 'The everyday collection',
  path: '/everyday-collection/',
  audience: 'Customers building a simple daily routine.',
  offer: 'A collection of everyday essentials, sold individually.',
  goal: 'Explore the collection and choose a product.',
  brandConstraints: 'Use direct language. Do not invent discounts or customer reviews.',
};
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'studio-landing-test-'));
  const store = new Store(directory);
  const services = new StudioServices(store, () => {}, join(directory, 'missing-runtime'));
  let remoteCalls = 0;
  services.connection.run = async () => {
    remoteCalls++;
    throw new Error('Landing tests must never access the merchant API.');
  };
  const landing = new LandingService(services);
  return {
    directory,
    store,
    services,
    landing,
    remoteCalls: () => remoteCalls,
    cleanup: async () => {
      store.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
const target = (project: LandingProject) => ({
  workspaceId: project.workspaceId,
  id: project.id,
  revision: project.revision,
});

const templateResponse = {
  action: 'sf.pages.templates',
  storefrontOid: 101,
  themeOid: 202,
  templates: [
    { name: 'landing.vm', page_type: 'group', metadata_available: true, visual_builder: true, system: false },
    { name: 'item.vm', page_type: 'item', metadata_available: true, visual_builder: true, system: false },
    {
      name: 'checkout.vm',
      page_type: 'system',
      metadata_available: true,
      visual_builder: true,
      system: true,
    },
    {
      name: 'unknown.vm',
      page_type: 'group',
      metadata_available: false,
      visual_builder: true,
      system: false,
    },
    {
      name: 'classic.vm',
      page_type: 'group',
      metadata_available: true,
      visual_builder: false,
      system: false,
    },
  ],
};
const validReport = { valid: true, errors: 0, warnings: 0, diagnostics: [] };
async function preparationFixture() {
  const f = await fixture();
  const pages = f.services.pages();
  const selection = {
    ...sampleWorkspace.selection,
    profileId: 'test-profile',
    merchantId: 'TEST',
    storefront: { id: 101, host: 'shop.example', themeId: 202 },
  };
  const workspace = { id: workspaceId(selection), kind: 'live' as const, label: 'Test shop', selection };
  f.store.set('workspace', workspace);
  f.store.set(`pages:${workspace.id}`, pages);
  const calls: string[][] = [];
  f.services.connection.verify = async () => selection.storefront;
  f.services.connection.pages = async () => {
    calls.push(['pages']);
    return pages;
  };
  f.services.connection.page = async (_selection, path) => {
    calls.push(['page', path]);
    const page = pages.find((item) => item.path === path);
    if (!page) throw new Error('No synthetic page');
    return page;
  };
  f.services.connection.run = async (args) => {
    calls.push(args);
    if (args.includes('templates')) return JSON.stringify(templateResponse);
    assert(args.includes('--dry-run'));
    assert(!args.includes('--allow-invalid'));
    const document = JSON.parse(await readFile(args[args.indexOf('apply') + 1], 'utf8'));
    const plan = JSON.parse(await readFile(args[args.indexOf('--plan') + 1], 'utf8'));
    assert.equal(plan.formatVersion, 1);
    const all = [document, ...nodes(document.childWidgets)];
    assert.equal(plan.operations.length, all.filter((item) => Object.keys(item.config).length).length);
    for (const operation of plan.operations) {
      const node = all.find((item) => `#${item.id}` === operation.target)!;
      assert.equal(operation.op, 'update');
      assert.deepEqual(Object.values(operation.set), Object.values(node.config));
    }
    return JSON.stringify({
      action: 'apply',
      dryRun: true,
      written: false,
      validation: validReport,
      document,
    });
  };
  const project = f.landing.create({ workspaceId: workspace.id, brief });
  return { ...f, workspace, selection, project, calls };
}
function nodes(sections: CjsonNode[]) {
  const result: CjsonNode[] = [];
  const visit = (node: CjsonNode) => {
    result.push(node);
    node.childWidgets.forEach(visit);
  };
  sections.forEach(visit);
  return result;
}

test('landing preparation verifies catalog, native authored values, and both template roles without live writes', async () => {
  const f = await preparationFixture();
  try {
    const first = await f.landing.prepare(target(f.project));
    assert.equal(first.parent?.path, '/');
    assert.equal(first.pathAvailable, true);
    assert.equal(first.validation.status, 'passed');
    assert.equal(first.validation.authoredKeys, true);
    assert.equal(first.nativeIds.status, 'local');
    assert(first.blockers.some((message) => message.includes('group template')));
    const selected = await f.landing.prepare({
      ...target(f.project),
      groupTemplate: 'landing.vm',
      itemTemplate: 'item.vm',
    });
    assert.equal(selected.groupTemplate, 'landing.vm');
    assert.equal(selected.itemTemplate, 'item.vm');
    assert.equal(selected.liveVerified, false);
    assert.equal(selected.blockers.length, 1);
    assert(f.calls.some((call) => call[0] === 'page' && call[1] === '/'));
    assert(
      !f.calls.some(
        (call) =>
          call.includes('push') || call.includes('create') || call.includes('ids') || call.includes('--live')
      )
    );
    const exported = JSON.parse(f.landing.prepareExport(target(f.project)).content);
    assert.equal(exported.manifest.parentPath, '/');
    assert.equal(exported.manifest.groupTemplate, 'landing.vm');
    assert.equal(exported.manifest.itemTemplate, 'item.vm');
    assert.equal(exported.manifest.destination, `${brief.path}body.cjson`);
    assert.equal(exported.manifest.published, false);
    assert(exported.manifest.remainingSteps.some((step: string) => step.includes('not been verified')));
    const changed = f.landing.update({ ...target(f.project), brief: { ...brief, title: 'New revision' } });
    assert.equal(f.landing.preparation({ id: f.project.id })?.stale, true);
    assert.throws(() => f.landing.prepareExport(target(changed)), /current revision/);
  } finally {
    await f.cleanup();
  }
});

test('landing template choices reject wrong storefronts, roles, system templates, and unknown capabilities', async () => {
  const f = await preparationFixture();
  try {
    assert.throws(() => parseLandingTemplates(templateResponse, 999, 202));
    assert.throws(() => parseLandingTemplates(templateResponse, 101, 999));
    assert.throws(
      () =>
        parseLandingTemplates(
          { ...templateResponse, templates: [...templateResponse.templates, templateResponse.templates[0]] },
          101,
          202
        ),
      /duplicate/
    );
    for (const groupTemplate of [
      'item.vm',
      'checkout.vm',
      'unknown.vm',
      'classic.vm',
      'missing.vm',
      '../landing.vm',
    ])
      await assert.rejects(
        f.landing.prepare({ ...target(f.project), groupTemplate, itemTemplate: 'item.vm' })
      );
    await assert.rejects(
      f.landing.prepare({ ...target(f.project), groupTemplate: 'landing.vm', itemTemplate: 'landing.vm' }),
      /item template/
    );
    await assert.rejects(
      f.landing.prepare({
        ...target(f.project),
        groupTemplate: 'landing.vm',
        itemTemplate: 'item.vm',
        path: '/other/',
      })
    );
    assert.equal(f.landing.preparation({ id: f.project.id }), null);
  } finally {
    await f.cleanup();
  }
});

test('landing preparation discards async results after workspace or draft revision changes', async () => {
  const f = await preparationFixture();
  try {
    const pages = f.services.pages();
    f.services.connection.pages = async () => {
      f.store.set('workspace', sampleWorkspace);
      return pages;
    };
    await assert.rejects(f.landing.prepare(target(f.project)), /active storefront changed/);
    assert.equal(f.store.get(`landing-preparation:${f.project.id}`, null), null);
    f.store.set('workspace', f.workspace);
    f.services.connection.pages = async () => {
      f.landing.update({ ...target(f.project), brief: { ...brief, title: 'Changed while reading' } });
      return pages;
    };
    await assert.rejects(f.landing.prepare(target(f.project)), /changed in another window/);
    assert.equal(f.store.get(`landing-preparation:${f.project.id}`, null), null);
  } finally {
    await f.cleanup();
  }
});

test('landing validation refuses failed authored settings and silent toolkit coercion', async () => {
  const f = await preparationFixture();
  try {
    const run = f.services.connection.run;
    f.services.connection.run = async (args, options) => {
      const raw = JSON.parse(await run(args, options));
      if (raw.action === 'apply')
        return JSON.stringify({
          valid: false,
          errors: 1,
          warnings: 0,
          diagnostics: [
            { severity: 'error', code: 'authored_config', path: '/0', message: 'Unsupported authored value' },
          ],
        });
      return JSON.stringify(raw);
    };
    const failed = await f.landing.prepare({
      ...target(f.project),
      groupTemplate: 'landing.vm',
      itemTemplate: 'item.vm',
    });
    assert.equal(failed.validation.status, 'failed');
    await assert.rejects(
      f.landing.reserveNativeIds({ ...target(f.project), confirmedHost: f.selection.storefront.host }),
      /local validation/
    );
    f.services.connection.run = async (args, options) => {
      const raw = JSON.parse(await run(args, options));
      if (raw.action === 'apply') raw.document.config.injected = 'silently changed';
      return JSON.stringify(raw);
    };
    const coerced = await f.landing.prepare({
      ...target(f.project),
      groupTemplate: 'landing.vm',
      itemTemplate: 'item.vm',
    });
    assert.equal(coerced.validation.status, 'unavailable');
    assert.match(coerced.validation.message, /changed the authored values/);
  } finally {
    await f.cleanup();
  }
});

test('landing native reservations require host confirmation and preserve the editable draft separately', async () => {
  const f = await preparationFixture();
  try {
    let allocations = 0;
    const ids = new WidgetIdsService(f.services, {
      schemaFor: async () => ({ properties: {} }),
      transport: {
        verify: async () => f.selection.storefront,
        reserve: async (_selection, count) => {
          allocations++;
          return { ids: Array.from({ length: count }, (_, index) => 1000 + index), count };
        },
      },
    });
    const landing = new LandingService(f.services, ids);
    await landing.prepare({ ...target(f.project), groupTemplate: 'landing.vm', itemTemplate: 'item.vm' });
    await assert.rejects(
      landing.reserveNativeIds({ ...target(f.project), confirmedHost: 'other.example' }),
      /exact storefront host/
    );
    assert.equal(allocations, 0);
    const prepared = await landing.reserveNativeIds({
      ...target(f.project),
      confirmedHost: f.selection.storefront.host,
    });
    assert.equal(allocations, 1);
    assert.equal(prepared.nativeIds.status, 'reserved');
    assert.equal(prepared.validation.status, 'passed');
    assert.equal(prepared.blockers.length, 0);
    assert.notEqual(prepared.sourceHash, prepared.contentHash);
    assert.deepEqual(landing.read(f.project.id).sections, f.project.sections);
    const exported = JSON.parse(landing.prepareExport(target(f.project)).content);
    assert.equal(exported.manifest.published, false);
    assert.equal(exported.nativeIdReceipt.status, 'complete');
    assert.equal(exported.nativeIdReceipt.preparedContent, undefined);
    const body = parsePageDocument(exported.files[0].content);
    assert([body, ...nodes(body.childWidgets)].every((node) => !node.id.startsWith('studio-local-')));
    await landing.reserveNativeIds({ ...target(f.project), confirmedHost: f.selection.storefront.host });
    assert.equal(allocations, 1);
    const refreshed = await landing.prepare(target(f.project));
    assert.equal(refreshed.contentHash, prepared.contentHash);
    assert.equal(refreshed.nativeIds.status, 'reserved');
  } finally {
    await f.cleanup();
  }
});

test('landing brief creates a local native draft and exports a scoped package without remote access', async () => {
  const f = await fixture();
  try {
    const project = f.landing.create({ workspaceId: 'sample', brief });
    assert.equal(project.revision, 1);
    assert.equal(project.origin, 'starter');
    assert.equal(project.sections.length, 4);
    assert.equal(project.selection.merchantId, 'SAMPLE');
    assert(project.sections.every((section) => section.type === 'section'));
    assert(
      nodes(project.sections).some(
        (node) => node.type === 'text' && String(node.config.html).includes(brief.offer)
      )
    );
    assert.equal(f.landing.list()[0].id, project.id);
    const exported = f.landing.export(target(project));
    const bundle = JSON.parse(exported.content);
    assert.equal(bundle.manifest.liveVerified, false);
    assert.equal(bundle.manifest.status, 'local-draft');
    assert.equal(bundle.manifest.path, brief.path);
    assert.equal(bundle.files[0].path, 'body.cjson');
    const body = parsePageDocument(bundle.files[0].content);
    assert.equal(body.id, project.rootId);
    assert(nodes(body.childWidgets).every((node) => node.containerId === project.rootId));
    assert.equal(body.childWidgets[0].parentWidgetId, project.rootId);
    assert.equal(f.remoteCalls(), 0);
  } finally {
    await f.cleanup();
  }
});

test('landing draft and history survive closing and reopening the database', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'studio-landing-reopen-'));
  let store = new Store(directory);
  try {
    let landing = new LandingService(new StudioServices(store, () => {}, directory));
    const project = landing.create({ workspaceId: 'sample', brief });
    const changed = landing.update({ ...target(project), brief: { ...brief, title: 'A saved campaign' } });
    store.close();
    store = new Store(directory);
    landing = new LandingService(new StudioServices(store, () => {}, directory));
    assert.equal(landing.read(project.id).brief.title, 'A saved campaign');
    assert.equal(landing.read(project.id).revision, changed.revision);
    assert.deepEqual(
      landing.history(project.id).map((item) => item.revision),
      [2, 1]
    );
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('landing paths reject traversal, existing catalog pages, and duplicate local projects', async () => {
  const f = await fixture();
  try {
    for (const path of [
      '/../launch/',
      '//other/',
      '/launch/?x=1',
      '/launch/#top',
      '/%2e%2e/',
      '/launch',
      'https://other.example/launch/',
    ])
      assert.throws(() => f.landing.create({ workspaceId: 'sample', brief: { ...brief, path } }));
    assert.throws(
      () => f.landing.create({ workspaceId: 'sample', brief: { ...brief, path: '/shop/' } }),
      /already exists/
    );
    f.landing.create({ workspaceId: 'sample', brief });
    assert.throws(
      () => f.landing.create({ workspaceId: 'sample', brief: { ...brief, path: '/EVERYDAY-COLLECTION/' } }),
      /already uses/
    );
    const nested = f.landing.create({
      workspaceId: 'sample',
      brief: { ...brief, path: '/new-parent/campaign/' },
    });
    assert.equal(f.landing.readiness(nested.id).parentExists, false);
    assert.equal(f.landing.readiness(nested.id).parentPath, '/new-parent/');
    assert.equal(f.remoteCalls(), 0);
  } finally {
    await f.cleanup();
  }
});

test('landing field edits use revision checks, keep other fields, and restore as a new version', async () => {
  const f = await fixture();
  try {
    const first = f.landing.create({ workspaceId: 'sample', brief });
    const heading = nodes(first.sections).find(
      (node) => node.type === 'text' && String(node.config.html).startsWith('<h1>')
    )!;
    const edited = f.landing.patchFields({
      ...target(first),
      edits: [{ nodeId: heading.id, key: 'text', value: 'A clearer <everyday>' }],
    });
    const saved = nodes(edited.sections).find((node) => node.id === heading.id)!;
    assert.equal(saved.config.html, '<h1>A clearer &lt;everyday&gt;</h1>');
    assert.deepEqual(edited.sections[1], first.sections[1]);
    assert.throws(() => f.landing.update({ ...target(first), brief }), /changed in another window/);
    const restored = f.landing.restore({ ...target(edited), restoreRevision: 1 });
    assert.equal(restored.revision, 3);
    assert.deepEqual(restored.sections, first.sections);
    assert.deepEqual(
      f.landing.history(first.id).map((item) => item.revision),
      [3, 2, 1]
    );
  } finally {
    await f.cleanup();
  }
});

test('landing projects cannot be read, exported, or changed from another merchant workspace', async () => {
  const f = await fixture();
  try {
    const project = f.landing.create({ workspaceId: 'sample', brief });
    const selection = {
      ...sampleWorkspace.selection,
      profileId: 'other-profile',
      merchantId: 'OTHER',
      storefront: { ...sampleWorkspace.selection.storefront, id: 123, host: 'other.example' },
    };
    f.store.set('workspace', { id: workspaceId(selection), kind: 'live', label: 'Other', selection });
    assert.equal(f.landing.list().length, 0);
    assert.throws(() => f.landing.read(project.id), /not found in this storefront/);
    assert.throws(() => f.landing.history(project.id), /not found in this storefront/);
    assert.throws(() => f.landing.update({ ...target(project), brief }), /active storefront changed/);
    assert.throws(() => f.landing.export(target(project)), /active storefront changed/);
    assert.throws(() => f.landing.create({ workspaceId: 'sample', brief }), /active storefront changed/);
    assert.equal(f.remoteCalls(), 0);
  } finally {
    await f.cleanup();
  }
});

test('landing section operations preserve native structure and create unique placeholder IDs', async () => {
  const f = await fixture();
  try {
    const first = f.landing.create({ workspaceId: 'sample', brief });
    const added = f.landing.operate({
      ...target(first),
      operation: {
        kind: 'add',
        pattern: 'cta',
        parentId: first.rootId,
        options: { title: 'One more step', href: '/shop/' },
      },
    });
    assert.equal(added.sections.length, 5);
    const duplicated = f.landing.operate({
      ...target(added),
      operation: { kind: 'duplicate', nodeId: added.sections[0].id },
    });
    const allIds = nodes(duplicated.sections).map((node) => node.id);
    assert.equal(new Set(allIds).size, allIds.length);
    const moved = f.landing.operate({
      ...target(duplicated),
      operation: { kind: 'move', nodeId: duplicated.sections[1].id, direction: 'down' },
    });
    assert.equal(moved.sections[2].id, duplicated.sections[1].id);
    const removed = f.landing.operate({
      ...target(moved),
      operation: { kind: 'remove', nodeId: moved.sections[2].id },
    });
    assert.equal(removed.sections.length, 5);
    assert.equal(f.remoteCalls(), 0);
  } finally {
    await f.cleanup();
  }
});

test('queued landing work cannot save after the active storefront changes', async () => {
  const f = await fixture();
  try {
    const project = f.landing.create({ workspaceId: 'sample', brief });
    const queuedSave = Promise.resolve().then(() =>
      f.landing.update({ ...target(project), brief: { ...brief, title: 'Queued change' } })
    );
    const selection = {
      ...sampleWorkspace.selection,
      profileId: 'other-profile',
      merchantId: 'OTHER',
      storefront: { ...sampleWorkspace.selection.storefront, id: 123, host: 'other.example' },
    };
    f.store.set('workspace', { id: workspaceId(selection), kind: 'live', label: 'Other', selection });
    await assert.rejects(queuedSave, /active storefront changed/);
    f.store.set('workspace', sampleWorkspace);
    assert.equal(f.landing.read(project.id).brief.title, brief.title);
    assert.equal(f.landing.history(project.id).length, 1);
  } finally {
    await f.cleanup();
  }
});

test('landing edits reject executable HTML, unsafe URLs, merchant IDs, and partial invalid batches', async () => {
  const f = await fixture();
  try {
    const first = f.landing.create({ workspaceId: 'sample', brief });
    const text = nodes(first.sections).find((node) => node.type === 'text')!;
    const button = nodes(first.sections).find((node) => node.type === 'button')!;
    assert.throws(
      () =>
        f.landing.patchFields({
          ...target(first),
          edits: [{ nodeId: text.id, key: 'html', value: '<img src=x onerror=alert(1)>' }],
        }),
      /simple headings/
    );
    for (const destination of [
      '/\\evil.example/',
      '//evil.example/',
      '/%2f%2fevil.example/',
      '/%255cevil.example/',
      '/%0aevil',
      'java%73cript%3Aalert(1)',
      'https://example.test/%250a',
    ]) {
      assert.throws(() =>
        f.landing.patchFields({
          ...target(first),
          edits: [{ nodeId: button.id, key: 'buttonUrlAction', value: destination }],
        })
      );
    }
    assert.equal(
      safeLandingHref('/shop/?campaign=spring%20collection'),
      '/shop/?campaign=spring%20collection'
    );
    assert.throws(
      () =>
        f.landing.patchFields({
          ...target(first),
          edits: [{ nodeId: text.id, key: 'html', value: '<script' }],
        }),
      /simple headings/
    );
    const unknown = structuredClone(first.sections);
    unknown[0].template = 'header.vm';
    assert.throws(
      () => f.landing.update({ ...target(first), sections: unknown }),
      /Unsupported widget property/
    );
    assert.throws(() => f.landing.update({ ...target(first), slot: 'header', sections: first.sections }));
    assert.throws(
      () =>
        f.landing.patchFields({
          ...target(first),
          edits: [{ nodeId: button.id, key: 'buttonUrlAction', value: 'javascript:alert(1)' }],
        }),
      /HTTPS URL/
    );
    assert.throws(
      () =>
        f.landing.patchFields({
          ...target(first),
          edits: [
            { nodeId: text.id, key: 'text', value: 'Changed' },
            { nodeId: 'missing', key: 'text', value: 'Bad field' },
          ],
        }),
      /no longer/
    );
    const sections = structuredClone(first.sections);
    sections[0].id = 'section-12345';
    assert.throws(() => f.landing.update({ ...target(first), sections }), /studio-local ID/);
    assert.deepEqual(f.landing.read(first.id), first);
    assert.equal(f.landing.history(first.id).length, 1);
  } finally {
    await f.cleanup();
  }
});

test('archiving preserves history and releases the local path without deleting merchant content', async () => {
  const f = await fixture();
  try {
    const first = f.landing.create({ workspaceId: 'sample', brief });
    const archived = f.landing.archive(target(first));
    assert(archived.archivedAt);
    assert.equal(f.landing.list().length, 0);
    assert.equal(f.landing.history(first.id).length, 2);
    assert.throws(() => f.landing.export(target(archived)), /archived/);
    assert.throws(() => f.landing.update({ ...target(archived), brief }), /archived/);
    assert.throws(
      () =>
        f.landing.operate({
          ...target(archived),
          operation: { kind: 'remove', nodeId: first.sections[0].id },
        }),
      /archived/
    );
    assert.throws(
      () =>
        f.landing.patchFields({
          ...target(archived),
          edits: [{ nodeId: first.sections[0].id, key: 'title', value: 'Changed' }],
        }),
      /archived/
    );
    const replacement = f.landing.create({ workspaceId: 'sample', brief });
    assert.notEqual(replacement.id, first.id);
    assert.throws(() => f.landing.restore({ ...target(archived), restoreRevision: 1 }), /already uses/);
    f.landing.archive(target(replacement));
    const restored = f.landing.restore({ ...target(archived), restoreRevision: 1 });
    assert.equal(restored.archivedAt, null);
    assert.equal(restored.revision, 3);
    assert.equal(f.landing.list()[0].id, first.id);
    assert.equal(f.remoteCalls(), 0);
  } finally {
    await f.cleanup();
  }
});
