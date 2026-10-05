# UltraCart agent toolkit reference

Interface snapshot: **@ultracart/storefront-agent-toolchain 0.1.0-preview.11**, recorded 2026-10-05.

The in-app **Toolkit reference** has three sections: Commands, Capabilities, and Skills. This document contains the authored command and capability reference. Application architecture and workflows are documented separately in [the system guide](studio-system.md).

The snapshot includes 155 leaf commands and 38 groups, including the root interface. Signatures, parser defaults, and required flags were checked against the installed command registration. Descriptions are authored for this reference. Private package source, proprietary skill text, credentials, and merchant data are not bundled.

The Skills tab reads SKILL.md and supporting text documents from the configured external toolkit at runtime. It supports a searchable inventory, full Markdown reading, raw Source view, text search, and local reference links. It does not execute instructions. Embedded HTML, external links, and remote images are not loaded. An unavailable installation produces a Configure toolkit prompt; the static command and capability reference remains usable.

A configured external toolkit can differ from this snapshot. Use its local `uc-storefront --version` and `<command> --help` to confirm behavior. Every example placeholder must be replaced with an inspected value before use.

The authored reference data is in [toolkit-reference.ts](../src/shared/toolkit-reference.ts); the [reference component](../src/renderer/components/toolkit-reference.tsx) renders it.

## Capabilities

### Toolkit capabilities

What the CLI can inspect, author, preview, and change.

#### Inspect and author local widget documents

The toolkit provides a normalized widget catalog, schemas, placement rules, element documentation, guides, and recipes. CJSON commands inspect widget trees and make atomic local edits. They do not need merchant access for ordinary local authoring.

Local validation checks structure and catalog rules. It does not prove that a live server accepts the change or that the storefront renders as intended. The server element vocabulary can differ from the separately released local catalog.

Related commands: `catalog info`, `catalog verify`, `schema list`, `schema show`, `element docs`, `guide search`, `cjson validate`.

#### Work with remote storefront resources

The sf command family uses a selected UltraCart merchant profile. It reads pages, templates, files, menus, item content, owner containers, blog posts, upsells, experiments, render logs, and recording information. Dedicated mutations exist for supported resources.

Some writes affect shared live content even when a dormant theme is selected. Classify the resource and effect first. A missing --live flag does not imply a read-only command.

Related commands: `sf storefronts`, `sf pages get`, `sf containers push`, `sf pages refresh`.

#### Preview, allocate, and query deliberately

Preview commands create temporary substitutions and access links. Native widget IDs are reserved by a separate real allocation. Neither is equivalent to reading metadata.

Warehouse query performs a BigQuery dry run and executes by default after its checks. Use --dry-run when you only want an estimate. The scan cap and resolved-dataset boundary belong to the toolkit query wrapper.

Related commands: `sf preview start`, `sf preview stage`, `sf ids`, `warehouse query`.

#### Use the interface snapshot and installed skills

This command reference includes every registered group, leaf command, positional argument, and flag in the recorded package version. Default badges show parser defaults; command descriptions also explain applicable runtime defaults. It is not a copy of the package source or its private documentation.

A different installed version can have different behavior. Check its --version and command --help. The Skills tab reads instructions from the configured external toolkit at runtime; it neither installs skills nor executes their instructions.

Related commands: `Global options`, `skills status`, `skills install`.

### Profiles and workspace setup

Select the merchant explicitly and keep local paths predictable.

#### Confirm the installed executable

The package executable is uc-storefront and the recorded version requires Node 24 or later. Obtain the package through an authorized distribution. This reference does not grant a package license or install it.

Inspect the version and help before relying on a command. Examples use quoted placeholders; replace them with inspected values. Copying a command from this page does not run it.

```sh
uc-storefront --version
uc-storefront --help
uc-storefront --format json catalog info
```

Related commands: `Global options`, `catalog info`.

#### Choose and verify a profile

A profile identifies the toolkit’s UltraCart authorization connection. Use profile list/show to inspect metadata, auth login to establish access, and auth status for local readiness. Local readiness alone does not prove current merchant permission.

The CLI resolves an explicit --profile, then its supported environment/workspace/current-profile selection. In automation, pass the intended profile and storefront explicitly rather than depending on a mutable default.

```sh
uc-storefront profile list
uc-storefront --profile "<profile>" auth status
uc-storefront --profile "<profile>" --format json sf storefronts
```

Related commands: `profile show`, `profile use`, `auth login`, `auth status`, `sf storefronts`.

#### Bind a workspace

workspace init creates or updates ultracart.json and selected agent skill integrations. profile bind pins a workspace to a profile and can record the expected merchant identity. Use --dry-run and --no-input with explicit targets for a repeatable setup.

The global --workspace chooses the exact manifest directory. It does not change how relative file arguments resolve: those remain relative to the current working directory. Root init initializes a workspace; cjson init creates a widget document.

Related commands: `workspace init`, `profile bind`, `profile unbind`, `cjson init`.

#### Keep authorization teardown explicit

auth logout revokes the selected profile’s refresh token and removes its credential. profile remove also tears down the credential and removes local profile metadata. Unbind a workspace before removing the profile it uses.

Merchant content, pull baselines, query audits, replay files, and preview access URLs can contain private information. Exclude them from public source control and share only the material needed for an authorized task.

Related commands: `auth logout`, `profile remove`.

### Work with CJSON and recipes

Inspect schemas, use stable selectors, and apply small local changes.

#### Discover supported widgets

The normalized catalog provides widget types, configuration keys, placement rules, documentation, and guides. Use schema list, schema show, schema children, and schema parents before creating an unfamiliar structure.

Element documentation and guide searches can return bounded packets for an agent. Start with a small budget and a specific intent. A broad --full response can contain much more content than the task needs.

Related commands: `catalog info`, `catalog verify`, `schema list`, `schema show`, `schema children`, `schema parents`, `element explain`, `element docs`, `guide search`.

#### Inspect a stable selection

Use cjson tree to find IDs and canonical paths. Inspect a selected widget, then request authoring context for the types and intent you need. Paths can change after insertion or reordering, so prefer the widget’s ID when possible.

Global --format json makes structured output easier to consume. The root-level tree, inspect, context, find, validate, apply, add, update, remove, and move commands are legacy aliases; prefer the cjson namespace.

```sh
uc-storefront --format json cjson tree example-body.cjson
uc-storefront --format json cjson inspect example-body.cjson "<widget-id>" --depth 1
uc-storefront --format json cjson context example-body.cjson "<widget-id>" --authoring --intent "Adjust the heading without changing layout"
```

Related commands: `cjson tree`, `cjson inspect`, `cjson context`, `cjson find`.

#### Patch a field or apply an edit plan

CJSON mutations update a local file atomically. --dry-run exposes the proposal without writing it. Use the installed help for the versioned plan format and inspect every operation before cjson apply.

Update uses JSON Pointer assignments. Escape a literal tilde as ~0 and a literal slash as ~1 in a pointer segment. --set with an empty right-hand side writes an empty string; --unset removes the key. Confirm the actual key in the widget schema before either operation.

--allow-invalid permits an invalid local result. It does not make that result acceptable to the server. A clean cjson validate result also does not prove push compatibility or visual correctness.

```sh
uc-storefront --format json cjson update example-body.cjson "<widget-id>" --set "/config/<verified-key>=Example text" --dry-run --full
uc-storefront --format json cjson validate example-body.cjson
```

Related commands: `cjson update`, `cjson add`, `cjson move`, `cjson remove`, `cjson apply`, `cjson validate`.

#### Reuse patterns without reusing native IDs

Recipes describe reusable widget structures and parameters. Capture saves a selected local subtree. Inspect captured content before sharing it because embedded code, tracking references, URLs, or text can belong to a merchant.

Instantiation accepts explicit reserved IDs and produces an edit plan. It does not reserve IDs or write the CJSON document. Supply exactly the recipe’s widget count in a JSON ID array or JSON allocation receipt, review the emitted plan, and then apply it.

Related commands: `recipe list`, `recipe example`, `recipe capture`, `recipe instantiate`, `sf ids`, `cjson apply`.

### Locate the right content

Resolve template ownership before choosing a file or owner row.

#### Start from the catalog page

Read the exact page path, then resolve its assigned group or item template through the selected theme’s resource paths. A template can serve many pages, so a shared include is a broader change than a page-owned slot.

Use sf locate to trace literal includes and widget targets. It can include conditional branches that are not visible for every shopper. Dynamic includes and unsearched regions remain limits; a successful match is not proof of visible output.

Related commands: `sf pages get`, `sf template find`, `sf template resolve`, `sf locate`.

#### Distinguish a path from a container owner

Theme and page containers are filesystem CJSON files. Use sf pull and sf push with their exact absolute paths. A page can render a theme container or another named slot without having body.cjson.

Item, upsell, email, and postcard containers are rows addressed with sf containers. item and upsell use an OID; itemid uses the merchant item ID; email and postcard types use an ESP UUID. Only item/itemid containers have named slots. A numeric merchant item ID is still not an item OID.

Related commands: `sf files list`, `sf pull`, `sf containers list`, `sf containers pull`.

#### Choose bounded reads

Use page filters, offsets, maximum-result limits, and exact paths when exploring a large storefront. --search-theme deliberately broadens sf locate to additional theme containers and can perform many reads.

A missing file or slot does not authorize creating a replacement. Inspect the resolved template and content source before deciding which resource should change.

Related commands: `sf pages list`, `sf files get`, `sf locate`.

### Pull, edit, validate, and push

Maintain baselines and IDs while reviewing each remote mutation.

#### Save a fresh baseline

sf pull writes a new local CJSON file and its .sf.json baseline. Keep the baseline beside the document; it records the source identity, destination, previous content, and conflict hash. The remote file must already exist.

Menus and owner containers have their own pull/push interfaces and comparison state. Select the exact resource before choosing an editing command.

```sh
uc-storefront --profile "<profile>" sf pull /example/body.cjson --storefront "<storefront-oid>" --out example-body.cjson
uc-storefront cjson tree example-body.cjson
```

Related commands: `sf pull`, `sf menus pull`, `sf containers pull`.

#### Make the smallest local edit

Inspect the relevant widget and schema. Preserve native IDs on existing widgets. Use cjson update for field changes or a reviewed cjson apply plan for multiple operations; use --dry-run first to inspect the proposal.

New widgets require appropriate native IDs before remote use. sf ids reserves them immediately. Counts above 100 are split into requests. Retain the allocation receipt and do not blindly repeat an uncertain request.

Related commands: `cjson context`, `cjson update`, `cjson apply`, `cjson validate`, `sf ids`.

#### Review live scope and conflict checks

A page-container body is shared across themes. --theme provides compilation context; it does not turn that body into isolated draft content. --live acknowledges a write where required, but does not itself perform a review or preview.

Existing CJSON pushes compare against the pull baseline and current remote hash. Do not substitute an unreviewed hash after a conflict. --allow-removals acknowledges removed widget IDs; --allow-unknown-config-keys changes diagnostics and should not replace schema inspection.

Related commands: `sf push`, `sf files versions`, `sf containers versions`.

#### Handle uncertain and restored state

A connection can fail after a server accepts a write. Inspect the current remote state before deciding whether another write is safe. A generic network error is not evidence that nothing happened.

A restore is another remote write and can make earlier local baselines stale. Read the restored content into a new local file before further edits. Some running experiments prevent changes to their page bodies.

Related commands: `sf files revert`, `sf files get`, `sf containers revert`, `sf pull`.

### Preview without publishing

Stage the full desired set and inspect the correct theme and page context.

#### Understand temporary preview state

A toolkit preview session lasts eight hours. Staging provides temporary substitutes for theme files, page containers, item containers, or upsell pages. It does not persist a storefront edit.

A preview session uses one theme. Theme-file targets can determine that theme; otherwise use the explicit theme or active theme. Page-owned and item-owned content remain shared live data when eventually published.

Related commands: `sf preview start`, `sf preview stage`.

#### Stage every file that must remain

Each stage call replaces the entire staged set. It is not an incremental add operation. Include all desired --file, --item, and --upsell values in the replacement.

Use exact server paths and baseline-backed owner files. A preview can display a page-container file that does not yet exist remotely, but this does not authorize creating it or prove that a later live write will succeed.

```sh
uc-storefront --profile "<profile>" sf preview stage --storefront "<storefront-oid>" --session "<preview-session>" --theme "<theme-oid>" --file "example-body.cjson=/example/body.cjson"
```

Related commands: `sf preview stage`, `sf containers pull`.

#### Inspect and close

Opening returns a single-use access URL. Treat it as private. Inspect the intended theme and page path in the browser opened for the preview. Temporary preview state does not create an authorization for a later write.

Check the actual page context, layout, text, links, and responsive behavior. End the temporary session when finished. A screenshot or successful render is not proof of publication.

Related commands: `sf preview open`, `sf preview end`, `sf render`.

### Use the wider toolkit

Choose the correct interface for assets, shared data, experiments, and diagnostics.

#### File paths and owner containers differ

Theme and page CJSON live at filesystem paths and use sf pull/push. Item, upsell, email, and postcard containers are owner rows and use sf containers. Itemid means merchant item ID; item means item OID. The numeric appearance of an ID does not make them interchangeable.

Container push has no --live option but still writes remote content. With --create --remap-ids it also allocates IDs. Version restore changes the server and leaves any previous local editing baseline stale.

Related commands: `sf files list`, `sf pull`, `sf containers list`, `sf containers pull`, `sf containers push`, `sf containers revert`.

#### Treat shared content as a broad change

Menus, site attributes, item content, page assignments, upsell paths, and some theme settings are shared resources. A draft theme does not isolate shared page or item data. Read the current object, inspect the requested fields, and authorize the exact write.

Template wire/unwire/move edits literal includes in a template that may serve many pages. Use the reviewed hash and dry-run. File put accepts JSON and plain CSS; use dedicated CJSON and binary-upload commands for other supported content.

Related commands: `sf menus push`, `sf site attributes`, `sf items content`, `sf theme-attributes set`, `sf template wire`, `sf files put`, `sf files upload`.

#### Separate assignments from deletion

Removing an item or post from a page changes its assignment; it does not delete that item or post. sf blog-posts delete permanently removes the post and its assignments. Inspect the exact operation before treating a remove action as reversible.

Upsell duplication, archive, disable, and move have different effects on eligibility and order. Experiments control shopper traffic; pause/resume operate on a selected variation, and end requires a deliberate winner decision.

Related commands: `sf pages items remove`, `sf pages blog-posts remove`, `sf blog-posts delete`, `sf upsells paths move`, `sf upsells paths duplicate`, `sf experiments pause`, `sf experiments end`.

#### Read diagnostics with bounded scope

Render logs help identify template or runtime errors. Start with a recent window, an exact URI filter, and a small result limit. Refresh is cache invalidation, which is a remote mutation even though it is not a content edit.

Recordings may contain shopper information. Rendering them downloads events and writes local files; --show-input can reveal entered text. Enable recording only for an explicit authorized task and scope replay output to the needed page views.

Related commands: `sf logs list`, `sf logs get`, `sf pages refresh`, `sf recordings show`, `sf recordings render`, `sf recordings enable`.

### Bounded warehouse queries

Use your own bq identity, inspect the estimate, and keep references inside the granted datasets.

#### Select the project and identity

The toolkit invokes your installed bq CLI under its Google Cloud identity. UltraCart OAuth is a separate connection and does not grant Google Cloud access. Use an explicit merchant code or project for the intended warehouse.

--merchant resolves the ultracart-dw-<lowercase code> convention. --project supports a warehouse with a different project identifier. Read schemas before choosing columns or metrics.

Related commands: `warehouse query`.

#### Understand the dry run

