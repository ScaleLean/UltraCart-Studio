type Storage = {
  isEncryptionAvailable(): boolean;
  getSelectedStorageBackend(): string;
};

export function assertSecureCredentialStorage(
  storage: Storage,
  platform: NodeJS.Platform = process.platform
) {
  if (!storage.isEncryptionAvailable())
    throw new Error(
      platform === 'linux'
        ? 'Secure credential storage is unavailable. Start and unlock your desktop keyring, then restart Studio. Local drafts and the sample workspace remain available.'
        : 'Secure credential storage is unavailable. Unlock your operating system credential store, then restart Studio.'
    );
  if (
    platform === 'linux' &&
    !['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6'].includes(storage.getSelectedStorageBackend())
  )
    throw new Error(
      'Studio cannot save agent credentials without a secure Linux keyring. Enable and unlock GNOME Keyring or KWallet, then restart Studio. Local drafts and the sample workspace remain available.'
    );
}
