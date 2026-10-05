# UltraCart Studio system guide

Application architecture, connections, revision safety, and workflows are documented here. The in-app Toolkit reference describes only the external agent toolkit.

## Start with the right workspace

Choose sample or merchant work, verify scope, and inspect before editing.

### Explore the sample first

The sample workspace works without an UltraCart toolkit or merchant credentials. Its pages, landing projects, and warehouse records are illustrative. Sample SQL is limited to the included demonstrations. It does not measure a merchant’s actual performance.

Use the sample to learn page selection, local changes, review, revision restore, and conversations. A successful sample operation does not verify an external merchant integration.

### Connect the services you need

For merchant content, obtain an authorized toolkit installation and a compatible Node executable. Set their paths in Connection settings, select a toolkit profile, and verify the merchant and storefront. The public Studio package does not include that private toolkit.

Connect ChatGPT separately for agent conversations. Google Cloud CLI sign-in is a third connection used for warehouse work. None of these sign-ins substitutes for the other two.

### Make command scope explicit

The command browser is a static reference. It does not run examples, read installed credentials, or prove that your configured toolkit has this version. Check the installed version and command help before using a terminal.

Use an explicit profile and storefront in scripts. Replace every quoted placeholder with an inspected value. Keep local file paths relative to the terminal’s working directory; --workspace changes manifest selection, not file-path resolution.

```sh
uc-storefront --version
uc-storefront --help
uc-storefront --profile "<profile>" --format json sf storefronts
uc-storefront --profile "<profile>" --format json sf pages get --storefront "<storefront-oid>" --path /example/
```

### Choose the narrowest task

Start from one verified page or one local landing project. State the intended result, which fields can change, and how you will check it. Inspect the content map before assuming that the visible section belongs to body.cjson.

Ask an agent to investigate and propose a draft, then inspect the exact local revision. Separate evidence of a local save, server validation, applied preview, and verified publication. They answer different questions.

## Edit an existing page

Resolve content ownership, keep a baseline, and review the exact revision.

### Resolve the rendered content

A catalog page points to templates. Templates can include shared theme containers, page-owned slots, and widgets that resolve item-owned content. The same template can serve many pages.

Studio’s content map follows literal includes and identifies editable page-owned slots. Dynamic includes, conditional behavior, and item-container rows remain limits. Finding a literal include does not prove that every shopper sees it.

### Pull the correct target

Select the intended page slot in Studio before starting the draft. The conversation and draft remain bound to that page and slot. A missing body means the file or slot can be absent; it is not permission to create a replacement or edit a shared template.

For direct CLI work, sf pull creates a local CJSON file and a .sf.json baseline. Keep them together. The baseline identifies the merchant, destination, previous content, and hash used to detect conflicts. Item, upsell, email, and postcard containers use sf containers instead.

```sh
uc-storefront --profile "<profile>" sf pull /example/body.cjson --storefront "<storefront-oid>" --out example-body.cjson
uc-storefront cjson tree example-body.cjson
```

### Edit locally and preserve identity

Text and structure changes create local revisions. Existing widgets retain their native IDs. New or duplicated widgets use local IDs until you explicitly prepare native IDs. Studio blocks removals when other configuration values still reference the removed IDs.

Use stable widget IDs and schema guidance. Avoid rewriting a whole document to change a single field. Inspect the before/after diff, validate the result, and restore a prior revision if needed.

### Prepare IDs only when needed

Studio reports the number of unresolved local IDs. Prepare IDs requires a deliberate user action and the typed storefront host. It reserves native IDs, retains the allocation receipt, preserves existing IDs, and creates another local revision.

Allocation is a real remote operation, even when no content is published. An interrupted allocation is not retried automatically. The agent has no allocation tool. Native ID allocation currently has fixture coverage rather than live merchant verification.

### Review, preview, and publish

Review checks the exact local revision and remote baseline. For a real store, Preview draft stages temporary content in UltraCart. Publishing needs a valid review, an applied preview of that same revision, and the typed storefront host. A later edit makes the old review or preview insufficient.

Studio records an attempt before a publish request. If the outcome is uncertain, it blocks a repeat write; Verify publish performs readback. After a verified publish, New draft reads a fresh baseline. The agent has no publish tool.

Live publishing has not been verified end to end. Automated fixture tests do not establish live compatibility. Test on an authorized non-production storefront before production use.