The wrapper first asks BigQuery to validate the SQL and estimate its scan. It checks the estimated bytes and resolved table references against its permitted datasets. A curated ultracart_dw view can resolve to ultracart_dw_streaming tables, so resolved references matter.

The CLI executes after those checks by default. Add --dry-run to stop after validation and estimation. This still contacts BigQuery; it is not offline SQL parsing.

```sh
uc-storefront --format json warehouse query "SELECT <verified-columns> FROM ultracart_dw.<verified-view> LIMIT 25" --merchant "<merchant-code>" --max-bytes 1GiB --dry-run
```

Related commands: `warehouse query`.

#### Constrain scans and inspect failures

The default scan ceiling is 20GiB. Set a smaller explicit --max-bytes when appropriate, select only necessary columns, and use the relevant partition filters. A LIMIT clause does not necessarily reduce bytes scanned.

--parameter passes typed named query values to bq. --audit-log appends query text, project, scan estimate, resolved tables, and execution metadata without result rows. The SQL itself can still contain private information. Keep audit files scoped and private.

An error response can include the warehouse failure stage and BigQuery’s diagnostic. An estimate is not a receipt for completed execution or actual cost. Do not invent results from a successful dry run.

Related commands: `warehouse query`.

### Toolkit skills and integrations

Review packaged instructions and manage their local agent copies.

#### Read the installed instruction set

The Skills tab lists skills under the configured external toolkit installation and reads the selected SKILL.md at runtime. Its text comes from that installation, not from the bundled command snapshot. It can differ with package version.

This is a document viewer. It does not run commands, install a skill, follow its instructions, or grant authority for merchant actions. Embedded HTML, remote images, and external navigation are not enabled in the viewer.

#### Install workspace integrations deliberately

workspace init and skills install can copy the toolkit’s supported integrations into a local workspace. Choose codex, claude, gemini, or all explicitly. --no-input prevents prompts; --dry-run reports proposed changes before they are written.

--allow-downgrade explicitly permits an older toolkit to replace newer skill copies it owns. Avoid using it to resolve unexplained version drift.

Related commands: `workspace init`, `skills install`.

#### Inspect drift and remove owned copies

skills status compares local skill integrations with the package’s expected state. With --check it returns exit code 3 for drift. A status check does not authorize a repair.

skills remove removes the selected toolkit-owned integrations from the workspace. It does not remove arbitrary personal agent skills or change merchant credentials. Review the dry-run output first.

Related commands: `skills status`, `skills remove`.

### CLI diagnostics and output

Use the failing stage, exact resource, and structured response.

#### Confirm syntax and output format

Use the installed version and command help before relying on a remembered flag. --format json is the interface for structured results. Failures include an error code and message, sometimes paths or a warehouse stage.

--timings writes phase timing data to standard error separately from command output. Error messages and normal output can still contain merchant content, resource paths, or SQL. Review and redact before sharing them.

```sh
uc-storefront --version
uc-storefront --format json catalog info
uc-storefront --format json skills status --check
```

Related commands: `Global options`, `catalog info`, `skills status`.

#### Identify the failing boundary

A missing executable or module is a local setup error. A missing profile or permission is an identity/access issue. A missing page body or owner slot is a content-address issue. These have different fixes.

Read the selected profile metadata and exact storefront; then inspect the template or container identity. Do not use broader credentials, create a new body, or change a different path merely to suppress an error.

Related commands: `profile show`, `auth status`, `sf storefronts`, `sf template find`, `sf containers list`.

#### Interpret exit codes with context

Normal completion and help return zero. Failures use nonzero codes; invalid arguments and warehouse errors commonly use 2. skills status --check returns 3 for drift. Read the structured diagnostic instead of guessing solely from the number.

Separate what each check proves: local schema validation, remote metadata access, a dry-run estimate, a temporary render, or remote content readback. None automatically proves the others.

Related commands: `cjson validate`, `sf render`, `sf files get`.

## Command effects

| Effect              | Meaning                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Read                | Inspects data or emits a report. Network reads can retrieve private merchant content.                                                  |
| Local write         | Can change local files, metadata, drafts, or credentials. This does not itself publish storefront content.                             |
| Live / server write | Changes server resources, storefront behavior, or shared content. Some commands can target drafts; inspect the exact target and flags. |
| ID allocation       | Reserves real server widget IDs. Allocation is a remote mutation even when the page has not been published.                            |
| Preview session     | Creates or changes temporary server preview state or access links. It does not publish the staged content.                             |
| Warehouse execution | Can run a billed BigQuery data query. Add --dry-run to stop after validation and the scan estimate.                                    |
| Authentication      | Creates, refreshes, or revokes an authorization connection. It is separate from storefront content editing.                            |

## Complete command reference

Global options apply to each command. `--help` is available at every command level. Required markers below reflect the command parser; cross-option rules such as exactly one item identity are described in the usage notes. Default values listed here are parser-declared defaults, not every server/runtime default.

### uc-storefront (root)

Command-line interface for local CJSON authoring, merchant resources, previews, and warehouse reads.

```text
uc-storefront <command> [options]
```

Children: `profile`, `auth`, `sf`, `schema`, `catalog`, `element`, `guide`, `cjson`, `tree`, `inspect`, `context`, `find`, `validate`, `apply`, `add`, `update`, `remove`, `move`, `warehouse`, `recipe`, `workspace`, `init`, `skills`.

| Input                       | Required | Default | Usage                                                                                                                              |
| --------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `-V, --version`             | No       |         | Print the installed toolkit version and exit.                                                                                      |
| `--workspace <directory>`   | No       |         | Select the directory containing ultracart.json. Relative file arguments still use the current working directory.                   |
| `--timings`                 | No       |         | Write phase timings to standard error, separately from normal command output.                                                      |
| `--catalog-dir <directory>` | No       |         | Use a different normalized widget catalog. This changes the local schema and documentation source.                                 |
| `--bundle-dir <directory>`  | No       |         | Select a legacy raw builder bundle for catalog importer development.                                                               |
| `--profile <name-or-uuid>`  | No       |         | Select a merchant profile explicitly. Otherwise the CLI can use its environment, workspace binding, or current profile.            |
| `--format <format>`         | No       | "text"  | Choose human-readable text or machine-readable JSON. Prefer JSON when another program consumes the result. Values: `text`, `json`. |

### profile

Choose and maintain merchant profiles and workspace bindings.

```text
uc-storefront profile <command>
```

Children: `profile list`, `profile create`, `profile show`, `profile use`, `profile rename`, `profile remove`, `profile bind`, `profile unbind`.

### profile list

List local profile identities without printing tokens.

```text
uc-storefront profile list
```

Effects: Read. Local interface.

### profile create

Create a named local merchant profile.

```text
uc-storefront profile create <name> [options]
```

Effects: Local write. Local interface.

| Input                 | Required | Default | Usage                                                                       |
| --------------------- | -------- | ------- | --------------------------------------------------------------------------- |
| `<name>`              | Yes      |         | New local merchant-profile name.                                            |
| `--registration <id>` | No       |         | Choose a trusted OAuth application registration by its manifest identifier. |

### profile show

Inspect the selected profile and how it was selected.

```text
uc-storefront profile show [name-or-uuid]
```

Effects: Read. Local interface.

| Input            | Required | Default | Usage                                                                                         |
| ---------------- | -------- | ------- | --------------------------------------------------------------------------------------------- |
| `[name-or-uuid]` | No       |         | Profile name or persistent profile UUID. The optional form uses the resolved current profile. |

### profile use

Change the default profile for later CLI commands.

```text
uc-storefront profile use <name-or-uuid>
```

Effects: Local write. Local interface.

| Input            | Required | Default | Usage                                                                                         |
| ---------------- | -------- | ------- | --------------------------------------------------------------------------------------------- |
| `<name-or-uuid>` | Yes      |         | Profile name or persistent profile UUID. The optional form uses the resolved current profile. |

### profile rename

Change a profile name while retaining its identity.

```text
uc-storefront profile rename <name-or-uuid> <new-name>
```

Effects: Local write. Local interface.

| Input            | Required | Default | Usage                                                                                         |
| ---------------- | -------- | ------- | --------------------------------------------------------------------------------------------- |
| `<name-or-uuid>` | Yes      |         | Profile name or persistent profile UUID. The optional form uses the resolved current profile. |
| `<new-name>`     | Yes      |         | Replacement local profile name.                                                               |

### profile remove

Delete a local profile and its stored credentials.

```text
uc-storefront profile remove <name-or-uuid>
```

Effects: Authentication, Local write. Uses a remote service.

Removal tears down the profile credential, including a remote revocation attempt. Unbind the current workspace first if it points to this profile.

| Input            | Required | Default | Usage                                                                                         |
| ---------------- | -------- | ------- | --------------------------------------------------------------------------------------------- |
| `<name-or-uuid>` | Yes      |         | Profile name or persistent profile UUID. The optional form uses the resolved current profile. |

### profile bind

Pin a workspace to a profile and optionally an expected merchant.

```text
uc-storefront profile bind <name-or-uuid> [options]
```

Effects: Local write. Local interface.

| Input                         | Required | Default | Usage                                                                                         |
| ----------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------- |
| `<name-or-uuid>`              | Yes      |         | Profile name or persistent profile UUID. The optional form uses the resolved current profile. |
| `--directory <directory>`     | No       |         | Select the workspace directory whose profile binding will change.                             |
| `--merchant-id <merchant-id>` | No       |         | Record the expected merchant identity in the workspace binding.                               |

### profile unbind

Remove a workspace profile binding.

```text
uc-storefront profile unbind [options]
```

Effects: Local write. Local interface.

| Input                     | Required | Default | Usage                                                             |
| ------------------------- | -------- | ------- | ----------------------------------------------------------------- |
| `--directory <directory>` | No       |         | Select the workspace directory whose profile binding will change. |

### auth

Manage the toolkit’s UltraCart authorization connection.

```text
uc-storefront auth <command>
```

Children: `auth login`, `auth status`, `auth logout`.

### auth login

Start the UltraCart device authorization flow for a profile.

```text
uc-storefront auth login [options]
```

Effects: Authentication, Local write. Uses a remote service.

| Input                      | Required | Default | Usage                                                                                                                   |
| -------------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `--profile <name-or-uuid>` | No       |         | Select a merchant profile explicitly. Otherwise the CLI can use its environment, workspace binding, or current profile. |
| `--registration <id>`      | No       |         | Choose a trusted OAuth application registration by its manifest identifier.                                             |

### auth status

Read a redacted local authorization readiness report.

```text
uc-storefront auth status
```

Effects: Read. Local interface.

This inspects local credential readiness. It does not prove that the profile has current merchant access.

### auth logout

Revoke the profile’s refresh token and clear its credential.

```text
uc-storefront auth logout [options]
```

Effects: Authentication, Local write. Uses a remote service.

This revokes the selected UltraCart profile credential. Other service credentials are separate.

| Input                      | Required | Default | Usage                                                                                                                   |
| -------------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `--profile <name-or-uuid>` | No       |         | Select a merchant profile explicitly. Otherwise the CLI can use its environment, workspace binding, or current profile. |

### sf

Inspect and change remote StoreFront resources.

```text
uc-storefront sf <command>
```

Children: `sf sizes`, `sf surveys`, `sf ids`, `sf storefronts`, `sf themes`, `sf elements`, `sf pages`, `sf site`, `sf theme-attributes`, `sf items`, `sf upsells`, `sf blog-posts`, `sf logs`, `sf recordings`, `sf experiments`, `sf menus`, `sf containers`, `sf template`, `sf locate`, `sf files`, `sf pull`, `sf push`, `sf render`, `sf preview`.

### sf sizes

Manage measurements stored inside local widget documents.

```text
uc-storefront sf sizes <command>
```

Children: `sf sizes clear`.

### sf sizes clear

Clear cached measurements on one local widget.

```text
uc-storefront sf sizes clear <file> <selector> [options]
```

Effects: Local write. Local interface.

Local CJSON writes are atomic. Use --dry-run to inspect an edit, then inspect its diff and validate. New local IDs still need native allocation before a remote write.

| Input             | Required | Default | Usage                                                                                                                                       |
| ----------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`          | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute.                                                       |
| `<selector>`      | Yes      |         | Exact widget ID or canonical tree path from cjson tree. Use a stable ID when sibling order may change.                                      |
| `--dry-run`       | No       |         | Inspect the proposed work without applying the command’s write. A warehouse dry run still contacts BigQuery for validation and an estimate. |
| `--full`          | No       |         | Include the full result or document instead of the usual bounded response. This can expose more content to a consuming agent.               |
| `--allow-invalid` | No       |         | Permit a local edit to retain hard validation errors. This does not disable server validation.                                              |

### sf surveys

Inspect SurveyJS definitions with the installed catalog.

```text
uc-storefront sf surveys <command>
```

Children: `sf surveys validate`.

### sf surveys validate

Check a local survey definition against the supported contract.

```text
uc-storefront sf surveys validate <file> [options]
```

Effects: Read. Local interface.

| Input             | Required | Default | Usage                                                                                       |
| ----------------- | -------- | ------- | ------------------------------------------------------------------------------------------- |
| `<file>`          | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute.       |
| `--disqualified`  | No       |         | Check that survey answers include a disqualified outcome for a widget configured to use it. |
| `--limit <count>` | No       | 100     | Cap the number of matching entries or diagnostics in this response.                         |
| `--all`           | No       |         | Return every validation diagnostic instead of stopping at the normal limit.                 |

### sf ids

Allocate unique widget IDs from the selected storefront.

```text
uc-storefront sf ids --storefront <oid> [options]
```

Effects: ID allocation. Uses a remote service.

IDs are reserved immediately. Counts above 100 are split into requests. Do not repeat an uncertain allocation automatically.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--count <number>`   | No       | 1       | Reserve this many new native widget IDs, from 1 to 10000. This consumes a real allocation; it is not a read.  |

### sf storefronts

List stores that the selected merchant profile can access.

```text
uc-storefront sf storefronts
```

Effects: Read. Uses a remote service.

### sf themes

List a storefront’s themes and active-theme information.

```text
uc-storefront sf themes --storefront <oid>
```

Effects: Read. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |

### sf elements

Inspect the element contracts currently published by the server.

```text
uc-storefront sf elements <command>
```

Children: `sf elements list`, `sf elements get`.

### sf elements list

List server element names and available contract metadata.

```text
uc-storefront sf elements list
```

Effects: Read. Uses a remote service.

The server catalog can differ from the bundled local catalog and can be cached. Reading it does not replace the local schema used by schema, element, or CJSON validation. Unpublished schema is not proof of an empty configuration contract.

### sf elements get

Fetch the server schema and documentation for one element type.

```text
uc-storefront sf elements get <type>
```

Effects: Read. Uses a remote service.

The server catalog can differ from the bundled local catalog and can be cached. Reading it does not replace the local schema used by schema, element, or CJSON validation. Unpublished schema is not proof of an empty configuration contract.

| Input    | Required | Default | Usage                                                                                   |
| -------- | -------- | ------- | --------------------------------------------------------------------------------------- |
| `<type>` | Yes      |         | Exact widget type from schema list or sf elements list, as appropriate to this command. |

### sf pages

Inspect page catalog records, assignments, attributes, and visibility.

```text
uc-storefront sf pages <command>
```

Children: `sf pages get`, `sf pages attributes`, `sf pages refresh`, `sf pages images`, `sf pages list`, `sf pages templates`, `sf pages create`, `sf pages settings`, `sf pages duplicate`, `sf pages items`, `sf pages blog-posts`, `sf pages selectors`.

### sf pages get

Read one catalog page and its declared fields.

```text
uc-storefront sf pages get --storefront <oid> --path <path>
```

