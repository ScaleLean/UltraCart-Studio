import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ConnectionService,
  parseChallenge,
  parseStorefronts,
  assertProfile,
  safeFailure,
} from '../src/main/domain/connection-service';

const challenge =
  '\nTo authenticate, open this URL in your browser:\n  https://secure.ultracart.com/oauth/device?code=DEMO\n\nEnter code: ABCD-EFGH\n';
test('accepts official challenge, rejects redirected credential URLs', () => {
  assert.equal(parseChallenge('partial output'), null);
  assert.equal(parseChallenge(challenge)?.code, 'ABCD-EFGH');
  for (const origin of [
    'https://secure.ultracart.com.evil.test',
    'https://evil.test',
    'https://name:password@secure.ultracart.com',
  ]) {
    assert.throws(() => parseChallenge(challenge.replace('https://secure.ultracart.com', origin)));
  }
});
test('profile inputs cannot become command options or shell fragments', () => {
  for (const name of ['my-store', 'merchant_2', 'abc.def']) assert.doesNotThrow(() => assertProfile(name));
  for (const name of ['', '--help', 'a b', 'a;ls', '$(id)', 'a/b', 'x'.repeat(65)])
    assert.throws(() => assertProfile(name));
});
test('projects only storefront identity fields and rejects malformed identities', () => {
  assert.deepEqual(
    parseStorefronts({
      merchantId: 'TEST',
      storefronts: [
        { storefront_oid: 1, host_name: 'store.example', active_theme_oid: 2, token: 'never-return' },
      ],
    }),
    { merchantId: 'TEST', storefronts: [{ id: 1, host: 'store.example', themeId: 2 }] }
  );
  assert.throws(() =>
    parseStorefronts({ merchantId: 'TEST', storefronts: [{ storefront_oid: '1', host_name: 'bad' }] })
  );
  assert.throws(() => parseStorefronts({ storefronts: [] }));
  assert.equal(safeFailure('secret=do-not-expose').includes('do-not-expose'), false);
});
const missingBody =
  'This page body or slot does not exist. Inspect the resolved template to find its content.';
const unavailableIdentity =
  'The selected profile, merchant, or storefront could not be found. Check the connection selection.';
const permissionDenied =
  'The selected profile does not have permission for this request. Check its UltraCart permissions.';
const invalidCjson = 'The container is not valid CJSON. Inspect its structure before editing.';
const genericFailure =
  'The toolkit could not complete the request. Check the selected profile, network, and installed toolkit, then retry.';

test('missing content requires an explicit file, container, slot, or CJSON path failure', () => {
  for (const message of [
    'SFVB request failed with HTTP 404 (sfvb.not_found: File [/page/body.cjson] not found)',
    "Remote container 'body' does not exist.",
    'No file /page/body.cjson exists.',
    'Cannot find the remote container.',
    "Path '/page/body.cjson' not found.",
    'SFVB request failed with HTTP 404 for /page/body.cjson',
  ]) {
    assert.equal(safeFailure(message), missingBody, message);
  }
  for (const message of [
    'SFVB request failed with HTTP 404',
    'SFVB request failed with HTTP 404 (sfvb.not_found)',
    'Preview session not found.',
    'Missing file argument.',
    'Missing container ID.',
    'Request 403001 failed for file /page/body.cjson',
    'HTTP 404 while loading catalog\nDiagnostic source: /page/body.cjson',
    "ENOENT: no such file or directory, open '/tmp/body.cjson'",
    "MODULE_NOT_FOUND: Cannot find file '/tmp/toolkit.js'",
    'Remote content is incomplete or its hash does not match.',
  ]) {
    assert.equal(safeFailure(message), genericFailure, message);
  }
});

test('identity failures cannot be mistaken for missing page content', () => {
  for (const message of [
    'SFVB request failed with HTTP 404 (sfvb.invalid_storefront: No storefront [42] exists for this account); file /page/body.cjson',
    "storefront 42 is not on profile 'example' (merchant TEST) (sfvb.invalid_storefront)",
    "Profile 'missing-profile' not found.",
    'Identity not found.',
    'No merchant [TEST] exists for this account.',
    'Unknown storefront; requested file /page/body.cjson not found.',
  ]) {
    assert.equal(safeFailure(message), unavailableIdentity, message);
  }
  assert.match(safeFailure('Merchant identity mismatch; file /page/body.cjson not found'), /does not match/);
});

test('explicit permission and CJSON failures have actionable fixed messages', () => {
  for (const message of [
    'SFVB request failed with HTTP 403',
    'HTTP 403 (access_denied)',
    '403 Forbidden',
    '{"httpStatus":403,"error":"access_denied"}',
    'Pull requires read permission.',
    'Push requires read and write permission.',
    'sfvb.publish_scope_required',
  ]) {
    assert.equal(safeFailure(message), permissionDenied, message);
  }
  for (const message of [
    'Remote file is not a CJSON object.',
    'Refusing to write invalid CJSON (1 hard error).',
    'Server CJSON validation failed: [{"code":"invalid"}]',
    'CJSON is malformed.',
    'Push supports container documents only.',
    'Every widget must have a unique nonempty ID; reserve new IDs with sf ids.',
    'childWidgets must contain only widget objects.',
  ]) {
    assert.equal(safeFailure(message), invalidCjson, message);
  }
  assert.equal(safeFailure('access_denied'), 'Authorization was declined. You can start again when ready.');
});

