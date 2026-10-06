import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import {
  applyBuilderOperation,
  builderOperationSchema,
  createPageDocument,
  createSection,
  parsePageDocument,
  serializePageDocument,
} from '../shared/page-builder';
import {
  landingBriefSchema,
  landingParentPath,
  landingTargetSchema,
  landingTemplateNameSchema,
  parseLandingTemplates,
  validateLandingSections,
  type LandingBrief,
  type LandingProject,
  type LandingPreparation,
  type LandingReadiness,
  type LandingRevision,
} from '../shared/landing';
import { sameStore } from '../shared/storefront';
import type { StudioServices } from './services';
import { parseDraftValidation } from './domain/draft-service';
import { WidgetIdsService } from './widget-ids';
import type { WidgetIdReceipt } from '../shared/widget-ids';

type PreparationRecord = { view: LandingPreparation; content: string; receipt: WidgetIdReceipt | null };
const digest = (content: string) => createHash('sha256').update(content).digest('hex');
const preparationKey = (id: string) => `landing-preparation:${id}`;
const remainingSteps = [
  'Review the offer, claims, imagery, and every button destination. The starter includes placeholder copy.',
  'Inspect the selected group template and confirm it renders the page body slot. Visual-builder metadata alone does not prove that slot is present.',
  'Recheck the exact parent and unused path immediately before creation. UltraCart’s catalog list is cached and page metadata writes have no revision guard.',
  'Use a separately reviewed live workflow to create the catalog page and push this exact body. New-page preview behavior has not been verified, so Studio does not perform these writes.',
  'Read back the saved page settings and body, then verify desktop/mobile rendering and native editability. This package is not proof of publication.',
];