Effects: Read. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--path <path>`      | Yes      |         | Select the exact catalog page path, including its leading slash.                                              |

### sf pages attributes

Patch the page attributes named in a local JSON file.

```text
uc-storefront sf pages attributes <file> --storefront <oid> --path <path> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

These resource updates do not use the CJSON pull baseline. Read the current object, change only the intended fields, and coordinate concurrent edits.

| Input                | Required | Default | Usage                                                                                                                                       |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`             | Yes      |         | Local JSON payload containing the fields or resource requested by this command. Inspect the matching get response and installed help first. |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.                               |
| `--path <path>`      | Yes      |         | Select the exact catalog page path, including its leading slash.                                                                            |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.                             |

### sf pages refresh

Invalidate one page’s cached rendering.

```text
uc-storefront sf pages refresh <url> --storefront <oid>
```

Effects: Live / server write. Uses a remote service.

This invalidates server cache. It is a remote mutation even though it does not edit content or expose --live.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `<url>`              | Yes      |         | Storefront URL whose cached page response should be refreshed.                                                |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |

### sf pages images

Manage default and named page image attachments.

```text
uc-storefront sf pages images <command>
```

Children: `sf pages images attach`, `sf pages images detach`.

### sf pages images attach

Attach an uploaded raster image to a page image slot.

```text
uc-storefront sf pages images attach <filename> --storefront <oid> --path <path> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

These resource updates do not use the CJSON pull baseline. Read the current object, change only the intended fields, and coordinate concurrent edits.

| Input                  | Required | Default | Usage                                                                                                           |
| ---------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `<filename>`           | Yes      |         | Image filename already present in the selected page folder.                                                     |
| `--storefront <oid>`   | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--path <path>`        | Yes      |         | Select the exact catalog page path, including its leading slash.                                                |
| `--code <code>`        | No       |         | Select a named image slot. Do not combine it with --default.                                                    |
| `--default`            | No       |         | Select the default image slot rather than a named slot.                                                         |
| `--live`               | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |
| `--description <text>` | No       |         | Supply the page description or image description, according to this command’s target.                           |

### sf pages images detach

Remove a page image attachment while keeping the source asset.

```text
uc-storefront sf pages images detach --storefront <oid> --path <path> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

These resource updates do not use the CJSON pull baseline. Read the current object, change only the intended fields, and coordinate concurrent edits.

| Input                | Required | Default | Usage                                                                                                           |
| -------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--path <path>`      | Yes      |         | Select the exact catalog page path, including its leading slash.                                                |
| `--code <code>`      | No       |         | Select a named image slot. Do not combine it with --default.                                                    |
| `--default`          | No       |         | Select the default image slot rather than a named slot.                                                         |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |

### sf pages list

Read catalog page paths, templates, and settings.

```text
uc-storefront sf pages list --storefront <oid> [options]
```

Effects: Read. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--under <path>`     | No       |         | Restrict the page catalog to this path and its descendants.                                                   |
| `--template <vm>`    | No       |         | Use a template filename, not an absolute path. Read available templates or an existing page first.            |

### sf pages templates

List templates offered by the active theme.

```text
uc-storefront sf pages templates --storefront <oid> [options]
```

Effects: Read. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--type <page type>` | No       |         | Filter template declarations by page role: group for a page template, item for its item template.             |

### sf pages create

Create a remote catalog page beneath an existing parent.

```text
uc-storefront sf pages create <path> --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

Select both group and item templates from the storefront. Omitted templates can inherit or fall back to names absent from the theme. Creation can make a page public immediately; body content is a separate write.

| Input                  | Required | Default | Usage                                                                                                           |
| ---------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `<path>`               | Yes      |         | Exact absolute storefront path for this resource.                                                               |
| `--storefront <oid>`   | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--template <vm>`      | No       |         | Use a template filename, not an absolute path. Read available templates or an existing page first.              |
| `--item-template <vm>` | No       |         | Select the template filename used for item pages below the new page.                                            |
| `--title <title>`      | No       |         | Set the page title.                                                                                             |
| `--description <text>` | No       |         | Supply the page description or image description, according to this command’s target.                           |
| `--page-type <type>`   | No       |         | Choose static S or dynamic D. The command uses D when omitted.                                                  |
| `--no-sitemap`         | No       |         | Exclude this page from the sitemap and add noindex. Descendant pages are not changed.                           |
| `--noindex`            | No       |         | Use the same page-level search exclusion as --no-sitemap.                                                       |
| `--hidden`             | No       |         | Create a hidden page that responds with 404 until it becomes visible.                                           |
| `--visible-at <iso>`   | No       |         | Schedule visibility with an ISO-8601 timestamp.                                                                 |
| `--live`               | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |

### sf pages settings

Patch the supplied catalog-page settings.

```text
uc-storefront sf pages settings <file> --storefront <oid> --path <path> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

These resource updates do not use the CJSON pull baseline. Read the current object, change only the intended fields, and coordinate concurrent edits.

| Input                | Required | Default | Usage                                                                                                                                       |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`             | Yes      |         | Local JSON payload containing the fields or resource requested by this command. Inspect the matching get response and installed help first. |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.                               |
| `--path <path>`      | Yes      |         | Select the exact catalog page path, including its leading slash.                                                                            |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.                             |

### sf pages duplicate

Copy a page and its associated content to a new path.

```text
uc-storefront sf pages duplicate <source> <target> --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

| Input                | Required | Default | Usage                                                                                                           |
| -------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `<source>`           | Yes      |         | Existing catalog page path to duplicate.                                                                        |
| `<target>`           | Yes      |         | New catalog page path for the duplicate.                                                                        |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--title <title>`    | No       |         | Set the page title.                                                                                             |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |

### sf pages items

Manage product assignments on a catalog page.

```text
uc-storefront sf pages items <command>
```

Children: `sf pages items get`, `sf pages items add`, `sf pages items remove`.

### sf pages items get

Read the page’s assigned products and ordering.

```text
uc-storefront sf pages items get --storefront <oid> --path <path>
```

Effects: Read. Uses a remote service.

These resource updates do not use the CJSON pull baseline. Read the current object, change only the intended fields, and coordinate concurrent edits.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--path <path>`      | Yes      |         | Select the exact catalog page path, including its leading slash.                                              |

### sf pages items add

Assign products using a JSON item list.

```text
uc-storefront sf pages items add <file> --storefront <oid> --path <path> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

These resource updates do not use the CJSON pull baseline. Read the current object, change only the intended fields, and coordinate concurrent edits.

| Input                | Required | Default | Usage                                                                                                                                       |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`             | Yes      |         | Local JSON payload containing the fields or resource requested by this command. Inspect the matching get response and installed help first. |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.                               |
| `--path <path>`      | Yes      |         | Select the exact catalog page path, including its leading slash.                                                                            |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.                             |

### sf pages items remove

Remove product assignments without deleting products.

```text
uc-storefront sf pages items remove <itemIds...> --storefront <oid> --path <path> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

These resource updates do not use the CJSON pull baseline. Read the current object, change only the intended fields, and coordinate concurrent edits.

| Input                | Required | Default | Usage                                                                                                           |
| -------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `<itemIds...>`       | Yes      |         | One or more merchant item IDs to remove from this page assignment; the products are not deleted.                |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--path <path>`      | Yes      |         | Select the exact catalog page path, including its leading slash.                                                |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |

### sf pages blog-posts

Manage blog-post assignments on a page.

```text
uc-storefront sf pages blog-posts <command>
```

Children: `sf pages blog-posts get`, `sf pages blog-posts add`, `sf pages blog-posts remove`.

### sf pages blog-posts get

Read the posts assigned to a page.

```text
uc-storefront sf pages blog-posts get --storefront <oid> --path <path>
```

Effects: Read. Uses a remote service.

These resource updates do not use the CJSON pull baseline. Read the current object, change only the intended fields, and coordinate concurrent edits.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--path <path>`      | Yes      |         | Select the exact catalog page path, including its leading slash.                                              |

### sf pages blog-posts add

Assign the specified post IDs to a page.

```text
uc-storefront sf pages blog-posts add <oids...> --storefront <oid> --path <path> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

These resource updates do not use the CJSON pull baseline. Read the current object, change only the intended fields, and coordinate concurrent edits.

| Input                | Required | Default | Usage                                                                                                           |
| -------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `<oids...>`          | Yes      |         | One or more blog-post OIDs to add to or remove from this page assignment.                                       |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--path <path>`      | Yes      |         | Select the exact catalog page path, including its leading slash.                                                |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |

### sf pages blog-posts remove

Remove the specified post assignments.

```text
uc-storefront sf pages blog-posts remove <oids...> --storefront <oid> --path <path> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

These resource updates do not use the CJSON pull baseline. Read the current object, change only the intended fields, and coordinate concurrent edits.

| Input                | Required | Default | Usage                                                                                                           |
| -------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `<oids...>`          | Yes      |         | One or more blog-post OIDs to add to or remove from this page assignment.                                       |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--path <path>`      | Yes      |         | Select the exact catalog page path, including its leading slash.                                                |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |

### sf pages selectors

Manage the rules that select products and posts for a page.

```text
uc-storefront sf pages selectors <command>
```

Children: `sf pages selectors get`, `sf pages selectors set`.

### sf pages selectors get

Read the page’s selector rules.

```text
uc-storefront sf pages selectors get --storefront <oid> --path <path>
```

Effects: Read. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--path <path>`      | Yes      |         | Select the exact catalog page path, including its leading slash.                                              |

### sf pages selectors set

Replace the selector lists supplied in JSON.

```text
uc-storefront sf pages selectors set <file> --storefront <oid> --path <path> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

These resource updates do not use the CJSON pull baseline. Read the current object, change only the intended fields, and coordinate concurrent edits.

| Input                | Required | Default | Usage                                                                                                                                       |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`             | Yes      |         | Local JSON payload containing the fields or resource requested by this command. Inspect the matching get response and installed help first. |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.                               |
| `--path <path>`      | Yes      |         | Select the exact catalog page path, including its leading slash.                                                                            |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.                             |

### sf site

Inspect and edit attributes shared across the storefront.

```text
uc-storefront sf site <command>
```

Children: `sf site get`, `sf site attributes`.

### sf site get

Read site attributes and their declared usage.

```text
uc-storefront sf site get --storefront <oid>
```

Effects: Read. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |

### sf site attributes

Patch the supplied site attributes.

```text
uc-storefront sf site attributes <file> --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

These resource updates do not use the CJSON pull baseline. Read the current object, change only the intended fields, and coordinate concurrent edits.

| Input                | Required | Default | Usage                                                                                                                                       |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`             | Yes      |         | Local JSON payload containing the fields or resource requested by this command. Inspect the matching get response and installed help first. |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.                               |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.                             |

### sf theme-attributes

Inspect and update a theme’s colors, fonts, and settings.

```text
uc-storefront sf theme-attributes <command>
```

Children: `sf theme-attributes get`, `sf theme-attributes set`.

### sf theme-attributes get

Read a theme’s applied settings and declared defaults.

```text
uc-storefront sf theme-attributes get --storefront <oid> --theme <oid> [options]
```

Effects: Read. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--theme <oid>`      | Yes      |         | Select a theme by OID. A theme context does not turn shared page or item content into a draft.                |
| `--all`              | No       |         | Include every attribute type, rather than only color, rgba, and font slots.                                   |

### sf theme-attributes set

Patch selected theme setting values.

```text
uc-storefront sf theme-attributes set --storefront <oid> --theme <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

| Input                 | Required | Default | Usage                                                                                                           |
| --------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>`  | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--theme <oid>`       | Yes      |         | Select a theme by OID. A theme context does not turn shared page or item content into a draft.                  |
| `--set <name=value>`  | No       | []      | Set a named theme attribute; repeat for multiple attributes. Font values use JSON objects.                      |
| `--file <patch.json>` | No       |         | Read a theme-attribute patch with an attributes array containing name and value, or name and font.              |
| `--live`              | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |

### sf items

Inspect and edit product content used by storefront elements.

```text
uc-storefront sf items <command>
```

Children: `sf items get`, `sf items attributes`, `sf items content`, `sf items seo`, `sf items remove-attribute`, `sf items images`.

### sf items get

Read a product’s content, images, and declared attributes.

```text
uc-storefront sf items get --storefront <oid> [options]
```

Effects: Read. Uses a remote service.

Select exactly one product identity: --item-id or --item-oid. The parser lists both as optional because this rule is checked together.

| Input                | Required | Default | Usage                                                                                                             |
| -------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.     |
| `--item-id <id>`     | No       |         | Identify a product by its merchant item ID. This is distinct from an item OID, even when it contains only digits. |
| `--item-oid <oid>`   | No       |         | Identify a product by its OID. Supply exactly one of --item-id and --item-oid.                                    |

### sf items attributes

Patch product attributes from a local JSON file.

```text
uc-storefront sf items attributes <file> --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

Select exactly one product identity: --item-id or --item-oid. The parser lists both as optional because this rule is checked together.

These resource updates do not use the CJSON pull baseline. Read the current object, change only the intended fields, and coordinate concurrent edits.

| Input                | Required | Default | Usage                                                                                                                                       |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`             | Yes      |         | Local JSON payload containing the fields or resource requested by this command. Inspect the matching get response and installed help first. |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.                               |
| `--item-id <id>`     | No       |         | Identify a product by its merchant item ID. This is distinct from an item OID, even when it contains only digits.                           |
| `--item-oid <oid>`   | No       |         | Identify a product by its OID. Supply exactly one of --item-id and --item-oid.                                                              |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.                             |

### sf items content

Patch a product title or description.

```text
uc-storefront sf items content <file> --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

Select exactly one product identity: --item-id or --item-oid. The parser lists both as optional because this rule is checked together.

These resource updates do not use the CJSON pull baseline. Read the current object, change only the intended fields, and coordinate concurrent edits.

| Input                | Required | Default | Usage                                                                                                                                       |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`             | Yes      |         | Local JSON payload containing the fields or resource requested by this command. Inspect the matching get response and installed help first. |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.                               |
| `--item-id <id>`     | No       |         | Identify a product by its merchant item ID. This is distinct from an item OID, even when it contains only digits.                           |
| `--item-oid <oid>`   | No       |         | Identify a product by its OID. Supply exactly one of --item-id and --item-oid.                                                              |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.                             |

### sf items seo

Patch a product’s search metadata.

```text
uc-storefront sf items seo <file> --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

Select exactly one product identity: --item-id or --item-oid. The parser lists both as optional because this rule is checked together.

These resource updates do not use the CJSON pull baseline. Read the current object, change only the intended fields, and coordinate concurrent edits.

| Input                | Required | Default | Usage                                                                                                                                       |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`             | Yes      |         | Local JSON payload containing the fields or resource requested by this command. Inspect the matching get response and installed help first. |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.                               |
| `--item-id <id>`     | No       |         | Identify a product by its merchant item ID. This is distinct from an item OID, even when it contains only digits.                           |
| `--item-oid <oid>`   | No       |         | Identify a product by its OID. Supply exactly one of --item-id and --item-oid.                                                              |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.                             |

### sf items remove-attribute

Remove an undeclared product attribute.

```text
uc-storefront sf items remove-attribute <name> --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

Select exactly one product identity: --item-id or --item-oid. The parser lists both as optional because this rule is checked together.

These resource updates do not use the CJSON pull baseline. Read the current object, change only the intended fields, and coordinate concurrent edits.

| Input                | Required | Default | Usage                                                                                                             |
| -------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `<name>`             | Yes      |         | Exact resource or attribute name.                                                                                 |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.     |
| `--item-id <id>`     | No       |         | Identify a product by its merchant item ID. This is distinct from an item OID, even when it contains only digits. |
| `--item-oid <oid>`   | No       |         | Identify a product by its OID. Supply exactly one of --item-id and --item-oid.                                    |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.   |

### sf items images

Manage product image attachments.

```text
uc-storefront sf items images <command>
```

Children: `sf items images attach`, `sf items images detach`.

### sf items images attach

Attach an uploaded image to a product.

```text
uc-storefront sf items images attach <path> --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

