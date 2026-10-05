import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  AlertCircle,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  Code2,
  Copy,
  Database,
  FileClock,
  FlaskConical,
  HardDrive,
  LoaderCircle,
  LineChart,
  Play,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Table2,
  Trash2,
  X,
} from 'lucide-react';
import type { Bootstrap } from '../../shared/types';
import {
  warehouseBytes,
  warehouseAbsolutePath,
  WAREHOUSE_DEFAULT_BYTES,
  warehouseDemoQueries,
  type WarehouseHistory,
  type WarehouseDiagnostics,
  type WarehouseIssue,
  type WarehousePrepared,
  type WarehouseReceipt,
  type WarehouseSavedQuery,
  type WarehouseSchema,
  type WarehouseStatus,
  type WarehouseTable,
} from '../../shared/warehouse';
import {
  warehouseCellText,
  warehouseChartData,
  warehouseDefaultChart,
  warehouseNumericSummary,
  warehouseNumericValue,
  warehouseResultColumns,
  warehouseResultPage,
  warehouseResultsCsv,
  warehouseVisibleRows,
  type WarehouseChartConfig,
  type WarehouseChartData,
  type WarehouseResultColumn,
  type WarehouseResultSort,
} from '../../shared/warehouse-results';
import { errorText, invoke, subscribe } from '../api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { relativeTime } from './common';
import './warehouse.css';

const blankQuery = 'SELECT\n  *\nFROM ultracart_dw.uc_storefront_pages\nLIMIT 25';
const ceilings = [10 * 1024 ** 2, 100 * 1024 ** 2, 1024 ** 3, 5 * 1024 ** 3, 20 * 1024 ** 3];
const resultNumber = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 8 });
const axisNumber = new Intl.NumberFormat(undefined, { notation: 'compact', maximumSignificantDigits: 3 });

