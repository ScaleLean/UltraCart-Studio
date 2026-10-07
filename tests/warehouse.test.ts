import test from 'node:test';
import assert from 'node:assert/strict';
import { devNull } from 'node:os';
import {
  WarehouseService,
  boundedWarehouseSql,
  parseWarehouseDryRun,
  validateWarehouseSql,
  warehouseProject,
} from '../src/main/warehouse';
import {
  warehouseAbsolutePath,
  warehouseBqPath,
  warehouseDemoQueries,
  WAREHOUSE_DEFAULT_BYTES,
  WAREHOUSE_MIN_BYTES,
} from '../src/shared/warehouse';
import {
  classifyWarehouseFailure,
  runWarehouseCommand,
  WarehouseCliError,
  warehouseIssue,
  warehouseLaunch,
  warehouseProcessEnv,
  warehouseTerminalCommand,
} from '../src/main/warehouse-diagnostics';
import { sampleWorkspace } from '../src/shared/sample';
import type { StudioServices } from '../src/main/services';
import type { Workspace } from '../src/shared/types';

const live: Workspace = {
  id: 'merchant-demo',
  kind: 'live',
  label: 'Demo merchant',
  selection: {
    profileId: 'demo',
    merchantId: 'DEMO',
    storefront: { id: 7, host: 'shop.example', themeId: 1 },
    verifiedAt: '2026-01-01T00:00:00.000Z',
  },
};
const query = {
  sql: 'SELECT COUNT(*) AS orders FROM ultracart_dw.uc_orders',
  rowLimit: 25,
  maxBytes: 100 * 1024 ** 2,
};
const dry = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    statistics: {
      query: {
        statementType: 'SELECT',
        totalBytesProcessed: '65536',
        referencedTables: [
          { projectId: 'ultracart-dw-demo', datasetId: 'ultracart_dw_streaming', tableId: 'uc_orders' },
        ],
        ...overrides,
      },
    },
  });
function fixture(workspace: Workspace = structuredClone(live)) {
  const values = new Map<string, unknown>();
  let current = workspace,
    now = 1000,
    verified = 0;
  const commands: { command: string; args: string[] }[] = [];
  const services = {
    workspace: () => current,
    settings: () => ({ nodePath: '/node', cliPath: '/toolkit' }),
    emit: () => {},
    connection: {
      verify: async () => {
        verified++;
      },
    },
    store: {
      get: <T>(key: string, fallback: T) => (values.has(key) ? (values.get(key) as T) : fallback),
      set: (key: string, value: unknown) => values.set(key, value),
    },
  } as unknown as StudioServices;
  let response = async (args: string[]) => {
    if (args.includes('ls'))
      return JSON.stringify([
        {
          tableReference: { projectId: 'ultracart-dw-demo', datasetId: 'ultracart_dw', tableId: 'uc_orders' },
          type: 'VIEW',
        },
      ]);
    if (args.includes('show'))
      return JSON.stringify([
        { name: 'order_id', type: 'STRING', mode: 'NULLABLE' },
        { name: 'items', type: 'RECORD', mode: 'REPEATED', fields: [{ name: 'sku', type: 'STRING' }] },
      ]);
    return args.includes('--dry_run') ? dry() : JSON.stringify([{ orders: '42' }]);
  };
  const warehouse = new WarehouseService(services, {
    exists: () => true,
    now: () => now,
    run: async (command, args) => {
      commands.push({ command, args });
      return response(args);
    },
  });
  return {
    warehouse,
    commands,
    values,
    services,
    setWorkspace: (w: Workspace) => {
      current = w;
    },
    setResponse: (next: typeof response) => {
      response = next;
    },
    advance: (ms: number) => {
      now += ms;
    },
    verified: () => verified,
  };
}

test('warehouse SQL allows scoped SELECT/CTEs and refuses writes, external functions and unscoped tables', () => {
  const project = warehouseProject('DEMO');
  assert.equal(project, 'ultracart-dw-demo');
  assert.deepEqual(validateWarehouseSql(query.sql, project), ['ultracart-dw-demo.ultracart_dw.uc_orders']);
  validateWarehouseSql(
    'WITH orders AS (SELECT total FROM `ultracart-dw-demo.ultracart_dw.uc_orders`) SELECT SUM(total) FROM orders',
    project
  );
  validateWarehouseSql(
    'SELECT COUNT(*) FROM ultracart_dw.uc_orders o, UNNEST(o.items) i WHERE DATE(o.created) > DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)',
    project
  );
  assert.match(boundedWarehouseSql(query, project), /LIMIT 25$/);
  for (const sql of [
    'DELETE FROM ultracart_dw.uc_orders',
    'SELECT 1; SELECT 2',
    'SELECT 1 -- comment',
    'SELECT /* comment */ 1',
    'SELECT * FROM ultracart_dw_streaming.uc_orders',
    'SELECT * FROM `other-project.ultracart_dw.uc_orders`',
    'SELECT * FROM ultracart_dw.uc_orders a, `foreign-project.ultracart_dw.uc_orders` b',
    'SELECT * FROM ultracart_dw.uc_orders UNION ALL SELECT * FROM secret.customers',
    "SELECT EXTERNAL_QUERY('connection', 'query')",
    'SELECT `ultracart-dw-demo.ultracart_dw.remote_function`(1)',
    'SELECT custom_function(1)',
    'SELECT * FROM `ultracart-dw-demo.ultracart_dw.uc_orders*`',
  ])
    assert.throws(() => validateWarehouseSql(sql, project), sql);
});

test('parenthesized joins validate every table, including the first item and nested parentheses', () => {
  const project = 'ultracart-dw-demo';
  for (const sql of [
    // Issue #18 reproductions.
    'SELECT 1 FROM (`ultracart-dw-other.ultracart_dw.uc_orders` CROSS JOIN ultracart_dw.uc_x)',
    'SELECT 1 FROM (`region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT CROSS JOIN ultracart_dw.uc_x)',
    'SELECT 1 FROM ((`ultracart-dw-other.ultracart_dw.uc_orders` CROSS JOIN ultracart_dw.uc_x))',
    'SELECT 1 FROM ((ultracart_dw_streaming.raw_orders JOIN ultracart_dw.uc_x ON TRUE) CROSS JOIN ultracart_dw.uc_y)',
    'SELECT 1 FROM ultracart_dw.uc_x JOIN (secret.customers CROSS JOIN ultracart_dw.uc_y) ON TRUE',
    'SELECT 1 FROM ultracart_dw.uc_x, (ultracart_dw_streaming.uc_orders CROSS JOIN ultracart_dw.uc_y)',
    'SELECT 1 FROM (ultracart_dw.uc_x, secret.customers)',
    'SELECT 1 FROM ((ultracart_dw.uc_x, (`other-project`.ultracart_dw.uc_y)))',
  ])
    assert.throws(() => validateWarehouseSql(sql, project), /ultracart_dw\.uc_\*/, sql);
  assert.deepEqual(
    validateWarehouseSql(
      'SELECT 1 FROM ((ultracart_dw.uc_a CROSS JOIN `ultracart-dw-demo.ultracart_dw.uc_b`) JOIN ultracart_dw.uc_c ON TRUE)',
      project
    ),
    [
      'ultracart-dw-demo.ultracart_dw.uc_a',
      'ultracart-dw-demo.ultracart_dw.uc_b',
      'ultracart-dw-demo.ultracart_dw.uc_c',
    ]
  );
});