Select exactly one product identity: --item-id or --item-oid. The parser lists both as optional because this rule is checked together.

These resource updates do not use the CJSON pull baseline. Read the current object, change only the intended fields, and coordinate concurrent edits.

| Input                  | Required | Default | Usage                                                                                                             |
| ---------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `<path>`               | Yes      |         | Absolute server path of an image already uploaded to the storefront.                                              |
| `--storefront <oid>`   | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.     |
| `--item-id <id>`       | No       |         | Identify a product by its merchant item ID. This is distinct from an item OID, even when it contains only digits. |
| `--item-oid <oid>`     | No       |         | Identify a product by its OID. Supply exactly one of --item-id and --item-oid.                                    |
| `--code <code>`        | No       |         | Select a named image slot. Do not combine it with --default.                                                      |
| `--default`            | No       |         | Select the default image slot rather than a named slot.                                                           |
| `--live`               | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.   |
| `--description <text>` | No       |         | Supply the page description or image description, according to this command’s target.                             |

### sf items images detach

Remove a product image attachment.

```text
uc-storefront sf items images detach --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

Select exactly one product identity: --item-id or --item-oid. The parser lists both as optional because this rule is checked together.

These resource updates do not use the CJSON pull baseline. Read the current object, change only the intended fields, and coordinate concurrent edits.

| Input                | Required | Default | Usage                                                                                                             |
| -------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.     |
| `--item-id <id>`     | No       |         | Identify a product by its merchant item ID. This is distinct from an item OID, even when it contains only digits. |
| `--item-oid <oid>`   | No       |         | Identify a product by its OID. Supply exactly one of --item-id and --item-oid.                                    |
| `--code <code>`      | No       |         | Select a named image slot. Do not combine it with --default.                                                      |
| `--default`          | No       |         | Select the default image slot rather than a named slot.                                                           |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.   |

### sf upsells

Inspect and manage checkout offer paths and individual offers.

```text
uc-storefront sf upsells <command>
```

Children: `sf upsells paths`, `sf upsells offers`.

### sf upsells paths

Manage the ordering, triggers, and variations of upsell paths.

```text
uc-storefront sf upsells paths <command>
```

Children: `sf upsells paths list`, `sf upsells paths get`, `sf upsells paths create`, `sf upsells paths update`, `sf upsells paths disable`, `sf upsells paths archive`, `sf upsells paths unarchive`, `sf upsells paths move`, `sf upsells paths duplicate`.

### sf upsells paths list

Read upsell paths, with optional statistics and pagination.

```text
uc-storefront sf upsells paths list --storefront <oid> [options]
```

Effects: Read. Uses a remote service.

| Input                   | Required | Default | Usage                                                                                                         |
| ----------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>`    | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--status <status>`     | No       |         | Select current (non-archived), archived, or all upsell paths.                                                 |
| `--location <location>` | No       |         | Filter upsell paths by pre-checkout or post-checkout location.                                                |
| `--search <text>`       | No       |         | Filter names or descriptions using the supplied text.                                                         |
| `--max-results <n>`     | No       |         | Set a server page size from 1 to 500; the service uses 100 when omitted.                                      |
| `--offset <n>`          | No       |         | Start at this result offset. Request subsequent pages explicitly.                                             |
| `--stats`               | No       |         | Request extra performance statistics. This performs additional remote statistics work.                        |
| `--from <date>`         | No       |         | Set the statistics window start as YYYY-MM-DD. Supply --to as well.                                           |
| `--to <date>`           | No       |         | Set the statistics window end as YYYY-MM-DD. Omitting both dates uses the command’s last-30-days window.      |
| `--weekdays <days>`     | No       |         | Restrict statistics to comma-separated weekdays, using mon through sun.                                       |

### sf upsells paths get

Read one path; optionally save an editable local baseline.

```text
uc-storefront sf upsells paths get <oid> --storefront <oid> [options]
```

Effects: Read, Local write. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `<oid>`              | Yes      |         | Exact resource OID from the corresponding list or get response.                                               |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--out <file>`       | No       |         | Write the result to a local file. Pull commands create a new editing file and baseline; use a fresh filename. |
| `--stats`            | No       |         | Request extra performance statistics. This performs additional remote statistics work.                        |
| `--from <date>`      | No       |         | Set the statistics window start as YYYY-MM-DD. Supply --to as well.                                           |
| `--to <date>`        | No       |         | Set the statistics window end as YYYY-MM-DD. Omitting both dates uses the command’s last-30-days window.      |
| `--weekdays <days>`  | No       |         | Restrict statistics to comma-separated weekdays, using mon through sun.                                       |

### sf upsells paths create

Create an upsell path from JSON and retain a local baseline.

```text
uc-storefront sf upsells paths create <file> --storefront <oid> [options]
```

Effects: Live / server write, Local write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

| Input                | Required | Default | Usage                                                                                                                                       |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`             | Yes      |         | Local JSON payload containing the fields or resource requested by this command. Inspect the matching get response and installed help first. |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.                               |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.                             |

### sf upsells paths update

Replace an upsell path using its saved baseline.

```text
uc-storefront sf upsells paths update <file> --storefront <oid> [options]
```

Effects: Live / server write, Local write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

| Input                | Required | Default | Usage                                                                                                                                       |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`             | Yes      |         | Local JSON payload containing the fields or resource requested by this command. Inspect the matching get response and installed help first. |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.                               |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.                             |

### sf upsells paths disable

Switch an upsell path off.

```text
uc-storefront sf upsells paths disable <oid> --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

| Input                | Required | Default | Usage                                                                                                           |
| -------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `<oid>`              | Yes      |         | Exact resource OID from the corresponding list or get response.                                                 |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |

### sf upsells paths archive

Archive a path so it no longer participates.

```text
uc-storefront sf upsells paths archive <oid> --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

| Input                | Required | Default | Usage                                                                                                           |
| -------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `<oid>`              | Yes      |         | Exact resource OID from the corresponding list or get response.                                                 |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |

### sf upsells paths unarchive

Return an archived path to the normal list.

```text
uc-storefront sf upsells paths unarchive <oid> --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

| Input                | Required | Default | Usage                                                                                                           |
| -------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `<oid>`              | Yes      |         | Exact resource OID from the corresponding list or get response.                                                 |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |

### sf upsells paths move

Change the execution order of an upsell path.

```text
uc-storefront sf upsells paths move <oid> --storefront <oid> --to <where> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

| Input                | Required | Default | Usage                                                                                                           |
| -------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `<oid>`              | Yes      |         | Exact resource OID from the corresponding list or get response.                                                 |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |
| `--to <where>`       | Yes      |         | Move the upsell path up, down, top, or bottom.                                                                  |

### sf upsells paths duplicate

Copy a path in a disabled state, or copy one variation.

```text
uc-storefront sf upsells paths duplicate <oid> --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

| Input                | Required | Default | Usage                                                                                                           |
| -------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `<oid>`              | Yes      |         | Exact resource OID from the corresponding list or get response.                                                 |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |
| `--variation <n>`    | No       |         | Select a zero-based experiment or upsell variation index.                                                       |

### sf upsells offers

Manage individual upsell offers, rules, pricing, and schedules.

```text
uc-storefront sf upsells offers <command>
```

Children: `sf upsells offers list`, `sf upsells offers get`, `sf upsells offers create`, `sf upsells offers update`, `sf upsells offers disable`, `sf upsells offers duplicate`.

### sf upsells offers list

Read offers from active, non-archived paths.

```text
uc-storefront sf upsells offers list --storefront <oid> [options]
```

Effects: Read. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--stats`            | No       |         | Request extra performance statistics. This performs additional remote statistics work.                        |
| `--from <date>`      | No       |         | Set the statistics window start as YYYY-MM-DD. Supply --to as well.                                           |
| `--to <date>`        | No       |         | Set the statistics window end as YYYY-MM-DD. Omitting both dates uses the command’s last-30-days window.      |
| `--weekdays <days>`  | No       |         | Restrict statistics to comma-separated weekdays, using mon through sun.                                       |

### sf upsells offers get

Read an offer; optionally save a local editing baseline.

```text
uc-storefront sf upsells offers get <oid> --storefront <oid> [options]
```

Effects: Read, Local write. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `<oid>`              | Yes      |         | Exact resource OID from the corresponding list or get response.                                               |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--out <file>`       | No       |         | Write the result to a local file. Pull commands create a new editing file and baseline; use a fresh filename. |
| `--stats`            | No       |         | Request extra performance statistics. This performs additional remote statistics work.                        |
| `--from <date>`      | No       |         | Set the statistics window start as YYYY-MM-DD. Supply --to as well.                                           |
| `--to <date>`        | No       |         | Set the statistics window end as YYYY-MM-DD. Omitting both dates uses the command’s last-30-days window.      |
| `--weekdays <days>`  | No       |         | Restrict statistics to comma-separated weekdays, using mon through sun.                                       |

### sf upsells offers create

Create an offer from JSON and retain its baseline.

```text
uc-storefront sf upsells offers create <file> --storefront <oid> [options]
```

Effects: Live / server write, Local write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

| Input                | Required | Default | Usage                                                                                                                                       |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`             | Yes      |         | Local JSON payload containing the fields or resource requested by this command. Inspect the matching get response and installed help first. |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.                               |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.                             |

### sf upsells offers update

Replace an offer using its saved baseline.

```text
uc-storefront sf upsells offers update <file> --storefront <oid> [options]
```

Effects: Live / server write, Local write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

| Input                | Required | Default | Usage                                                                                                                                       |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`             | Yes      |         | Local JSON payload containing the fields or resource requested by this command. Inspect the matching get response and installed help first. |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.                               |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.                             |

### sf upsells offers disable

Switch an offer off.

```text
uc-storefront sf upsells offers disable <oid> --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

| Input                | Required | Default | Usage                                                                                                           |
| -------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `<oid>`              | Yes      |         | Exact resource OID from the corresponding list or get response.                                                 |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |

### sf upsells offers duplicate

Copy an offer and its container in a disabled state.

```text
uc-storefront sf upsells offers duplicate <oid> --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

| Input                | Required | Default | Usage                                                                                                           |
| -------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `<oid>`              | Yes      |         | Exact resource OID from the corresponding list or get response.                                                 |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |

### sf blog-posts

Manage posts, their content, visibility, and images.

```text
uc-storefront sf blog-posts <command>
```

Children: `sf blog-posts list`, `sf blog-posts get`, `sf blog-posts create`, `sf blog-posts update`, `sf blog-posts delete`, `sf blog-posts images`.

### sf blog-posts list

Search or paginate blog posts.

```text
uc-storefront sf blog-posts list --storefront <oid> [options]
```

Effects: Read. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--search <text>`    | No       |         | Filter names or descriptions using the supplied text.                                                         |
| `--page <n>`         | No       |         | Request a blog-post result page, starting at 1.                                                               |
| `--page-size <n>`    | No       |         | Set blog-post results per page from 1 to 100; the service uses 50 when omitted.                               |

### sf blog-posts get

Read one post and its page assignments.

```text
uc-storefront sf blog-posts get <oid> --storefront <oid>
```

Effects: Read. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `<oid>`              | Yes      |         | Exact resource OID from the corresponding list or get response.                                               |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |

### sf blog-posts create

Create a post from JSON, with optional HTML files.

```text
uc-storefront sf blog-posts create <file> --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

A new post defaults to draft. Public or link visibility needs --live. Inspect the create payload before using it.

| Input                   | Required | Default | Usage                                                                                                                                       |
| ----------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`                | Yes      |         | Local JSON payload containing the fields or resource requested by this command. Inspect the matching get response and installed help first. |
| `--storefront <oid>`    | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.                               |
| `--body-file <html>`    | No       |         | Read the blog-post body from a local HTML file.                                                                                             |
| `--excerpt-file <html>` | No       |         | Read the blog-post excerpt from a local HTML file.                                                                                          |
| `--live`                | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.                             |

### sf blog-posts update

Patch the supplied fields of an existing post.

```text
uc-storefront sf blog-posts update <oid> <file> --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

| Input                   | Required | Default | Usage                                                                                                                                       |
| ----------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<oid>`                 | Yes      |         | Exact resource OID from the corresponding list or get response.                                                                             |
| `<file>`                | Yes      |         | Local JSON payload containing the fields or resource requested by this command. Inspect the matching get response and installed help first. |
| `--storefront <oid>`    | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.                               |
| `--body-file <html>`    | No       |         | Read the blog-post body from a local HTML file.                                                                                             |
| `--excerpt-file <html>` | No       |         | Read the blog-post excerpt from a local HTML file.                                                                                          |
| `--live`                | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.                             |

### sf blog-posts delete

Permanently delete a post and remove its assignments.

```text
uc-storefront sf blog-posts delete <oid> --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

This permanently deletes the post and its assignments. It is not a local removal or archive operation.

| Input                | Required | Default | Usage                                                                                                           |
| -------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `<oid>`              | Yes      |         | Exact resource OID from the corresponding list or get response.                                                 |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |

### sf blog-posts images

Manage images attached to blog posts.

```text
uc-storefront sf blog-posts images <command>
```

Children: `sf blog-posts images attach`, `sf blog-posts images detach`.

### sf blog-posts images attach

Upload a local image and attach it to a post.

```text
uc-storefront sf blog-posts images attach <oid> <image> --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

| Input                  | Required | Default | Usage                                                                                                           |
| ---------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `<oid>`                | Yes      |         | Exact resource OID from the corresponding list or get response.                                                 |
| `<image>`              | Yes      |         | Local image file to upload and attach to the blog post.                                                         |
| `--storefront <oid>`   | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--default`            | No       |         | Select the default image slot rather than a named slot.                                                         |
| `--code <code>`        | No       |         | Select a named image slot. Do not combine it with --default.                                                    |
| `--inline`             | No       |         | Attach the blog image for use inside the body rather than a named/default image slot.                           |
| `--filename <name>`    | No       |         | Choose the uploaded blog image’s filename. Otherwise use the local filename.                                    |
| `--description <text>` | No       |         | Supply the page description or image description, according to this command’s target.                           |
| `--live`               | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |

### sf blog-posts images detach

Remove an image from a post and its body references.

```text
uc-storefront sf blog-posts images detach <oid> --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

| Input                | Required | Default | Usage                                                                                                           |
| -------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `<oid>`              | Yes      |         | Exact resource OID from the corresponding list or get response.                                                 |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--default`          | No       |         | Select the default image slot rather than a named slot.                                                         |
| `--code <code>`      | No       |         | Select a named image slot. Do not combine it with --default.                                                    |
| `--image <oid>`      | No       |         | Select the exact blog-post multimedia OID to detach.                                                            |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |

### sf logs

Read server-side render diagnostics.

```text
uc-storefront sf logs <command>
```

Children: `sf logs list`, `sf logs get`.

### sf logs list

List recent render events and their diagnostic counts.

```text
uc-storefront sf logs list --storefront <oid> [options]
```

Effects: Read. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--uri <text>`       | No       |         | Filter render logs by text in the requested address, ignoring case.                                           |
| `--since <window>`   | No       |         | Select recent logs using a duration such as 15m or 2h, or an ISO timestamp. Default 1h; maximum 7 days.       |
| `--errors-only`      | No       |         | Return renders that failed or emitted an error.                                                               |
| `--limit <n>`        | No       |         | Return between 1 and 100 log records. The service uses 25 when omitted.                                       |

### sf logs get

Read log lines for one server render.

```text
uc-storefront sf logs get <log_id> --storefront <oid> [options]
```

