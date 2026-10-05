# Install UltraCart Studio

Get the archive for your computer from [GitHub Releases](https://github.com/ScaleLean/UltraCart-Studio/releases). Each package includes Electron and starts with the local Fieldwork sample. You do not need Node.js for the sample app or ChatGPT sign-in.

| Computer                            | Release asset                               | Start the app             |
| ----------------------------------- | ------------------------------------------- | ------------------------- |
| macOS, Apple Silicon                | `UltraCart-Studio-VERSION-macos-arm64.zip`  | `UltraCart Studio.app`    |
| Windows, x64                        | `UltraCart-Studio-VERSION-windows-x64.zip`  | `UltraCart Studio.exe`    |
| Omarchy or other desktop Linux, x64 | `UltraCart-Studio-VERSION-linux-x64.tar.gz` | `launch-ultracart-studio` |

These are portable builds. They are not developer-signed or notarized. They do not auto-update. Download future releases from the same repository. Keep the entire extracted directory together.

## Verify the download

Download the matching `.sha256` file alongside the archive. The hash detects an incomplete or changed download. It is not a code-signing certificate.

On macOS:

```sh
shasum -a 256 -c UltraCart-Studio-0.2.0-macos-arm64.zip.sha256
```

On Linux:

```sh
sha256sum --check UltraCart-Studio-0.2.0-linux-x64.tar.gz.sha256
```

On Windows, use PowerShell and compare its result with the hash in the `.sha256` file:

```powershell
Get-FileHash .\UltraCart-Studio-0.2.0-windows-x64.zip -Algorithm SHA256
```

## macOS

1. Extract the ZIP.
2. Move `UltraCart Studio.app` to Applications.
3. Open the app. macOS may require approval because this release lacks an identified developer signature. Only approve the copy you downloaded and verified from this repository. Apple documents the per-app approval flow in [Open a Mac app from an unknown developer](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unknown-developer-mh40616/mac).

## Windows

1. Right-click the ZIP and choose **Extract All**.
2. Move the extracted folder to a stable location in your user directory.
3. Open `UltraCart Studio.exe` from that folder.

Do not launch the executable from inside the ZIP or copy it away from its accompanying files. Windows may show a publisher warning for this unsigned build. No administrator permission is needed to use the portable app.

## Omarchy Linux

Extract the archive to a stable directory, then start the included launcher:

```sh
mkdir -p ~/.local/opt
tar -xzf ~/Downloads/UltraCart-Studio-0.2.0-linux-x64.tar.gz -C ~/.local/opt
cd ~/.local/opt/'UltraCart Studio-linux-x64'
./launch-ultracart-studio
```

To add **UltraCart Studio** to the application menu:

```sh
./install-desktop.sh
```

This registers the current directory for your user. It does not move the app or use `sudo`. If you move the directory, run the installer again from its new location. Remove the menu entry by deleting `~/.local/share/applications/ultracart-studio.desktop`.

The launcher selects Electron’s `gnome-libsecret` credential backend. Omarchy’s [base package list](https://github.com/omacom/omarchy/blob/master/install/omarchy-base.packages) includes `gnome-keyring` and `libsecret`. The keyring must be available and unlocked in your desktop session. If Studio reports that secure storage is unavailable, unlock or repair the session keyring and restart the app. Sample editing remains available without an agent connection. Never add `--password-store=basic` or disable the Chromium sandbox to bypass a startup problem.

Linux packages are built on an Ubuntu x64 runner. They use the same bundled Electron Linux runtime on Omarchy. Native worker and SQLite checks run on Linux in CI; Omarchy desktop integration, GPU rendering, OAuth, and keyring access still need verification in a real Omarchy session.

## Credentials and local data

Studio stores data in the normal per-user application data directory:

| Platform | Default directory                                                          |
| -------- | -------------------------------------------------------------------------- |
| macOS    | `~/Library/Application Support/UltraCart Studio`                           |
| Windows  | `%APPDATA%\UltraCart Studio`                                               |
| Linux    | `$XDG_CONFIG_HOME/UltraCart Studio`, normally `~/.config/UltraCart Studio` |

These locations follow Electron’s [application paths](https://www.electronjs.org/docs/latest/api/app#appgetpathname). Closing or replacing the portable app does not remove the stored drafts, conversations, or connections. Back up that directory before changing machines or removing data.

Provider credentials use Electron [safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage). macOS uses Keychain, Windows uses DPAPI, and Linux requires a usable secret store. Windows protection does not isolate credentials from other programs running as the same user. Studio refuses Linux’s `basic_text` fallback. Credentials may not decrypt under a different OS user or on another computer; sign in again instead of transferring encrypted credential files.

## Connect merchant tools

The UltraCart toolkit is separate and is not in these downloads. If you have an authorized installation, set its absolute CLI path and an external Node.js 24 executable under **Settings → Toolkit**. On Windows, choose `node.exe`. Google Cloud CLI and warehouse access are also separate. See the [project README](https://github.com/ScaleLean/UltraCart-Studio#connect-an-ultracart-storefront).

## Build a package yourself

Install Node.js 24, then run these commands from a clean source checkout on the target operating system:

```sh
npm ci
npm run check
npm test
npm run package
npm run package:smoke
```

Archives, checksums, and build metadata appear in `release/`. `npm run package:dir` skips archiving. The smoke check starts the packaged Electron runtime in Node mode, loads the bundled worker, creates a synthetic local project, and reopens its SQLite data. It uses no merchant account. It does not test the full graphical interface or real OAuth.

Maintainers can run the **Desktop release** workflow manually for downloadable CI artifacts. Pushing a `vVERSION` tag that exactly matches `package.json` builds all three native targets and publishes a GitHub release only after all checks pass. A manual workflow run does not publish a release.
