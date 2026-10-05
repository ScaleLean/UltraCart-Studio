# UltraCart Studio

A local desktop workspace for building UltraCart storefronts with a durable agent.

Explore pages, build landing drafts, inspect warehouse data, and review changes in one place. Studio stores drafts, revision history, conversations, and activity on your computer. It uses Electron, React, TypeScript, Pi Durable, and SQLite.

## Try it locally

Desktop packages target **macOS on Apple Silicon, Windows x64, and Linux x64, including Omarchy**. Download a package from [Releases](https://github.com/ScaleLean/UltraCart-Studio/releases) and follow the [installation instructions](docs/install.md). Packages include Electron; merchant tooling remains separate. Development requires **Node.js 24** and npm.

```sh
git clone https://github.com/ScaleLean/UltraCart-Studio.git
cd UltraCart-Studio
npm ci
npm run dev
```

Use the Electron window that opens. The development server binds to `127.0.0.1:5178`; a browser tab does not provide the desktop bridge.

Studio starts with **Fieldwork**, an illustrative sample store. You can explore its catalog, edit page structure and body fields, build landing drafts, compare changes, and restore revisions without an UltraCart account or toolkit installation. Its warehouse demo uses clearly labeled synthetic tables and results.

## What is included

- Searchable page catalog with a tree that handles large storefronts.
- Desktop and mobile previews, a body-field editor, a page structure tree, draft comparison, and revision history.
- Hero, benefits, FAQ, and call-to-action section patterns, with duplicate, move, and remove operations.
- New landing drafts built from a brief, with local previews, revision history, and export.
- A read-only warehouse explorer with schemas, SQL dry runs, bounded query execution, saved queries, and history.
- A content map of resolved templates, shared containers, and editable page slots.
- Native widget-ID reservation with persisted receipts and interrupted-request protection.
- Warehouse result sorting, filtering, CSV/JSON export, numeric summaries, and local charts.
- Agent conversations with streamed output, visible tool results, follow-up queues, steering, and stop controls.
- Conversations pinned to the selected storefront page, landing project, or merchant warehouse.
- Review and preview requirements before a user can publish a real-store draft.
- Local activity history, CJSON export, light and dark themes, and a `Cmd+K` / `Ctrl+K` command palette.

## Connect an agent

Open **Settings**, choose a provider, and select **Sign in**. Complete the ChatGPT sign-in and consent flow in your browser. Studio supports the OpenAI and OpenAI Codex providers through Pi. It stores its own connection; it does not copy another app's credentials or read ambient API keys.

ChatGPT sign-in and an agent edit in the sample store have been tested end to end. Model access depends on the connected account and provider. The sample editor also works without an agent connection.

Studio is a local app, but model requests use the connected provider's network service. Messages and content supplied to the agent, including tool results, are sent to that provider. Studio keeps local copies of drafts and conversations. UltraCart operations and real warehouse queries also use network services.

## Connect an UltraCart storefront

Merchant access requires a separately obtained, authorized installation of the UltraCart storefront agent toolkit. **The toolkit is not included in this repository or in the default app package.** Its availability and license are separate from Studio's MIT license.

1. Open **Settings → Toolkit**.
2. Set **Node 24 executable** to an absolute path to a Node.js 24 executable.
3. Set **UltraCart toolkit entry** to the toolkit's JavaScript CLI entry file.
4. Select **Save preferences**. Select the store name in the sidebar to open the connection panel.
5. Select an existing toolkit profile, or complete the toolkit's device sign-in. Load the available stores and choose one.

The toolkit owns UltraCart authentication. Studio checks the selected merchant and storefront before it uses the connection. It does not require merchant credentials in source files or environment files.

Open **Toolkit reference** in the sidebar for the toolkit's command tree, arguments, options, effects, capabilities, workflows, and skill instructions. The command reference works without a toolkit connection. Skill content is read from your configured external toolkit installation. The bundled command reference documents a versioned CLI snapshot; check your installed CLI's `--help` before using commands from a different version. See the [toolkit guide](docs/toolkit.md).

## Edit existing pages

Open a page and select **Content** to inspect its resolved template, reachable containers, and page-owned slots. Select **Edit slot** to choose a container. Drafts and conversations remain pinned to that slot. The field editor changes text values. The structure tree shows the page's widget hierarchy and supports adding section patterns, duplicating a widget subtree, moving siblings, and removing widgets. A removal is blocked if another widget's configuration references the removed IDs.

New and duplicated widgets receive **local IDs**. Their drafts can be saved, compared, and exported. Remote preview and publishing are blocked while those IDs remain unresolved. Select **Prepare IDs**, inspect the allocation count, and type the storefront host to reserve native UltraCart IDs. Studio keeps existing IDs, saves allocation receipts, and creates a new local revision. An interrupted allocation is not retried automatically. Native allocation has fixture coverage but has not been tested against a live merchant. Existing-widget edits still require review and an applied preview before publishing.

## Build a landing draft

Open the landing section and describe the page title, proposed path, audience, offer, goal, and brand constraints. Studio creates a local starter with hero, benefits, FAQ, and call-to-action sections. Edit the content and structure, ask the agent for changes, and save revisions as you work.

The preview is an approximation of the draft, not the storefront's live theme. **Prepare for storefront** refreshes the catalog, checks the parent and proposed path, loads available templates, and validates authored configuration fields. Choose group and item templates, then use the separate native-ID reservation control when ready. The prepared export includes the brief, chosen templates, checks, allocation receipt, and CJSON. The editable project retains its local IDs.

Creating or exporting a landing draft does not create a live UltraCart page. Before remote creation, refresh the catalog, confirm the parent path and templates, reserve native IDs, and validate the resulting CJSON. Studio does not perform the live page-create operation in this version.

## Explore the data warehouse

Open **Data warehouse** to inspect the selected merchant's curated BigQuery views. Google Cloud CLI sign-in is separate from the UltraCart and ChatGPT connections.

1. Open **Connection** and set the absolute path to the installed `bq` executable.
2. Set the merchant's scan ceiling. The default is 1 GiB per query; the maximum configurable ceiling is 20 GiB. Each query can use a lower cap.
3. Load the table list and inspect a schema before writing SQL. Schema inspection includes nested fields and uses metadata calls, not data queries.
4. Write a supported `SELECT` or `WITH` query and select **Dry run**. Review the estimated scan size and row limit.
5. Select **Run query** to execute explicitly. Studio performs a fresh dry run, then applies BigQuery's native byte ceiling and a maximum of 100 returned rows.

If the CLI fails, open **Connection → Run connection checks**. Studio tests Python/CLI startup, the active CLI account, and metadata access separately. The report provides specific fixes and terminal commands. Signing in again does not repair a Python startup failure. Studio includes common CLI installation folders in its process PATH to support apps launched outside a terminal. The connection checks do not execute SQL.

The project comes from the verified merchant identity. SQL can name only that project's curated `ultracart_dw.uc_*` views. Dry-run receipts must confirm a `SELECT` statement and resolve only to the same project's `ultracart_dw` or `ultracart_dw_streaming` datasets. External queries, custom functions, writes, and unsupported SQL constructs are rejected.

Execution permission expires after five minutes and is valid for one attempt. A changed workspace or connection setting requires another dry run. A lost response is recorded as an unverified completion; Studio does not automatically repeat the query.

Result filtering, sorting, numeric summaries, and charts use the loaded rows only. They do not represent whole-table totals. CSV and JSON exports include displayed rows; CSV protects against spreadsheet formula injection. Recognized page paths link to exact pages in the selected storefront catalog.

Saved queries and history are scoped to the merchant. The agent can help inspect schemas and draft saved SQL, but it has no warehouse execution tool. Select the saved query and use the same dry-run and explicit-run controls to execute it.

The Fieldwork demo supplies three built-in queries with synthetic schemas and result rows. It starts no BigQuery process and reads no merchant data. Custom SQL requires a connected warehouse. Real query execution has automated fixture coverage but has not been verified against a live warehouse in this version.

## Review and publish existing-page changes

Saving creates a local revision. Reviewing validates that revision. A stale editor cannot overwrite a newer agent or user edit. Structure changes and local-ID restrictions remain visible during review.

For a real store, **Preview draft** stages an UltraCart preview. Publishing requires a valid review, an applied preview of the exact revision, and the typed storefront host. The agent has no publish tool.

Studio records a publish attempt before it sends the request and verifies the resulting remote content. If the outcome is uncertain, it blocks a repeat write. Use **Verify publish** to check the result. After a verified publish, **New draft** reads a fresh baseline and retains the local revision history.

Live publishing has not yet been verified end to end. Test it on an authorized non-production storefront before production use. Automated publish tests use fixtures and do not establish live compatibility.

## Durable execution

See the separate [Studio system guide](docs/studio-system.md) for application architecture, connections, and recovery behavior.

Pi Durable runs in a separate Electron utility process. Each conversation has its own SQLite database. If the engine process fails, Studio restarts it and resumes pending work.

Read-only tools can replay after an interruption. Draft writes are marked unsafe to replay, so an uncertain write returns an interruption result instead of running again. Revision checks add protection against stale edits.

Closing the window keeps the app process available. Quitting stops local execution. Reopening resumes pending agent work when its provider is connected. Work does not run while the app or computer is off.

The Pi packages are pinned in `package.json`. See the [Pi source and documentation](https://github.com/earendil-works/pi) for the upstream implementation.

## Local data and isolation

Studio stores data in `~/Library/Application Support/UltraCart Studio` on macOS, `%APPDATA%\UltraCart Studio` on Windows, and `$XDG_CONFIG_HOME/UltraCart Studio` on Linux, normally `~/.config/UltraCart Studio`. This includes drafts, landing projects, cached store content, saved SQL and query history, conversation databases, and encrypted provider credentials. Treat that directory and any exported merchant content as private. These follow Electron's [per-user application paths](https://www.electronjs.org/docs/latest/api/app#appgetpathname).

Set `UC_STUDIO_DATA` to an absolute path to use a different data directory. Use separate directories for independent development and normal app sessions.

The Electron main process encrypts provider credentials with `safeStorage`: Keychain on macOS, DPAPI on Windows, and an available secret store on Linux. Windows protection does not isolate credentials from other programs running as the same user. Studio rejects Linux's insecure `basic_text` fallback. See [Electron's credential storage model](https://www.electronjs.org/docs/latest/api/safe-storage) and the [Omarchy keyring instructions](docs/install.md#omarchy-linux). The React renderer receives connection status and model names, not credentials. Real-store previews run in a separate sandboxed web view with an ephemeral cookie jar, no Studio bridge, denied permission requests, and blocked new windows. Preview access URLs stay out of the renderer.

## Build and verify

```sh
npm run check
npm test
npm run build
npm run package
npm run package:smoke
```

The package command builds for its native operating system and architecture. It creates an app directory plus a versioned ZIP on macOS/Windows or a `.tar.gz` archive on Linux, with SHA-256 files and build metadata in `release/`. It includes Electron and excludes the external UltraCart toolkit and its Node executable. Packages are not developer-signed or notarized. `package:smoke` checks the packaged sample worker and SQLite persistence; it does not verify the full desktop interface, real OAuth, or merchant access.

The **Desktop release** workflow builds and checks all three targets on native runners. Manual runs produce downloadable CI artifacts. A `vVERSION` tag matching `package.json` publishes a release after every native build passes. See [build and installation details](docs/install.md).

Tests cover draft persistence and revisions, page structure, landing projects, stale and cross-page writes, credential persistence, Pi tool execution, recovery after process termination, catalog search, template scope, and preview/publish gates. Warehouse tests cover SQL restrictions, merchant scope, metadata, scan ceilings, expiring execution tickets, uncertain results, and synthetic demos. Model responses, real warehouse responses, and remote writes use fixtures. Automated tests do not query or publish to a live merchant.

## Current scope

- The page builder edits page-owned slot text and structure. Newly added or duplicated widgets keep local IDs until the user reserves native IDs.
- Landing drafts are local projects and export packages. Studio does not create live pages from them.
- A theme may render visible content from other containers. Editing a body field does not guarantee a visible page change.
- Template source shows one file. The content map follows literal includes, including conditional references that may not render. Dynamic includes and item containers are reported as inspection limits.
- Containers are limited to 512 KiB and at most 100 editable fields. Oversized string fields are excluded from editing.
- Validation does not replace visual review. Sample previews are illustrative; real previews require a compatible toolkit and UltraCart access.
- Remote conflicts block publishing. Studio does not automatically merge them.
- Local draft history is not a remote deployment rollback system.
- Warehouse query results are bounded tables, not scheduled reports or an automatic analytics pipeline.
- Heatmaps, asset generation, and general shared-theme editing are outside this version.

## Project layout

- `src/main`: desktop lifecycle, local engine, agent tools, storage, and domain services.
- `src/renderer`: React workspace, previews, editor, settings, and UI components.
- `src/shared`: bridge types and sample store data.
- `tests`: local behavior and recovery tests.
- `scripts`: development, build, and packaging commands.

## License

Studio-owned code is available under the [MIT License](LICENSE). Third-party components and dependencies retain their own licenses. See [Third-party notices](THIRD_PARTY_NOTICES.md).