test('table references are deny-by-default against adversarial paths, qualifiers and positions', () => {
  const project = 'ultracart-dw-demo';
  const rejected = {
    'INFORMATION_SCHEMA': [
      'SELECT * FROM ultracart_dw.INFORMATION_SCHEMA.TABLES',
      'SELECT * FROM `ultracart-dw-demo`.ultracart_dw.INFORMATION_SCHEMA.COLUMNS',
      'SELECT * FROM INFORMATION_SCHEMA.SCHEMATA',
      'SELECT * FROM `ultracart-dw-demo.INFORMATION_SCHEMA.SCHEMATA`',
      'SELECT * FROM ultracart_dw.uc_a WHERE EXISTS (SELECT 1 FROM ultracart_dw.INFORMATION_SCHEMA.TABLES)',
      'SELECT (SELECT COUNT(*) FROM INFORMATION_SCHEMA.SCHEMATA) FROM ultracart_dw.uc_a',
    ],
    'region qualifiers': [
      'SELECT * FROM `region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT',
      'SELECT * FROM `region-us.INFORMATION_SCHEMA.JOBS`',
      'SELECT * FROM region-us.INFORMATION_SCHEMA.JOBS',
      'SELECT * FROM `ultracart-dw-demo`.`region-eu`.INFORMATION_SCHEMA.JOBS',
    ],
    'UNNEST of table paths': [
      'SELECT * FROM UNNEST(`ultracart-dw-other.ultracart_dw.uc_orders`)',
      'SELECT * FROM UNNEST(ultracart_dw_streaming.raw_orders)',
      'SELECT x FROM ultracart_dw.uc_a, UNNEST(`ultracart-dw-demo`.ultracart_dw_streaming.orders) x',
      'SELECT x FROM ultracart_dw.uc_a a, UNNEST(ultracart_dw.raw_orders) x',
      'SELECT 1 FROM ultracart_dw.uc_a WHERE 1 IN UNNEST(`region-us`.INFORMATION_SCHEMA.JOBS)',
    ],
    'comma joins inside parentheses': [
      'SELECT 1 FROM (ultracart_dw.uc_x a, (other.t) b)',
      'SELECT 1 FROM ((ultracart_dw.uc_x), (ultracart_dw.uc_y, ultracart_dw_streaming.uc_z))',
      'SELECT 1 FROM ultracart_dw.uc_x JOIN (ultracart_dw.uc_y, secret.t) ON TRUE',
    ],
    'subqueries in JOIN ON': [
      'SELECT 1 FROM ultracart_dw.uc_a a JOIN ultracart_dw.uc_b b ON a.id IN (SELECT id FROM secret.customers)',
      'SELECT 1 FROM ultracart_dw.uc_a a JOIN ultracart_dw.uc_b b ON EXISTS (SELECT 1 FROM (`p-x.ultracart_dw.uc_a` CROSS JOIN ultracart_dw.uc_b))',
      'SELECT 1 FROM ultracart_dw.uc_a a JOIN ultracart_dw.uc_b b ON a.id = (SELECT MAX(id) FROM ultracart_dw.uc_c, ultracart_dw_streaming.c)',
    ],
    'backtick-quoted full paths': [
      'SELECT * FROM `ultracart-dw-other.ultracart_dw.uc_orders`',
      'SELECT * FROM `ultracart-dw-demo.ultracart_dw_streaming.uc_orders`',
      'SELECT * FROM `ultracart-dw-demo`.`ultracart_dw_streaming`.`uc_orders`',
      'SELECT * FROM `ultracart_dw.raw_orders`',
      'SELECT * FROM `ultracart_dw`.`uc_orders.extra`',
      'SELECT * FROM `ultracart_dw..uc_orders`',
      'SELECT * FROM `.ultracart_dw.uc_orders`',
      'SELECT `ultracart-dw-other.ultracart_dw.uc_orders`.total FROM ultracart_dw.uc_a',
      'SELECT `other.dataset`.col FROM ultracart_dw.uc_a',
    ],
    'implicit dataset-qualified names': [
      'SELECT * FROM ultracart_dw_streaming.uc_orders',
      'SELECT * FROM secret.customers',
      'SELECT * FROM uc_orders',
      'SELECT * FROM ultracart_dw.orders',
      'SELECT * FROM ULTRACART_DW.uc_orders',
      'SELECT * FROM ultracart_dw.uc_a a, a.items',
      'WITH uc_x AS (SELECT 1) SELECT * FROM uc_x, secret.t',
      'SELECT ultracart_dw_streaming.raw.col FROM ultracart_dw.uc_a',
    ],
    'subqueries and CTEs as FROM items': [
      'SELECT * FROM (SELECT * FROM secret.customers)',
      'SELECT * FROM ((SELECT 1) CROSS JOIN secret.t)',
      'SELECT * FROM (WITH x AS (SELECT 1) SELECT * FROM x, secret.t)',
      'WITH x AS (SELECT * FROM (ultracart_dw_streaming.raw JOIN ultracart_dw.uc_a ON TRUE)) SELECT * FROM x',
    ],
  };
  for (const [group, list] of Object.entries(rejected))
    for (const sql of list) assert.throws(() => validateWarehouseSql(sql, project), `${group}: ${sql}`);
  for (const sql of [
    'SELECT o.total FROM ultracart_dw.uc_orders o JOIN (SELECT order_id FROM ultracart_dw.uc_items) i ON o.order_id = i.order_id',
    'SELECT shipping.address.city, o.billing.zip FROM ultracart_dw.uc_orders o',
    'SELECT a.id FROM (ultracart_dw.uc_a a JOIN ultracart_dw.uc_b b ON a.id = b.id)',
    'SELECT COUNT(*) FROM ultracart_dw.uc_orders o, UNNEST(o.items) i',
    'SELECT x.n FROM (SELECT 1 AS n, 2 AS m) x',
    'WITH a AS (SELECT 1 AS n), b AS (SELECT n FROM a) SELECT * FROM (a CROSS JOIN b)',
    "SELECT 'region-us.INFORMATION_SCHEMA.JOBS' AS label FROM ultracart_dw.uc_a",
  ])
    validateWarehouseSql(sql, project);
});

