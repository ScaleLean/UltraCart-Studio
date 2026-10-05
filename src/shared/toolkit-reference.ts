// Functional CLI signatures only. Descriptions and guides below are authored interface documentation.
// Snapshot: installed @ultracart/storefront-agent-toolchain 0.1.0-preview.11; no command actions or credentials read.
export const TOOLKIT_REFERENCE_VERSION = '0.1.0-preview.11';
export const TOOLKIT_REFERENCE_DATE = '2026-10-05';
export type ToolkitRisk = 'read' | 'local-write' | 'live-write' | 'allocation' | 'preview' | 'query' | 'auth';
export type ToolkitParameter = {
  syntax: string;
  description: string;
  required: boolean;
  defaultValue: string | null;
  choices?: readonly string[];
};
export type ToolkitCommand = {
  id: string;
  path: string;
  parent: string | null;
  group: boolean;
  summary: string;
  arguments: ToolkitParameter[];
  options: ToolkitParameter[];
  risks: ToolkitRisk[];
  network: boolean;
  notes: string[];
  examples: string[];
};
export type ToolkitGuide = {
  id: string;
  title: string;
  description: string;
  sections: { title: string; paragraphs: string[]; code?: string; commands?: string[] }[];
};
type Signature = [
  path: string,
  group: boolean,
  args: [syntax: string, defaultValue: string | null][],
  options: [syntax: string, required: boolean, defaultValue: string | null, choices: string[] | null][],
];
const signatures: Signature[] = [
  [
    '',
    true,
    [],
    [
      ['-V, --version', false, null, null],
      ['--workspace <directory>', false, null, null],
      ['--timings', false, null, null],
      ['--catalog-dir <directory>', false, null, null],
      ['--bundle-dir <directory>', false, null, null],
      ['--profile <name-or-uuid>', false, null, null],
      ['--format <format>', false, '"text"', ['text', 'json']],
    ],
  ],
  ['profile', true, [], []],
  ['profile list', false, [], []],
  ['profile create', false, [['<name>', null]], [['--registration <id>', false, null, null]]],
  ['profile show', false, [['[name-or-uuid]', null]], []],
  ['profile use', false, [['<name-or-uuid>', null]], []],
  [
    'profile rename',
    false,
    [
      ['<name-or-uuid>', null],
      ['<new-name>', null],
    ],
    [],
  ],
  ['profile remove', false, [['<name-or-uuid>', null]], []],
  [
    'profile bind',
    false,
    [['<name-or-uuid>', null]],
    [
      ['--directory <directory>', false, null, null],
      ['--merchant-id <merchant-id>', false, null, null],
    ],
  ],
  ['profile unbind', false, [], [['--directory <directory>', false, null, null]]],
  ['auth', true, [], []],
  [
    'auth login',
    false,
    [],
    [
      ['--profile <name-or-uuid>', false, null, null],
      ['--registration <id>', false, null, null],
    ],
  ],
  ['auth status', false, [], []],
  ['auth logout', false, [], [['--profile <name-or-uuid>', false, null, null]]],
  ['sf', true, [], []],
  ['sf sizes', true, [], []],
  [
    'sf sizes clear',
    false,
    [
      ['<file>', null],
      ['<selector>', null],
    ],
    [
      ['--dry-run', false, null, null],
      ['--full', false, null, null],
      ['--allow-invalid', false, null, null],
    ],
  ],
  ['sf surveys', true, [], []],
  [
    'sf surveys validate',
    false,
    [['<file>', null]],
    [
      ['--disqualified', false, null, null],
      ['--limit <count>', false, '100', null],
      ['--all', false, null, null],
    ],
  ],
  [
    'sf ids',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--count <number>', false, '1', null],
    ],
  ],
  ['sf storefronts', false, [], []],
  ['sf themes', false, [], [['--storefront <oid>', true, null, null]]],
  ['sf elements', true, [], []],
  ['sf elements list', false, [], []],
  ['sf elements get', false, [['<type>', null]], []],
  ['sf pages', true, [], []],
  [
    'sf pages get',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--path <path>', true, null, null],
    ],
  ],
  [
    'sf pages attributes',
    false,
    [['<file>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--path <path>', true, null, null],
      ['--live', false, null, null],
    ],
  ],
  ['sf pages refresh', false, [['<url>', null]], [['--storefront <oid>', true, null, null]]],
  ['sf pages images', true, [], []],
  [
    'sf pages images attach',
    false,
    [['<filename>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--path <path>', true, null, null],
      ['--code <code>', false, null, null],
      ['--default', false, null, null],
      ['--live', false, null, null],
      ['--description <text>', false, null, null],
    ],
  ],
  [
    'sf pages images detach',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--path <path>', true, null, null],
      ['--code <code>', false, null, null],
      ['--default', false, null, null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf pages list',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--under <path>', false, null, null],
      ['--template <vm>', false, null, null],
    ],
  ],
  [
    'sf pages templates',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--type <page type>', false, null, null],
    ],
  ],
  [
    'sf pages create',
    false,
    [['<path>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--template <vm>', false, null, null],
      ['--item-template <vm>', false, null, null],
      ['--title <title>', false, null, null],
      ['--description <text>', false, null, null],
      ['--page-type <type>', false, null, null],
      ['--no-sitemap', false, null, null],
      ['--noindex', false, null, null],
      ['--hidden', false, null, null],
      ['--visible-at <iso>', false, null, null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf pages settings',
    false,
    [['<file>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--path <path>', true, null, null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf pages duplicate',
    false,
    [
      ['<source>', null],
      ['<target>', null],
    ],
    [
      ['--storefront <oid>', true, null, null],
      ['--title <title>', false, null, null],
      ['--live', false, null, null],
    ],
  ],
  ['sf pages items', true, [], []],
  [
    'sf pages items get',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--path <path>', true, null, null],
    ],
  ],
  [
    'sf pages items add',
    false,
    [['<file>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--path <path>', true, null, null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf pages items remove',
    false,
    [['<itemIds...>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--path <path>', true, null, null],
      ['--live', false, null, null],
    ],
  ],
  ['sf pages blog-posts', true, [], []],
  [
    'sf pages blog-posts get',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--path <path>', true, null, null],
    ],
  ],
  [
    'sf pages blog-posts add',
    false,
    [['<oids...>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--path <path>', true, null, null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf pages blog-posts remove',
    false,
    [['<oids...>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--path <path>', true, null, null],
      ['--live', false, null, null],
    ],
  ],
  ['sf pages selectors', true, [], []],
  [
    'sf pages selectors get',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--path <path>', true, null, null],
    ],
  ],
  [
    'sf pages selectors set',
    false,
    [['<file>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--path <path>', true, null, null],
      ['--live', false, null, null],
    ],
  ],
  ['sf site', true, [], []],
  ['sf site get', false, [], [['--storefront <oid>', true, null, null]]],
  [
    'sf site attributes',
    false,
    [['<file>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--live', false, null, null],
    ],
  ],
  ['sf theme-attributes', true, [], []],
  [
    'sf theme-attributes get',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--theme <oid>', true, null, null],
      ['--all', false, null, null],
    ],
  ],
  [
    'sf theme-attributes set',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--theme <oid>', true, null, null],
      ['--set <name=value>', false, '[]', null],
      ['--file <patch.json>', false, null, null],
      ['--live', false, null, null],
    ],
  ],
  ['sf items', true, [], []],
  [
    'sf items get',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--item-id <id>', false, null, null],
      ['--item-oid <oid>', false, null, null],
    ],
  ],
  [
    'sf items attributes',
    false,
    [['<file>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--item-id <id>', false, null, null],
      ['--item-oid <oid>', false, null, null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf items content',
    false,
    [['<file>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--item-id <id>', false, null, null],
      ['--item-oid <oid>', false, null, null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf items seo',
    false,
    [['<file>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--item-id <id>', false, null, null],
      ['--item-oid <oid>', false, null, null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf items remove-attribute',
    false,
    [['<name>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--item-id <id>', false, null, null],
      ['--item-oid <oid>', false, null, null],
      ['--live', false, null, null],
    ],
  ],
  ['sf items images', true, [], []],
  [
    'sf items images attach',
    false,
    [['<path>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--item-id <id>', false, null, null],
      ['--item-oid <oid>', false, null, null],
      ['--code <code>', false, null, null],
      ['--default', false, null, null],
      ['--live', false, null, null],
      ['--description <text>', false, null, null],
    ],
  ],
  [
    'sf items images detach',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--item-id <id>', false, null, null],
      ['--item-oid <oid>', false, null, null],
      ['--code <code>', false, null, null],
      ['--default', false, null, null],
      ['--live', false, null, null],
    ],
  ],
  ['sf upsells', true, [], []],
  ['sf upsells paths', true, [], []],
  [
    'sf upsells paths list',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--status <status>', false, null, null],
      ['--location <location>', false, null, null],
      ['--search <text>', false, null, null],
      ['--max-results <n>', false, null, null],
      ['--offset <n>', false, null, null],
      ['--stats', false, null, null],
      ['--from <date>', false, null, null],
      ['--to <date>', false, null, null],
      ['--weekdays <days>', false, null, null],
    ],
  ],
  [
    'sf upsells paths get',
    false,
    [['<oid>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--out <file>', false, null, null],
      ['--stats', false, null, null],
      ['--from <date>', false, null, null],
      ['--to <date>', false, null, null],
      ['--weekdays <days>', false, null, null],
    ],
  ],
  [
    'sf upsells paths create',
    false,
    [['<file>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf upsells paths update',
    false,
    [['<file>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf upsells paths disable',
    false,
    [['<oid>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf upsells paths archive',
    false,
    [['<oid>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf upsells paths unarchive',
    false,
    [['<oid>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf upsells paths move',
    false,
    [['<oid>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--live', false, null, null],
      ['--to <where>', true, null, null],
    ],
  ],
  [
    'sf upsells paths duplicate',
    false,
    [['<oid>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--live', false, null, null],
      ['--variation <n>', false, null, null],
    ],
  ],
  ['sf upsells offers', true, [], []],
  [
    'sf upsells offers list',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--stats', false, null, null],
      ['--from <date>', false, null, null],
      ['--to <date>', false, null, null],
      ['--weekdays <days>', false, null, null],
    ],
  ],
  [
    'sf upsells offers get',
    false,
    [['<oid>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--out <file>', false, null, null],
      ['--stats', false, null, null],
      ['--from <date>', false, null, null],
      ['--to <date>', false, null, null],
      ['--weekdays <days>', false, null, null],
    ],
  ],
  [
    'sf upsells offers create',
    false,
    [['<file>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf upsells offers update',
    false,
    [['<file>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf upsells offers disable',
    false,
    [['<oid>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf upsells offers duplicate',
    false,
    [['<oid>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--live', false, null, null],
    ],
  ],
  ['sf blog-posts', true, [], []],
  [
    'sf blog-posts list',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--search <text>', false, null, null],
      ['--page <n>', false, null, null],
      ['--page-size <n>', false, null, null],
    ],
  ],
  ['sf blog-posts get', false, [['<oid>', null]], [['--storefront <oid>', true, null, null]]],
  [
    'sf blog-posts create',
    false,
    [['<file>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--body-file <html>', false, null, null],
      ['--excerpt-file <html>', false, null, null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf blog-posts update',
    false,
    [
      ['<oid>', null],
      ['<file>', null],
    ],
    [
      ['--storefront <oid>', true, null, null],
      ['--body-file <html>', false, null, null],
      ['--excerpt-file <html>', false, null, null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf blog-posts delete',
    false,
    [['<oid>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--live', false, null, null],
    ],
  ],
  ['sf blog-posts images', true, [], []],
  [
    'sf blog-posts images attach',
    false,
    [
      ['<oid>', null],
      ['<image>', null],
    ],
    [
      ['--storefront <oid>', true, null, null],
      ['--default', false, null, null],
      ['--code <code>', false, null, null],
      ['--inline', false, null, null],
      ['--filename <name>', false, null, null],
      ['--description <text>', false, null, null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf blog-posts images detach',
    false,
    [['<oid>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--default', false, null, null],
      ['--code <code>', false, null, null],
      ['--image <oid>', false, null, null],
      ['--live', false, null, null],
    ],
  ],
  ['sf logs', true, [], []],
  [
    'sf logs list',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--uri <text>', false, null, null],
      ['--since <window>', false, null, null],
      ['--errors-only', false, null, null],
      ['--limit <n>', false, null, null],
    ],
  ],
  [
    'sf logs get',
    false,
    [['<log_id>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--level <level>', false, '"warn"', null],
    ],
  ],
  ['sf recordings', true, [], []],
  [
    'sf recordings show',
    false,
    [['<screen_recording_uuid>', null]],
    [['--storefront <oid>', true, null, null]],
  ],
  [
    'sf recordings render',
    false,
    [['<screen_recording_uuid>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--page-view <uuid>', false, '[]', null],
      ['--limit <n>', false, null, null],
      ['--out <dir>', false, null, null],
      ['--video', false, null, null],
      ['--speed <x>', false, null, null],
      ['--skip-inactive', false, null, null],
      ['--show-input', false, null, null],
      ['--chrome <path>', false, null, null],
      ['--audit-log <file>', false, null, null],
    ],
  ],
  ['sf recordings status', false, [], [['--storefront <oid>', true, null, null]]],
  [
    'sf recordings enable',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf recordings disable',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--live', false, null, null],
    ],
  ],
  ['sf experiments', true, [], []],
  ['sf experiments objectives', false, [], [['--storefront <oid>', true, null, null]]],
  [
    'sf experiments list',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--status <status>', false, null, null],
      ['--type <type>', false, null, null],
      ['--path <path>', false, null, null],
    ],
  ],
  [
    'sf experiments get',
    false,
    [['<experimentOid>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--daily', false, null, null],
    ],
  ],
  [
    'sf experiments start-page',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--path <path>', true, null, null],
      ['--widget <id>', true, null, null],
      ['--slot <name>', false, '"body"', null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf experiments start-url',
    false,
    [['<file>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf experiments pause',
    false,
    [['<experimentOid>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--variation <n>', true, null, null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf experiments resume',
    false,
    [['<experimentOid>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--variation <n>', true, null, null],
      ['--live', false, null, null],
    ],
  ],
  [
    'sf experiments end',
    false,
    [['<experimentOid>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--winner <n>', false, null, null],
      ['--no-winner', false, null, null],
      ['--live', false, null, null],
    ],
  ],
  ['sf menus', true, [], []],
  ['sf menus list', false, [], [['--storefront <oid>', true, null, null]]],
  [
    'sf menus pull',
    false,
    [['<code>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--out <file>', true, null, null],
    ],
  ],
  [
    'sf menus push',
    false,
    [['<file>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--create', false, null, null],
      ['--live', false, null, null],
    ],
  ],
  ['sf containers', true, [], []],
  [
    'sf containers list',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--item-id <id>', false, null, null],
      ['--item-oid <oid>', false, null, null],
      ['--name <name>', false, null, null],
      ['--max-results <n>', false, null, null],
      ['--offset <n>', false, null, null],
      ['--all', false, null, null],
    ],
  ],
  [
    'sf containers pull',
    false,
    [['<file>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--owner-type <type>', true, null, null],
      ['--owner-id <id>', true, null, null],
      ['--name <name>', false, null, null],
    ],
  ],
  [
    'sf containers push',
    false,
    [['<file>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--owner-type <type>', true, null, null],
      ['--owner-id <id>', true, null, null],
      ['--name <name>', false, null, null],
      ['--comment <text>', false, null, null],
      ['--allow-warnings', false, null, null],
      ['--create', false, null, null],
      ['--remap-ids', false, null, null],
    ],
  ],
  [
    'sf containers versions',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--owner-type <type>', true, null, null],
      ['--owner-id <id>', true, null, null],
      ['--name <name>', false, null, null],
    ],
  ],
  [
    'sf containers revert',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--owner-type <type>', true, null, null],
      ['--owner-id <id>', true, null, null],
      ['--name <name>', false, null, null],
      ['--history-oid <oid>', true, null, null],
      ['--comment <text>', false, null, null],
    ],
  ],
  ['sf template', true, [], []],
  [
    'sf template find',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--uri <path>', true, null, null],
      ['--theme <oid>', false, null, null],
    ],
  ],
  [
    'sf template resolve',
    false,
    [['<name>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--theme <oid>', false, null, null],
    ],
  ],
  [
    'sf template wire',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--template <path>', true, null, null],
      ['--parse <path>', true, null, null],
      ['--if-match <hash>', true, null, null],
      ['--before <path>', false, null, null],
      ['--after <path>', false, null, null],
      ['--live', false, null, null],
      ['--dry-run', false, null, null],
    ],
  ],
  [
    'sf template unwire',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--template <path>', true, null, null],
      ['--parse <path>', true, null, null],
      ['--if-match <hash>', true, null, null],
      ['--before <path>', false, null, null],
      ['--after <path>', false, null, null],
      ['--live', false, null, null],
      ['--dry-run', false, null, null],
    ],
  ],
  [
    'sf template move',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--template <path>', true, null, null],
      ['--parse <path>', true, null, null],
      ['--if-match <hash>', true, null, null],
      ['--before <path>', false, null, null],
      ['--after <path>', false, null, null],
      ['--live', false, null, null],
      ['--dry-run', false, null, null],
    ],
  ],
  [
    'sf locate',
    false,
    [['<targets...>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--uri <path>', true, null, null],
      ['--theme <oid>', false, null, null],
      ['--search-theme', false, null, null],
    ],
  ],
  ['sf files', true, [], []],
  [
    'sf files upload',
    false,
    [['<local>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--to <path>', true, null, null],
      ['--if-match <hash>', false, null, null],
      ['--live', false, null, null],
      ['--state <file>', false, null, null],
      ['--resume', false, null, null],
    ],
  ],
  [
    'sf files put',
    false,
    [['<local>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--to <path>', true, null, null],
      ['--create', false, null, null],
      ['--if-match <hash>', false, null, null],
      ['--live', false, null, null],
      ['--comment <text>', false, null, null],
    ],
  ],
  [
    'sf files list',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--path <path>', false, null, null],
      ['--directory-oid <oid>', false, null, null],
      ['--theme <oid>', false, null, null],
      ['--max-entries <count>', false, null, null],
    ],
  ],
  [
    'sf files get',
    false,
    [['<path>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--file-version <number>', false, null, null],
    ],
  ],
  ['sf files versions', false, [['<path>', null]], [['--storefront <oid>', true, null, null]]],
  [
    'sf files revert',
    false,
    [['<path>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--file-version <number>', true, null, null],
      ['--if-match <hash>', false, null, null],
      ['--live', false, null, null],
      ['--allow-removals', false, null, null],
      ['--comment <text>', false, null, null],
    ],
  ],
  [
    'sf pull',
    false,
    [['<path>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--out <file>', true, null, null],
    ],
  ],
  [
    'sf push',
    false,
    [['<file>', null]],
    [
      ['--storefront <oid>', true, null, null],
      ['--to <path>', true, null, null],
      ['--create', false, null, null],
      ['--live', false, null, null],
      ['--theme <oid>', false, null, null],
      ['--allow-removals', false, null, null],
      ['--allow-unknown-config-keys', false, null, null],
    ],
  ],
  [
    'sf render',
    false,
    [
      ['<file>', null],
      ['[selector]', null],
    ],
    [
      ['--storefront <oid>', true, null, null],
      ['--theme <oid>', true, null, null],
      ['--uri <path>', true, null, null],
      ['--group <path>', false, null, null],
      ['--item <id>', false, null, null],
      ['--language <iso-code>', false, null, null],
      ['--allow-default-context', false, null, null],
      ['--edit-mode', false, null, null],
    ],
  ],
  ['sf preview', true, [], []],
  ['sf preview start', false, [], [['--storefront <oid>', true, null, null]]],
  [
    'sf preview stage',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--session <id>', true, null, null],
      ['--file <local=remote>', false, '[]', null],
      ['--item <local>', false, '[]', null],
      ['--upsell <local=offer oid>', false, '[]', null],
      ['--theme <oid>', false, null, null],
      ['--allow-unknown-config-keys', false, null, null],
    ],
  ],
  [
    'sf preview open',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--theme <oid>', true, null, null],
      ['--session <id>', false, null, null],
      ['--path <path>', false, '"/"', null],
      ['--variation <n>', false, null, null],
      ['--upsell <offer oid>', false, null, null],
      ['--pre', false, null, null],
    ],
  ],
  [
    'sf preview end',
    false,
    [],
    [
      ['--storefront <oid>', true, null, null],
      ['--session <id>', true, null, null],
    ],
  ],
  ['schema', true, [], []],
  ['schema list', false, [], [['--search <text>', false, null, null]]],
  [
    'schema show',
    false,
    [['<widget-type>', null]],
    [
      ['--raw', false, null, null],
      ['--keys <keys>', false, null, null],
      ['--placement <mode>', false, null, null],
    ],
  ],
  ['schema children', false, [['<widget-type>', null]], [['--search <text>', false, null, null]]],
  ['schema parents', false, [['<widget-type>', null]], []],
  ['catalog', true, [], []],
  ['catalog info', false, [], []],
  ['catalog verify', false, [], []],
  ['element', true, [], []],
  ['element search', false, [['<query>', null]], [['--limit <count>', false, '20', null]]],
  ['element explain', false, [['<widget-type>', null]], [['--budget <bytes>', false, '12000', null]]],
  [
    'element docs',
    false,
    [['<widget-type>', null]],
    [
      ['--section <name>', false, null, null],
      ['--budget <bytes>', false, '12000', null],
      ['--full', false, null, null],
    ],
  ],
  ['guide', true, [], []],
  ['guide list', false, [], []],
  ['guide search', false, [['<query>', null]], [['--limit <count>', false, '20', null]]],
  [
    'guide show',
    false,
    [['<guide-id>', null]],
    [
      ['--budget <bytes>', false, '12000', null],
      ['--full', false, null, null],
    ],
  ],
  ['cjson', true, [], []],
  [
    'cjson init',
    false,
    [['<file>', null]],
    [
      ['--type <widget-type>', false, '"container"', null],
      ['--id <id>', false, null, null],
      ['--title <title>', false, null, null],
      ['--config <key=value>', false, '[]', null],
      ['--force', false, null, null],
      ['--dry-run', false, null, null],
      ['--full', false, null, null],
      ['--allow-invalid', false, null, null],
    ],
  ],
  ['cjson tree', false, [['<file>', null]], []],
  [
    'cjson inspect',
    false,
    [
      ['<file>', null],
      ['<selector>', null],
    ],
    [
      ['--depth <levels>', false, '0', null],
      ['--budget <bytes>', false, '12000', null],
      ['--full', false, null, null],
    ],
  ],
  [
    'cjson context',
    false,
    [
      ['<file>', null],
      ['<selector>', null],
    ],
    [
      ['--authoring', false, null, null],
      ['--types <types>', false, null, null],
      ['--intent <text>', false, null, null],
      ['--depth <levels>', false, '0', null],
      ['--budget <bytes>', false, '12000', null],
    ],
  ],
  [
    'cjson find',
    false,
    [['<file>', null]],
    [
      ['--type <widget-type>', false, null, null],
      ['--title <text>', false, null, null],
      ['--text <text>', false, null, null],
    ],
  ],
  [
    'cjson validate',
    false,
    [['<file>', null]],
    [
      ['--limit <count>', false, '100', null],
      ['--all', false, null, null],
    ],
  ],
  [
    'cjson apply',
    false,
    [['<file>', null]],
    [
      ['--plan <file>', true, null, null],
      ['--dry-run', false, null, null],
      ['--full', false, null, null],
      ['--allow-invalid', false, null, null],
    ],
  ],
  [
    'cjson add',
    false,
    [['<file>', null]],
    [
      ['--parent <selector>', true, null, null],
      ['--type <widget-type>', true, null, null],
      ['--id <id>', false, null, null],
      ['--title <title>', false, null, null],
      ['--at <index>', false, null, null],
      ['--config <key=value>', false, '[]', null],
      ['--dry-run', false, null, null],
      ['--full', false, null, null],
      ['--allow-invalid', false, null, null],
    ],
  ],
  [
    'cjson update',
    false,
    [
      ['<file>', null],
      ['<selector>', null],
    ],
    [
      ['--set <json-pointer=value>', false, '[]', null],
      ['--unset <json-pointer>', false, '[]', null],
      ['--dry-run', false, null, null],
      ['--full', false, null, null],
      ['--allow-invalid', false, null, null],
    ],
  ],
  [
    'cjson remove',
    false,
    [
      ['<file>', null],
      ['<selector>', null],
    ],
    [
      ['--dry-run', false, null, null],
      ['--full', false, null, null],
      ['--allow-invalid', false, null, null],
    ],
  ],
  [
    'cjson move',
    false,
    [
      ['<file>', null],
      ['<selector>', null],
    ],
    [
      ['--parent <selector>', true, null, null],
      ['--at <index>', false, null, null],
      ['--dry-run', false, null, null],
      ['--full', false, null, null],
      ['--allow-invalid', false, null, null],
    ],
  ],
  ['tree', false, [['<file>', null]], []],
  [
    'inspect',
    false,
    [
      ['<file>', null],
      ['<selector>', null],
    ],
    [
      ['--depth <levels>', false, '0', null],
      ['--budget <bytes>', false, '12000', null],
      ['--full', false, null, null],
    ],
  ],
  [
    'context',
    false,
    [
      ['<file>', null],
      ['<selector>', null],
    ],
    [
      ['--authoring', false, null, null],
      ['--types <types>', false, null, null],
      ['--intent <text>', false, null, null],
      ['--depth <levels>', false, '0', null],
      ['--budget <bytes>', false, '12000', null],
    ],
  ],
  [
    'find',
    false,
    [['<file>', null]],
    [
      ['--type <widget-type>', false, null, null],
      ['--title <text>', false, null, null],
      ['--text <text>', false, null, null],
    ],
  ],
  [
    'validate',
    false,
    [['<file>', null]],
    [
      ['--limit <count>', false, '100', null],
      ['--all', false, null, null],
    ],
  ],
  [
    'apply',
    false,
    [['<file>', null]],
    [
      ['--plan <file>', true, null, null],
      ['--dry-run', false, null, null],
      ['--full', false, null, null],
      ['--allow-invalid', false, null, null],
    ],
  ],
  [
    'add',
    false,
    [['<file>', null]],
    [
      ['--parent <selector>', true, null, null],
      ['--type <widget-type>', true, null, null],
      ['--id <id>', false, null, null],
      ['--title <title>', false, null, null],
      ['--at <index>', false, null, null],
      ['--config <key=value>', false, '[]', null],
      ['--dry-run', false, null, null],
      ['--full', false, null, null],
      ['--allow-invalid', false, null, null],
    ],
  ],
  [
    'update',
    false,
    [
      ['<file>', null],
      ['<selector>', null],
    ],
    [
      ['--set <json-pointer=value>', false, '[]', null],
      ['--unset <json-pointer>', false, '[]', null],
      ['--dry-run', false, null, null],
      ['--full', false, null, null],
      ['--allow-invalid', false, null, null],
    ],
  ],
  [
    'remove',
    false,
    [
      ['<file>', null],
      ['<selector>', null],
    ],
    [
      ['--dry-run', false, null, null],
      ['--full', false, null, null],
      ['--allow-invalid', false, null, null],
    ],
  ],
  [
    'move',
    false,
    [
      ['<file>', null],
      ['<selector>', null],
    ],
    [
      ['--parent <selector>', true, null, null],
      ['--at <index>', false, null, null],
      ['--dry-run', false, null, null],
      ['--full', false, null, null],
      ['--allow-invalid', false, null, null],
    ],
  ],
  ['warehouse', true, [], []],
  [
    'warehouse query',
    false,
    [['<sql>', null]],
    [
      ['--merchant <id>', false, null, null],
      ['--project <id>', false, null, null],
      ['--max-bytes <size>', false, null, null],
      ['--parameter <name:type:value>', false, '[]', null],
      ['--audit-log <file>', false, null, null],
      ['--dry-run', false, null, null],
    ],
  ],
  ['recipe', true, [], []],
  ['recipe list', false, [], [['--directory <path>', false, null, null]]],
  ['recipe search', false, [['<query>', null]], [['--directory <path>', false, null, null]]],
  ['recipe example', false, [['[name]', null]], []],
  [
    'recipe capture',
    false,
    [
      ['<file>', null],
      ['<selector>', null],
    ],
    [
      ['--out <file>', false, null, null],
      ['--name <name>', false, null, null],
    ],
  ],
  [
    'recipe instantiate',
    false,
    [
      ['<recipe-file>', null],
      ['<file>', null],
    ],
    [
      ['--parent <selector>', true, null, null],
      ['--ids <file>', true, null, null],
      ['--params <file>', false, null, null],
    ],
  ],
  ['workspace', true, [], []],
  [
    'workspace init',
    false,
    [['[directory]', null]],
    [
      ['--target <agent>', false, null, null],
      ['--no-input', false, null, null],
      ['--dry-run', false, null, null],
      ['--allow-downgrade', false, null, null],
      ['--no-skills', false, null, null],
      ['--recipes-dir <path>', false, null, null],
    ],
  ],
  [
    'init',
    false,
    [['[directory]', null]],
    [
      ['--target <agent>', false, null, null],
      ['--no-input', false, null, null],
      ['--dry-run', false, null, null],
      ['--allow-downgrade', false, null, null],
      ['--no-skills', false, null, null],
      ['--recipes-dir <path>', false, null, null],
    ],
  ],
  ['skills', true, [], []],
  [
    'skills install',
    false,
    [],
    [
      ['--target <agent>', false, null, null],
      ['--no-input', false, null, null],
      ['--dry-run', false, null, null],
      ['--allow-downgrade', false, null, null],
    ],
  ],
  [
    'skills remove',
    false,
    [],
    [
      ['--target <agent>', false, null, null],
      ['--no-input', false, null, null],
      ['--dry-run', false, null, null],
      ['--allow-downgrade', false, null, null],
    ],
  ],
  ['skills status', false, [], [['--check', false, null, null]]],
];

export const toolkitRisks: Record<ToolkitRisk, { label: string; description: string }> = {
  read: {
    label: 'Read',
    description: 'Inspects data or emits a report. Network reads can retrieve private merchant content.',
  },
  'local-write': {
    label: 'Local write',
    description:
      'Can change local files, metadata, drafts, or credentials. This does not itself publish storefront content.',
  },
  'live-write': {
    label: 'Live / server write',
    description:
      'Changes server resources, storefront behavior, or shared content. Some commands can target drafts; inspect the exact target and flags.',
  },
  allocation: {
    label: 'ID allocation',
    description:
      'Reserves real server widget IDs. Allocation is a remote mutation even when the page has not been published.',
  },
  preview: {
    label: 'Preview session',
    description:
      'Creates or changes temporary server preview state or access links. It does not publish the staged content.',
  },
  query: {
    label: 'Warehouse execution',
    description:
      'Can run a billed BigQuery data query. Add --dry-run to stop after validation and the scan estimate.',
  },
  auth: {
    label: 'Authentication',
    description:
      'Creates, refreshes, or revokes an authorization connection. It is separate from storefront content editing.',
  },
};

const summaries: Record<string, string> = {
  '': 'Command-line interface for local CJSON authoring, merchant resources, previews, and warehouse reads.',
  profile: 'Choose and maintain merchant profiles and workspace bindings.',
  'profile list': 'List local profile identities without printing tokens.',
  'profile create': 'Create a named local merchant profile.',
  'profile show': 'Inspect the selected profile and how it was selected.',
  'profile use': 'Change the default profile for later CLI commands.',
  'profile rename': 'Change a profile name while retaining its identity.',
  'profile remove': 'Delete a local profile and its stored credentials.',
  'profile bind': 'Pin a workspace to a profile and optionally an expected merchant.',
  'profile unbind': 'Remove a workspace profile binding.',
  auth: 'Manage the toolkit’s UltraCart authorization connection.',
  'auth login': 'Start the UltraCart device authorization flow for a profile.',
  'auth status': 'Read a redacted local authorization readiness report.',
  'auth logout': 'Revoke the profile’s refresh token and clear its credential.',
  sf: 'Inspect and change remote StoreFront resources.',
  'sf sizes': 'Manage measurements stored inside local widget documents.',
  'sf sizes clear': 'Clear cached measurements on one local widget.',
  'sf surveys': 'Inspect SurveyJS definitions with the installed catalog.',
  'sf surveys validate': 'Check a local survey definition against the supported contract.',
  'sf ids': 'Allocate unique widget IDs from the selected storefront.',
  'sf storefronts': 'List stores that the selected merchant profile can access.',
  'sf themes': 'List a storefront’s themes and active-theme information.',
  'sf elements': 'Inspect the element contracts currently published by the server.',
  'sf elements list': 'List server element names and available contract metadata.',
  'sf elements get': 'Fetch the server schema and documentation for one element type.',
  'sf pages': 'Inspect page catalog records, assignments, attributes, and visibility.',
  'sf pages get': 'Read one catalog page and its declared fields.',
  'sf pages attributes': 'Patch the page attributes named in a local JSON file.',
  'sf pages refresh': 'Invalidate one page’s cached rendering.',
  'sf pages images': 'Manage default and named page image attachments.',
  'sf pages images attach': 'Attach an uploaded raster image to a page image slot.',
  'sf pages images detach': 'Remove a page image attachment while keeping the source asset.',
  'sf pages list': 'Read catalog page paths, templates, and settings.',
  'sf pages templates': 'List templates offered by the active theme.',
  'sf pages create': 'Create a remote catalog page beneath an existing parent.',
  'sf pages settings': 'Patch the supplied catalog-page settings.',
  'sf pages duplicate': 'Copy a page and its associated content to a new path.',
  'sf pages items': 'Manage product assignments on a catalog page.',
  'sf pages items get': 'Read the page’s assigned products and ordering.',
  'sf pages items add': 'Assign products using a JSON item list.',
  'sf pages items remove': 'Remove product assignments without deleting products.',
  'sf pages blog-posts': 'Manage blog-post assignments on a page.',
  'sf pages blog-posts get': 'Read the posts assigned to a page.',
  'sf pages blog-posts add': 'Assign the specified post IDs to a page.',
  'sf pages blog-posts remove': 'Remove the specified post assignments.',
  'sf pages selectors': 'Manage the rules that select products and posts for a page.',
  'sf pages selectors get': 'Read the page’s selector rules.',
  'sf pages selectors set': 'Replace the selector lists supplied in JSON.',
  'sf site': 'Inspect and edit attributes shared across the storefront.',
  'sf site get': 'Read site attributes and their declared usage.',
  'sf site attributes': 'Patch the supplied site attributes.',
  'sf theme-attributes': 'Inspect and update a theme’s colors, fonts, and settings.',
  'sf theme-attributes get': 'Read a theme’s applied settings and declared defaults.',
  'sf theme-attributes set': 'Patch selected theme setting values.',
  'sf items': 'Inspect and edit product content used by storefront elements.',
  'sf items get': 'Read a product’s content, images, and declared attributes.',
  'sf items attributes': 'Patch product attributes from a local JSON file.',
  'sf items content': 'Patch a product title or description.',
  'sf items seo': 'Patch a product’s search metadata.',
  'sf items remove-attribute': 'Remove an undeclared product attribute.',
  'sf items images': 'Manage product image attachments.',
  'sf items images attach': 'Attach an uploaded image to a product.',
  'sf items images detach': 'Remove a product image attachment.',
  'sf upsells': 'Inspect and manage checkout offer paths and individual offers.',
  'sf upsells paths': 'Manage the ordering, triggers, and variations of upsell paths.',
  'sf upsells paths list': 'Read upsell paths, with optional statistics and pagination.',
  'sf upsells paths get': 'Read one path; optionally save an editable local baseline.',
  'sf upsells paths create': 'Create an upsell path from JSON and retain a local baseline.',
  'sf upsells paths update': 'Replace an upsell path using its saved baseline.',
  'sf upsells paths disable': 'Switch an upsell path off.',
  'sf upsells paths archive': 'Archive a path so it no longer participates.',
  'sf upsells paths unarchive': 'Return an archived path to the normal list.',
  'sf upsells paths move': 'Change the execution order of an upsell path.',
  'sf upsells paths duplicate': 'Copy a path in a disabled state, or copy one variation.',
  'sf upsells offers': 'Manage individual upsell offers, rules, pricing, and schedules.',
  'sf upsells offers list': 'Read offers from active, non-archived paths.',
  'sf upsells offers get': 'Read an offer; optionally save a local editing baseline.',
  'sf upsells offers create': 'Create an offer from JSON and retain its baseline.',
  'sf upsells offers update': 'Replace an offer using its saved baseline.',
  'sf upsells offers disable': 'Switch an offer off.',
  'sf upsells offers duplicate': 'Copy an offer and its container in a disabled state.',
  'sf blog-posts': 'Manage posts, their content, visibility, and images.',
  'sf blog-posts list': 'Search or paginate blog posts.',
  'sf blog-posts get': 'Read one post and its page assignments.',
  'sf blog-posts create': 'Create a post from JSON, with optional HTML files.',
  'sf blog-posts update': 'Patch the supplied fields of an existing post.',
  'sf blog-posts delete': 'Permanently delete a post and remove its assignments.',
  'sf blog-posts images': 'Manage images attached to blog posts.',
  'sf blog-posts images attach': 'Upload a local image and attach it to a post.',
  'sf blog-posts images detach': 'Remove an image from a post and its body references.',
  'sf logs': 'Read server-side render diagnostics.',
  'sf logs list': 'List recent render events and their diagnostic counts.',
  'sf logs get': 'Read log lines for one server render.',
  'sf recordings': 'Inspect recording settings and replay captured sessions.',
  'sf recordings show': 'Read a recorded session’s page views and event summary.',
  'sf recordings render': 'Download selected replay events and create local frames or video.',
  'sf recordings status': 'Read the recording feature’s current status and usage information.',
  'sf recordings enable': 'Enable capture of real shopper sessions.',
  'sf recordings disable': 'Disable capture of shopper sessions.',
  'sf experiments': 'Inspect and control storefront experiments.',
  'sf experiments objectives': 'Read the available experiment objectives.',
  'sf experiments list': 'Read experiments and their reported statistics.',
  'sf experiments get': 'Inspect one experiment and its assessment.',
  'sf experiments start-page': 'Start an experiment widget already stored in a page slot.',
  'sf experiments start-url': 'Start an experiment that routes between existing pages.',
  'sf experiments pause': 'Pause traffic to a non-control variation.',
  'sf experiments resume': 'Resume traffic to a paused variation.',
  'sf experiments end': 'End an experiment and optionally choose a winner.',
  'sf menus': 'Read and replace store menus used by menu widgets.',
  'sf menus list': 'List store-menu identifiers.',
  'sf menus pull': 'Save a menu and its comparison baseline locally.',
  'sf menus push': 'Create or replace a live store menu from a local file.',
  'sf containers': 'Access owner containers stored as database rows.',
  'sf containers list': 'List item-container rows with filters and pagination.',
  'sf containers pull': 'Save an owner container and its baseline to a new local file.',
  'sf containers push': 'Create or replace an owner container from CJSON.',
  'sf containers versions': 'Read the history of an owner container.',
  'sf containers revert': 'Restore a historical owner-container version.',
  'sf template': 'Resolve templates and edit their literal container includes.',
  'sf template find': 'Resolve the templates assigned to an exact page.',
  'sf template resolve': 'Resolve a template name through the theme’s search paths.',
  'sf template wire': 'Add a literal container include to a template.',
  'sf template unwire': 'Remove a literal container include from a template.',
  'sf template move': 'Reorder a literal include inside a template.',
  'sf locate': 'Find rendered widget targets by following a page’s template and container references.',
  'sf files': 'Read, upload, replace, and restore storefront files.',
  'sf files upload': 'Upload a supported binary asset, with conflict and resume controls.',
  'sf files put': 'Create or replace a JSON or CSS text file.',
  'sf files list': 'Read one storefront directory’s entries.',
  'sf files get': 'Read the current or selected historical text-file content.',
  'sf files versions': 'List a file’s historical versions.',
  'sf files revert': 'Restore a file version and record the restore as a new version.',
  'sf pull': 'Read a CJSON file and preserve its remote baseline locally.',
  'sf push': 'Validate and submit a complete CJSON file against its baseline.',
  'sf render': 'Render local CJSON on the server with explicit page and theme context.',
  'sf preview': 'Manage temporary server previews and their access links.',
  'sf preview start': 'Create a temporary preview session.',
  'sf preview stage': 'Replace the set of local documents staged in a preview.',
  'sf preview open': 'Create a one-use browser access URL for a preview.',
  'sf preview end': 'End a preview session before its expiry.',
  schema: 'Inspect local widget schemas and placement constraints.',
  'schema list': 'Search the installed widget vocabulary.',
  'schema show': 'Read configuration fields and placement rules for a widget type.',
  'schema children': 'Find permitted or documented child widget types.',
  'schema parents': 'Read the ancestry requirements for a widget type.',
  catalog: 'Inspect the installed evidence catalog and its integrity.',
  'catalog info': 'Read the local catalog’s version and provenance.',
  'catalog verify': 'Check the catalog’s documents, schemas, and integrity digest.',
  element: 'Search local element knowledge and behavior.',
  'element search': 'Find element types by purpose or name.',
  'element explain': 'Read a bounded explanation of one element’s behavior.',
  'element docs': 'Read local documentation for an element or one section.',
  guide: 'Search the guides included in the separately installed toolkit.',
  'guide list': 'List available installed guides.',
  'guide search': 'Search installed guide text.',
  'guide show': 'Read a bounded installed guide.',
  cjson: 'Inspect, validate, and mutate local widget documents.',
  'cjson init': 'Create a local CJSON document.',
  'cjson tree': 'Read widget IDs and canonical tree paths.',
  'cjson inspect': 'Inspect a selected widget with a size budget.',
  'cjson context': 'Build a bounded authoring context packet for a widget.',
  'cjson find': 'Find widgets by type, title, or content.',
  'cjson validate': 'Check local structural invariants and schema diagnostics.',
  'cjson apply': 'Apply an ordered local edit plan atomically.',
  'cjson add': 'Insert a new widget under a selected parent.',
  'cjson update': 'Patch widget fields with JSON Pointer assignments.',
  'cjson remove': 'Remove a widget and its descendants from a local document.',
  'cjson move': 'Move a local widget subtree to a new parent or position.',
  warehouse: 'Execute bounded warehouse SQL through Google Cloud’s bq CLI.',
  'warehouse query':
    'Dry-run SQL, check scan limits and datasets, then execute unless dry-run-only was requested.',
  recipe: 'Inspect, capture, and instantiate reusable local widget patterns.',
  'recipe list': 'List built-in and workspace recipe files.',
  'recipe search': 'Search available recipes by their metadata.',
  'recipe example': 'Emit a built-in recipe definition as JSON.',
  'recipe capture': 'Save a selected widget subtree as a new local recipe.',
  'recipe instantiate': 'Produce an edit plan using a recipe and an explicit list of IDs.',
  workspace: 'Initialize project manifests and local agent integrations.',
  'workspace init': 'Create or update a workspace manifest and selected skill copies.',
  init: 'Initialize a workspace; use cjson init to create a widget document.',
  skills: 'Maintain toolkit skill copies in a local workspace.',
  'skills install': 'Install or refresh selected workspace skill copies.',
  'skills remove': 'Remove selected owned skill integrations from a workspace.',
  'skills status': 'Compare installed skill copies against the toolkit’s expected state.',
};

const optionHelp: Record<string, string> = {
  '-V, --version': 'Print the installed toolkit version and exit.',
  '--workspace <directory>':
    'Select the directory containing ultracart.json. Relative file arguments still use the current working directory.',
  '--timings': 'Write phase timings to standard error, separately from normal command output.',
  '--catalog-dir <directory>':
    'Use a different normalized widget catalog. This changes the local schema and documentation source.',
  '--bundle-dir <directory>': 'Select a legacy raw builder bundle for catalog importer development.',
  '--profile <name-or-uuid>':
    'Select a merchant profile explicitly. Otherwise the CLI can use its environment, workspace binding, or current profile.',
  '--format <format>':
    'Choose human-readable text or machine-readable JSON. Prefer JSON when another program consumes the result.',
  '--registration <id>': 'Choose a trusted OAuth application registration by its manifest identifier.',
  '--directory <directory>': 'Select the workspace directory whose profile binding will change.',
  '--merchant-id <merchant-id>': 'Record the expected merchant identity in the workspace binding.',
  '--dry-run':
    'Inspect the proposed work without applying the command’s write. A warehouse dry run still contacts BigQuery for validation and an estimate.',
  '--full':
    'Include the full result or document instead of the usual bounded response. This can expose more content to a consuming agent.',
  '--allow-invalid':
    'Permit a local edit to retain hard validation errors. This does not disable server validation.',
  '--disqualified':
    'Check that survey answers include a disqualified outcome for a widget configured to use it.',
  '--limit <count>': 'Cap the number of matching entries or diagnostics in this response.',
  '--all':
    'Expand this command’s normal filtered or bounded selection. Check the command note before using it on a large catalog.',
  '--storefront <oid>':
    'Use the exact storefront OID returned by sf storefronts. A hostname or merchant code is not a storefront OID.',
  '--count <number>':
    'Reserve this many new native widget IDs, from 1 to 10000. This consumes a real allocation; it is not a read.',
  '--path <path>': 'Select the exact catalog page path, including its leading slash.',
  '--code <code>': 'Select a named image slot. Do not combine it with --default.',
  '--default': 'Select the default image slot rather than a named slot.',
  '--live':
    'Acknowledge a server write that can affect the live storefront. This flag is not a dry-run or review mechanism.',
  '--description <text>':
    'Supply the page description or image description, according to this command’s target.',
  '--under <path>': 'Restrict the page catalog to this path and its descendants.',
  '--template <vm>':
    'Use a template filename, not an absolute path. Read available templates or an existing page first.',
  '--type <page type>':
    'Filter template declarations by page role: group for a page template, item for its item template.',
  '--item-template <vm>': 'Select the template filename used for item pages below the new page.',
  '--title <title>': 'Set the page title.',
  '--page-type <type>': 'Choose static S or dynamic D. The command uses D when omitted.',
  '--no-sitemap': 'Exclude this page from the sitemap and add noindex. Descendant pages are not changed.',
  '--noindex': 'Use the same page-level search exclusion as --no-sitemap.',
  '--hidden': 'Create a hidden page that responds with 404 until it becomes visible.',
  '--visible-at <iso>': 'Schedule visibility with an ISO-8601 timestamp.',
  '--theme <oid>':
    'Select a theme by OID. A theme context does not turn shared page or item content into a draft.',
  '--set <name=value>':
    'Set a named theme attribute; repeat for multiple attributes. Font values use JSON objects.',
  '--file <patch.json>':
    'Read a theme-attribute patch with an attributes array containing name and value, or name and font.',
  '--item-id <id>':
    'Identify a product by its merchant item ID. This is distinct from an item OID, even when it contains only digits.',
  '--item-oid <oid>': 'Identify a product by its OID. Supply exactly one of --item-id and --item-oid.',
  '--status <status>': 'Filter records by the status vocabulary described for this command.',
  '--location <location>': 'Filter upsell paths by pre-checkout or post-checkout location.',
  '--search <text>': 'Filter names or descriptions using the supplied text.',
  '--max-results <n>': 'Set a server page size from 1 to 500; the service uses 100 when omitted.',
  '--offset <n>': 'Start at this result offset. Request subsequent pages explicitly.',
  '--stats': 'Request extra performance statistics. This performs additional remote statistics work.',
  '--from <date>': 'Set the statistics window start as YYYY-MM-DD. Supply --to as well.',
  '--to <date>':
    'Set the statistics window end as YYYY-MM-DD. Omitting both dates uses the command’s last-30-days window.',
  '--weekdays <days>': 'Restrict statistics to comma-separated weekdays, using mon through sun.',
  '--out <file>':
    'Write the result to a local file. Pull commands create a new editing file and baseline; use a fresh filename.',
  '--to <where>': 'Move the upsell path up, down, top, or bottom.',
  '--variation <n>': 'Select a zero-based experiment or upsell variation index.',
  '--page <n>': 'Request a blog-post result page, starting at 1.',
  '--page-size <n>': 'Set blog-post results per page from 1 to 100; the service uses 50 when omitted.',
  '--body-file <html>': 'Read the blog-post body from a local HTML file.',
  '--excerpt-file <html>': 'Read the blog-post excerpt from a local HTML file.',
  '--inline': 'Attach the blog image for use inside the body rather than a named/default image slot.',
  '--filename <name>': 'Choose the uploaded blog image’s filename. Otherwise use the local filename.',
  '--image <oid>': 'Select the exact blog-post multimedia OID to detach.',
  '--uri <text>': 'Filter render logs by text in the requested address, ignoring case.',
  '--since <window>':
    'Select recent logs using a duration such as 15m or 2h, or an ISO timestamp. Default 1h; maximum 7 days.',
  '--errors-only': 'Return renders that failed or emitted an error.',
  '--limit <n>':
    'Bound the returned logs or selected recording page views. See the command-specific note for the range.',
  '--level <level>': 'Set the minimum log level: debug, info, warn, or error.',
  '--page-view <uuid>':
    'Render this recording page view. Repeat to select several; omission selects all page views.',
  '--out <dir>':
    'Choose a local replay output directory. The default is recordings/<recording UUID> under the working directory.',
  '--video': 'Produce a WebM replay for each selected page view in addition to the normal local output.',
  '--speed <x>': 'Set replay video speed from 0.25 to 16; default 1.',
  '--skip-inactive': 'Compress idle periods in replay video.',
  '--show-input':
    'Include visitor-entered text in the timeline. Password inputs stay hidden; other entries can contain private data.',
  '--chrome <path>': 'Select a Chrome executable for local replay rendering.',
  '--audit-log <file>': 'Append an operation audit record to a local JSON-lines file.',
  '--type <type>': 'Filter experiments by page, url, theme, or openai.',
  '--daily': 'Include daily statistics for each experiment variation.',
  '--widget <id>': 'Select the existing native ID of the experiment widget.',
  '--slot <name>': 'Select the page-container slot name without the .cjson suffix.',
  '--winner <n>': 'Finish the experiment with this variation as winner.',
  '--no-winner': 'Finish the experiment without selecting a winner.',
  '--create':
    'Create a missing server target. Existing targets require the appropriate baseline or conflict hash instead.',
  '--name <name>':
    'Select an item-container slot, ignoring case. Other container owner types have a single container.',
  '--owner-type <type>':
    'Use item, itemid, upsell, email, postcardfront, or postcardback. This determines the meaning of --owner-id.',
  '--owner-id <id>':
    'Use the item/upsell OID, merchant item ID for itemid, or the ESP UUID for email and postcard owners.',
  '--comment <text>': 'Attach a history note to this server write.',
  '--allow-warnings':
    'Allow server container validation warnings. Hard validation errors still block the write.',
  '--remap-ids':
    'With --create, reserve fresh IDs for every widget and rewrite their references when copying to another owner.',
  '--history-oid <oid>': 'Restore this exact container-history OID from the versions response.',
  '--uri <path>': 'Supply the exact catalog page path used to resolve or render the requested content.',
  '--template <path>': 'Select the absolute .vm file under the theme’s templates directory.',
  '--parse <path>': 'Identify a literal /containers/<name>.vm include in the selected template.',
  '--if-match <hash>':
    'Require the server’s current SHA-256 to match the reviewed version. A mismatch must be resolved before retrying.',
  '--before <path>': 'Insert relative to this exact literal include path.',
  '--after <path>': 'Insert after this exact literal include path.',
  '--search-theme':
    'Read theme containers beyond the page’s reachable includes. This broadens scope and performs a read per container.',
  '--to <path>': 'Select the exact absolute server destination path.',
  '--state <file>':
    'Persist resumable upload state to this local file. Default: the input filename plus .upload.json.',
  '--resume':
    'Reuse staged upload state after a conflict or precondition response. Requires a reviewed --if-match value.',
  '--directory-oid <oid>': 'List a server filesystem directory by its OID.',
  '--max-entries <count>': 'Cap entries returned by one server directory read.',
  '--file-version <number>': 'Select an exact historical file version reported by sf files versions.',
  '--allow-removals':
    'Acknowledge that a CJSON push or restore drops widget IDs found in its comparison version.',
  '--allow-unknown-config-keys':
    'Downgrade newly authored unknown or legacy configuration keys to warnings. This can hide mistakes; inspect the schema first.',
  '--group <path>': 'Supply the catalog group context needed by group-bound widgets.',
  '--item <id>': 'Supply the merchant item ID needed by item-bound widgets.',
  '--language <iso-code>': 'Select the render language by ISO code.',
  '--allow-default-context':
    'Allow the server to infer missing group or item context. Prefer explicit context when reproducing a page.',
  '--edit-mode': 'Render builder-visible branches rather than only the shopper-visible branch.',
  '--session <id>': 'Select the temporary preview session returned by sf preview start.',
  '--file <local=remote>':
    'Stage a local CJSON file at a theme or page-container path. Repeat for all files that the preview must retain.',
  '--item <local>':
    'Stage an item container pulled with sf containers pull. Its baseline identifies the owner and slot.',
  '--upsell <local=offer oid>':
    'Stage a local upsell page for a specific offer OID. Repeat for multiple offers.',
  '--upsell <offer oid>':
    'Open this offer’s preview page. Preview acceptance controls do not perform checkout actions.',
  '--pre': 'Use the pre-checkout popup frame when opening an upsell preview.',
  '--raw': 'Return the catalog’s underlying configuration schema.',
  '--keys <keys>': 'Select comma-separated exact configuration keys for JSON output.',
  '--placement <mode>':
    'Use compact JSON placement output to omit unrestricted child expansion while keeping explicit allowed lists.',
  '--budget <bytes>': 'Limit the UTF-8 size of a context or documentation packet.',
  '--section <name>': 'Choose a documentation section, such as purpose, runtime, or gotchas.',
  '--type <widget-type>': 'Choose the widget type from the installed catalog.',
  '--id <id>': 'Supply a widget ID explicitly. Creating a local document does not reserve native IDs.',
  '--title <text>': 'Supply a widget title or search for matching titles, according to the command.',
  '--config <key=value>':
    'Set a configuration property; repeat as needed. Use key@small=value, key@medium=value, or key@large=value for a breakpoint.',
  '--force': 'Replace an existing local file. Inspect or back up the old file first.',
  '--depth <levels>': 'Include this many descendant levels beneath the selected widget.',
  '--authoring': 'Include catalog guidance for the widget types visible in this context packet.',
  '--types <types>':
    'Limit authoring guidance to comma-separated visible widget types. Requires --authoring.',
  '--intent <text>': 'Use this intent to select relevant authoring guidance. Requires --authoring.',
  '--text <text>': 'Search textual widget content.',
  '--plan <file>': 'Read the versioned JSON edit plan from a local file.',
  '--parent <selector>': 'Select the destination parent by canonical widget path or ID.',
  '--at <index>': 'Insert before this child index instead of using the normal append position.',
  '--set <json-pointer=value>':
    'Assign a field with a JSON Pointer. Repeat for multiple assignments; an empty right-hand value sets an empty string.',
  '--unset <json-pointer>': 'Remove a configuration key rather than assigning an empty string.',
  '--merchant <id>':
    'Resolve the warehouse project from the merchant code using the ultracart-dw-<lowercase code> convention.',
  '--project <id>':
    'Select an explicit warehouse project for installations that do not use the merchant-code convention.',
  '--max-bytes <size>':
    'Set the scan ceiling, such as 500mb or 1GiB. The default is 20GiB. Inspect the estimate before execution.',
  '--parameter <name:type:value>': 'Bind a typed BigQuery query parameter. Repeat for multiple values.',
  '--directory <path>': 'Choose a local directory containing reusable recipe definitions.',
  '--ids <file>':
    'Read exactly one reserved numeric ID per recipe widget from a JSON array or a JSON sf ids receipt. Text output is not accepted.',
  '--params <file>': 'Read recipe parameter overrides from JSON; omitted parameters use recipe defaults.',
  '--target <agent>': 'Select codex, claude, or gemini; repeat to select several, or use all.',
  '--no-input': 'Disable interactive prompts. Supply every necessary selection explicitly.',
  '--allow-downgrade': 'Allow this toolkit version to replace newer skill copies it owns.',
  '--no-skills': 'Initialize the workspace without installing agent skill integrations.',
  '--recipes-dir <path>': 'Set the recipe directory relative to the workspace root.',
  '--check':
    'Return exit status 3 when installed skills drift from the expected version; ordinary status remains informational.',
};

function describeOption(path: string, syntax: string): string {
  if (path === 'recipe capture' && syntax === '--name <name>')
    return 'Name the captured recipe. The selected widget title or type is used when omitted.';
  if (syntax === '--all') {
    if (path === 'sf theme-attributes get')
      return 'Include every attribute type, rather than only color, rgba, and font slots.';
    if (path === 'sf containers list')
      return 'Fetch all pages of matching item-container metadata instead of one result page.';
    return 'Return every validation diagnostic instead of stopping at the normal limit.';
  }
  if (syntax === '--status <status>')
    return path.startsWith('sf upsells')
      ? 'Select current (non-archived), archived, or all upsell paths.'
      : 'Filter experiments by their reported status. Read the installed command help for accepted server status values.';
  if (syntax === '--path <path>' && path === 'sf files list')
    return 'List entries under an absolute storefront filesystem path.';
  if (syntax === '--audit-log <file>' && path === 'sf recordings render')
    return 'Append fetch/reuse metadata for selected page views to a local JSON-lines file; replay events remain in the replay output.';
  if (syntax === '--limit <n>')
    return path === 'sf logs list'
      ? 'Return between 1 and 100 log records. The service uses 25 when omitted.'
      : 'Stop after this many recording page views; omission permits every selected page view.';
  if (syntax === '--full' && /(?:inspect|element|guide)/.test(path))
    return 'Return untruncated content instead of the normal bounded packet.';
  return optionHelp[syntax] || 'See this command’s installed --help for the current option semantics.';
}

function describeArgument(path: string, syntax: string): string {
  const key = syntax.replace(/[<>\[\]]/g, '').replace(/\.\.\.$/, '');
  if (key === 'file') {
    if (path === 'sf containers pull')
      return 'New local CJSON output file; the CLI also writes its .sf.json baseline.';
    if (/^(?:sf (?:pages|items|site|blog-posts|upsells)|sf menus push)/.test(path))
      return 'Local JSON payload containing the fields or resource requested by this command. Inspect the matching get response and installed help first.';
    return 'Local CJSON document path, relative to the current working directory unless absolute.';
  }
  if (key === 'selector')
    return 'Exact widget ID or canonical tree path from cjson tree. Use a stable ID when sibling order may change.';
  if (key === 'path')
    return path === 'sf items images attach'
      ? 'Absolute server path of an image already uploaded to the storefront.'
      : 'Exact absolute storefront path for this resource.';
  if (key === 'name-or-uuid')
    return 'Profile name or persistent profile UUID. The optional form uses the resolved current profile.';
  if (key === 'name')
    return path === 'sf template resolve'
      ? 'Template filename to resolve through the theme’s configured resource paths.'
      : path === 'profile create'
        ? 'New local merchant-profile name.'
        : path === 'recipe example'
          ? 'Built-in recipe name; omit to inspect the available default example.'
          : 'Exact resource or attribute name.';
  if (key === 'new-name') return 'Replacement local profile name.';
  if (key === 'source') return 'Existing catalog page path to duplicate.';
  if (key === 'target') return 'New catalog page path for the duplicate.';
  if (key === 'targets')
    return 'One or more widget IDs or rendered target identifiers to locate. Quote each shell argument.';
  if (key === 'itemIds')
    return 'One or more merchant item IDs to remove from this page assignment; the products are not deleted.';
  if (key === 'oids') return 'One or more blog-post OIDs to add to or remove from this page assignment.';
  if (key === 'oid' || key === 'experimentOid')
    return 'Exact resource OID from the corresponding list or get response.';
  if (key === 'widget-type' || key === 'type')
    return 'Exact widget type from schema list or sf elements list, as appropriate to this command.';
  if (key === 'filename') return 'Image filename already present in the selected page folder.';
  if (key === 'code') return 'Exact store-menu code returned by sf menus list.';
  if (key === 'image') return 'Local image file to upload and attach to the blog post.';
  if (key === 'local') return 'Local input file to upload or write to the chosen server destination.';
  if (key === 'url') return 'Storefront URL whose cached page response should be refreshed.';
  if (key === 'log_id') return 'Render-log ID from sf logs list.';
  if (key === 'screen_recording_uuid')
    return 'Recording UUID from an authorized recording source; replay data can include shopper information.';
  if (key === 'query') return 'Search text for the local catalog or recipe index.';
  if (key === 'guide-id') return 'Installed guide identifier from guide list or guide search.';
  if (key === 'recipe-file')
    return 'Local recipe JSON definition. Its widget count determines the required ID count.';
  if (key === 'directory')
    return 'Workspace directory to initialize. Omission uses the current working directory.';
  if (key === 'sql')
    return 'A quoted SQL string. This command executes after validation unless --dry-run is supplied.';
  return 'Value for this positional argument; inspect the installed --help before use.';
}

const legacyCjson = new Set([
  'tree',
  'inspect',
  'context',
  'find',
  'validate',
  'apply',
  'add',
  'update',
  'remove',
  'move',
]);
const localMutators = new Set([
  'cjson init',
  'cjson apply',
  'cjson add',
  'cjson update',
  'cjson remove',
  'cjson move',
  'sf sizes clear',
]);
const serverReadVerbs = new Set([
  'get',
  'list',
  'show',
  'status',
  'themes',
  'storefronts',
  'objectives',
  'versions',
  'templates',
  'find',
  'resolve',
  'locate',
  'render',
]);

function commandEffects(path: string, group: boolean): { risks: ToolkitRisk[]; network: boolean } {
  if (group) return { risks: [], network: false };
  const canonical = legacyCjson.has(path) ? `cjson ${path}` : path;
  if (canonical === 'warehouse query') return { risks: ['read', 'query', 'local-write'], network: true };
  if (canonical === 'auth login') return { risks: ['auth', 'local-write'], network: true };
  if (canonical === 'auth logout' || canonical === 'profile remove')
    return { risks: ['auth', 'local-write'], network: true };
  if (canonical.startsWith('profile ') && !/(?:list|show)$/.test(canonical))
    return { risks: ['local-write'], network: false };
  if (
    localMutators.has(canonical) ||
    canonical === 'recipe capture' ||
    /^(?:workspace init|init|skills (?:install|remove))$/.test(canonical)
  )
    return { risks: ['local-write'], network: false };
  if (canonical === 'sf ids') return { risks: ['allocation'], network: true };
  if (canonical.startsWith('sf preview ')) return { risks: ['preview'], network: true };
  if (canonical === 'sf sizes clear' || canonical === 'sf surveys validate')
    return { risks: canonical === 'sf sizes clear' ? ['local-write'] : ['read'], network: false };
  if (canonical.startsWith('sf ')) {
    const verb = canonical.split(' ').at(-1)!;
    if (
      verb === 'pull' ||
      canonical === 'sf recordings render' ||
      /^sf upsells (paths|offers) get$/.test(canonical)
    )
      return { risks: ['read', 'local-write'], network: true };
    if (serverReadVerbs.has(verb)) return { risks: ['read'], network: true };
    const risks: ToolkitRisk[] = ['live-write'];
    if (canonical === 'sf containers push') risks.push('allocation');
    if (/^sf (?:files upload|push|menus push|upsells (?:paths|offers) (?:create|update))$/.test(canonical))
      risks.push('local-write');
    return { risks, network: true };
  }
  return { risks: ['read'], network: false };
}

function commandNotes(path: string, options: ToolkitParameter[]): string[] {
  const canonical = legacyCjson.has(path) ? `cjson ${path}` : path;
  const notes: string[] = [];
  if (legacyCjson.has(path))
    notes.push(`Legacy root alias for ${canonical}. Prefer the cjson namespace in new scripts.`);
  if (options.some((option) => option.syntax === '--live'))
    notes.push(
      'Server writes need the appropriate merchant permission. --live acknowledges impact; it does not perform a content review or create a preview.'
    );
  if (options.some((option) => option.syntax === '--item-id <id>'))
    notes.push(
      'Select exactly one product identity: --item-id or --item-oid. The parser lists both as optional because this rule is checked together.'
    );
  if (path.startsWith('sf containers '))
    notes.push(
      'Owner containers are database rows. Use sf pull / sf push for theme or page .cjson files. Only item/itemid owners use named slots.'
    );
  if (path === 'sf containers push')
    notes.push(
      'This is a server content write even though it has no --live flag. ID allocation occurs only with --create --remap-ids; preserve existing IDs for ordinary edits.'
    );
  if (path === 'sf containers revert')
    notes.push('Reverting creates a new server version. Any previous local baseline is stale afterwards.');
  if (path === 'sf pull')
    notes.push(
      'The requested CJSON file must exist. A page can render a shared theme container or another slot without having body.cjson. Resolve its template first. Keep the .sf.json baseline beside the editing file.'
    );
  if (path === 'sf push')
    notes.push(
      'A page body is shared by every theme and is a live write. --theme supplies compilation context. Existing files use the pull baseline and an If-Match hash; do not replace a missing baseline with a blind overwrite.'
    );
  if (path === 'sf ids')
    notes.push(
      'IDs are reserved immediately. Counts above 100 are split into requests. Do not repeat an uncertain allocation automatically.'
    );
  if (path === 'sf pages create')
    notes.push(
      'Select both group and item templates from the storefront. Omitted templates can inherit or fall back to names absent from the theme. Creation can make a page public immediately; body content is a separate write.'
    );
  if (path === 'sf pages refresh')
    notes.push(
      'This invalidates server cache. It is a remote mutation even though it does not edit content or expose --live.'
    );
  if (path.startsWith('sf template ') && /(?:wire|unwire|move)$/.test(path))
    notes.push(
      'A template can serve many pages. Read it, inspect the affected includes, retain its hash, and inspect the --dry-run output before an authorized write.'
    );
  if (path === 'sf locate')
    notes.push(
      'Literal include traversal can find conditional branches that do not render for every shopper. Dynamic includes and unsearched areas remain limits; a match is not proof of visible output.'
    );
  if (path === 'sf files put')
    notes.push(
      'This interface accepts JSON and plain CSS, not arbitrary JavaScript, HTML, or Velocity. Supply exactly one of --create and --if-match. All writes require --live, including draft-theme targets.'
    );
  if (path === 'sf files upload')
    notes.push(
      'Uploads can persist a local recovery file. Reuse a staged upload only after reviewing the current remote hash and the recorded state.'
    );
  if (path === 'sf files revert')
    notes.push(
      'Use a reviewed --if-match for a precise conflict boundary. A CJSON restore can remove widgets; a running page experiment can block it. Pull a fresh baseline after a successful restore.'
    );
  if (path === 'sf preview start')
    notes.push(
      'Creates a temporary preview session that expires after eight hours. It does not publish content.'
    );
  if (path === 'sf preview stage')
    notes.push(
      'Staging replaces the session’s entire staged set. Include every file that must remain staged. Temporary preview content is not a saved storefront edit.'
    );
  if (path === 'sf preview open')
    notes.push(
      'The returned access URL is single-use and can authorize a preview session. Treat it as private. Previewing a body or item does not publish it.'
    );
  if (path === 'sf menus push')
    notes.push('Menus are shared live data. A draft theme does not isolate a menu write.');
  if (path === 'sf recordings enable')
    notes.push(
      'This turns on capture of real shopper sessions. Enable it only for an explicit authorized purpose.'
    );
  if (path === 'sf recordings render')
    notes.push(
      'Local replay output can contain shopper content and entered text. Scope page views and output retention to the task.'
    );
  if (path === 'sf blog-posts create')
    notes.push(
      'A new post defaults to draft. Public or link visibility needs --live. Inspect the create payload before using it.'
    );
  if (path === 'sf blog-posts delete')
    notes.push(
      'This permanently deletes the post and its assignments. It is not a local removal or archive operation.'
    );
  if (path === 'sf experiments end')
    notes.push(
      'Choose --winner or --no-winner deliberately. Ending or selecting a winner changes experiment behavior.'
    );
  if (canonical === 'cjson validate')
    notes.push(
      'A clean local validation does not prove that a server push will succeed or that the page looks correct. Push checks authored changes against the baseline and server state.'
    );
  if (localMutators.has(canonical))
    notes.push(
      'Local CJSON writes are atomic. Use --dry-run to inspect an edit, then inspect its diff and validate. New local IDs still need native allocation before a remote write.'
    );
  if (path === 'recipe instantiate')
    notes.push(
      'This outputs a JSON edit plan; it does not change the CJSON file or reserve IDs. Apply the reviewed plan with cjson apply.'
    );
  if (path === 'warehouse query')
    notes.push(
      'Execution is the default. Always include --dry-run when requesting only an estimate. Review the SQL, project, resolved tables, parameters, and byte ceiling before execution.'
    );
  if (path === 'auth status')
    notes.push(
      'This inspects local credential readiness. It does not prove that the profile has current merchant access.'
    );
  if (path === 'auth logout')
    notes.push(
      'This revokes the selected UltraCart profile credential. Other service credentials are separate.'
    );
  if (path === 'profile remove')
    notes.push(
      'Removal tears down the profile credential, including a remote revocation attempt. Unbind the current workspace first if it points to this profile.'
    );
  if (path.startsWith('sf elements '))
    notes.push(
      'The server catalog can differ from the bundled local catalog and can be cached. Reading it does not replace the local schema used by schema, element, or CJSON validation. Unpublished schema is not proof of an empty configuration contract.'
    );
  if (
    /^sf (?:pages (?:attributes|settings|images |items |blog-posts |selectors set)|items (?:attributes|content|seo|images |remove-attribute)|site attributes)/.test(
      path
    )
  )
    notes.push(
      'These resource updates do not use the CJSON pull baseline. Read the current object, change only the intended fields, and coordinate concurrent edits.'
    );
  if (/^(?:init|workspace init|skills install|skills remove)$/.test(path))
    notes.push(
      'These commands change local workspace files. Inspect --dry-run and use --no-input with explicit targets for repeatable automation.'
    );
  return notes;
}

export function toolkitCommandUsage(command: ToolkitCommand): string {
  const args = command.arguments.map((argument) => argument.syntax).join(' ');
  const requiredOptions = command.options
    .filter((option) => option.required)
    .map((option) => option.syntax)
    .join(' ');
  return [
    'uc-storefront',
    command.path,
    args,
    command.group ? '<command>' : '',
    requiredOptions,
    command.options.some((option) => !option.required) ? '[options]' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export const toolkitCommands: ToolkitCommand[] = signatures.map(([path, group, args, opts]) => {
  const options = opts.map(([syntax, required, defaultValue, choices]) => ({
    syntax,
    required,
    defaultValue,
    description: describeOption(path, syntax),
    ...(choices ? { choices } : {}),
  }));
  const command: ToolkitCommand = {
    id: path ? path.replaceAll(' ', '.') : 'cli',
    path,
    parent: path
      ? path.includes(' ')
        ? path.slice(0, path.lastIndexOf(' ')).replaceAll(' ', '.')
        : 'cli'
      : null,
    group,
    summary: summaries[path] || summaries[`cjson ${path}`] || '',
    arguments: args.map(([syntax, defaultValue]) => ({
      syntax,
      defaultValue,
      required: syntax.startsWith('<'),
      description: describeArgument(path, syntax),
    })),
    options,
    ...commandEffects(path, group),
    notes: commandNotes(path, options),
    examples: [],
  };
  return command;
});

export const toolkitGlobalOptions = toolkitCommands[0].options;

export function searchToolkitCommands(query: string, risk?: ToolkitRisk): ToolkitCommand[] {
  const normalized = query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^uc-storefront\s+/, '');
  const terms = normalized.split(' ').filter(Boolean);
  const matches = toolkitCommands.filter((command) => {
    if (risk && !command.risks.includes(risk)) return false;
    const text = [
      command.path,
      command.summary,
      ...command.arguments.map((arg) => `${arg.syntax} ${arg.description}`),
      ...command.options.map((option) => `${option.syntax} ${option.description}`),
      ...command.notes,
    ]
      .join(' ')
      .toLowerCase();
    return terms.every((term) => text.includes(term));
  });
  if (!normalized) return matches;
  const relevance = (command: ToolkitCommand) => {
    if (command.path === normalized) return 5;
    if (command.path.startsWith(normalized)) return 4;
    if (command.path.includes(normalized)) return 3;
    if (terms.every((term) => command.path.includes(term))) return 2;
    if (terms.every((term) => command.summary.toLowerCase().includes(term))) return 1;
    return 0;
  };
  return matches.sort((left, right) => relevance(right) - relevance(left));
}

export function toolkitCommandChildren(id: string): ToolkitCommand[] {
  return toolkitCommands.filter((command) => command.parent === id);
}

export function resolveToolkitSkillLink(
  currentPath: string,
  href: string,
  files: readonly { id: string; path: string }[]
): string | null {
  const raw = href.trim().split(/[?#]/, 1)[0];
  if (!raw || raw.startsWith('/') || raw.includes('\\') || /^[a-z][a-z\d+.-]*:/i.test(raw)) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (
    decoded.startsWith('/') ||
    decoded.includes('\\') ||
    /^[a-z][a-z\d+.-]*:/i.test(decoded) ||
    /[\u0000-\u001f]/.test(decoded)
  )
    return null;
  const parts = currentPath.split('/').slice(0, -1);
  for (const part of decoded.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(part);
  }
  return files.find((file) => file.path === parts.join('/'))?.id || null;
}

export const toolkitGuides: ToolkitGuide[] = [
  {
    id: 'overview',
    title: 'Toolkit capabilities',
    description: 'What the CLI can inspect, author, preview, and change.',
    sections: [
      {
        title: 'Inspect and author local widget documents',
        paragraphs: [
          'The toolkit provides a normalized widget catalog, schemas, placement rules, element documentation, guides, and recipes. CJSON commands inspect widget trees and make atomic local edits. They do not need merchant access for ordinary local authoring.',
          'Local validation checks structure and catalog rules. It does not prove that a live server accepts the change or that the storefront renders as intended. The server element vocabulary can differ from the separately released local catalog.',
        ],
        commands: [
          'catalog info',
          'catalog verify',
          'schema list',
          'schema show',
          'element docs',
          'guide search',
          'cjson validate',
        ],
      },
      {
        title: 'Work with remote storefront resources',
        paragraphs: [
          'The sf command family uses a selected UltraCart merchant profile. It reads pages, templates, files, menus, item content, owner containers, blog posts, upsells, experiments, render logs, and recording information. Dedicated mutations exist for supported resources.',
          'Some writes affect shared live content even when a dormant theme is selected. Classify the resource and effect first. A missing --live flag does not imply a read-only command.',
        ],
        commands: ['sf storefronts', 'sf pages get', 'sf containers push', 'sf pages refresh'],
      },
      {
        title: 'Preview, allocate, and query deliberately',
        paragraphs: [
          'Preview commands create temporary substitutions and access links. Native widget IDs are reserved by a separate real allocation. Neither is equivalent to reading metadata.',
          'Warehouse query performs a BigQuery dry run and executes by default after its checks. Use --dry-run when you only want an estimate. The scan cap and resolved-dataset boundary belong to the toolkit query wrapper.',
        ],
        commands: ['sf preview start', 'sf preview stage', 'sf ids', 'warehouse query'],
      },
      {
        title: 'Use the interface snapshot and installed skills',
        paragraphs: [
          'This command reference includes every registered group, leaf command, positional argument, and flag in the recorded package version. Default badges show parser defaults; command descriptions also explain applicable runtime defaults. It is not a copy of the package source or its private documentation.',
          'A different installed version can have different behavior. Check its --version and command --help. The Skills tab reads instructions from the configured external toolkit at runtime; it neither installs skills nor executes their instructions.',
        ],
        commands: ['', 'skills status', 'skills install'],
      },
    ],
  },
  {
    id: 'setup',
    title: 'Profiles and workspace setup',
    description: 'Select the merchant explicitly and keep local paths predictable.',
    sections: [
      {
        title: 'Confirm the installed executable',
        paragraphs: [
          'The package executable is uc-storefront and the recorded version requires Node 24 or later. Obtain the package through an authorized distribution. This reference does not grant a package license or install it.',
          'Inspect the version and help before relying on a command. Examples use quoted placeholders; replace them with inspected values. Copying a command from this page does not run it.',
        ],
        code: 'uc-storefront --version\nuc-storefront --help\nuc-storefront --format json catalog info',
        commands: ['', 'catalog info'],
      },
      {
        title: 'Choose and verify a profile',
        paragraphs: [
          'A profile identifies the toolkit’s UltraCart authorization connection. Use profile list/show to inspect metadata, auth login to establish access, and auth status for local readiness. Local readiness alone does not prove current merchant permission.',
          'The CLI resolves an explicit --profile, then its supported environment/workspace/current-profile selection. In automation, pass the intended profile and storefront explicitly rather than depending on a mutable default.',
        ],
        code: 'uc-storefront profile list\nuc-storefront --profile "<profile>" auth status\nuc-storefront --profile "<profile>" --format json sf storefronts',
        commands: ['profile show', 'profile use', 'auth login', 'auth status', 'sf storefronts'],
      },
      {
        title: 'Bind a workspace',
        paragraphs: [
          'workspace init creates or updates ultracart.json and selected agent skill integrations. profile bind pins a workspace to a profile and can record the expected merchant identity. Use --dry-run and --no-input with explicit targets for a repeatable setup.',
          'The global --workspace chooses the exact manifest directory. It does not change how relative file arguments resolve: those remain relative to the current working directory. Root init initializes a workspace; cjson init creates a widget document.',
        ],
        commands: ['workspace init', 'profile bind', 'profile unbind', 'cjson init'],
      },
      {
        title: 'Keep authorization teardown explicit',
        paragraphs: [
          'auth logout revokes the selected profile’s refresh token and removes its credential. profile remove also tears down the credential and removes local profile metadata. Unbind a workspace before removing the profile it uses.',
          'Merchant content, pull baselines, query audits, replay files, and preview access URLs can contain private information. Exclude them from public source control and share only the material needed for an authorized task.',
        ],
        commands: ['auth logout', 'profile remove'],
      },
    ],
  },
  {
    id: 'cjson',
    title: 'Work with CJSON and recipes',
    description: 'Inspect schemas, use stable selectors, and apply small local changes.',
    sections: [
      {
        title: 'Discover supported widgets',
        paragraphs: [
          'The normalized catalog provides widget types, configuration keys, placement rules, documentation, and guides. Use schema list, schema show, schema children, and schema parents before creating an unfamiliar structure.',
          'Element documentation and guide searches can return bounded packets for an agent. Start with a small budget and a specific intent. A broad --full response can contain much more content than the task needs.',
        ],
        commands: [
          'catalog info',
          'catalog verify',
          'schema list',
          'schema show',
          'schema children',
          'schema parents',
          'element explain',
          'element docs',
          'guide search',
        ],
      },
      {
        title: 'Inspect a stable selection',
        paragraphs: [
          'Use cjson tree to find IDs and canonical paths. Inspect a selected widget, then request authoring context for the types and intent you need. Paths can change after insertion or reordering, so prefer the widget’s ID when possible.',
          'Global --format json makes structured output easier to consume. The root-level tree, inspect, context, find, validate, apply, add, update, remove, and move commands are legacy aliases; prefer the cjson namespace.',
        ],
        code: 'uc-storefront --format json cjson tree example-body.cjson\nuc-storefront --format json cjson inspect example-body.cjson "<widget-id>" --depth 1\nuc-storefront --format json cjson context example-body.cjson "<widget-id>" --authoring --intent "Adjust the heading without changing layout"',
        commands: ['cjson tree', 'cjson inspect', 'cjson context', 'cjson find'],
      },
      {
        title: 'Patch a field or apply an edit plan',
        paragraphs: [
          'CJSON mutations update a local file atomically. --dry-run exposes the proposal without writing it. Use the installed help for the versioned plan format and inspect every operation before cjson apply.',
          'Update uses JSON Pointer assignments. Escape a literal tilde as ~0 and a literal slash as ~1 in a pointer segment. --set with an empty right-hand side writes an empty string; --unset removes the key. Confirm the actual key in the widget schema before either operation.',
          '--allow-invalid permits an invalid local result. It does not make that result acceptable to the server. A clean cjson validate result also does not prove push compatibility or visual correctness.',
        ],
        code: 'uc-storefront --format json cjson update example-body.cjson "<widget-id>" --set "/config/<verified-key>=Example text" --dry-run --full\nuc-storefront --format json cjson validate example-body.cjson',
        commands: [
          'cjson update',
          'cjson add',
          'cjson move',
          'cjson remove',
          'cjson apply',
          'cjson validate',
        ],
      },
      {
        title: 'Reuse patterns without reusing native IDs',
        paragraphs: [
          'Recipes describe reusable widget structures and parameters. Capture saves a selected local subtree. Inspect captured content before sharing it because embedded code, tracking references, URLs, or text can belong to a merchant.',
          'Instantiation accepts explicit reserved IDs and produces an edit plan. It does not reserve IDs or write the CJSON document. Supply exactly the recipe’s widget count in a JSON ID array or JSON allocation receipt, review the emitted plan, and then apply it.',
        ],
        commands: [
          'recipe list',
          'recipe example',
          'recipe capture',
          'recipe instantiate',
          'sf ids',
          'cjson apply',
        ],
      },
    ],
  },
  {
    id: 'content',
    title: 'Locate the right content',
    description: 'Resolve template ownership before choosing a file or owner row.',
    sections: [
      {
        title: 'Start from the catalog page',
        paragraphs: [
          'Read the exact page path, then resolve its assigned group or item template through the selected theme’s resource paths. A template can serve many pages, so a shared include is a broader change than a page-owned slot.',
          'Use sf locate to trace literal includes and widget targets. It can include conditional branches that are not visible for every shopper. Dynamic includes and unsearched regions remain limits; a successful match is not proof of visible output.',
        ],
        commands: ['sf pages get', 'sf template find', 'sf template resolve', 'sf locate'],
      },
      {
        title: 'Distinguish a path from a container owner',
        paragraphs: [
          'Theme and page containers are filesystem CJSON files. Use sf pull and sf push with their exact absolute paths. A page can render a theme container or another named slot without having body.cjson.',
          'Item, upsell, email, and postcard containers are rows addressed with sf containers. item and upsell use an OID; itemid uses the merchant item ID; email and postcard types use an ESP UUID. Only item/itemid containers have named slots. A numeric merchant item ID is still not an item OID.',
        ],
        commands: ['sf files list', 'sf pull', 'sf containers list', 'sf containers pull'],
      },
      {
        title: 'Choose bounded reads',
        paragraphs: [
          'Use page filters, offsets, maximum-result limits, and exact paths when exploring a large storefront. --search-theme deliberately broadens sf locate to additional theme containers and can perform many reads.',
          'A missing file or slot does not authorize creating a replacement. Inspect the resolved template and content source before deciding which resource should change.',
        ],
        commands: ['sf pages list', 'sf files get', 'sf locate'],
      },
    ],
  },
  {
    id: 'editing',
    title: 'Pull, edit, validate, and push',
    description: 'Maintain baselines and IDs while reviewing each remote mutation.',
    sections: [
      {
        title: 'Save a fresh baseline',
        paragraphs: [
          'sf pull writes a new local CJSON file and its .sf.json baseline. Keep the baseline beside the document; it records the source identity, destination, previous content, and conflict hash. The remote file must already exist.',
          'Menus and owner containers have their own pull/push interfaces and comparison state. Select the exact resource before choosing an editing command.',
        ],
        code: 'uc-storefront --profile "<profile>" sf pull /example/body.cjson --storefront "<storefront-oid>" --out example-body.cjson\nuc-storefront cjson tree example-body.cjson',
        commands: ['sf pull', 'sf menus pull', 'sf containers pull'],
      },
      {
        title: 'Make the smallest local edit',
        paragraphs: [
          'Inspect the relevant widget and schema. Preserve native IDs on existing widgets. Use cjson update for field changes or a reviewed cjson apply plan for multiple operations; use --dry-run first to inspect the proposal.',
          'New widgets require appropriate native IDs before remote use. sf ids reserves them immediately. Counts above 100 are split into requests. Retain the allocation receipt and do not blindly repeat an uncertain request.',
        ],
        commands: ['cjson context', 'cjson update', 'cjson apply', 'cjson validate', 'sf ids'],
      },
      {
        title: 'Review live scope and conflict checks',
        paragraphs: [
          'A page-container body is shared across themes. --theme provides compilation context; it does not turn that body into isolated draft content. --live acknowledges a write where required, but does not itself perform a review or preview.',
          'Existing CJSON pushes compare against the pull baseline and current remote hash. Do not substitute an unreviewed hash after a conflict. --allow-removals acknowledges removed widget IDs; --allow-unknown-config-keys changes diagnostics and should not replace schema inspection.',
        ],
        commands: ['sf push', 'sf files versions', 'sf containers versions'],
      },
      {
        title: 'Handle uncertain and restored state',
        paragraphs: [
          'A connection can fail after a server accepts a write. Inspect the current remote state before deciding whether another write is safe. A generic network error is not evidence that nothing happened.',
          'A restore is another remote write and can make earlier local baselines stale. Read the restored content into a new local file before further edits. Some running experiments prevent changes to their page bodies.',
        ],
        commands: ['sf files revert', 'sf files get', 'sf containers revert', 'sf pull'],
      },
    ],
  },
  {
    id: 'preview',
    title: 'Preview without publishing',
    description: 'Stage the full desired set and inspect the correct theme and page context.',
    sections: [
      {
        title: 'Understand temporary preview state',
        paragraphs: [
          'A toolkit preview session lasts eight hours. Staging provides temporary substitutes for theme files, page containers, item containers, or upsell pages. It does not persist a storefront edit.',
          'A preview session uses one theme. Theme-file targets can determine that theme; otherwise use the explicit theme or active theme. Page-owned and item-owned content remain shared live data when eventually published.',
        ],
        commands: ['sf preview start', 'sf preview stage'],
      },
      {
        title: 'Stage every file that must remain',
        paragraphs: [
          'Each stage call replaces the entire staged set. It is not an incremental add operation. Include all desired --file, --item, and --upsell values in the replacement.',
          'Use exact server paths and baseline-backed owner files. A preview can display a page-container file that does not yet exist remotely, but this does not authorize creating it or prove that a later live write will succeed.',
        ],
        code: 'uc-storefront --profile "<profile>" sf preview stage --storefront "<storefront-oid>" --session "<preview-session>" --theme "<theme-oid>" --file "example-body.cjson=/example/body.cjson"',
        commands: ['sf preview stage', 'sf containers pull'],
      },
      {
        title: 'Inspect and close',
        paragraphs: [
          'Opening returns a single-use access URL. Treat it as private. Inspect the intended theme and page path in the browser opened for the preview. Temporary preview state does not create an authorization for a later write.',
          'Check the actual page context, layout, text, links, and responsive behavior. End the temporary session when finished. A screenshot or successful render is not proof of publication.',
        ],
        commands: ['sf preview open', 'sf preview end', 'sf render'],
      },
    ],
  },
  {
    id: 'operations',
    title: 'Use the wider toolkit',
    description: 'Choose the correct interface for assets, shared data, experiments, and diagnostics.',
    sections: [
      {
        title: 'File paths and owner containers differ',
        paragraphs: [
          'Theme and page CJSON live at filesystem paths and use sf pull/push. Item, upsell, email, and postcard containers are owner rows and use sf containers. Itemid means merchant item ID; item means item OID. The numeric appearance of an ID does not make them interchangeable.',
          'Container push has no --live option but still writes remote content. With --create --remap-ids it also allocates IDs. Version restore changes the server and leaves any previous local editing baseline stale.',
        ],
        commands: [
          'sf files list',
          'sf pull',
          'sf containers list',
          'sf containers pull',
          'sf containers push',
          'sf containers revert',
        ],
      },
      {
        title: 'Treat shared content as a broad change',
        paragraphs: [
          'Menus, site attributes, item content, page assignments, upsell paths, and some theme settings are shared resources. A draft theme does not isolate shared page or item data. Read the current object, inspect the requested fields, and authorize the exact write.',
          'Template wire/unwire/move edits literal includes in a template that may serve many pages. Use the reviewed hash and dry-run. File put accepts JSON and plain CSS; use dedicated CJSON and binary-upload commands for other supported content.',
        ],
        commands: [
          'sf menus push',
          'sf site attributes',
          'sf items content',
          'sf theme-attributes set',
          'sf template wire',
          'sf files put',
          'sf files upload',
        ],
      },
      {
        title: 'Separate assignments from deletion',
        paragraphs: [
          'Removing an item or post from a page changes its assignment; it does not delete that item or post. sf blog-posts delete permanently removes the post and its assignments. Inspect the exact operation before treating a remove action as reversible.',
          'Upsell duplication, archive, disable, and move have different effects on eligibility and order. Experiments control shopper traffic; pause/resume operate on a selected variation, and end requires a deliberate winner decision.',
        ],
        commands: [
          'sf pages items remove',
          'sf pages blog-posts remove',
          'sf blog-posts delete',
          'sf upsells paths move',
          'sf upsells paths duplicate',
          'sf experiments pause',
          'sf experiments end',
        ],
      },
      {
        title: 'Read diagnostics with bounded scope',
        paragraphs: [
          'Render logs help identify template or runtime errors. Start with a recent window, an exact URI filter, and a small result limit. Refresh is cache invalidation, which is a remote mutation even though it is not a content edit.',
          'Recordings may contain shopper information. Rendering them downloads events and writes local files; --show-input can reveal entered text. Enable recording only for an explicit authorized task and scope replay output to the needed page views.',
        ],
        commands: [
          'sf logs list',
          'sf logs get',
          'sf pages refresh',
          'sf recordings show',
          'sf recordings render',
          'sf recordings enable',
        ],
      },
    ],
  },
  {
    id: 'warehouse',
    title: 'Bounded warehouse queries',
    description:
      'Use your own bq identity, inspect the estimate, and keep references inside the granted datasets.',
    sections: [
      {
        title: 'Select the project and identity',
        paragraphs: [
          'The toolkit invokes your installed bq CLI under its Google Cloud identity. UltraCart OAuth is a separate connection and does not grant Google Cloud access. Use an explicit merchant code or project for the intended warehouse.',
          '--merchant resolves the ultracart-dw-<lowercase code> convention. --project supports a warehouse with a different project identifier. Read schemas before choosing columns or metrics.',
        ],
        commands: ['warehouse query'],
      },
      {
        title: 'Understand the dry run',
        paragraphs: [
          'The wrapper first asks BigQuery to validate the SQL and estimate its scan. It checks the estimated bytes and resolved table references against its permitted datasets. A curated ultracart_dw view can resolve to ultracart_dw_streaming tables, so resolved references matter.',
          'The CLI executes after those checks by default. Add --dry-run to stop after validation and estimation. This still contacts BigQuery; it is not offline SQL parsing.',
        ],
        code: 'uc-storefront --format json warehouse query "SELECT <verified-columns> FROM ultracart_dw.<verified-view> LIMIT 25" --merchant "<merchant-code>" --max-bytes 1GiB --dry-run',
        commands: ['warehouse query'],
      },
      {
        title: 'Constrain scans and inspect failures',
        paragraphs: [
          'The default scan ceiling is 20GiB. Set a smaller explicit --max-bytes when appropriate, select only necessary columns, and use the relevant partition filters. A LIMIT clause does not necessarily reduce bytes scanned.',
          '--parameter passes typed named query values to bq. --audit-log appends query text, project, scan estimate, resolved tables, and execution metadata without result rows. The SQL itself can still contain private information. Keep audit files scoped and private.',
          'An error response can include the warehouse failure stage and BigQuery’s diagnostic. An estimate is not a receipt for completed execution or actual cost. Do not invent results from a successful dry run.',
        ],
        commands: ['warehouse query'],
      },
    ],
  },
  {
    id: 'skills',
    title: 'Toolkit skills and integrations',
    description: 'Review packaged instructions and manage their local agent copies.',
    sections: [
      {
        title: 'Read the installed instruction set',
        paragraphs: [
          'The Skills tab lists skills under the configured external toolkit installation and reads the selected SKILL.md at runtime. Its text comes from that installation, not from the bundled command snapshot. It can differ with package version.',
          'This is a document viewer. It does not run commands, install a skill, follow its instructions, or grant authority for merchant actions. Embedded HTML, remote images, and external navigation are not enabled in the viewer.',
        ],
      },
      {
        title: 'Install workspace integrations deliberately',
        paragraphs: [
          'workspace init and skills install can copy the toolkit’s supported integrations into a local workspace. Choose codex, claude, gemini, or all explicitly. --no-input prevents prompts; --dry-run reports proposed changes before they are written.',
          '--allow-downgrade explicitly permits an older toolkit to replace newer skill copies it owns. Avoid using it to resolve unexplained version drift.',
        ],
        commands: ['workspace init', 'skills install'],
      },
      {
        title: 'Inspect drift and remove owned copies',
        paragraphs: [
          'skills status compares local skill integrations with the package’s expected state. With --check it returns exit code 3 for drift. A status check does not authorize a repair.',
          'skills remove removes the selected toolkit-owned integrations from the workspace. It does not remove arbitrary personal agent skills or change merchant credentials. Review the dry-run output first.',
        ],
        commands: ['skills status', 'skills remove'],
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'CLI diagnostics and output',
    description: 'Use the failing stage, exact resource, and structured response.',
    sections: [
      {
        title: 'Confirm syntax and output format',
        paragraphs: [
          'Use the installed version and command help before relying on a remembered flag. --format json is the interface for structured results. Failures include an error code and message, sometimes paths or a warehouse stage.',
          '--timings writes phase timing data to standard error separately from command output. Error messages and normal output can still contain merchant content, resource paths, or SQL. Review and redact before sharing them.',
        ],
        code: 'uc-storefront --version\nuc-storefront --format json catalog info\nuc-storefront --format json skills status --check',
        commands: ['', 'catalog info', 'skills status'],
      },
      {
        title: 'Identify the failing boundary',
        paragraphs: [
          'A missing executable or module is a local setup error. A missing profile or permission is an identity/access issue. A missing page body or owner slot is a content-address issue. These have different fixes.',
          'Read the selected profile metadata and exact storefront; then inspect the template or container identity. Do not use broader credentials, create a new body, or change a different path merely to suppress an error.',
        ],
        commands: ['profile show', 'auth status', 'sf storefronts', 'sf template find', 'sf containers list'],
      },
      {
        title: 'Interpret exit codes with context',
        paragraphs: [
          'Normal completion and help return zero. Failures use nonzero codes; invalid arguments and warehouse errors commonly use 2. skills status --check returns 3 for drift. Read the structured diagnostic instead of guessing solely from the number.',
          'Separate what each check proves: local schema validation, remote metadata access, a dry-run estimate, a temporary render, or remote content readback. None automatically proves the others.',
        ],
        commands: ['cjson validate', 'sf render', 'sf files get'],
      },
    ],
  },
];
