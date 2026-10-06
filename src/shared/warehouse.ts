export const WAREHOUSE_MAX_BYTES = 20 * 1024 ** 3;
export const WAREHOUSE_DEFAULT_BYTES = 1024 ** 3;
/** BigQuery bills at least 10 MiB per query, so a lower ceiling would pass the dry run and always fail. */
export const WAREHOUSE_MIN_BYTES = 10 * 1024 ** 2;
export type WarehouseQuery = { sql: string; rowLimit: number; maxBytes: number };
export type WarehouseConfig = { bqPath: string; maxBytes: number };
export type WarehouseIssueCode =
  | 'executable_missing'
  | 'executable_permission'
  | 'launcher_unsupported'
  | 'python_runtime'
  | 'cli_configuration'
  | 'auth_missing'
  | 'auth_expired'
  | 'access_denied'
  | 'api_disabled'
  | 'network'
  | 'not_found'
  | 'scan_limit'
  | 'sql'
  | 'timeout'
  | 'output_limit'
  | 'unknown';
export type WarehouseIssue = {
  code: WarehouseIssueCode;
  title: string;
  detail: string;
  steps: string[];
  docs: { label: string; url: string };
};
export type WarehouseConnectionCheck = {
  id: 'executable' | 'account' | 'project' | 'metadata';
  label: string;
  state: 'passed' | 'failed' | 'warning' | 'skipped';
  detail: string;
  issue?: WarehouseIssue;
};
export type WarehouseDiagnostics = {
  workspaceId: string;
  project: string;
  bqPath: string;
  gcloudPath: string | null;
  checkedAt: string;
  sample: boolean;
  checks: WarehouseConnectionCheck[];
  commands: { label: string; command: string }[];
};

/** Recognizes full local paths for the form. The server also validates the host platform. */
export function warehouseAbsolutePath(value: string) {
  return (
    !/[\u0000-\u001f\u007f]/.test(value) &&
    (value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || /^\\\\[^\\/]+[\\/][^\\/]+[\\/]/.test(value))
  );
}
/** A full path whose file name is the BigQuery CLI launcher: bq, bq.cmd or bq.exe, in any case. */
export function warehouseBqPath(value: string) {
  return warehouseAbsolutePath(value) && /(?:^|[\\/])bq(?:\.cmd|\.exe)?$/i.test(value);
}
export type WarehouseTable = { name: string; type: string; description?: string };
export type WarehouseField = { path: string; type: string; mode: string; description?: string };
export type WarehouseSchema = { table: string; fields: WarehouseField[]; fetchedAt: string; sample: boolean };
export type WarehouseSavedQuery = WarehouseQuery & { id: string; name: string; updatedAt: string };
export type WarehouseHistory = {
  id: string;
  sql: string;
  queryHash: string;
  at: string;
  outcome: 'dry-run' | 'completed' | 'failed' | 'uncertain';
  estimatedBytes: number | null;
  maxBytes: number;
  rowCount: number | null;
  sample: boolean;
  detail?: string;
};
export type WarehouseReceipt = {
  project: string;
  estimatedBytes: number;
  maxBytes: number;
  referencedTables: string[];
  executed: boolean;
  rows: Record<string, unknown>[];
  at: string;
  sample: boolean;
};
export type WarehousePrepared = {
  ticket: string;
  expiresAt: string;
  query: WarehouseQuery;
  receipt: WarehouseReceipt;
};
export type WarehouseStatus = {
  workspaceId: string;
  sample: boolean;
  project: string;
  dataset: 'ultracart_dw';
  config: WarehouseConfig;
  toolAvailable: boolean;
  toolkitAvailable: boolean;
  access: 'unchecked' | 'verified';
  checkedAt: string | null;
  issue: WarehouseIssue | null;
  diagnostics: WarehouseDiagnostics | null;
  saved: WarehouseSavedQuery[];
  history: WarehouseHistory[];
};

export function warehouseBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${units[unit]}`;
}

export const warehouseDemoQueries: WarehouseSavedQuery[] = [
  {
    id: 'demo-revenue',
    name: 'Revenue by channel',
    sql: 'SELECT channel, COUNT(*) AS orders,\n       ROUND(SUM(total), 2) AS revenue\nFROM ultracart_dw.uc_orders\nGROUP BY channel\nORDER BY revenue DESC',
    rowLimit: 100,
    maxBytes: WAREHOUSE_DEFAULT_BYTES,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'demo-pages',
    name: 'Pages to improve',
    sql: 'SELECT path, sessions, conversion_rate\nFROM ultracart_dw.uc_page_performance\nORDER BY sessions DESC',
    rowLimit: 100,
    maxBytes: WAREHOUSE_DEFAULT_BYTES,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'demo-products',
    name: 'Product performance',
    sql: 'SELECT product, units, revenue\nFROM ultracart_dw.uc_product_performance\nORDER BY revenue DESC',
    rowLimit: 100,
    maxBytes: WAREHOUSE_DEFAULT_BYTES,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];