test('CTE names come only from WITH lists and never shadow dashed or dotted table paths', () => {
  const project = 'ultracart-dw-demo';
  const raw = 'ultracart-dw-demo.ultracart_dw_streaming.orders';
  const rejected = {
    'integration review reproductions': [
      `WITH ultracart AS (SELECT 1) SELECT * FROM ultracart_dw.uc_orders o, ${raw}`,
      `SELECT * FROM ultracart_dw.uc_orders o, ${raw} WINDOW ultracart AS (ORDER BY 1)`,
    ],
    'WINDOW names are not CTEs': [
      'SELECT * FROM ultracart_dw.uc_a, w WINDOW w AS (ORDER BY 1)',
      'SELECT * FROM ultracart_dw.uc_a, secret WINDOW secret AS (PARTITION BY id)',
      'WITH x AS (SELECT 1) SELECT * FROM x, w WINDOW w AS (ORDER BY 1)',
      `SELECT * FROM (SELECT 1 FROM ultracart_dw.uc_a WINDOW ultracart AS (ORDER BY 1)), ${raw}`,
    ],
    'CTE names equal to project or dataset prefixes': [
      `WITH ultracart AS (SELECT 1) SELECT * FROM ${raw}`,
      `WITH RECURSIVE ultracart AS (SELECT 1) SELECT * FROM ${raw}`,
      `with recursive ultracart as (select 1) select * from ${raw}`,
      `WITH a AS (SELECT 1), ultracart AS (SELECT 2) SELECT * FROM a, ${raw}`,
      'WITH ultracart_dw_streaming AS (SELECT 1) SELECT * FROM ultracart_dw_streaming.orders',
      'WITH ultracart_dw_streaming AS (SELECT 1) SELECT * FROM ultracart_dw_streaming.1orders',
      'WITH ultracart AS (SELECT 1) SELECT * FROM ultracart.ultracart_dw_streaming.orders',
      'WITH region AS (SELECT 1) SELECT * FROM region-us.INFORMATION_SCHEMA.JOBS',
      'WITH secret AS (SELECT 1) SELECT * FROM secret.customers',
      'WITH ultracart AS (SELECT 1) SELECT * FROM `ultracart`-dw-demo.ultracart_dw_streaming.orders',
    ],
    'aliases that shadow a dashed prefix': [
      `SELECT * FROM ultracart_dw.uc_a AS ultracart, ${raw}`,
      `SELECT * FROM ultracart_dw.uc_a ultracart JOIN ${raw} ON TRUE`,
      `SELECT * FROM (SELECT 1) ultracart, ${raw}`,
      `SELECT * FROM ultracart_dw.uc_a, UNNEST([1]) AS ultracart, ${raw}`,
      `SELECT STRUCT(1 AS ultracart) FROM ultracart_dw.uc_a, ${raw}`,
    ],
    'dashed names after commas and in JOIN chains': [
      `SELECT * FROM ultracart_dw.uc_a, ultracart_dw.uc_b, ${raw}`,
      `SELECT * FROM ultracart_dw.uc_a JOIN ultracart_dw.uc_b ON TRUE LEFT JOIN ${raw} ON TRUE`,
      `SELECT * FROM ultracart_dw.uc_a CROSS JOIN ${raw} CROSS JOIN ultracart_dw.uc_b`,
      `WITH ultracart AS (SELECT 1) SELECT * FROM (ultracart_dw.uc_a CROSS JOIN ${raw})`,
      `WITH ultracart AS (SELECT 1) SELECT * FROM (${raw} CROSS JOIN ultracart_dw.uc_a)`,
      `SELECT * FROM ultracart_dw.uc_a-dw-demo.ultracart_dw_streaming.orders`,
      `SELECT * FROM ultracart_dw.uc_a - dw`,
      'SELECT * FROM ultracart-dw-demo.ultracart_dw.uc_orders',
    ],
    'subqueries, UNNEST and nested WITH': [
      `WITH ultracart AS (SELECT 1) SELECT (SELECT COUNT(*) FROM ${raw}) FROM ultracart`,
      `WITH ultracart AS (SELECT 1) SELECT * FROM ultracart WHERE EXISTS (SELECT 1 FROM ${raw})`,
      `SELECT * FROM (WITH ultracart AS (SELECT 1) SELECT * FROM ${raw})`,
      `WITH x AS (WITH ultracart AS (SELECT 1) SELECT * FROM ${raw}) SELECT * FROM x`,
      `WITH ultracart AS (SELECT 1) SELECT * FROM ultracart_dw.uc_a, UNNEST(a.items), ${raw}`,
      `WITH ultracart AS (SELECT 1) SELECT * FROM ultracart_dw.uc_a UNION ALL SELECT * FROM ${raw}`,
      `SELECT * FROM ultracart_dw.uc_a x, UNNEST(x.items) WITH OFFSET AS ultracart, ${raw}`,
    ],
  };
  for (const [group, list] of Object.entries(rejected))
    for (const sql of list)
      assert.throws(() => validateWarehouseSql(sql, project), /ultracart_dw\.uc_\*/, `${group}: ${sql}`);
  for (const [sql, refs] of [
    ['WITH ultracart AS (SELECT 1) SELECT * FROM ultracart', []],
    ['WITH RECURSIVE r AS (SELECT 1 AS n) SELECT * FROM r', []],
    [
      'WITH a AS (SELECT * FROM ultracart_dw.uc_a), b AS (SELECT * FROM a) SELECT * FROM a, b',
      ['ultracart-dw-demo.ultracart_dw.uc_a'],
    ],
    [
      'SELECT id, SUM(total) OVER w FROM ultracart_dw.uc_orders WINDOW w AS (PARTITION BY id ORDER BY created)',
      ['ultracart-dw-demo.ultracart_dw.uc_orders'],
    ],
    [
      'WITH ultracart_dw AS (SELECT 1) SELECT * FROM ultracart_dw.uc_orders',
      ['ultracart-dw-demo.ultracart_dw.uc_orders'],
    ],
    [
      'SELECT * FROM `ultracart-dw-demo.ultracart_dw.uc_orders` o, UNNEST(o.items) WITH OFFSET AS pos',
      ['ultracart-dw-demo.ultracart_dw.uc_orders'],
    ],
    ['SELECT total - 1 AS net FROM ultracart_dw.uc_orders', ['ultracart-dw-demo.ultracart_dw.uc_orders']],
  ] as const)
    assert.deepEqual(validateWarehouseSql(sql, project), refs, sql);
});

