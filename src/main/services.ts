import { join, isAbsolute } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdtemp, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { ConnectionService } from './domain/connection-service';
import { DraftService, draftHash, containerPath } from './domain/draft-service';
import { draftSaveSchema } from '../shared/drafts';
import { assertPagePath, sameStore, storefrontUrl } from '../shared/storefront';
import { Store } from './database';
import { isSampleSelection } from '../shared/sample';
import { samplePages, sampleToolkit, sampleWorkspace } from './sample';
import type {
  Change,
  Draft,
  DraftReview,
  DraftScope,
  Selection,
  Settings,
  StorePage,
  TemplateSource,
  Workspace,
} from '../shared/types';

const selectionSchema = z.object({
  profileId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/),
  merchantId: z.string().min(1).max(100),
  storefront: z.object({
    id: z.number().int().positive(),
    host: z.string().max(253),
    themeId: z.number().int().nullable(),
  }),
  verifiedAt: z.string(),
});
type Record = {
  id: string;
  scope: DraftScope;
  container: string;
  content: string;
  baseline: string;
  baselineState: string;
  baselineHash: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
type Preview = {
  session: string;
  revision: number;
  theme: number;
  scope: DraftScope;
  createdAt: string;
  applied: boolean;
};
export const workspaceId = (s: Selection) =>
  isSampleSelection(s)
    ? 'sample'
    : createHash('sha256')
        .update(JSON.stringify([s.profileId, s.merchantId, s.storefront.id, s.storefront.host]))
        .digest('hex')
        .slice(0, 24);

export class StudioServices {
  readonly connection: ConnectionService;
  readonly drafts: DraftService;
  readonly sampleDrafts: DraftService;
  private publishBusy = new Set<string>();
  constructor(
    readonly store: Store,
    readonly emit: () => void,
    root: string
  ) {
    const defaults: Settings = {
      nodePath: join(root, '.toolkit/node_modules/node/bin/node'),
      cliPath: join(root, '.toolkit/node_modules/@ultracart/storefront-agent-toolchain/dist/bin.js'),
      provider: 'openai',
      model: 'gpt-6.1-sol',
      reasoning: 'high',
      theme: 'light',
    };
    if (!store.get<Settings | null>('settings', null)) store.set('settings', defaults);
    const previousRoot = store.get<string | null>('runtime-root', null);
    const saved = this.settings();
    if (
      previousRoot &&
      previousRoot !== root &&
      existsSync(defaults.nodePath) &&
      existsSync(defaults.cliPath) &&
      saved.nodePath === join(previousRoot, '.toolkit/node_modules/node/bin/node') &&
      saved.cliPath ===
        join(previousRoot, '.toolkit/node_modules/@ultracart/storefront-agent-toolchain/dist/bin.js')
    ) {
      store.set('settings', { ...saved, nodePath: defaults.nodePath, cliPath: defaults.cliPath });
    }
    store.set('runtime-root', root);
    const previousWorkspace = store.get<Workspace | null>('workspace', null);
    if (
      previousWorkspace?.kind === 'live' &&
      previousWorkspace.id !== workspaceId(previousWorkspace.selection)
    ) {
      const id = workspaceId(previousWorkspace.selection);
      store.set(`pages:${id}`, store.get(`pages:${previousWorkspace.id}`, []));
      store.set('workspace', { ...previousWorkspace, id });
      const sessions = store.db
        .prepare('SELECT value FROM sessions WHERE workspace_id = ?')
        .all(previousWorkspace.id);
      for (const row of sessions) {
        const session = JSON.parse(row.value as string);
        store.saveSession({ ...session, workspaceId: workspaceId(session.scope.selection) });
      }
      store.db
        .prepare(
          "UPDATE activity SET workspace_id = ?, value = json_set(value, '$.workspaceId', ?) WHERE workspace_id = ?"
        )
        .run(id, id, previousWorkspace.id);
    }
    this.connection = new ConnectionService(async () => this.settings());
    this.drafts = new DraftService(store.db, this.connection);
    this.sampleDrafts = new DraftService(store.db, sampleToolkit);
  }
  private draftService(scope: DraftScope) {
    return isSampleSelection(scope.selection) ? this.sampleDrafts : this.drafts;
  }
  settings() {
    return this.store.get<Settings>('settings', {} as Settings);
  }
  saveSettings(input: unknown) {
    const parsed = z
      .object({
        nodePath: z.string().max(4096).refine(isAbsolute),
        cliPath: z.string().max(4096).refine(isAbsolute),
        provider: z.enum(['openai', 'openai-codex']),
        model: z.string().min(1).max(150),
        reasoning: z.enum(['low', 'medium', 'high']),
        theme: z.enum(['light', 'dark']),
      })
      .strict()
      .parse(input);
    this.store.set('settings', parsed);
    this.emit();
    return parsed;
  }
  workspace() {
    return this.store.get<Workspace>('workspace', sampleWorkspace);
  }
  pages(workspace = this.workspace()): StorePage[] {
    return workspace.kind === 'sample'
      ? samplePages
      : this.store.get<StorePage[]>(`pages:${workspace.id}`, []);
  }
  async refresh() {
    const workspace = this.workspace();
    if (workspace.kind === 'live') {
      const pages = await this.connection.pages(workspace.selection);
      this.store.set(`pages:${workspace.id}`, pages);
      this.store.set(`fetched:${workspace.id}`, new Date().toISOString());
      this.emit();
    }
    return this.pages(workspace);
  }
  async connect(input: unknown) {
    const v = z
      .object({ profile: z.string(), merchantId: z.string(), storefrontId: z.number().int().positive() })
      .strict()
      .parse(input);
    const available = await this.connection.storefronts(v.profile);
    if (available.merchantId !== v.merchantId)
      throw new Error('Merchant identity changed. Reload storefronts.');
    const selected = available.storefronts.find((s) => s.id === v.storefrontId);
    if (!selected) throw new Error('This storefront is no longer available.');
    storefrontUrl(selected.host, '/');
    const selection = selectionSchema.parse({
      profileId: v.profile,
      merchantId: v.merchantId,
      storefront: selected,
      verifiedAt: new Date().toISOString(),
    });
    const workspace: Workspace = {
      id: workspaceId(selection),
      kind: 'live',
      label: selected.host.replace(/^www\./, ''),
      selection,
    };
    const pages = await this.connection.pages(selection);
    this.store.set(`pages:${workspace.id}`, pages);
    this.store.set('workspace', workspace);
    this.store.log(workspace.id, 'store', 'Storefront connected', `${pages.length} pages available`);
    this.emit();
    return workspace;
  }
  useSample() {
    this.store.set('workspace', sampleWorkspace);
    this.emit();
    return sampleWorkspace;
  }
  scope(path: string): DraftScope {
    assertPagePath(path);
    const workspace = this.workspace();
    if (!this.pages().some((p) => p.path === path)) throw new Error('Select a page in this storefront.');
    return { selection: workspace.selection, path, slot: 'body' };
  }
  private record(id: string): Record {
    for (const row of this.store.db.prepare('SELECT record FROM storefront_drafts').all()) {
      const record = JSON.parse(row.record as string) as Record;
      if (record.id === id) return record;
    }
    throw new Error('Draft not found.');
  }
  private remember(draft: Draft) {
    const record = this.record(draft.id);
    this.store.db
      .prepare('INSERT OR IGNORE INTO revisions (draft_id, revision, value) VALUES (?, ?, ?)')
      .run(draft.id, draft.revision, JSON.stringify({ at: new Date().toISOString(), record, draft }));
    return draft;
  }
  getChange(id: string): Change {
    const record = this.record(id);
    const draft = this.drafts.read(record.scope)!;
    const saved = this.store.get<DraftReview | null>(`review:${id}`, null);
    const review = saved?.reviewedRevision === draft.revision ? saved : null;
    const preview = this.store.get<Preview | null>(`preview:${id}`, null);
    const published = this.store.get<{ revision: number; at: string } | null>(`published:${id}`, null);
    const publishedAt = published?.revision === draft.revision ? published.at : null;
    const publishPending = !!this.store.get(`publish-attempt:${id}`, null) && !publishedAt;
    const previewedRevision =
      preview?.applied && Date.now() - Date.parse(preview.createdAt) < 8 * 3600_000 ? preview.revision : null;
    return {
      id,
      scope: record.scope,
      draft,
      review,
      previewedRevision,
      publishedAt,
      publishPending,
      status: publishedAt
        ? 'published'
        : publishPending
          ? 'unverified'
          : review?.remoteChanged
            ? 'conflict'
            : previewedRevision === draft.revision
              ? 'previewed'
              : review
                ? 'reviewed'
                : 'draft',
    };
  }
  changes(workspace = this.workspace()) {
    return this.store.db
      .prepare('SELECT record FROM storefront_drafts')
      .all()
      .map((row) => JSON.parse(row.record as string) as Record)
      .filter((r) => workspaceId(r.scope.selection) === workspace.id)
      .map((r) => this.getChange(r.id))
      .sort((a, b) => b.draft.updatedAt.localeCompare(a.draft.updatedAt));
  }
  async pull(scope: DraftScope) {
    const draft = this.remember(await this.draftService(scope).pull(scope));
    this.store.log(workspaceId(scope.selection), 'draft', 'Draft opened', scope.path);
    this.emit();
    return draft;
  }
  async save(input: unknown) {
    const v = draftSaveSchema.parse(input);
    if (this.publishBusy.has(v.id))
      throw new Error('Publishing is in progress. Wait for verification before editing.');
    if (this.getChange(v.id).publishedAt)
      throw new Error('This revision was published. Start a new draft to edit the latest live content.');
    if (this.store.get(`publish-attempt:${v.id}`, null))
      throw new Error('A publish attempt needs verification before further edits.');
    const draft = this.remember(await this.draftService(v).update(v));
    this.store.log(
      workspaceId(v.selection),
      'draft',
      'Draft saved',
      `${v.path} · revision ${draft.revision}`
    );
    this.emit();
    return draft;
  }
  async review(scope: DraftScope, id: string, revision: number) {
    const review = await this.draftService(scope).review({ ...scope, id, revision });
    this.store.set(`review:${id}`, review);
    this.store.log(
      workspaceId(scope.selection),
      'review',
      review.remoteChanged ? 'Remote change detected' : 'Draft checked',
      `${scope.path} · revision ${revision}`
    );
    this.emit();
    return review;
  }
  history(id: string) {
    return this.store.db
      .prepare('SELECT revision, value FROM revisions WHERE draft_id = ? ORDER BY revision DESC')
      .all(id)
      .map((row) => {
        const v = JSON.parse(row.value as string);
        return { revision: row.revision, at: v.at, changedFields: v.draft.changedFields };
      });
  }
  async restore(scope: DraftScope, id: string, revision: number) {
    const current = this.drafts.read(scope);
    if (current?.id !== id) throw new Error('Draft scope mismatch.');
    const row = this.store.db
      .prepare('SELECT value FROM revisions WHERE draft_id = ? AND revision = ?')
      .get(id, revision);
    if (!row) throw new Error('Revision not found.');
    const prior = JSON.parse(row.value as string).draft as Draft;
    return this.save({
      ...scope,
      id,
      revision: current.revision,
      edits: prior.fields.map((f) => ({ pointer: f.pointer, value: f.value })),
    });
  }
  async detail(scope: DraftScope) {
    return isSampleSelection(scope.selection)
      ? samplePages.find((p) => p.path === scope.path)
      : this.connection.page(scope.selection, scope.path);
  }
  async templates(scope: DraftScope) {
    if (!isSampleSelection(scope.selection)) return this.connection.templates(scope.selection, scope.path);
    const page = samplePages.find((p) => p.path === scope.path)!;
    return {
      page: scope.path,
      themeId: 1,
      group: { name: page.template!, path: `/themes/Fieldwork/${page.template}` },
      item: null,
      warnings: [],
    };
  }
  async templateSource(scope: DraftScope, kind: 'group' | 'item' = 'group'): Promise<TemplateSource> {
    const templates = await this.templates(scope);
    const template = kind === 'group' ? templates.group : templates.item;
    if (!template) throw new Error('This page does not have that template.');
    const path = assertPagePath(template.path);
    if (isSampleSelection(scope.selection))
      return {
        path,
        kind,
        content:
          '## Fieldwork sample\n## This illustrative storefront is rendered locally in React.\n## A connected store shows its resolved Velocity template here.\n',
        truncated: false,
      };
    const response = z
      .object({
        action: z.literal('sf.files.get'),
        storefrontOid: z.literal(scope.selection.storefront.id),
        path: z.string().optional(),
        content: z.string(),
        truncated: z.boolean().optional(),
      })
      .parse(
        JSON.parse(
          await this.connection.run([
            '--format',
            'json',
            '--profile',
            scope.selection.profileId,
            'sf',
            'files',
            'get',
            path,
            '--storefront',
            String(scope.selection.storefront.id),
          ])
        )
      );
    if (response.path !== undefined && response.path !== path)
      throw new Error('The toolkit returned a different template.');
    return {
      path,
      kind,
      content: response.content.slice(0, 200000),
      truncated: response.truncated === true || response.content.length > 200000,
    };
  }
  private checkRecord(scope: DraftScope, id: string, revision: number) {
    const record = this.record(id);
    if (
      !sameStore(scope.selection, record.scope.selection) ||
      scope.path !== record.scope.path ||
      scope.slot !== record.scope.slot ||
      record.revision !== revision
    )
      throw new Error('The draft changed or belongs to another page. Reload it.');
    return record;
  }
  private async withFiles<T>(record: Record, action: (file: string) => Promise<T>) {
    const directory = await mkdtemp(join(tmpdir(), 'uc-studio-'));
    try {
      const file = join(directory, 'body.cjson');
      await writeFile(file, record.content, { mode: 0o600 });
      await writeFile(file + '.sf.json', record.baselineState, { mode: 0o600 });
      return await action(file);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
  async stage(
    scope: DraftScope,
    id: string,
    revision: number
  ): Promise<{ url: string; host: string; draftId: string; revision: number }> {
    const record = this.checkRecord(scope, id, revision);
    if (isSampleSelection(scope.selection))
      throw new Error('Sample drafts render locally. Select Draft in the canvas.');
    const review = await this.review(scope, id, revision);
    if (!review.validation.valid || review.remoteChanged)
      throw new Error('Resolve validation errors or remote changes before previewing.');
    const prefix = ['--format', 'json', '--profile', scope.selection.profileId, 'sf', 'preview'];
    const storefront = ['--storefront', String(scope.selection.storefront.id)];
    const started = JSON.parse(await this.connection.run([...prefix, 'start', ...storefront]));
    const session = z
      .string()
      .regex(/^[a-fA-F0-9]{32}$/)
      .parse(started.preview_session_id);
    let staged: any;
    try {
      staged = await this.withFiles(record, async (file) =>
        JSON.parse(
          await this.connection.run([
            ...prefix,
            'stage',
            ...storefront,
            '--session',
            session,
            '--file',
            `${file}=${containerPath(scope.path, scope.slot)}`,
          ])
        )
      );
      const theme = z.number().int().positive().parse(staged.themeOid);
      this.checkRecord(scope, id, revision);
      this.store.set(`preview:${id}`, {
        session,
        revision,
        theme,
        scope,
        createdAt: new Date().toISOString(),
        applied: false,
      } satisfies Preview);
      const opened = JSON.parse(
        await this.connection.run([
          ...prefix,
          'open',
          ...storefront,
          '--session',
          session,
          '--theme',
          String(theme),
          '--path',
          scope.path,
        ])
      );
      const url = new URL(z.string().parse(opened.access_url));
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        ![scope.selection.storefront.host, 'secure.ultracart.com'].includes(url.hostname)
      )
        throw new Error('Unexpected preview destination.');
      this.store.log(
        workspaceId(scope.selection),
        'preview',
        'Preview staged',
        `${scope.path} · revision ${revision}`
      );
      this.emit();
      return { url: url.href, host: scope.selection.storefront.host, draftId: id, revision };
    } catch (error) {
      await this.connection
        .run([...prefix, 'end', ...storefront, '--session', session])
        .catch(() => undefined);
      throw error;
    }
  }
  markPreview(id: string, revision: number) {
    const preview = this.store.get<Preview | null>(`preview:${id}`, null);
    if (preview?.revision !== revision) return;
    preview.applied = true;
    this.store.set(`preview:${id}`, preview);
    this.emit();
  }
  async publish(scope: DraftScope, id: string, revision: number, confirmation: string) {
    if (confirmation !== scope.selection.storefront.host)
      throw new Error('Type the exact storefront host to publish.');
    if (isSampleSelection(scope.selection)) throw new Error('Sample storefronts cannot be published.');
    if (this.publishBusy.has(id) || this.store.get(`publish-attempt:${id}`, null))
      throw new Error('This publish attempt already started. Verify its remote result before retrying.');
    this.publishBusy.add(id);
    try {
      const record = this.checkRecord(scope, id, revision);
      if (this.getChange(id).previewedRevision !== revision)
        throw new Error('Open and verify the UltraCart preview of this exact revision first.');
      const review = await this.review(scope, id, revision);
      if (!review.validation.valid || review.remoteChanged)
        throw new Error('The draft is invalid or remote content changed. Publishing stopped.');
      this.checkRecord(scope, id, revision);
      this.store.set(`publish-attempt:${id}`, {
        revision,
        hash: draftHash(record.content),
        at: new Date().toISOString(),
      });
      await this.withFiles(record, (file) =>
        this.connection.run([
          '--format',
          'json',
          '--profile',
          scope.selection.profileId,
          'sf',
          'push',
          file,
          '--storefront',
          String(scope.selection.storefront.id),
          '--to',
          containerPath(scope.path, scope.slot),
          '--live',
        ])
      );
      return await this.verifyPublish(scope, id, revision);
    } finally {
      this.publishBusy.delete(id);
    }
  }
  async verifyPublish(scope: DraftScope, id: string, revision: number) {
    const record = this.checkRecord(scope, id, revision);
    const attempt = this.store.get<{ revision: number; hash: string } | null>(`publish-attempt:${id}`, null);
    if (!attempt || attempt.revision !== revision) throw new Error('No matching publish attempt to verify.');
    if (attempt.hash !== draftHash(record.content))
      throw new Error('The saved content no longer matches this publish attempt.');
    await this.connection.verify(scope.selection);
    const actual = await this.withFiles(record, async (snapshot) => {
      const file = snapshot + '.remote.cjson';
      await this.connection.run([
        '--format',
        'json',
        '--profile',
        scope.selection.profileId,
        'sf',
        'pull',
        containerPath(scope.path, scope.slot),
        '--storefront',
        String(scope.selection.storefront.id),
        '--out',
        file,
      ]);
      return readFile(file, 'utf8');
    });
    // Compare document structure because the server may normalize whitespace.
    if (!isDeepStrictEqual(JSON.parse(actual), JSON.parse(record.content)))
      throw new Error(
        'Remote content does not match the requested revision. The publish outcome remains unresolved.'
      );
    this.store.set(`published:${id}`, { revision, at: new Date().toISOString() });
    this.store.log(workspaceId(scope.selection), 'store', 'Published content verified', scope.path);
    this.emit();
    return this.getChange(id);
  }
  async nextDraft(scope: DraftScope, id: string, revision: number) {
    const record = this.checkRecord(scope, id, revision);
    if (!this.getChange(id).publishedAt)
      throw new Error('Verify the published revision before starting the next draft.');
    if (this.publishBusy.has(id)) throw new Error('Wait for the current operation to finish.');
    this.publishBusy.add(id);
    try {
      await this.connection.verify(scope.selection);
      const remote = await this.withFiles(record, async (snapshot) => {
        const file = snapshot + '.remote.cjson';
        await this.connection.run([
          '--format',
          'json',
          '--profile',
          scope.selection.profileId,
          'sf',
          'pull',
          containerPath(scope.path, scope.slot),
          '--storefront',
          String(scope.selection.storefront.id),
          '--out',
          file,
        ]);
        if ((await stat(file)).size > 512 * 1024 || (await stat(file + '.sf.json')).size > 1024 * 1024 + 8192)
          throw new Error('This container exceeds the draft size limit.');
        const content = await readFile(file, 'utf8');
        const baselineState = await readFile(file + '.sf.json', 'utf8');
        const state = JSON.parse(baselineState);
        const hash = draftHash(content);
        if (
          state.version !== 1 ||
          state.merchant !== scope.selection.merchantId ||
          state.storefront !== scope.selection.storefront.id ||
          state.to !== containerPath(scope.path, scope.slot) ||
          state.hash !== hash ||
          state.content !== content
        )
          throw new Error('The remote baseline does not match this page and store.');
        return { content, baseline: content, baselineState, baselineHash: hash };
      });
      this.checkRecord(scope, id, revision);
      const next = { ...record, ...remote, revision: revision + 1, updatedAt: new Date().toISOString() };
      this.store.db.exec('BEGIN IMMEDIATE');
      try {
        this.store.db
          .prepare("UPDATE storefront_drafts SET record = ? WHERE json_extract(record, '$.id') = ?")
          .run(JSON.stringify(next), id);
        const draft = this.remember(this.drafts.read(scope)!);
        this.store.db.prepare('DELETE FROM kv WHERE key = ?').run(`publish-attempt:${id}`);
        this.store.db.exec('COMMIT');
        this.store.log(
          workspaceId(scope.selection),
          'draft',
          'New baseline opened',
          `${scope.path} · revision ${draft.revision}`
        );
        this.emit();
        return draft;
      } catch (error) {
        this.store.db.exec('ROLLBACK');
        throw error;
      }
    } finally {
      this.publishBusy.delete(id);
    }
  }
  exportDraft(scope: DraftScope, id: string, revision: number) {
    return this.checkRecord(scope, id, revision).content;
  }
  runtimeReady() {
    const s = this.settings();
    return existsSync(s.nodePath) && existsSync(s.cliPath);
  }
}
