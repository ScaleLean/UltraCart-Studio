import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { devNull } from 'node:os';
import { z } from 'zod';
import type { StudioServices } from './services';
import type { Workspace } from '../shared/types';
import { isSampleSelection } from '../shared/sample';
import {
  WAREHOUSE_DEFAULT_BYTES,
  WAREHOUSE_MAX_BYTES,
  warehouseDemoQueries,
  type WarehouseConfig,
  type WarehouseDiagnostics,
  type WarehouseIssue,
  type WarehouseField,
  type WarehouseHistory,
  type WarehousePrepared,
  type WarehouseQuery,
  type WarehouseReceipt,
  type WarehouseSavedQuery,
  type WarehouseSchema,
  type WarehouseStatus,
  type WarehouseTable,
} from '../shared/warehouse';
import { warehouseAbsolutePath } from '../shared/warehouse';
import {
  runWarehouseCommand,
  warehouseDefaultBq,
  warehouseGcloudPath,
  warehouseIssue,
  warehouseTerminalCommand,
  WarehouseCliError,
  type WarehouseRunner,
} from './warehouse-diagnostics';
export type { WarehouseRunner } from './warehouse-diagnostics';

const scopeInput = z.object({ workspaceId: z.string().min(1).max(100) });
const queryInput = z.object({
  sql: z.string().trim().min(1).max(20000),
  rowLimit: z.number().int().min(1).max(100),
  maxBytes: z.number().int().min(1).max(WAREHOUSE_MAX_BYTES),
});
const tableName = z.string().regex(/^uc_[A-Za-z0-9_]{1,124}$/);
const queryFunctions = new Set(
  'ABS ACOS ANY_VALUE APPROX_COUNT_DISTINCT ARRAY ARRAY_AGG ARRAY_CONCAT ARRAY_LENGTH AVG CAST CEIL COALESCE CONCAT COUNT COUNTIF CURRENT_DATE CURRENT_DATETIME CURRENT_TIMESTAMP DATE DATE_ADD DATE_DIFF DATE_SUB DATE_TRUNC DATETIME DATETIME_DIFF DENSE_RANK ENDS_WITH EXTRACT FIRST_VALUE FLOOR FORMAT FORMAT_DATE FORMAT_TIMESTAMP GENERATE_ARRAY GENERATE_DATE_ARRAY GREATEST IF IFNULL JSON_EXTRACT JSON_EXTRACT_SCALAR JSON_QUERY JSON_VALUE LAG LAST_VALUE LEAD LEAST LENGTH LOWER MAX MIN MOD NULLIF OFFSET PARSE_DATE PARSE_TIMESTAMP PERCENTILE_CONT RANK REGEXP_CONTAINS REGEXP_EXTRACT REGEXP_REPLACE ROUND ROW_NUMBER SAFE_CAST SAFE_DIVIDE SAFE_MULTIPLY SAFE_OFFSET SAFE_SUBTRACT SPLIT SQRT STARTS_WITH STRING STRING_AGG STRUCT SUBSTR SUBSTRING SUM TIMESTAMP TIMESTAMP_ADD TIMESTAMP_DIFF TIMESTAMP_SECONDS TIMESTAMP_SUB TIMESTAMP_TRUNC TO_JSON_STRING TRIM UNNEST UPPER'.split(
    ' '
  )
);
const syntaxCalls = new Set([
  'AS',
  'IN',
  'EXISTS',
  'OVER',
  'SELECT',
  'FROM',
  'JOIN',
  'WHERE',
  'AND',
  'OR',
  'NOT',
  'WHEN',
  'THEN',
  'ELSE',
  'ON',
  'BY',
]);
const forbidden = new Set(
  'ALTER ASSERT BEGIN CALL COMMIT CREATE DECLARE DELETE DROP EXECUTE EXPORT GRANT IMPORT INSERT LOAD MERGE REPLACE REVOKE ROLLBACK SET TRUNCATE UPDATE EXTERNAL_QUERY EXTERNAL_OBJECT_TRANSFORM REMOTE MODEL'.split(
    ' '
  )
);
type Token = { value: string; kind: 'word' | 'quoted' | 'string' | 'symbol' };
function tokens(sql: string): Token[] {
  const result: Token[] = [];
  for (let i = 0; i < sql.length;) {
    const c = sql[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (
      c === ';' ||
      c === '#' ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(c) ||
      sql.startsWith('--', i) ||
      sql.startsWith('/*', i) ||
      sql.startsWith('*/', i)
    )
      throw new Error('Use one SELECT query without comments or a trailing semicolon.');
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      if (sql.slice(i, i + 3) === quote.repeat(3))
        throw new Error('Use ordinary quoted strings in warehouse queries.');
      let value = '';
      let closed = false;
      for (i++; i < sql.length; i++) {
        if (sql[i] === '\\') {
          value += sql[i] + (sql[++i] || '');
          continue;
        }
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) {
            value += quote;
            i++;
            continue;
          }
          i++;
          closed = true;
          break;
        }
        value += sql[i];
      }
      if (!closed) throw new Error('Close the quoted string or identifier before a dry run.');
      if (quote === '`' && !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(value))
        throw new Error('Use an exact curated table name. Wildcards and decorated tables are not supported.');
      result.push({ value, kind: quote === '`' ? 'quoted' : 'string' });
    } else if (/[A-Za-z_]/.test(c)) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(sql.slice(i))![0];
      result.push({ value: match, kind: 'word' });
      i += match.length;
    } else {
      result.push({ value: c, kind: 'symbol' });
      i++;
    }
  }
  return result;
}
export function warehouseProject(merchant: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{1,30}$/.test(merchant))
    throw new Error('This merchant does not have a supported warehouse project id.');
  const id = merchant.toLowerCase();
  return id.startsWith('ultracart-dw-') ? id : `ultracart-dw-${id}`;
}
const tableScopeError =
  'Queries can name only this merchant’s ultracart_dw.uc_* views. Use the schema explorer to choose a table.';
