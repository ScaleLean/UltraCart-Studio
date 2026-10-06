import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { isAbsolute, dirname, delimiter } from 'node:path';
import { homedir } from 'node:os';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import type { Login, Profile, Storefront, Selection } from '../../shared/connection';
import { assertPagePath, parsePages, parsePageDetail, parseTemplates } from '../../shared/storefront';

type Config = { nodePath: string; cliPath: string };
const LIMIT = 4 * 1024 * 1024;
function readJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('The toolkit returned an unreadable response. Check the installed version.');
  }
}
export function assertProfile(value: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value))
    throw new Error(
      'Use 1–64 letters, numbers, dots, underscores, or hyphens, starting with a letter or number.'
    );
}
export function parseChallenge(text: string): { url: string; code: string } | null {
  const match = text.match(
    /open this URL in your browser:\s*(https:\/\/\S+)\s+Enter code:\s*([A-Za-z0-9-]+)(?:\s|$)/
  );
  if (!match) return null;
  const url = new URL(match[1]);
  if (url.origin !== 'https://secure.ultracart.com' || url.username || url.password)
    throw new Error(
      'The toolkit returned an unexpected login address. Update or inspect the installed toolkit.'
    );
  return { url: url.toString(), code: match[2] };
}
export function parseStorefronts(value: unknown): { merchantId: string; storefronts: Storefront[] } {
  if (!value || typeof value !== 'object') throw new Error('Unexpected storefront response.');
  const result = value as Record<string, unknown>;
  if (typeof result.merchantId !== 'string' || !result.merchantId || !Array.isArray(result.storefronts))
    throw new Error('Unexpected storefront response.');
  const storefronts = result.storefronts.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('Unexpected storefront record.');
    const s = entry as Record<string, unknown>;
    if (
      !Number.isSafeInteger(s.storefront_oid) ||
      Number(s.storefront_oid) <= 0 ||
      typeof s.host_name !== 'string' ||
      !s.host_name
    )
      throw new Error('Unexpected storefront record.');
    return {
      id: Number(s.storefront_oid),
      host: s.host_name,
      themeId: Number.isSafeInteger(s.active_theme_oid) ? Number(s.active_theme_oid) : null,
    };
  });
  return { merchantId: result.merchantId, storefronts };
}
export function safeFailure(text: string) {
  if (/rate.limit|429/i.test(text))
    return 'UltraCart rate limited the request. Wait at least one minute before retrying.';
  if (/locked|keychain|credential store|native_binding/i.test(text))
    return 'The OS credential store is unavailable or locked. Unlock it, then try again.';
  if (
    /\bHTTP(?:\/[\d.]+)?\s+403\b|\b403\s+Forbidden\b|\b(?:httpStatus|status(?:Code)?)["']?\s*[:=]\s*["']?403\b/i.test(
      text
    ) ||
    /\brequires?\s+(?:read|write|publish)(?:\s+and\s+(?:read|write|publish))?\s+permission\b|\bsfvb\.(?:read|write|publish)_scope_required\b/i.test(
      text
    )
  )
    return 'The selected profile does not have permission for this request. Check its UltraCart permissions.';
  if (/access_denied|authorization_declined/i.test(text))
    return 'Authorization was declined. You can start again when ready.';
  if (/expired_token|expired/i.test(text)) return 'The sign-in request expired. Start a new sign-in.';
  if (/invalid_grant|unauthenticated|401|no.*credential|not authenticated/i.test(text))
    return 'This profile needs sign-in. Authorize it in UltraCart, then retry.';
  if (/merchant.*mismatch|identity.*mismatch/i.test(text))
    return 'The merchant does not match this profile. Choose the correct profile or sign in with a new profile name.';
  // An identity failure may also mention the requested file. It must take precedence.
  if (
    /\bsfvb\.invalid_storefront\b|\b(?:unknown|missing)\s+(?:storefront|merchant|profile|identity|account)\b/i.test(
      text
    ) ||
    /\bno\s+(?:storefront|merchant|profile|identity|account)\b[^\r\n]{0,160}\bexists?\b/i.test(text) ||
    /\b(?:storefront|merchant|profile|identity|account)(?:\s+(?:["'][^"'\r\n]{1,80}["']|\[[^\]\r\n]{1,80}\]|[\w.-]{1,64}))?\s+(?:was\s+|is\s+)?(?:not found|does not exist|unavailable)\b/i.test(
      text
    ) ||
    /\bstorefront\b[^\r\n]{0,160}\bis not on profile\b/i.test(text)
  )
    return 'The selected profile, merchant, or storefront could not be found. Check the connection selection.';
  if (
    /\b(?:invalid|malformed)\s+CJSON\b|\bnot\s+(?:a\s+)?(?:valid\s+)?CJSON\b|\bCJSON\s+(?:is\s+)?(?:invalid|malformed|validation failed)\b/i.test(
      text
    ) ||
    /\bPush supports container documents only\b|\bEvery widget must have a unique nonempty ID\b|\bchildWidgets must contain only widget objects\b/i.test(
      text
    )
  )
    return 'The container is not valid CJSON. Inspect its structure before editing.';
  const missingContent =
    /\b(?:file|container|slot|path)\b[^\r\n]{0,160}\b(?:not found|does not exist|doesn't exist)\b/i.test(
      text
    ) ||
    /\b(?:no such|cannot find|could not find)\s+(?:the\s+)?(?:remote\s+)?(?:file|container|slot|path)\b/i.test(
      text
    ) ||
    /\bno\s+(?:file|container|slot|path)\b[^\r\n]{0,160}\bexists?\b/i.test(text) ||
    text
      .split(/\r?\n/)
      .some(
        (line) =>
          /\bHTTP(?:\/[\d.]+)?\s+404\b|\b404\s+Not Found\b|\b(?:httpStatus|status(?:Code)?)["']?\s*[:=]\s*["']?404\b/i.test(
            line
          ) && /(?:^|[\s"'[(=:])\/[^\s"'<>]{1,2048}\.cjson\b/i.test(line)
      );
  if (missingContent && !/\b(?:ENOENT|ENOTDIR|MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND)\b/i.test(text))
    return 'This page body or slot does not exist. Inspect the resolved template to find its content.';
  return 'The toolkit could not complete the request. Check the selected profile, network, and installed toolkit, then retry.';
}

export type ChildObserver = (pid: number, state: 'started' | 'exited') => void;

export class ConnectionService {
  /** Lets the worker report toolkit child pids so the main process can kill them if the worker dies. */
  static childObserver: ChildObserver | null = null;
  private children = new Set<ChildProcessWithoutNullStreams>();
  private login: Login | null = null;
  private loginChild: ChildProcessWithoutNullStreams | null = null;
  private loginTimer: ReturnType<typeof setTimeout> | null = null;
  private busy = false;
  private disposed = false;
  private pending = 0;
  private queue: Promise<void> = Promise.resolve();
  private getConfig: () => Promise<Config>;
  constructor(getConfig: () => Promise<Config>) {
    this.getConfig = getConfig;
  }

  private async command(args: string[]) {
    if (this.disposed) throw new Error('The local toolkit connection has closed. Restart Studio.');
    const config = await this.getConfig();
    if (!isAbsolute(config.nodePath) || !isAbsolute(config.cliPath))
      throw new Error('Configure absolute Node 24 and toolkit CLI paths in Studio settings.');
    try {
      await access(config.nodePath, constants.X_OK);
      await access(config.cliPath, constants.R_OK);
    } catch {
      throw new Error(
        'The UltraCart toolkit is not configured. Set the Node 24 executable and toolkit CLI paths in Studio settings. You can use the sample workspace without it.'
      );
    }
    return {
      command: config.nodePath,
      args: [config.cliPath, ...args],
      options: {
        cwd: homedir(),
        shell: false as const,
        env: {
          ...process.env,
          PATH: `${dirname(config.nodePath)}${delimiter}${process.env.PATH || ''}`,
          ULTRACART_PROFILE: '',
          NO_COLOR: '1',
        },
        stdio: 'pipe' as const,
      },
    };
  }
  async run(args: string[], options: { acceptedExitCodes?: number[] } = {}): Promise<string> {
    if (this.loginChild || this.login?.phase === 'starting')
      throw new Error('Another toolkit request is in progress. Finish or cancel it first.');
    if (this.pending >= 12) throw new Error('The toolkit is busy. Wait for the current requests to finish.');
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.pending++;
    try {
      await previous;
      return await this.runNow(args, options.acceptedExitCodes || [0]);
    } finally {
      this.pending--;
      release();
    }
  }
  async validateLocal(file: string): Promise<string> {
    if (!isAbsolute(file)) throw new Error('Validation requires an internal absolute file path.');
    return this.run(['--format', 'json', 'validate', file, '--limit', '100'], { acceptedExitCodes: [0, 2] });
  }
  private async runNow(args: string[], acceptedExitCodes: number[]): Promise<string> {
    if (this.busy || this.loginChild)
      throw new Error('Another toolkit request is in progress. Finish or cancel it first.');
    this.busy = true;
    try {
      const invocation = await this.command(args);
      if (this.disposed) throw new Error('The local toolkit connection has closed. Restart Studio.');
      return await new Promise<string>((resolve, reject) => {
        const child = spawn(invocation.command, invocation.args, {
          ...invocation.options,
          detached: process.platform !== 'win32',
        });
        this.track(child);
        let stdout = '',
          stderr = '',
          finished = false;
        const finish = (error?: Error) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          this.untrack(child);
          if (error) reject(error);
          else resolve(stdout.trim());
        };
        const timer = setTimeout(() => {
          this.stopChild(child);
          finish(new Error('The toolkit request timed out. Check its status before retrying.'));
        }, 30000);
        child.stdin.end();
        child.stdout.on('data', (chunk) => {
          stdout += chunk;
          if (stdout.length > LIMIT) {
            this.stopChild(child);
            finish(new Error('The toolkit response exceeded the size limit.'));
          }
        });
        child.stderr.on('data', (chunk) => {
          stderr = (stderr + chunk).slice(-LIMIT);
        });
        child.on('error', () =>
          finish(
            new Error(
              'The toolkit could not start. Check Node 24 and the toolkit CLI path in Studio settings.'
            )
          )
        );
        child.on('close', (code) =>
          finish(
            code !== null && acceptedExitCodes.includes(code)
              ? undefined
              : new Error(safeFailure(stderr + stdout))
          )
        );
      });
    } finally {
      this.busy = false;
    }
  }
  async inspect(): Promise<{ version: string; profiles: Profile[] }> {
    const version = await this.run(['--version']);
    const data = readJson(await this.run(['--format', 'json', 'profile', 'list']));
    if (!Array.isArray(data.profiles)) throw new Error('Unexpected profile response.');
    const profiles: Profile[] = data.profiles.map((p: Record<string, unknown>) => {
      if (typeof p.id !== 'string' || typeof p.name !== 'string')
        throw new Error('Unexpected profile response.');
      return { id: p.id, name: p.name, merchantId: typeof p.merchantId === 'string' ? p.merchantId : null };
    });
    return { version, profiles };
  }
  async storefronts(profile: string) {
    assertProfile(profile);
    return parseStorefronts(
      readJson(await this.run(['--format', 'json', '--profile', profile, 'sf', 'storefronts']))
    );
  }
  async verify(selection: Selection) {
    const result = await this.storefronts(selection.profileId);
    if (result.merchantId !== selection.merchantId)
      throw new Error('Merchant identity changed. Reconnect the intended store.');
    const store = result.storefronts.find((s) => s.id === selection.storefront.id);
    if (!store || store.host !== selection.storefront.host)
      throw new Error('The selected storefront is no longer available. Reconnect your store.');
    return store;
  }
  async pages(selection: Selection) {
    await this.verify(selection);
    return parsePages(
      readJson(
        await this.run([
          '--format',
          'json',
          '--profile',
          selection.profileId,
          'sf',
          'pages',
          'list',
          '--storefront',
          String(selection.storefront.id),
        ])
      ),
      selection.storefront.id
    );
  }
  async page(selection: Selection, path: string) {
    assertPagePath(path);
    await this.verify(selection);
    return parsePageDetail(
      readJson(
        await this.run([
          '--format',
          'json',
          '--profile',
          selection.profileId,
          'sf',
          'pages',
          'get',
          '--storefront',
          String(selection.storefront.id),
          '--path',
          path,
        ])
      ),
      selection.storefront.id,
      path
    );
  }
  async templates(selection: Selection, path: string) {
    assertPagePath(path);
    await this.verify(selection);
    return parseTemplates(
      readJson(
        await this.run([
          '--format',
          'json',
          '--profile',
          selection.profileId,
          'sf',
          'template',
          'find',
          '--storefront',
          String(selection.storefront.id),
          '--uri',
          path,
        ])
      ),
      selection.storefront.id,
      path
    );
  }
  async begin(profile: string): Promise<Login> {
    assertProfile(profile);
    if (this.pending || this.busy || this.loginChild || this.login?.phase === 'starting')
      throw new Error('Another toolkit request is in progress. Finish or cancel it first.');
    const id = randomUUID();
    this.login = {
      id,
      profile,
      phase: 'starting',
      url: null,
      code: null,
      message: 'Starting UltraCart sign-in…',
    };
    try {
      const invocation = await this.command(['--format', 'json', 'auth', 'login', '--profile', profile]);
      if (this.disposed || this.login.phase !== 'starting') throw new Error('Sign-in cancelled.');
      const child = spawn(invocation.command, invocation.args, invocation.options);
      this.loginChild = child;
      this.track(child);
      child.stdin.end();
      let stderr = '',
        stdout = '';
      const finish = (phase: Login['phase'], message: string) => {
        if (this.loginTimer) clearTimeout(this.loginTimer);
        this.loginTimer = null;
        this.untrack(child);
        if (this.loginChild === child) this.loginChild = null;
        if (this.login?.id === id && ['starting', 'waiting'].includes(this.login.phase))
          this.login = { id, profile, phase, message, url: null, code: null };
        stderr = '';
        stdout = '';
      };
      this.loginTimer = setTimeout(
        () => {
          child.kill('SIGKILL');
          finish('failed', 'Sign-in timed out. Start a new request.');
        },
        10 * 60 * 1000
      );
      child.stderr.on('data', (chunk) => {
        stderr = (stderr + chunk).slice(-LIMIT);
        if (this.login?.id !== id || !['starting', 'waiting'].includes(this.login.phase)) return;
        try {
          const challenge = parseChallenge(stderr);
          if (challenge)
            this.login = {
              id,
              profile,
              phase: 'waiting',
              ...challenge,
              message: 'Complete sign-in in UltraCart, then return here.',
            };
        } catch {
          child.kill('SIGKILL');
          finish('failed', 'Unexpected authorization address. Check the installed toolkit.');
        }
      });
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
        if (stdout.length > LIMIT) {
          child.kill('SIGKILL');
          finish('failed', 'Unexpected sign-in response.');
        }
      });
      child.on('error', () => finish('failed', 'Could not start the toolkit. Check the configured paths.'));
      child.on('close', (code) => {
        if (code !== 0) {
          finish('failed', safeFailure(stderr + stdout));
          return;
        }
        try {
          const result = JSON.parse(stdout);
          if (result.action !== 'auth.login' || typeof result.identity?.merchantId !== 'string')
            throw new Error();
          finish('succeeded', 'Signed in. Load the storefronts for this profile.');
        } catch {
          finish('failed', 'Could not verify the login result. Refresh profiles before retrying.');
        }
      });
      return { ...this.login };
    } catch (error) {
      this.login = null;
      throw error;
    }
  }
  loginStatus(id: string): Login {
    if (!this.login || this.login.id !== id)
      throw new Error('This sign-in session is no longer active. Start a new sign-in.');
    return { ...this.login };
  }
  cancel(id: string): Login {
    const state = this.loginStatus(id);
    if (!['starting', 'waiting'].includes(state.phase)) return state;
    this.login = {
      ...state,
      phase: 'cancelled',
      message: 'Sign-in cancelled. Any profile already created remains available.',
      url: null,
      code: null,
    };
    this.loginChild?.kill('SIGKILL');
    if (this.loginTimer) clearTimeout(this.loginTimer);
    return { ...this.login };
  }
  dispose() {
    this.disposed = true;
    if (this.loginTimer) clearTimeout(this.loginTimer);
    for (const child of this.children) {
      this.stopChild(child);
      this.untrack(child);
    }
    this.login = null;
    this.loginChild = null;
  }
  private track(child: ChildProcessWithoutNullStreams) {
    this.children.add(child);
    if (child.pid) ConnectionService.childObserver?.(child.pid, 'started');
    // The pid stays reported until the process has really exited, even after we stop waiting for it.
    child.once('exit', () => {
      if (child.pid) ConnectionService.childObserver?.(child.pid, 'exited');
    });
  }
  private untrack(child: ChildProcessWithoutNullStreams) {
    this.children.delete(child);
  }
  private stopChild(child: ChildProcessWithoutNullStreams) {
    if (process.platform !== 'win32' && child !== this.loginChild && child.pid) {
      try {
        process.kill(-child.pid, 'SIGKILL');
        return;
      } catch {
        /* The process group may have already exited. */
      }
    }
    child.kill('SIGKILL');
  }
}