test('dry-run receipts accept curated uc_* views and their streaming sources only', () => {
  const project = 'ultracart-dw-demo';
  const tables = (...refs: [string, string][]) =>
    dry({ referencedTables: refs.map(([datasetId, tableId]) => ({ projectId: project, datasetId, tableId })) });
  assert.deepEqual(
    parseWarehouseDryRun(tables(['ultracart_dw', 'uc_orders'], ['ultracart_dw_streaming', 'orders']), project, query.maxBytes, true)
      .referencedTables,
    ['ultracart-dw-demo.ultracart_dw.uc_orders', 'ultracart-dw-demo.ultracart_dw_streaming.orders']
  );
  for (const text of [
    tables(['ultracart_dw', 'orders']),
    tables(['ultracart_dw', 'UC_orders']),
    tables(['ultracart_dw', 'INFORMATION_SCHEMA']),
    tables(['ultracart_dw_high', 'uc_orders']),
    tables(['ultracart_dw_streaming', 'bad-name']),
    tables(['ultracart_dw', 'uc_orders'], ['other', 'uc_orders']),
  ])
    assert.throws(() => parseWarehouseDryRun(text, project, query.maxBytes, true), text);
  // SQL that names no curated view must not resolve to any table at all.
  assert.throws(
    () => parseWarehouseDryRun(tables(['ultracart_dw_streaming', 'orders']), project, query.maxBytes, false),
    /does not name/
  );
});

test('statement keywords are rejected only at statement position, so valid SQL using them passes', () => {
  const project = 'ultracart-dw-demo';
  for (const sql of [
    "SELECT REPLACE(name, 'x', 'y') AS name FROM ultracart_dw.uc_orders",
    'SELECT * REPLACE (LOWER(channel) AS channel) FROM ultracart_dw.uc_orders',
    'SELECT model, `set`, load FROM ultracart_dw.uc_orders',
    'SELECT o.model, o.set, o.load FROM ultracart_dw.uc_orders o WHERE load > 1 AND (set IS NULL OR model = 2)',
    'SELECT a, set, load FROM ultracart_dw.uc_orders ORDER BY model, set',
    'SELECT MAX(load) AS model, COUNT(set) FROM ultracart_dw.uc_orders GROUP BY model',
    'WITH model AS (SELECT load FROM ultracart_dw.uc_orders) SELECT load AS set FROM model',
  ])
    validateWarehouseSql(sql, project);
  for (const sql of [
    'DELETE FROM ultracart_dw.uc_orders WHERE TRUE',
    'INSERT INTO ultracart_dw.uc_orders SELECT 1',
    'WITH x AS (SELECT 1) DELETE FROM ultracart_dw.uc_orders WHERE TRUE',
    'WITH x AS (SELECT 1), y AS (SELECT 2) INSERT INTO ultracart_dw.uc_orders SELECT 1',
    'WITH x AS (SELECT 1) SET y = 1',
    'WITH x AS (DELETE FROM ultracart_dw.uc_orders WHERE TRUE) SELECT 1',
    'SELECT * FROM (DELETE FROM ultracart_dw.uc_orders WHERE TRUE)',
    'SELECT * FROM (UPDATE ultracart_dw.uc_orders SET a = 1 WHERE TRUE)',
    'SELECT * FROM (MERGE ultracart_dw.uc_orders USING ultracart_dw.uc_x ON TRUE)',
    'SELECT * FROM (CREATE TABLE ultracart_dw.uc_t AS SELECT 1)',
    'SELECT * FROM (DROP TABLE ultracart_dw.uc_orders)',
    'SELECT * FROM (TRUNCATE TABLE ultracart_dw.uc_orders)',
    "SELECT * FROM (EXECUTE IMMEDIATE 'SELECT 1')",
    'SELECT * FROM (DECLARE x INT64)',
    'SELECT * FROM (BEGIN TRANSACTION)',
    'SELECT * FROM (LOAD DATA INTO ultracart_dw.uc_t FROM FILES)',
    'SELECT 1 FROM ultracart_dw.uc_orders UNION ALL DELETE FROM ultracart_dw.uc_orders WHERE TRUE',
    'SELECT 1 FROM ultracart_dw.uc_orders EXCEPT DISTINCT INSERT INTO ultracart_dw.uc_x SELECT 1',
    'SELECT 1 FROM ultracart_dw.uc_orders UNION ALL (CALL proc())',
    "SELECT EXTERNAL_QUERY('connection', 'SELECT 1')",
    'SELECT external_query FROM ultracart_dw.uc_orders',
  ])
    assert.throws(() => validateWarehouseSql(sql, project), sql);
  // The dry run still rejects any non-SELECT statement BigQuery reports.
  for (const statementType of ['SCRIPT', 'INSERT', 'CREATE_TABLE_AS_SELECT', 'EXPORT_DATA'])
    assert.throws(
      () => parseWarehouseDryRun(dry({ statementType }), project, query.maxBytes, true),
      /read-only SELECT/
    );
});

test('byte ceilings below the 10 MiB BigQuery billing minimum are rejected', async () => {
  const f = fixture();
  for (const maxBytes of [1, 1000, WAREHOUSE_MIN_BYTES - 1]) {
    assert.throws(() => f.warehouse.configure({ workspaceId: live.id, maxBytes }), /10 MiB/);
    await assert.rejects(f.warehouse.prepare({ workspaceId: live.id, ...query, maxBytes }), /10 MiB/);
    assert.throws(() => f.warehouse.save({ workspaceId: live.id, name: 'Low', ...query, maxBytes }), /10 MiB/);
  }
  assert.equal(f.commands.length, 0);
  f.warehouse.configure({ workspaceId: live.id, maxBytes: WAREHOUSE_MIN_BYTES });
  const prepared = await f.warehouse.prepare({ workspaceId: live.id, ...query, maxBytes: WAREHOUSE_MIN_BYTES });
  assert.equal(prepared.receipt.maxBytes, WAREHOUSE_MIN_BYTES);
});

