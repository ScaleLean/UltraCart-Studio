import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  fauxProvider,
  fauxAssistantMessage,
  fauxToolCall,
  getCurrentTools,
  validateToolArguments,
  Type,
} from '@earendil-works/pi-ai';
import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { createRegistry, defineExtension, defineTool, Harness } from '@earendil-works/pi-durable';
import { openNodeSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/node';
import { Store } from '../src/main/database';
import { StudioServices, workspaceId } from '../src/main/services';
import { LandingService } from '../src/main/landing';
import { PageBuilderService } from '../src/main/page-builder';
import { WarehouseService } from '../src/main/warehouse';
import { WAREHOUSE_MIN_BYTES } from '../src/shared/warehouse';
import { Auth, LocalCredentials } from '../src/main/auth';
import { Agents } from '../src/main/agent';
import { featureTools, type AgentFeatures } from '../src/main/feature-tools';
import { sampleWorkspace } from '../src/shared/sample';
import type { CjsonNode } from '../src/shared/page-builder';
import type { ConversationView, Session, Workspace } from '../src/shared/types';

const brief = {
  title: 'A considered everyday',
  path: '/a-considered-everyday/',
  audience: 'Customers who want a simpler daily routine.',
  offer: 'A collection of everyday essentials.',
  goal: 'Explore the collection.',
  brandConstraints: 'Use only verified facts.',
};
const otherSelection = {
  ...sampleWorkspace.selection,
  profileId: 'other',
  merchantId: 'OTHER',
  storefront: { id: 7, host: 'other.example', themeId: 1 },
};
const otherWorkspace: Workspace = {
  id: workspaceId(otherSelection),
  kind: 'live',
  label: 'Other',
  selection: otherSelection,
};

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'studio-feature-tools-'));
  const store = new Store(directory);
  const services = new StudioServices(store, () => {}, join(directory, 'missing-runtime'));
  let remoteCalls = 0;
  services.connection.run = async () => {
    remoteCalls++;
    throw new Error('Unexpected merchant request in a feature test.');
  };
  const features: AgentFeatures = {
    landing: new LandingService(services),
    builder: new PageBuilderService(services),
    warehouse: new WarehouseService(services, {
      exists: () => false,
      run: async () => {
        remoteCalls++;
        throw new Error('Unexpected warehouse execution in an agent test.');
      },
    }),
  };
  const auth = new Auth(
    new LocalCredentials({}, async () => {}),
    store,
    () => {},
    async () => {}
  );
  const status = auth.status.bind(auth);
  auth.status = async () => ({ ...(await status()), connected: true });
  const faux = fauxProvider({ provider: 'feature-test' });
  auth.models.setProvider(faux.provider);
  store.set('settings', { ...services.settings(), provider: 'feature-test', model: faux.getModel().id });
  let agents = new Agents(services, auth, () => {}, features);
  return {
    store,
    services,
    features,
    auth,
    faux,
    remoteCalls: () => remoteCalls,
    get agents() {
      return agents;
    },
    reopen: async () => {
      await agents.close();
      agents = new Agents(services, auth, () => {}, features);
    },
    cleanup: async () => {
      await agents.close();
      features.warehouse.dispose();
      services.connection.dispose();
      store.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
async function completed(agents: Agents, id: string, marker: string): Promise<ConversationView> {
  const until = Date.now() + 10000;
  let view: ConversationView;
  do {
    view = await agents.view(id);
    if (
      !view.busy &&
      view.messages.some((message) => message.role === 'assistant' && message.text.includes(marker))
    )
      return view;
    await new Promise((resolve) => setTimeout(resolve, 10));
  } while (Date.now() < until);
  assert.fail(`Agent did not finish: ${JSON.stringify(view)}`);
}
function allNodes(sections: CjsonNode[]) {
  const nodes: CjsonNode[] = [];
  const visit = (node: CjsonNode) => {
    nodes.push(node);
    node.childWidgets.forEach(visit);
  };
  sections.forEach(visit);
  return nodes;
}
function toolFor(f: Awaited<ReturnType<typeof fixture>>, session: Session, name: string) {
  const tool = featureTools(f.services, f.features, session).find((item) => item.name === name);
  assert(tool, `Missing tool ${name}`);
  return tool;
}
async function callFeature(
  f: Awaited<ReturnType<typeof fixture>>,
  session: Session,
  name: string,
  args: Record<string, any>
) {
  const tool = toolFor(f, session, name);
  const checked = validateToolArguments(tool, fauxToolCall(name, args));
  return (tool.execute as (args: unknown, context: unknown) => Promise<any>)(checked, {});
}

test(
  'real Pi landing session edits native fields and sections and reopens its durable transcript',
  { timeout: 15000 },
  async () => {
    const f = await fixture();
    try {
      const project = f.features.landing.create({ workspaceId: 'sample', brief });
      const heading = allNodes(project.sections).find((node) => String(node.config.html).startsWith('<h1>'))!;
      const session = await f.agents.createLanding(project.id);
      let names: string[] = [];
      f.faux.setResponses([
        (context) => {
          names = getCurrentTools(context.messages).map((tool) => tool.name);
          return fauxAssistantMessage(fauxToolCall('landing_read_project', {}), { stopReason: 'toolUse' });
        },
        fauxAssistantMessage(
          fauxToolCall('landing_save_fields', {
            revision: 1,
            edits: [{ nodeId: heading.id, key: 'text', value: 'A simpler everyday.' }],
          }),
          { stopReason: 'toolUse' }
        ),
        fauxAssistantMessage(
          fauxToolCall('landing_edit_sections', {
            revision: 2,
            operation: { kind: 'duplicate', nodeId: project.sections[0].id },
          }),
          { stopReason: 'toolUse' }
        ),
        fauxAssistantMessage(fauxToolCall('landing_check_readiness', {}), { stopReason: 'toolUse' }),
        fauxAssistantMessage('The local landing draft is saved and ready for your review.'),
      ]);
      await f.agents.submit(session.id, 'Refine this landing draft locally.', randomUUID());
      const view = await completed(f.agents, session.id, 'ready for your review');
      assert(
        view.messages.filter((message) => message.role === 'tool').every((message) => !message.error),
        JSON.stringify(view)
      );
      assert.deepEqual(names.sort(), [
        'landing_check_readiness',
        'landing_edit_sections',
        'landing_read_project',
        'landing_save_fields',
        'landing_update_brief',
      ]);
      const saved = f.features.landing.read(project.id);
      assert.equal(saved.revision, 3);
      assert.equal(saved.sections.length, 5);
      assert.equal(
        allNodes(saved.sections).find((node) => node.id === heading.id)?.config.html,
        '<h1>A simpler everyday.</h1>'
      );
      assert.deepEqual(
        f.features.landing.history(project.id).map((item) => item.revision),
        [3, 2, 1]
      );
      assert.deepEqual(f.store.session(session.id).target, { kind: 'landing', projectId: project.id });
      await f.reopen();
      assert.deepEqual((await f.agents.view(session.id)).messages, view.messages);
      assert.deepEqual(f.store.session(session.id).target, session.target);
      assert.equal(f.faux.state.callCount, 5);
      assert.equal(f.remoteCalls(), 0);
    } finally {
      await f.cleanup();
    }
  }
);

test(
  'real Pi warehouse session reads sample schemas and saves SQL without a run capability',
  { timeout: 15000 },
  async () => {
    const f = await fixture();
    try {
      const session = await f.agents.createWarehouse();
      let names: string[] = [];
      let saveBytes: any;
      f.faux.setResponses([
        (context) => {
          const tools = getCurrentTools(context.messages);
          names = tools.map((tool) => tool.name);
          saveBytes = (tools.find((tool) => tool.name === 'warehouse_save_query')?.parameters as any)?.properties
            ?.maxBytes;
          return fauxAssistantMessage(fauxToolCall('warehouse_status', {}), { stopReason: 'toolUse' });
        },
        fauxAssistantMessage(fauxToolCall('warehouse_list_tables', {}), { stopReason: 'toolUse' }),
        fauxAssistantMessage(fauxToolCall('warehouse_read_schema', { table: 'uc_orders' }), {
          stopReason: 'toolUse',
        }),
        fauxAssistantMessage(
          fauxToolCall('warehouse_save_query', {
            name: 'Orders by channel for review',
            sql: 'SELECT channel, COUNT(*) AS orders FROM ultracart_dw.uc_orders GROUP BY channel',
            rowLimit: 50,
            maxBytes: 10 * 1024 ** 2,
          }),
          { stopReason: 'toolUse' }
        ),
        fauxAssistantMessage('Saved SQL only. Use Dry run to check it before execution.'),
      ]);
      await f.agents.submit(session.id, 'Prepare a query for me to review.', randomUUID());
      const view = await completed(f.agents, session.id, 'Saved SQL only');
      assert(
        view.messages.filter((message) => message.role === 'tool').every((message) => !message.error),
        JSON.stringify(view)
      );
      assert.deepEqual(names.sort(), [
        'warehouse_list_tables',
        'warehouse_read_schema',
        'warehouse_save_query',
        'warehouse_status',
      ]);
      // The agent schema uses BigQuery's 10 MiB billing minimum, like every other byte ceiling.
      assert.equal(saveBytes?.minimum, WAREHOUSE_MIN_BYTES);
      const status = f.features.warehouse.status({ workspaceId: 'sample' });
      assert.equal(status.saved[0].name, 'Orders by channel for review');
      assert.equal(status.saved[0].rowLimit, 50);
      assert.equal(status.history.length, 0);
      assert.deepEqual(f.store.session(session.id).target, { kind: 'warehouse' });
      await f.reopen();
      assert.deepEqual((await f.agents.view(session.id)).messages, view.messages);
      assert.equal(
        f.features.warehouse.status({ workspaceId: 'sample' }).saved[0].name,
        'Orders by channel for review'
      );
      assert.equal(f.faux.state.callCount, 5);
      assert.equal(f.remoteCalls(), 0);
    } finally {
      await f.cleanup();
    }
  }
);

test(
  'real Pi rejects injected project IDs and page paths in landing tool arguments',
  { timeout: 15000 },
  async () => {
    const f = await fixture();
    try {
      const project = f.features.landing.create({ workspaceId: 'sample', brief });
      const other = f.features.landing.create({
        workspaceId: 'sample',
        brief: { ...brief, path: '/other-campaign/' },
      });
      const heading = allNodes(other.sections).find((node) => node.type === 'text')!;
      const session = await f.agents.createLanding(project.id);
      f.faux.setResponses([
        fauxAssistantMessage(
          fauxToolCall('landing_save_fields', {
            id: other.id,
            revision: 1,
            edits: [{ nodeId: heading.id, key: 'text', value: 'Wrong project' }],
          }),
          { stopReason: 'toolUse' }
        ),
        fauxAssistantMessage(
          fauxToolCall('landing_update_brief', { revision: 1, path: '/injected-path/', title: 'Injected' }),
          { stopReason: 'toolUse' }
        ),
        fauxAssistantMessage('The injected scope changes were rejected.'),
      ]);
      await f.agents.submit(session.id, 'Test the pinned project boundary.', randomUUID());
      const view = await completed(f.agents, session.id, 'scope changes were rejected');
      const calls = view.messages.filter((message) => message.role === 'tool');
      assert.equal(calls.length, 2);
      assert(
        calls.every((message) => message.error),
        JSON.stringify(calls)
      );
      assert.deepEqual(f.features.landing.read(project.id), project);
      assert.deepEqual(f.features.landing.read(other.id), other);
      assert.equal(f.remoteCalls(), 0);
    } finally {
      await f.cleanup();
    }
  }
);

test(
  'real Pi cannot call warehouse execution or storefront publishing tools',
  { timeout: 15000 },
  async () => {
    const f = await fixture();
    try {
      const session = await f.agents.createWarehouse();
      f.faux.setResponses([
        fauxAssistantMessage(
          [fauxToolCall('warehouse_run', { sql: 'SELECT 1' }), fauxToolCall('storefront_publish', {})],
          { stopReason: 'toolUse' }
        ),
        fauxAssistantMessage('Those operations are unavailable in this conversation.'),
      ]);
      await f.agents.submit(session.id, 'Test unavailable operations.', randomUUID());
      const view = await completed(f.agents, session.id, 'operations are unavailable');
      const calls = view.messages.filter((message) => message.role === 'tool');
      assert.equal(calls.length, 2);
      assert(
        calls.every((message) => message.error),
        JSON.stringify(calls)
      );
      assert.equal(f.features.warehouse.status({ workspaceId: 'sample' }).history.length, 0);
      assert.equal(f.services.changes().length, 0);
      assert.equal(f.remoteCalls(), 0);
    } finally {
      await f.cleanup();
    }
  }
);

test(
  'a model response arriving after a storefront switch cannot mutate its former landing project',
  { timeout: 15000 },
  async () => {
    const f = await fixture();
    try {
      const project = f.features.landing.create({ workspaceId: 'sample', brief });
      const heading = allNodes(project.sections).find((node) => node.type === 'text')!;
      const session = await f.agents.createLanding(project.id);
      f.faux.setResponses([
        async () => {
          await Promise.resolve();
          f.store.set('workspace', otherWorkspace);
          return fauxAssistantMessage(
            fauxToolCall('landing_save_fields', {
              revision: 1,
              edits: [{ nodeId: heading.id, key: 'text', value: 'Late edit' }],
            }),
            { stopReason: 'toolUse' }
          );
        },
        fauxAssistantMessage('The active storefront changed; the edit was not applied.'),
      ]);
      await f.agents.submit(session.id, 'Refine this draft.', randomUUID());
      const view = await completed(f.agents, session.id, 'edit was not applied');
      assert(
        view.messages.some(
          (message) =>
            message.role === 'tool' && message.error && message.text.includes('active storefront changed')
        ),
        JSON.stringify(view)
      );
      f.store.set('workspace', sampleWorkspace);
      assert.deepEqual(f.features.landing.read(project.id), project);
      assert.equal(f.features.landing.history(project.id).length, 1);
      assert.equal(f.remoteCalls(), 0);
    } finally {
      await f.cleanup();
    }
  }
);

test('archived landing projects remain readable but cannot be edited through existing agent tools', async () => {
  const f = await fixture();
  try {
    const project = f.features.landing.create({ workspaceId: 'sample', brief });
    const session = await f.agents.createLanding(project.id);
    const archived = f.features.landing.archive({ workspaceId: 'sample', id: project.id, revision: 1 });
    await assert.rejects(f.agents.createLanding(project.id), /archived/);
    const tools = featureTools(f.services, f.features, session);
    assert(tools.every((tool) => !/archive|restore|publish|export/.test(tool.name)));
    const read = await callFeature(f, session, 'landing_read_project', {});
    assert.equal(JSON.parse(read.content[0].text).archived, true);
    await assert.rejects(
      callFeature(f, session, 'landing_update_brief', { revision: archived.revision, title: 'Changed' }),
      /archived/
    );
    await assert.rejects(
      callFeature(f, session, 'landing_edit_sections', {
        revision: archived.revision,
        operation: { kind: 'remove', nodeId: project.sections[0].id },
      }),
      /archived/
    );
    assert.equal(f.features.landing.read(project.id).revision, 2);
  } finally {
    await f.cleanup();
  }
});

test('warehouse metadata arriving after a workspace switch is withheld from the conversation', async () => {
  const f = await fixture();
  try {
    const session = await f.agents.createWarehouse();
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    f.features.warehouse.tables = async () => {
      await waiting;
      return [{ name: 'uc_orders', type: 'VIEW' }];
    };
    const pending = callFeature(f, session, 'warehouse_list_tables', {});
    f.store.set('workspace', otherWorkspace);
    release();
    await assert.rejects(pending, /active storefront changed/);
    assert.equal(f.remoteCalls(), 0);
  } finally {
    await f.cleanup();
  }
});

test('feature tool declarations match service limits and reject unsupported capabilities', async () => {
  const f = await fixture();
  try {
    const warehouse = await f.agents.createWarehouse();
    const save = toolFor(f, warehouse, 'warehouse_save_query');
    assert.throws(
      () =>
        validateToolArguments(
          save,
          fauxToolCall(save.name, { name: 'Query', sql: 'SELECT 1', rowLimit: 101 })
        ),
      /Validation failed/
    );
    assert.throws(
      () => validateToolArguments(save, fauxToolCall(save.name, { name: 'x'.repeat(81), sql: 'SELECT 1' })),
      /Validation failed/
    );
    assert.throws(
      () =>
        validateToolArguments(
          save,
          fauxToolCall(save.name, { name: 'Query', sql: 'SELECT 1', remove: true })
        ),
      /Validation failed/
    );
    assert.equal(featureTools(f.services, undefined, warehouse).length, 0);
    const unavailable = new Agents(f.services, f.auth, () => {});
    await assert.rejects(unavailable.createWarehouse(), /unavailable/);
    await assert.rejects(unavailable.createLanding(randomUUID()), /unavailable/);
    await unavailable.close();
  } finally {
    await f.cleanup();
  }
});

test(
  'core draft tools cannot redirect a page conversation with injected scope properties',
  { timeout: 15000 },
  async () => {
    const f = await fixture();
    try {
      const homeScope = f.services.scope('/');
      const shopScope = f.services.scope('/shop/');
      const home = await f.services.pull(homeScope);
      const shop = await f.services.pull(shopScope);
      const session = await f.agents.create('/');
      f.faux.setResponses([
        fauxAssistantMessage(
          fauxToolCall('storefront_save_draft', {
            id: shop.id,
            revision: shop.revision,
            edits: [{ pointer: shop.fields[0].pointer, value: 'Redirected shop edit' }],
            path: '/shop/',
            selection: shopScope.selection,
            slot: 'body',
          }),
          { stopReason: 'toolUse' }
        ),
        fauxAssistantMessage(
          fauxToolCall('storefront_save_draft', {
            id: home.id,
            revision: home.revision,
            edits: [{ pointer: home.fields[0].pointer, value: 'Pinned homepage edit' }],
            path: '/shop/',
            selection: otherSelection,
            slot: 'header',
          }),
          { stopReason: 'toolUse' }
        ),
        fauxAssistantMessage('Only the pinned homepage can receive this edit.'),
      ]);
      await f.agents.submit(session.id, 'Check that the page target stays pinned.', randomUUID());
      const view = await completed(f.agents, session.id, 'pinned homepage can receive');
      const calls = view.messages.filter((message) => message.role === 'tool');
      assert.equal(calls.length, 2);
      assert.equal(calls[0].error, true, 'A draft ID from a different page must fail.');
      assert.equal(
        calls[1].error,
        false,
        'Unknown scope properties must not redirect the legitimate pinned edit.'
      );
      assert.deepEqual(f.services.sampleDrafts.read(shopScope), shop);
      const saved = f.services.sampleDrafts.read(homeScope)!;
      assert.equal(saved.revision, home.revision + 1);
      assert.equal(saved.fields[0].value, 'Pinned homepage edit');
      assert(
        f.services
          .changes()
          .every((change) => change.scope.slot === 'body' && change.scope.selection.merchantId === 'SAMPLE')
      );
      assert.equal(f.remoteCalls(), 0);
    } finally {
      await f.cleanup();
    }
  }
);

test(
  'opening a persisted legacy conversation refreshes instructions and native tools without replaying work',
  { timeout: 15000 },
  async () => {
    const f = await fixture();
    try {
      await f.services.pull(f.services.scope('/'));
      const session = await f.agents.create('/');
      const directory = join(f.store.directory, 'conversations');
      await mkdir(directory, { recursive: true });
      const registry = createRegistry();
      registry.install(
        defineExtension({
          name: 'ultracart',
          tools: [
            defineTool({
              name: 'storefront_read_draft',
              description: 'Legacy text-only draft reader.',
              parameters: Type.Object({}),
              replay: 'safe',
              execute: async () => ({ content: [{ type: 'text' as const, text: '{}' }] }),
            }),
          ],
        })
      );
      const legacy = await Harness.open(
        await openNodeSqliteStorage(join(directory, `${session.id}.sqlite`)),
        { models: f.auth.models, registry },
        BACKGROUND_CONTEXT
      );
      try {
        const conversation = await legacy.root(BACKGROUND_CONTEXT, {
          agent: {
            model: { provider: 'feature-test', modelId: f.faux.getModel().id },
            instructions: 'LEGACY_TEXT_ONLY_RULE: structural page editing is unavailable.',
          },
        });
        f.faux.setResponses([fauxAssistantMessage('Earlier conversation history is preserved.')]);
        const submission = await conversation.submit(
          { type: 'input', content: 'An earlier request.', requestId: randomUUID() },
          BACKGROUND_CONTEXT
        );
        assert.equal((await submission.wait(BACKGROUND_CONTEXT)).status, 'done');
        assert.equal((await conversation.agent(BACKGROUND_CONTEXT)).tools.length, 1);
      } finally {
        await legacy.close(BACKGROUND_CONTEXT);
      }

      const opened = await f.agents.view(session.id);
      assert(
        opened.messages.some((message) => message.text.includes('Earlier conversation history is preserved.'))
      );
      assert.equal(f.faux.state.callCount, 1, 'Reading old history must not start model work.');
      let instructions = '';
      let names: string[] = [];
      f.faux.setResponses([
        (context) => {
          names = getCurrentTools(context.messages).map((tool) => tool.name);
          for (const message of context.messages) {
            if (message.role === 'system' && typeof message.sections?.instructions === 'string')
              instructions = message.sections.instructions;
          }
          return fauxAssistantMessage(fauxToolCall('storefront_inspect_structure', {}), {
            stopReason: 'toolUse',
          });
        },
        fauxAssistantMessage('The refreshed conversation can inspect native structure.'),
      ]);
      await f.agents.submit(session.id, 'Inspect the native page structure now.', randomUUID());
      const resumed = await completed(f.agents, session.id, 'refreshed conversation can inspect');
      assert(names.includes('storefront_inspect_structure'));
      assert(names.includes('storefront_edit_structure'));
      assert.match(instructions, /Read native selected-slot structure before/);
      assert.doesNotMatch(instructions, /LEGACY_TEXT_ONLY_RULE/);
      assert(
        resumed.messages.some((message) => message.tool === 'storefront_inspect_structure' && !message.error)
      );
      assert(
        resumed.messages.some((message) =>
          message.text.includes('Earlier conversation history is preserved.')
        )
      );
      assert.equal(f.faux.state.callCount, 3);
      assert.equal(f.remoteCalls(), 0);
    } finally {
      await f.cleanup();
    }
  }
);
