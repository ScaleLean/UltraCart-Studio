# UltraCart Studio

A local desktop workspace for building UltraCart storefronts with a durable agent.

Explore pages, edit structured content, and review changes in one place. Studio stores drafts, revision history, conversations, and activity on your computer. It uses Electron, React, TypeScript, Pi Durable, and SQLite.

## Try it locally

The current desktop target is **macOS on Apple Silicon**. Development requires **Node.js 24** and npm.

```sh
git clone https://github.com/ScaleLean/UltraCart-Studio.git
cd UltraCart-Studio
npm ci
npm run dev
```

Use the Electron window that opens. The development server binds to `127.0.0.1:5178`; a browser tab does not provide the desktop bridge.

Studio starts with **Fieldwork**, an illustrative sample store. You can explore its catalog, edit body fields, compare changes, and restore revisions without an UltraCart account or toolkit installation.

## What is included

- Searchable page catalog with a tree that handles large storefronts.
- Desktop and mobile previews, a body-field editor, draft comparison, and revision history.
- Read-only inspection of a page's resolved theme template.
- Agent conversations with streamed output, visible tool results, follow-up queues, steering, and stop controls.
- Conversations pinned to one merchant, storefront, and page.
- Review and preview requirements before a user can publish a real-store draft.
- Local activity history, CJSON export, light and dark themes, and a `Cmd+K` command palette.

## Connect an agent

Open **Settings**, choose a provider, and select **Sign in**. Complete the ChatGPT sign-in and consent flow in your browser. Studio supports the OpenAI and OpenAI Codex providers through Pi. It stores its own connection; it does not copy another app's credentials or read ambient API keys.

ChatGPT sign-in and an agent edit in the sample store have been tested end to end. Model access depends on the connected account and provider. The sample editor also works without an agent connection.

Studio is a local app, but model requests use the connected provider's network service. Storefront operations also require a network connection. Drafts and conversations remain in the local application data directory.

## Connect an UltraCart storefront

Merchant access requires a separately obtained, authorized installation of the UltraCart storefront agent toolkit. **The toolkit is not included in this repository or in the default app package.** Its availability and license are separate from Studio's MIT license.

1. Open **Settings → Toolkit**.
2. Set **Node 24 executable** to an absolute path to a Node.js 24 executable.
3. Set **UltraCart toolkit entry** to the toolkit's JavaScript CLI entry file.
4. Select **Save preferences**. Select the store name in the sidebar to open the connection panel.
5. Select an existing toolkit profile, or complete the toolkit's device sign-in. Load the available stores and choose one.

The toolkit owns UltraCart authentication. Studio checks the selected merchant and storefront before it uses the connection. It does not require merchant credentials in source files or environment files.

## Review and publish

The editor changes existing string fields in page-body CJSON. Saving creates a local revision. Reviewing validates that revision. A stale editor cannot overwrite a newer agent or user edit.

For a real store, **Preview draft** stages an UltraCart preview. Publishing requires a valid review, an applied preview of the exact revision, and the typed storefront host. The agent has no publish tool.

Studio records a publish attempt before it sends the request and verifies the resulting remote content. If the outcome is uncertain, it blocks a repeat write. Use **Verify publish** to check the result. After a verified publish, **New draft** reads a fresh baseline and retains the local revision history.

Live publishing has not yet been verified end to end. Test it on an authorized non-production storefront before production use. Automated publish tests use fixtures and do not establish live compatibility.

## Durable execution

Pi Durable runs in a separate Electron utility process. Each conversation has its own SQLite database. If the engine process fails, Studio restarts it and resumes pending work.

Read-only tools can replay after an interruption. Draft writes are marked unsafe to replay, so an uncertain write returns an interruption result instead of running again. Revision checks add protection against stale edits.

Closing the window keeps the app process available. Quitting stops local execution. Reopening resumes pending agent work when its provider is connected. Work does not run while the app or computer is off.

The Pi packages are pinned in `package.json`. See the [Pi source and documentation](https://github.com/earendil-works/pi) for the upstream implementation.

## Local data and isolation

On macOS, Studio stores its data in `~/Library/Application Support/UltraCart Studio`. This includes drafts, cached store content, conversation databases, and encrypted provider credentials. Treat that directory as private.

Set `UC_STUDIO_DATA` to an absolute path to use a different data directory. Use separate directories for independent development and normal app sessions.

The Electron main process encrypts provider credentials with `safeStorage`. The React renderer receives connection status and model names, not credentials. Real-store previews run in a separate sandboxed web view with an ephemeral cookie jar, no Studio bridge, denied permission requests, and blocked new windows. Preview access URLs stay out of the renderer.

## Build and verify

```sh
npm run check
npm test
npm run build
npm run package
```

The package command creates `release/UltraCart Studio-darwin-arm64/UltraCart Studio.app`. The app package includes its Electron runtime. It does not include the external UltraCart toolkit or its Node executable. Local packages are not signed or notarized.

Tests cover draft persistence and revisions, stale and cross-page writes, credential persistence, Pi tool execution, recovery after process termination, catalog search, template scope, and preview/publish gates. Model responses and remote writes use fixtures. No automated test publishes to a live merchant.

## Current scope

- The editor changes existing body string fields. It does not add widgets or modify shared theme code.
- A theme may render visible content from other containers. Editing a body field does not guarantee a visible page change.
- Template inspection shows the resolved source file; it does not expand included files.
- Containers are limited to 512 KiB and at most 100 editable fields. Oversized string fields are excluded from editing.
- Validation does not replace visual review. Sample previews are illustrative; real previews require a compatible toolkit and UltraCart access.
- Remote conflicts block publishing. Studio does not automatically merge them.
- Local draft history is not a remote deployment rollback system.
- Warehouse reports, heatmaps, asset generation, and general theme editing are outside this version.

## Project layout

- `src/main`: desktop lifecycle, local engine, agent tools, storage, and domain services.
- `src/renderer`: React workspace, previews, editor, settings, and UI components.
- `src/shared`: bridge types and sample store data.
- `tests`: local behavior and recovery tests.
- `scripts`: development, build, and packaging commands.

## License

Studio-owned code is available under the [MIT License](LICENSE). Third-party components and dependencies retain their own licenses. See [Third-party notices](THIRD_PARTY_NOTICES.md).