Effects: Read. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `<log_id>`           | Yes      |         | Render-log ID from sf logs list.                                                                              |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--level <level>`    | No       | "warn"  | Set the minimum log level: debug, info, warn, or error.                                                       |

### sf recordings

Inspect recording settings and replay captured sessions.

```text
uc-storefront sf recordings <command>
```

Children: `sf recordings show`, `sf recordings render`, `sf recordings status`, `sf recordings enable`, `sf recordings disable`.

### sf recordings show

Read a recorded session’s page views and event summary.

```text
uc-storefront sf recordings show <screen_recording_uuid> --storefront <oid>
```

Effects: Read. Uses a remote service.

| Input                     | Required | Default | Usage                                                                                                         |
| ------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `<screen_recording_uuid>` | Yes      |         | Recording UUID from an authorized recording source; replay data can include shopper information.              |
| `--storefront <oid>`      | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |

### sf recordings render

Download selected replay events and create local frames or video.

```text
uc-storefront sf recordings render <screen_recording_uuid> --storefront <oid> [options]
```

Effects: Read, Local write. Uses a remote service.

Local replay output can contain shopper content and entered text. Scope page views and output retention to the task.

| Input                     | Required | Default | Usage                                                                                                                      |
| ------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `<screen_recording_uuid>` | Yes      |         | Recording UUID from an authorized recording source; replay data can include shopper information.                           |
| `--storefront <oid>`      | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.              |
| `--page-view <uuid>`      | No       | []      | Render this recording page view. Repeat to select several; omission selects all page views.                                |
| `--limit <n>`             | No       |         | Stop after this many recording page views; omission permits every selected page view.                                      |
| `--out <dir>`             | No       |         | Choose a local replay output directory. The default is recordings/<recording UUID> under the working directory.            |
| `--video`                 | No       |         | Produce a WebM replay for each selected page view in addition to the normal local output.                                  |
| `--speed <x>`             | No       |         | Set replay video speed from 0.25 to 16; default 1.                                                                         |
| `--skip-inactive`         | No       |         | Compress idle periods in replay video.                                                                                     |
| `--show-input`            | No       |         | Include visitor-entered text in the timeline. Password inputs stay hidden; other entries can contain private data.         |
| `--chrome <path>`         | No       |         | Select a Chrome executable for local replay rendering.                                                                     |
| `--audit-log <file>`      | No       |         | Append fetch/reuse metadata for selected page views to a local JSON-lines file; replay events remain in the replay output. |

### sf recordings status

Read the recording feature’s current status and usage information.

```text
uc-storefront sf recordings status --storefront <oid>
```

Effects: Read. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |

### sf recordings enable

Enable capture of real shopper sessions.

```text
uc-storefront sf recordings enable --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

This turns on capture of real shopper sessions. Enable it only for an explicit authorized purpose.

| Input                | Required | Default | Usage                                                                                                           |
| -------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |

### sf recordings disable

Disable capture of shopper sessions.

```text
uc-storefront sf recordings disable --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

| Input                | Required | Default | Usage                                                                                                           |
| -------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |

### sf experiments

Inspect and control storefront experiments.

```text
uc-storefront sf experiments <command>
```

Children: `sf experiments objectives`, `sf experiments list`, `sf experiments get`, `sf experiments start-page`, `sf experiments start-url`, `sf experiments pause`, `sf experiments resume`, `sf experiments end`.

### sf experiments objectives

Read the available experiment objectives.

```text
uc-storefront sf experiments objectives --storefront <oid>
```

Effects: Read. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |

### sf experiments list

Read experiments and their reported statistics.

```text
uc-storefront sf experiments list --storefront <oid> [options]
```

Effects: Read. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                           |
| -------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--status <status>`  | No       |         | Filter experiments by their reported status. Read the installed command help for accepted server status values. |
| `--type <type>`      | No       |         | Filter experiments by page, url, theme, or openai.                                                              |
| `--path <path>`      | No       |         | Select the exact catalog page path, including its leading slash.                                                |

### sf experiments get

Inspect one experiment and its assessment.

```text
uc-storefront sf experiments get <experimentOid> --storefront <oid> [options]
```

Effects: Read. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `<experimentOid>`    | Yes      |         | Exact resource OID from the corresponding list or get response.                                               |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--daily`            | No       |         | Include daily statistics for each experiment variation.                                                       |

### sf experiments start-page

Start an experiment widget already stored in a page slot.

```text
uc-storefront sf experiments start-page --storefront <oid> --path <path> --widget <id> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

| Input                | Required | Default | Usage                                                                                                           |
| -------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--path <path>`      | Yes      |         | Select the exact catalog page path, including its leading slash.                                                |
| `--widget <id>`      | Yes      |         | Select the existing native ID of the experiment widget.                                                         |
| `--slot <name>`      | No       | "body"  | Select the page-container slot name without the .cjson suffix.                                                  |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |

### sf experiments start-url

Start an experiment that routes between existing pages.

```text
uc-storefront sf experiments start-url <file> --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

| Input                | Required | Default | Usage                                                                                                           |
| -------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `<file>`             | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute.                           |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |

### sf experiments pause

Pause traffic to a non-control variation.

```text
uc-storefront sf experiments pause <experimentOid> --storefront <oid> --variation <n> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

| Input                | Required | Default | Usage                                                                                                           |
| -------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `<experimentOid>`    | Yes      |         | Exact resource OID from the corresponding list or get response.                                                 |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--variation <n>`    | Yes      |         | Select a zero-based experiment or upsell variation index.                                                       |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |

### sf experiments resume

Resume traffic to a paused variation.

```text
uc-storefront sf experiments resume <experimentOid> --storefront <oid> --variation <n> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

| Input                | Required | Default | Usage                                                                                                           |
| -------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `<experimentOid>`    | Yes      |         | Exact resource OID from the corresponding list or get response.                                                 |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--variation <n>`    | Yes      |         | Select a zero-based experiment or upsell variation index.                                                       |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |

### sf experiments end

End an experiment and optionally choose a winner.

```text
uc-storefront sf experiments end <experimentOid> --storefront <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

Choose --winner or --no-winner deliberately. Ending or selecting a winner changes experiment behavior.

| Input                | Required | Default | Usage                                                                                                           |
| -------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `<experimentOid>`    | Yes      |         | Exact resource OID from the corresponding list or get response.                                                 |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.   |
| `--winner <n>`       | No       |         | Finish the experiment with this variation as winner.                                                            |
| `--no-winner`        | No       |         | Finish the experiment without selecting a winner.                                                               |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism. |

### sf menus

Read and replace store menus used by menu widgets.

```text
uc-storefront sf menus <command>
```

Children: `sf menus list`, `sf menus pull`, `sf menus push`.

### sf menus list

List store-menu identifiers.

```text
uc-storefront sf menus list --storefront <oid>
```

Effects: Read. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |

### sf menus pull

Save a menu and its comparison baseline locally.

```text
uc-storefront sf menus pull <code> --storefront <oid> --out <file>
```

Effects: Read, Local write. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `<code>`             | Yes      |         | Exact store-menu code returned by sf menus list.                                                              |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--out <file>`       | Yes      |         | Write the result to a local file. Pull commands create a new editing file and baseline; use a fresh filename. |

### sf menus push

Create or replace a live store menu from a local file.

```text
uc-storefront sf menus push <file> --storefront <oid> [options]
```

Effects: Live / server write, Local write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

Menus are shared live data. A draft theme does not isolate a menu write.

| Input                | Required | Default | Usage                                                                                                                                       |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`             | Yes      |         | Local JSON payload containing the fields or resource requested by this command. Inspect the matching get response and installed help first. |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.                               |
| `--create`           | No       |         | Create a missing server target. Existing targets require the appropriate baseline or conflict hash instead.                                 |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.                             |

### sf containers

Access owner containers stored as database rows.

```text
uc-storefront sf containers <command>
```

Children: `sf containers list`, `sf containers pull`, `sf containers push`, `sf containers versions`, `sf containers revert`.

### sf containers list

List item-container rows with filters and pagination.

```text
uc-storefront sf containers list --storefront <oid> [options]
```

Effects: Read. Uses a remote service.

Select exactly one product identity: --item-id or --item-oid. The parser lists both as optional because this rule is checked together.

Owner containers are database rows. Use sf pull / sf push for theme or page .cjson files. Only item/itemid owners use named slots.

| Input                | Required | Default | Usage                                                                                                             |
| -------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.     |
| `--item-id <id>`     | No       |         | Identify a product by its merchant item ID. This is distinct from an item OID, even when it contains only digits. |
| `--item-oid <oid>`   | No       |         | Identify a product by its OID. Supply exactly one of --item-id and --item-oid.                                    |
| `--name <name>`      | No       |         | Select an item-container slot, ignoring case. Other container owner types have a single container.                |
| `--max-results <n>`  | No       |         | Set a server page size from 1 to 500; the service uses 100 when omitted.                                          |
| `--offset <n>`       | No       |         | Start at this result offset. Request subsequent pages explicitly.                                                 |
| `--all`              | No       |         | Fetch all pages of matching item-container metadata instead of one result page.                                   |

### sf containers pull

Save an owner container and its baseline to a new local file.

```text
uc-storefront sf containers pull <file> --storefront <oid> --owner-type <type> --owner-id <id> [options]
```

Effects: Read, Local write. Uses a remote service.

Owner containers are database rows. Use sf pull / sf push for theme or page .cjson files. Only item/itemid owners use named slots.

| Input                 | Required | Default | Usage                                                                                                         |
| --------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `<file>`              | Yes      |         | New local CJSON output file; the CLI also writes its .sf.json baseline.                                       |
| `--storefront <oid>`  | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--owner-type <type>` | Yes      |         | Use item, itemid, upsell, email, postcardfront, or postcardback. This determines the meaning of --owner-id.   |
| `--owner-id <id>`     | Yes      |         | Use the item/upsell OID, merchant item ID for itemid, or the ESP UUID for email and postcard owners.          |
| `--name <name>`       | No       |         | Select an item-container slot, ignoring case. Other container owner types have a single container.            |

### sf containers push

Create or replace an owner container from CJSON.

```text
uc-storefront sf containers push <file> --storefront <oid> --owner-type <type> --owner-id <id> [options]
```

Effects: Live / server write, ID allocation. Uses a remote service.

Owner containers are database rows. Use sf pull / sf push for theme or page .cjson files. Only item/itemid owners use named slots.

This is a server content write even though it has no --live flag. ID allocation occurs only with --create --remap-ids; preserve existing IDs for ordinary edits.

| Input                 | Required | Default | Usage                                                                                                         |
| --------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `<file>`              | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute.                         |
| `--storefront <oid>`  | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--owner-type <type>` | Yes      |         | Use item, itemid, upsell, email, postcardfront, or postcardback. This determines the meaning of --owner-id.   |
| `--owner-id <id>`     | Yes      |         | Use the item/upsell OID, merchant item ID for itemid, or the ESP UUID for email and postcard owners.          |
| `--name <name>`       | No       |         | Select an item-container slot, ignoring case. Other container owner types have a single container.            |
| `--comment <text>`    | No       |         | Attach a history note to this server write.                                                                   |
| `--allow-warnings`    | No       |         | Allow server container validation warnings. Hard validation errors still block the write.                     |
| `--create`            | No       |         | Create a missing server target. Existing targets require the appropriate baseline or conflict hash instead.   |
| `--remap-ids`         | No       |         | With --create, reserve fresh IDs for every widget and rewrite their references when copying to another owner. |

### sf containers versions

Read the history of an owner container.

```text
uc-storefront sf containers versions --storefront <oid> --owner-type <type> --owner-id <id> [options]
```

Effects: Read. Uses a remote service.

Owner containers are database rows. Use sf pull / sf push for theme or page .cjson files. Only item/itemid owners use named slots.

| Input                 | Required | Default | Usage                                                                                                         |
| --------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>`  | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--owner-type <type>` | Yes      |         | Use item, itemid, upsell, email, postcardfront, or postcardback. This determines the meaning of --owner-id.   |
| `--owner-id <id>`     | Yes      |         | Use the item/upsell OID, merchant item ID for itemid, or the ESP UUID for email and postcard owners.          |
| `--name <name>`       | No       |         | Select an item-container slot, ignoring case. Other container owner types have a single container.            |

### sf containers revert

Restore a historical owner-container version.

```text
uc-storefront sf containers revert --storefront <oid> --owner-type <type> --owner-id <id> --history-oid <oid> [options]
```

Effects: Live / server write. Uses a remote service.

Owner containers are database rows. Use sf pull / sf push for theme or page .cjson files. Only item/itemid owners use named slots.

Reverting creates a new server version. Any previous local baseline is stale afterwards.

| Input                 | Required | Default | Usage                                                                                                         |
| --------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>`  | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--owner-type <type>` | Yes      |         | Use item, itemid, upsell, email, postcardfront, or postcardback. This determines the meaning of --owner-id.   |
| `--owner-id <id>`     | Yes      |         | Use the item/upsell OID, merchant item ID for itemid, or the ESP UUID for email and postcard owners.          |
| `--name <name>`       | No       |         | Select an item-container slot, ignoring case. Other container owner types have a single container.            |
| `--history-oid <oid>` | Yes      |         | Restore this exact container-history OID from the versions response.                                          |
| `--comment <text>`    | No       |         | Attach a history note to this server write.                                                                   |

### sf template

Resolve templates and edit their literal container includes.

```text
uc-storefront sf template <command>
```

Children: `sf template find`, `sf template resolve`, `sf template wire`, `sf template unwire`, `sf template move`.

### sf template find

Resolve the templates assigned to an exact page.

```text
uc-storefront sf template find --storefront <oid> --uri <path> [options]
```

Effects: Read. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--uri <path>`       | Yes      |         | Supply the exact catalog page path used to resolve or render the requested content.                           |
| `--theme <oid>`      | No       |         | Select a theme by OID. A theme context does not turn shared page or item content into a draft.                |

### sf template resolve

Resolve a template name through the theme’s search paths.

```text
uc-storefront sf template resolve <name> --storefront <oid> [options]
```

Effects: Read. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `<name>`             | Yes      |         | Template filename to resolve through the theme’s configured resource paths.                                   |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--theme <oid>`      | No       |         | Select a theme by OID. A theme context does not turn shared page or item content into a draft.                |

### sf template wire

Add a literal container include to a template.

```text
uc-storefront sf template wire --storefront <oid> --template <path> --parse <path> --if-match <hash> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

A template can serve many pages. Read it, inspect the affected includes, retain its hash, and inspect the --dry-run output before an authorized write.

| Input                | Required | Default | Usage                                                                                                                                       |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.                               |
| `--template <path>`  | Yes      |         | Select the absolute .vm file under the theme’s templates directory.                                                                         |
| `--parse <path>`     | Yes      |         | Identify a literal /containers/<name>.vm include in the selected template.                                                                  |
| `--if-match <hash>`  | Yes      |         | Require the server’s current SHA-256 to match the reviewed version. A mismatch must be resolved before retrying.                            |
| `--before <path>`    | No       |         | Insert relative to this exact literal include path.                                                                                         |
| `--after <path>`     | No       |         | Insert after this exact literal include path.                                                                                               |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.                             |
| `--dry-run`          | No       |         | Inspect the proposed work without applying the command’s write. A warehouse dry run still contacts BigQuery for validation and an estimate. |

### sf template unwire

Remove a literal container include from a template.