function WarehouseIssueHelp({ issue }: { issue: WarehouseIssue }) {
  const [linkError, setLinkError] = useState('');
  return (
    <div className="wh-diagnostic-help">
      <strong>{issue.title}</strong>
      <p>{issue.detail}</p>
      <ol>
        {issue.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <button
        onClick={() => {
          setLinkError('');
          void invoke('window.openWarehouseHelp', { url: issue.docs.url }).catch(() =>
            setLinkError(issue.docs.url)
          );
        }}
      >
        {issue.docs.label} <ArrowUpRight size={12} />
      </button>
      {linkError && <small>{linkError}</small>}
    </div>
  );
}

function WarehouseDiagnosticReport({ report }: { report: WarehouseDiagnostics }) {
  const [copied, setCopied] = useState('');
  const [copyError, setCopyError] = useState(false);
  const issues = [
    ...new Map(
      report.checks.filter((check) => check.issue).map((check) => [check.issue!.code, check.issue!])
    ).values(),
  ];
  return (
    <section className="wh-diagnostics" aria-label="Warehouse connection check results" aria-live="polite">
      <div className="wh-diagnostics-heading">
        <strong>Connection checks</strong>
        <span>{relativeTime(report.checkedAt)}</span>
      </div>
      <div className="wh-diagnostic-checks">
        {report.checks.map((check) => (
          <div className={`wh-diagnostic-check ${check.state}`} key={check.id}>
            {check.state === 'passed' ? (
              <Check size={14} />
            ) : check.state === 'skipped' ? (
              <span className="wh-check-dot" />
            ) : (
              <AlertCircle size={14} />
            )}
            <div>
              <strong>
                {check.label}
                <small>{check.state}</small>
              </strong>
              <p>{check.detail}</p>
            </div>
          </div>
        ))}
      </div>
      {issues.map((issue) => (
        <WarehouseIssueHelp key={issue.code} issue={issue} />
      ))}
      {!!report.commands.length && (
        <details className="wh-diagnostic-commands">
          <summary>Terminal checks and fix commands</summary>
          <p>
            Run these commands in your own terminal to inspect the same installation. They are not run by
            copying them.
          </p>
          {report.commands.map(({ label, command }) => (
            <div key={label}>
              <span>{label}</span>
              <div>
                <code>{command}</code>
                <button
                  title="Copy command"
                  aria-label={`Copy: ${label}`}
                  onClick={() => {
                    setCopyError(false);
                    void navigator.clipboard
                      .writeText(command)
                      .then(() => setCopied(label))
                      .catch(() => setCopyError(true));
                  }}
                >
                  {copied === label ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            </div>
          ))}
          {copyError && (
            <p role="status">Select and copy the command text. Clipboard access is unavailable.</p>
          )}
        </details>
      )}
    </section>
  );
}

function WarehouseResults({
  result,
  boot,
  previousQuery,
  rowLimit,
  onOpenPage,
}: {
  result: WarehouseReceipt;
  boot: Bootstrap;
  previousQuery: boolean;
  rowLimit: number | null;
  onOpenPage?: (path: string) => void;
}) {
  const columns = useMemo(() => warehouseResultColumns(result.rows), [result.rows]);
  const displayedColumns = columns.slice(0, 100);
  const measures = displayedColumns.filter((column) => column.measure);
  const knownPages = useMemo(() => new Set(boot.pages.map((page) => page.path)), [boot.pages]);
  const [search, setSearch] = useState('');
  const [searchColumn, setSearchColumn] = useState('');
  const [sort, setSort] = useState<WarehouseResultSort | null>(null);
  const [view, setView] = useState<'table' | 'chart'>('table');
  const [chart, setChart] = useState<WarehouseChartConfig>(() => warehouseDefaultChart(displayedColumns));
  const rows = useMemo(
    () => warehouseVisibleRows(result.rows, { search, column: searchColumn, sort }),
    [result.rows, search, searchColumn, sort]
  );
  const summary = useMemo(() => warehouseNumericSummary(rows, chart.y), [rows, chart.y]);
  const plot = useMemo(() => warehouseChartData(rows, columns, chart), [rows, columns, chart]);
  const sumUseful = !/(?:rate|ratio|percent|average|avg|mean|median|score)/i.test(chart.y);
  const limitReached = rowLimit !== null && result.rows.length >= rowLimit;
  const cycleSort = (column: string) =>
    setSort((current) =>
      current?.column === column
        ? current.direction === 'asc'
          ? { column, direction: 'desc' }
          : null
        : { column, direction: 'asc' }
    );
  const selectMeasure = (value: string) =>
    setChart((current) => ({
      ...current,
      y: value,
      x:
        current.x === value
          ? displayedColumns.find(
              (column) => column.key !== value && ['text', 'date', 'number', 'boolean'].includes(column.kind)
            )?.key || ''
          : current.x,
    }));
  const download = (format: 'csv' | 'json') => {
    const text =
      format === 'csv'
        ? '\ufeff' +
          warehouseResultsCsv(
            rows,
            columns.map((column) => column.key)
          )
        : JSON.stringify(
            {
              source: result.sample ? 'synthetic-demo' : result.project,
              fetchedAt: result.at,
              loadedRowCount: result.rows.length,
              queryRowLimit: rowLimit,
              exportedRowCount: rows.length,
              filter: search ? { text: search, column: searchColumn || null } : null,
              sort,
              rows,
            },
            null,
            2
          );
    const url = URL.createObjectURL(
      new Blob([text], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${result.sample ? 'warehouse-demo' : 'warehouse'}-results${search ? '-filtered' : ''}.${format}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const xColumns = displayedColumns.filter(
    (column) => column.key !== chart.y && ['text', 'date', 'number', 'boolean'].includes(column.kind)
  );
  const summaryValue = (value: number | null | undefined) =>
    value === null || value === undefined ? '—' : resultNumber.format(value);
  return (
    <div className="wh-results-analysis">
      <div className="wh-result-context">
        <span>{result.sample ? 'SYNTHETIC DEMO RESULTS' : 'BOUNDED QUERY RESULTS'}</span>
        <span>
          {previousQuery ? 'Previous query · ' : ''}
          {relativeTime(result.at)} · {warehouseBytes(result.estimatedBytes)} estimated scan
        </span>
      </div>
      <div className="wh-result-overview">
        <div className="wh-result-count" aria-live="polite">
          <strong>{rows.length}</strong>
          <span>
            rows shown
            <small>
              of {result.rows.length} loaded{rowLimit !== null ? ` · query cap ${rowLimit}` : ''}
            </small>
          </span>
        </div>
        <div className="wh-result-view" role="group" aria-label="Result view">
          <button aria-pressed={view === 'table'} onClick={() => setView('table')}>
            <Table2 size={13} /> Table
          </button>
          <button aria-pressed={view === 'chart'} onClick={() => setView('chart')}>
            <BarChart3 size={13} /> Chart
          </button>
        </div>
        <div className="wh-result-exports" role="group" aria-label="Export rows shown">
          <button
            onClick={() => download('csv')}
            disabled={!columns.length}
            title="Export rows shown as CSV. Formula-like text is escaped for spreadsheets."
          >
            <ArrowDownToLine size={12} /> CSV
          </button>
          <button onClick={() => download('json')} title="Export rows shown as JSON, preserving value types.">
            <ArrowDownToLine size={12} /> JSON
          </button>
        </div>
      </div>
      <div className="wh-result-tools">
        <div className="wh-result-search">
          <Search size={13} />
          <input
            aria-label="Filter loaded result rows"
            placeholder="Filter loaded rows…"
            value={search}
            maxLength={500}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button aria-label="Clear result filter" onClick={() => setSearch('')}>
              <X size={12} />
            </button>
          )}
        </div>
        <label className="wh-result-select">
          <span>In</span>
          <select
            aria-label="Result filter column"
            value={searchColumn}
            onChange={(event) => setSearchColumn(event.target.value)}
          >
            <option value="">All columns</option>
            {displayedColumns.map((column) => (
              <option key={column.key} value={column.key}>
                {column.key}
              </option>
            ))}
          </select>
        </label>
        {sort && (
          <button className="wh-clear-sort" onClick={() => setSort(null)} title="Restore query result order">
            <ArrowUpDown size={12} /> {sort.column} {sort.direction === 'asc' ? '↑' : '↓'} <X size={11} />
          </button>
        )}
      </div>
      {!!measures.length && (
        <div className="wh-result-summary">
          <div className="wh-summary-heading">
            <span>SUMMARY OF ROWS SHOWN</span>
            <label className="wh-result-select">
              <span>Measure</span>
              <select
                aria-label="Summary measure"
                value={chart.y}
                onChange={(event) => selectMeasure(event.target.value)}
              >
                {measures.map((column) => (
                  <option key={column.key} value={column.key}>
                    {column.key}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <dl className="wh-summary-values">
            <div>
              <dt>{sumUseful ? 'Sum' : 'Numeric values'}</dt>
              <dd
                title={sumUseful && summary?.sum === null ? 'Sum exceeds safe numeric precision' : undefined}
              >
                {summaryValue(sumUseful ? summary?.sum : summary?.count)}
              </dd>
            </div>
            <div>
              <dt>Average</dt>
              <dd>{summaryValue(summary?.mean)}</dd>
            </div>
            <div>
              <dt>Minimum</dt>
              <dd>{summaryValue(summary?.min)}</dd>
            </div>
            <div>
              <dt>Maximum</dt>
              <dd>{summaryValue(summary?.max)}</dd>
            </div>
          </dl>
          <p>
            {summary?.count || 0} numeric values{summary?.missing ? ` · ${summary.missing} missing` : ''}.
            Types inferred from loaded rows. No warehouse totals.
          </p>
        </div>
      )}
      {view === 'chart' ? (
        <div className="wh-chart-panel">
          <div className="wh-chart-controls">
            <label className="wh-result-select">
              <span>{chart.kind === 'line' ? 'Horizontal axis' : 'Label'}</span>
              <select
                aria-label="Chart label column"
                value={chart.x}
                onChange={(event) => setChart({ ...chart, x: event.target.value })}
              >
                {!xColumns.length && <option value="">No label column</option>}
                {xColumns.map((column) => (
                  <option key={column.key} value={column.key}>
                    {column.key}
                  </option>
                ))}
              </select>
            </label>
            <label className="wh-result-select">
              <span>Chart</span>
              <select
                aria-label="Chart type"
                value={chart.kind}
                onChange={(event) => setChart({ ...chart, kind: event.target.value as 'bar' | 'line' })}
              >
                <option value="bar">Bar comparison</option>
                <option value="line">Line trend</option>
              </select>
            </label>
            <span className="wh-local-chip">
              <HardDrive size={10} /> Local analysis
            </span>
          </div>
          {plot.error ? (
            <div className="wh-chart-empty">
              <BarChart3 size={24} />
              <strong>Choose a meaningful comparison.</strong>
              <p>{plot.error}</p>
            </div>
          ) : (
            <WarehousePlot data={plot} config={chart} columns={columns} />
          )}
        </div>
      ) : (
        <div
          className="wh-result-scroll wh-analysis-scroll"
          tabIndex={0}
          aria-label="Scrollable result table"
        >
          {rows.length ? (
            <table className="wh-analysis-table">
              <caption className="wh-sr-only">
                {rows.length} rows shown from {result.rows.length} loaded rows. Select a column heading to
                sort locally.
              </caption>
              <thead>
                <tr>
                  <th className="wh-row-number" scope="col">
                    #
                  </th>
                  {displayedColumns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={
                        sort?.column === column.key
                          ? sort.direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                    >
                      <button
                        onClick={() => cycleSort(column.key)}
                        aria-label={`Sort by ${column.key}${sort?.column === column.key ? (sort.direction === 'asc' ? ', currently ascending' : ', currently descending') : ''}`}
                      >
                        <span>
                          {column.key}
                          <small>{column.kind}</small>
                        </span>
                        {sort?.column === column.key ? (
                          sort.direction === 'asc' ? (
                            <ArrowUp size={12} />
                          ) : (
                            <ArrowDown size={12} />
                          )
                        ) : (
                          <ArrowUpDown size={11} />
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td className="wh-row-number">{index + 1}</td>
                    {displayedColumns.map((column) => {
                      const value = row[column.key];
                      const text = warehouseCellText(value);
                      const path = onOpenPage
                        ? warehouseResultPage(value, boot.workspace.selection.storefront.host, knownPages)
                        : null;
                      return (
                        <td
                          key={column.key}
                          className={
                            value === null || value === undefined
                              ? 'null'
                              : warehouseNumericValue(value) !== null
                                ? 'numeric'
                                : ''
                          }
                          title={text}
                        >
                          {path ? (
                            <button
                              className="wh-page-result"
                              onClick={() => onOpenPage?.(path)}
                              aria-label={`Open ${path} in Studio`}
                            >
                              <span>{text.slice(0, 400)}</span>
                              <ArrowUpRight size={12} />
                            </button>
                          ) : (
                            text.slice(0, 400)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="wh-empty-output wh-filter-empty">
              <Search size={25} />
              <h3>{result.rows.length ? 'No loaded rows match.' : 'The query returned no rows.'}</h3>
              <p>
                {result.rows.length
                  ? 'Change this local filter to see more of the rows already loaded.'
                  : 'Review the query filters and date window before drawing a conclusion.'}
              </p>
              {search && (
                <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                  Clear local filter
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      <div className={`wh-result-limits ${limitReached ? 'at-limit' : ''}`}>
        <span>
          {limitReached
            ? 'Row cap reached. More matching rows may exist.'
            : 'Analysis uses loaded rows only; more matching rows may exist.'}
        </span>
        <span>
          Exports include {rows.length} shown rows in this order. CSV escapes formulas; JSON preserves types.
        </span>
        {columns.length > 100 && (
          <span>First 100 of {columns.length} columns displayed. Exports include every returned column.</span>
        )}
      </div>
    </div>
  );
}

function WarehousePlot({
  data,
  config,
  columns,
}: {
  data: WarehouseChartData;
  config: WarehouseChartConfig;
  columns: WarehouseResultColumn[];
}) {
  const id = useId();
  const { points } = data;
  const width = 760;
  const left = config.kind === 'bar' ? 175 : 68;
  const right = config.kind === 'bar' ? 74 : 28;
  const top = 25;
  const height = config.kind === 'bar' ? Math.max(170, points.length * 32 + 58) : 280;
  const bottom = height - 36;
  const min = Math.min(0, ...points.map((point) => point.value));
  const max = Math.max(0, ...points.map((point) => point.value));
  const span = max - min || 1;
  const axis = (value: number) => left + ((value - min) / span) * (width - left - right);
  const yAxis = (value: number) => bottom - ((value - min) / span) * (bottom - top);
  const firstX = points[0].x,
    lastX = points[points.length - 1].x;
  const xAxis = (value: number) => left + ((value - firstX) / (lastX - firstX || 1)) * (width - left - right);
  const ticks = Array.from({ length: 5 }, (_, index) => min + (span * index) / 4);
  const dateAxis = columns.find((column) => column.key === config.x)?.kind === 'date';
  const intraday =
    dateAxis && new Date(firstX).toISOString().slice(0, 10) === new Date(lastX).toISOString().slice(0, 10);
  const xLabel = (index: number) =>
    dateAxis
      ? new Date(points[index].x).toISOString().slice(intraday ? 11 : 0, intraday ? 19 : 10)
      : axisNumber.format(points[index].x);
  const line = points
    .map((point, index) => `${index ? 'L' : 'M'}${xAxis(point.x)},${yAxis(point.value)}`)
    .join(' ');
  const xTicks = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])].filter(
    (index) =>
      index === 0 ||
      index === points.length - 1 ||
      (xAxis(points[index].x) - left > 100 && width - right - xAxis(points[index].x) > 100)
  );
  return (
    <figure className="wh-chart-figure" aria-labelledby={`${id}-title`}>
      <div className="wh-chart-title">
        <span>
          {config.kind === 'line' ? <LineChart size={14} /> : <BarChart3 size={14} />}
          <strong id={`${id}-title`}>
            {config.y} by {config.x}
          </strong>
        </span>
        <small>{points.length} loaded rows plotted</small>
      </div>
      <div className="wh-chart-canvas" tabIndex={0} aria-label="Scrollable chart">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-labelledby={`${id}-title ${id}-description`}
        >
          <desc id={`${id}-description`}>
            {config.kind === 'bar' ? 'Bar comparison' : 'Line trend'} of loaded rows only.{' '}
            {points.map((point) => `${point.label}: ${resultNumber.format(point.value)}`).join('; ')}.
          </desc>
          {config.kind === 'bar' ? (
            <>
              {ticks.map((value, index) => (
                <g key={index} className="wh-chart-grid">
                  <line x1={axis(value)} x2={axis(value)} y1={top - 10} y2={bottom} />
                  <text x={axis(value)} y={height - 10} textAnchor="middle">
                    {axisNumber.format(value)}
                  </text>
                </g>
              ))}
              <line className="wh-chart-zero" x1={axis(0)} x2={axis(0)} y1={top - 10} y2={bottom} />
              {points.map((point, index) => (
                <g key={`${point.label}:${index}`}>
                  <text className="wh-chart-label" x={left - 12} y={top + index * 32 + 13} textAnchor="end">
                    <title>{point.label}</title>
                    {point.label.length > 23 ? point.label.slice(0, 21) + '…' : point.label}
                  </text>
                  <rect
                    className="wh-chart-bar"
                    x={Math.min(axis(0), axis(point.value))}
                    y={top + index * 32}
                    width={Math.max(point.value === 0 ? 0 : 1, Math.abs(axis(point.value) - axis(0)))}
                    height={20}
                    rx={3}
                  >
                    <title>
                      {point.label}: {resultNumber.format(point.value)}
                    </title>
                  </rect>
                  <text className="wh-chart-value" x={width - right + 12} y={top + index * 32 + 13}>
                    {axisNumber.format(point.value)}
                  </text>
                </g>
              ))}
            </>
          ) : (
            <>
              {ticks.map((value, index) => (
                <g key={index} className="wh-chart-grid">
                  <line x1={left} x2={width - right} y1={yAxis(value)} y2={yAxis(value)} />
                  <text x={left - 12} y={yAxis(value) + 3} textAnchor="end">
                    {axisNumber.format(value)}
                  </text>
                </g>
              ))}
              <line className="wh-chart-zero" x1={left} x2={width - right} y1={yAxis(0)} y2={yAxis(0)} />
              <path className="wh-chart-line" d={line} />
              {points.map((point, index) => (
                <circle
                  key={index}
                  className="wh-chart-point"
                  cx={xAxis(point.x)}
                  cy={yAxis(point.value)}
                  r={3.5}
                >
                  <title>
                    {point.label}: {resultNumber.format(point.value)}
                  </title>
                </circle>
              ))}
              {xTicks.map((index) => (
                <text
                  key={index}
                  className="wh-chart-label"
                  x={xAxis(points[index].x)}
                  y={height - 11}
                  textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
                >
                  {xLabel(index)}
                </text>
              ))}
            </>
          )}
        </svg>
      </div>
      <figcaption>
        {config.kind === 'line'
          ? `Ordered by ${config.x}${dateAxis ? ' (UTC)' : ''}.`
          : 'In the current table order.'}{' '}
        No rows combined.{data.omitted ? ` ${data.omitted} rows with missing values omitted.` : ''}
        {data.truncated
          ? ` First ${points.length} valid rows shown; ${data.truncated} more remain in the table.`
          : ''}
      </figcaption>
    </figure>
  );
}

export function Warehouse({
  boot,
  onAgent,
  onOpenPage,
}: {
  boot: Bootstrap;
  onAgent?: (prompt: string) => void;
  onOpenPage?: (path: string) => void;
}) {
  const [status, setStatus] = useState<WarehouseStatus | null>(null);
  const [tables, setTables] = useState<WarehouseTable[]>([]);
  const [schema, setSchema] = useState<WarehouseSchema | null>(null);
  const [selectedTable, setSelectedTable] = useState('');
  const [rail, setRail] = useState<'tables' | 'saved'>('tables');
  const [panel, setPanel] = useState<'results' | 'schema' | 'history'>('results');
  const [filter, setFilter] = useState('');
  const [sql, setSql] = useState(boot.workspace.kind === 'sample' ? warehouseDemoQueries[0].sql : blankQuery);
  const [rowLimit, setRowLimit] = useState(100);
  const [maxBytes, setMaxBytes] = useState(WAREHOUSE_DEFAULT_BYTES);
  const [prepared, setPrepared] = useState<WarehousePrepared | null>(null);
  const [result, setResult] = useState<WarehouseReceipt | null>(null);
  const [resultSql, setResultSql] = useState('');
  const [resultRowLimit, setResultRowLimit] = useState<number | null>(null);
  const [history, setHistory] = useState<WarehouseHistory[]>([]);
  const [saved, setSaved] = useState<WarehouseSavedQuery[]>([]);
  const [activeSaved, setActiveSaved] = useState<string | undefined>();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [bqPath, setBqPath] = useState('');
  const [diagnostics, setDiagnostics] = useState<WarehouseDiagnostics | null>(null);
  const [settingsCap, setSettingsCap] = useState(WAREHOUSE_DEFAULT_BYTES);
  const [showSave, setShowSave] = useState(false);
  const [queryName, setQueryName] = useState('');
  const generation = useRef(0);
  const lineNumbers = useRef<HTMLDivElement>(null);
  const workspaceId = boot.workspace.id;
  const sample = boot.workspace.kind === 'sample';
  const request = <T,>(method: string, params: Record<string, unknown> = {}) =>
    invoke<T>(`warehouse.${method}`, { workspaceId, ...params });
  useEffect(() => {
    const id = ++generation.current;
    setStatus(null);
    setDiagnostics(null);
    setTables([]);
    setSchema(null);
    setSelectedTable('');
    setPrepared(null);
    setResult(null);
    setResultRowLimit(null);
    setError('');
    setBusy('Opening warehouse');
    setHistory([]);
    setSaved([]);
    setActiveSaved(undefined);
    setSql(sample ? warehouseDemoQueries[0].sql : blankQuery);
    void request<WarehouseStatus>('status')
      .then(async (next) => {
        if (id !== generation.current) return;
        setStatus(next);
        setSaved(next.saved);
        setHistory(next.history);
        setMaxBytes(next.config.maxBytes);
        setBqPath(next.config.bqPath);
        setDiagnostics(next.diagnostics);
        setSettingsCap(next.config.maxBytes);
        if (next.sample) {
          const list = await request<WarehouseTable[]>('tables');
          if (id === generation.current) setTables(list);
        }
      })
      .catch((e) => {
        if (id === generation.current) setError(errorText(e));
      })
      .finally(() => {
        if (id === generation.current) setBusy('');
      });
    return () => {
      generation.current++;
    };
  }, [workspaceId, boot.workspace.selection.verifiedAt]);
  useEffect(
    () =>
      subscribe((event) => {
        if (event.type !== 'changed') return;
        const id = generation.current;
        void request<WarehouseStatus>('status')
          .then((next) => {
            if (id !== generation.current) return;
            setStatus(next);
            setSaved(next.saved);
            setHistory(next.history);
          })
          .catch(() => {});
      }),
    [workspaceId, boot.workspace.selection.verifiedAt]
  );
  const operate = async <T,>(label: string, task: () => Promise<T>, apply: (value: T) => void) => {
    const id = generation.current;
    setBusy(label);
    setError('');
    try {
      const value = await task();
      if (id === generation.current) apply(value);
    } catch (e) {
      if (id === generation.current) {
        setError(errorText(e));
        void request<WarehouseStatus>('status')
          .then((next) => {
            if (id === generation.current) setStatus(next);
          })
          .catch(() => {});
      }
    } finally {
      if (id === generation.current) {
        setBusy('');
        void request<WarehouseHistory[]>('history')
          .then((value) => {
            if (id === generation.current) setHistory(value);
          })
          .catch(() => {});
      }
    }
  };
  const changeSql = (value: string) => {
    setSql(value);
    setPrepared(null);
    setActiveSaved(undefined);
  };
  const selectQuery = (
    query: Pick<WarehouseSavedQuery, 'sql' | 'rowLimit' | 'maxBytes'> & { id?: string; name?: string }
  ) => {
    setSql(query.sql);
    setRowLimit(query.rowLimit);
    setMaxBytes(Math.min(query.maxBytes, status?.config.maxBytes ?? WAREHOUSE_DEFAULT_BYTES));
    setPrepared(null);
    setActiveSaved(query.id);
    setQueryName(query.name || '');
    setError('');
  };
  const inspect = (table: WarehouseTable) => {
    setSelectedTable(table.name);
    void operate(
      'Loading schema',
      () => request<WarehouseSchema>('schema', { table: table.name }),
      (next) => {
        setSchema(next);
        setPanel('schema');
      }
    );
  };
  const dryRun = () => {
    setPrepared(null);
    void operate(
      'Checking query',
      () => request<WarehousePrepared>('prepare', { sql, rowLimit, maxBytes }),
      (next) => {
        setPrepared(next);
        setPanel('results');
        if (status) setStatus({ ...status, access: 'verified', checkedAt: next.receipt.at });
      }
    );
  };
  const run = () => {
    if (!prepared) return;
    const ticket = prepared.ticket,
      submittedSql = prepared.query.sql,
      submittedLimit = prepared.query.rowLimit;
    setPrepared(null);
    void operate(
      'Running bounded query',
      () => request<WarehouseReceipt>('run', { ticket }),
      (next) => {
        setResult(next);
        setResultSql(submittedSql);
        setResultRowLimit(submittedLimit);
        setPanel('results');
      }
    );
  };
  const filteredTables = tables.filter((table) => table.name.toLowerCase().includes(filter.toLowerCase()));
  const filteredSaved = saved.filter((query) => query.name.toLowerCase().includes(filter.toLowerCase()));
  const capOptions = [
    ...new Set([
      ...ceilings.filter((cap) => cap <= (status?.config.maxBytes ?? WAREHOUSE_DEFAULT_BYTES)),
      maxBytes,
    ]),
  ].sort((a, b) => a - b);
  return (
    <section className="wh-screen">
      <header className="wh-heading">
        <div>
          <span className="wh-eyebrow">MEASURE WHAT MATTERS</span>
          <h1>
            Data warehouse<span>.</span>
          </h1>
          <p>Find the evidence behind your next storefront decision.</p>
        </div>
        <div className="wh-heading-actions">
          {onAgent && (
            <Button
              variant="outline"
              onClick={() =>
                onAgent(
                  `Help me answer a question about the selected merchant warehouse. Inspect the available schema first. Draft and save a read-only SQL query for me to review. Do not run a query. Current SQL: ${sql}`
                )
              }
              disabled={!!busy}
            >
              <Code2 size={14} /> Ask about data
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowSettings(true)} disabled={!status || !!busy}>
            <Settings2 size={14} /> Connection
          </Button>
        </div>
      </header>
      <div className={`wh-connection ${sample ? 'is-demo' : ''}`}>
        <span className="wh-connection-icon">
          <Database size={19} />
        </span>
        <div className="wh-connection-label">
          <strong>{sample ? 'Fieldwork demo warehouse' : status?.project || 'Merchant warehouse'}</strong>
          <span>
            {sample
              ? 'Synthetic data for exploring Studio. No live queries or charges.'
              : `${status?.dataset || 'ultracart_dw'} · Only the selected merchant’s warehouse`}
          </span>
        </div>
        <span
          className={`wh-status ${sample || (status?.access === 'verified' && !status.issue) ? 'ready' : ''}`}
        >
          <i />
          {sample
            ? 'Demo data'
            : status?.issue
              ? 'Check last error'
              : status?.access === 'verified'
                ? 'Query check passed'
                : status?.toolAvailable && status.toolkitAvailable
                  ? 'Ready to check access'
                  : 'Setup needed'}
        </span>
      </div>
      {error && (
        <div className="wh-error" role="alert">
          <span>{error}</span>
          {!sample && (
            <button className="wh-error-fix" onClick={() => setShowSettings(true)}>
              Connection checks <ArrowUpRight size={13} />
            </button>
          )}
          <button aria-label="Dismiss warehouse error" onClick={() => setError('')}>
            <X size={14} />
          </button>
        </div>
      )}
      <div className="wh-workbench">
        <aside className="wh-explorer">
          <div className="wh-explorer-tabs">
            <button
              className={rail === 'tables' ? 'active' : ''}
              onClick={() => {
                setRail('tables');
                setFilter('');
              }}
            >
              <Database size={14} /> Explorer
            </button>
            <button
              className={rail === 'saved' ? 'active' : ''}
              onClick={() => {
                setRail('saved');
                setFilter('');
              }}
            >
              <BookOpen size={14} /> Saved
            </button>
          </div>
          <div className="wh-search">
            <Search size={13} />
            <input
              aria-label={rail === 'tables' ? 'Filter warehouse tables' : 'Filter saved queries'}
              placeholder={rail === 'tables' ? 'Find a table…' : 'Find a query…'}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>
          {rail === 'tables' ? (
            <>
              <div className="wh-rail-caption">
                <span>
                  CURATED VIEWS <b>{tables.length || ''}</b>
                </span>
                <button
                  disabled={!!busy}
                  aria-label="Reload warehouse tables"
                  onClick={() =>
                    void operate('Loading tables', () => request<WarehouseTable[]>('tables'), setTables)
                  }
                >
                  <RefreshCw size={12} />
                </button>
              </div>
              <div className="wh-table-list">
                {filteredTables.map((table) => (
                  <button
                    key={table.name}
                    className={selectedTable === table.name ? 'selected' : ''}
                    onClick={() => inspect(table)}
                    disabled={!!busy}
                  >
                    <Table2 size={14} />
                    <span>
                      {table.name.replace(/^uc_/, '')}
                      <small>{table.type.toLowerCase()}</small>
                    </span>
                    <ChevronRight size={12} />
                  </button>
                ))}
              </div>
              {!tables.length && (
                <div className="wh-rail-empty">
                  <Database size={24} />
                  <strong>Your schema, one place.</strong>
                  <p>Load the selected merchant’s curated views and inspect their fields.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!!busy || !status?.toolAvailable || !status.toolkitAvailable}
                    onClick={() =>
                      void operate('Loading tables', () => request<WarehouseTable[]>('tables'), setTables)
                    }
                  >
                    Load tables
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="wh-rail-caption">
                <span>
                  QUERY LIBRARY <b>{saved.length}</b>
                </span>
              </div>
              <div className="wh-saved-list">
                {filteredSaved.map((query) => (
                  <div key={query.id} className={activeSaved === query.id ? 'selected' : ''}>
                    <button onClick={() => selectQuery(query)} disabled={!!busy}>
                      <Code2 size={15} />
                      <span>
                        {query.name}
                        <small>{sample ? 'Synthetic demo query' : `${query.rowLimit} rows maximum`}</small>
                      </span>
                    </button>
                    <button
                      className="wh-delete"
                      aria-label={`Delete saved query ${query.name}`}
                      disabled={!!busy}
                      onClick={() =>
                        void operate(
                          'Removing saved query',
                          () =>
                            request<WarehouseSavedQuery[]>('save', {
                              id: query.id,
                              name: query.name,
                              sql: query.sql,
                              rowLimit: query.rowLimit,
                              maxBytes: query.maxBytes,
                              remove: true,
                            }),
                          setSaved
                        )
                      }
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
              {!saved.length && (
                <div className="wh-rail-empty">
                  <BookOpen size={24} />
                  <strong>Keep useful questions.</strong>
                  <p>Save SQL here to reuse it with this merchant.</p>
                </div>
              )}
            </>
          )}
          <div className="wh-boundary">
            <ShieldCheck size={16} />
            <span>
              Read-only by design.<small>Every run starts with a scan estimate and an explicit action.</small>
            </span>
          </div>
        </aside>
        <div className="wh-main">
          <div className="wh-editor-card">
            <div className="wh-editor-head">
              <span>
                <Code2 size={15} />
                <strong>{saved.find((query) => query.id === activeSaved)?.name || 'Untitled query'}</strong>
                <i>SQL</i>
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={!!busy || !sql.trim()}
                onClick={() => {
                  setQueryName(saved.find((query) => query.id === activeSaved)?.name || '');
                  setShowSave(true);
                }}
              >
                <Save size={13} /> Save query
              </Button>
            </div>
            <div className="wh-code-editor">
              <div className="wh-line-numbers" aria-hidden="true" ref={lineNumbers}>
                {sql.split('\n').map((_, index) => (
                  <span key={index}>{index + 1}</span>
                ))}
              </div>
              <textarea
                aria-label="Warehouse SQL query"
                spellCheck={false}
                value={sql}
                onChange={(event) => changeSql(event.target.value)}
                onScroll={(event) => {
                  if (lineNumbers.current) lineNumbers.current.scrollTop = event.currentTarget.scrollTop;
                }}
                disabled={!!busy}
              />
            </div>
            <div className="wh-editor-footer">
              <div className="wh-query-limits">
                <label>
                  Rows
                  <select
                    aria-label="Warehouse result row limit"
                    value={rowLimit}
                    disabled={!!busy}
                    onChange={(event) => {
                      setRowLimit(Number(event.target.value));
                      setPrepared(null);
                    }}
                  >
                    {[10, 25, 50, 100].map((rows) => (
                      <option key={rows} value={rows}>
                        {rows}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Scan cap
                  <select
                    aria-label="Warehouse query scan cap"
                    value={maxBytes}
                    disabled={!!busy}
                    onChange={(event) => {
                      setMaxBytes(Number(event.target.value));
                      setPrepared(null);
                    }}
                  >
                    {capOptions.map((cap) => (
                      <option key={cap} value={cap}>
                        {warehouseBytes(cap)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="wh-query-actions">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    !!busy ||
                    !sql.trim() ||
                    (!sample && (!status?.toolAvailable || !status?.toolkitAvailable))
                  }
                  onClick={dryRun}
                >
                  {busy === 'Checking query' ? (
                    <LoaderCircle size={13} className="spin" />
                  ) : (
                    <FlaskConical size={13} />
                  )}{' '}
                  Dry run
                </Button>
                <Button size="sm" disabled={!!busy || !prepared} onClick={run}>
                  {busy === 'Running bounded query' ? (
                    <LoaderCircle size={13} className="spin" />
                  ) : (
                    <Play size={12} />
                  )}{' '}
                  {sample ? 'Run demo' : 'Run query'}
                </Button>
              </div>
            </div>
          </div>
          {prepared && (
            <div className="wh-receipt">
              <span className="wh-receipt-check">
                <Check size={17} />
              </span>
              <div>
                <strong>{sample ? 'Synthetic estimate ready' : 'Dry run passed'}</strong>
                <span>
                  {warehouseBytes(prepared.receipt.estimatedBytes)} estimated ·{' '}
                  {warehouseBytes(prepared.receipt.maxBytes)} ceiling · up to {prepared.query.rowLimit} rows
                </span>
              </div>
              <div className="wh-scan-meter">
                <span
                  style={{
                    width: `${Math.max(2, Math.min(100, (prepared.receipt.estimatedBytes / prepared.receipt.maxBytes) * 100))}%`,
                  }}
                />
              </div>
              <span className="wh-receipt-expiry">
                Review, then run<small>Approval expires in 5 minutes</small>
              </span>
            </div>
          )}
          <div className="wh-output">
            <div className="wh-output-tabs">
              <div>
                <button className={panel === 'results' ? 'active' : ''} onClick={() => setPanel('results')}>
                  <Table2 size={14} /> Results{result && <b>{result.rows.length}</b>}
                </button>
                <button className={panel === 'schema' ? 'active' : ''} onClick={() => setPanel('schema')}>
                  <Database size={14} /> Schema{schema && <b>{schema.fields.length}</b>}
                </button>
                <button className={panel === 'history' ? 'active' : ''} onClick={() => setPanel('history')}>
                  <FileClock size={14} /> History
                </button>
              </div>
              {busy && (
                <span className="wh-busy">
                  <LoaderCircle className="spin" size={12} />
                  {busy}
                </span>
              )}
            </div>
            {panel === 'results' &&
              (result ? (
                <WarehouseResults
                  key={`${workspaceId}:${result.at}`}
                  result={result}
                  boot={boot}
                  previousQuery={resultSql !== sql}
                  rowLimit={resultRowLimit}
                  onOpenPage={onOpenPage}
                />
              ) : (
                <div className="wh-empty-output">
                  <span className="wh-empty-icon">
                    <Table2 size={26} />
                  </span>
                  <h3>A question is a good place to start.</h3>
                  <p>
                    {sample
                      ? 'Try a saved demo query. Review its synthetic scan estimate, then run it to explore the results.'
                      : 'Inspect a table, write your SELECT query, then use Dry run to check access and the scan estimate.'}
                  </p>
                  {sample && (
                    <Button variant="outline" size="sm" onClick={() => setRail('saved')}>
                      <BookOpen size={13} /> Browse sample queries <ArrowUpRight size={12} />
                    </Button>
                  )}
                </div>
              ))}
            {panel === 'schema' &&
              (schema ? (
                <>
                  <div className="wh-schema-summary">
                    <span>
                      <Table2 size={15} />
                      <strong>{schema.table}</strong>
                      {schema.sample && <i>Synthetic schema</i>}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!!busy}
                      onClick={() => {
                        if (sample) {
                          const query = warehouseDemoQueries.find((item) => item.sql.includes(schema.table));
                          if (query) selectQuery(query);
                        } else
                          changeSql(
                            `SELECT\n  ${
                              schema.fields
                                .filter((field) => !field.path.includes('.'))
                                .slice(0, 5)
                                .map((field) => `\`${field.path}\``)
                                .join(',\n  ') || '*'
                            }\nFROM ultracart_dw.${schema.table}\nLIMIT 25`
                          );
                        setPanel('results');
                      }}
                    >
                      <Code2 size={13} /> Start query
                    </Button>
                  </div>
                  <div className="wh-result-scroll">
                    <table className="wh-schema-table">
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Type</th>
                          <th>Mode</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schema.fields.map((field) => (
                          <tr key={field.path}>
                            <td title={field.description}>
                              <span style={{ paddingLeft: field.path.split('.').length > 1 ? 12 : 0 }}>
                                {field.path}
                              </span>
                              {field.description && <small>{field.description}</small>}
                            </td>
                            <td>
                              <code>{field.type}</code>
                            </td>
                            <td className="wh-field-mode">{field.mode.toLowerCase()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="wh-empty-output">
                  <Database size={27} />
                  <h3>Read the schema first.</h3>
                  <p>Select a curated view in the explorer to inspect its fields and nested records.</p>
                </div>
              ))}
            {panel === 'history' && (
              <div className="wh-history">
                {history.length ? (
                  history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => selectQuery({ sql: item.sql, rowLimit: 100, maxBytes: item.maxBytes })}
                      disabled={!!busy}
                    >
                      <span className={`wh-history-state ${item.outcome}`}>
                        {item.outcome === 'completed' ? (
                          <Check size={14} />
                        ) : item.outcome === 'dry-run' ? (
                          <FlaskConical size={14} />
                        ) : (
                          <FileClock size={14} />
                        )}
                      </span>
                      <span className="wh-history-query">
                        <strong>{item.sql.replace(/\s+/g, ' ')}</strong>
                        <small>
                          {item.sample ? 'Demo · ' : ''}
                          {item.outcome === 'dry-run'
                            ? 'Dry run'
                            : item.outcome === 'completed'
                              ? `${item.rowCount} rows returned`
                              : item.outcome === 'uncertain'
                                ? 'Completion not verified'
                                : 'Check failed'}
                          {item.estimatedBytes !== null ? ` · ${warehouseBytes(item.estimatedBytes)}` : ''}
                        </small>
                      </span>
                      <time>{relativeTime(item.at)}</time>
                      <ChevronRight size={13} />
                    </button>
                  ))
                ) : (
                  <div className="wh-empty-output">
                    <FileClock size={27} />
                    <h3>Your work leaves a trail.</h3>
                    <p>
                      Dry runs and query attempts appear here for the selected merchant. Select one to reopen
                      its SQL.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="wh-footer-note">
            <ShieldCheck size={12} />
            <span>
              {sample
                ? 'Demo tables and figures are fictional. Custom SQL requires a connected merchant warehouse.'
                : 'Only SELECT queries. Merchant-scoped tables. A native byte ceiling on every execution.'}
            </span>
          </div>
        </div>
      </div>
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="wh-settings-dialog">
          <DialogHeader>
            <DialogTitle>Warehouse connection</DialogTitle>
            <DialogDescription>
              BigQuery uses your Google Cloud CLI account. Studio limits it to this merchant’s curated
              warehouse.
            </DialogDescription>
          </DialogHeader>
          <div className="wh-settings-project">
            <Database size={18} />
            <span>
              <small>SELECTED PROJECT</small>
              <strong>{status?.project}</strong>
            </span>
            <ShieldCheck size={18} />
          </div>
          <label className="wh-settings-label">
            BigQuery CLI executable
            <Input
              value={bqPath}
              onChange={(event) => {
                setBqPath(event.target.value);
                setDiagnostics(null);
              }}
              placeholder="/absolute/path/to/bq"
            />
            <small>
              Use the full path to bq, or bq.cmd on Windows. Studio includes common installation folders when
              it starts the CLI. The checks below identify runtime, account, and access problems.
            </small>
          </label>
          <label className="wh-settings-label">
            Maximum scan per query
            <select value={settingsCap} onChange={(event) => setSettingsCap(Number(event.target.value))}>
              {[...new Set([...ceilings, settingsCap])]
                .sort((a, b) => a - b)
                .map((cap) => (
                  <option key={cap} value={cap}>
                    {warehouseBytes(cap)}
                  </option>
                ))}
            </select>
            <small>Each query can use a lower ceiling. Increasing this limit permits larger scans.</small>
          </label>
          <div className="wh-access-note">
            <HardDrive size={16} />
            <p>
              Connection checks inspect CLI startup, local account state, and warehouse metadata. They do not
              run SQL. Query access and scan estimates require a separate dry run.
            </p>
          </div>
          {error && (
            <div className="wh-dialog-error" role="alert">
              {error}
            </div>
          )}
          {status?.issue &&
            status.config.bqPath === bqPath &&
            !diagnostics?.checks.some((check) => check.issue?.code === status.issue?.code) && (
              <WarehouseIssueHelp issue={status.issue} />
            )}
          {diagnostics && <WarehouseDiagnosticReport report={diagnostics} />}
          <div className="wh-connection-actions">
            <Button
              variant="outline"
              disabled={!!busy || !warehouseAbsolutePath(bqPath.trim()) || sample}
              onClick={() =>
                void operate(
                  'Checking connection',
                  () => request<WarehouseDiagnostics>('diagnose', { bqPath: bqPath.trim() }),
                  setDiagnostics
                )
              }
            >
              {busy === 'Checking connection' ? (
                <LoaderCircle className="animate-spin" size={14} />
              ) : (
                <ShieldCheck size={14} />
              )}
              Run connection checks
            </Button>
            <Button
              disabled={!!busy || !warehouseAbsolutePath(bqPath.trim())}
              onClick={() =>
                void operate(
                  'Saving connection',
                  () => request<WarehouseStatus>('configure', { bqPath, maxBytes: settingsCap }),
                  (next) => {
                    setStatus(next);
                    setMaxBytes(Math.min(maxBytes, next.config.maxBytes));
                    setPrepared(null);
                    setDiagnostics(null);
                  }
                )
              }
            >
              Save connection
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showSave} onOpenChange={setShowSave}>
        <DialogContent className="wh-save-dialog">
          <DialogHeader>
            <DialogTitle>Save this question</DialogTitle>
            <DialogDescription>
              The SQL and limits stay in this merchant’s local query library. Saving does not run the query.
            </DialogDescription>
          </DialogHeader>
          <label className="wh-settings-label">
            Query name
            <Input
              value={queryName}
              onChange={(event) => setQueryName(event.target.value)}
              placeholder="For example, weekly product performance"
              maxLength={80}
              autoFocus
            />
          </label>
          <Button
            disabled={!!busy || !queryName.trim()}
            onClick={() =>
              void operate(
                'Saving query',
                () =>
                  request<WarehouseSavedQuery[]>('save', {
                    id: activeSaved,
                    name: queryName,
                    sql,
                    rowLimit,
                    maxBytes,
                  }),
                (next) => {
                  setSaved(next);
                  setActiveSaved(next[0]?.id);
                  setShowSave(false);
                  setRail('saved');
                }
              )
            }
          >
            <Save size={14} /> Save query
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