## Build a landing draft

Turn a brief into local sections and a prepared handoff.

### Start with a focused brief

Create a landing project with an audience, offer, purpose, and proposed path. Studio creates editable local starter sections. The agent can read the project, update the brief, edit sections, save fields, and check readiness.

The preview is an approximation of the local draft. It does not reproduce every storefront template, asset, runtime script, or conditional branch. Review the content and structure separately from a final merchant render.

### Prepare for the selected storefront

Prepare for storefront refreshes the catalog, checks the parent path and proposed destination, loads available templates, and validates the draft configuration. Select group and item templates that actually exist in the chosen storefront.

Preparation is a read/check step. It does not create the catalog page. Re-check if the merchant, parent, path, templates, or draft changes.

### Reserve and export deliberately

The separate native-ID action reserves IDs only after the user reviews the count and confirms the storefront host. Its receipt belongs to the prepared export; the editable landing project keeps its local IDs.

Export a local handoff containing the brief, selected templates, checks, ID receipt when available, and CJSON. Studio does not create or publish a new landing page in this workflow. A separate authorized operator must review any eventual catalog and body writes.

## Inspect warehouse data

Validate scope, estimate scan size, and execute only after explicit review.

### Separate the three connections

Warehouse access uses the locally configured Google Cloud bq executable and its own account. ChatGPT sign-in enables the agent; UltraCart sign-in verifies merchant/storefront context. Neither grants Google Cloud access.

Studio derives the selected merchant project as ultracart-dw-<lowercase merchant code>. The table browser starts from curated ultracart_dw.uc_* views. Inspect available tables and schemas instead of inventing field names or metrics.

### Draft SQL before estimating it

Studio accepts a restricted read-only SELECT/CTE subset. It rejects writes, external sources, unsupported functions or constructs, and references outside the verified project/datasets. A failed validation is a stop, not permission to bypass the restriction.

The warehouse agent can inspect status, tables, and schema, and save SQL suggestions. It has no query execution tool. Select a saved suggestion and review its SQL yourself.

### Estimate, review, and explicitly run

Studio’s default scan ceiling is 1GiB and its maximum configurable ceiling is 20GiB. Row limits range from 1 to 100. A dry run checks the parsed SQL, BigQuery statement type, resolved references, and estimated bytes before issuing a short-lived review ticket.

A ticket expires after five minutes and permits one execution attempt. Run performs another dry run and uses BigQuery’s maximum-bytes-billed and result limits. Changing workspace or warehouse configuration invalidates the ticket. An uncertain result does not cause an automatic retry.

A row limit does not necessarily limit bytes scanned. Select needed columns and an appropriate time partition before estimating. No scan estimate is an actual cost receipt. Real execution currently has fixture coverage, not live warehouse verification.

### Interpret only the rows you loaded

Studio’s sort, filter, numeric summaries, charts, and exports analyze the loaded result rows locally. They do not calculate totals across the warehouse. Check the loaded count, result cap, query context, and synthetic-demo label before using a number.

Chart axes use existing columns and do not invent aggregation. CSV escapes formula-like text for spreadsheet import; JSON preserves result types. A page link is available only when its path matches the selected storefront’s verified catalog.

### Direct CLI behavior is different

The toolkit warehouse query command performs a dry run and then executes by default. Add --dry-run when you want only validation and a scan estimate. Its default scan cap is 20GiB, and it is not Studio’s expiring-ticket workflow.

Use the exact inspected schema and an explicit merchant or project. Do not paste an agent’s SQL into a direct execution command without reviewing the text, referenced datasets, scan ceiling, and expected output. The example below is deliberately dry-run-only.

```sh
uc-storefront --format json warehouse query "SELECT <verified-columns> FROM ultracart_dw.<verified-view> LIMIT 25" --merchant "<merchant-code>" --max-bytes 1GiB --dry-run
```

## How Studio is built

A local desktop shell with a separate durable agent worker and external service adapters.

### Renderer and trusted application boundary

The React and TypeScript renderer provides the page explorer, builder, landing studio, warehouse, review, and conversations. It calls a narrow preload bridge rather than accessing Node or a shell directly.

Electron’s main process owns trusted application operations. An isolated utility worker runs services and the Pi Durable agent. The interface is not a terminal wrapper: operations have named methods, validated inputs, and workspace scope.