```text
uc-storefront sf template unwire --storefront <oid> --template <path> --parse <path> --if-match <hash> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

A template can serve many pages. Read it, inspect the affected includes, retain its hash, and inspect the --dry-run output before an authorized write.

| Input                | Required | Default | Usage                                                                                                                                       |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.                               |
| `--template <path>`  | Yes      |         | Select the absolute .vm file under the theme’s templates directory.                                                                         |
| `--parse <path>`     | Yes      |         | Identify a literal /containers/<name>.vm include in the selected template.                                                                  |
| `--if-match <hash>`  | Yes      |         | Require the server’s current SHA-256 to match the reviewed version. A mismatch must be resolved before retrying.                            |
| `--before <path>`    | No       |         | Insert relative to this exact literal include path.                                                                                         |
| `--after <path>`     | No       |         | Insert after this exact literal include path.                                                                                               |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.                             |
| `--dry-run`          | No       |         | Inspect the proposed work without applying the command’s write. A warehouse dry run still contacts BigQuery for validation and an estimate. |

### sf template move

Reorder a literal include inside a template.

```text
uc-storefront sf template move --storefront <oid> --template <path> --parse <path> --if-match <hash> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

A template can serve many pages. Read it, inspect the affected includes, retain its hash, and inspect the --dry-run output before an authorized write.

| Input                | Required | Default | Usage                                                                                                                                       |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.                               |
| `--template <path>`  | Yes      |         | Select the absolute .vm file under the theme’s templates directory.                                                                         |
| `--parse <path>`     | Yes      |         | Identify a literal /containers/<name>.vm include in the selected template.                                                                  |
| `--if-match <hash>`  | Yes      |         | Require the server’s current SHA-256 to match the reviewed version. A mismatch must be resolved before retrying.                            |
| `--before <path>`    | No       |         | Insert relative to this exact literal include path.                                                                                         |
| `--after <path>`     | No       |         | Insert after this exact literal include path.                                                                                               |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.                             |
| `--dry-run`          | No       |         | Inspect the proposed work without applying the command’s write. A warehouse dry run still contacts BigQuery for validation and an estimate. |

### sf locate

Find rendered widget targets by following a page’s template and container references.

```text
uc-storefront sf locate <targets...> --storefront <oid> --uri <path> [options]
```

Effects: Read. Uses a remote service.

Literal include traversal can find conditional branches that do not render for every shopper. Dynamic includes and unsearched areas remain limits; a match is not proof of visible output.

| Input                | Required | Default | Usage                                                                                                              |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| `<targets...>`       | Yes      |         | One or more widget IDs or rendered target identifiers to locate. Quote each shell argument.                        |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.      |
| `--uri <path>`       | Yes      |         | Supply the exact catalog page path used to resolve or render the requested content.                                |
| `--theme <oid>`      | No       |         | Select a theme by OID. A theme context does not turn shared page or item content into a draft.                     |
| `--search-theme`     | No       |         | Read theme containers beyond the page’s reachable includes. This broadens scope and performs a read per container. |

### sf files

Read, upload, replace, and restore storefront files.

```text
uc-storefront sf files <command>
```

Children: `sf files upload`, `sf files put`, `sf files list`, `sf files get`, `sf files versions`, `sf files revert`.

### sf files upload

Upload a supported binary asset, with conflict and resume controls.

```text
uc-storefront sf files upload <local> --storefront <oid> --to <path> [options]
```

Effects: Live / server write, Local write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

Uploads can persist a local recovery file. Reuse a staged upload only after reviewing the current remote hash and the recorded state.

| Input                | Required | Default | Usage                                                                                                            |
| -------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------- |
| `<local>`            | Yes      |         | Local input file to upload or write to the chosen server destination.                                            |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.    |
| `--to <path>`        | Yes      |         | Select the exact absolute server destination path.                                                               |
| `--if-match <hash>`  | No       |         | Require the server’s current SHA-256 to match the reviewed version. A mismatch must be resolved before retrying. |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.  |
| `--state <file>`     | No       |         | Persist resumable upload state to this local file. Default: the input filename plus .upload.json.                |
| `--resume`           | No       |         | Reuse staged upload state after a conflict or precondition response. Requires a reviewed --if-match value.       |

### sf files put

Create or replace a JSON or CSS text file.

```text
uc-storefront sf files put <local> --storefront <oid> --to <path> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

This interface accepts JSON and plain CSS, not arbitrary JavaScript, HTML, or Velocity. Supply exactly one of --create and --if-match. All writes require --live, including draft-theme targets.

| Input                | Required | Default | Usage                                                                                                            |
| -------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------- |
| `<local>`            | Yes      |         | Local input file to upload or write to the chosen server destination.                                            |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.    |
| `--to <path>`        | Yes      |         | Select the exact absolute server destination path.                                                               |
| `--create`           | No       |         | Create a missing server target. Existing targets require the appropriate baseline or conflict hash instead.      |
| `--if-match <hash>`  | No       |         | Require the server’s current SHA-256 to match the reviewed version. A mismatch must be resolved before retrying. |
| `--live`             | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.  |
| `--comment <text>`   | No       |         | Attach a history note to this server write.                                                                      |

### sf files list

Read one storefront directory’s entries.

```text
uc-storefront sf files list --storefront <oid> [options]
```

Effects: Read. Uses a remote service.

| Input                   | Required | Default | Usage                                                                                                         |
| ----------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>`    | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--path <path>`         | No       |         | List entries under an absolute storefront filesystem path.                                                    |
| `--directory-oid <oid>` | No       |         | List a server filesystem directory by its OID.                                                                |
| `--theme <oid>`         | No       |         | Select a theme by OID. A theme context does not turn shared page or item content into a draft.                |
| `--max-entries <count>` | No       |         | Cap entries returned by one server directory read.                                                            |

### sf files get

Read the current or selected historical text-file content.

```text
uc-storefront sf files get <path> --storefront <oid> [options]
```

Effects: Read. Uses a remote service.

| Input                     | Required | Default | Usage                                                                                                         |
| ------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `<path>`                  | Yes      |         | Exact absolute storefront path for this resource.                                                             |
| `--storefront <oid>`      | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--file-version <number>` | No       |         | Select an exact historical file version reported by sf files versions.                                        |

### sf files versions

List a file’s historical versions.

```text
uc-storefront sf files versions <path> --storefront <oid>
```

Effects: Read. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `<path>`             | Yes      |         | Exact absolute storefront path for this resource.                                                             |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |

### sf files revert

Restore a file version and record the restore as a new version.

```text
uc-storefront sf files revert <path> --storefront <oid> --file-version <number> [options]
```

Effects: Live / server write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

Use a reviewed --if-match for a precise conflict boundary. A CJSON restore can remove widgets; a running page experiment can block it. Pull a fresh baseline after a successful restore.

| Input                     | Required | Default | Usage                                                                                                            |
| ------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------- |
| `<path>`                  | Yes      |         | Exact absolute storefront path for this resource.                                                                |
| `--storefront <oid>`      | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.    |
| `--file-version <number>` | Yes      |         | Select an exact historical file version reported by sf files versions.                                           |
| `--if-match <hash>`       | No       |         | Require the server’s current SHA-256 to match the reviewed version. A mismatch must be resolved before retrying. |
| `--live`                  | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.  |
| `--allow-removals`        | No       |         | Acknowledge that a CJSON push or restore drops widget IDs found in its comparison version.                       |
| `--comment <text>`        | No       |         | Attach a history note to this server write.                                                                      |

### sf pull

Read a CJSON file and preserve its remote baseline locally.

```text
uc-storefront sf pull <path> --storefront <oid> --out <file>
```

Effects: Read, Local write. Uses a remote service.

The requested CJSON file must exist. A page can render a shared theme container or another slot without having body.cjson. Resolve its template first. Keep the .sf.json baseline beside the editing file.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `<path>`             | Yes      |         | Exact absolute storefront path for this resource.                                                             |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--out <file>`       | Yes      |         | Write the result to a local file. Pull commands create a new editing file and baseline; use a fresh filename. |

### sf push

Validate and submit a complete CJSON file against its baseline.

```text
uc-storefront sf push <file> --storefront <oid> --to <path> [options]
```

Effects: Live / server write, Local write. Uses a remote service.

Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.

A page body is shared by every theme and is a live write. --theme supplies compilation context. Existing files use the pull baseline and an If-Match hash; do not replace a missing baseline with a blind overwrite.

| Input                         | Required | Default | Usage                                                                                                                        |
| ----------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `<file>`                      | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute.                                        |
| `--storefront <oid>`          | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.                |
| `--to <path>`                 | Yes      |         | Select the exact absolute server destination path.                                                                           |
| `--create`                    | No       |         | Create a missing server target. Existing targets require the appropriate baseline or conflict hash instead.                  |
| `--live`                      | No       |         | Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.              |
| `--theme <oid>`               | No       |         | Select a theme by OID. A theme context does not turn shared page or item content into a draft.                               |
| `--allow-removals`            | No       |         | Acknowledge that a CJSON push or restore drops widget IDs found in its comparison version.                                   |
| `--allow-unknown-config-keys` | No       |         | Downgrade newly authored unknown or legacy configuration keys to warnings. This can hide mistakes; inspect the schema first. |

### sf render

Render local CJSON on the server with explicit page and theme context.

```text
uc-storefront sf render <file> [selector] --storefront <oid> --theme <oid> --uri <path> [options]
```

Effects: Read. Uses a remote service.

| Input                     | Required | Default | Usage                                                                                                         |
| ------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `<file>`                  | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute.                         |
| `[selector]`              | No       |         | Exact widget ID or canonical tree path from cjson tree. Use a stable ID when sibling order may change.        |
| `--storefront <oid>`      | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--theme <oid>`           | Yes      |         | Select a theme by OID. A theme context does not turn shared page or item content into a draft.                |
| `--uri <path>`            | Yes      |         | Supply the exact catalog page path used to resolve or render the requested content.                           |
| `--group <path>`          | No       |         | Supply the catalog group context needed by group-bound widgets.                                               |
| `--item <id>`             | No       |         | Supply the merchant item ID needed by item-bound widgets.                                                     |
| `--language <iso-code>`   | No       |         | Select the render language by ISO code.                                                                       |
| `--allow-default-context` | No       |         | Allow the server to infer missing group or item context. Prefer explicit context when reproducing a page.     |
| `--edit-mode`             | No       |         | Render builder-visible branches rather than only the shopper-visible branch.                                  |

### sf preview

Manage temporary server previews and their access links.

```text
uc-storefront sf preview <command>
```

Children: `sf preview start`, `sf preview stage`, `sf preview open`, `sf preview end`.

### sf preview start

Create a temporary preview session.

```text
uc-storefront sf preview start --storefront <oid>
```

Effects: Preview session. Uses a remote service.

Creates a temporary preview session that expires after eight hours. It does not publish content.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |

### sf preview stage

Replace the set of local documents staged in a preview.

```text
uc-storefront sf preview stage --storefront <oid> --session <id> [options]
```

Effects: Preview session. Uses a remote service.

Staging replaces the session’s entire staged set. Include every file that must remain staged. Temporary preview content is not a saved storefront edit.

| Input                         | Required | Default | Usage                                                                                                                        |
| ----------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>`          | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.                |
| `--session <id>`              | Yes      |         | Select the temporary preview session returned by sf preview start.                                                           |
| `--file <local=remote>`       | No       | []      | Stage a local CJSON file at a theme or page-container path. Repeat for all files that the preview must retain.               |
| `--item <local>`              | No       | []      | Stage an item container pulled with sf containers pull. Its baseline identifies the owner and slot.                          |
| `--upsell <local=offer oid>`  | No       | []      | Stage a local upsell page for a specific offer OID. Repeat for multiple offers.                                              |
| `--theme <oid>`               | No       |         | Select a theme by OID. A theme context does not turn shared page or item content into a draft.                               |
| `--allow-unknown-config-keys` | No       |         | Downgrade newly authored unknown or legacy configuration keys to warnings. This can hide mistakes; inspect the schema first. |

### sf preview open

Create a one-use browser access URL for a preview.

```text
uc-storefront sf preview open --storefront <oid> --theme <oid> [options]
```

Effects: Preview session. Uses a remote service.

The returned access URL is single-use and can authorize a preview session. Treat it as private. Previewing a body or item does not publish it.

| Input                  | Required | Default | Usage                                                                                                         |
| ---------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>`   | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--theme <oid>`        | Yes      |         | Select a theme by OID. A theme context does not turn shared page or item content into a draft.                |
| `--session <id>`       | No       |         | Select the temporary preview session returned by sf preview start.                                            |
| `--path <path>`        | No       | "/"     | Select the exact catalog page path, including its leading slash.                                              |
| `--variation <n>`      | No       |         | Select a zero-based experiment or upsell variation index.                                                     |
| `--upsell <offer oid>` | No       |         | Open this offer’s preview page. Preview acceptance controls do not perform checkout actions.                  |
| `--pre`                | No       |         | Use the pre-checkout popup frame when opening an upsell preview.                                              |

### sf preview end

End a preview session before its expiry.

```text
uc-storefront sf preview end --storefront <oid> --session <id>
```

Effects: Preview session. Uses a remote service.

| Input                | Required | Default | Usage                                                                                                         |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `--storefront <oid>` | Yes      |         | Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID. |
| `--session <id>`     | Yes      |         | Select the temporary preview session returned by sf preview start.                                            |

### schema

Inspect local widget schemas and placement constraints.

```text
uc-storefront schema <command>
```

Children: `schema list`, `schema show`, `schema children`, `schema parents`.

### schema list

Search the installed widget vocabulary.

```text
uc-storefront schema list [options]
```

Effects: Read. Local interface.

| Input             | Required | Default | Usage                                                 |
| ----------------- | -------- | ------- | ----------------------------------------------------- |
| `--search <text>` | No       |         | Filter names or descriptions using the supplied text. |

### schema show

Read configuration fields and placement rules for a widget type.

```text
uc-storefront schema show <widget-type> [options]
```

Effects: Read. Local interface.

| Input                | Required | Default | Usage                                                                                                        |
| -------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| `<widget-type>`      | Yes      |         | Exact widget type from schema list or sf elements list, as appropriate to this command.                      |
| `--raw`              | No       |         | Return the catalog’s underlying configuration schema.                                                        |
| `--keys <keys>`      | No       |         | Select comma-separated exact configuration keys for JSON output.                                             |
| `--placement <mode>` | No       |         | Use compact JSON placement output to omit unrestricted child expansion while keeping explicit allowed lists. |

### schema children

Find permitted or documented child widget types.

```text
uc-storefront schema children <widget-type> [options]
```

Effects: Read. Local interface.

| Input             | Required | Default | Usage                                                                                   |
| ----------------- | -------- | ------- | --------------------------------------------------------------------------------------- |
| `<widget-type>`   | Yes      |         | Exact widget type from schema list or sf elements list, as appropriate to this command. |
| `--search <text>` | No       |         | Filter names or descriptions using the supplied text.                                   |

### schema parents

Read the ancestry requirements for a widget type.

```text
uc-storefront schema parents <widget-type>
```

Effects: Read. Local interface.

| Input           | Required | Default | Usage                                                                                   |
| --------------- | -------- | ------- | --------------------------------------------------------------------------------------- |
| `<widget-type>` | Yes      |         | Exact widget type from schema list or sf elements list, as appropriate to this command. |

### catalog

Inspect the installed evidence catalog and its integrity.

```text
uc-storefront catalog <command>
```

Children: `catalog info`, `catalog verify`.

### catalog info

Read the local catalog’s version and provenance.

```text
uc-storefront catalog info
```

Effects: Read. Local interface.

### catalog verify

Check the catalog’s documents, schemas, and integrity digest.

```text
uc-storefront catalog verify
```

Effects: Read. Local interface.

### element

Search local element knowledge and behavior.

```text
uc-storefront element <command>
```

Children: `element search`, `element explain`, `element docs`.

### element search

Find element types by purpose or name.

```text
uc-storefront element search <query> [options]
```

Effects: Read. Local interface.

| Input             | Required | Default | Usage                                                               |
| ----------------- | -------- | ------- | ------------------------------------------------------------------- |
| `<query>`         | Yes      |         | Search text for the local catalog or recipe index.                  |
| `--limit <count>` | No       | 20      | Cap the number of matching entries or diagnostics in this response. |

### element explain

Read a bounded explanation of one element’s behavior.

```text
uc-storefront element explain <widget-type> [options]
```

Effects: Read. Local interface.

| Input              | Required | Default | Usage                                                                                   |
| ------------------ | -------- | ------- | --------------------------------------------------------------------------------------- |
| `<widget-type>`    | Yes      |         | Exact widget type from schema list or sf elements list, as appropriate to this command. |
| `--budget <bytes>` | No       | 12000   | Limit the UTF-8 size of a context or documentation packet.                              |

### element docs

Read local documentation for an element or one section.

```text
uc-storefront element docs <widget-type> [options]
```

Effects: Read. Local interface.

| Input              | Required | Default | Usage                                                                                   |
| ------------------ | -------- | ------- | --------------------------------------------------------------------------------------- |
| `<widget-type>`    | Yes      |         | Exact widget type from schema list or sf elements list, as appropriate to this command. |
| `--section <name>` | No       |         | Choose a documentation section, such as purpose, runtime, or gotchas.                   |
| `--budget <bytes>` | No       | 12000   | Limit the UTF-8 size of a context or documentation packet.                              |
| `--full`           | No       |         | Return untruncated content instead of the normal bounded packet.                        |

### guide

Search the guides included in the separately installed toolkit.

```text
uc-storefront guide <command>
```

Children: `guide list`, `guide search`, `guide show`.

### guide list

List available installed guides.

```text
uc-storefront guide list
```

Effects: Read. Local interface.

### guide search

Search installed guide text.

```text
uc-storefront guide search <query> [options]
```

Effects: Read. Local interface.

| Input             | Required | Default | Usage                                                               |
| ----------------- | -------- | ------- | ------------------------------------------------------------------- |
| `<query>`         | Yes      |         | Search text for the local catalog or recipe index.                  |
| `--limit <count>` | No       | 20      | Cap the number of matching entries or diagnostics in this response. |

### guide show

Read a bounded installed guide.

```text
uc-storefront guide show <guide-id> [options]
```

Effects: Read. Local interface.

| Input              | Required | Default | Usage                                                            |
| ------------------ | -------- | ------- | ---------------------------------------------------------------- |
| `<guide-id>`       | Yes      |         | Installed guide identifier from guide list or guide search.      |
| `--budget <bytes>` | No       | 12000   | Limit the UTF-8 size of a context or documentation packet.       |
| `--full`           | No       |         | Return untruncated content instead of the normal bounded packet. |

### cjson

Inspect, validate, and mutate local widget documents.

```text
uc-storefront cjson <command>
```

Children: `cjson init`, `cjson tree`, `cjson inspect`, `cjson context`, `cjson find`, `cjson validate`, `cjson apply`, `cjson add`, `cjson update`, `cjson remove`, `cjson move`.

### cjson init

Create a local CJSON document.

```text
uc-storefront cjson init <file> [options]
```

Effects: Local write. Local interface.

Local CJSON writes are atomic. Use --dry-run to inspect an edit, then inspect its diff and validate. New local IDs still need native allocation before a remote write.

| Input                  | Required | Default     | Usage                                                                                                                                       |
| ---------------------- | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`               | Yes      |             | Local CJSON document path, relative to the current working directory unless absolute.                                                       |
| `--type <widget-type>` | No       | "container" | Choose the widget type from the installed catalog.                                                                                          |
| `--id <id>`            | No       |             | Supply a widget ID explicitly. Creating a local document does not reserve native IDs.                                                       |
| `--title <title>`      | No       |             | Set the page title.                                                                                                                         |
| `--config <key=value>` | No       | []          | Set a configuration property; repeat as needed. Use key@small=value, key@medium=value, or key@large=value for a breakpoint.                 |
| `--force`              | No       |             | Replace an existing local file. Inspect or back up the old file first.                                                                      |
| `--dry-run`            | No       |             | Inspect the proposed work without applying the command’s write. A warehouse dry run still contacts BigQuery for validation and an estimate. |
| `--full`               | No       |             | Include the full result or document instead of the usual bounded response. This can expose more content to a consuming agent.               |
| `--allow-invalid`      | No       |             | Permit a local edit to retain hard validation errors. This does not disable server validation.                                              |

