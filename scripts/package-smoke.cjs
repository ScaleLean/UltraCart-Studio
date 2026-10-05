const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const deadline = setTimeout(() => {
  console.error('The packaged worker did not complete its smoke checks within 45 seconds.');
  process.exit(1);
}, 45000);

(async () => {
  assert(process.versions.electron, 'Smoke checks must run with the packaged Electron runtime.');
  assert(Number(process.versions.node.split('.')[0]) >= 24, 'Studio requires embedded Node 24 or newer.');
  const [resources, directory] = process.argv.slice(2);
  const appRoot = join(resources, 'app.asar');
  assert(readFileSync(join(appRoot, 'dist/renderer/index.html'), 'utf8').includes('<div id="root">'));
  const port = new EventEmitter();
  const pending = new Map();
  let sequence = 0;
  port.postMessage = (message) => {
    if (message.host)
      throw new Error('Sample package smoke must not access credentials or open an external URL.');
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    message.error ? request.reject(new Error(message.error)) : request.resolve(message.result);
  };
  Object.defineProperty(process, 'parentPort', { value: port });
  global.fetch = async () => {
    throw new Error('Network access is not allowed in the sample package smoke.');
  };
  await import(pathToFileURL(join(appRoot, 'dist/worker.mjs')).href);
  const call = (method, params) =>
    new Promise((resolve, reject) => {
      const id = String(++sequence);
      pending.set(id, { resolve, reject });
      port.emit('message', { data: { id, method, params } });
    });
  let initialized = false;
  try {
    await call('init', { directory, root: resources, credentials: {} });
    initialized = true;
    const boot = await call('bootstrap');
    assert.equal(boot.workspace.kind, 'sample');
    assert(boot.pages.length > 0);
    assert.equal(boot.auth.connected, false);
    const project = await call('landing.create', {
      workspaceId: boot.workspace.id,
      brief: {
        title: 'Packaged runtime check',
        path: '/packaged-check/',
        audience: 'Synthetic audience',
        offer: 'Synthetic offer',
        goal: 'Verify local persistence',
        brandConstraints: 'No network access',
      },
    });
    assert.equal(project.sections.length, 4);
    await call('shutdown');
    initialized = false;
    await call('init', { directory, root: resources, credentials: {} });
    initialized = true;
    const reopened = await call('landing.read', { id: project.id });
    assert.equal(reopened.brief.title, 'Packaged runtime check');
    assert.equal(reopened.revision, 1);
    console.log(
      `Packaged sample worker and SQLite reopen passed on ${process.platform}/${process.arch}. Electron ${process.versions.electron}; Node ${process.versions.node}.`
    );
  } finally {
    if (initialized) await call('shutdown');
  }
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => clearTimeout(deadline));