const curatedTable = /^uc_[A-Za-z0-9_]{1,124}$/;
const isName = (token: Token | undefined) => token?.kind === 'word' || token?.kind === 'quoted';
export function validateWarehouseSql(sql: string, project: string) {
  const parsed = tokens(sql.trim());
  if (!['SELECT', 'WITH'].includes(parsed[0]?.value.toUpperCase()))
    throw new Error('Only read-only SELECT or WITH queries are supported.');
  const ctes = new Set<string>();
  for (let i = 0; i < parsed.length - 2; i++) {
    if (
      parsed[i].kind === 'word' &&
      parsed[i + 1].value.toUpperCase() === 'AS' &&
      parsed[i + 2].value === '('
    )
      ctes.add(parsed[i].value.toLowerCase());
  }
  /** A dotted name, with backtick-quoted segments split on their dots, as BigQuery resolves table paths. */
  const pathAt = (start: number) => {
    const parts: string[] = [];
    let quoted = false;
    let end = start;
    for (;;) {
      quoted ||= parsed[end].kind === 'quoted';
      parts.push(...parsed[end].value.split('.'));
      if (parsed[end + 1]?.value !== '.' || !isName(parsed[end + 2])) break;
      end += 2;
    }
    return { parts, quoted };
  };
  const allowedTable = (parts: string[]) =>
    (parts.length === 2
      ? parts[0] === 'ultracart_dw'
      : parts.length === 3 && parts[0] === project && parts[1] === 'ultracart_dw') &&
    curatedTable.test(parts.at(-1)!);
  const refs = new Set<string>();
  /** Opening parentheses that start a FROM item: a parenthesized join or a subquery. */
  const sourceParens = new Set<number>();
  // Deny by default: a FROM item must be a CTE, UNNEST, a parenthesized item, or an allowed table.
  const source = (start: number) => {
    const first = parsed[start];
    if (!first) throw new Error('Choose a curated table after FROM or JOIN.');
    if (first.value === '(') {
      sourceParens.add(start);
      return;
    }
    if (first.kind === 'word' && first.value.toUpperCase() === 'UNNEST' && parsed[start + 1]?.value === '(')
      return;
    if (!isName(first)) throw new Error('Use an exact curated table name.');
    const { parts } = pathAt(start);
    if (parts.length === 1 && first.kind === 'word' && ctes.has(parts[0].toLowerCase())) return;
    if (!allowedTable(parts)) throw new Error(tableScopeError);
    refs.add(`${project}.ultracart_dw.${parts.at(-1)}`);
  };
  // Outside FROM items a dotted name is a column path. Reject any that could only name a table.
  const expression = (start: number) => {
    const { parts, quoted } = pathAt(start);
    const tableLike =
      parts.some((part) => part === '' || part.includes('-') || part.toUpperCase() === 'INFORMATION_SCHEMA') ||
      (parts.length > 1 &&
        (quoted || parts[0] === project || parts[0].toLowerCase().startsWith('ultracart_dw')));
    if (tableLike && !allowedTable(parts)) throw new Error(tableScopeError);
  };
  const frames: { from: boolean; fn?: string }[] = [{ from: false }];
  for (let i = 0; i < parsed.length; i++) {
    const token = parsed[i];
    const upper = token.value.toUpperCase();
    const frame = frames.at(-1)!;
    if (token.kind === 'string') continue;
    if (isName(token) && parsed[i - 1]?.value !== '.') expression(i);
    if (token.kind === 'word' && forbidden.has(upper))
      throw new Error(`The ${upper} operation is not supported in read-only queries.`);
    if (parsed[i + 1]?.value === '(' && isName(token)) {
      if (
        token.kind === 'quoted' ||
        parsed[i - 1]?.value === '.' ||
        (!queryFunctions.has(upper) && !syntaxCalls.has(upper))
      )
        throw new Error(`The function ${token.value} is outside the supported read-only SQL subset.`);
    }
    if (token.value === '(') {
      const opensSource = sourceParens.has(i);
      frames.push({
        from: opensSource,
        fn: parsed[i - 1]?.kind === 'word' ? parsed[i - 1].value.toUpperCase() : undefined,
      });
      // The first item of a parenthesized join is a FROM item too.
      if (opensSource && !['SELECT', 'WITH'].includes(parsed[i + 1]?.value.toUpperCase() ?? ''))
        source(i + 1);
    } else if (token.value === ')') {
      frames.pop();
      if (frames.length === 0) throw new Error('The query has an unmatched parenthesis.');
    } else if (token.kind === 'word' && (upper === 'FROM' || upper === 'JOIN')) {
      if (upper === 'FROM' && frame.fn === 'EXTRACT') continue;
      frame.from = true;
      source(i + 1);
    } else if (token.kind === 'word' && upper === 'SELECT') {
      frame.from = false;
    } else if (
      token.kind === 'word' &&
      [
        'WHERE',
        'GROUP',
        'ORDER',
        'HAVING',
        'QUALIFY',
        'LIMIT',
        'UNION',
        'EXCEPT',
        'INTERSECT',
        'WINDOW',
      ].includes(upper)
    )
      frame.from = false;
    else if (token.value === ',' && frame.from) source(i + 1);
  }
  if (frames.length !== 1) throw new Error('The query has an unmatched parenthesis.');
  return [...refs];
}
export function boundedWarehouseSql(query: WarehouseQuery, project: string) {
  const parsed = queryInput.parse(query);
  validateWarehouseSql(parsed.sql, project);
  return `SELECT * FROM (\n${parsed.sql}\n) AS studio_result\nLIMIT ${parsed.rowLimit}`;
}
export function parseWarehouseDryRun(text: string, project: string, maxBytes: number, needsTables: boolean) {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('BigQuery did not return a readable dry-run receipt. No query was executed.');
  }
  const stats = data?.statistics?.query;
  if (!stats || stats.statementType !== 'SELECT')
    throw new Error('BigQuery did not confirm a read-only SELECT statement. No query was executed.');
  if (!(
    (typeof stats.totalBytesProcessed === 'string' && /^\d+$/.test(stats.totalBytesProcessed)) ||
    typeof stats.totalBytesProcessed === 'number'
  ))
    throw new Error('BigQuery did not report a scan estimate. No query was executed.');
  const estimatedBytes = Number(stats.totalBytesProcessed);
  if (!Number.isSafeInteger(estimatedBytes) || estimatedBytes < 0 || estimatedBytes > maxBytes)
    throw new Error(
      'The scan estimate is missing or exceeds the configured byte ceiling. Add a partition filter before trying again.'
    );
  if (needsTables && (!Array.isArray(stats.referencedTables) || stats.referencedTables.length === 0))
    throw new Error('BigQuery did not report the tables read by this query. No query was executed.');
  const references = stats.referencedTables ?? [];
  if (!Array.isArray(references) || references.length > 1000)
    throw new Error('BigQuery returned an invalid table receipt.');
  // A query that names no curated view must not read any table. If it does, the SQL check missed a reference.
  if (!needsTables && references.length > 0)
    throw new Error('BigQuery reported tables this query does not name. No query was executed.');
  const referencedTables = references.map((ref: any) => {
    const tableId = typeof ref?.tableId === 'string' ? ref.tableId : '';
    // Curated ultracart_dw.uc_* views read base tables in ultracart_dw_streaming, and BigQuery reports those
    // base tables as referenced. They are accepted here only as view sources: validateWarehouseSql never lets
    // SQL name ultracart_dw_streaming (or any non-uc_* table) directly.
    const permitted =
      ref?.projectId === project &&
      ((ref?.datasetId === 'ultracart_dw' && curatedTable.test(tableId)) ||
        (ref?.datasetId === 'ultracart_dw_streaming' && /^[A-Za-z0-9_]{1,1024}$/.test(tableId)));
    if (!permitted)
      throw new Error('This query resolves outside the selected merchant’s permitted warehouse datasets.');
    return `${ref.projectId}.${ref.datasetId}.${ref.tableId}`;
  });
  return { estimatedBytes, referencedTables };
}