test('EXTRACT date expressions preserve nested SELECT and JOIN scope checks', () => {
  const project = 'ultracart-dw-demo';
  assert.deepEqual(
    validateWarehouseSql(
      'SELECT EXTRACT(YEAR FROM created_at) AS year, COUNT(*) FROM ultracart_dw.uc_orders GROUP BY year',
      project
    ),
    ['ultracart-dw-demo.ultracart_dw.uc_orders']
  );
  assert.deepEqual(
    validateWarehouseSql(
      'SELECT EXTRACT(DAY FROM (SELECT MAX(created_at) FROM ultracart_dw.uc_orders)) AS day',
      project
    ),
    ['ultracart-dw-demo.ultracart_dw.uc_orders']
  );
  assert.deepEqual(
    validateWarehouseSql('SELECT `FROM`, EXTRACT(YEAR FROM created_at) FROM ultracart_dw.uc_orders', project),
    ['ultracart-dw-demo.ultracart_dw.uc_orders']
  );
  for (const sql of [
    'SELECT EXTRACT(DAY FROM (SELECT MAX(created_at) FROM `other.ultracart_dw.uc_orders`))',
    'SELECT EXTRACT(DAY FROM created_at) FROM ultracart_dw.uc_orders o JOIN secret.customers c ON o.id = c.id',
    "SELECT EXTRACT(DAY FROM EXTERNAL_QUERY('connection', 'SELECT now()')) FROM ultracart_dw.uc_orders",
    'SELECT EXTRACT(DAY FROM (SELECT MAX(created_at) FROM ultracart_dw.uc_orders o, `other.ultracart_dw.uc_orders` x))',
  ])
    assert.throws(() => validateWarehouseSql(sql, project), sql);
});

test('warehouse dry-run receipts require SELECT, valid estimates and same-project resolved tables', () => {
  assert.equal(parseWarehouseDryRun(dry(), 'ultracart-dw-demo', query.maxBytes, true).estimatedBytes, 65536);
  for (const overrides of [
    { statementType: 'INSERT' },
    { statementType: undefined },
    { totalBytesProcessed: undefined },
    { totalBytesProcessed: '-1' },
    { totalBytesProcessed: String(query.maxBytes + 1) },
    { referencedTables: [] },
    { referencedTables: [{ projectId: 'other', datasetId: 'ultracart_dw_streaming', tableId: 'uc_orders' }] },
    {
      referencedTables: [
        { projectId: 'ultracart-dw-demo', datasetId: 'ultracart_dw_high', tableId: 'customers' },
      ],
    },
  ])
    assert.throws(() => parseWarehouseDryRun(dry(overrides), 'ultracart-dw-demo', query.maxBytes, true));
  assert.deepEqual(
    parseWarehouseDryRun(
      dry({ totalBytesProcessed: '0', referencedTables: [] }),
      'ultracart-dw-demo',
      query.maxBytes,
      false
    ).referencedTables,
    []
  );
});

test('explicit execution consumes its ticket, repeats dry run and applies native byte and row limits', async () => {
  const f = fixture();
  const prepared = await f.warehouse.prepare({ workspaceId: live.id, ...query });
  assert.equal(f.commands.length, 1);
  assert.equal(prepared.receipt.executed, false);
  const result = await f.warehouse.run({ workspaceId: live.id, ticket: prepared.ticket });
  assert.equal(result.rows[0].orders, '42');
  assert.equal(f.commands.length, 3);
  assert.equal(f.commands[1].args.includes('--dry_run'), true);
  assert.equal(f.commands[2].args.includes('--dry_run'), false);
  assert.ok(f.commands.every((command) => command.args.includes(`--bigqueryrc=${devNull}`)));
  assert.ok(f.commands.every((command) => command.args.includes('--project_id=ultracart-dw-demo')));
  assert.ok(f.commands.every((command) => command.args.includes(`--maximum_bytes_billed=${query.maxBytes}`)));
  assert.ok(f.commands[2].args.includes('--max_rows=25'));
  assert.ok(f.commands.every((command) => /LIMIT 25$/.test(command.args.at(-1)!)));
  await assert.rejects(f.warehouse.run({ workspaceId: live.id, ticket: prepared.ticket }), /new dry run/);
  assert.equal(f.commands.length, 3);
});

test('warehouse tickets reject stale workspaces, changed identity, changed ceilings and expiration', async () => {
  const f = fixture();
  const prepared = await f.warehouse.prepare({ workspaceId: live.id, ...query });
  await assert.rejects(
    f.warehouse.run({ workspaceId: 'other', ticket: prepared.ticket }),
    /workspace changed/
  );
  f.setWorkspace({ ...live, selection: { ...live.selection, verifiedAt: '2026-02-01' } });
  await assert.rejects(f.warehouse.run({ workspaceId: live.id, ticket: prepared.ticket }), /new dry run/);
  f.setWorkspace(structuredClone(live));
  f.warehouse.configure({ workspaceId: live.id, maxBytes: WAREHOUSE_DEFAULT_BYTES });
  await assert.rejects(f.warehouse.run({ workspaceId: live.id, ticket: prepared.ticket }), /new dry run/);
  const expired = await f.warehouse.prepare({ workspaceId: live.id, ...query });
  f.advance(300001);
  await assert.rejects(f.warehouse.run({ workspaceId: live.id, ticket: expired.ticket }), /new dry run/);
  assert.equal(f.commands.filter((command) => !command.args.includes('--dry_run')).length, 0);
});

test('a fresh dry-run boundary failure or a lowered merchant ceiling blocks query execution', async () => {
  const f = fixture();
  f.warehouse.configure({ workspaceId: live.id, maxBytes: WAREHOUSE_MIN_BYTES });
  await assert.rejects(f.warehouse.prepare({ workspaceId: live.id, ...query }), /merchant scan ceiling/);
  assert.equal(f.commands.length, 0);
  f.warehouse.configure({ workspaceId: live.id, maxBytes: WAREHOUSE_DEFAULT_BYTES });
  const prepared = await f.warehouse.prepare({ workspaceId: live.id, ...query });
  f.setResponse(async () =>
    dry({
      referencedTables: [{ projectId: 'foreign', datasetId: 'ultracart_dw_streaming', tableId: 'uc_orders' }],
    })
  );
  await assert.rejects(
    f.warehouse.run({ workspaceId: live.id, ticket: prepared.ticket }),
    /outside the selected merchant/
  );
  assert.ok(f.commands.every((command) => command.args.includes('--dry_run')));
});

test('metadata uses bounded list and schema commands; nested fields are retained without query execution', async () => {
  const f = fixture();
  await assert.rejects(
    f.warehouse.schema({ workspaceId: live.id, table: 'uc_orders' }),
    /Load the table list/
  );
  const tables = await f.warehouse.tables({ workspaceId: live.id });
  assert.equal(tables[0].name, 'uc_orders');
  const schema = await f.warehouse.schema({ workspaceId: live.id, table: 'uc_orders' });
  assert.deepEqual(
    schema.fields.map((field) => field.path),
    ['order_id', 'items', 'items.sku']
  );
  assert.equal(f.commands.length, 2);
  assert.ok(f.commands.every((command) => !command.args.includes('query')));
  assert.ok(f.commands[0].args.includes('--max_results=1000'));
  f.setResponse(async () =>
    JSON.stringify([
      { tableReference: { projectId: 'foreign', datasetId: 'ultracart_dw', tableId: 'uc_orders' } },
    ])
  );
  await assert.rejects(f.warehouse.tables({ workspaceId: live.id }), /another warehouse/);
});

