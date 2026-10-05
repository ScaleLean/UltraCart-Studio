import { randomUUID } from 'node:crypto';
import { fauxProvider, fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai/providers/faux';
import { Store } from '../../src/main/database';
import { StudioServices } from '../../src/main/services';
import { Auth, LocalCredentials } from '../../src/main/auth';
import { Agents } from '../../src/main/agent';

const [directory, operation, phase] = process.argv.slice(2);
const store = new Store(directory);
const services = new StudioServices(store, () => {}, directory);
const auth = new Auth(
  new LocalCredentials({}, async () => {}),
  store,
  () => {},
  async () => {}
);
const authStatus = auth.status.bind(auth);
auth.status = async () => ({ ...(await authStatus()), connected: true });
const faux = fauxProvider({ provider: 'test' });
auth.models.setProvider(faux.provider);
store.set('settings', { ...services.settings(), provider: 'test', model: faux.getModel().id });
const agents = new Agents(services, auth, () => {});
const key = operation === 'safe' ? 'pull' : 'save';
const original = services[key].bind(services);
(services as any)[key] = async (...args: any[]) => {
  const value = await (original as any)(...args);
  store.set('executions', store.get('executions', 0) + 1);
  if (phase === 'start') {
    process.stdout.write('CHECKPOINT\n');
    process.stdin.resume();
    await new Promise(() => {});
  }
  return value;
};

if (phase === 'start') {
  const session = await agents.create('/');
  store.set('crash-session', session.id);
  if (operation === 'safe') {
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall('storefront_pull_draft', {}), { stopReason: 'toolUse' }),
    ]);
  } else {
    const draft = await services.pull(services.scope('/'));
    faux.setResponses([
      fauxAssistantMessage(
        fauxToolCall('storefront_save_draft', {
          id: draft.id,
          revision: draft.revision,
          edits: [{ pointer: draft.fields[1].pointer, value: 'A durable edit.' }],
        }),
        { stopReason: 'toolUse' }
      ),
    ]);
  }
  await agents.submit(session.id, 'Exercise crash recovery.', randomUUID());
} else {
  faux.setResponses([fauxAssistantMessage('Recovery completed.')]);
  await agents.recover();
  const id = store.get<string>('crash-session', '');
  const deadline = Date.now() + 10_000;
  let view = await agents.view(id);
  while (Date.now() < deadline && !view.messages.some((m) => m.text === 'Recovery completed.')) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    view = await agents.view(id);
  }
  const report = {
    executions: store.get('executions', 0),
    revision: services.changes()[0]?.draft.revision,
    messages: view.messages,
    status: store.session(id).status,
  };
  await agents.close();
  store.close();
  process.stdout.write('RESULT ' + JSON.stringify(report) + '\n');
}
