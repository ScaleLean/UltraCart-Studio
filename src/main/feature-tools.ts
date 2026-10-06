import { Type } from '@earendil-works/pi-ai';
import { defineTool } from '@earendil-works/pi-durable';
import type { Session } from '../shared/types';
import type { BuilderNode, CjsonNode } from '../shared/page-builder';
import { sameStore } from '../shared/storefront';
import { WAREHOUSE_DEFAULT_BYTES, WAREHOUSE_MAX_BYTES, WAREHOUSE_MIN_BYTES } from '../shared/warehouse';
import type { StudioServices } from './services';
import type { PageBuilderService } from './page-builder';
import type { LandingService } from './landing';
import type { WarehouseService } from './warehouse';

export type AgentFeatures = {
  builder: PageBuilderService;
  landing: LandingService;
  warehouse: WarehouseService;
};
const closed = <T extends Parameters<typeof Type.Object>[0]>(fields: T) =>
  Type.Object(fields, { additionalProperties: false });
const result = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data) }] });
const nodeId = Type.String({ minLength: 1, maxLength: 256 });
const revision = Type.Integer({ minimum: 1 });
const operation = Type.Union([
  closed({
    kind: Type.Literal('add'),
    pattern: Type.Union(['hero', 'benefits', 'faq', 'cta'].map((name) => Type.Literal(name))),
    parentId: nodeId,
    afterId: Type.Optional(nodeId),
    options: Type.Optional(
      closed({
        title: Type.Optional(Type.String({ maxLength: 300 })),
        description: Type.Optional(Type.String({ maxLength: 4000 })),
        eyebrow: Type.Optional(Type.String({ maxLength: 150 })),
        cta: Type.Optional(Type.String({ maxLength: 150 })),
        href: Type.Optional(Type.String({ maxLength: 2048 })),
        items: Type.Optional(
          Type.Array(
            closed({
              title: Type.String({ maxLength: 300 }),
              description: Type.String({ maxLength: 4000 }),
            }),
            { maxItems: 8 }
          )
        ),
      })
    ),
  }),
  closed({ kind: Type.Literal('duplicate'), nodeId }),
  closed({
    kind: Type.Literal('move'),
    nodeId,
    direction: Type.Union([Type.Literal('up'), Type.Literal('down')]),
  }),
  closed({ kind: Type.Literal('remove'), nodeId }),
]);

