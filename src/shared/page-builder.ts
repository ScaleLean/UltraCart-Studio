import { z } from 'zod';
import { draftScopeSchema, type Draft } from './drafts';

export type CjsonNode = {
  id: string;
  type: string;
  title?: string;
  config: Record<string, unknown>;
  childWidgets: CjsonNode[];
  parentWidgetId?: string;
  containerId?: string;
  x?: number;
  y?: number;
  [key: string]: unknown;
};
export const LOCAL_WIDGET_PREFIX = 'studio-local-';
const MAX_BYTES = 512 * 1024;
const MAX_NODES = 10000;
const MAX_DEPTH = 80;
const nodeId = z.string().min(1).max(256);
export const sectionPatternSchema = z.enum(['hero', 'benefits', 'faq', 'cta']);
export type SectionPattern = z.infer<typeof sectionPatternSchema>;
export const sectionOptionsSchema = z
  .object({
    title: z.string().max(300).optional(),
    description: z.string().max(4000).optional(),
    eyebrow: z.string().max(150).optional(),
    cta: z.string().max(150).optional(),
    href: z.string().max(2048).optional(),
    items: z
      .array(z.object({ title: z.string().max(300), description: z.string().max(4000) }).strict())
      .max(8)
      .optional(),
  })
  .strict();
export type SectionOptions = z.infer<typeof sectionOptionsSchema>;
export const builderOperationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('add'),
      pattern: sectionPatternSchema,
      parentId: nodeId,
      afterId: nodeId.optional(),
      options: sectionOptionsSchema.optional(),
    })
    .strict(),
  z.object({ kind: z.literal('duplicate'), nodeId }).strict(),
  z.object({ kind: z.literal('move'), nodeId, direction: z.enum(['up', 'down']) }).strict(),
  z.object({ kind: z.literal('remove'), nodeId }).strict(),
]);
export type BuilderOperation = z.infer<typeof builderOperationSchema>;
export const builderApplySchema = draftScopeSchema
  .extend({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    operation: builderOperationSchema,
  })
  .strict();
export type BuilderApplyInput = z.infer<typeof builderApplySchema>;
export const draftContentSaveSchema = draftScopeSchema
  .extend({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    content: z.string().max(MAX_BYTES),
  })
  .strict();

export type StructureChange = { kind: 'added' | 'removed' | 'moved'; id: string; label: string };
export type BuilderNode = {
  id: string;
  type: string;
  title: string;
  pointer: string;
  parentId: string | null;
  local: boolean;
  text: string;
  childCount: number;
  children: BuilderNode[];
};
export type BuilderInspection = {
  root: BuilderNode;
  nodeCount: number;
  localNodeIds: string[];
  structureChanges: StructureChange[];
  issues: string[];
};
export type PageBuilderView = BuilderInspection & { draft: Draft; baselineRoot?: BuilderNode };

const allowedKeys = new Set([
  'id',
  'type',
  'title',
  'config',
  'childWidgets',
  'parentWidgetId',
  'containerId',
  'ownerType',
  'ownerObjectId',
  'x',
  'y',
  'sizes',
  'comments',
  'runtime',
  'context',
  'offsets',
]);
const plainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function parsePageDocument(content: string): CjsonNode {
  if (new TextEncoder().encode(content).length > MAX_BYTES)
    throw new Error('This container exceeds the 512 KiB builder limit.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('The page body must be valid CJSON.');
  }
  const ids = new Set<string>();
  let count = 0;
  function visit(value: unknown, depth: number): CjsonNode {
    if (++count > MAX_NODES || depth > MAX_DEPTH)
      throw new Error('The page tree exceeds the builder inspection limit.');
    if (
      !plainObject(value) ||
      typeof value.id !== 'string' ||
      !value.id ||
      value.id.length > 256 ||
      typeof value.type !== 'string' ||
      !value.type ||
      !plainObject(value.config)
    )
      throw new Error('Each widget needs an ID, type, and configuration object.');
    if (ids.has(value.id)) throw new Error(`Duplicate widget ID: ${value.id}`);
    ids.add(value.id);
    for (const key of Object.keys(value))
      if (!allowedKeys.has(key)) throw new Error(`Unsupported widget property: ${key}`);
    if (value.childWidgets !== undefined && !Array.isArray(value.childWidgets))
      throw new Error('Widget children must be an array.');
    for (const child of (value.childWidgets ?? []) as unknown[]) visit(child, depth + 1);
    return value as CjsonNode;
  }
  return visit(parsed, 0);
}

