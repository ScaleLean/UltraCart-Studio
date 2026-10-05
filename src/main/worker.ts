import { z } from 'zod';
import { Store } from './database';
import { StudioServices } from './services';
import { Auth, LocalCredentials } from './auth';
import { Agents } from './agent';
import type { StudioEvent } from '../shared/types';

const port = (process as any).parentPort;
if (!port) throw new Error('Studio worker requires a parent process.');
let services: StudioServices;
let agents: Agents;
let auth: Auth;
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
const pathSchema = z.object({ path: z.string().min(1).max(2048) });
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
      auth = new Auth(
        new LocalCredentials(input.credentials, (values) => host('credentials.save', values)),
        store,
        (status) => {
          emit({ type: 'auth', status });
          if (status.connected && status.phase === 'connected') void agents?.recover();
        },
        (url) => host('auth.open', { url })
      );
      agents = new Agents(services, auth, (id, view) => emit({ type: 'conversation', id, view }));
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
        version: '0.1.0',
      };
    case 'settings.save': {
      if ((await auth.status()).phase === 'waiting' && input.provider !== auth.provider())
        throw new Error('Finish or cancel sign-in before changing the connection.');
      const settings = services.saveSettings(input);
      emit({ type: 'auth', status: await auth.status() });
      return settings;
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
      return services.detail(services.scope(pathSchema.parse(input).path));
    case 'page.templates':
      return services.templates(services.scope(pathSchema.parse(input).path));
    case 'page.source': {
      const v = pathSchema.extend({ kind: z.enum(['group', 'item']).default('group') }).parse(input);
      return services.templateSource(services.scope(v.path), v.kind);
    }
    case 'draft.read':
      return services.drafts.read(services.scope(pathSchema.parse(input).path));
    case 'draft.pull':
      return services.pull(services.scope(pathSchema.parse(input).path));
    case 'draft.save': {
      const v = draftSchema
        .extend({
          edits: z.array(z.object({ pointer: z.string().max(4096), value: z.string().max(16384) })).max(100),
        })
        .parse(input);
      return services.save({ ...services.scope(v.path), id: v.id, revision: v.revision, edits: v.edits });
    }
    case 'draft.review': {
      const v = draftSchema.parse(input);
      return services.review(services.scope(v.path), v.id, v.revision);
    }
    case 'draft.history': {
      const v = pathSchema.extend({ id: z.string().uuid() }).parse(input);
      if (services.drafts.read(services.scope(v.path))?.id !== v.id) throw new Error('Draft scope mismatch.');
      return services.history(v.id);
    }
    case 'draft.restore': {
      const v = draftSchema.parse(input);
      return services.restore(services.scope(v.path), v.id, v.revision);
    }
    case 'draft.export': {
      const v = draftSchema.parse(input);
      return services.exportDraft(services.scope(v.path), v.id, v.revision);
    }
    case 'draft.publish': {
      const v = draftSchema.extend({ confirmation: z.string() }).parse(input);
      return services.publish(services.scope(v.path), v.id, v.revision, v.confirmation);
    }
    case 'draft.verify': {
      const v = draftSchema.parse(input);
      return services.verifyPublish(services.scope(v.path), v.id, v.revision);
    }
    case 'draft.next': {
      const v = draftSchema.parse(input);
      return services.nextDraft(services.scope(v.path), v.id, v.revision);
    }
    case 'preview.prepare': {
      if (input.kind === 'draft') {
        const v = draftSchema.parse(input);
        return services.stage(services.scope(v.path), v.id, v.revision);
      }
      const scope = services.scope(pathSchema.parse(input).path);
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
    case 'session.create':
      return agents.create(pathSchema.parse(input).path);
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