test('saved queries and history stay merchant-scoped, and saving never executes SQL', async () => {
  const f = fixture();
  const saved = f.warehouse.save({ workspaceId: live.id, name: 'Orders', ...query });
  assert.equal(saved.length, 1);
  assert.equal(f.commands.length, 0);
  await f.warehouse.prepare({ workspaceId: live.id, ...query });
  const other = { ...live, id: 'other', selection: { ...live.selection, merchantId: 'OTHER' } };
  f.setWorkspace(other);
  assert.equal(f.warehouse.status({ workspaceId: other.id }).saved.length, 0);
  assert.equal(f.warehouse.history({ workspaceId: other.id }).length, 0);
  assert.throws(
    () => f.warehouse.save({ workspaceId: other.id, id: saved[0].id, name: 'Orders', ...query }),
    /does not belong/
  );
  f.setWorkspace(structuredClone(live));
  assert.equal(f.warehouse.history({ workspaceId: live.id }).length, 1);
});

test('sample warehouse has labeled synthetic schemas and results and never starts an external process', async () => {
  const f = fixture(structuredClone(sampleWorkspace));
  const status = f.warehouse.status({ workspaceId: sampleWorkspace.id });
  assert.equal(status.sample, true);
  assert.equal(status.saved.length, 3);
  assert.equal((await f.warehouse.tables({ workspaceId: sampleWorkspace.id })).length, 3);
  assert.equal(
    (await f.warehouse.schema({ workspaceId: sampleWorkspace.id, table: 'uc_orders' })).sample,
    true
  );
  const first = warehouseDemoQueries[0];
  const prepared = await f.warehouse.prepare({
    workspaceId: sampleWorkspace.id,
    sql: first.sql,
    rowLimit: 10,
    maxBytes: first.maxBytes,
  });
  const result = await f.warehouse.run({ workspaceId: sampleWorkspace.id, ticket: prepared.ticket });
  assert.equal(result.sample, true);
  assert.equal(result.rows.length, 5);
  await assert.rejects(
    f.warehouse.prepare({ workspaceId: sampleWorkspace.id, ...query }),
    /three labeled sample queries/
  );
  assert.equal(f.commands.length, 0);
  assert.equal(f.verified(), 0);
});

test('uncertain or oversized results consume the ticket and never report a successful completion', async () => {
  const f = fixture();
  const prepared = await f.warehouse.prepare({ workspaceId: live.id, ...query });
  f.setResponse(async (args) => {
    if (args.includes('--dry_run')) return dry();
    throw new Error('response lost');
  });
  await assert.rejects(f.warehouse.run({ workspaceId: live.id, ticket: prepared.ticket }), /response lost/);
  assert.equal(f.warehouse.history({ workspaceId: live.id })[0].outcome, 'uncertain');
  assert.equal(f.warehouse.history({ workspaceId: live.id }).length, 2);
  await assert.rejects(f.warehouse.run({ workspaceId: live.id, ticket: prepared.ticket }), /new dry run/);
  f.setResponse(async (args) => (args.includes('--dry_run') ? dry() : JSON.stringify([{ n: 1 }, { n: 2 }])));
  const second = await f.warehouse.prepare({ workspaceId: live.id, ...query, rowLimit: 1 });
  await assert.rejects(f.warehouse.run({ workspaceId: live.id, ticket: second.ticket }), /oversized row set/);
  assert.equal(f.warehouse.history({ workspaceId: live.id })[0].outcome, 'uncertain');
});

test('a workspace switch during a dry run prevents a prepared ticket and keeps history under its original merchant', async () => {
  const f = fixture();
  assert.equal(f.warehouse.status({ workspaceId: live.id }).access, 'unchecked');
  assert.equal(f.commands.length, 0);
  const other = { ...live, id: 'other', selection: { ...live.selection, merchantId: 'OTHER' } };
  f.setResponse(async () => {
    f.setWorkspace(other);
    return dry();
  });
  await assert.rejects(f.warehouse.prepare({ workspaceId: live.id, ...query }), /workspace changed/);
  assert.equal(f.warehouse.history({ workspaceId: other.id }).length, 0);
  f.setWorkspace(structuredClone(live));
  assert.equal(f.warehouse.history({ workspaceId: live.id })[0].outcome, 'failed');
  assert.ok(f.commands.every((command) => command.args.includes('--dry_run')));
});

test('CLI failures classify Python startup before incidental authentication library warnings', () => {
  const issue =
    classifyWarehouseFailure(`FutureWarning: You are using a Python version 3.9 past its end of life. Please upgrade Python and update google-auth.
Traceback (most recent call last):
  File "/opt/homebrew/share/google-cloud-sdk/lib/googlecloudsdk/api_lib/iamcredentials/util.py", line 23
    match base_domain:
SyntaxError: invalid syntax
private.account@example.test access_token=should-never-leave-this-test`);
  assert.equal(issue.code, 'python_runtime');
  assert.doesNotMatch(JSON.stringify(issue), /private.account|should-never|iamcredentials|3\.9/);
  assert.doesNotMatch(issue.steps.join(' '), /auth login/);
});

test('the real process runner never returns raw account or token text on CLI failure', async () => {
  await assert.rejects(
    runWarehouseCommand(process.execPath, [
      '-e',
      "process.stderr.write('Access Denied: private@example.test token=private-token'); process.exit(1)",
    ]),
    (error: unknown) => {
      assert.ok(error instanceof WarehouseCliError);
      assert.equal(error.issue.code, 'access_denied');
      assert.doesNotMatch(error.message + JSON.stringify(error.issue), /private@example|private-token/);
      return true;
    }
  );
});

test('the real process runner decodes UTF-8 characters split across output chunks', async () => {
  const text = 'é'.repeat(70000) + '日本語🙂';
  // Write the bytes in two pieces, cutting through the middle of a two-byte character.
  // The child builds the text itself; Linux caps a single argument at 128 KiB.
  const output = await runWarehouseCommand(process.execPath, [
    '-e',
    `const b = Buffer.from('é'.repeat(70000) + '日本語🙂'); process.stdout.write(b.subarray(0, 70001), () => setTimeout(() => process.stdout.write(b.subarray(70001)), 20));`,
  ]);
  assert.equal(output, text);
  assert.doesNotMatch(output, /\uFFFD/);
});