export function serializePageDocument(root: CjsonNode): string {
  const content = JSON.stringify(root, null, 2) + '\n';
  parsePageDocument(content);
  return content;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
/** Wrap plain text in a heading or paragraph tag, escaping HTML and keeping line breaks. */
export function textHtml(text: string, tag: string = 'p') {
  return `<${tag}>${escapeHtml(text).replace(/\n/g, '<br>')}</${tag}>`;
}
export function safeSectionHref(value = '/') {
  let decoded = value;
  for (let pass = 0; pass < 3 && /%[0-9a-f]{2}/i.test(decoded); pass++) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      throw new Error('The button destination contains invalid URL encoding.');
    }
  }
  if (
    /[\\\x00-\x20\x7f]/.test(value) ||
    /[\\\x00-\x1f\x7f]/.test(decoded) ||
    /%[0-9a-f]{2}/i.test(decoded) ||
    decoded.startsWith('//')
  )
    throw new Error('Use an unambiguous page path or HTTPS URL for the button.');
  if (/^\/(?!\/)/.test(value) && decoded.startsWith('/')) return value;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch {
    /* Relative page paths and HTTPS links are the supported button destinations. */
  }
  throw new Error('Use a page path beginning with / or an HTTPS URL for the button.');
}
function createNode(
  type: string,
  title: string,
  config: Record<string, unknown> = {},
  children: CjsonNode[] = []
): CjsonNode {
  return {
    id: `${LOCAL_WIDGET_PREFIX}${type}-${crypto.randomUUID()}`,
    type,
    title,
    config,
    childWidgets: children,
  };
}
function textNode(title: string, text: string, tag: 'p' | 'h1' | 'h2' | 'h3' = 'p') {
  return createNode('text', title, { html: textHtml(text, tag) });
}
function buttonNode(options: SectionOptions) {
  return createNode('button', 'Call to action', {
    buttonText: escapeHtml(options.cta ?? 'Explore the collection'),
    buttonAction: 'URL Action',
    buttonUrlAction: safeSectionHref(options.href ?? '/shop/'),
    buttonStyleTheme: 'Rounded Button',
  });
}
function relink(root: CjsonNode, parent: CjsonNode | null, containerId: string) {
  if (parent) {
    root.parentWidgetId = parent.id;
    root.containerId = containerId;
  }
  for (const [index, child] of (root.childWidgets ?? []).entries()) {
    child.x = index;
    child.y = 0;
    relink(child, root, containerId);
  }
}

