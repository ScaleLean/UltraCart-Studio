import { randomUUID } from 'node:crypto';
import { createModels } from '@earendil-works/pi-ai/models';
import type { Credential, CredentialStore } from '@earendil-works/pi-ai';
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai';
import { openaiCodexProvider } from '@earendil-works/pi-ai/providers/openai-codex';
import type { AuthStatus } from '../shared/types';
import type { Store } from './database';

export class LocalCredentials implements CredentialStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private values: Record<string, Credential>,
    private persist: (values: Record<string, Credential>) => Promise<void>
  ) {}
  async read(provider: string) {
    return this.values[provider];
  }
  async list() {
    return Object.entries(this.values).map(([providerId, value]) => ({ providerId, type: value.type }));
  }
  modify(provider: string, fn: (value: Credential | undefined) => Promise<Credential | undefined>) {
    const result = this.queue
      .catch(() => undefined)
      .then(async () => {
        const value = await fn(this.values[provider]);
        if (value !== undefined) {
          const next = { ...this.values, [provider]: value };
          await this.persist(next);
          this.values = next;
        }
        return this.values[provider];
      });
    this.queue = result;
    return result;
  }
  async delete(provider: string) {
    const result = this.queue
      .catch(() => undefined)
      .then(async () => {
        const next = { ...this.values };
        delete next[provider];
        await this.persist(next);
        this.values = next;
      });
    this.queue = result;
    await result;
  }
}

export class Auth {
  readonly models;
  private controller: AbortController | null = null;
  private pending?: { id: string; resolve: (value: string) => void; reject: (error: Error) => void };
  private phase: AuthStatus['phase'] = 'idle';
  private message?: string;
  private prompt?: AuthStatus['prompt'];
  constructor(
    readonly credentials: LocalCredentials,
    readonly store: Store,
    readonly emit: (status: AuthStatus) => void,
    readonly open: (url: string) => Promise<void>
  ) {
    // Only an explicit OAuth credential is allowed. Ambient API keys are not consumed.
    this.models = createModels({
      credentials,
      authContext: { env: async () => undefined, fileExists: async () => false },
    });
    this.models.setProvider(openaiProvider());
    this.models.setProvider(openaiCodexProvider());
  }
  provider() {
    return this.store.get('settings', { provider: 'openai' }).provider;
  }
  async status(): Promise<AuthStatus> {
    const provider = this.provider();
    const connected = (await this.credentials.read(provider))?.type === 'oauth';
    return {
      connected,
      provider,
      source: connected ? 'ChatGPT sign-in' : null,
      phase: this.controller ? this.phase : connected ? 'connected' : this.phase,
      message: this.message,
      prompt: this.prompt,
      models: this.models.getModels(provider).map((m) => ({ id: m.id, name: m.name })),
    };
  }
  private async notify() {
    this.emit(await this.status());
  }
  async login() {
    if (this.controller) throw new Error('A sign-in is already in progress.');
    const controller = (this.controller = new AbortController());
    this.phase = 'waiting';
    this.message = 'Complete sign-in in your browser.';
    await this.notify();
    const timeout = setTimeout(() => controller.abort(), 10 * 60_000);
    void this.models
      .login(
        this.provider(),
        'oauth',
        {
          signal: controller.signal,
          prompt: (p) =>
            new Promise<string>((resolve, reject) => {
              if (p.type === 'select' && p.options.some((o) => o.id === 'browser')) {
                resolve('browser');
                return;
              }
              const id = randomUUID();
              this.pending = { id, resolve, reject };
              this.prompt = {
                id,
                type: p.type,
                message: p.message,
                ...(p.type === 'select'
                  ? { options: p.options.map((o) => ({ value: o.id, label: o.label })) }
                  : {}),
              };
              p.signal?.addEventListener(
                'abort',
                () => {
                  if (this.pending?.id === id) {
                    this.pending = undefined;
                    this.prompt = undefined;
                    void this.notify();
                  }
                  reject(new Error('Sign-in step completed or cancelled.'));
                },
                { once: true }
              );
              void this.notify();
            }),
          notify: (event) => {
            if (event.type === 'auth_url')
              void this.open(event.url).catch(() => {
                this.message = 'Could not open your browser. Cancel and try again.';
                void this.notify();
              });
            else if (event.type === 'device_code') {
              this.message = `Enter ${event.userCode} in your browser.`;
              void this.open(event.verificationUri);
            } else this.message = event.message;
            void this.notify();
          },
        },
        {
          getDeviceId: () => {
            let id = this.store.get<string | null>('device-id', null);
            if (!id) {
              id = randomUUID();
              this.store.set('device-id', id);
            }
            return id;
          },
        }
      )
      .then(() => {
        this.phase = 'connected';
        this.message = 'Connected with ChatGPT.';
      })
      .catch(() => {
        this.phase = controller.signal.aborted ? 'idle' : 'error';
        this.message = controller.signal.aborted
          ? 'Sign-in cancelled.'
          : 'Sign-in could not complete. Try again, or select the Codex compatibility provider.';
      })
      .finally(() => {
        clearTimeout(timeout);
        this.controller = null;
        this.pending = undefined;
        this.prompt = undefined;
        void this.notify();
      });
    return this.status();
  }
  answer(id: string, value: string) {
    if (this.pending?.id !== id) throw new Error('This sign-in step expired.');
    this.pending.resolve(value);
    this.pending = undefined;
    this.prompt = undefined;
  }
  cancel() {
    this.controller?.abort();
    this.pending?.reject(new Error('Cancelled'));
  }
  async logout() {
    this.cancel();
    await this.models.logout(this.provider());
    this.phase = 'idle';
    this.message = undefined;
    await this.notify();
  }
}