const demoTables: WarehouseTable[] = [
  { name: 'uc_orders', type: 'DEMO VIEW', description: 'Synthetic orders and acquisition channels' },
  {
    name: 'uc_page_performance',
    type: 'DEMO VIEW',
    description: 'Synthetic storefront traffic and conversion',
  },
  { name: 'uc_product_performance', type: 'DEMO VIEW', description: 'Synthetic product sales' },
];
const demoRows: Record<string, Record<string, unknown>[]> = {
  'demo-revenue': [
    { channel: 'Organic search', orders: 248, revenue: 18352 },
    { channel: 'Email', orders: 194, revenue: 16102 },
    { channel: 'Paid search', orders: 173, revenue: 12975 },
    { channel: 'Direct', orders: 121, revenue: 10043 },
    { channel: 'Social', orders: 87, revenue: 5916 },
  ],
  'demo-pages': [
    { path: '/', sessions: 12840, conversion_rate: 0.042 },
    { path: '/shop/', sessions: 8632, conversion_rate: 0.068 },
    { path: '/shop/face-oil/', sessions: 4128, conversion_rate: 0.081 },
    { path: '/our-story/', sessions: 2840, conversion_rate: 0.024 },
    { path: '/journal/', sessions: 1921, conversion_rate: 0.012 },
  ],
  'demo-products': [
    { product: 'Botanical Face Oil', units: 342, revenue: 13680 },
    { product: 'Daily Cleanser', units: 428, revenue: 12840 },
    { product: 'Everyday Body Wash', units: 286, revenue: 7436 },
  ],
};
const demoFields: Record<string, WarehouseField[]> = {
  uc_orders: [
    { path: 'channel', type: 'STRING', mode: 'NULLABLE' },
    { path: 'total', type: 'NUMERIC', mode: 'NULLABLE' },
  ],
  uc_page_performance: [
    { path: 'path', type: 'STRING', mode: 'NULLABLE' },
    { path: 'sessions', type: 'INTEGER', mode: 'NULLABLE' },
    { path: 'conversion_rate', type: 'FLOAT', mode: 'NULLABLE' },
  ],
  uc_product_performance: [
    { path: 'product', type: 'STRING', mode: 'NULLABLE' },
    { path: 'units', type: 'INTEGER', mode: 'NULLABLE' },
    { path: 'revenue', type: 'NUMERIC', mode: 'NULLABLE' },
  ],
};
function flattenFields(fields: unknown, prefix = '', depth = 0): WarehouseField[] {
  if (!Array.isArray(fields) || depth > 20) throw new Error('BigQuery returned an unsupported schema.');
  const result: WarehouseField[] = [];
  for (const field of fields) {
    if (
      !field ||
      typeof field.name !== 'string' ||
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(field.name) ||
      typeof field.type !== 'string'
    )
      throw new Error('BigQuery returned an invalid field.');
    const path = prefix ? `${prefix}.${field.name}` : field.name;
    result.push({
      path,
      type: field.type,
      mode: typeof field.mode === 'string' ? field.mode : 'NULLABLE',
      ...(typeof field.description === 'string' ? { description: field.description.slice(0, 1000) } : {}),
    });
    if (field.fields) result.push(...flattenFields(field.fields, path, depth + 1));
    if (result.length > 4000) throw new Error('The table schema exceeds the explorer limit.');
  }
  return result;
}

