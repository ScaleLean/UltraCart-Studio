import {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  utilityProcess,
  safeStorage,
  shell,
  dialog,
  Menu,
  session as electronSession,
  type UtilityProcess,
} from 'electron';
import { readFileSync, existsSync, mkdirSync, writeFileSync, renameSync, cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Settings, StudioEvent } from '../shared/types';
import { assertSecureCredentialStorage } from './secure-storage';

app.setName('UltraCart Studio');
if (process.env.UC_STUDIO_DATA) {
  const profile = resolve(process.env.UC_STUDIO_DATA);
  mkdirSync(profile, { recursive: true, mode: 0o700 });
  app.setPath('userData', profile);
}
// Developer overrides are ignored in packaged builds so a local process cannot redirect the bridge window or the toolkit root.
const development = !app.isPackaged && !!process.env.UC_STUDIO_DEV;
const root = app.isPackaged ? process.resourcesPath : process.env.UC_STUDIO_ROOT || resolve(__dirname, '..');
const directory = process.env.UC_STUDIO_DATA || app.getPath('userData');
let win: BrowserWindow;
let worker: UtilityProcess | null = null;
let ready: Promise<unknown>;
let quitting = false;
let restarts = 0;
let preview: WebContentsView | null = null;
let previewGeneration = 0;
const pending = new Map<
  string,
  { resolve: (value: any) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }
>();
const send = (event: StudioEvent) => {
  if (win && !win.isDestroyed()) win.webContents.send('studio:event', event);
};

