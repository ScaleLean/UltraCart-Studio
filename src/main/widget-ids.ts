import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import type { StudioServices } from './services';
import { selectionSchema, type Selection } from '../shared/connection';
import { sameStore } from '../shared/storefront';
import { isSampleSelection } from '../shared/sample';
import {
  LOCAL_WIDGET_PREFIX,
  parsePageDocument,
  serializePageDocument,
  type CjsonNode,
} from '../shared/page-builder';
import type { WidgetIdPlan, WidgetIdReceipt, WidgetIdResult } from '../shared/widget-ids';

const inputSchema = z
  .object({
    selection: selectionSchema,
    content: z.string().max(512 * 1024),
    operationKey: z
      .string()
      .min(1)
      .max(240)
      .regex(/^[A-Za-z0-9:._/-]+$/),
  })
  .strict();
const reserveSchema = inputSchema.extend({ confirmedHost: z.string().max(253) }).strict();
const provenance =
  'Allocated through the selected profile and storefront, with identity checked before and after each request. The toolkit returns numeric IDs without ownership fields; independent ownership lookup is unavailable.';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const pointer = (key: string) => key.replace(/~/g, '~0').replace(/\//g, '~1');
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
type References = { ids: Set<string>; css: Set<string> };
// Reservations running in this process, keyed by database so that every service instance sees them.
const running = new WeakMap<object, Set<string>>();
const interrupted =
  'Studio stopped before any allocation request was sent. No IDs were reserved; you can retry.';
export type WidgetIdTransport = {
  verify(selection: Selection): Promise<unknown>;
  reserve(selection: Selection, count: number): Promise<unknown>;
};
type Options = {
  transport?: WidgetIdTransport;
  schemaFor?: (type: string) => Promise<unknown>;
  now?: () => Date;
  assertCurrent?: () => void;
};
function nodes(root: CjsonNode): CjsonNode[] {
  return [root, ...(root.childWidgets ?? []).flatMap(nodes)];
}
function localNodes(root: CjsonNode) {
  return nodes(root).filter((node) => node.id.startsWith(LOCAL_WIDGET_PREFIX));
}
function referenceKeys(schema: unknown): References {
  if (!object(schema) || !object(schema.properties))
    throw new Error('The installed widget schema is incomplete.');
  const result: References = { ids: new Set(), css: new Set() };
  for (const [key, definition] of Object.entries(schema.properties)) {
    if (!object(definition)) continue;
    if (
      ['widget-id', 'child-widget'].includes(String(definition['x-sfvb-format'])) ||
      ['widget', 'widgets', 'parentWidget', 'childWidget', 'descendantWidget'].includes(
        String(definition['x-sfvb-type'])
      )
    )
      result.ids.add(key);
    if (definition['x-sfvb-format'] === 'css') result.css.add(key);
  }
  return result;
}
function mapStrings(value: unknown, transform: (value: string) => string, depth = 0): unknown {
  if (depth > 40) throw new Error('Widget reference configuration is too deeply nested.');
  if (typeof value === 'string') return transform(value);
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, transform, depth + 1));
  if (object(value))
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, mapStrings(item, transform, depth + 1)])
    );
  return value;
}
function rewriteSelector(selector: string, mapping: Map<string, string>) {
  let output = '',
    quote = '',
    comment = false;
  for (let index = 0; index < selector.length; index++) {
    const char = selector[index];
    if (comment) {
      output += char;
      if (char === '*' && selector[index + 1] === '/') {
        output += selector[++index];
        comment = false;
      }
      continue;
    }
    if (quote) {
      output += char;
      if (char === '\\') output += selector[++index] ?? '';
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && selector[index + 1] === '*') {
      output += '/*';
      index++;
      comment = true;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      output += char;
      continue;
    }
    if (char === '#') {
      const id = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(selector.slice(index + 1))?.[0];
      if (id && mapping.has(id)) {
        output += '#' + mapping.get(id);
        index += id.length;
        continue;
      }
    }
    output += char;
  }
  return output;
}
function rewriteCss(css: string, mapping: Map<string, string>) {
  let output = '',
    start = 0,
    quote = '',
    comment = false;
  for (let index = 0; index < css.length; index++) {
    const char = css[index];
    if (comment) {
      if (char === '*' && css[index + 1] === '/') {
        index++;
        comment = false;
      }
      continue;
    }
    if (quote) {
      if (char === '\\') index++;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && css[index + 1] === '*') {
      comment = true;
      index++;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '{') {
      const prelude = css.slice(start, index);
      output += (prelude.trim().startsWith('@') ? prelude : rewriteSelector(prelude, mapping)) + char;
      start = index + 1;
    } else if (char === ';' || char === '}') {
      output += css.slice(start, index + 1);
      start = index + 1;
    }
  }
  return output + css.slice(start);
}
function survivingReference(value: unknown, ids: string[], path = '', depth = 0): string | null {
  if (depth > 100) throw new Error('The document exceeds the reference inspection depth.');
  if (typeof value === 'string') {
    return ids.some((id) => value.includes(id)) ? path || '/' : null;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      const found = survivingReference(value[index], ids, `${path}/${index}`, depth + 1);
      if (found) return found;
    }
  } else if (object(value)) {
    for (const [key, item] of Object.entries(value)) {
      const found = survivingReference(item, ids, `${path}/${pointer(key)}`, depth + 1);
      if (found) return found;
    }
  }
  return null;
}
function remap(root: CjsonNode, mapping: Map<string, string>, references: Map<string, References>) {
  const result = structuredClone(root);
  for (const node of nodes(result)) {
    for (const key of ['id', 'parentWidgetId', 'containerId'] as const) {
      const value = node[key];
      if (typeof value === 'string' && mapping.has(value)) node[key] = mapping.get(value)!;
    }
    const keys = references.get(node.type);
    for (const [key, value] of Object.entries(node.config)) {
      if (keys?.ids.has(key))
        node.config[key] = mapStrings(value, (text) =>
          text.replace(/[^,\s]+/gu, (id) => mapping.get(id) ?? id)
        );
      else if (keys?.css.has(key)) node.config[key] = mapStrings(value, (text) => rewriteCss(text, mapping));
    }
  }
  const remaining = survivingReference(result, [LOCAL_WIDGET_PREFIX]);
  if (remaining)
    throw new Error(
      `A local widget ID appears in an unsupported reference at ${remaining}. Edit that field before reserving IDs.`
    );
  return serializePageDocument(result);
}

