import test from 'node:test';
import assert from 'node:assert/strict';
import {
  warehouseChartData,
  warehouseDefaultChart,
  warehouseNumericSummary,
  warehouseNumericValue,
  warehouseResultColumns,
  warehouseResultPage,
  warehouseResultsCsv,
  warehouseVisibleRows,
} from '../src/shared/warehouse-results';

test('loaded columns distinguish numeric strings, nulls, dates, identifiers, and precision-sensitive values', () => {
  const columns = warehouseResultColumns([
    {
      channel: 'Email',
      revenue: '18.25',
      orders: '10',
      order_id: '1234',
      exact: '9007199254740993',
      day: '2026-01-02',
      absent: null,
      flags: { vip: true },
    },
    {
      channel: 'Organic',
      revenue: '0.75',
      orders: null,
      order_id: '1235',
      exact: '9007199254740994',
      day: '2026-01-03',
      absent: null,
      flags: { vip: false },
    },
  ]);
  assert.equal(columns.find((column) => column.key === 'revenue')?.kind, 'number');
  assert.equal(columns.find((column) => column.key === 'orders')?.missing, 1);
  assert.equal(columns.find((column) => column.key === 'order_id')?.measure, false);
  assert.equal(columns.find((column) => column.key === 'exact')?.kind, 'text');
  assert.equal(columns.find((column) => column.key === 'day')?.kind, 'date');
  assert.equal(columns.find((column) => column.key === 'absent')?.kind, 'empty');
  assert.equal(columns.find((column) => column.key === 'flags')?.kind, 'json');
  for (const value of [
    true,
    '',
    '0012',
    '0x10',
    'Infinity',
    '1.234567890123456789',
    '9007199254740990.1',
    9007199254740992,
  ])
    assert.equal(warehouseNumericValue(value), null, String(value));
  assert.equal(warehouseNumericValue('9007199254740991'), Number.MAX_SAFE_INTEGER);
  assert.equal(warehouseNumericValue('-2.5e2'), -250);
  assert.equal(warehouseResultColumns([{ day: '2026-02-30' }])[0].kind, 'text');
  assert.equal(warehouseResultColumns([{ day: '2026-01-01T24:00:00Z' }])[0].kind, 'text');
});

test('local filtering and stable typed sorting do not mutate loaded rows and keep nulls last', () => {
  const rows = [
    { channel: 'Email', revenue: '10', detail: { region: 'West' } },
    { channel: 'Organic', revenue: '2', detail: { region: 'West' } },
    { channel: 'Email', revenue: null, detail: { region: 'East' } },
    { channel: 'Paid', revenue: '10', detail: { region: 'West' } },
  ];
  const original = JSON.stringify(rows);
  assert.deepEqual(
    warehouseVisibleRows(rows, { sort: { column: 'revenue', direction: 'asc' } }).map((row) => row.revenue),
    ['2', '10', '10', null]
  );
  assert.deepEqual(
    warehouseVisibleRows(rows, { sort: { column: 'revenue', direction: 'desc' } }).map((row) => row.channel),
    ['Email', 'Paid', 'Organic', 'Email']
  );
  assert.equal(warehouseVisibleRows(rows, { search: 'WEST' }).length, 3);
  assert.equal(warehouseVisibleRows(rows, { search: 'west', column: 'channel' }).length, 0);
  assert.equal(warehouseVisibleRows(rows, { search: 'Email', column: 'channel' }).length, 2);
  assert.equal(JSON.stringify(rows), original);
});

test('numeric summaries are calculated only from supplied rows and never invent values for nulls', () => {
  const rows = [{ amount: '0.25' }, { amount: '1.75' }, { amount: null }];
  assert.deepEqual(warehouseNumericSummary(rows, 'amount'), {
    count: 2,
    missing: 1,
    sum: 2,
    mean: 1,
    min: 0.25,
    max: 1.75,
  });
  assert.deepEqual(warehouseNumericSummary(rows.slice(1), 'amount'), {
    count: 1,
    missing: 1,
    sum: 1.75,
    mean: 1.75,
    min: 1.75,
    max: 1.75,
  });
  assert.equal(warehouseNumericSummary([{ amount: null }], 'amount'), null);
  assert.equal(
    warehouseNumericSummary([{ amount: Number.MAX_SAFE_INTEGER }, { amount: 1 }], 'amount')?.sum,
    null
  );
});