let credentialLoadError: string | null = null;
function loadCredentials() {
  const file = join(directory, 'credentials.enc');
  if (!existsSync(file)) return {};
  try {
    assertSecureCredentialStorage(safeStorage);
    return JSON.parse(safeStorage.decryptString(readFileSync(file)));
  } catch (error) {
    credentialLoadError =
      process.platform === 'linux'
        ? 'Saved agent credentials could not be unlocked. Start and unlock GNOME Keyring or KWallet, then restart Studio. Your local projects remain available.'
        : 'Saved agent credentials could not be unlocked. Unlock your operating system credential store, then restart Studio. Your local projects remain available.';
    return {};
  }
}
function saveCredentials(value: unknown) {
  assertSecureCredentialStorage(safeStorage);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = join(directory, 'credentials.enc');
  writeFileSync(file + '.tmp', safeStorage.encryptString(JSON.stringify(value)), { mode: 0o600 });
  renameSync(file + '.tmp', file);
}
function call(method: string, params?: unknown): Promise<any> {
  if (!worker) return Promise.reject(new Error('The local engine is restarting.'));
  const id = randomUUID();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error('The operation timed out. Check its status before retrying.'));
    }, 180000);
    pending.set(id, { resolve, reject, timeout });
    worker!.postMessage({ id, method, params });
  });
}
function launchWorker() {
  worker = utilityProcess.fork(join(__dirname, 'worker.mjs'), [], {
    serviceName: 'UltraCart Studio Engine',
    stdio: 'pipe',
  });
  worker.on('message', async (data) => {
    if (data.event) {
      send(data.event);
      return;
    }
    if (data.host) {
      try {
        let result: unknown;
        if (data.method === 'credentials.save') {
          saveCredentials(data.params);
          result = true;
        } else if (data.method === 'auth.open') {
          const url = new URL(data.params.url);
          if (url.protocol !== 'https:' || !['auth.openai.com', 'chatgpt.com'].includes(url.hostname))
            throw new Error('Unexpected sign-in destination.');
          await shell.openExternal(url.href);
          result = true;
        } else throw new Error('Unknown host operation.');
        worker?.postMessage({ hostReply: true, id: data.id, result });
      } catch {
        worker?.postMessage({
          hostReply: true,
          id: data.id,
          error: 'Secure host operation could not complete.',
        });
      }
      return;
    }
    const request = pending.get(data.id);
    if (request) {
      clearTimeout(request.timeout);
      pending.delete(data.id);
      data.error ? request.reject(new Error(data.error)) : request.resolve(data.result);
    }
  });
  worker.on('exit', () => {
    worker = null;
    for (const p of pending.values()) {
      clearTimeout(p.timeout);
      p.reject(new Error('The engine restarted. Saved work will reopen.'));
    }
    pending.clear();
    if (!quitting && restarts++ < 3) {
      send({ type: 'worker', status: 'restarting' });
      setTimeout(launchWorker, 750);
    } else if (!quitting)
      send({ type: 'worker', status: 'error', message: 'The engine could not start. Restart the app.' });
  });
  // Drain output without displaying provider or merchant data.
  worker.stdout?.resume();
  worker.stderr?.resume();
  ready = call('init', { directory, root, credentials: loadCredentials() }).then(() => {
    send({ type: 'worker', status: 'ready' });
  });
  ready.catch(() =>
    send({ type: 'worker', status: 'error', message: 'The local engine could not initialize.' })
  );
}
function trusted(event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent) {
  if (event.sender !== win?.webContents || event.senderFrame !== win.webContents.mainFrame)
    throw new Error('Only the Studio interface may use this operation.');
}
const publicMethods = new Set([
  'bootstrap',
  'settings.save',
  'workspace.refresh',
  'workspace.sample',
  'workspace.connect',
  'connection.inspect',
  'connection.storefronts',
  'connection.begin',
  'connection.poll',
  'connection.cancel',
  'toolkit.skills.list',
  'toolkit.skills.read',
  'page.inspect',
  'page.templates',
  'page.source',
  'page.contentMap',
  'draft.nativeIdsPlan',
  'draft.reserveNativeIds',
  'builder.inspect',
  'builder.apply',
  'landing.list',
  'landing.read',
  'landing.readiness',
  'landing.preparation',
  'landing.prepare',
  'landing.reserveNativeIds',
  'landing.create',
  'landing.update',
  'landing.patchFields',
  'landing.operate',
  'landing.history',
  'landing.restore',
  'landing.archive',
  'warehouse.status',
  'warehouse.diagnose',
  'warehouse.configure',
  'warehouse.tables',
  'warehouse.schema',
  'warehouse.prepare',
  'warehouse.run',
  'warehouse.history',
  'warehouse.save',
  'draft.read',
  'draft.pull',
  'draft.save',
  'draft.review',
  'draft.history',
  'draft.restore',
  'draft.publish',
  'draft.verify',
  'draft.next',
  'session.create',
  'session.view',
  'session.send',
  'session.stop',
  'auth.begin',
  'auth.answer',
  'auth.cancel',
  'auth.logout',
]);
function closePreview() {
  previewGeneration++;
  if (preview) {
    win.contentView.removeChildView(preview);
    preview.webContents.close();
    preview = null;
  }
}
async function openPreview(params: any) {
  closePreview();
  const generation = previewGeneration;
  const source = await call('preview.prepare', params);
  if (generation !== previewGeneration) return { opened: false };
  const context = {
    host: source.host,
    draftId: source.draftId,
    revision: source.revision,
    expectedPath: params.path,
  };
  // Each preview gets its own ephemeral cookie jar. Preview credentials never reach the renderer.
  const previewPartition = `studio-preview-${randomUUID()}`;
  const ses = electronSession.fromPartition(previewPartition);
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  ses.on('will-download', (event) => event.preventDefault());
  ses.webRequest.onHeadersReceived((details, callback) => {
    const header = Object.entries(details.responseHeaders || {})
      .find(([key]) => key.toLowerCase() === 'x-ultracart-preview')?.[1]
      ?.join(',');
    if (
      generation === previewGeneration &&
      details.resourceType === 'mainFrame' &&
      details.statusCode >= 200 &&
      details.statusCode < 300 &&
      context.draftId &&
      header?.toLowerCase() === 'applied'
    ) {
      const current = new URL(details.url);
      if (current.hostname === context.host && current.pathname === context.expectedPath) {
        void call('preview.confirm', { id: context.draftId, revision: context.revision })
          .then(() => {
            if (generation === previewGeneration) send({ type: 'preview', loading: false, applied: true });
          })
          .catch(() => undefined);
      }
    }
    callback({ responseHeaders: details.responseHeaders });
  });
  preview = new WebContentsView({
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      partition: previewPartition,
    },
  });
  win.contentView.addChildView(preview);
  preview.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  preview.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const restrictNavigation = (event: Electron.Event, url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || ![source.host, 'secure.ultracart.com'].includes(parsed.hostname))
        event.preventDefault();
    } catch {
      event.preventDefault();
    }
  };
  preview.webContents.on('will-navigate', restrictNavigation);
  preview.webContents.on('will-redirect', restrictNavigation);
  const emitPreview = (event: StudioEvent) => {
    if (generation === previewGeneration) send(event);
  };
  preview.webContents.on('did-start-loading', () => emitPreview({ type: 'preview', loading: true }));
  preview.webContents.on('did-stop-loading', () => emitPreview({ type: 'preview', loading: false }));
  preview.webContents.on('did-fail-load', (_e, code, _description, _url, isMainFrame) => {
    if (isMainFrame && code !== -3)
      emitPreview({
        type: 'preview',
        loading: false,
        error: 'The storefront did not load. Try opening it in your browser.',
      });
  });
  try {
    await preview.webContents.loadURL(source.url);
  } catch (error) {
    if (generation === previewGeneration) throw error;
  }
  return { opened: true };
}

