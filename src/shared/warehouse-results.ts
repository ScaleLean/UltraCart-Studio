import { assertPagePath } from './storefront';

export type WarehouseResultRow = Record<string, unknown>;
export type WarehouseColumnKind = 'number' | 'date' | 'text' | 'boolean' | 'json' | 'mixed' | 'empty';
export type WarehouseResultColumn = {
  key: string;
  kind: WarehouseColumnKind;
  missing: number;
  distinct: number;
  measure: boolean;
};
export type WarehouseResultSort = { column: string; direction: 'asc' | 'desc' };
export type WarehouseChartConfig = { kind: 'bar' | 'line'; x: string; y: string };
export type WarehouseChartPoint = { label: string; value: number; x: number; rowIndex: number };
export type WarehouseChartData = {
  points: WarehouseChartPoint[];
  omitted: number;
  truncated: number;
  error: string | null;
};

const identifier = /(?:^|_)(?:id|oid|uuid|zip|postal|phone)(?:_|$)|(?:Id|Oid|ID)$/;
const missing = (value: unknown) => value === null || value === undefined;

export function warehouseCellText(value: unknown): string {
  if (value === undefined) return '';
  if (value === null) return 'null';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[Unsupported value]';
    }
  }
  return String(value);
}

/** BigQuery can return numbers as strings. Do not round large IDs or high-precision decimals. */
export function warehouseNumericValue(value: unknown): number | null {
  if (typeof value === 'string') {
    if (!/^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value)) return null;
    const coefficient = value.split(/e/i)[0];
    const significant = coefficient
      .replace(/^[+-]?0*/, '')
      .replace('.', '')
      .replace(/^0+/, '');
    const numeric = Number(value);
    if (significant.length > 15 && !(/^[+-]?\d+$/.test(value) && Number.isSafeInteger(numeric))) return null;
    value = numeric;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (Number.isInteger(value) && !Number.isSafeInteger(value)) return null;
  return value;
}

function dateValue(value: unknown): number | null {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}(?:[T ](?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/.test(
      value
    )
  )
    return null;
  const day = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value.slice(0, 10)) return null;
  const parsed = Date.parse(value.replace(' ', 'T'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function warehouseResultColumns(rows: readonly WarehouseResultRow[]): WarehouseResultColumn[] {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return keys.map((key) => {
    const values = rows.map((row) => row[key]).filter((value) => !missing(value));
    let kind: WarehouseColumnKind = 'mixed';
    if (!values.length) kind = 'empty';
    else if (values.every((value) => warehouseNumericValue(value) !== null)) kind = 'number';
    else if (values.every((value) => dateValue(value) !== null)) kind = 'date';
    else if (values.every((value) => typeof value === 'string')) kind = 'text';
    else if (values.every((value) => typeof value === 'boolean')) kind = 'boolean';
    else if (values.every((value) => typeof value === 'object')) kind = 'json';
    return {
      key,
      kind,
      missing: rows.length - values.length,
      distinct: new Set(values.map((value) => `${typeof value}:${warehouseCellText(value)}`)).size,
      measure: kind === 'number' && !identifier.test(key),
    };
  });
}

export function warehouseVisibleRows(
  rows: readonly WarehouseResultRow[],
  options: { search?: string; column?: string; sort?: WarehouseResultSort | null } = {}
): WarehouseResultRow[] {
  const search = (options.search || '').toLocaleLowerCase();
  const filtered = rows.filter(
    (row) =>
      !search ||
      (options.column ? [row[options.column]] : Object.values(row)).some((value) =>
        warehouseCellText(value).toLocaleLowerCase().includes(search)
      )
  );
  const sort = options.sort;
  if (!sort) return filtered;
  const kind = warehouseResultColumns(rows).find((column) => column.key === sort.column)?.kind;
  return filtered
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const left = a.row[sort.column],
        right = b.row[sort.column];
      if (missing(left) || missing(right)) {
        if (missing(left) && missing(right)) return a.index - b.index;
        return missing(left) ? 1 : -1;
      }
      const difference =
        kind === 'number'
          ? warehouseNumericValue(left)! - warehouseNumericValue(right)!
          : kind === 'date'
            ? dateValue(left)! - dateValue(right)!
            : warehouseCellText(left).localeCompare(warehouseCellText(right), undefined, {
                numeric: true,
                sensitivity: 'base',
              });
      return (sort.direction === 'asc' ? difference : -difference) || a.index - b.index;
    })
    .map(({ row }) => row);
}