/** Patterns use the native section/row/column hierarchy and schema-defined config keys. */
export function createSection(pattern: SectionPattern, raw: SectionOptions = {}): CjsonNode {
  sectionPatternSchema.parse(pattern);
  const options = sectionOptionsSchema.parse(raw);
  const content: CjsonNode[] = [];
  let title: string;
  if (pattern === 'hero') {
    title = 'Hero';
    content.push(
      textNode('Eyebrow', options.eyebrow ?? 'A BETTER EVERYDAY'),
      textNode('Headline', options.title ?? 'Make room for what matters.', 'h1'),
      textNode(
        'Introduction',
        options.description ?? 'Introduce the offer and the reason it matters to your customer.'
      ),
      buttonNode(options)
    );
  } else if (pattern === 'cta') {
    title = 'Call to action';
    content.push(
      textNode('Headline', options.title ?? 'Find your next favorite.', 'h2'),
      textNode('Supporting copy', options.description ?? 'Give your customer a clear next step.'),
      buttonNode(options)
    );
  } else if (pattern === 'benefits') {
    title = 'Benefits';
    content.push(textNode('Headline', options.title ?? 'Thoughtfully made. Simply better.', 'h2'));
    if (options.description) content.push(textNode('Introduction', options.description));
    const cards = (
      options.items?.length
        ? options.items
        : [
            {
              title: 'Benefit one',
              description: 'Explain a specific customer benefit. Add verified details before publishing.',
            },
            {
              title: 'Benefit two',
              description: 'Connect a product feature to an outcome your customer values.',
            },
            {
              title: 'Benefit three',
              description: 'Use a clear, supportable reason to choose your product.',
            },
          ]
    ).map((item, index, items) =>
      createNode(
        'column',
        `Benefit ${index + 1}`,
        {
          gridColumnCountSmall: 12,
          gridColumnCountMedium: Math.max(1, Math.floor(12 / Math.min(items.length, 4))),
        },
        [textNode(item.title, item.title, 'h3'), textNode('Benefit detail', item.description)]
      )
    );
    content.push(createNode('row', 'Benefit cards', {}, cards));
  } else {
    title = 'Frequently asked questions';
    content.push(textNode('Headline', options.title ?? 'A few things worth knowing.', 'h2'));
    const items = options.items?.length
      ? options.items
      : [
          {
            title: 'Is this right for me?',
            description: 'Describe who the product is for using verified product information.',
          },
          { title: 'How do I use it?', description: 'Add the approved usage instructions for this product.' },
          {
            title: 'What should I know before ordering?',
            description: 'Add the current shipping and return details.',
          },
        ];
    content.push(
      createNode(
        'accordion',
        'Questions',
        { accordionAllowAllClosed: 'Yes' },
        items.map((item) =>
          createNode('accordionitem', item.title, { accordionItemTitle: escapeHtml(item.title) }, [
            textNode('Answer', item.description),
          ])
        )
      )
    );
  }
  const section = createNode('section', title, { paddingTop: 48, paddingBottom: 48 }, [
    createNode('row', `${title} layout`, {}, [
      createNode('column', `${title} content`, { gridColumnCountSmall: 12 }, content),
    ]),
  ]);
  relink(section, null, section.id);
  return section;
}

export function createPageDocument(sections: CjsonNode[]): CjsonNode {
  const root = createNode('container', 'Page body', {}, structuredClone(sections));
  relink(root, null, root.id);
  parsePageDocument(JSON.stringify(root));
  return root;
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (plainObject(value)) return Object.values(value).map(stringValue).find(Boolean) ?? '';
  return '';
}
export function widgetText(node: Pick<CjsonNode, 'config' | 'title' | 'type'>): string {
  for (const key of ['html', 'text', 'buttonText', 'label', 'accordionItemTitle', 'heading', 'title']) {
    const value = stringValue(node.config[key]);
    if (value)
      return value
        .replace(/<br\s*\/?\s*>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
  }
  return '';
}
function indexTree(root: CjsonNode) {
  const nodes = new Map<string, { node: CjsonNode; parent: CjsonNode | null; index: number }>();
  function visit(node: CjsonNode, parent: CjsonNode | null, index: number) {
    nodes.set(node.id, { node, parent, index });
    (node.childWidgets ?? []).forEach((child, i) => visit(child, node, i));
  }
  visit(root, null, 0);
  return nodes;
}
export function structureChanges(baseline: string, content: string): StructureChange[] {
  const before = indexTree(parsePageDocument(baseline));
  const after = indexTree(parsePageDocument(content));
  const previousOrder = new Map<string, number>();
  const currentOrder = new Map<string, number>();
  for (const [id, item] of after) {
    const old = before.get(id);
    if (!old) continue;
    const previousSiblings = (old.node.childWidgets ?? []).filter(
      (child) => after.get(child.id)?.parent?.id === id
    );
    const currentSiblings = (item.node.childWidgets ?? []).filter(
      (child) => before.get(child.id)?.parent?.id === id
    );
    previousSiblings.forEach((child, index) => previousOrder.set(child.id, index));
    currentSiblings.forEach((child, index) => currentOrder.set(child.id, index));
  }
  const result: StructureChange[] = [];
  for (const [id, item] of after) {
    const old = before.get(id);
    if (!old) result.push({ kind: 'added', id, label: item.node.title || item.node.type });
    else if (old.parent?.id !== item.parent?.id || previousOrder.get(id) !== currentOrder.get(id))
      result.push({ kind: 'moved', id, label: item.node.title || item.node.type });
  }
  for (const [id, item] of before)
    if (!after.has(id)) result.push({ kind: 'removed', id, label: item.node.title || item.node.type });
  return result;
}
export function inspectBuilderContent(content: string, baseline = content): BuilderInspection {
  const root = parsePageDocument(content);
  const localNodeIds: string[] = [];
  let nodeCount = 0;
  function visit(node: CjsonNode, pointer: string, parentId: string | null): BuilderNode {
    nodeCount++;
    const local = node.id.startsWith(LOCAL_WIDGET_PREFIX);
    if (local) localNodeIds.push(node.id);
    const children = (node.childWidgets ?? []).map((child, index) =>
      visit(child, `${pointer}/childWidgets/${index}`, node.id)
    );
    return {
      id: node.id,
      type: node.type,
      title: node.title || node.type,
      pointer,
      parentId,
      local,
      text: widgetText(node).slice(0, 4000),
      childCount: children.length,
      children,
    };
  }
  const tree = visit(root, '', null);
  return {
    root: tree,
    nodeCount,
    localNodeIds,
    structureChanges: structureChanges(baseline, content),
    issues: localNodeIds.length
      ? ['New widgets have local IDs. Reserve UltraCart IDs before remote preview or publishing.']
      : [],
  };
}

function idPattern(id: string) {
  return new RegExp(`(?<![A-Za-z0-9_-])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_-])`, 'g');
}
function rewriteReferences(value: unknown, map: Map<string, string>): unknown {
  if (typeof value === 'string') {
    for (const [from, to] of map) value = (value as string).replace(idPattern(from), to);
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => rewriteReferences(item, map));
  if (plainObject(value))
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, rewriteReferences(item, map)])
    );
  return value;
}
function hasReference(value: unknown, ids: Set<string>): boolean {
  if (typeof value === 'string') return [...ids].some((id) => idPattern(id).test(value));
  if (Array.isArray(value)) return value.some((item) => hasReference(item, ids));
  return plainObject(value) && Object.values(value).some((item) => hasReference(item, ids));
}
function reorder(parent: CjsonNode, rootId: string) {
  for (const [index, node] of parent.childWidgets.entries()) {
    node.x = index;
    node.y = 0;
    node.parentWidgetId = parent.id;
    node.containerId = rootId;
  }
}