### The durable agent loop

Pi Durable runs conversations with explicit tools. Page, landing, and warehouse conversations have different targets and tool sets. A page conversation pins merchant, storefront, page path, and slot; it cannot silently switch into a different page session.

Warehouse chat stays beside the SQL editor. It can inspect schemas, save SQL, and read the latest completed query result cached for the selected merchant. The cache persists locally until the next successful query replaces it. Result pages include SQL, execution time, local result ID, scan estimate, loaded row count, and row limits. The agent receives at most 20 rows and 24 KiB of row data per call; omitted rows are reported. Cached rows can be sent to the connected model provider during chat. Chat cannot execute a query or dry run. Review saved SQL, use Dry run, then Run before asking the agent to explain the results.

Tool responses and model messages appear in the conversation. The agent can investigate, draft, and save local edits, but Studio keeps publication, native ID allocation, and warehouse execution behind user controls.

### Storage and recovery

Studio stores workspace state, drafts, revisions, landing projects, saved SQL, history, and activity locally in SQLite and associated files. Conversations have durable SQLite state so completed steps can be recovered after interruption.

Credential storage is a separate encrypted file protected with Electron safeStorage. This does not imply that draft, conversation, cache, export, or database content is encrypted. Treat local application data and backups according to their actual content.

### External adapters

The authorized UltraCart toolkit supplies merchant operations. Studio invokes a configured Node executable and CLI path with explicit scope. The private toolkit and its Node executable are not included in the public app package.

The warehouse adapter uses bq. The model adapter uses the chosen cloud provider through Pi. Merchant previews use a sandboxed view with no Studio bridge, denied permission requests, and blocked new windows.

## Authentication and data flow

ChatGPT, UltraCart, and Google Cloud have separate credentials and permissions.

### ChatGPT OAuth

Studio starts its own explicit ChatGPT OAuth connection through Pi. It does not copy another application’s saved login or silently use ambient API-key credentials. Signing in supplies model access for agent conversations, not UltraCart permissions.

The renderer receives connection status and available model names. Provider credentials are stored by the trusted main process with Electron safeStorage. A failed provider login should be resolved in that provider connection, without replacing merchant credentials.

### UltraCart toolkit profile

A toolkit profile chooses the merchant OAuth identity. Direct CLI resolution can use an explicit --profile, an environment selection, a workspace binding, or the current profile. Studio supplies its selected profile explicitly.

Use the connection check to verify the intended merchant and storefront before loading data. auth status only reports local readiness; it is not a live permission check. Logging out of the toolkit does not sign out of ChatGPT.

### Google Cloud identity

The bq CLI uses its own Google Cloud identity and project access. A successful UltraCart sign-in does not prove warehouse permission. Metadata access does not prove that an arbitrary query will pass the scan ceiling, reference checks, or execution permissions.

Keep the selected merchant project and query references visible. A stale workspace or changed configuration must be reviewed again before execution.

### What leaves the computer

Studio is a local application, but agent model requests are sent to the connected provider. Messages and content supplied to the agent, including tool results, can leave the computer. UltraCart requests and real warehouse operations also use network services.

Local drafts, conversation files, query history, replay output, exports, and baselines can contain private content. Do not put them in a public repository. A read-only operation can still retrieve sensitive data. Preview access URLs should also remain private.

## Recovery and revision safety

Know which work can resume and which uncertain operations require inspection.

### Conversation recovery

Durable conversation state retains completed steps across worker interruption. The app restarts the utility worker after a crash and can recover the conversation from local state. The app must be running for work to continue; this is not a hosted always-on service.

A connection error or model limit can still stop progress. Inspect the conversation state and tool result instead of assuming that a request completed because it was sent.

### Replay and local compare-and-swap

Read tools can be replayed safely within their scope. Local edit tools are marked as unsafe to replay blindly and check the expected revision before saving. A stale revision produces a conflict instead of replacing newer work.

Stopping a conversation does not undo completed local saves. Use the revision history to inspect or restore the desired state. A queued follow-up remains a separate instruction, not evidence that the previous operation succeeded.

### Remote uncertainty

A connection can fail after a server accepted a write. Repeating that write can duplicate effects. Studio records publication attempts before sending them and uses a separate readback action when the outcome is uncertain.