export class LandingService {
  private preparationBusy = new Set<string>();
  private widgetIds: Pick<WidgetIdsService, 'inspect' | 'reserve'>;
  private customWidgetIds: boolean;
  constructor(
    readonly services: StudioServices,
    widgetIds?: Pick<WidgetIdsService, 'inspect' | 'reserve'>
  ) {
    this.customWidgetIds = !!widgetIds;
    this.widgetIds = widgetIds ?? new WidgetIdsService(services);
    services.store.db.exec(
      'CREATE TABLE IF NOT EXISTS landing_projects (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, path_key TEXT NOT NULL, revision INTEGER NOT NULL, archived INTEGER NOT NULL DEFAULT 0, value TEXT NOT NULL)'
    );
    services.store.db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS landing_active_path ON landing_projects(workspace_id, path_key) WHERE archived = 0'
    );
    services.store.db.exec(
      'CREATE TABLE IF NOT EXISTS landing_revisions (project_id TEXT NOT NULL, revision INTEGER NOT NULL, value TEXT NOT NULL, PRIMARY KEY(project_id, revision))'
    );
  }
  private source(project: LandingProject) {
    return serializePageDocument(this.document(project));
  }
  private preparationRecord(project: LandingProject) {
    const record = this.services.store.get<PreparationRecord | null>(preparationKey(project.id), null);
    if (!record) return null;
    if (
      record.view.workspaceId !== project.workspaceId ||
      !sameStore(record.view.selection, project.selection)
    )
      throw new Error('This preparation belongs to another storefront.');
    if (digest(record.content) !== record.view.contentHash)
      throw new Error('The saved preparation is damaged. Prepare this draft again.');
    return record;
  }
  preparation(input: unknown): LandingPreparation | null {
    const value = z.object({ id: z.string().uuid() }).strict().parse(input);
    const project = this.read(value.id);
    const record = this.preparationRecord(project);
    if (!record) return null;
    const stale =
      !!project.archivedAt ||
      record.view.revision !== project.revision ||
      record.view.sourceHash !== digest(this.source(project));
    return {
      ...record.view,
      stale,
      blockers: stale
        ? [
            'The draft changed. Prepare the current revision before using this package.',
            ...record.view.blockers,
          ]
        : record.view.blockers,
    };
  }
  private persistPreparation(project: LandingProject, record: PreparationRecord) {
    this.target({ workspaceId: project.workspaceId, id: project.id, revision: project.revision });
    this.services.store.set(preparationKey(project.id), record);
    this.services.emit();
    return record.view;
  }
  private blockers(view: LandingPreparation) {
    return [
      ...(view.sample
        ? [
            'The sample workspace cannot verify merchant templates or reserve native IDs. Connect a storefront to prepare a live package.',
          ]
        : []),
      ...(!view.parent ? [`The parent ${view.parentPath} has not been verified by a direct page read.`] : []),
      ...(!view.pathAvailable
        ? ['The proposed path is already present in the catalog. Choose another path.']
        : []),
      ...(!view.groupTemplate ? ['Choose a group template with known visual-builder support.'] : []),
      ...(!view.itemTemplate ? ['Choose an item template from the active theme.'] : []),
      ...(view.nativeIds.status !== 'reserved'
        ? ['Native widget IDs have not been reserved. The editable draft still uses local placeholders.']
        : []),
      ...(view.validation.status !== 'passed' ? [view.validation.message] : []),
    ];
  }
  private async validatePrepared(content: string): Promise<LandingPreparation['validation']> {
    const directory = await mkdtemp(join(tmpdir(), 'studio-landing-validate-'));
    try {
      const document = parsePageDocument(content);
      const operations: unknown[] = [];
      const visit = (node: typeof document) => {
        const set = Object.fromEntries(
          Object.entries(node.config).map(([key, value]) => [
            `/config/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`,
            value,
          ])
        );
        if (Object.keys(set).length) operations.push({ op: 'update', target: `#${node.id}`, set });
        node.childWidgets.forEach(visit);
      };
      visit(document);
      const file = join(directory, 'body.cjson');
      const plan = join(directory, 'authored-keys.json');
      await writeFile(file, content, { mode: 0o600 });
      await writeFile(plan, JSON.stringify({ formatVersion: 1, operations }), { mode: 0o600 });
      const raw = JSON.parse(
        await this.services.connection.run(
          ['--format', 'json', 'cjson', 'apply', file, '--plan', plan, '--dry-run', '--full'],
          { acceptedExitCodes: [0, 2] }
        )
      );
      const successfulReceipt = raw.action === 'apply' && raw.dryRun === true && raw.written === false;
      const report = parseDraftValidation(JSON.stringify(successfulReceipt ? raw.validation : raw));
      if (report.valid && (!successfulReceipt || !isDeepStrictEqual(raw.document, document)))
        throw new Error(
          'The toolkit changed the authored values during validation. Review those values before export.'
        );
      const passed = report.valid && report.errors === 0;
      return {
        status: passed ? 'passed' : 'failed',
        authoredKeys: true,
        checkedAt: new Date().toISOString(),
        report,
        message: passed
          ? 'The exact native document passed local authored-key validation. Live rendering and server acceptance remain unverified.'
          : `The native document has ${report.errors} validation error(s). Fix them before using the package.`,
      };
    } catch (error) {
      return {
        status: 'unavailable',
        authoredKeys: false,
        checkedAt: null,
        report: null,
        message:
          error instanceof Error ? error.message : 'Local authored-key validation could not be completed.',
      };
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
  async prepare(input: unknown): Promise<LandingPreparation> {
    const value = landingTargetSchema
      .extend({
        groupTemplate: landingTemplateNameSchema.optional(),
        itemTemplate: landingTemplateNameSchema.optional(),
      })
      .strict()
      .parse(input);
    const scope = { workspaceId: value.workspaceId, id: value.id, revision: value.revision };
    const project = this.target(scope);
    if (this.preparationBusy.has(project.id)) throw new Error('This landing preparation is already running.');
    this.preparationBusy.add(project.id);
    try {
      const guard = () => this.target(scope);
      const source = this.source(project);
      const sourceHash = digest(source);
      const saved = this.preparationRecord(project);
      const previous =
        saved?.view.revision === project.revision && saved.view.sourceHash === sourceHash ? saved : null;
      const sample = this.services.workspace().kind === 'sample';
      let pages = this.services.pages();
      let parent = null;
      let templates: LandingPreparation['templates'] = [];
      let themeId: number | null = null;
      const parentPath = landingParentPath(project.brief.path);
      if (!sample) {
        const storefront = await this.services.connection.verify(project.selection);
        guard();
        if (!storefront.themeId || storefront.themeId !== project.selection.storefront.themeId)
          throw new Error(
            'The active theme changed or is unavailable. Reconnect the storefront before preparation.'
          );
        themeId = storefront.themeId;
        pages = await this.services.connection.pages(project.selection);
        guard();
        const result = await this.services.connection.run([
          '--format',
          'json',
          '--profile',
          project.selection.profileId,
          'sf',
          'pages',
          'templates',
          '--storefront',
          String(project.selection.storefront.id),
        ]);
        guard();
        let parsed: unknown;
        try {
          parsed = JSON.parse(result);
        } catch {
          throw new Error('The toolkit returned an unreadable template list. Refresh and try again.');
        }
        templates = parseLandingTemplates(parsed, project.selection.storefront.id, themeId);
        if (pages.some((page) => page.path === parentPath && page.catalogCopies === 1)) {
          parent = await this.services.connection.page(project.selection, parentPath);
          guard();
        }
        const currentStorefront = await this.services.connection.verify(project.selection);
        guard();
        if (currentStorefront.themeId !== themeId)
          throw new Error('The active theme changed during preparation. Refresh and try again.');
        this.services.store.set(`pages:${project.workspaceId}`, pages);
        this.services.store.set(`fetched:${project.workspaceId}`, new Date().toISOString());
      }
      const choose = (name: string | undefined, type: 'group' | 'item') => {
        if (!name) return null;
        const template = templates.find((item) => item.name === name);
        if (
          !template ||
          template.system ||
          !template.metadataAvailable ||
          template.pageType !== type ||
          (type === 'group' && template.visualBuilder !== true)
        )
          throw new Error(
            `Choose a ${type} template with verified capability metadata from this active theme.`
          );
        return name;
      };
      const groupTemplate = choose(value.groupTemplate ?? previous?.view.groupTemplate ?? undefined, 'group');
      const itemTemplate = choose(value.itemTemplate ?? previous?.view.itemTemplate ?? undefined, 'item');
      const content = previous?.receipt?.status === 'complete' ? previous.content : source;
      const validation = await this.validatePrepared(content);
      guard();
      const plan = this.widgetIds.inspect({
        selection: project.selection,
        content: source,
        operationKey: `landing:${project.id}:${project.revision}`,
      });
      const view: LandingPreparation = {
        projectId: project.id,
        workspaceId: project.workspaceId,
        revision: project.revision,
        selection: project.selection,
        sourceHash,
        contentHash: digest(content),
        preparedAt: new Date().toISOString(),
        stale: false,
        sample,
        parentPath,
        parent,
        pathAvailable: !pages.some((page) => page.path.toLowerCase() === project.brief.path.toLowerCase()),
        catalogCheckedAt: sample ? null : new Date().toISOString(),
        themeId,
        templates,
        groupTemplate,
        itemTemplate,
        nativeIds: {
          status: previous?.receipt?.status === 'complete' ? 'reserved' : 'local',
          count: plan.count,
          receiptId: previous?.receipt?.id ?? null,
        },
        validation,
        blockers: [],
        remainingSteps,
        liveVerified: false,
      };
      view.blockers = this.blockers(view);
      return this.persistPreparation(project, { view, content, receipt: previous?.receipt ?? null });
    } finally {
      this.preparationBusy.delete(project.id);
    }
  }
  async reserveNativeIds(input: unknown): Promise<LandingPreparation> {
    const value = landingTargetSchema
      .extend({ confirmedHost: z.string().min(1).max(253) })
      .strict()
      .parse(input);
    const scope = { workspaceId: value.workspaceId, id: value.id, revision: value.revision };
    const project = this.target(scope);
    if (value.confirmedHost !== project.selection.storefront.host)
      throw new Error('Confirm the exact storefront host before reserving native IDs.');
    if (this.preparationBusy.has(project.id)) throw new Error('This landing preparation is already running.');
    const record = this.preparationRecord(project);
    if (!record || this.preparation({ id: project.id })?.stale)
      throw new Error('Prepare this revision before reserving native IDs.');
    if (
      record.view.sample ||
      !record.view.parent ||
      !record.view.pathAvailable ||
      !record.view.groupTemplate ||
      !record.view.itemTemplate ||
      record.view.validation.status !== 'passed'
    )
      throw new Error(
        'Verify the parent, path, templates, and local validation before reserving native IDs.'
      );
    if (!record.view.catalogCheckedAt || Date.now() - Date.parse(record.view.catalogCheckedAt) > 15 * 60_000)
      throw new Error(
        'The preparation is over 15 minutes old. Refresh its catalog and templates before reserving IDs.'
      );
    this.preparationBusy.add(project.id);
    try {
      const ids = this.customWidgetIds
        ? this.widgetIds
        : new WidgetIdsService(this.services, {
            assertCurrent: () => {
              this.target(scope);
            },
          });
      const result = await ids.reserve({
        selection: project.selection,
        content: this.source(project),
        operationKey: `landing:${project.id}:${project.revision}`,
        confirmedHost: value.confirmedHost,
      });
      if (
        result.receipt.status !== 'complete' ||
        result.receipt.contentHash !== record.view.sourceHash ||
        result.receipt.preparedHash !== digest(result.content) ||
        !sameStore(result.receipt.selection, project.selection)
      )
        throw new Error('Native ID allocation did not return a complete receipt for this exact draft.');
      record.content = result.content;
      record.receipt = result.receipt;
      record.view.contentHash = digest(result.content);
      record.view.nativeIds = {
        status: 'reserved',
        count: result.receipt.count,
        receiptId: result.receipt.id,
      };
      record.view.validation = {
        ...record.view.validation,
        status: 'unavailable',
        checkedAt: null,
        report: null,
        message: 'Native IDs were reserved. Prepare again to validate the prepared body.',
      };
      record.view.blockers = this.blockers(record.view);
      // Keep the allocated IDs with the preparation even if the draft changed during allocation.
      this.services.store.set(preparationKey(project.id), record);
      this.target(scope);
      record.view.validation = await this.validatePrepared(result.content);
      this.target(scope);
      record.view.preparedAt = new Date().toISOString();
      record.view.blockers = this.blockers(record.view);
      return this.persistPreparation(project, record);
    } finally {
      this.preparationBusy.delete(project.id);
    }
  }
  prepareExport(input: unknown): { filename: string; content: string } {
    const project = this.target(input);
    const record = this.preparationRecord(project);
    if (!record || this.preparation({ id: project.id })?.stale)
      throw new Error('Prepare the current revision before exporting its review package.');
    return {
      filename: `${project.brief.path.split('/').filter(Boolean).join('-')}.prepared.studio.json`,
      content: JSON.stringify(
        {
          format: 'ultracart-studio-landing',
          version: 2,
          manifest: {
            ...record.view,
            status: 'prepared-for-review',
            path: project.brief.path,
            destination: `${project.brief.path}body.cjson`,
            pageType: 'S',
            excludeFromSitemap: true,
            published: false,
          },
          brief: project.brief,
          nativeIdReceipt: record.receipt ? { ...record.receipt, preparedContent: undefined } : null,
          files: [{ path: 'body.cjson', content: record.content }],
        },
        null,
        2
      ),
    };
  }
  private current(workspaceId: string) {
    const workspace = this.services.workspace();
    if (workspace.id !== workspaceId)
      throw new Error('The active storefront changed. Reopen this landing project.');
    return workspace;
  }
  private available(path: string, exceptId?: string) {
    const workspace = this.services.workspace();
    const key = path.toLowerCase();
    if (this.services.pages(workspace).some((page) => page.path.toLowerCase() === key))
      throw new Error('This path already exists in the storefront catalog. Choose another path.');
    const row = this.services.store.db
      .prepare('SELECT id FROM landing_projects WHERE workspace_id = ? AND path_key = ? AND archived = 0')
      .get(workspace.id, key);
    if (row && row.id !== exceptId) throw new Error('Another local landing project already uses this path.');
  }
  list(): LandingProject[] {
    return this.services.store.db
      .prepare(
        "SELECT value FROM landing_projects WHERE workspace_id = ? AND archived = 0 ORDER BY json_extract(value, '$.updatedAt') DESC"
      )
      .all(this.services.workspace().id)
      .map((row) => JSON.parse(row.value as string) as LandingProject);
  }
  read(id: string): LandingProject {
    z.string().uuid().parse(id);
    const workspace = this.services.workspace();
    const row = this.services.store.db
      .prepare('SELECT value FROM landing_projects WHERE id = ? AND workspace_id = ?')
      .get(id, workspace.id);
    if (!row) throw new Error('Landing project not found in this storefront.');
    const project = JSON.parse(row.value as string) as LandingProject;
    if (!sameStore(project.selection, workspace.selection))
      throw new Error('Landing project belongs to another merchant or storefront.');
    return project;
  }
  readiness(id: string): LandingReadiness {
    const project = this.read(id);
    const parentPath = landingParentPath(project.brief.path);
    const pages = this.services.pages();
    const parentExists = pages.some((page) => page.path === parentPath);
    const pathAvailableInCachedCatalog = !pages.some(
      (page) => page.path.toLowerCase() === project.brief.path.toLowerCase()
    );
    return {
      parentPath,
      parentExists,
      pathAvailableInCachedCatalog,
      messages: [
        'The draft is stored in Studio’s local database. Its preview is an approximation, not the live theme.',
        ...(parentExists
          ? []
          : [`The parent ${parentPath} is not in the cached catalog and must exist before remote creation.`]),
        ...(pathAvailableInCachedCatalog
          ? []
          : ['This path now exists in the cached catalog. Choose another path before export.']),
        'Before a live create: refresh the catalog, choose both theme templates, reserve native IDs, and validate the CJSON with the toolkit.',
        'Remote page creation changes the live catalog. This workspace does not perform that action.',
      ],
    };
  }
  private starter(brief: LandingBrief) {
    return validateLandingSections([
      createSection('hero', {
        title: brief.title,
        eyebrow: 'A NEW CHAPTER',
        description: brief.offer,
        cta: 'Explore the offer',
        href: '/',
      }),
      createSection('benefits', {
        title: 'Made for your everyday',
        description: brief.audience,
        items: [
          { title: 'What makes it different', description: 'Add one specific, verified product benefit.' },
          { title: 'How it fits your routine', description: 'Explain how your customer can use the offer.' },
          { title: 'What is included', description: 'List the exact products, terms, or services included.' },
        ],
      }),
      createSection('faq', {
        title: 'A few useful details',
        items: [
          { title: 'Who is this for?', description: brief.audience },
          {
            title: 'What should I know before ordering?',
            description: 'Add verified delivery, returns, and offer terms.',
          },
        ],
      }),
      createSection('cta', {
        title: 'Take the next step',
        description: brief.goal,
        cta: 'Explore the offer',
        href: '/',
      }),
    ]);
  }
  create(input: unknown): LandingProject {
    const value = z.object({ workspaceId: z.string(), brief: landingBriefSchema }).strict().parse(input);
    const workspace = this.current(value.workspaceId);
    this.available(value.brief.path);
    const now = new Date().toISOString();
    const project: LandingProject = {
      id: randomUUID(),
      workspaceId: workspace.id,
      selection: workspace.selection,
      rootId: `studio-local-${randomUUID()}`,
      brief: value.brief,
      sections: this.starter(value.brief),
      revision: 1,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      origin: 'starter',
      note: 'Created from the structured starter. Copy placeholders need review.',
    };
    const db = this.services.store.db;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(
        'INSERT INTO landing_projects (id, workspace_id, path_key, revision, value) VALUES (?, ?, ?, ?, ?)'
      ).run(project.id, project.workspaceId, project.brief.path.toLowerCase(), 1, JSON.stringify(project));
      this.remember(project);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    this.services.store.log(workspace.id, 'draft', 'Landing project created', value.brief.path);
    this.services.emit();
    return project;
  }
  private remember(project: LandingProject) {
    this.services.store.db
      .prepare('INSERT INTO landing_revisions (project_id, revision, value) VALUES (?, ?, ?)')
      .run(project.id, project.revision, JSON.stringify(project));
  }
  private save(previous: LandingProject, project: LandingProject) {
    const db = this.services.store.db;
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = db
        .prepare(
          'UPDATE landing_projects SET path_key = ?, revision = ?, archived = ?, value = ? WHERE id = ? AND workspace_id = ? AND revision = ?'
        )
        .run(
          project.brief.path.toLowerCase(),
          project.revision,
          project.archivedAt ? 1 : 0,
          JSON.stringify(project),
          project.id,
          project.workspaceId,
          previous.revision
        );
      if (result.changes !== 1)
        throw new Error('This project changed in another window. Reload it before saving.');
      this.remember(project);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    this.services.emit();
    return project;
  }
  private target(input: unknown, allowArchived = false) {
    const value = landingTargetSchema.parse(input);
    this.current(value.workspaceId);
    const project = this.read(value.id);
    if (project.revision !== value.revision)
      throw new Error('This project changed in another window. Reload it before saving.');
    if (project.archivedAt && !allowArchived) throw new Error('This landing project is archived.');
    return project;
  }
  update(input: unknown): LandingProject {
    const value = landingTargetSchema
      .extend({ brief: landingBriefSchema.optional(), sections: z.unknown().optional() })
      .strict()
      .parse(input);
    const previous = this.target({ workspaceId: value.workspaceId, id: value.id, revision: value.revision });
    const brief = value.brief ?? previous.brief;
    this.available(brief.path, previous.id);
    const sections =
      value.sections === undefined ? previous.sections : validateLandingSections(value.sections);
    return this.save(previous, {
      ...previous,
      brief,
      sections,
      revision: previous.revision + 1,
      updatedAt: new Date().toISOString(),
      note: 'Edited the local landing draft.',
    });
  }
  patchFields(input: unknown): LandingProject {
    const value = landingTargetSchema
      .extend({
        edits: z
          .array(
            z
              .object({
                nodeId: z.string().min(1).max(256),
                key: z.enum(['title', 'text', 'html', 'buttonText', 'buttonUrlAction', 'accordionItemTitle']),
                value: z.string().max(4000),
              })
              .strict()
          )
          .min(1)
          .max(100),
      })
      .strict()
      .parse(input);
    const previous = this.target({ workspaceId: value.workspaceId, id: value.id, revision: value.revision });
    const sections = structuredClone(previous.sections);
    const nodes = new Map<string, (typeof sections)[number]>();
    const visit = (node: (typeof sections)[number]) => {
      nodes.set(node.id, node);
      node.childWidgets.forEach(visit);
    };
    sections.forEach(visit);
    const escape = (text: string) =>
      text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    for (const edit of value.edits) {
      const node = nodes.get(edit.nodeId);
      if (!node) throw new Error('An edited element is no longer in this landing project.');
      if (edit.key === 'title') {
        node.title = edit.value;
        continue;
      }
      if (['text', 'html'].includes(edit.key)) {
        if (!['text', 'textblock', 'headline'].includes(node.type))
          throw new Error('This element does not have editable text.');
        const tag = String(node.config.html ?? '').match(/^<(h[1-6]|p)>/i)?.[1] ?? 'p';
        node.config.html =
          edit.key === 'html' ? edit.value : `<${tag}>${escape(edit.value).replace(/\n/g, '<br>')}</${tag}>`;
      } else if (edit.key === 'accordionItemTitle') {
        if (node.type !== 'accordionitem') throw new Error('This element is not an accordion question.');
        node.config.accordionItemTitle = escape(edit.value);
      } else {
        if (node.type !== 'button') throw new Error('This element is not a button.');
        node.config[edit.key] = edit.key === 'buttonText' ? escape(edit.value) : edit.value;
      }
    }
    return this.update({ workspaceId: value.workspaceId, id: value.id, revision: value.revision, sections });
  }
  private document(project: LandingProject) {
    const document = createPageDocument(validateLandingSections(project.sections));
    const originalRootId = document.id;
    document.id = project.rootId;
    const relink = (node: typeof document) => {
      if (node.parentWidgetId === originalRootId) node.parentWidgetId = project.rootId;
      if (node.containerId === originalRootId) node.containerId = project.rootId;
      node.childWidgets.forEach(relink);
    };
    relink(document);
    return document;
  }
  operate(input: unknown): LandingProject {
    const value = landingTargetSchema.extend({ operation: builderOperationSchema }).strict().parse(input);
    const previous = this.target({ workspaceId: value.workspaceId, id: value.id, revision: value.revision });
    const content = applyBuilderOperation(serializePageDocument(this.document(previous)), value.operation);
    return this.update({
      workspaceId: value.workspaceId,
      id: value.id,
      revision: value.revision,
      sections: parsePageDocument(content).childWidgets,
    });
  }
  history(id: string): LandingRevision[] {
    this.read(id);
    return this.services.store.db
      .prepare('SELECT value FROM landing_revisions WHERE project_id = ? ORDER BY revision DESC')
      .all(id)
      .map((row) => {
        const project = JSON.parse(row.value as string) as LandingProject;
        return {
          revision: project.revision,
          at: project.updatedAt,
          note: project.note,
          sectionCount: project.sections.length,
          title: project.brief.title,
        };
      });
  }
  restore(input: unknown): LandingProject {
    const value = landingTargetSchema
      .extend({ restoreRevision: z.number().int().positive() })
      .strict()
      .parse(input);
    const previous = this.target(
      { workspaceId: value.workspaceId, id: value.id, revision: value.revision },
      true
    );
    const row = this.services.store.db
      .prepare('SELECT value FROM landing_revisions WHERE project_id = ? AND revision = ?')
      .get(value.id, value.restoreRevision);
    if (!row) throw new Error('Landing revision not found.');
    const saved = JSON.parse(row.value as string) as LandingProject;
    this.available(saved.brief.path, previous.id);
    return this.save(previous, {
      ...previous,
      brief: saved.brief,
      sections: validateLandingSections(saved.sections),
      archivedAt: null,
      revision: previous.revision + 1,
      updatedAt: new Date().toISOString(),
      note: `Restored revision ${value.restoreRevision}.`,
    });
  }
  archive(input: unknown): LandingProject {
    const previous = this.target(input);
    const now = new Date().toISOString();
    return this.save(previous, {
      ...previous,
      revision: previous.revision + 1,
      updatedAt: now,
      archivedAt: now,
      note: 'Archived the local landing project.',
    });
  }
  export(input: unknown): { filename: string; content: string } {
    const project = this.target(input);
    this.available(project.brief.path, project.id);
    const document = this.document(project);
    return {
      filename: `${project.brief.path.split('/').filter(Boolean).join('-')}.studio.json`,
      content: JSON.stringify(
        {
          format: 'ultracart-studio-landing',
          version: 1,
          manifest: {
            projectId: project.id,
            revision: project.revision,
            status: 'local-draft',
            merchantId: project.selection.merchantId,
            storefrontId: project.selection.storefront.id,
            host: project.selection.storefront.host,
            path: project.brief.path,
            nativeIds: 'local-placeholders-must-be-reserved-before-publish',
            liveVerified: false,
            readiness: this.readiness(project.id),
          },
          brief: project.brief,
          files: [{ path: 'body.cjson', content: serializePageDocument(document) }],
        },
        null,
        2
      ),
    };
  }
}
