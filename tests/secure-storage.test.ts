import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSecureCredentialStorage } from '../src/main/secure-storage';

test('Linux credentials require a real desktop keyring even when encryption reports available', () => {
  for (const backend of ['basic_text', 'unknown', ''])
    assert.throws(
      () =>
        assertSecureCredentialStorage(
          { isEncryptionAvailable: () => true, getSelectedStorageBackend: () => backend },
          'linux'
        ),
      /secure Linux keyring/
    );
  for (const backend of ['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6'])
    assert.doesNotThrow(() =>
      assertSecureCredentialStorage(
        { isEncryptionAvailable: () => true, getSelectedStorageBackend: () => backend },
        'linux'
      )
    );
});
test('macOS and Windows do not call the Linux-only backend method', () => {
  for (const platform of ['darwin', 'win32'] as const) {
    assert.doesNotThrow(() =>
      assertSecureCredentialStorage(
        {
          isEncryptionAvailable: () => true,
          getSelectedStorageBackend: () => {
            throw new Error('Linux-only API');
          },
        },
        platform
      )
    );
    assert.throws(
      () =>
        assertSecureCredentialStorage(
          { isEncryptionAvailable: () => false, getSelectedStorageBackend: () => '' },
          platform
        ),
      /Unlock/
    );
  }
});