Native ID allocations also have persistent receipts and interruption protection. Warehouse review tickets permit a single execution attempt. Do not treat a retry button, new conversation, or direct CLI as a way to bypass an unresolved operation.

### Fresh baselines after remote changes

Every comparison depends on a specific prior state. A remote edit, successful publish, or version restore can invalidate a local pull baseline. Read the current remote state into a new draft before continuing.

A previous review or preview belongs to one exact revision. Keep the evidence attached to that revision rather than inferring approval for later changes.

## What each control guarantees

Separate local edits, remote reads, previews, allocations, and live writes.

### The reference is not an executor

This page contains authored documentation and a static snapshot of registered CLI signatures. It works in sample mode and without the private package. Search, navigation, and Copy do not invoke the CLI.

The snapshot is version 0.1.0-preview.11, recorded 2026-10-05. All registered groups and leaf commands are included, along with flags, positional arguments, parser defaults, and required markers. A different installed version may add or change behavior.

Only parser-declared defaults appear in the default badges. Some commands apply service or runtime defaults described in their usage text. The complete remote resource schema is not reproduced here; inspect the matching read response and installed help before constructing a payload.

### Effects are more useful than flag names

Read means inspection, which can be local or remote. Local write means a file, credential selection, baseline, cache, or workspace state can change. Live/server write means remote content, visibility, routing, settings, or cache can change; some targets are drafts, but the operation remains a server write.

ID allocation consumes native IDs. Preview creates temporary server state and private access. Warehouse execution can scan billable data even when the SQL only reads. Authentication changes which account or credential is used.

Do not classify a command as harmless just because it lacks --live. Container push/revert and page refresh are remote mutations. Direct warehouse query executes unless --dry-run is present.

### Studio and direct CLI have different safeguards

Studio adds merchant/page/slot binding, local revisions, exact-revision review and preview gates, typed-host confirmation, and persistent handling of uncertain publication. The direct CLI does not inherit those user-interface controls.

The CLI provides its own authentication, permission checks, validation, and baseline/hash checks where supported. Its --live flag is acknowledgement, not Studio review. Read the exact command’s behavior and scope before using it outside Studio.

### Current product limits

Studio can edit existing page-owned content, prepare local landing handoffs, and inspect bounded warehouse results. It does not expose every toolkit mutation as an agent tool. General shared-theme editing and creating a live landing page are outside the current Studio workflow.

Native ID allocation, live publishing, and real warehouse execution have automated fixture coverage but have not been verified against a live merchant in this version. A passing test, preview, or dry run must not be reported as a completed live write.

## Diagnose the boundary that failed

Use the failing stage, structured error, and exact target before changing anything.

### Local setup or command mismatch

Confirm the configured Node and CLI paths exist, then inspect the installed version and --help. A missing executable or module is a local setup problem. Do not interpret it as a missing storefront page.

For automation, use --format json. Structured failures include an error code and message; some commands include paths or a warehouse stage. Inspect and redact output before sharing it. --timings separates performance data from normal output.

```sh
uc-storefront --version
uc-storefront --format json catalog info
uc-storefront --format json skills status --check
```

### Identity, permission, or missing content

An identity/storefront not-found error is different from a file/container not-found error. Check the selected profile and verified storefront first. Explicit permission failures require the correct account scope; they do not justify switching to broader credentials without review.

If the page body or slot does not exist, inspect the resolved template and its includes. Do not create body.cjson merely to silence the error. Invalid CJSON is a content/format problem and should be inspected locally.

### Conflict or uncertain result

A hash conflict means the server no longer matches the reviewed baseline. Preserve the local draft, obtain current remote content, and review the difference. Do not replace the conflict guard with an unreviewed hash.

If a publication or allocation outcome is uncertain, inspect the recorded attempt or receipt and use the supported readback flow. A generic network error does not prove that nothing happened.

### Exit codes and evidence

Normal completion and help return zero. Command errors return a nonzero code; invalid arguments and warehouse failures commonly use 2. skills status --check returns 3 for drift. Treat the structured error and command context as the explanation, rather than guessing from the number alone.

Record what was actually checked: local validation, metadata access, a scan estimate, applied preview, or remote readback. Include the selected target and revision while keeping credentials, access URLs, and private content out of shared logs.