export function warehouseNumericSummary(rows: readonly WarehouseResultRow[], column: string) {
  const values = rows
    .map((row) => warehouseNumericValue(row[column]))
    .filter((value): value is number => value !== null);
  if (!values.length) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return {
    count: values.length,
    missing: rows.length - values.length,
    sum: Number.isFinite(sum) && (!Number.isInteger(sum) || Number.isSafeInteger(sum)) ? sum : null,
    mean: values.reduce((total, value) => total + value / values.length, 0),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export function warehouseDefaultChart(columns: readonly WarehouseResultColumn[]): WarehouseChartConfig {
  const measures = columns.filter((column) => column.measure);
  const y =
    measures.find((column) => /(?:revenue|sessions|orders|units|count|amount|total)/i.test(column.key)) ||
    measures[0];
  const candidates = columns.filter(
    (column) => column.key !== y?.key && ['text', 'date', 'boolean', 'number'].includes(column.kind)
  );
  const x =
    candidates.find((column) => column.kind === 'date') ||
    candidates.find((column) => /^(?:path|channel|product|name|category)$/i.test(column.key)) ||
    candidates.find((column) => column.kind === 'text') ||
    candidates[0];
  return { kind: x?.kind === 'date' ? 'line' : 'bar', x: x?.key || '', y: y?.key || '' };
}

export function warehouseChartData(
  rows: readonly WarehouseResultRow[],
  columns: readonly WarehouseResultColumn[],
  config: WarehouseChartConfig
): WarehouseChartData {
  const fail = (error: string): WarehouseChartData => ({ points: [], omitted: 0, truncated: 0, error });
  const x = columns.find((column) => column.key === config.x);
  const y = columns.find((column) => column.key === config.y);
  if (!x || !y || !y.measure || x.key === y.key || !['text', 'date', 'boolean', 'number'].includes(x.kind))
    return fail('Choose a label column and a separate numeric measure to chart these rows.');
  if (config.kind === 'line' && (identifier.test(x.key) || !['date', 'number'].includes(x.kind)))
    return fail('Line charts need dates or an ordered numeric column on the horizontal axis.');
  const points: WarehouseChartPoint[] = [];
  rows.forEach((row, rowIndex) => {
    const value = warehouseNumericValue(row[y.key]);
    const label = warehouseCellText(row[x.key]);
    if (value === null || missing(row[x.key]) || !label.trim()) return;
    const axis =
      x.kind === 'date'
        ? dateValue(row[x.key])
        : x.kind === 'number'
          ? warehouseNumericValue(row[x.key])
          : rowIndex;
    if (axis !== null) points.push({ label, value, x: axis, rowIndex });
  });
  const omitted = rows.length - points.length;
  if (points.length < 2)
    return fail('At least two rows with a label and numeric value are needed for a comparison.');
  const unique = new Set(
    points.map((point) => (x.kind === 'date' || x.kind === 'number' ? point.x : point.label))
  );
  if (unique.size !== points.length)
    return fail(
      'These labels repeat. Choose a unique label column or group the rows in SQL; Studio does not combine them.'
    );
  if (config.kind === 'line' && omitted)
    return fail(
      'Some rows have missing values. Use a bar chart to compare available values without connecting across gaps.'
    );
  if (config.kind === 'line') points.sort((a, b) => a.x - b.x);
  const maximum = config.kind === 'bar' ? 24 : 100;
  return {
    points: points.slice(0, maximum),
    omitted,
    truncated: Math.max(0, points.length - maximum),
    error: null,
  };
}

/** bq returns every number as a string. A plain decimal number cannot start a formula, so it is left as is. */
const plainNumber = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function csvCell(value: unknown): string {
  let text = missing(value) ? '' : warehouseCellText(value);
  if (
    typeof value === 'string' &&
    !plainNumber.test(text) &&
    (/^[\s\u0000-\u001f\u007f-\u009f]*[=+\-@＝＋－＠]/u.test(text) || /^[\t\r\n]/.test(text))
  ) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

/** Export only the supplied rows, keeping their order. Headers are untrusted spreadsheet cells too. */
export function warehouseResultsCsv(
  rows: readonly WarehouseResultRow[],
  columns?: readonly string[]
): string {
  const keys = columns || [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [
    keys.map(csvCell).join(','),
    ...rows.map((row) => keys.map((key) => csvCell(row[key])).join(',')),
  ].join('\r\n');
}

export function warehouseResultPage(
  value: unknown,
  host: string,
  knownPaths: ReadonlySet<string>
): string | null {
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    value.length > 4096 ||
    /[\\\u0000-\u001f\u007f]/.test(value)
  )
    return null;
  let path: string;
  if (value.startsWith('/') && !value.startsWith('//')) {
    path = value.split(/[?#]/, 1)[0];
  } else {
    const parts = /^https?:\/\/([^/?#]+)([^?#]*)(?:[?#].*)?$/i.exec(value);
    if (!parts) return null;
    try {
      const url = new URL(value),
        expected = new URL(`https://${host}`);
      if (url.username || url.password || url.host.toLowerCase() !== expected.host.toLowerCase()) return null;
    } catch {
      return null;
    }
    path = parts[2] || '/';
  }
  try {
    assertPagePath(path);
    if (decodeURIComponent(path).includes('%')) return null;
  } catch {
    return null;
  }
  return knownPaths.has(path) ? path : null;
}