test('CLI failures provide specific actions for account, IAM, network, executable and query failures', () => {
  const cases = [
    ['You do not currently have an active account selected. Please run: gcloud auth login', 'auth_missing'],
    ['There was a problem refreshing your current auth tokens: invalid_grant: Bad Request', 'auth_expired'],
    ['invalid_rapt: reauthentication required', 'auth_expired'],
    [
      'BigQuery error in ls operation: Access Denied: Dataset p:d: User does not have bigquery.tables.list permission',
      'access_denied',
    ],
    ['google.auth.exceptions.TransportError: HTTPSConnectionPool: CERTIFICATE_VERIFY_FAILED', 'network'],
    ['BigQuery API has not been used in project before or it is disabled. SERVICE_DISABLED', 'api_disabled'],
    [
      'PermissionError: [Errno 13] Permission denied: /Users/private/.config/gcloud/logs',
      'cli_configuration',
    ],
    ['ERROR: Unknown command line flag headless', 'cli_configuration'],
    ['BigQuery error: Not found: Dataset project:ultracart_dw was not found in location US', 'not_found'],
    ['Query exceeded limit for bytes billed: 1048576. 2097152 or higher required', 'scan_limit'],
    ['Syntax error: Expected end of input but got keyword WHERE at [1:5]', 'sql'],
    ['Unrecognized name: total_wrong at [1:8]', 'sql'],
    ['env: python3: No such file or directory', 'python_runtime'],
    ['ModuleNotFoundError: No module named googlecloudsdk', 'python_runtime'],
    ['An unexpected response mentioned the authentication subsystem', 'unknown'],
  ] as const;
  for (const [output, expected] of cases)
    assert.equal(classifyWarehouseFailure(output).code, expected, output);
  assert.equal(classifyWarehouseFailure('', 'ENOENT').code, 'executable_missing');
  assert.equal(classifyWarehouseFailure('', 'EACCES').code, 'executable_permission');
  assert.equal(classifyWarehouseFailure('', 'EINVAL').code, 'launcher_unsupported');
  assert.doesNotMatch(warehouseIssue('access_denied').steps.join(' '), /auth login/);
});

test('the desktop CLI environment includes installed Python folders and preserves explicit SDK settings', () => {
  const env = warehouseProcessEnv('/opt/homebrew/bin/bq', {
    platform: 'darwin',
    env: {
      PATH: '/usr/bin:/bin',
      CLOUDSDK_CONFIG: '/custom/config',
      CLOUDSDK_BQ_PYTHON: '/custom/python3',
      CLOUDSDK_ACTIVE_CONFIG_NAME: 'work',
    },
  });
  assert.equal(env.PATH, '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin');
  assert.equal(env.CLOUDSDK_CONFIG, '/custom/config');
  assert.equal(env.CLOUDSDK_BQ_PYTHON, '/custom/python3');
  assert.equal(env.CLOUDSDK_ACTIVE_CONFIG_NAME, 'work');
  assert.equal(env.CLOUDSDK_CORE_DISABLE_PROMPTS, '1');
  assert.equal(env.CLOUDSDK_PYTHON, undefined);
  const windows = warehouseProcessEnv('C:\\Cloud SDK\\bin\\bq.cmd', {
    platform: 'win32',
    env: { Path: 'C:\\Windows;C:\\Tools', PATH: 'ignored-duplicate' },
  });
  assert.equal(windows.Path, 'C:\\Cloud SDK\\bin;C:\\Windows;C:\\Tools');
  assert.equal(windows.PATH, undefined);
});

test('Windows SDK batch launchers use Python entry points with literal SQL arguments', () => {
  const root = 'C:\\Program Files\\Google\\Cloud SDK\\google-cloud-sdk';
  const sql = "SELECT 'a & whoami > output | %USERNAME% !name!' AS text";
  const options = {
    platform: 'win32' as const,
    env: { Path: 'C:\\Windows', CLOUDSDK_CONFIG: 'C:\\user config' },
    exists: () => true,
    realpath: (path: string) => path,
  };
  const launch = warehouseLaunch(root + '\\bin\\bq.cmd', ['query', sql], options);
  assert.equal(launch.command, root + '\\platform\\bundledpython\\python.exe');
  assert.deepEqual(launch.args, [root + '\\bin\\bootstrapping\\bq.py', 'query', sql]);
  assert.equal(launch.env.CLOUDSDK_ROOT_DIR, root);
  assert.equal(launch.env.CLOUDSDK_CONFIG, 'C:\\user config');
  const gcloud = warehouseLaunch(root + '\\bin\\gcloud.cmd', ['auth', 'list'], options);
  assert.equal(gcloud.args[0], root + '\\lib\\gcloud.py');
  assert.throws(
    () => warehouseLaunch(root + '\\bin\\bq.cmd', [], { ...options, exists: () => false }),
    /SDK runtime/
  );
  assert.throws(() => warehouseLaunch(root + '\\bin\\custom.cmd', [], options), /SDK runtime/);
  assert.throws(
    () =>
      warehouseLaunch(root + '\\bin\\bq.cmd', [], {
        ...options,
        env: { CLOUDSDK_PYTHON: 'python.exe & unsafe' },
      }),
    /SDK runtime/
  );
  assert.throws(
    () =>
      warehouseLaunch(root + '\\bin\\bq.cmd', [], { ...options, env: { CLOUDSDK_PYTHON_ARGS: '-custom' } }),
    /SDK runtime/
  );
  assert.equal(warehouseLaunch('C:\\tools\\bq.exe', [sql], options).args[0], sql);
});

test('connection paths and terminal commands handle Windows paths without shell execution', () => {
  for (const path of [
    '/opt/homebrew/bin/bq',
    'C:\\Program Files\\Cloud SDK\\bin\\bq.cmd',
    '\\\\server\\share\\sdk\\bq.cmd',
  ])
    assert.equal(warehouseAbsolutePath(path), true);
  for (const path of ['bq', 'C:bq.cmd', '~/bq', '/path\nto/bq', '/path\u0000bq'])
    assert.equal(warehouseAbsolutePath(path), false);
  assert.equal(
    warehouseTerminalCommand("C:\\User's SDK\\bq.cmd", ['version'], 'win32'),
    "& 'C:\\User''s SDK\\bq.cmd' 'version'"
  );
  assert.equal(
    warehouseTerminalCommand('/path with spaces/bq', ['version'], 'darwin'),
    "'/path with spaces/bq' version"
  );
});

function diagnosticResponse(args: string[]) {
  if (args.includes('version')) return 'This is BigQuery CLI 2.1.31';
  if (args.includes('auth')) return JSON.stringify([{ status: 'ACTIVE' }]);
  if (args.includes('get-value')) return 'different-default-project';
  if (args.includes('ls'))
    return JSON.stringify([
      { tableReference: { projectId: 'ultracart-dw-demo', datasetId: 'ultracart_dw', tableId: 'uc_orders' } },
    ]);
  throw new Error('Unexpected diagnostic command');
}