### cjson tree

Read widget IDs and canonical tree paths.

```text
uc-storefront cjson tree <file>
```

Effects: Read. Local interface.

| Input    | Required | Default | Usage                                                                                 |
| -------- | -------- | ------- | ------------------------------------------------------------------------------------- |
| `<file>` | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute. |

### cjson inspect

Inspect a selected widget with a size budget.

```text
uc-storefront cjson inspect <file> <selector> [options]
```

Effects: Read. Local interface.

| Input              | Required | Default | Usage                                                                                                  |
| ------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `<file>`           | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute.                  |
| `<selector>`       | Yes      |         | Exact widget ID or canonical tree path from cjson tree. Use a stable ID when sibling order may change. |
| `--depth <levels>` | No       | 0       | Include this many descendant levels beneath the selected widget.                                       |
| `--budget <bytes>` | No       | 12000   | Limit the UTF-8 size of a context or documentation packet.                                             |
| `--full`           | No       |         | Return untruncated content instead of the normal bounded packet.                                       |

### cjson context

Build a bounded authoring context packet for a widget.

```text
uc-storefront cjson context <file> <selector> [options]
```

Effects: Read. Local interface.

| Input              | Required | Default | Usage                                                                                                  |
| ------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `<file>`           | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute.                  |
| `<selector>`       | Yes      |         | Exact widget ID or canonical tree path from cjson tree. Use a stable ID when sibling order may change. |
| `--authoring`      | No       |         | Include catalog guidance for the widget types visible in this context packet.                          |
| `--types <types>`  | No       |         | Limit authoring guidance to comma-separated visible widget types. Requires --authoring.                |
| `--intent <text>`  | No       |         | Use this intent to select relevant authoring guidance. Requires --authoring.                           |
| `--depth <levels>` | No       | 0       | Include this many descendant levels beneath the selected widget.                                       |
| `--budget <bytes>` | No       | 12000   | Limit the UTF-8 size of a context or documentation packet.                                             |

### cjson find

Find widgets by type, title, or content.

```text
uc-storefront cjson find <file> [options]
```

Effects: Read. Local interface.

| Input                  | Required | Default | Usage                                                                                 |
| ---------------------- | -------- | ------- | ------------------------------------------------------------------------------------- |
| `<file>`               | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute. |
| `--type <widget-type>` | No       |         | Choose the widget type from the installed catalog.                                    |
| `--title <text>`       | No       |         | Supply a widget title or search for matching titles, according to the command.        |
| `--text <text>`        | No       |         | Search textual widget content.                                                        |

### cjson validate

Check local structural invariants and schema diagnostics.

```text
uc-storefront cjson validate <file> [options]
```

Effects: Read. Local interface.

A clean local validation does not prove that a server push will succeed or that the page looks correct. Push checks authored changes against the baseline and server state.

| Input             | Required | Default | Usage                                                                                 |
| ----------------- | -------- | ------- | ------------------------------------------------------------------------------------- |
| `<file>`          | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute. |
| `--limit <count>` | No       | 100     | Cap the number of matching entries or diagnostics in this response.                   |
| `--all`           | No       |         | Return every validation diagnostic instead of stopping at the normal limit.           |

### cjson apply

Apply an ordered local edit plan atomically.

```text
uc-storefront cjson apply <file> --plan <file> [options]
```

Effects: Local write. Local interface.

Local CJSON writes are atomic. Use --dry-run to inspect an edit, then inspect its diff and validate. New local IDs still need native allocation before a remote write.

| Input             | Required | Default | Usage                                                                                                                                       |
| ----------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`          | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute.                                                       |
| `--plan <file>`   | Yes      |         | Read the versioned JSON edit plan from a local file.                                                                                        |
| `--dry-run`       | No       |         | Inspect the proposed work without applying the command’s write. A warehouse dry run still contacts BigQuery for validation and an estimate. |
| `--full`          | No       |         | Include the full result or document instead of the usual bounded response. This can expose more content to a consuming agent.               |
| `--allow-invalid` | No       |         | Permit a local edit to retain hard validation errors. This does not disable server validation.                                              |

### cjson add

Insert a new widget under a selected parent.

```text
uc-storefront cjson add <file> --parent <selector> --type <widget-type> [options]
```

Effects: Local write. Local interface.

Local CJSON writes are atomic. Use --dry-run to inspect an edit, then inspect its diff and validate. New local IDs still need native allocation before a remote write.

| Input                  | Required | Default | Usage                                                                                                                                       |
| ---------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`               | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute.                                                       |
| `--parent <selector>`  | Yes      |         | Select the destination parent by canonical widget path or ID.                                                                               |
| `--type <widget-type>` | Yes      |         | Choose the widget type from the installed catalog.                                                                                          |
| `--id <id>`            | No       |         | Supply a widget ID explicitly. Creating a local document does not reserve native IDs.                                                       |
| `--title <title>`      | No       |         | Set the page title.                                                                                                                         |
| `--at <index>`         | No       |         | Insert before this child index instead of using the normal append position.                                                                 |
| `--config <key=value>` | No       | []      | Set a configuration property; repeat as needed. Use key@small=value, key@medium=value, or key@large=value for a breakpoint.                 |
| `--dry-run`            | No       |         | Inspect the proposed work without applying the command’s write. A warehouse dry run still contacts BigQuery for validation and an estimate. |
| `--full`               | No       |         | Include the full result or document instead of the usual bounded response. This can expose more content to a consuming agent.               |
| `--allow-invalid`      | No       |         | Permit a local edit to retain hard validation errors. This does not disable server validation.                                              |

### cjson update

Patch widget fields with JSON Pointer assignments.

```text
uc-storefront cjson update <file> <selector> [options]
```

Effects: Local write. Local interface.

Local CJSON writes are atomic. Use --dry-run to inspect an edit, then inspect its diff and validate. New local IDs still need native allocation before a remote write.

| Input                        | Required | Default | Usage                                                                                                                                       |
| ---------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`                     | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute.                                                       |
| `<selector>`                 | Yes      |         | Exact widget ID or canonical tree path from cjson tree. Use a stable ID when sibling order may change.                                      |
| `--set <json-pointer=value>` | No       | []      | Assign a field with a JSON Pointer. Repeat for multiple assignments; an empty right-hand value sets an empty string.                        |
| `--unset <json-pointer>`     | No       | []      | Remove a configuration key rather than assigning an empty string.                                                                           |
| `--dry-run`                  | No       |         | Inspect the proposed work without applying the command’s write. A warehouse dry run still contacts BigQuery for validation and an estimate. |
| `--full`                     | No       |         | Include the full result or document instead of the usual bounded response. This can expose more content to a consuming agent.               |
| `--allow-invalid`            | No       |         | Permit a local edit to retain hard validation errors. This does not disable server validation.                                              |

### cjson remove

Remove a widget and its descendants from a local document.

```text
uc-storefront cjson remove <file> <selector> [options]
```

Effects: Local write. Local interface.

Local CJSON writes are atomic. Use --dry-run to inspect an edit, then inspect its diff and validate. New local IDs still need native allocation before a remote write.

| Input             | Required | Default | Usage                                                                                                                                       |
| ----------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`          | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute.                                                       |
| `<selector>`      | Yes      |         | Exact widget ID or canonical tree path from cjson tree. Use a stable ID when sibling order may change.                                      |
| `--dry-run`       | No       |         | Inspect the proposed work without applying the command’s write. A warehouse dry run still contacts BigQuery for validation and an estimate. |
| `--full`          | No       |         | Include the full result or document instead of the usual bounded response. This can expose more content to a consuming agent.               |
| `--allow-invalid` | No       |         | Permit a local edit to retain hard validation errors. This does not disable server validation.                                              |

### cjson move

Move a local widget subtree to a new parent or position.

```text
uc-storefront cjson move <file> <selector> --parent <selector> [options]
```

Effects: Local write. Local interface.

Local CJSON writes are atomic. Use --dry-run to inspect an edit, then inspect its diff and validate. New local IDs still need native allocation before a remote write.

| Input                 | Required | Default | Usage                                                                                                                                       |
| --------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`              | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute.                                                       |
| `<selector>`          | Yes      |         | Exact widget ID or canonical tree path from cjson tree. Use a stable ID when sibling order may change.                                      |
| `--parent <selector>` | Yes      |         | Select the destination parent by canonical widget path or ID.                                                                               |
| `--at <index>`        | No       |         | Insert before this child index instead of using the normal append position.                                                                 |
| `--dry-run`           | No       |         | Inspect the proposed work without applying the command’s write. A warehouse dry run still contacts BigQuery for validation and an estimate. |
| `--full`              | No       |         | Include the full result or document instead of the usual bounded response. This can expose more content to a consuming agent.               |
| `--allow-invalid`     | No       |         | Permit a local edit to retain hard validation errors. This does not disable server validation.                                              |

### tree

Read widget IDs and canonical tree paths.

```text
uc-storefront tree <file>
```

Effects: Read. Local interface.

Legacy root alias for cjson tree. Prefer the cjson namespace in new scripts.

| Input    | Required | Default | Usage                                                                                 |
| -------- | -------- | ------- | ------------------------------------------------------------------------------------- |
| `<file>` | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute. |

### inspect

Inspect a selected widget with a size budget.

```text
uc-storefront inspect <file> <selector> [options]
```

Effects: Read. Local interface.

Legacy root alias for cjson inspect. Prefer the cjson namespace in new scripts.

| Input              | Required | Default | Usage                                                                                                  |
| ------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `<file>`           | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute.                  |
| `<selector>`       | Yes      |         | Exact widget ID or canonical tree path from cjson tree. Use a stable ID when sibling order may change. |
| `--depth <levels>` | No       | 0       | Include this many descendant levels beneath the selected widget.                                       |
| `--budget <bytes>` | No       | 12000   | Limit the UTF-8 size of a context or documentation packet.                                             |
| `--full`           | No       |         | Return untruncated content instead of the normal bounded packet.                                       |

### context

Build a bounded authoring context packet for a widget.

```text
uc-storefront context <file> <selector> [options]
```

Effects: Read. Local interface.

Legacy root alias for cjson context. Prefer the cjson namespace in new scripts.

| Input              | Required | Default | Usage                                                                                                  |
| ------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `<file>`           | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute.                  |
| `<selector>`       | Yes      |         | Exact widget ID or canonical tree path from cjson tree. Use a stable ID when sibling order may change. |
| `--authoring`      | No       |         | Include catalog guidance for the widget types visible in this context packet.                          |
| `--types <types>`  | No       |         | Limit authoring guidance to comma-separated visible widget types. Requires --authoring.                |
| `--intent <text>`  | No       |         | Use this intent to select relevant authoring guidance. Requires --authoring.                           |
| `--depth <levels>` | No       | 0       | Include this many descendant levels beneath the selected widget.                                       |
| `--budget <bytes>` | No       | 12000   | Limit the UTF-8 size of a context or documentation packet.                                             |

### find

Find widgets by type, title, or content.

```text
uc-storefront find <file> [options]
```

Effects: Read. Local interface.

Legacy root alias for cjson find. Prefer the cjson namespace in new scripts.

| Input                  | Required | Default | Usage                                                                                 |
| ---------------------- | -------- | ------- | ------------------------------------------------------------------------------------- |
| `<file>`               | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute. |
| `--type <widget-type>` | No       |         | Choose the widget type from the installed catalog.                                    |
| `--title <text>`       | No       |         | Supply a widget title or search for matching titles, according to the command.        |
| `--text <text>`        | No       |         | Search textual widget content.                                                        |

### validate

Check local structural invariants and schema diagnostics.

```text
uc-storefront validate <file> [options]
```

Effects: Read. Local interface.

Legacy root alias for cjson validate. Prefer the cjson namespace in new scripts.

A clean local validation does not prove that a server push will succeed or that the page looks correct. Push checks authored changes against the baseline and server state.

| Input             | Required | Default | Usage                                                                                 |
| ----------------- | -------- | ------- | ------------------------------------------------------------------------------------- |
| `<file>`          | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute. |
| `--limit <count>` | No       | 100     | Cap the number of matching entries or diagnostics in this response.                   |
| `--all`           | No       |         | Return every validation diagnostic instead of stopping at the normal limit.           |

### apply

Apply an ordered local edit plan atomically.

```text
uc-storefront apply <file> --plan <file> [options]
```

Effects: Local write. Local interface.

Legacy root alias for cjson apply. Prefer the cjson namespace in new scripts.

Local CJSON writes are atomic. Use --dry-run to inspect an edit, then inspect its diff and validate. New local IDs still need native allocation before a remote write.

| Input             | Required | Default | Usage                                                                                                                                       |
| ----------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`          | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute.                                                       |
| `--plan <file>`   | Yes      |         | Read the versioned JSON edit plan from a local file.                                                                                        |
| `--dry-run`       | No       |         | Inspect the proposed work without applying the command’s write. A warehouse dry run still contacts BigQuery for validation and an estimate. |
| `--full`          | No       |         | Include the full result or document instead of the usual bounded response. This can expose more content to a consuming agent.               |
| `--allow-invalid` | No       |         | Permit a local edit to retain hard validation errors. This does not disable server validation.                                              |