test('failure categories never return CLI secrets, paths, or server response details', () => {
  const privateDetails =
    '\naccess_token=never-expose-token refresh_token=never-expose-refresh ' +
    'profile=private-profile host=https://private-store.example path=/private/customer-data';
  for (const [message, expected] of [
    ['Remote container not found.', missingBody],
    ['sfvb.invalid_storefront', unavailableIdentity],
    ['SFVB request failed with HTTP 403', permissionDenied],
    ['Remote file is not a CJSON object.', invalidCjson],
    ['Unrecognized server response.', genericFailure],
    ['invalid_grant', 'This profile needs sign-in. Authorize it in UltraCart, then retry.'],
  ]) {
    assert.equal(safeFailure(message + privateDetails), expected);
  }
});
async function fixture(source: string) {
  const root = await mkdtemp(join(tmpdir(), 'uc-connection-test-'));
  const cliPath = join(root, 'toolkit.mjs');
  await writeFile(cliPath, source);
  const service = new ConnectionService(async () => ({ nodePath: process.execPath, cliPath }));
  return {
    service,
    cleanup: async () => {
      service.dispose();
      await rm(root, { recursive: true, force: true });
    },
  };
}
async function waitUntil(check: () => boolean) {
  for (let i = 0; i < 150; i++) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.fail('state transition timed out');
}
test('device flow stays in memory, rejects concurrent commands, and cancels cleanly', async () => {
  const f = await fixture(`process.stderr.write(${JSON.stringify(challenge)}); setInterval(()=>{},1000);`);
  try {
    const state = await f.service.begin('test-store');
    await waitUntil(() => f.service.loginStatus(state.id).phase === 'waiting');
    await assert.rejects(f.service.storefronts('test-store'), /in progress/);
    const cancelled = f.service.cancel(state.id);
    assert.equal(cancelled.phase, 'cancelled');
    assert.equal(cancelled.code, null);
    assert.equal(cancelled.url, null);
    assert.throws(() => f.service.loginStatus('unknown'), /no longer active/);
  } finally {
    await f.cleanup();
  }
});
test('success requires a valid CLI result and clears the authorization challenge', async () => {
  const f = await fixture(
    `process.stderr.write(${JSON.stringify(challenge)}); setTimeout(()=>{console.log(JSON.stringify({action:'auth.login',identity:{merchantId:'TEST'},accessToken:'not-forwarded'}));},80);`
  );
  try {
    const initial = await f.service.begin('test-store');
    await waitUntil(() => f.service.loginStatus(initial.id).phase === 'succeeded');
    const done = f.service.loginStatus(initial.id);
    assert.equal(done.url, null);
    assert.equal(done.code, null);
    assert.equal(JSON.stringify(done).includes('not-forwarded'), false);
  } finally {
    await f.cleanup();
  }
});
test('process failure becomes a bounded safe UI error', async () => {
  const f = await fixture(
    `process.stderr.write('invalid_grant secret_token=do-not-expose');process.exitCode=1;`
  );
  try {
    await assert.rejects(
      f.service.storefronts('test-store'),
      (error) =>
        error instanceof Error &&
        error.message.includes('needs sign-in') &&
        !error.message.includes('do-not-expose')
    );
  } finally {
    await f.cleanup();
  }
});

test('CLI failures retain their safe category without forwarding raw output', async () => {
  const f = await fixture(
    `process.stderr.write(process.argv[2]); process.stdout.write('\\naccess_token=do-not-expose'); process.exitCode=1;`
  );
  try {
    for (const [message, expected] of [
      ['Remote container not found.', missingBody],
      ['sfvb.invalid_storefront; file /page/body.cjson not found', unavailableIdentity],
      ['SFVB request failed with HTTP 403', permissionDenied],
      ['Remote file is not a CJSON object.', invalidCjson],
      ['SFVB request failed with HTTP 404', genericFailure],
    ]) {
      await assert.rejects(
        f.service.run([message]),
        (error) => error instanceof Error && error.message === expected
      );
    }
  } finally {
    await f.cleanup();
  }
});

test('structured failure output is opt-in for validation and widget lookup', async () => {
  const f = await fixture(
    `const args=process.argv.slice(2); console.log(JSON.stringify({valid:false,diagnostics:[]})); process.exitCode=args.includes('validate')?2:1;`
  );
  try {
    await assert.rejects(f.service.run(['sf', 'locate']), /could not complete/);
    assert.equal(
      JSON.parse(await f.service.run(['sf', 'locate'], { acceptedExitCodes: [0, 1] })).valid,
      false
    );
    assert.equal(JSON.parse(await f.service.validateLocal(join(tmpdir(), 'draft.cjson'))).valid, false);
    await assert.rejects(f.service.validateLocal('relative.cjson'), /absolute/);
  } finally {
    await f.cleanup();
  }
});
