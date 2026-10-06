import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  FileText,
  GitCompareArrows,
  Globe2,
  History,
  Layers3,
  LoaderCircle,
  Maximize2,
  MessageSquare,
  Monitor,
  MousePointer2,
  PanelRightClose,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Square,
  TriangleAlert,
  Undo2,
  WandSparkles,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import type {
  Bootstrap,
  Change,
  ConversationView,
  Draft,
  Message,
  Session,
  StorePage,
  TemplateResult,
  TemplateSource,
} from '../../shared/types';
import { api, errorText, invoke, subscribe } from '../api';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Field, FieldLabel, FieldDescription, FieldGroup } from './ui/field';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { EmptyState, IconButton, Loading, relativeTime } from './common';
import { SamplePreview } from './sample-preview';
import { TemplateSourceDialog } from './template-source';
import { PageBuilder } from './page-builder';
import { ContentMap } from './content-map';
import { NativeIdsDialog } from './native-ids';

const emptyView: ConversationView = { messages: [], busy: false, queued: 0, tokens: 0 };
const toolNames: Record<string, string> = {
  storefront_read_page: 'Inspect page',
  storefront_list_pages: 'Explore related pages',
  storefront_resolve_template: 'Resolve page templates',
  storefront_read_template: 'Read template source',
  storefront_pull_draft: 'Open local draft',
  storefront_read_draft: 'Read current draft',
  storefront_save_draft: 'Save local edits',
  storefront_review_draft: 'Validate and review',
  storefront_inspect_structure: 'Read page structure',
  storefront_content_map: 'Inspect page content sources',
  storefront_edit_structure: 'Edit page sections',
  landing_read_project: 'Read landing draft',
  landing_save_fields: 'Save landing copy',
  landing_edit_sections: 'Edit landing sections',
  landing_update_brief: 'Update landing brief',
  landing_check_readiness: 'Check landing draft',
  warehouse_status: 'Read warehouse status',
  warehouse_list_tables: 'Explore warehouse tables',
  warehouse_read_schema: 'Read table schema',
  warehouse_save_query: 'Save query for review',
};
type Props = {
  data: Bootstrap;
  page: StorePage;
  slot?: string;
  onSelectSlot?: (slot: string) => void;
  activeSession: string | null;
  setActiveSession: (id: string | null) => void;
  initialPrompt: string;
  clearInitialPrompt: () => void;
  overlayOpen: boolean;
  openSettings: () => void;
  refresh: () => Promise<void>;
};