export function featureTools(
  services: StudioServices,
  features: AgentFeatures | undefined,
  session: Session
) {
  if (!features) return [];
  const guard = () => {
    const workspace = services.workspace();
    if (workspace.id !== session.workspaceId || !sameStore(workspace.selection, session.scope.selection))
      throw new Error(
        'The active storefront changed. Return to this conversation’s storefront before continuing.'
      );
    return { workspaceId: session.workspaceId };
  };
  if (session.target?.kind === 'landing') {
    const id = session.target.projectId;
    const target = () => ({ ...guard(), id });
    const summary = () => {
      target();
      const project = features.landing.read(id);
      return {
        id,
        revision: project.revision,
        rootId: project.rootId,
        brief: project.brief,
        sectionCount: project.sections.length,
        localOnly: true,
      };
    };
    return [
      defineTool({
        name: 'landing_read_project',
        description:
          'Read this local landing draft, its brief, section IDs, and editable fields. Pagination is by node. Supply nodeId to read one full node when a field is truncated. Read the current revision before editing.',
        parameters: closed({
          offset: Type.Optional(Type.Integer({ minimum: 0, maximum: 500 })),
          nodeId: Type.Optional(nodeId),
        }),
        replay: 'safe',
        execute: async ({ offset = 0, nodeId }) => {
          target();
          const project = features.landing.read(id);
          const nodes: CjsonNode[] = [];
          const visit = (node: CjsonNode) => {
            nodes.push(node);
            node.childWidgets.forEach(visit);
          };
          project.sections.forEach(visit);
          const page = nodeId ? nodes.filter((node) => node.id === nodeId) : nodes.slice(offset, offset + 25);
          return result({
            ...summary(),
            archived: !!project.archivedAt,
            totalNodes: nodes.length,
            sections: project.sections.map((section) => ({ id: section.id, title: section.title })),
            nextOffset: !nodeId && offset + 25 < nodes.length ? offset + 25 : null,
            nodes: page.map((node) => ({
              id: node.id,
              type: node.type,
              parentId: node.parentWidgetId,
              childIds: node.childWidgets.map((child) => child.id),
              fields: Object.entries({ title: node.title, ...node.config })
                .filter(
                  ([key, value]) =>
                    ['title', 'html', 'buttonText', 'buttonUrlAction', 'accordionItemTitle'].includes(key) &&
                    typeof value === 'string'
                )
                .map(([key, value]) => ({
                  key,
                  value: nodeId ? value : String(value).slice(0, 2000),
                  truncated: !nodeId && String(value).length > 2000,
                })),
            })),
          });
        },
      }),
      defineTool({
        name: 'landing_save_fields',
        description:
          'Edit fields in this local landing draft using the current revision and exact node IDs. Use text for plain text or html for simple headings/paragraphs/lists. Does not create a live page.',
        parameters: closed({
          revision,
          edits: Type.Array(
            closed({
              nodeId,
              key: Type.Union(
                ['title', 'text', 'html', 'buttonText', 'buttonUrlAction', 'accordionItemTitle'].map((key) =>
                  Type.Literal(key)
                )
              ),
              value: Type.String({ maxLength: 4000 }),
            }),
            { minItems: 1, maxItems: 100 }
          ),
        }),
        replay: 'unsafe',
        executionMode: 'sequential',
        execute: async ({ revision, edits }) => {
          features.landing.patchFields({ ...target(), revision, edits });
          return result(summary());
        },
      }),
      defineTool({
        name: 'landing_edit_sections',
        description:
          'Add a hero, benefits, FAQ, or CTA section; duplicate, move, or remove a section. New sections use rootId as parentId. Changes stay in this local landing draft.',
        parameters: closed({ revision, operation }),
        replay: 'unsafe',
        executionMode: 'sequential',
        execute: async ({ revision, operation }) => {
          features.landing.operate({ ...target(), revision, operation });
          return result(summary());
        },
      }),
      defineTool({
        name: 'landing_update_brief',
        description:
          'Update the brief for this local landing draft. The page path stays pinned. This changes the brief, not the section text.',
        parameters: closed({
          revision,
          title: Type.Optional(Type.String({ minLength: 1, maxLength: 160 })),
          audience: Type.Optional(Type.String({ minLength: 1, maxLength: 2000 })),
          offer: Type.Optional(Type.String({ minLength: 1, maxLength: 3000 })),
          goal: Type.Optional(Type.String({ minLength: 1, maxLength: 2000 })),
          brandConstraints: Type.Optional(Type.String({ maxLength: 4000 })),
        }),
        replay: 'unsafe',
        executionMode: 'sequential',
        execute: async ({ revision, title, audience, offer, goal, brandConstraints }) => {
          const scope = target();
          const project = features.landing.read(id);
          features.landing.update({
            ...scope,
            revision,
            brief: {
              ...project.brief,
              ...(title === undefined ? {} : { title }),
              ...(audience === undefined ? {} : { audience }),
              ...(offer === undefined ? {} : { offer }),
              ...(goal === undefined ? {} : { goal }),
              ...(brandConstraints === undefined ? {} : { brandConstraints }),
            },
          });
          return result(summary());
        },
      }),
      defineTool({
        name: 'landing_check_readiness',
        description:
          'Check this local landing draft against the cached catalog and explain the remaining requirements for live creation. This is not native theme or remote validation.',
        parameters: closed({}),
        replay: 'safe',
        execute: async () => {
          target();
          return result(features.landing.readiness(id));
        },
      }),
    ];
  }
  if (session.target?.kind === 'warehouse')
    return [
      defineTool({
        name: 'warehouse_status',
        description:
          'Read the pinned storefront’s warehouse status and saved SQL. Does not run a query. Sample data is synthetic.',
        parameters: closed({}),
        replay: 'safe',
        execute: async () => {
          const { config, history, ...status } = features.warehouse.status(guard());
          return result({ ...status, maxBytes: config.maxBytes, history: history.slice(0, 10) });
        },
      }),
      defineTool({
        name: 'warehouse_list_tables',
        description:
          'Read actual table metadata for the selected merchant warehouse. Does not read table rows. Paginated in groups of 50.',
        parameters: closed({ offset: Type.Optional(Type.Integer({ minimum: 0, maximum: 10000 })) }),
        replay: 'safe',
        execute: async ({ offset = 0 }) => {
          const tables = await features.warehouse.tables(guard());
          guard();
          return result({ total: tables.length, tables: tables.slice(offset, offset + 50) });
        },
      }),
      defineTool({
        name: 'warehouse_read_schema',
        description: 'Read actual field names and types before drafting SQL. Does not read table rows.',
        parameters: closed({ table: Type.String({ minLength: 1, maxLength: 256 }) }),
        replay: 'safe',
        execute: async ({ table }) => {
          const schema = await features.warehouse.schema({ ...guard(), table });
          guard();
          return result(schema);
        },
      }),
      defineTool({
        name: 'warehouse_save_query',
        description:
          'Save a SELECT query locally for the user to inspect. The user must click Dry run and Run in the warehouse UI. This tool cannot execute SQL. Use only verified schema names and the selected merchant’s project/dataset.',
        parameters: closed({
          name: Type.String({ minLength: 1, maxLength: 80 }),
          sql: Type.String({ minLength: 1, maxLength: 20000 }),
          rowLimit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
          maxBytes: Type.Optional(Type.Integer({ minimum: WAREHOUSE_MIN_BYTES, maximum: WAREHOUSE_MAX_BYTES })),
        }),
        replay: 'unsafe',
        executionMode: 'sequential',
        execute: async ({ name, sql, rowLimit = 100, maxBytes = WAREHOUSE_DEFAULT_BYTES }) =>
          result(features.warehouse.save({ ...guard(), name, sql, rowLimit, maxBytes })),
      }),
    ];
  return [
    defineTool({
      name: 'storefront_content_map',
      description:
        'Inspect the pinned page template, reachable shared containers, and page-owned slots. Read-only. Conditional includes can be listed even when not visible; inspect the reported limits. This does not change the conversation slot.',
      parameters: closed({}),
      replay: 'safe',
      execute: async () => {
        guard();
        const map = await services.contentMap(session.scope);
        guard();
        return result(map);
      },
    }),
    defineTool({
      name: 'storefront_inspect_structure',
      description:
        'Read the native selected-slot hierarchy, node IDs, revision, and local structural changes. Pull the draft first. The tree is paginated in groups of 50 nodes.',
      parameters: closed({ offset: Type.Optional(Type.Integer({ minimum: 0, maximum: 10000 })) }),
      replay: 'safe',
      execute: async ({ offset = 0 }) => {
        guard();
        const view = features.builder.inspect(session.scope);
        if (!view) return result({ message: 'Pull the page draft first.' });
        const nodes: BuilderNode[] = [];
        const visit = (node: BuilderNode) => {
          nodes.push(node);
          node.children.forEach(visit);
        };
        visit(view.root);
        return result({
          id: view.draft.id,
          revision: view.draft.revision,
          rootId: view.root.id,
          totalNodes: nodes.length,
          localNodeCount: view.localNodeIds.length,
          issues: view.issues,
          structureChanges: view.structureChanges,
          nodes: nodes
            .slice(offset, offset + 50)
            .map(({ children, ...node }) => ({ ...node, text: node.text.slice(0, 500) })),
        });
      },
    }),
    defineTool({
      name: 'storefront_edit_structure',
      description:
        'Change this page’s local native selected-slot structure with exact node IDs and the current revision. Add hero, benefits, FAQ, or CTA patterns; duplicate, reorder, or remove nodes. New local IDs prevent native preview and publishing until merchant IDs are reserved. Does not edit theme code.',
      parameters: closed({ id: Type.String(), revision, operation }),
      replay: 'unsafe',
      executionMode: 'sequential',
      execute: async ({ id, revision, operation }) => {
        guard();
        const view = await features.builder.apply({ ...session.scope, id, revision, operation });
        guard();
        return result({
          id: view.draft.id,
          revision: view.draft.revision,
          structureChanges: view.structureChanges,
          localNodeCount: view.localNodeIds.length,
          issues: view.issues,
        });
      },
    }),
  ];
}