// The renderer never supplies executable paths. Main asks the user through a native dialog,
// and the worker persists only the path the dialog returned.
async function pickPath(kind: 'nodePath' | 'cliPath') {
  const current: Settings = await call('settings.current');
  const node = kind === 'nodePath';
  const result = await dialog.showOpenDialog(win, {
    title: node ? 'Choose the Node 24 executable' : 'Choose the UltraCart toolkit entry (dist/bin.js)',
    defaultPath: current[kind] || undefined,
    properties: ['openFile', 'showHiddenFiles'],
    filters: node
      ? process.platform === 'win32'
        ? [{ name: 'Executable', extensions: ['exe'] }]
        : undefined
      : [{ name: 'JavaScript', extensions: ['js', 'mjs', 'cjs'] }],
  });
  const path = result.filePaths[0];
  if (result.canceled || !path) return { changed: false, settings: current };
  return { changed: path !== current[kind], settings: await call('settings.setPath', { kind, path }) };
}

ipcMain.handle('studio:invoke', async (event, method: string, params: unknown) => {
  trusted(event);
  await ready;
  if (method === 'auth.begin') {
    assertSecureCredentialStorage(safeStorage);
    if (credentialLoadError) throw new Error(credentialLoadError);
  }
  if (method === 'bootstrap' && credentialLoadError) {
    const result = await call(method, params);
    return {
      ...result,
      auth: { ...result.auth, connected: false, phase: 'error', message: credentialLoadError },
    };
  }
  if (method === 'settings.pickNodePath') return pickPath('nodePath');
  if (method === 'settings.pickCliPath') return pickPath('cliPath');
  if (method === 'settings.save') {
    const requested = z.object({ nodePath: z.string(), cliPath: z.string() }).passthrough().parse(params);
    const current: Settings = await call('settings.current');
    if (requested.nodePath !== current.nodePath || requested.cliPath !== current.cliPath)
      throw new Error('Choose the Node and toolkit paths with the Browse buttons.');
    return call(method, params);
  }
  if (publicMethods.has(method)) return call(method, params);
  if (method === 'preview.open') return openPreview(params);
  if (method === 'preview.close') {
    closePreview();
    return true;
  }
  if (method === 'preview.reload') {
    preview?.webContents.reload();
    return true;
  }
  if (method === 'window.openStore') {
    const source = await call('preview.prepare', { ...(params as any), kind: 'live' });
    await shell.openExternal(source.url);
    return true;
  }
  if (method === 'window.openAuth') {
    const url = new URL(z.object({ url: z.string() }).parse(params).url);
    if (url.protocol !== 'https:' || url.hostname !== 'secure.ultracart.com')
      throw new Error('Unexpected authorization URL.');
    await shell.openExternal(url.href);
    return true;
  }
  if (method === 'window.openWarehouseHelp') {
    const url = new URL(
      z
        .object({ url: z.string().max(512) })
        .strict()
        .parse(params).url
    );
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'docs.cloud.google.com' ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^\/(?:sdk|bigquery)\//.test(url.pathname)
    )
      throw new Error('Unexpected warehouse documentation URL.');
    await shell.openExternal(url.href);
    return true;
  }
  if (method === 'draft.export') {
    const text = await call(method, params);
    const result = await dialog.showSaveDialog(win, {
      title: 'Export local draft',
      defaultPath: 'body.cjson',
      filters: [{ name: 'UltraCart container', extensions: ['cjson'] }],
    });
    if (!result.canceled && result.filePath) writeFileSync(result.filePath, text, { mode: 0o600 });
    return { saved: !result.canceled };
  }
  if (method === 'landing.export' || method === 'landing.prepareExport') {
    const output = await call(method, params);
    const result = await dialog.showSaveDialog(win, {
      title: 'Export landing page draft',
      defaultPath: output.filename,
      filters: [{ name: 'Studio landing draft', extensions: ['json'] }],
    });
    if (!result.canceled && result.filePath) writeFileSync(result.filePath, output.content, { mode: 0o600 });
    return { saved: !result.canceled };
  }
  if (method === 'app.restartEngine') {
    restarts = 0;
    worker?.kill();
    return true;
  }
  throw new Error('Unknown Studio operation.');
});
ipcMain.on('studio:preview-bounds', (event, input) => {
  try {
    trusted(event);
    const b = z
      .object({
        x: z.number().finite(),
        y: z.number().finite(),
        width: z.number().finite(),
        height: z.number().finite(),
        visible: z.boolean(),
      })
      .parse(input);
    if (!preview) return;
    const [ww, wh] = win.getContentSize();
    if (!b.visible) {
      preview.setVisible(false);
      return;
    }
    const x = Math.max(0, Math.min(ww, Math.round(b.x))),
      y = Math.max(0, Math.min(wh, Math.round(b.y)));
    preview.setBounds({
      x,
      y,
      width: Math.max(0, Math.min(ww - x, Math.round(b.width))),
      height: Math.max(0, Math.min(wh - y, Math.round(b.height))),
    });
    preview.setVisible(true);
  } catch {
    /* Ignore geometry from a closing view. */
  }
});