export function applyBuilderOperation(content: string, raw: BuilderOperation): string {
  const operation = builderOperationSchema.parse(raw);
  const root = parsePageDocument(content);
  const nodes = indexTree(root);
  if (operation.kind === 'add') {
    const parent = nodes.get(operation.parentId)?.node;
    if (!parent || !['container', 'pagecontainer', 'section'].includes(parent.type))
      throw new Error('Add a section inside the page body or another section.');
    const children = parent.childWidgets ?? (parent.childWidgets = []);
    const after = operation.afterId
      ? children.findIndex((node) => node.id === operation.afterId)
      : children.length - 1;
    if (operation.afterId && after < 0) throw new Error('The insertion point is no longer in this section.');
    const section = createSection(operation.pattern, operation.options);
    relink(section, parent, root.id);
    children.splice(after + 1, 0, section);
    reorder(parent, root.id);
  } else {
    const item = nodes.get(operation.nodeId);
    if (!item?.parent) throw new Error('Choose a widget inside the page body. The root cannot be changed.');
    const siblings = item.parent.childWidgets;
    if (operation.kind === 'move') {
      const target = item.index + (operation.direction === 'up' ? -1 : 1);
      if (target < 0 || target >= siblings.length) return content;
      [siblings[item.index], siblings[target]] = [siblings[target], siblings[item.index]];
    } else if (operation.kind === 'duplicate') {
      const clone = structuredClone(item.node);
      const map = new Map(
        [...indexTree(clone).keys()].map((id) => [id, `${LOCAL_WIDGET_PREFIX}${crypto.randomUUID()}`])
      );
      const rewritten = rewriteReferences(clone, map) as CjsonNode;
      rewritten.title = `${item.node.title || item.node.type} copy`;
      relink(rewritten, item.parent, root.id);
      siblings.splice(item.index + 1, 0, rewritten);
    } else {
      const removed = new Set(indexTree(item.node).keys());
      for (const [id, entry] of nodes)
        if (!removed.has(id) && hasReference(entry.node.config, removed))
          throw new Error(
            'Another widget references this section. Remove that reference before deleting it.'
          );
      siblings.splice(item.index, 1);
    }
    reorder(item.parent, root.id);
  }
  return serializePageDocument(root);
}