test('charts use actual pairs, reject implicit grouping, and preserve missing-value gaps', () => {
  const rows = [
    { channel: 'Email', revenue: '10' },
    { channel: 'Organic', revenue: '2' },
    { channel: null, revenue: '3' },
  ];
  const columns = warehouseResultColumns(rows);
  const config = warehouseDefaultChart(columns);
  assert.deepEqual(config, { kind: 'bar', x: 'channel', y: 'revenue' });
  const data = warehouseChartData(rows, columns, config);
  assert.deepEqual(
    data.points.map((point) => point.value),
    [10, 2]
  );
  assert.equal(data.omitted, 1);
  assert.equal(data.error, null);
  assert.match(
    warehouseChartData(rows, columns, { ...config, kind: 'line' }).error!,
    /dates or an ordered numeric/
  );
  const duplicate = [...rows, { channel: 'Email', revenue: '7' }];
  assert.match(
    warehouseChartData(duplicate, warehouseResultColumns(duplicate), config).error!,
    /labels repeat/
  );
  assert.match(warehouseChartData(rows.slice(0, 1), columns, config).error!, /At least two/);
  const dates = [
    { day: '2026-01-03', count: '3' },
    { day: '2026-01-01', count: '1' },
  ];
  const datedColumns = warehouseResultColumns(dates);
  const line = warehouseDefaultChart(datedColumns);
  assert.equal(line.kind, 'line');
  assert.deepEqual(
    warehouseChartData(dates, datedColumns, line).points.map((point) => point.label),
    ['2026-01-01', '2026-01-03']
  );
  const gap = [...dates, { day: '2026-01-02', count: null }];
  assert.match(warehouseChartData(gap, warehouseResultColumns(gap), line).error!, /missing values/);
  const many = Array.from({ length: 30 }, (_, index) => ({ label: `Item ${index}`, amount: index }));
  const capped = warehouseChartData(many, warehouseResultColumns(many), {
    kind: 'bar',
    x: 'label',
    y: 'amount',
  });
  assert.equal(capped.points.length, 24);
  assert.equal(capped.truncated, 6);
});

test('CSV protects spreadsheet formulas in headers and text while preserving bq numbers, quotes, and newlines', () => {
  // bq returns every value, including numbers, as a JSON string.
  const csv = warehouseResultsCsv([
    {
      '=header': '=HYPERLINK("https://example.invalid")',
      text: 'first,"quoted"\nsecond',
      number: '-2.5',
      optional: null,
    },
    { '=header': '\t +cmd', text: '@SUM(A1:A2)', number: '0', optional: { flag: true } },
    { '=header': '  \r\n=cmd', text: '＝SUM(A1:A2)', number: '-1.5E-7', optional: '' },
  ]);
  assert.equal(
    csv,
    '"\'=header","text","number","optional"\r\n' +
      '"\'=HYPERLINK(""https://example.invalid"")","first,""quoted""\nsecond","-2.5",""\r\n' +
      '"\'\t +cmd","\'@SUM(A1:A2)","0","{""flag"":true}"\r\n' +
      '"\'  \r\n=cmd","\'＝SUM(A1:A2)","-1.5E-7",""'
  );
  assert.equal(warehouseResultsCsv([], ['label', 'value']), '"label","value"');
  assert.equal(
    warehouseResultsCsv([{ a: '-10', b: '-12.5', c: '-.5', d: '12', e: 'safe' }]),
    '"a","b","c","d","e"\r\n"-10","-12.5","-.5","12","safe"'
  );
  // Anything that is not a plain number keeps the formula guard.
  assert.equal(
    warehouseResultsCsv([{ a: '+10', b: '-10+1', c: '-1,5', d: ' -10', e: '-A1', f: '-', g: '-1e' }]),
    '"a","b","c","d","e","f","g"\r\n"\'+10","\'-10+1","\'-1,5","\' -10","\'-A1","\'-","\'-1e"'
  );
});

test('page links require exact membership in the selected storefront and reject hostile or ambiguous URLs', () => {
  const pages = new Set(['/', '/shop/', '/shop/item/']);
  assert.equal(warehouseResultPage('/shop/', 'store.example', pages), '/shop/');
  assert.equal(
    warehouseResultPage('https://store.example/shop/?utm_source=test#details', 'store.example', pages),
    '/shop/'
  );
  assert.equal(warehouseResultPage('/shop/?utm_source=test', 'store.example', pages), '/shop/');
  for (const value of [
    'https://other.example/shop/',
    'https://store.example.evil.test/shop/',
    'https://user:pass@store.example/shop/',
    'https://store.example:8443/shop/',
    '//store.example/shop/',
    '/missing/',
    '/shop',
    '/shop/../shop/',
    '/%2e%2e/shop/',
    '/shop/%252e%252e/',
    '/shop/\\item/',
    'javascript:alert(1)',
    '\n/shop/',
  ])
    assert.equal(warehouseResultPage(value, 'store.example', pages), null, value);
  assert.equal(warehouseResultPage('/shop/', 'store.example', new Set(['/'])), null);
});