export function featureInstructions(session: Session) {
  if (session.target?.kind === 'landing')
    return [
      'Work on the pinned local landing project. Read its brief and actual nodes, then make concrete section and copy improvements with the landing tools.',
      'Read the current revision before each save. Preserve the supplied offer and brand constraints. Never invent product claims, discounts, testimonials, guarantees, or policies. Keep unresolved facts as clear placeholders.',
      'The project is a local draft with an approximate preview. You cannot create a live page, reserve merchant IDs, publish, or verify native theme rendering. After edits, check readiness and report unresolved requirements.',
    ];
  if (session.target?.kind === 'warehouse')
    return [
      'Help the user investigate the pinned merchant warehouse. Read status, table metadata, and actual schemas before writing SQL. Never invent table or field names.',
      'You can save SELECT queries locally. You cannot run a query or dry run. The user inspects saved SQL and uses Dry run and Run in the warehouse screen. Do not claim query results or performance findings from schemas alone.',
      'Use only the selected project and ultracart_dw dataset. Apply explicit date filters when the schema supports them and keep the scan limit small. Sample schemas and sample results are synthetic, not merchant evidence.',
    ];
  return [
    'Inspect the pinned page before editing. Use the available tools for requested work. Read native selected-slot structure before adding, duplicating, reordering, or removing sections. Use exact IDs and the current draft revision.',
    'You can edit existing text fields and local native selected-slot structure. You cannot edit theme code, reserve merchant widget IDs, publish, or open a visual preview. New local widget IDs block native preview and publishing until those IDs are reserved. The user has separate Preview and Publish controls.',
    'The selected slot may not supply the content visible on a themed page. Use storefront_content_map and read the resolved template when requested content is absent. Your slot is pinned for this conversation; ask the user to select another discovered slot in the Content view if needed. Do not change unrelated body fields as a substitute for inaccessible theme content. Template reads do not expand included files.',
    'After saving, review the exact saved revision. Report what changed and any validation issues. A schema check is not a visual rendering check. Never say local changes are live.',
  ];
}