type Ticket = { key: string; merchant: string; query: WarehouseQuery; expires: number; config: string };
export class WarehouseService {
  private tickets = new Map<string, Ticket>();
  private runCommand: WarehouseRunner;
  private exists: (path: string) => boolean;
  private now: () => number;
  constructor(
    private services: StudioServices,
    options: { run?: WarehouseRunner; exists?: (path: string) => boolean; now?: () => number } = {}
  ) {
    this.runCommand = options.run || runWarehouseCommand;
    this.exists = options.exists || existsSync;
    this.now = options.now || Date.now;
  }
  private current(workspaceId: string) {
    const workspace = this.services.workspace();
    if (workspace.id !== workspaceId)
      throw new Error('The workspace changed. Reopen Warehouse for the selected store.');
    if ((workspace.kind === 'sample') !== isSampleSelection(workspace.selection))
      throw new Error('The sample workspace identity is invalid. Reconnect the workspace.');
    return workspace;
  }
  private key(workspace: Workspace) {
    return JSON.stringify([workspace.id, workspace.kind, workspace.selection]);
  }
  private merchant(workspace: Workspace) {
    return createHash('sha256')
      .update(JSON.stringify([workspace.kind, workspace.selection.profileId, workspace.selection.merchantId]))
      .digest('hex')
      .slice(0, 24);
  }
  private assertCurrent(workspace: Workspace) {
    if (this.key(this.current(workspace.id)) !== this.key(workspace))
      throw new Error('The workspace identity changed. Run a new dry run.');
  }
  private storeKey(workspace: Workspace, name: string) {
    return `warehouse:${this.merchant(workspace)}:${name}`;
  }
  private config(workspace: Workspace): WarehouseConfig {
    const fallback = warehouseDefaultBq(this.exists);
    return this.services.store.get(this.storeKey(workspace, 'config'), {
      bqPath: fallback,
      maxBytes: WAREHOUSE_DEFAULT_BYTES,
    });
  }
  private base(workspace: Workspace) {
    return [
      `--bigqueryrc=${devNull}`,
      '--quiet=true',
      '--headless=true',
      '--format=prettyjson',
      `--project_id=${warehouseProject(workspace.selection.merchantId)}`,
    ];
  }
  private async verify(workspace: Workspace) {
    this.assertCurrent(workspace);
    if (workspace.kind === 'live') {
      await this.services.connection.verify(workspace.selection);
      this.assertCurrent(workspace);
      if (!this.exists(this.config(workspace).bqPath))
        throw new WarehouseCliError(warehouseIssue('executable_missing'));
    }
  }
  status(input: unknown): WarehouseStatus {
    const v = scopeInput.strict().parse(input),
      workspace = this.current(v.workspaceId),
      config = this.config(workspace);
    const checkedAt = this.services.store.get<string | null>(this.storeKey(workspace, 'checked'), null);
    const settings = this.services.settings();
    return {
      workspaceId: workspace.id,
      sample: workspace.kind === 'sample',
      project: warehouseProject(workspace.selection.merchantId),
      dataset: 'ultracart_dw',
      config,
      toolAvailable: this.exists(config.bqPath),
      toolkitAvailable: this.exists(settings.nodePath) && this.exists(settings.cliPath),
      access: checkedAt ? 'verified' : 'unchecked',
      checkedAt,
      issue: this.services.store.get<WarehouseIssue | null>(this.storeKey(workspace, 'issue'), null),
      diagnostics: this.services.store.get<WarehouseDiagnostics | null>(
        this.storeKey(workspace, 'diagnostics'),
        null
      ),
      saved: this.saved(workspace),
      history: this.history({ workspaceId: workspace.id }),
    };
  }
  configure(input: unknown) {
    const v = scopeInput
      .extend({
        bqPath: z
          .string()
          .trim()
          .max(4096)
          .refine(
            (value) => isAbsolute(value) && warehouseAbsolutePath(value),
            'Use an absolute path to bq on this computer.'
          ),
        maxBytes: z.number().int().min(1).max(WAREHOUSE_MAX_BYTES),
      })
      .strict()
      .parse(input);
    const workspace = this.current(v.workspaceId);
    this.services.store.set(this.storeKey(workspace, 'config'), { bqPath: v.bqPath, maxBytes: v.maxBytes });
    this.services.store.set(this.storeKey(workspace, 'checked'), null);
    this.services.store.set(this.storeKey(workspace, 'issue'), null);
    this.services.store.set(this.storeKey(workspace, 'diagnostics'), null);
    for (const [id, ticket] of this.tickets)
      if (ticket.merchant === this.merchant(workspace)) this.tickets.delete(id);
    this.services.emit();
    return this.status({ workspaceId: workspace.id });
  }
  private async command(workspace: Workspace, args: string[]) {
    try {
      const result = await this.runCommand(this.config(workspace).bqPath, args);
      this.assertCurrent(workspace);
      this.services.store.set(this.storeKey(workspace, 'issue'), null);
      return result;
    } catch (error) {
      if (error instanceof WarehouseCliError) {
        this.services.store.set(this.storeKey(workspace, 'issue'), error.issue);
        this.services.emit();
      }
      throw error;
    }
  }
  async diagnose(input: unknown): Promise<WarehouseDiagnostics> {
    const v = scopeInput
      .extend({
        bqPath: z
          .string()
          .trim()
          .max(4096)
          .refine(
            (value) => isAbsolute(value) && warehouseAbsolutePath(value),
            'Use an absolute path to bq on this computer.'
          )
          .optional(),
      })
      .strict()
      .parse(input);
    const workspace = this.current(v.workspaceId);
    const config = this.config(workspace);
    const bqPath = v.bqPath ?? config.bqPath;
    const project = warehouseProject(workspace.selection.merchantId);
    const gcloudPath = warehouseGcloudPath(bqPath, this.exists);
    const report: WarehouseDiagnostics = {
      workspaceId: workspace.id,
      project,
      bqPath,
      gcloudPath,
      checkedAt: new Date(this.now()).toISOString(),
      sample: workspace.kind === 'sample',
      checks: [],
      commands: [],
    };
    if (workspace.kind === 'sample') {
      report.checks.push({
        id: 'metadata',
        label: 'Warehouse metadata',
        state: 'skipped',
        detail: 'The sample workspace uses synthetic data and does not run Google Cloud tools.',
      });
      return report;
    }
    const guard = () => {
      this.assertCurrent(workspace);
      if (JSON.stringify(config) !== JSON.stringify(this.config(workspace)))
        throw new Error('Warehouse settings changed. Run the connection checks again.');
    };
    const finish = () => {
      guard();
      report.checkedAt = new Date(this.now()).toISOString();
      if (
        gcloudPath &&
        report.checks.some(
          (check) => check.issue && ['auth_missing', 'auth_expired'].includes(check.issue.code)
        )
      )
        report.commands.push({
          label: 'Sign in only if the account check requires it',
          command: warehouseTerminalCommand(gcloudPath, ['auth', 'login']),
        });
      if (bqPath === config.bqPath) {
        this.services.store.set(this.storeKey(workspace, 'diagnostics'), report);
        this.services.store.set(
          this.storeKey(workspace, 'issue'),
          report.checks.find((check) => check.state === 'failed')?.issue || null
        );
        this.services.emit();
      }
      return report;
    };
    const failure = (error: unknown) =>
      error instanceof WarehouseCliError ? error.issue : warehouseIssue('unknown');
    const metadataArgs = [...this.base(workspace), 'ls', '--max_results=1', 'ultracart_dw'];
    report.commands = [
      { label: 'Check this BigQuery installation', command: warehouseTerminalCommand(bqPath, ['version']) },
      ...(gcloudPath
        ? [
            {
              label: 'Inspect CLI accounts in your terminal',
              command: warehouseTerminalCommand(gcloudPath, ['auth', 'list']),
            },
            {
              label: 'Check the CLI configuration directory',
              command: warehouseTerminalCommand(gcloudPath, [
                'info',
                '--format=value(config.paths.global_config_dir)',
              ]),
            },
          ]
        : []),
      {
        label: 'Check warehouse metadata without a query',
        command: warehouseTerminalCommand(bqPath, metadataArgs),
      },
    ];
    try {
      if (!this.exists(bqPath)) throw new WarehouseCliError(warehouseIssue('executable_missing'));
      const version = await this.runCommand(bqPath, ['version']);
      guard();
      if (!/BigQuery\s+(?:CLI\s+)?\d+\.\d+/i.test(version))
        throw new WarehouseCliError(warehouseIssue('unknown'));
      report.checks.push({
        id: 'executable',
        label: 'CLI and Python startup',
        state: 'passed',
        detail: 'The configured BigQuery CLI starts in Studio’s process environment.',
      });
    } catch (error) {
      guard();
      const issue = failure(error);
      report.checks.push({
        id: 'executable',
        label: 'CLI and Python startup',
        state: 'failed',
        detail: issue.detail,
        issue,
      });
      for (const [id, label] of [
        ['account', 'CLI account'],
        ['project', 'CLI default project'],
        ['metadata', 'Warehouse metadata'],
      ] as const)
        report.checks.push({
          id,
          label,
          state: 'skipped',
          detail: 'Fix CLI startup before checking this step.',
        });
      return finish();
    }
    if (gcloudPath) {
      try {
        const accounts: unknown = JSON.parse(
          await this.runCommand(gcloudPath, [
            'auth',
            'list',
            '--filter=status:ACTIVE',
            '--format=json(status)',
          ])
        );
        guard();
        if (
          !Array.isArray(accounts) ||
          accounts.some((account) => !account || typeof account.status !== 'string')
        )
          throw new Error('Unreadable account state');
        const active = accounts.some((account) => account.status === 'ACTIVE');
        report.checks.push({
          id: 'account',
          label: 'CLI account',
          state: active ? 'passed' : 'warning',
          detail: active
            ? 'An active CLI account is present. Credentials are not displayed or copied.'
            : 'No active stored account was reported. The metadata check determines whether another credential source works.',
          ...(active ? {} : { issue: warehouseIssue('auth_missing') }),
        });
      } catch (error) {
        guard();
        const issue = failure(error);
        report.checks.push({
          id: 'account',
          label: 'CLI account',
          state: 'warning',
          detail:
            'Studio could not confirm the local CLI account state. The metadata check will test actual access.',
          issue,
        });
      }
      try {
        const activeProject = (await this.runCommand(gcloudPath, ['config', 'get-value', 'project'])).trim();
        guard();
        report.checks.push({
          id: 'project',
          label: 'CLI default project',
          state: 'passed',
          detail:
            activeProject === project
              ? 'The CLI default matches this warehouse project.'
              : 'The CLI default differs or is unset. Studio explicitly passes the selected warehouse project, so the default does not need to change.',
        });
      } catch {
        guard();
        report.checks.push({
          id: 'project',
          label: 'CLI default project',
          state: 'warning',
          detail:
            'The CLI default could not be inspected. Studio explicitly passes the selected warehouse project.',
        });
      }
    } else {
      report.checks.push({
        id: 'account',
        label: 'CLI account',
        state: 'skipped',
        detail: 'No gcloud executable was found beside bq. The metadata check will test actual access.',
      });
      report.checks.push({
        id: 'project',
        label: 'CLI default project',
        state: 'skipped',
        detail: 'Studio explicitly passes the selected warehouse project.',
      });
    }
    try {
      await this.services.connection.verify(workspace.selection);
      guard();
      const metadata: unknown = JSON.parse(await this.runCommand(bqPath, metadataArgs));
      guard();
      if (
        !Array.isArray(metadata) ||
        metadata.some(
          (entry) =>
            entry?.tableReference?.projectId !== project ||
            entry?.tableReference?.datasetId !== 'ultracart_dw'
        )
      )
        throw new Error('Unexpected metadata scope');
      report.checks.push({
        id: 'metadata',
        label: 'Warehouse metadata',
        state: 'passed',
        detail:
          'The selected merchant’s dataset can be listed. No query ran. Query permissions and scan estimates still require a dry run.',
      });
    } catch (error) {
      guard();
      const issue = failure(error);
      report.checks.push({
        id: 'metadata',
        label: 'Warehouse metadata',
        state: 'failed',
        detail: issue.detail,
        issue,
      });
    }
    return finish();
  }
  async tables(input: unknown): Promise<WarehouseTable[]> {
    const v = scopeInput.strict().parse(input),
      workspace = this.current(v.workspaceId);
    if (workspace.kind === 'sample') return demoTables;
    await this.verify(workspace);
    const raw = await this.command(workspace, [
      ...this.base(workspace),
      'ls',
      '--max_results=1000',
      'ultracart_dw',
    ]);
    this.assertCurrent(workspace);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > 1000)
      throw new Error('BigQuery returned an invalid table list.');
    const project = warehouseProject(workspace.selection.merchantId);
    const tables: WarehouseTable[] = [];
    for (const entry of parsed) {
      const ref = entry?.tableReference;
      if (ref?.projectId !== project || ref?.datasetId !== 'ultracart_dw')
        throw new Error('BigQuery metadata belongs to another warehouse.');
      if (/^uc_[A-Za-z0-9_]{1,124}$/.test(ref.tableId))
        tables.push({ name: ref.tableId, type: typeof entry.type === 'string' ? entry.type : 'VIEW' });
    }
    tables.sort((a, b) => a.name.localeCompare(b.name));
    this.services.store.set(this.storeKey(workspace, 'tables'), tables);
    return tables;
  }
  async schema(input: unknown): Promise<WarehouseSchema> {
    const v = scopeInput.extend({ table: tableName }).strict().parse(input),
      workspace = this.current(v.workspaceId);
    if (workspace.kind === 'sample') {
      if (!demoFields[v.table]) throw new Error('Choose a table from the demo explorer.');
      return {
        table: v.table,
        fields: demoFields[v.table],
        fetchedAt: new Date(this.now()).toISOString(),
        sample: true,
      };
    }
    const tables = this.services.store.get<WarehouseTable[]>(this.storeKey(workspace, 'tables'), []);
    if (!tables.some((table) => table.name === v.table))
      throw new Error('Load the table list and choose a table before opening its schema.');
    await this.verify(workspace);
    const raw = await this.command(workspace, [
      ...this.base(workspace),
      'show',
      '--schema',
      `ultracart_dw.${v.table}`,
    ]);
    this.assertCurrent(workspace);
    return {
      table: v.table,
      fields: flattenFields(JSON.parse(raw)),
      fetchedAt: new Date(this.now()).toISOString(),
      sample: false,
    };
  }
  private saved(workspace: Workspace) {
    return this.services.store.get<WarehouseSavedQuery[]>(
      this.storeKey(workspace, 'saved'),
      workspace.kind === 'sample' ? warehouseDemoQueries : []
    );
  }
  save(input: unknown): WarehouseSavedQuery[] {
    const v = scopeInput
        .extend({
          id: z.string().max(100).optional(),
          name: z.string().trim().min(1).max(80),
          ...queryInput.shape,
          remove: z.boolean().optional(),
        })
        .strict()
        .parse(input),
      workspace = this.current(v.workspaceId);
    if (!v.remove) validateWarehouseSql(v.sql, warehouseProject(workspace.selection.merchantId));
    const saved = this.saved(workspace);
    if (v.id && !saved.some((query) => query.id === v.id))
      throw new Error('This saved query does not belong to the selected merchant.');
    const id = v.id || randomUUID();
    const next = saved.filter((query) => query.id !== id);
    if (!v.remove)
      next.unshift({
        id,
        name: v.name,
        sql: v.sql,
        rowLimit: v.rowLimit,
        maxBytes: v.maxBytes,
        updatedAt: new Date(this.now()).toISOString(),
      });
    if (next.length > 30)
      throw new Error('Remove a saved query before adding another. The limit is 30 per merchant.');
    this.services.store.set(this.storeKey(workspace, 'saved'), next);
    this.services.emit();
    return next;
  }
  history(input: unknown): WarehouseHistory[] {
    const v = scopeInput.strict().parse(input),
      workspace = this.current(v.workspaceId);
    return this.services.store.get(this.storeKey(workspace, 'history'), []);
  }
  private record(
    workspace: Workspace,
    query: WarehouseQuery,
    outcome: WarehouseHistory['outcome'],
    receipt?: WarehouseReceipt,
    detail?: string,
    attemptId?: string
  ) {
    const key = this.storeKey(workspace, 'history');
    const previous = this.services.store.get<WarehouseHistory[]>(key, []);
    const id = attemptId || randomUUID();
    this.services.store.set(
      key,
      [
        {
          id,
          sql: query.sql,
          queryHash: createHash('sha256').update(query.sql).digest('hex'),
          at: new Date(this.now()).toISOString(),
          outcome,
          estimatedBytes: receipt?.estimatedBytes ?? null,
          maxBytes: query.maxBytes,
          rowCount: receipt?.executed ? receipt.rows.length : null,
          sample: workspace.kind === 'sample',
          ...(detail ? { detail } : {}),
        },
        ...previous.filter((item) => item.id !== id),
      ].slice(0, 80)
    );
    this.services.emit();
    return id;
  }
  private sampleQuery(query: WarehouseQuery) {
    const normalize = (sql: string) => sql.replace(/\s+/g, ' ').trim().toLowerCase();
    const known = warehouseDemoQueries.find((item) => normalize(item.sql) === normalize(query.sql));
    if (!known)
      throw new Error(
        'Demo mode supports the three labeled sample queries. Connect a merchant warehouse to run custom SQL.'
      );
    return known;
  }
  private async dry(workspace: Workspace, query: WarehouseQuery): Promise<WarehouseReceipt> {
    const config = this.config(workspace);
    if (query.maxBytes > config.maxBytes)
      throw new Error(
        'This query exceeds the merchant scan ceiling. Lower its limit or explicitly change Warehouse settings.'
      );
    const project = warehouseProject(workspace.selection.merchantId);
    const refs = validateWarehouseSql(query.sql, project);
    const sql = boundedWarehouseSql(query, project);
    await this.verify(workspace);
    let estimate: { estimatedBytes: number; referencedTables: string[] };
    if (workspace.kind === 'sample') {
      this.sampleQuery(query);
      estimate = { estimatedBytes: 49152, referencedTables: refs };
      if (estimate.estimatedBytes > query.maxBytes)
        throw new Error('The synthetic scan estimate exceeds this query’s byte ceiling.');
    } else {
      const raw = await this.command(workspace, [
        ...this.base(workspace),
        'query',
        '--use_legacy_sql=false',
        '--dry_run',
        `--maximum_bytes_billed=${query.maxBytes}`,
        sql,
      ]);
      this.assertCurrent(workspace);
      estimate = parseWarehouseDryRun(raw, project, query.maxBytes, refs.length > 0);
      this.services.store.set(this.storeKey(workspace, 'checked'), new Date(this.now()).toISOString());
    }
    return {
      project,
      ...estimate,
      maxBytes: query.maxBytes,
      executed: false,
      rows: [],
      at: new Date(this.now()).toISOString(),
      sample: workspace.kind === 'sample',
    };
  }
  async prepare(input: unknown): Promise<WarehousePrepared> {
    const v = scopeInput.extend(queryInput.shape).strict().parse(input),
      workspace = this.current(v.workspaceId);
    const query = queryInput.parse(v);
    let receipt: WarehouseReceipt;
    try {
      receipt = await this.dry(workspace, query);
      this.assertCurrent(workspace);
      this.record(workspace, query, 'dry-run', receipt);
    } catch (error) {
      this.record(workspace, query, 'failed');
      throw error;
    }
    for (const [id, ticket] of this.tickets) if (ticket.expires <= this.now()) this.tickets.delete(id);
    if (this.tickets.size >= 20) this.tickets.delete(this.tickets.keys().next().value!);
    const ticket = randomUUID(),
      expires = this.now() + 5 * 60_000;
    this.tickets.set(ticket, {
      key: this.key(workspace),
      merchant: this.merchant(workspace),
      query,
      expires,
      config: JSON.stringify(this.config(workspace)),
    });
    return { ticket, expiresAt: new Date(expires).toISOString(), query, receipt };
  }
  async run(input: unknown): Promise<WarehouseReceipt> {
    const v = scopeInput.extend({ ticket: z.string().uuid() }).strict().parse(input),
      workspace = this.current(v.workspaceId),
      ticket = this.tickets.get(v.ticket);
    if (
      !ticket ||
      ticket.expires <= this.now() ||
      ticket.key !== this.key(workspace) ||
      ticket.config !== JSON.stringify(this.config(workspace))
    )
      throw new Error('Run a new dry run for the selected merchant before execution.');
    this.tickets.delete(v.ticket);
    let submitted = false;
    let attemptId: string | undefined;
    let receipt: WarehouseReceipt | undefined;
    try {
      receipt = await this.dry(workspace, ticket.query);
      this.assertCurrent(workspace);
      if (ticket.config !== JSON.stringify(this.config(workspace)))
        throw new Error('Warehouse settings changed. Run a new dry run.');
      attemptId = this.record(
        workspace,
        ticket.query,
        'uncertain',
        receipt,
        'Read submitted. Completion has not yet been recorded.'
      );
      submitted = true;
      let rows: unknown;
      if (workspace.kind === 'sample')
        rows = demoRows[this.sampleQuery(ticket.query).id].slice(0, ticket.query.rowLimit);
      else
        rows = JSON.parse(
          await this.command(workspace, [
            ...this.base(workspace),
            'query',
            '--use_legacy_sql=false',
            `--maximum_bytes_billed=${ticket.query.maxBytes}`,
            `--max_rows=${ticket.query.rowLimit}`,
            boundedWarehouseSql(ticket.query, receipt.project),
          ])
        );
      this.assertCurrent(workspace);
      if (
        !Array.isArray(rows) ||
        rows.length > ticket.query.rowLimit ||
        rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))
      )
        throw new Error('BigQuery returned an invalid or oversized row set.');
      receipt = {
        ...receipt,
        executed: true,
        rows: rows as Record<string, unknown>[],
        at: new Date(this.now()).toISOString(),
      };
      this.record(workspace, ticket.query, 'completed', receipt, undefined, attemptId);
      return receipt;
    } catch (error) {
      this.record(workspace, ticket.query, submitted ? 'uncertain' : 'failed', receipt, undefined, attemptId);
      throw error;
    }
  }
  dispose() {
    this.tickets.clear();
  }
}