test('connection diagnostics prove startup/account/metadata without SQL or a query access claim', async () => {
  const f = fixture();
  f.setResponse(async (args) => diagnosticResponse(args));
  const report = await f.warehouse.diagnose({ workspaceId: live.id });
  assert.equal(report.checks.length, 4);
  assert.ok(report.checks.every((check) => check.state === 'passed'));
  assert.match(report.checks.find((check) => check.id === 'project')!.detail, /default differs/);
  assert.match(report.checks.find((check) => check.id === 'metadata')!.detail, /No query ran/);
  assert.equal(f.warehouse.status({ workspaceId: live.id }).access, 'unchecked');
  assert.equal(f.warehouse.status({ workspaceId: live.id }).issue, null);
  assert.equal(f.warehouse.status({ workspaceId: live.id }).diagnostics?.checkedAt, report.checkedAt);
  assert.ok(f.commands.every((command) => !command.args.includes('query')));
  assert.ok(
    f.commands.find((command) => command.args.includes('ls'))!.args.includes('--project_id=ultracart-dw-demo')
  );
  assert.equal(f.verified(), 1);
});

test('connection diagnostics stop at startup failures and do not demand another sign-in', async () => {
  const f = fixture();
  f.setResponse(async () => {
    throw new WarehouseCliError(classifyWarehouseFailure('google-auth warning. SyntaxError: invalid syntax'));
  });
  const report = await f.warehouse.diagnose({ workspaceId: live.id });
  assert.equal(f.commands.length, 1);
  assert.equal(f.verified(), 0);
  assert.equal(report.checks[0].issue?.code, 'python_runtime');
  assert.equal(report.checks.filter((check) => check.state === 'skipped').length, 3);
  assert.equal(f.warehouse.status({ workspaceId: live.id }).issue?.code, 'python_runtime');
  assert.ok(report.commands.every((command) => !command.command.includes('auth login')));
});

test('a logged-in account can receive a separate metadata IAM failure without losing its account result', async () => {
  const f = fixture();
  f.setResponse(async (args) => {
    if (args.includes('ls'))
      throw new WarehouseCliError(
        classifyWarehouseFailure(
          'Access Denied: User private@example.test does not have bigquery.tables.list permission'
        )
      );
    return diagnosticResponse(args);
  });
  const report = await f.warehouse.diagnose({ workspaceId: live.id });
  assert.equal(report.checks.find((check) => check.id === 'account')?.state, 'passed');
  assert.equal(report.checks.find((check) => check.id === 'metadata')?.issue?.code, 'access_denied');
  assert.doesNotMatch(JSON.stringify(report), /private@example|auth login/);
});

test('sample diagnostics never start CLI processes and stale diagnostics cannot cross workspace or config boundaries', async () => {
  const sample = fixture(structuredClone(sampleWorkspace));
  assert.equal((await sample.warehouse.diagnose({ workspaceId: sampleWorkspace.id })).sample, true);
  assert.equal(sample.commands.length, 0);
  assert.equal(sample.verified(), 0);
  const f = fixture();
  f.setResponse(async (args) => {
    f.setWorkspace({ ...live, id: 'other', selection: { ...live.selection, merchantId: 'OTHER' } });
    return diagnosticResponse(args);
  });
  await assert.rejects(f.warehouse.diagnose({ workspaceId: live.id }), /workspace changed/);
  assert.equal(f.commands.length, 1);
  f.setWorkspace(structuredClone(live));
  assert.equal(f.warehouse.status({ workspaceId: live.id }).diagnostics, null);
  f.setResponse(async (args) => {
    f.warehouse.setBqPath({ workspaceId: live.id, bqPath: '/different/bq' });
    return diagnosticResponse(args);
  });
  await assert.rejects(f.warehouse.diagnose({ workspaceId: live.id }), /settings changed/);
  assert.equal(f.warehouse.status({ workspaceId: live.id }).diagnostics, null);
});

test('the renderer cannot choose the bq executable; only a host-picked bq launcher is saved and run', async () => {
  const f = fixture();
  const initial = f.warehouse.status({ workspaceId: live.id }).config.bqPath;
  for (const bqPath of ['/bin/sh', '/tmp/evil', '/different/bq'])
    assert.throws(
      () => f.warehouse.configure({ workspaceId: live.id, bqPath, maxBytes: WAREHOUSE_DEFAULT_BYTES }),
      /Browse/,
      bqPath
    );
  await assert.rejects(f.warehouse.diagnose({ workspaceId: live.id, bqPath: '/bin/sh' }), /Browse/);
  assert.equal(f.commands.length, 0);
  // Repeating the saved path is harmless, so ceiling changes still work.
  f.warehouse.configure({ workspaceId: live.id, bqPath: initial, maxBytes: WAREHOUSE_MIN_BYTES });
  assert.equal(f.warehouse.status({ workspaceId: live.id }).config.bqPath, initial);
  for (const bqPath of [
    '/bin/sh',
    '/usr/bin/python3',
    'relative/bq',
    '/opt/bq/evil',
    '/opt/sdk/bin/bqx',
    '/opt/sdk/bin/bq.sh',
    '/opt/sdk/bin/not-bq',
    '/opt/sdk/bin/bq\n',
  ])
    assert.throws(() => f.warehouse.setBqPath({ workspaceId: live.id, bqPath }), /BigQuery CLI executable/, bqPath);
  assert.equal(f.warehouse.status({ workspaceId: live.id }).config.bqPath, initial);
  for (const bqPath of ['/opt/sdk/bin/bq', '/opt/sdk/bin/BQ', '/opt/sdk/bin/bq.CMD', '/opt/sdk/bin/Bq.exe']) {
    const status = f.warehouse.setBqPath({ workspaceId: live.id, bqPath });
    assert.equal(status.config.bqPath, bqPath);
    assert.equal(status.config.maxBytes, WAREHOUSE_MIN_BYTES);
  }
  for (const bqPath of ['C:\\SDK\\bin\\bq.cmd', 'C:\\SDK\\bin\\BQ.EXE', '/usr/local/bin/bq'])
    assert.equal(warehouseBqPath(bqPath), true, bqPath);
  for (const bqPath of ['C:\\SDK\\bin\\bq.bat', 'bq', 'C:\\SDK\\bin\\gcloud.cmd'])
    assert.equal(warehouseBqPath(bqPath), false, bqPath);
  // A non-bq path stored by an older version falls back to the default launcher and is never run.
  f.values.set([...f.values.keys()].find((key) => key.endsWith(':config'))!, {
    bqPath: '/bin/sh',
    maxBytes: WAREHOUSE_DEFAULT_BYTES,
  });
  assert.equal(f.warehouse.status({ workspaceId: live.id }).config.bqPath, initial);
  await f.warehouse.diagnose({ workspaceId: live.id });
  assert.ok(f.commands.every((command) => command.command !== '/bin/sh'));
});