### add

Insert a new widget under a selected parent.

```text
uc-storefront add <file> --parent <selector> --type <widget-type> [options]
```

Effects: Local write. Local interface.

Legacy root alias for cjson add. Prefer the cjson namespace in new scripts.

Local CJSON writes are atomic. Use --dry-run to inspect an edit, then inspect its diff and validate. New local IDs still need native allocation before a remote write.

| Input                  | Required | Default | Usage                                                                                                                                       |
| ---------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`               | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute.                                                       |
| `--parent <selector>`  | Yes      |         | Select the destination parent by canonical widget path or ID.                                                                               |
| `--type <widget-type>` | Yes      |         | Choose the widget type from the installed catalog.                                                                                          |
| `--id <id>`            | No       |         | Supply a widget ID explicitly. Creating a local document does not reserve native IDs.                                                       |
| `--title <title>`      | No       |         | Set the page title.                                                                                                                         |
| `--at <index>`         | No       |         | Insert before this child index instead of using the normal append position.                                                                 |
| `--config <key=value>` | No       | []      | Set a configuration property; repeat as needed. Use key@small=value, key@medium=value, or key@large=value for a breakpoint.                 |
| `--dry-run`            | No       |         | Inspect the proposed work without applying the command’s write. A warehouse dry run still contacts BigQuery for validation and an estimate. |
| `--full`               | No       |         | Include the full result or document instead of the usual bounded response. This can expose more content to a consuming agent.               |
| `--allow-invalid`      | No       |         | Permit a local edit to retain hard validation errors. This does not disable server validation.                                              |

### update

Patch widget fields with JSON Pointer assignments.

```text
uc-storefront update <file> <selector> [options]
```

Effects: Local write. Local interface.

Legacy root alias for cjson update. Prefer the cjson namespace in new scripts.

Local CJSON writes are atomic. Use --dry-run to inspect an edit, then inspect its diff and validate. New local IDs still need native allocation before a remote write.

| Input                        | Required | Default | Usage                                                                                                                                       |
| ---------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`                     | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute.                                                       |
| `<selector>`                 | Yes      |         | Exact widget ID or canonical tree path from cjson tree. Use a stable ID when sibling order may change.                                      |
| `--set <json-pointer=value>` | No       | []      | Assign a field with a JSON Pointer. Repeat for multiple assignments; an empty right-hand value sets an empty string.                        |
| `--unset <json-pointer>`     | No       | []      | Remove a configuration key rather than assigning an empty string.                                                                           |
| `--dry-run`                  | No       |         | Inspect the proposed work without applying the command’s write. A warehouse dry run still contacts BigQuery for validation and an estimate. |
| `--full`                     | No       |         | Include the full result or document instead of the usual bounded response. This can expose more content to a consuming agent.               |
| `--allow-invalid`            | No       |         | Permit a local edit to retain hard validation errors. This does not disable server validation.                                              |

### remove

Remove a widget and its descendants from a local document.

```text
uc-storefront remove <file> <selector> [options]
```

Effects: Local write. Local interface.

Legacy root alias for cjson remove. Prefer the cjson namespace in new scripts.

Local CJSON writes are atomic. Use --dry-run to inspect an edit, then inspect its diff and validate. New local IDs still need native allocation before a remote write.

| Input             | Required | Default | Usage                                                                                                                                       |
| ----------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`          | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute.                                                       |
| `<selector>`      | Yes      |         | Exact widget ID or canonical tree path from cjson tree. Use a stable ID when sibling order may change.                                      |
| `--dry-run`       | No       |         | Inspect the proposed work without applying the command’s write. A warehouse dry run still contacts BigQuery for validation and an estimate. |
| `--full`          | No       |         | Include the full result or document instead of the usual bounded response. This can expose more content to a consuming agent.               |
| `--allow-invalid` | No       |         | Permit a local edit to retain hard validation errors. This does not disable server validation.                                              |

### move

Move a local widget subtree to a new parent or position.

```text
uc-storefront move <file> <selector> --parent <selector> [options]
```

Effects: Local write. Local interface.

Legacy root alias for cjson move. Prefer the cjson namespace in new scripts.

Local CJSON writes are atomic. Use --dry-run to inspect an edit, then inspect its diff and validate. New local IDs still need native allocation before a remote write.

| Input                 | Required | Default | Usage                                                                                                                                       |
| --------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<file>`              | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute.                                                       |
| `<selector>`          | Yes      |         | Exact widget ID or canonical tree path from cjson tree. Use a stable ID when sibling order may change.                                      |
| `--parent <selector>` | Yes      |         | Select the destination parent by canonical widget path or ID.                                                                               |
| `--at <index>`        | No       |         | Insert before this child index instead of using the normal append position.                                                                 |
| `--dry-run`           | No       |         | Inspect the proposed work without applying the command’s write. A warehouse dry run still contacts BigQuery for validation and an estimate. |
| `--full`              | No       |         | Include the full result or document instead of the usual bounded response. This can expose more content to a consuming agent.               |
| `--allow-invalid`     | No       |         | Permit a local edit to retain hard validation errors. This does not disable server validation.                                              |

### warehouse

Execute bounded warehouse SQL through Google Cloud’s bq CLI.

```text
uc-storefront warehouse <command>
```

Children: `warehouse query`.

### warehouse query

Dry-run SQL, check scan limits and datasets, then execute unless dry-run-only was requested.

```text
uc-storefront warehouse query <sql> [options]
```

Effects: Read, Warehouse execution, Local write. Uses a remote service.

Execution is the default. Always include --dry-run when requesting only an estimate. Review the SQL, project, resolved tables, parameters, and byte ceiling before execution.

| Input                           | Required | Default | Usage                                                                                                                                       |
| ------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `<sql>`                         | Yes      |         | A quoted SQL string. This command executes after validation unless --dry-run is supplied.                                                   |
| `--merchant <id>`               | No       |         | Resolve the warehouse project from the merchant code using the ultracart-dw-<lowercase code> convention.                                    |
| `--project <id>`                | No       |         | Select an explicit warehouse project for installations that do not use the merchant-code convention.                                        |
| `--max-bytes <size>`            | No       |         | Set the scan ceiling, such as 500mb or 1GiB. The default is 20GiB. Inspect the estimate before execution.                                   |
| `--parameter <name:type:value>` | No       | []      | Bind a typed BigQuery query parameter. Repeat for multiple values.                                                                          |
| `--audit-log <file>`            | No       |         | Append an operation audit record to a local JSON-lines file.                                                                                |
| `--dry-run`                     | No       |         | Inspect the proposed work without applying the command’s write. A warehouse dry run still contacts BigQuery for validation and an estimate. |

### recipe

Inspect, capture, and instantiate reusable local widget patterns.

```text
uc-storefront recipe <command>
```

Children: `recipe list`, `recipe search`, `recipe example`, `recipe capture`, `recipe instantiate`.

### recipe list

List built-in and workspace recipe files.

```text
uc-storefront recipe list [options]
```

Effects: Read. Local interface.

| Input                | Required | Default | Usage                                                            |
| -------------------- | -------- | ------- | ---------------------------------------------------------------- |
| `--directory <path>` | No       |         | Choose a local directory containing reusable recipe definitions. |

### recipe search

Search available recipes by their metadata.

```text
uc-storefront recipe search <query> [options]
```

Effects: Read. Local interface.

| Input                | Required | Default | Usage                                                            |
| -------------------- | -------- | ------- | ---------------------------------------------------------------- |
| `<query>`            | Yes      |         | Search text for the local catalog or recipe index.               |
| `--directory <path>` | No       |         | Choose a local directory containing reusable recipe definitions. |

### recipe example

Emit a built-in recipe definition as JSON.

```text
uc-storefront recipe example [name]
```

Effects: Read. Local interface.

| Input    | Required | Default | Usage                                                                |
| -------- | -------- | ------- | -------------------------------------------------------------------- |
| `[name]` | No       |         | Built-in recipe name; omit to inspect the available default example. |

### recipe capture

Save a selected widget subtree as a new local recipe.

```text
uc-storefront recipe capture <file> <selector> [options]
```

Effects: Local write. Local interface.

| Input           | Required | Default | Usage                                                                                                         |
| --------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `<file>`        | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute.                         |
| `<selector>`    | Yes      |         | Exact widget ID or canonical tree path from cjson tree. Use a stable ID when sibling order may change.        |
| `--out <file>`  | No       |         | Write the result to a local file. Pull commands create a new editing file and baseline; use a fresh filename. |
| `--name <name>` | No       |         | Name the captured recipe. The selected widget title or type is used when omitted.                             |

### recipe instantiate

Produce an edit plan using a recipe and an explicit list of IDs.

```text
uc-storefront recipe instantiate <recipe-file> <file> --parent <selector> --ids <file> [options]
```

Effects: Read. Local interface.

This outputs a JSON edit plan; it does not change the CJSON file or reserve IDs. Apply the reviewed plan with cjson apply.

| Input                 | Required | Default | Usage                                                                                                                           |
| --------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `<recipe-file>`       | Yes      |         | Local recipe JSON definition. Its widget count determines the required ID count.                                                |
| `<file>`              | Yes      |         | Local CJSON document path, relative to the current working directory unless absolute.                                           |
| `--parent <selector>` | Yes      |         | Select the destination parent by canonical widget path or ID.                                                                   |
| `--ids <file>`        | Yes      |         | Read exactly one reserved numeric ID per recipe widget from a JSON array or a JSON sf ids receipt. Text output is not accepted. |
| `--params <file>`     | No       |         | Read recipe parameter overrides from JSON; omitted parameters use recipe defaults.                                              |

### workspace

Initialize project manifests and local agent integrations.

```text
uc-storefront workspace <command>
```

Children: `workspace init`.

### workspace init

Create or update a workspace manifest and selected skill copies.

```text
uc-storefront workspace init [directory] [options]
```

Effects: Local write. Local interface.

These commands change local workspace files. Inspect --dry-run and use --no-input with explicit targets for repeatable automation.

| Input                  | Required | Default | Usage                                                                                                                                       |
| ---------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `[directory]`          | No       |         | Workspace directory to initialize. Omission uses the current working directory.                                                             |
| `--target <agent>`     | No       |         | Select codex, claude, or gemini; repeat to select several, or use all.                                                                      |
| `--no-input`           | No       |         | Disable interactive prompts. Supply every necessary selection explicitly.                                                                   |
| `--dry-run`            | No       |         | Inspect the proposed work without applying the command’s write. A warehouse dry run still contacts BigQuery for validation and an estimate. |
| `--allow-downgrade`    | No       |         | Allow this toolkit version to replace newer skill copies it owns.                                                                           |
| `--no-skills`          | No       |         | Initialize the workspace without installing agent skill integrations.                                                                       |
| `--recipes-dir <path>` | No       |         | Set the recipe directory relative to the workspace root.                                                                                    |

### init

Initialize a workspace; use cjson init to create a widget document.

```text
uc-storefront init [directory] [options]
```

Effects: Local write. Local interface.

These commands change local workspace files. Inspect --dry-run and use --no-input with explicit targets for repeatable automation.

| Input                  | Required | Default | Usage                                                                                                                                       |
| ---------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `[directory]`          | No       |         | Workspace directory to initialize. Omission uses the current working directory.                                                             |
| `--target <agent>`     | No       |         | Select codex, claude, or gemini; repeat to select several, or use all.                                                                      |
| `--no-input`           | No       |         | Disable interactive prompts. Supply every necessary selection explicitly.                                                                   |
| `--dry-run`            | No       |         | Inspect the proposed work without applying the command’s write. A warehouse dry run still contacts BigQuery for validation and an estimate. |
| `--allow-downgrade`    | No       |         | Allow this toolkit version to replace newer skill copies it owns.                                                                           |
| `--no-skills`          | No       |         | Initialize the workspace without installing agent skill integrations.                                                                       |
| `--recipes-dir <path>` | No       |         | Set the recipe directory relative to the workspace root.                                                                                    |

### skills

Maintain toolkit skill copies in a local workspace.

```text
uc-storefront skills <command>
```

Children: `skills install`, `skills remove`, `skills status`.

### skills install

Install or refresh selected workspace skill copies.

```text
uc-storefront skills install [options]
```

Effects: Local write. Local interface.

These commands change local workspace files. Inspect --dry-run and use --no-input with explicit targets for repeatable automation.

| Input               | Required | Default | Usage                                                                                                                                       |
| ------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `--target <agent>`  | No       |         | Select codex, claude, or gemini; repeat to select several, or use all.                                                                      |
| `--no-input`        | No       |         | Disable interactive prompts. Supply every necessary selection explicitly.                                                                   |
| `--dry-run`         | No       |         | Inspect the proposed work without applying the command’s write. A warehouse dry run still contacts BigQuery for validation and an estimate. |
| `--allow-downgrade` | No       |         | Allow this toolkit version to replace newer skill copies it owns.                                                                           |

### skills remove

Remove selected owned skill integrations from a workspace.

```text
uc-storefront skills remove [options]
```

Effects: Local write. Local interface.

These commands change local workspace files. Inspect --dry-run and use --no-input with explicit targets for repeatable automation.

| Input               | Required | Default | Usage                                                                                                                                       |
| ------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `--target <agent>`  | No       |         | Select codex, claude, or gemini; repeat to select several, or use all.                                                                      |
| `--no-input`        | No       |         | Disable interactive prompts. Supply every necessary selection explicitly.                                                                   |
| `--dry-run`         | No       |         | Inspect the proposed work without applying the command’s write. A warehouse dry run still contacts BigQuery for validation and an estimate. |
| `--allow-downgrade` | No       |         | Allow this toolkit version to replace newer skill copies it owns.                                                                           |

### skills status

Compare installed skill copies against the toolkit’s expected state.

```text
uc-storefront skills status [options]
```

Effects: Read. Local interface.

| Input     | Required | Default | Usage                                                                                                              |
| --------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| `--check` | No       |         | Return exit status 3 when installed skills drift from the expected version; ordinary status remains informational. |