class Superseded extends Error {
  constructor() {
    super(
      'Another reservation took over this preparation before any IDs were requested. Reopen its receipt.'
    );
  }
}

export class WidgetIdsService {
  private now: () => Date;
  constructor(
    private services: StudioServices,
    private options: Options = {}
  ) {
    this.now = options.now ?? (() => new Date());
    services.store.db.exec(
      'CREATE TABLE IF NOT EXISTS widget_id_operations (operation_key TEXT PRIMARY KEY, value TEXT NOT NULL)'
    );
  }
  private get running() {
    const db = this.services.store.db;
    let keys = running.get(db);
    if (!keys) running.set(db, (keys = new Set()));
    return keys;
  }
  private saved(operationKey: string) {
    const row = this.services.store.db
      .prepare('SELECT value FROM widget_id_operations WHERE operation_key = ?')
      .get(operationKey);
    if (!row) return null;
    let receipt: WidgetIdReceipt;
    try {
      receipt = JSON.parse(row.value as string) as WidgetIdReceipt;
    } catch {
      throw new Error('The stored preparation receipt is damaged.');
    }
    if (!object(receipt) || !Array.isArray(receipt.batches))
      throw new Error('The stored preparation receipt is damaged.');
    // A batch is recorded before every allocation request, so an interrupted preparation with no
    // batches never reached the toolkit. Unless it is still running here, it is safe to retry.
    if (receipt.status === 'preparing' && !receipt.batches.length && !this.running.has(operationKey))
      return { ...receipt, status: 'blocked' as const, detail: interrupted };
    return receipt;
  }
  private persist(receipt: WidgetIdReceipt) {
    receipt.updatedAt = this.now().toISOString();
    const result = this.services.store.db
      .prepare(
        "UPDATE widget_id_operations SET value = ? WHERE operation_key = ? AND json_extract(value, '$.id') = ?"
      )
      .run(JSON.stringify(receipt), receipt.operationKey, receipt.id);
    if (!result.changes) throw new Superseded();
  }
  inspect(raw: unknown): WidgetIdPlan {
    const input = inputSchema.parse(raw);
    const root = parsePageDocument(input.content),
      all = nodes(root),
      count = localNodes(root).length;
    const contentHash = digest(input.content),
      receipt = this.saved(input.operationKey);
    if (receipt && (!sameStore(receipt.selection, input.selection) || receipt.contentHash !== contentHash))
      throw new Error('This preparation key belongs to different content or a different storefront.');
    const reason = isSampleSelection(input.selection)
      ? 'Sample pages use local IDs and do not reserve server IDs.'
      : receipt?.status === 'preparing' && this.running.has(input.operationKey)
        ? 'A reservation for this preparation is already running.'
        : receipt && !['blocked', 'complete'].includes(receipt.status)
          ? 'An earlier allocation may have completed. Its receipt is retained; automatic retry is disabled.'
          : count === 0
            ? 'This document has no new local widget IDs.'
            : undefined;
    return {
      operationKey: input.operationKey,
      contentHash,
      count,
      existingCount: all.length - count,
      batchSize: 100,
      batchCount: Math.ceil(count / 100),
      canReserve: !reason,
      ...(reason ? { reason } : {}),
      receipt,
      provenance,
    };
  }
  async reserve(raw: unknown): Promise<WidgetIdResult> {
    const input = reserveSchema.parse(raw);
    if (input.confirmedHost !== input.selection.storefront.host)
      throw new Error('Confirm the exact storefront host before reserving native IDs.');
    const plan = this.inspect({
      selection: input.selection,
      content: input.content,
      operationKey: input.operationKey,
    });
    if (plan.receipt?.status === 'complete' && plan.receipt.preparedContent) {
      if (digest(plan.receipt.preparedContent) !== plan.receipt.preparedHash)
        throw new Error('The stored preparation receipt is damaged.');
      return { content: plan.receipt.preparedContent, receipt: plan.receipt };
    }
    if (!plan.canReserve) throw new Error(plan.reason);
    this.options.assertCurrent?.();
    const settings = this.services.settings(),
      root = parsePageDocument(input.content),
      local = localNodes(root);
    const referenceMap = new Map<string, References>();
    const schemaFor =
      this.options.schemaFor ??
      (async (type: string) =>
        JSON.parse(
          await readFile(
            resolve(dirname(settings.cliPath), '../catalog/elements', `${type}.schema.json`),
            'utf8'
          )
        ));
    for (const node of nodes(root)) {
      if (
        !local.some((item) => item.type === node.type) &&
        !survivingReference(
          node.config,
          local.map((item) => item.id)
        )
      )
        continue;
      if (referenceMap.has(node.type)) continue;
      if (!/^[a-z][a-z0-9]*$/.test(node.type))
        throw new Error('The widget type cannot be resolved in the installed catalog.');
      referenceMap.set(node.type, referenceKeys(await schemaFor(node.type)));
      this.options.assertCurrent?.();
    }
    const nativeNumbers = new Set(
      nodes(root)
        .filter((node) => !node.id.startsWith(LOCAL_WIDGET_PREFIX))
        .map((node) => Number(/-(\d+)$/.exec(node.id)?.[1]))
        .filter(Number.isSafeInteger)
    );
    let trialNumber = Number.MAX_SAFE_INTEGER;
    const trialMapping = new Map<string, string>();
    for (const node of local) {
      while (nativeNumbers.has(trialNumber)) trialNumber--;
      trialMapping.set(node.id, `${node.type}-${trialNumber--}`);
    }
    remap(root, trialMapping, referenceMap);
    this.options.assertCurrent?.();
    const now = this.now().toISOString();
    const receipt: WidgetIdReceipt = {
      id: randomUUID(),
      operationKey: input.operationKey,
      selection: structuredClone(input.selection),
      contentHash: plan.contentHash,
      count: plan.count,
      status: 'preparing',
      createdAt: now,
      updatedAt: now,
      batches: [],
      mapping: {},
      provenance,
    };
    const db = this.services.store.db;
    db.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.saved(input.operationKey);
      if (previous && previous.status !== 'blocked')
        throw new Error('This preparation is already recorded. Reopen its receipt before continuing.');
      if (
        previous &&
        (!sameStore(previous.selection, input.selection) ||
          previous.contentHash !== plan.contentHash ||
          previous.batches.length)
      )
        throw new Error('An earlier allocation cannot be replayed.');
      db.prepare(
        'INSERT INTO widget_id_operations (operation_key, value) VALUES (?, ?) ON CONFLICT(operation_key) DO UPDATE SET value = excluded.value'
      ).run(input.operationKey, JSON.stringify(receipt));
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    const running = this.running;
    running.add(input.operationKey);
    // Use the shared connection so reservations queue behind publishes and respect the login guard.
    const connection = this.services.connection;
    const transport = this.options.transport ?? {
      verify: (selection: Selection) => connection.verify(selection),
      reserve: async (selection: Selection, count: number) =>
        JSON.parse(
          await connection.run([
            '--format',
            'json',
            '--profile',
            selection.profileId,
            'sf',
            'ids',
            '--storefront',
            String(selection.storefront.id),
            '--count',
            String(count),
          ])
        ),
    };
    const allocated: number[] = [];
    try {
      await transport.verify(input.selection);
      for (let offset = 0; offset < local.length; offset += 100) {
        if (offset) await transport.verify(input.selection);
        this.options.assertCurrent?.();
        const count = Math.min(100, local.length - offset);
        const batch = {
          index: receipt.batches.length,
          count,
          status: 'started' as const,
          startedAt: this.now().toISOString(),
        };
        receipt.batches.push(batch);
        receipt.status = 'allocating';
        this.persist(receipt);
        const rawResponse = await transport.reserve(input.selection, count);
        if (object(rawResponse) && Array.isArray(rawResponse.ids)) {
          receipt.batches[batch.index] = {
            ...batch,
            status: 'received',
            ids: rawResponse.ids
              .filter((id) => Number.isSafeInteger(id) && Number(id) > 0)
              .slice(0, 1000) as number[],
            ...(typeof rawResponse.count === 'number' ? { reportedCount: rawResponse.count } : {}),
          };
          this.persist(receipt);
        }
        const response = z
          .object({
            ids: z.array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)).length(count),
            count: z.literal(count),
          })
          .strict()
          .parse(rawResponse);
        const ids = response.ids;
        if (
          new Set([...allocated, ...ids]).size !== allocated.length + count ||
          ids.some((id) => nativeNumbers.has(id))
        )
          throw new Error('The returned IDs are duplicated or collide with existing widgets.');
        for (const row of db.prepare('SELECT operation_key, value FROM widget_id_operations').all()) {
          if (row.operation_key === input.operationKey) continue;
          let old: Partial<WidgetIdReceipt>;
          try {
            old = JSON.parse(row.value as string);
          } catch {
            continue;
          }
          if (
            object(old) &&
            old.selection?.merchantId === input.selection.merchantId &&
            old.selection.storefront?.id === input.selection.storefront.id &&
            old.selection.storefront.host === input.selection.storefront.host &&
            Array.isArray(old.batches) &&
            old.batches.some(
              (item) => Array.isArray(item?.ids) && item.ids.some((id: unknown) => ids.includes(id as number))
            )
          )
            throw new Error('The returned IDs already appear in another preparation receipt.');
        }
        receipt.batches[batch.index] = { ...batch, ids, status: 'received' };
        this.persist(receipt);
        await transport.verify(input.selection);
        allocated.push(...ids);
        receipt.batches[batch.index] = {
          ...batch,
          ids,
          status: 'confirmed',
          finishedAt: this.now().toISOString(),
        };
        this.persist(receipt);
      }
      const mapping = new Map(local.map((node, index) => [node.id, `${node.type}-${allocated[index]}`]));
      const content = remap(root, mapping, referenceMap);
      receipt.status = 'complete';
      receipt.mapping = Object.fromEntries(mapping);
      receipt.preparedContent = content;
      receipt.preparedHash = digest(content);
      this.persist(receipt);
      return { content, receipt };
    } catch (error) {
      if (error instanceof Superseded) throw error;
      receipt.status = receipt.batches.length ? 'uncertain' : 'blocked';
      receipt.detail = receipt.batches.length
        ? 'An allocation may have completed. Do not repeat it. Review the persisted batch receipt.'
        : 'Preflight identity verification failed before any allocation request.';
      try {
        this.persist(receipt);
      } catch (persistError) {
        if (!(persistError instanceof Superseded)) throw persistError;
      }
      throw error;
    } finally {
      running.delete(input.operationKey);
    }
  }
}
