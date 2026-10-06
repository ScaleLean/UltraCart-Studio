import { z } from 'zod';
import { version } from '../../package.json';
import { Store } from './database';
import { StudioServices } from './services';
import { ConnectionService } from './domain/connection-service';
import { Auth, LocalCredentials } from './auth';
import { Agents } from './agent';
import { PageBuilderService } from './page-builder';
import { LandingService } from './landing';
import { WarehouseService } from './warehouse';
import { ToolkitSkillsService } from './toolkit-skills';
import { draftScopeSchema } from '../shared/drafts';
import type { StudioEvent } from '../shared/types';

const port = (process as any).parentPort;
if (!port) throw new Error('Studio worker requires a parent process.');
let services: StudioServices;
let agents: Agents;
let auth: Auth;
let builder: PageBuilderService;
let landing: LandingService;
let warehouse: WarehouseService;
let toolkitSkills: ToolkitSkillsService;
let sequence = 0;
const pending = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>();
const emit = (event: StudioEvent) => port.postMessage({ event });
function host(method: string, params: unknown): Promise<any> {
  const id = `host-${++sequence}`;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    port.postMessage({ host: true, id, method, params });
  });
}
ConnectionService.childObserver = (pid, state) => port.postMessage({ child: { pid, state } });
const pathSchema = z.object({ path: z.string().min(1).max(2048), slot: draftScopeSchema.shape.slot });
const inputScope = (input: unknown) => {
  const v = pathSchema.parse(input);
  return services.scope(v.path, v.slot);
};
const draftSchema = pathSchema.extend({ id: z.string().uuid(), revision: z.number().int().positive() });
const sessionSchema = z.object({ id: z.string().uuid() });
function sessionId(input: unknown) {
  const { id } = sessionSchema.parse(input);
  if (services.store.session(id).workspaceId !== services.workspace().id)
    throw new Error('Switch to this conversation’s storefront first.');
  return id;
}
async function dispatch(method: string, input: any) {
  switch (method) {
    case 'init': {
      const store = new Store(input.directory);
      services = new StudioServices(store, () => emit({ type: 'changed' }), input.root);
      builder = new PageBuilderService(services);
      landing = new LandingService(services);
      warehouse = new WarehouseService(services);
      toolkitSkills = new ToolkitSkillsService(services);
      auth = new Auth(
        new LocalCredentials(input.credentials, (values) => host('credentials.save', values)),
        store,
        (status) => {
          emit({ type: 'auth', status });
          if (status.connected && status.phase === 'connected') void agents?.recover();
        },
        (url) => host('auth.open', { url })
      );
      agents = new Agents(services, auth, (id, view) => emit({ type: 'conversation', id, view }), {
        builder,
        landing,
        warehouse,
      });
      void agents.recover();
      return { ready: true };
    }
    case 'bootstrap':
      return {
        workspace: services.workspace(),
        settings: services.settings(),
        pages: services.pages(),
        sessions: services.store.sessions(services.workspace().id),
        changes: services.changes(),
        activity: services.store.activity(services.workspace().id),
        auth: await auth.status(),
        version,
      };
    case 'settings.save': {
      if ((await auth.status()).phase === 'waiting' && input.provider !== auth.provider())
        throw new Error('Finish or cancel sign-in before changing the connection.');
      const settings = services.saveSettings(input);
      emit({ type: 'auth', status: await auth.status() });
      return settings;
    }
    // Host-only methods: main calls these after a native file dialog. They are not in the public allowlist.
    case 'settings.current':
      return services.settings();
    case 'settings.setPath': {
      const v = z
        .object({ kind: z.enum(['nodePath', 'cliPath']), path: z.string() })
        .strict()
        .parse(input);
      return services.savePath(v.kind, v.path);
    }
    case 'workspace.refresh':
      return services.refresh();
    case 'workspace.sample':
      return services.useSample();
    case 'workspace.connect':
      return services.connect(input);
    case 'connection.inspect':
      return services.connection.inspect();
    case 'connection.storefronts':
      return services.connection.storefronts(z.object({ profile: z.string() }).parse(input).profile);
    case 'connection.begin':
      return services.connection.begin(z.object({ profile: z.string() }).parse(input).profile);
    case 'connection.poll':
      return services.connection.loginStatus(z.object({ id: z.string() }).parse(input).id);
    case 'connection.cancel':
      return services.connection.cancel(z.object({ id: z.string() }).parse(input).id);
    case 'page.inspect':
      return services.detail(inputScope(input));
    case 'page.contentMap':
      return services.contentMap(inputScope(input));
    case 'draft.nativeIdsPlan': {
      const v = draftSchema.parse(input);
      return services.nativeIdsPlan(services.scope(v.path, v.slot), v.id, v.revision);
    }
    case 'draft.reserveNativeIds': {
      const v = draftSchema.extend({ confirmedHost: z.string().max(253) }).parse(input);
      return services.reserveNativeIds(services.scope(v.path, v.slot), v.id, v.revision, v.confirmedHost);
    }
    case 'builder.inspect':
      return builder.inspect(inputScope(input));
    case 'builder.apply': {
      const scope = inputScope(input);
      const { id, revision, operation } = input;
      return builder.apply({ ...scope, id, revision, operation });
    }
    case 'landing.preparation':
      return landing.preparation(input);
    case 'landing.prepare':
      return landing.prepare(input);
    case 'landing.reserveNativeIds':
      return landing.reserveNativeIds(input);
    case 'landing.prepareExport':
      return landing.prepareExport(input);
    case 'landing.list':
      return landing.list();
    case 'landing.read':
      return landing.read(sessionSchema.parse(input).id);
    case 'landing.readiness':
      return landing.readiness(sessionSchema.parse(input).id);
    case 'landing.create':
      return landing.create(input);
    case 'landing.update':
      return landing.update(input);
    case 'landing.patchFields':
      return landing.patchFields(input);
    case 'landing.operate':
      return landing.operate(input);
    case 'landing.history':
      return landing.history(sessionSchema.parse(input).id);
    case 'landing.restore':
      return landing.restore(input);
    case 'landing.archive':
      return landing.archive(input);
    case 'landing.export':
      return landing.export(input);
    case 'warehouse.diagnose':
      return warehouse.diagnose(input);
    case 'toolkit.skills.list':
      return toolkitSkills.list(input);
    case 'toolkit.skills.read':
      return toolkitSkills.read(input);
    case 'warehouse.status':
      return warehouse.status(input);
    case 'warehouse.configure':
      return warehouse.configure(input);
    case 'warehouse.tables':
      return warehouse.tables(input);
    case 'warehouse.schema':
      return warehouse.schema(input);
    case 'warehouse.prepare':
      return warehouse.prepare(input);
    case 'warehouse.run':
      return warehouse.run(input);
    case 'warehouse.history':
      return warehouse.history(input);
    case 'warehouse.save':
      return warehouse.save(input);
    case 'page.templates':
      return services.templates(inputScope(input));
    case 'page.source': {
      const v = pathSchema.extend({ kind: z.enum(['group', 'item']).default('group') }).parse(input);
      return services.templateSource(services.scope(v.path, v.slot), v.kind);
    }
    case 'draft.read':
      return services.drafts.read(inputScope(input));
    case 'draft.pull':
      return services.pull(inputScope(input));
    case 'draft.save': {
      const v = draftSchema
        .extend({
          edits: z.array(z.object({ pointer: z.string().max(4096), value: z.string().max(16384) })).max(100),
        })
        .parse(input);
      return services.save({
        ...services.scope(v.path, v.slot),
        id: v.id,
        revision: v.revision,
        edits: v.edits,
      });
    }
    case 'draft.review': {
      const v = draftSchema.parse(input);
      return services.review(services.scope(v.path, v.slot), v.id, v.revision);
    }
    case 'draft.history': {
      const v = pathSchema.extend({ id: z.string().uuid() }).parse(input);
      if (services.drafts.read(services.scope(v.path, v.slot))?.id !== v.id)
        throw new Error('Draft scope mismatch.');
      return services.history(v.id);
    }
    case 'draft.restore': {
      const v = draftSchema.extend({ expectedRevision: z.number().int().positive() }).parse(input);
      return services.restore(services.scope(v.path, v.slot), v.id, v.revision, v.expectedRevision);
    }
    case 'draft.export': {
      const v = draftSchema.parse(input);
      return services.exportDraft(services.scope(v.path, v.slot), v.id, v.revision);
    }
    case 'draft.publish': {
      const v = draftSchema.extend({ confirmation: z.string() }).parse(input);
      return services.publish(services.scope(v.path, v.slot), v.id, v.revision, v.confirmation);
    }
    case 'draft.verify': {
      const v = draftSchema.parse(input);
      return services.verifyPublish(services.scope(v.path, v.slot), v.id, v.revision);
    }
    case 'draft.abandon': {
      const v = draftSchema.extend({ confirmation: z.string().max(253).optional() }).parse(input);
      return services.abandonPublish(services.scope(v.path, v.slot), v.id, v.revision, v.confirmation);
    }
    case 'draft.next': {
      const v = draftSchema.parse(input);
      return services.nextDraft(services.scope(v.path, v.slot), v.id, v.revision);
    }
    case 'preview.prepare': {
      if (input.kind === 'draft') {
        const v = draftSchema.parse(input);
        return services.stage(services.scope(v.path, v.slot), v.id, v.revision);
      }
      const scope = inputScope(input);
      const { storefrontUrl } = await import('../shared/storefront');
      return {
        url: storefrontUrl(scope.selection.storefront.host, scope.path),
        host: scope.selection.storefront.host,
        draftId: null,
        revision: null,
      };
    }
    case 'preview.confirm': {
      const v = z.object({ id: z.string().uuid(), revision: z.number().int().positive() }).parse(input);
      services.markPreview(v.id, v.revision);
      return true;
    }
    case 'session.create': {
      const target = z
        .union([
          pathSchema.strict(),
          z.object({ landingId: z.string().uuid() }).strict(),
          z.object({ warehouse: z.literal(true) }).strict(),
        ])
        .parse(input);
      if ('landingId' in target) return agents.createLanding(target.landingId);
      if ('warehouse' in target) return agents.createWarehouse();
      return agents.create(target.path, 'Untitled change', target.slot);
    }
    case 'session.view':
      return agents.view(sessionId(input));
    case 'session.send': {
      const id = sessionId(input);
      const v = z
        .object({
          text: z.string().trim().min(1).max(24000),
          requestId: z.string().uuid(),
          steer: z.boolean().optional(),
        })
        .parse(input);
      return agents.submit(id, v.text, v.requestId, v.steer);
    }
    case 'session.stop':
      return agents.abort(sessionId(input));
    case 'auth.begin':
      return auth.login();
    case 'auth.answer': {
      const v = z.object({ id: z.string().uuid(), value: z.string().max(12000) }).parse(input);
      auth.answer(v.id, v.value);
      return true;
    }
    case 'auth.cancel':
      auth.cancel();
      return true;
    case 'auth.logout':
      return auth.logout();
    case 'shutdown':
      auth.cancel();
      await agents.close();
      warehouse.dispose();
      services.connection.dispose();
      services.store.close();
      return true;
    default:
      throw new Error('Unknown Studio operation.');
  }
}
port.on('message', async ({ data }: { data: any }) => {
  if (data.hostReply) {
    const request = pending.get(data.id);
    pending.delete(data.id);
    data.error ? request?.reject(new Error(data.error)) : request?.resolve(data.result);
    return;
  }
  try {
    port.postMessage({ id: data.id, result: await dispatch(data.method, data.params) });
  } catch (error) {
    port.postMessage({ id: data.id, error: error instanceof Error ? error.message : 'Operation failed.' });
  }
});