export function WorkspaceCanvas({
  data,
  page,
  slot = 'body',
  activeSession,
  setActiveSession,
  initialPrompt,
  clearInitialPrompt,
  overlayOpen,
  openSettings,
  refresh,
  onSelectSlot,
}: Props) {
  const [mode, setMode] = useState('preview');
  const [device, setDevice] = useState('desktop');
  const [panel, setPanel] = useState('agent');
  const [draftPreview, setDraftPreview] = useState(true);
  const [nativeStatus, setNativeStatus] = useState<{ loading: boolean; applied?: boolean; error?: string }>({
    loading: false,
  });
  const [action, setAction] = useState('');
  const [selectedField, setSelectedField] = useState('');
  const [sectionPrompt, setSectionPrompt] = useState('');
  const [rightVisible, setRightVisible] = useState(true);
  const [publishOpen, setPublishOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [abandonNeedsHost, setAbandonNeedsHost] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [idsOpen, setIdsOpen] = useState(false);
  const [history, setHistory] = useState<{ revision: number; at: string; changedFields: number }[]>([]);
  const [templates, setTemplates] = useState<TemplateResult | null>(null);
  const [source, setSource] = useState<TemplateSource | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const change = data.changes.find((c) => c.scope.path === page.path && c.scope.slot === slot);
  const draft = change?.draft;
  const sample = data.workspace.kind === 'sample';
  const isOverlay = overlayOpen || publishOpen || abandonOpen || historyOpen || idsOpen || !!source;
  const currentPath = useRef(page.path);
  currentPath.current = page.path;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void invoke('preview.close').catch(() => {});
    };
  }, []);
  useEffect(() => {
    setTemplates(null);
    setSource(null);
    setSelectedField('');
    setSectionPrompt('');
    setNativeStatus({ loading: false });
    setDraftPreview(true);
    setMode('preview');
  }, [page.path]);
  useEffect(
    () =>
      subscribe((event) => {
        if (event.type === 'preview') setNativeStatus((previous) => ({ ...previous, ...event }));
      }),
    []
  );
  const updateBounds = () => {
    const bounds = viewport.current?.getBoundingClientRect();
    if (bounds)
      api.previewBounds({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        visible: !sample && mode === 'preview' && !isOverlay,
      });
  };
  useLayoutEffect(() => {
    updateBounds();
    const observer = new ResizeObserver(updateBounds);
    if (viewport.current) observer.observe(viewport.current);
    const timer = setInterval(updateBounds, 300);
    return () => {
      observer.disconnect();
      clearInterval(timer);
      api.previewBounds({ x: 0, y: 0, width: 0, height: 0, visible: false });
    };
  }, [sample, mode, device, isOverlay, rightVisible]);
  useEffect(() => {
    if (sample) {
      void invoke('preview.close').catch(() => {});
      return;
    }
    setNativeStatus({ loading: true });
    let cancelled = false;
    void invoke('preview.open', { kind: 'live', path: page.path, slot })
      .then(() => {
        if (!cancelled) updateBounds();
      })
      .catch((error) => {
        if (!cancelled) setNativeStatus({ loading: false, error: errorText(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [page.path, sample]);
  async function run(name: string, work: () => Promise<unknown>) {
    setAction(name);
    try {
      await work();
      await refresh();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      if (mounted.current) setAction('');
    }
  }
  async function pull() {
    await run('pull', async () => {
      await invoke('draft.pull', { path: page.path, slot });
      setPanel('fields');
      toast.success('Local draft opened');
    });
  }
  async function review() {
    if (!draft) return;
    await run('review', async () => {
      await invoke('draft.review', { path: page.path, slot, id: draft.id, revision: draft.revision });
      setMode('changes');
      toast.success('Draft review complete');
    });
  }
  async function previewDraft() {
    if (!draft) return;
    if (sample) {
      setDraftPreview(true);
      setMode('preview');
      return;
    }
    await run('preview', async () => {
      setMode('preview');
      setNativeStatus({ loading: true });
      await invoke('preview.open', {
        kind: 'draft',
        path: page.path,
        slot,
        id: draft.id,
        revision: draft.revision,
      });
      updateBounds();
    });
  }
  async function loadHistory() {
    if (!draft) return;
    try {
      setHistory(await invoke('draft.history', { path: page.path, slot, id: draft.id }));
      setHistoryRevision(draft.revision);
      setHistoryOpen(true);
    } catch (error) {
      toast.error(errorText(error));
    }
  }
  async function selectField(pointer: string) {
    setSelectedField(pointer);
    if (!draft) await pull();
    setPanel('fields');
  }
  const approved = change?.review?.validation.valid && !change.review.remoteChanged;
  return (
    <div className={cn('canvas-layout', !rightVisible && 'right-hidden')}>
      <section className="canvas-main">
        <div className="canvas-header">
          <div>
            <span className="page-type-icon">
              <FileText size={17} />
            </span>
            <div>
              <h1>{page.title}</h1>
              <span>
                {page.path} <span className="middot">·</span> {page.template || 'Template not reported'}
              </span>
            </div>
          </div>
          <div>
            <Badge variant="outline">Slot: {slot}</Badge>
            {draft && <Badge variant="secondary">{draft.changedFields} changes</Badge>}
            <IconButton
              label="Page details"
              onClick={() => {
                setPanel('details');
                setRightVisible(true);
              }}
            >
              <Layers3 />
            </IconButton>
          </div>
        </div>
        <div className="canvas-toolbar">
          <div>
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(value) => value && setMode(value)}
              size="sm"
              aria-label="Canvas view"
            >
              <ToggleGroupItem value="preview" aria-label="Preview">
                <Monitor />
                Preview
              </ToggleGroupItem>
              <ToggleGroupItem value="changes" aria-label="Changes">
                <GitCompareArrows />
                Changes
              </ToggleGroupItem>
              <ToggleGroupItem value="sections" aria-label="Sections">
                <Layers3 />
                Sections
              </ToggleGroupItem>
              <ToggleGroupItem value="content" aria-label="Content sources">
                <FileCode2 />
                Content
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div>
            <ToggleGroup
              type="single"
              value={device}
              onValueChange={(value) => value && setDevice(value)}
              size="sm"
              aria-label="Device size"
            >
              <ToggleGroupItem value="desktop" aria-label="Desktop">
                <Monitor />
              </ToggleGroupItem>
              <ToggleGroupItem value="mobile" aria-label="Mobile">
                <Smartphone />
              </ToggleGroupItem>
            </ToggleGroup>
            <span className="toolbar-divider" />
            <IconButton
              label="Open published page in browser"
              onClick={() =>
                sample
                  ? toast.info('This is a local sample storefront.')
                  : void invoke('window.openStore', { path: page.path, slot }).catch((e) =>
                      toast.error(errorText(e))
                    )
              }
            >
              <ExternalLink />
            </IconButton>
            <IconButton
              label={rightVisible ? 'Hide inspector' : 'Show inspector'}
              onClick={() => setRightVisible((v) => !v)}
            >
              <PanelRightClose />
            </IconButton>
          </div>
        </div>
        {mode === 'preview' ? (
          <div className={cn('canvas-background', device === 'mobile' && 'mobile-canvas')}>
            <div className={cn('browser-frame', device === 'mobile' && 'mobile-frame')}>
              <div className="browser-chrome">
                <div className="browser-dots">
                  <i />
                  <i />
                  <i />
                </div>
                <span>
                  <Globe2 size={11} />
                  {data.workspace.selection.storefront.host}
                  {page.path === '/' ? '' : page.path}
                </span>
                <IconButton
                  label="Reload preview"
                  onClick={() => (sample ? setDraftPreview(true) : void invoke('preview.reload'))}
                >
                  <RefreshCw />
                </IconButton>
              </div>
              <div className="browser-viewport" ref={viewport}>
                {sample ? (
                  <SamplePreview
                    path={page.path}
                    draft={draft}
                    original={!draftPreview}
                    mobile={device === 'mobile'}
                    editable
                    onSelect={selectField}
                  />
                ) : nativeStatus.error ? (
                  <EmptyState title="Preview unavailable" description={nativeStatus.error}>
                    <Button
                      variant="outline"
                      onClick={() => invoke('window.openStore', { path: page.path, slot })}
                    >
                      Open in browser
                      <ArrowUpRight data-icon="inline-end" />
                    </Button>
                  </EmptyState>
                ) : (
                  <Loading label={nativeStatus.loading ? 'Loading storefront' : 'Storefront preview'} />
                )}
              </div>
            </div>
            <div className="canvas-caption">
              {sample ? (
                <>
                  <MousePointer2 size={12} />
                  <span>Click text to edit the sample storefront.</span>
                  <button onClick={() => setDraftPreview((v) => !v)}>
                    {draftPreview ? 'Show original' : 'Show draft'}
                  </button>
                </>
              ) : (
                <>
                  <span className={cn('status-dot', !nativeStatus.applied && 'neutral')} />
                  <span>
                    {nativeStatus.applied
                      ? 'UltraCart applied this draft preview'
                      : 'Published storefront. Drafts stay local until previewed.'}
                  </span>
                </>
              )}
            </div>
          </div>
        ) : mode === 'content' ? (
          <ContentMap
            key={data.workspace.id + ':' + page.path}
            path={page.path}
            slot={slot}
            onSelectSlot={(next) => {
              onSelectSlot?.(next);
              setSelectedField('');
              setSectionPrompt('');
              setMode('sections');
            }}
          />
        ) : mode === 'sections' ? (
          <PageBuilder
            key={data.workspace.id + ':' + page.path + ':' + slot}
            path={page.path}
            slot={slot}
            revision={draft?.revision}
            disabled={!!action || !!change?.publishedAt || !!change?.publishPending}
            onChange={refresh}
            onSelectSection={(node) => {
              setPanel('agent');
              setRightVisible(true);
              setSectionPrompt(
                `Inspect the section "${node.title}" (node ID: ${node.id}) in this page's local draft. Suggest one specific improvement based on its current content.`
              );
            }}
          />
        ) : (
          <div className="diff-canvas">
            {draft ? (
              <>
                <div className="diff-heading">
                  <div>
                    <h2>Every edit, in context.</h2>
                    <p>Original content compared with your saved draft.</p>
                  </div>
                  <Badge variant="outline">Revision {draft.revision}</Badge>
                </div>
                {change?.review && <ReviewStatus change={change} />}
                {!!draft.structureChanges?.length && (
                  <div className="mb-5 rounded-lg border border-border bg-muted/30 p-4">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <Layers3 size={14} />
                      Section changes
                    </h3>
                    {draft.structureChanges.map((change) => (
                      <div key={change.kind + change.id} className="flex items-center gap-2 py-1 text-sm">
                        <Badge variant="outline">{change.kind}</Badge>
                        <span className="min-w-0 truncate">{change.label}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="diff-column-labels">
                  <span>ORIGINAL</span>
                  <span>YOUR DRAFT</span>
                </div>
                {draft.fields
                  .filter((f) => f.before !== f.value)
                  .map((f) => (
                    <div className="diff-block" key={f.pointer}>
                      <div className="diff-label">
                        <FileCode2 size={12} />
                        {f.widget}
                        <span>{f.key}</span>
                      </div>
                      <div className="diff-sides">
                        <pre className="before">{f.before || '(empty)'}</pre>
                        <pre className="after">{f.value || '(empty)'}</pre>
                      </div>
                    </div>
                  ))}
                {draft.changedFields === 0 && (
                  <EmptyState
                    title="A clean starting point"
                    description="Edit a field or ask your agent to make a change. The comparison will appear here."
                  />
                )}
              </>
            ) : (
              <EmptyState
                title="Open a local draft"
                description="Bring this page’s content into your workspace to start editing."
              >
                <Button onClick={pull} disabled={!!action}>
                  <Download data-icon="inline-start" />
                  Open draft
                </Button>
              </EmptyState>
            )}
          </div>
        )}
        <div className="canvas-actionbar">
          <span>
            <ShieldCheck size={14} />
            {draft
              ? `Revision ${draft.revision} · Saved ${relativeTime(draft.updatedAt).toLowerCase()}`
              : 'Live content is protected'}
          </span>
          <div>
            {draft ? (
              <>
                <IconButton label="Revision history" onClick={loadHistory}>
                  <History />
                </IconButton>
                {change?.publishedAt && (
                  <Button
                    size="sm"
                    disabled={!!action}
                    onClick={() =>
                      run('next', async () => {
                        await invoke('draft.next', {
                          path: page.path,
                          slot,
                          id: draft.id,
                          revision: draft.revision,
                        });
                        setPanel('fields');
                        toast.success('New draft opened from the live page');
                      })
                    }
                  >
                    New draft
                  </Button>
                )}
                {change?.publishPending && (
                  <Button
                    size="sm"
                    disabled={!!action}
                    onClick={() =>
                      run('verify', async () => {
                        const result = await invoke<Change>('draft.verify', {
                          path: page.path,
                          slot,
                          id: draft.id,
                          revision: draft.revision,
                        });
                        if (result.publishedAt) toast.success('Published content verified');
                        else toast.info('The live page is unchanged. You can publish again.');
                      })
                    }
                  >
                    Verify publish
                  </Button>
                )}
                {change?.publishPending && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!action}
                    onClick={() => {
                      setConfirmation('');
                      setAbandonNeedsHost(false);
                      setAbandonOpen(true);
                    }}
                  >
                    Abandon attempt
                  </Button>
                )}
                {!sample && !!draft.localWidgetCount && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!action || !!change?.publishedAt || !!change?.publishPending}
                    onClick={() => setIdsOpen(true)}
                  >
                    Prepare IDs
                  </Button>
                )}
                <Button size="sm" variant="outline" disabled={!!action} onClick={review}>
                  {action === 'review' ? (
                    <LoaderCircle className="spin" data-icon="inline-start" />
                  ) : (
                    <CheckCheck data-icon="inline-start" />
                  )}
                  Review
                </Button>
                <Button size="sm" disabled={!!action || !draft.changedFields} onClick={previewDraft}>
                  {action === 'preview' ? (
                    <LoaderCircle className="spin" data-icon="inline-start" />
                  ) : (
                    <Monitor data-icon="inline-start" />
                  )}
                  Preview draft
                </Button>
                {!sample && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      !!action ||
                      !!change?.publishedAt ||
                      change?.publishPending ||
                      !approved ||
                      change?.previewedRevision !== draft.revision
                    }
                    onClick={() => {
                      setConfirmation('');
                      setPublishOpen(true);
                    }}
                  >
                    Publish
                  </Button>
                )}
              </>
            ) : (
              <Button size="sm" disabled={!!action} onClick={pull}>
                {action ? <LoaderCircle className="spin" data-icon="inline-start" /> : <SquarePenIcon />}Open
                local draft
              </Button>
            )}
          </div>
        </div>
      </section>
      {rightVisible && (
        <aside className="inspector">
          <div className="inspector-tabs">
            <ToggleGroup
              type="single"
              value={panel}
              onValueChange={(value) => value && setPanel(value)}
              size="sm"
              aria-label="Inspector"
            >
              <ToggleGroupItem value="agent">
                <Sparkles />
                Agent
              </ToggleGroupItem>
              <ToggleGroupItem value="fields">
                <SquarePenIcon />
                Edit
              </ToggleGroupItem>
              <ToggleGroupItem value="details">
                <Layers3 />
                Details
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          {panel === 'agent' && (
            <AgentPanel
              data={data}
              page={page}
              slot={slot}
              activeSession={activeSession}
              setActiveSession={setActiveSession}
              initialPrompt={sectionPrompt || initialPrompt}
              clearInitialPrompt={() => {
                setSectionPrompt('');
                clearInitialPrompt();
              }}
              openSettings={openSettings}
            />
          )}
          {panel === 'fields' &&
            (draft ? (
              <DraftEditor
                key={draft.id}
                draft={draft}
                path={page.path}
                selectedField={selectedField}
                refresh={refresh}
              />
            ) : (
              <EmptyState
                title="Make it yours"
                description={`Open a local draft to edit this page’s ${slot} slot. Use Content to find available slots.`}
              >
                <Button onClick={pull} disabled={!!action}>
                  Open local draft
                </Button>
              </EmptyState>
            ))}
          {panel === 'details' && (
            <div className="details-panel">
              <div className="details-section">
                <span className="eyebrow">PAGE CONTEXT</span>
                <h2>{page.title}</h2>
                <dl>
                  <dt>Page path</dt>
                  <dd>{page.path}</dd>
                  <dt>Storefront</dt>
                  <dd>{data.workspace.selection.storefront.host}</dd>
                  <dt>Visibility</dt>
                  <dd>{page.visible === null ? 'Unknown' : page.visible ? 'Visible' : 'Hidden'}</dd>
                  <dt>Search engines</dt>
                  <dd>{page.search}</dd>
                  <dt>Child pages</dt>
                  <dd>{page.children}</dd>
                  <dt>Items</dt>
                  <dd>{page.items}</dd>
                </dl>
              </div>
              <div className="details-section">
                <span className="eyebrow">SHARED TEMPLATE</span>
                <h3>{page.template || 'Not reported'}</h3>
                <p>
                  {data.pages.filter((p) => p.template && p.template === page.template).length} pages report
                  this template. The template may render content from several containers.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!action}
                  onClick={() =>
                    run('templates', async () =>
                      setTemplates(await invoke('page.templates', { path: page.path, slot }))
                    )
                  }
                >
                  Resolve template
                  <ArrowUpRight data-icon="inline-end" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!!action}
                  onClick={() =>
                    run('source', async () => {
                      const path = page.path;
                      const result = await invoke<TemplateSource>('page.source', { path });
                      if (currentPath.current === path) setSource(result);
                    })
                  }
                >
                  <Code2 data-icon="inline-start" />
                  Read template
                </Button>
                {templates && (
                  <pre>
                    {templates.group.path}
                    {templates.item ? `\n${templates.item.path}` : ''}
                  </pre>
                )}
              </div>
              <div className="details-section">
                <span className="eyebrow">LOCAL DRAFT</span>
                <p>
                  {draft
                    ? `${draft.fields.length} editable fields. ${draft.changedTextFields ?? draft.changedFields} changed. ${draft.skippedFields} omitted by size limits.`
                    : 'No local draft opened yet.'}
                </p>
                {draft && (
                  <p>
                    Container: <code>{draft.container}</code>
                  </p>
                )}
                {draft && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      invoke('draft.export', {
                        path: page.path,
                        slot,
                        id: draft.id,
                        revision: draft.revision,
                      }).catch((e) => toast.error(errorText(e)))
                    }
                  >
                    <Download data-icon="inline-start" />
                    Export CJSON
                  </Button>
                )}
              </div>
            </div>
          )}
        </aside>
      )}
      {idsOpen && draft && (
        <NativeIdsDialog
          key={`${draft.id}:${draft.revision}`}
          draft={draft}
          host={data.workspace.selection.storefront.host}
          onClose={() => setIdsOpen(false)}
          onSaved={refresh}
        />
      )}
      {source && <TemplateSourceDialog source={source} onClose={() => setSource(null)} />}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish this exact revision</DialogTitle>
            <DialogDescription>
              This writes revision {draft?.revision} to the live page at {page.path}. The app will recheck the
              remote baseline before writing.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="publish-confirm">
                Type {data.workspace.selection.storefront.host} to confirm
              </FieldLabel>
              <Input
                id="publish-confirm"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={confirmation !== data.workspace.selection.storefront.host || !!action}
              onClick={() =>
                run('publish', async () => {
                  await invoke('draft.publish', {
                    path: page.path,
                    slot,
                    id: draft!.id,
                    revision: draft!.revision,
                    confirmation,
                  });
                  toast.success('Published content verified');
                  setPublishOpen(false);
                })
              }
            >
              {action === 'publish' && <LoaderCircle className="spin" data-icon="inline-start" />}Publish
              revision {draft?.revision}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={abandonOpen} onOpenChange={setAbandonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abandon this publish attempt</DialogTitle>
            <DialogDescription>
              The app rereads the live page at {page.path}. If it no longer matches this revision or its
              baseline, the draft is replaced with the live content as a new revision. Revision{' '}
              {draft?.revision} stays in history.
            </DialogDescription>
          </DialogHeader>
          {abandonNeedsHost && (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="abandon-confirm">
                  Type {data.workspace.selection.storefront.host} to confirm
                </FieldLabel>
                <Input
                  id="abandon-confirm"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </Field>
            </FieldGroup>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbandonOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                (abandonNeedsHost && confirmation !== data.workspace.selection.storefront.host) || !!action
              }
              onClick={async () => {
                setAction('abandon');
                try {
                  await invoke('draft.abandon', {
                    path: page.path,
                    slot,
                    id: draft!.id,
                    revision: draft!.revision,
                    confirmation: abandonNeedsHost ? confirmation : '',
                  });
                  toast.success('Publish attempt abandoned');
                  setAbandonOpen(false);
                  await refresh();
                } catch (error) {
                  // Main only asks for the host when the live page matches neither revision nor baseline.
                  if (!abandonNeedsHost && /exact storefront host/.test(errorText(error))) {
                    setAbandonNeedsHost(true);
                    toast.info('The live page has changed. Type the storefront host to replace the draft.');
                  } else toast.error(errorText(error));
                } finally {
                  if (mounted.current) setAction('');
                }
              }}
            >
              {action === 'abandon' && <LoaderCircle className="spin" data-icon="inline-start" />}Abandon
              attempt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revision history</DialogTitle>
            <DialogDescription>
              Restoring creates a new revision. Earlier versions remain available.
            </DialogDescription>
          </DialogHeader>
          <div className="revision-list">
            {history.map((item) => (
              <div key={item.revision}>
                <span className="revision-number">{item.revision}</span>
                <div>
                  <strong>{item.revision === 1 ? 'Original baseline' : `Revision ${item.revision}`}</strong>
                  <small>
                    {item.changedFields} changes · {relativeTime(item.at)}
                  </small>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={item.revision === draft?.revision || !!action}
                  onClick={() =>
                    run('restore', async () => {
                      await invoke('draft.restore', {
                        path: page.path,
                        slot,
                        id: draft!.id,
                        revision: item.revision,
                        expectedRevision: historyRevision,
                      });
                      setHistoryOpen(false);
                      toast.success('Restored as a new revision');
                    })
                  }
                >
                  Restore
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function SquarePenIcon() {
  return <FileCode2 data-icon="inline-start" />;
}
function ReviewStatus({ change }: { change: Change }) {
  const review = change.review!;
  return (
    <Alert variant={review.remoteChanged || !review.validation.valid ? 'destructive' : 'default'}>
      <ShieldCheck />
      <AlertTitle>
        {review.remoteChanged
          ? 'The live page changed'
          : review.validation.valid
            ? 'Validation passed'
            : 'Validation needs attention'}
      </AlertTitle>
      <AlertDescription>
        {review.remoteChanged
          ? 'Resolve the remote change before previewing or publishing.'
          : `${review.validation.errors} errors · ${review.validation.warnings} warnings. ${change.scope.selection.merchantId === 'SAMPLE' ? 'Sample schema checks only.' : 'Visual rendering needs a separate preview.'}`}
      </AlertDescription>
    </Alert>
  );
}

export function AgentPanel({
  data,
  page,
  slot = 'body',
  activeSession,
  setActiveSession,
  initialPrompt,
  clearInitialPrompt,
  openSettings,
  target,
}: Omit<Props, 'overlayOpen' | 'refresh'> & { target?: { landingId: string } | { warehouse: true } }) {
  const [view, setView] = useState<ConversationView>(emptyView);
  const [text, setText] = useState(initialPrompt);
  const [sending, setSending] = useState(false);
  const [steer, setSteer] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const warehouse = !!target && 'warehouse' in target;
  const landing = !!target && 'landingId' in target;
  const suggestions = warehouse
    ? [
        [
          'Explore this warehouse',
          'Read the warehouse status and table metadata. Explain what questions the available data can answer. Do not run a query.',
        ],
        [
          'Draft a revenue query',
          'Inspect actual table schemas and save a query that summarizes recent revenue by day. Use verified fields and an explicit date range. Do not run it.',
        ],
        [
          'Find pages to improve',
          'Inspect available schemas and save a query to identify high-traffic pages with weak conversion if those measures exist. Explain metric definitions and limits. Do not invent fields or run a query.',
        ],
      ]
    : landing
      ? [
          [
            'Refine this landing page',
            'Read the landing brief and sections. Improve the copy and section order to support the stated goal. Preserve verified facts and keep unresolved claims as placeholders. Save the local draft.',
          ],
          [
            'Improve the opening',
            'Read this landing project and improve its opening section for the stated audience and offer. Save the local draft and check readiness.',
          ],
          [
            'Review the full page',
            'Review the landing brief and every section. Identify missing facts, unclear actions, and unsupported claims. Explain the highest-value improvements.',
          ],
        ]
      : [
          [
            'Understand this page',
            'Inspect this page and explain its structure, shared templates, and opportunities.',
          ],
          [
            'Make the copy clearer',
            'Improve the clarity of this page’s existing copy. Preserve product facts and claims. Save a local draft and review your edits.',
          ],
          [
            'Plan a thoughtful change',
            'Inspect this page and propose one concrete improvement. Explain the evidence and tradeoffs before editing.',
          ],
        ];
  useEffect(() => {
    if (initialPrompt) {
      setText(initialPrompt);
      clearInitialPrompt();
    }
  }, [initialPrompt]);
  useEffect(() => {
    setView(emptyView);
    let valid = true;
    if (activeSession)
      void invoke<ConversationView>('session.view', { id: activeSession })
        .then((value) => {
          if (valid) setView(value);
        })
        .catch((e) => toast.error(errorText(e)));
    const stop = subscribe((event) => {
      if (event.type === 'conversation' && event.id === activeSession) setView(event.view);
    });
    return () => {
      valid = false;
      stop();
    };
  }, [activeSession]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [view.messages.length, view.messages.at(-1)?.text.length]);
  async function send() {
    if (!text.trim() || sending) return;
    if (!data.auth.connected) {
      openSettings();
      return;
    }
    setSending(true);
    try {
      const id =
        activeSession || (await invoke<Session>('session.create', target ?? { path: page.path, slot })).id;
      if (!activeSession) setActiveSession(id);
      await invoke('session.send', { id, text: text.trim(), requestId: crypto.randomUUID(), steer });
      setText('');
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setSending(false);
    }
  }
  return (
    <div className="agent-panel">
      <div className="agent-panel-heading">
        <span>
          <i className={cn('status-dot', !view.busy && 'neutral')} />
          {view.busy
            ? warehouse
              ? 'Exploring your data'
              : 'Working on your page'
            : warehouse
              ? 'Your warehouse assistant'
              : 'Your storefront partner'}
        </span>
        <IconButton
          label="New conversation"
          onClick={() => {
            setActiveSession(null);
            setText('');
          }}
        >
          <Plus />
        </IconButton>
      </div>
      <div className="conversation-scroll">
        {view.messages.length === 0 ? (
          <div className="agent-welcome">
            <div className="agent-orb">
              <Sparkles />
            </div>
            <h2>
              A little direction.
              <br />A lot of possibility.
            </h2>
            <p>
              {warehouse
                ? 'Explore your schemas and prepare SQL you can inspect, estimate, and run.'
                : landing
                  ? 'Turn your brief into clear sections and copy, saved in your local landing draft.'
                  : 'I can explore this page, refine its content, and prepare a change for you to review.'}
            </p>
            <div className="agent-suggestions">
              {suggestions.map(([label, prompt]) => (
                <button key={label} onClick={() => setText(prompt)}>
                  <Sparkles size={13} />
                  <span>{label}</span>
                  <ArrowUpRight size={13} />
                </button>
              ))}
            </div>
            <span className="agent-welcome-note">
              <ShieldCheck size={12} />{' '}
              {warehouse ? 'You review and run saved queries.' : 'Your agent edits local drafts.'}
            </span>
          </div>
        ) : (
          view.messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}
        {view.busy && !view.messages.some((m) => m.running) && (
          <div className="thinking-indicator">
            <i />
            <i />
            <i />
            <span>Thinking through the next step</span>
          </div>
        )}
        <div ref={bottom} />
      </div>
      <div className="composer-area">
        <div className="scope-chip">
          <FileText size={12} />
          <span>{warehouse ? 'Data warehouse' : page.path === '/' ? 'Homepage' : page.path}</span>
          <span>Pinned context</span>
        </div>
        <div className="agent-composer">
          <Textarea
            aria-label="Message your agent"
            placeholder={
              view.busy ? 'Add a follow-up or steer the agent...' : 'Describe what you want to change...'
            }
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <div className="composer-controls">
            <button className="model-picker" onClick={openSettings}>
              <span className="model-mark">◈</span>
              {data.auth.connected
                ? data.settings.model.replace(/^gpt-/, 'GPT ').replace(/-/g, ' ')
                : 'Connect ChatGPT'}
              <ChevronDown size={11} />
            </button>
            {view.busy ? (
              <div className="send-controls">
                <button className={steer ? 'steer active' : 'steer'} onClick={() => setSteer((v) => !v)}>
                  {steer ? 'Steer' : 'Queue'}
                </button>
                <IconButton
                  label="Stop agent"
                  onClick={() =>
                    void invoke('session.stop', { id: activeSession }).catch((e) => toast.error(errorText(e)))
                  }
                >
                  <Square />
                </IconButton>
                <Button
                  size="icon-sm"
                  disabled={!text.trim() || sending}
                  aria-label="Send follow-up"
                  onClick={send}
                >
                  <ArrowUp />
                </Button>
              </div>
            ) : (
              <Button
                size="icon-sm"
                disabled={!text.trim() || sending}
                aria-label="Send message"
                onClick={send}
              >
                {sending ? <LoaderCircle className="spin" /> : <ArrowUp />}
              </Button>
            )}
          </div>
        </div>
        <div className="composer-footer">
          <span>
            {view.queued ? `${view.queued} follow-up queued` : 'Enter to send · Shift + Enter for a new line'}
          </span>
          {view.tokens > 0 && <span>{(view.tokens / 1000).toFixed(1)}k tokens</span>}
        </div>
      </div>
    </div>
  );
}
function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'tool')
    return (
      <details className={cn('tool-message', message.error && 'tool-error')}>
        <summary>
          {message.running ? (
            <LoaderCircle className="spin" />
          ) : message.error ? (
            <TriangleAlert />
          ) : (
            <Check />
          )}
          <span>{toolNames[message.tool || ''] || message.tool}</span>
          <ChevronRight />
        </summary>
        <pre>{message.text.slice(0, 20000) || 'Running...'}</pre>
      </details>
    );
  return (
    <div className={cn('chat-message', message.role, message.error && 'chat-error')}>
      <div className="message-author">
        {message.role === 'assistant' ? (
          <>
            <Sparkles size={13} />
            STUDIO
          </>
        ) : (
          'YOU'
        )}
      </div>
      <div className="markdown">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{ a: ({ children }) => <span className="markdown-link">{children}</span> }}
        >
          {message.text}
        </ReactMarkdown>
      </div>
      {message.running && <span className="streaming-caret" />}
    </div>
  );
}

function DraftEditor({
  draft,
  path,
  selectedField,
  refresh,
}: {
  draft: Draft;
  path: string;
  selectedField: string;
  refresh: () => Promise<void>;
}) {
  const cacheKey = `studio-unsaved:${draft.id}`;
  const snapshot = (value: Draft) => ({
    revision: value.revision,
    base: Object.fromEntries(value.fields.map((f) => [f.pointer, f.value])),
    values: Object.fromEntries(value.fields.map((f) => [f.pointer, f.value])),
  });
  const [editor, setEditor] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (cached?.base && cached?.values && Number.isSafeInteger(cached.revision))
        return cached as ReturnType<typeof snapshot>;
    } catch {}
    return snapshot(draft);
  });
  const { values, revision: baseRevision } = editor;
  const setValues = (change: (previous: Record<string, string>) => Record<string, string>) =>
    setEditor((previous) => ({ ...previous, values: change(previous.values) }));
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const fields = draft.fields.filter((field) =>
    `${field.widget} ${field.key} ${values[field.pointer] ?? field.value}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );
  const dirty = Object.keys(editor.base).some((key) => values[key] !== editor.base[key]);
  useEffect(() => {
    if (!dirty && draft.revision > baseRevision) setEditor(snapshot(draft));
  }, [draft.revision, dirty, baseRevision]);
  useEffect(() => {
    try {
      if (dirty) localStorage.setItem(cacheKey, JSON.stringify(editor));
      else localStorage.removeItem(cacheKey);
    } catch {
      toast.error('Unsaved edits could not be cached. Save your draft before closing.');
    }
  }, [editor, dirty, cacheKey]);
  useEffect(() => {
    if (selectedField)
      document
        .getElementById(`field-${encodeURIComponent(selectedField)}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedField]);
  async function save() {
    setSaving(true);
    try {
      const result = await invoke<Draft>('draft.save', {
        path,
        slot: draft.slot,
        id: draft.id,
        revision: baseRevision,
        edits: draft.fields
          .filter((f) => (values[f.pointer] ?? f.value) !== f.value)
          .map((f) => ({ pointer: f.pointer, value: values[f.pointer] })),
      });
      setEditor(snapshot(result));
      localStorage.removeItem(cacheKey);
      await refresh();
      toast.success('Draft saved');
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="editor-panel">
      <div className="editor-heading">
        <div>
          <h2>Body container</h2>
          <p>
            {draft.fields.length} editable fields · Revision {draft.revision}
          </p>
        </div>
        <Badge variant="outline">Local draft</Badge>
      </div>
      <div className="editor-context">
        <code>{draft.container}</code>
        <p>
          These fields belong to the page body. The theme may render additional content from other containers.
        </p>
        <Input
          aria-label="Search body fields"
          placeholder="Find text, widget, or field..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query && <span>{fields.length} matching fields</span>}
      </div>
      {baseRevision !== draft.revision && dirty && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>A newer revision is available</AlertTitle>
          <AlertDescription>
            Your unsaved edits are preserved. Copy any text you want to keep before loading the latest
            version.
            <Button size="sm" variant="outline" onClick={() => setEditor(snapshot(draft))}>
              Load latest saved fields
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="field-scroll">
        <FieldGroup>
          {fields.map((field) => (
            <Field
              key={field.pointer}
              className={cn('content-field', selectedField === field.pointer && 'selected-field')}
              id={`field-${encodeURIComponent(field.pointer)}`}
            >
              <div className="field-label-row">
                <FieldLabel htmlFor={field.pointer}>
                  {field.widget.replace(/^[^#]*#/, '')}
                  <span>{field.key}</span>
                </FieldLabel>
                {field.value !== field.before && <span className="field-edited">Edited</span>}
              </div>
              <Textarea
                id={field.pointer}
                value={values[field.pointer] ?? field.value}
                onChange={(event) => setValues((v) => ({ ...v, [field.pointer]: event.target.value }))}
                rows={Math.min(8, Math.max(2, Math.ceil((values[field.pointer] || '').length / 40)))}
                maxLength={16384}
              />
              <div className="field-meta">
                <span>{(values[field.pointer] ?? field.value).length} characters</span>
                {(values[field.pointer] ?? field.value) !== field.before && (
                  <button onClick={() => setValues((v) => ({ ...v, [field.pointer]: field.before }))}>
                    <Undo2 size={10} />
                    Use original
                  </button>
                )}
              </div>
            </Field>
          ))}
        </FieldGroup>
      </div>
      <div className="editor-save">
        <span>
          {dirty ? 'Unsaved edits' : 'All edits saved'}
          {dirty && <i className="draft-dot" />}
        </span>
        <Button size="sm" onClick={save} disabled={!dirty || saving || baseRevision !== draft.revision}>
          {saving ? (
            <LoaderCircle className="spin" data-icon="inline-start" />
          ) : (
            <Check data-icon="inline-start" />
          )}
          Save draft
        </Button>
      </div>
    </div>
  );
}