app.whenReady().then(async () => {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on('second-instance', () => {
    win.show();
    win.focus();
  });
  const legacyDirectory = join(root, '.studio-data');
  if (
    development &&
    !process.env.UC_STUDIO_DATA &&
    existsSync(join(legacyDirectory, 'studio.sqlite')) &&
    !existsSync(join(directory, 'studio.sqlite'))
  ) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    cpSync(legacyDirectory, directory, { recursive: true, force: false, errorOnExist: true });
  }
  win = new BrowserWindow({
    width: 1512,
    height: 1000,
    minWidth: 1050,
    minHeight: 720,
    title: 'UltraCart Studio',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: '#f5f5f7',
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!development || new URL(url).origin !== 'http://127.0.0.1:5178') event.preventDefault();
  });
  win.webContents.session.setPermissionRequestHandler((_wc, _p, callback) => callback(false));
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'UltraCart Studio',
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'togglefullscreen' },
          ...(development ? [{ role: 'reload' as const }, { role: 'toggleDevTools' as const }] : []),
        ],
      },
      { role: 'windowMenu' },
    ])
  );
  win.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      win.hide();
    }
  });
  app.on('activate', () => win.show());
  launchWorker();
  if (development) await win.loadURL('http://127.0.0.1:5178');
  else await win.loadFile(join(__dirname, 'renderer/index.html'));
  win.show();
});
app.on('before-quit', (event) => {
  if (!quitting) {
    quitting = true;
    closePreview();
    if (!worker) return;
    event.preventDefault();
    void Promise.race([call('shutdown'), new Promise((resolve) => setTimeout(resolve, 3000))])
      .catch(() => undefined)
      .finally(() => {
        worker?.kill();
        app.quit();
      });
  }
});
