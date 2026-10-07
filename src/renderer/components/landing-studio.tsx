import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Archive,
  Check,
  ChevronRight,
  Copy,
  Download,
  FileText,
  History,
  Layers3,
  LoaderCircle,
  Monitor,
  Plus,
  RotateCcw,
  Save,
  Smartphone,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Bootstrap } from '../../shared/types';
import {
  applyBuilderOperation,
  createPageDocument,
  escapeHtml,
  parsePageDocument,
  serializePageDocument,
  textHtml,
  type BuilderOperation,
  type CjsonNode,
  type SectionPattern,
} from '../../shared/page-builder';
import {
  landingBriefSchema,
  landingText,
  type LandingBrief,
  type LandingProject,
  type LandingPreparation,
  type LandingReadiness,
  type LandingRevision,
} from '../../shared/landing';
import { errorText, invoke, subscribe } from '../api';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Field, FieldDescription, FieldGroup, FieldLabel } from './ui/field';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { EmptyState, IconButton, relativeTime } from './common';
import './landing-studio.css';

const blankBrief: LandingBrief = {
  title: '',
  path: '/new-landing-page/',
  audience: '',
  offer: '',
  goal: '',
  brandConstraints: '',
};
const sectionNames: Record<SectionPattern, string> = {
  hero: 'Hero',
  benefits: 'Benefits',
  faq: 'Questions',
  cta: 'Action',
};
const clone = <T,>(value: T): T => structuredClone(value);

export function LandingStudio({
  boot,
  selectedId,
  onAgent,
  onUnsavedChange,
}: {
  boot: Bootstrap;
  selectedId?: string;
  onAgent?: (project: LandingProject, prompt: string) => void;
  onUnsavedChange?: (dirty: boolean) => void;
}) {
  const [projects, setProjects] = useState<LandingProject[]>([]);
  const [project, setProject] = useState<LandingProject | null>(null);
  const [draft, setDraft] = useState<LandingProject | null>(null);
  const [readiness, setReadiness] = useState<LandingReadiness | null>(null);
  const [history, setHistory] = useState<LandingRevision[]>([]);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [preparationOpen, setPreparationOpen] = useState(false);
  const [device, setDevice] = useState('desktop');
  const [pattern, setPattern] = useState<SectionPattern>('benefits');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newer, setNewer] = useState(false);
  const workspace = useRef(boot.workspace.id);
  const selected = useRef<string | null>(null);
  const dirty =
    !!project &&
    !!draft &&
    JSON.stringify([draft.brief, draft.sections]) !== JSON.stringify([project.brief, project.sections]);
  const dirtyRef = useRef(dirty);
  const projectRef = useRef(project);
  projectRef.current = project;
  dirtyRef.current = dirty;
  const reportUnsaved = useRef(onUnsavedChange);
  reportUnsaved.current = onUnsavedChange;
  useEffect(() => {
    reportUnsaved.current?.(dirty);
  }, [dirty]);
  useEffect(() => () => reportUnsaved.current?.(false), []);
  const activeSection = draft?.sections.find((item) => item.id === sectionId) ?? draft?.sections[0];
  const scopedProjects = projects.filter((item) => item.workspaceId === boot.workspace.id);

  function accept(value: LandingProject) {
    if (value.workspaceId !== workspace.current) return;
    selected.current = value.id;
    setProject(value);
    setDraft(clone(value));
    setNewer(false);
    setSectionId((current) =>
      value.sections.some((section) => section.id === current) ? current : (value.sections[0]?.id ?? null)
    );
    setProjects((current) => [value, ...current.filter((item) => item.id !== value.id)]);
  }
  async function open(id: string) {
    if (dirty && id !== project?.id) {
      toast.info('Save or discard your edits before opening another project.');
      return;
    }
    selected.current = id;
    setLoading(true);
    const scope = workspace.current;
    try {
      const [value, status] = await Promise.all([
        invoke<LandingProject>('landing.read', { id }),
        invoke<LandingReadiness>('landing.readiness', { id }),
      ]);
      if (scope !== workspace.current || selected.current !== id) return;
      accept(value);
      setReadiness(status);
    } catch (error) {
      if (scope === workspace.current) toast.error(errorText(error));
    } finally {
      if (scope === workspace.current) setLoading(false);
    }
  }
  useEffect(() => {
    const changed = workspace.current !== boot.workspace.id;
    workspace.current = boot.workspace.id;
    if (changed) {
      selected.current = null;
      dirtyRef.current = false;
      setProject(null);
      setDraft(null);
      setProjects([]);
      setReadiness(null);
      setNewOpen(false);
      setBriefOpen(false);
      setHistoryOpen(false);
      setPreparationOpen(false);
      setNewer(false);
    }
    let cancelled = false;
    const scope = boot.workspace.id;
    const refresh = () =>
      invoke<LandingProject[]>('landing.list')
        .then((values) => {
          if (cancelled || workspace.current !== scope) return;
          setProjects(values);
          const updated = values.find((item) => item.id === selected.current);
          if (updated) {
            if (dirtyRef.current) {
              if (projectRef.current && projectRef.current.revision !== updated.revision) setNewer(true);
            } else {
              accept(updated);
              void invoke<LandingReadiness>('landing.readiness', { id: updated.id })
                .then((status) => {
                  if (!cancelled && workspace.current === scope && selected.current === updated.id)
                    setReadiness(status);
                })
                .catch(() => {});
            }
          }
        })
        .catch((error) => {
          if (!cancelled) toast.error(errorText(error));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    void refresh();
    const unsubscribe = subscribe((event) => {
      if (event.type === 'changed') void refresh();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [boot.workspace.id]);
  useEffect(() => {
    if (selectedId && selectedId !== selected.current) void open(selectedId);
  }, [selectedId, boot.workspace.id]);

  async function create(brief: LandingBrief) {
    setBusy(true);
    try {
      const value = await invoke<LandingProject>('landing.create', { workspaceId: boot.workspace.id, brief });
      accept(value);
      setNewOpen(false);
      setReadiness(await invoke<LandingReadiness>('landing.readiness', { id: value.id }));
      toast.success('Local landing draft created');
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!draft || !project) return;
    setBusy(true);
    try {
      const value = await invoke<LandingProject>('landing.update', {
        workspaceId: project.workspaceId,
        id: project.id,
        revision: project.revision,
        brief: draft.brief,
        sections: draft.sections,
      });
      accept(value);
      setReadiness(await invoke<LandingReadiness>('landing.readiness', { id: value.id }));
      toast.success(`Revision ${value.revision} saved`);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  function modify(operation: BuilderOperation) {
    if (!draft) return;
    try {
      const content = serializePageDocument(createPageDocument(draft.sections));
      const sections = parsePageDocument(applyBuilderOperation(content, operation)).childWidgets;
      if (!sections.length) {
        toast.info('Keep at least one section in the page.');
        return;
      }
      setDraft({ ...draft, sections });
      if (operation.kind === 'duplicate')
        setSectionId(
          sections[sections.findIndex((section) => section.id === operation.nodeId) + 1]?.id ?? sectionId
        );
      if (!sections.some((section) => section.id === sectionId)) setSectionId(sections[0].id);
    } catch (error) {
      toast.error(errorText(error));
    }
  }
  function addSection() {
    if (!draft) return;
    const document = createPageDocument(draft.sections);
    const sections = parsePageDocument(
      applyBuilderOperation(serializePageDocument(document), { kind: 'add', pattern, parentId: document.id })
    ).childWidgets;
    setDraft({ ...draft, sections });
    setSectionId(sections.at(-1)!.id);
  }
  function updateNode(id: string, key: string, value: string) {
    if (!draft || busy) return;
    const next = clone(draft);
    function visit(node: CjsonNode) {
      if (node.id === id) {
        if (key === 'title') node.title = value;
        else if (key === 'html') {
          const tag = String(node.config.html ?? '').match(/^<(h[1-6]|p)>/i)?.[1] ?? 'p';
          node.config.html = textHtml(value, tag);
        } else
          node.config[key] = ['accordionItemTitle', 'buttonText'].includes(key) ? escapeHtml(value) : value;
      }
      node.childWidgets.forEach(visit);
    }
    next.sections.forEach(visit);
    setDraft(next);
  }
  async function showHistory() {
    if (!project) return;
    try {
      setHistory(await invoke<LandingRevision[]>('landing.history', { id: project.id }));
      setHistoryOpen(true);
    } catch (error) {
      toast.error(errorText(error));
    }
  }
  async function restore(revision: number) {
    if (!project) return;
    setBusy(true);
    try {
      accept(
        await invoke<LandingProject>('landing.restore', {
          workspaceId: project.workspaceId,
          id: project.id,
          revision: project.revision,
          restoreRevision: revision,
        })
      );
      setHistoryOpen(false);
      toast.success('Earlier draft restored as a new revision');
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function exportProject() {
    if (!project) return;
    setBusy(true);
    try {
      const result = await invoke<{ saved: boolean }>('landing.export', {
        workspaceId: project.workspaceId,
        id: project.id,
        revision: project.revision,
      });
      if (result.saved) toast.success('Landing package exported');
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function archive() {
    if (!project) return;
    setBusy(true);
    try {
      const archived = await invoke<LandingProject>('landing.archive', {
        workspaceId: project.workspaceId,
        id: project.id,
        revision: project.revision,
      });
      setProjects((values) => values.filter((value) => value.id !== project.id));
      setProject(null);
      setDraft(null);
      selected.current = null;
      toast.success('Local project archived', {
        action: {
          label: 'Undo',
          onClick: () => {
            void invoke<LandingProject>('landing.restore', {
              workspaceId: archived.workspaceId,
              id: archived.id,
              revision: archived.revision,
              restoreRevision: project.revision,
            })
              .then(accept)
              .catch((error) => toast.error(errorText(error)));
          },
        },
      });
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="landing-studio">
      {!project ||
      !draft ||
      project.workspaceId !== boot.workspace.id ||
      draft.workspaceId !== boot.workspace.id ? (
        <>
          <div className="landing-home-heading">
            <div>
              <span className="eyebrow">LANDING PAGES</span>
              <h1>Give your next idea a place to land.</h1>
              <p>
                Turn a brief into a native page draft. Shape the story, review the details, and keep every
                version.
              </p>
            </div>
            <Button onClick={() => setNewOpen(true)}>
              <Plus data-icon="inline-start" />
              New landing page
            </Button>
          </div>
          <div className="landing-intro">
            <div className="landing-intro-copy">
              <Badge variant="secondary">A dedicated canvas for your next launch</Badge>
              <h2>
                Start with the story.
                <br />
                Build the page around it.
              </h2>
              <p>
                Your audience, offer, and goal become an editable starting point. Drafts are saved on this
                device. Your connected AI provider handles agent requests.
              </p>
              <div className="landing-process">
                <span>
                  <FileText />
                  Write a brief
                </span>
                <ChevronRight />
                <span>
                  <Layers3 />
                  Shape the page
                </span>
                <ChevronRight />
                <span>
                  <Check />
                  Review & export
                </span>
              </div>
              <Button variant="outline" onClick={() => setNewOpen(true)}>
                Create your first draft
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
            <div className="landing-intro-art" aria-hidden="true">
              <div className="landing-art-window">
                <div className="landing-art-dots">
                  <i />
                  <i />
                  <i />
                  <span>YOUR NEXT LANDING PAGE</span>
                </div>
                <div className="landing-art-hero">
                  <small>MADE FOR WHAT COMES NEXT</small>
                  <strong>
                    A clear idea.
                    <br />A memorable page.
                  </strong>
                  <div />
                  <b>
                    Discover the collection <ArrowUpRight />
                  </b>
                </div>
                <div className="landing-art-cards">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div className="landing-art-caption">
                <Layers3 />
                Native sections. Yours to shape.
              </div>
            </div>
          </div>
          <div className="landing-project-heading">
            <div>
              <h2>Your landing projects</h2>
              <p>{boot.workspace.label} · Saved on this device</p>
            </div>
            <Badge variant="outline">
              {scopedProjects.length} {scopedProjects.length === 1 ? 'project' : 'projects'}
            </Badge>
          </div>
          {loading ? (
            <div className="landing-loading">
              <LoaderCircle className="spin" />
              Loading your projects
            </div>
          ) : scopedProjects.length ? (
            <div className="landing-project-grid">
              {scopedProjects.map((item) => (
                <button className="landing-project-card" key={item.id} onClick={() => void open(item.id)}>
                  <div className="landing-project-visual">
                    <div />
                    <strong>{item.brief.title}</strong>
                    <i />
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="landing-project-card-body">
                    <div>
                      <h3>{item.brief.title}</h3>
                      <ArrowUpRight />
                    </div>
                    <p>{item.brief.path}</p>
                    <footer>
                      <Badge variant="secondary">Local draft</Badge>
                      <span>
                        v{item.revision} · {relativeTime(item.updatedAt)}
                      </span>
                    </footer>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="landing-no-projects">
              <EmptyState
                title="Your next campaign starts here"
                description="Create a brief to get a local draft with an editable hero, benefits, questions, and call to action."
                icon={<FileText />}
              >
                <Button variant="outline" onClick={() => setNewOpen(true)}>
                  <Plus data-icon="inline-start" />
                  Write a brief
                </Button>
              </EmptyState>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="landing-editor-heading">
            <div className="landing-editor-title">
              <IconButton
                label="Back to landing projects"
                onClick={() => {
                  if (dirty) {
                    toast.info('Save or discard your edits first.');
                    return;
                  }
                  setProject(null);
                  setDraft(null);
                  selected.current = null;
                }}
              >
                <ArrowLeft />
              </IconButton>
              <div>
                <h1>{draft.brief.title}</h1>
                <p>
                  {boot.workspace.label}
                  {draft.brief.path} <span>· Revision {project.revision}</span>
                </p>
              </div>
              <Badge variant="secondary">Local draft</Badge>
            </div>
            <div className="landing-editor-actions">
              <IconButton label="Version history" onClick={() => void showHistory()} disabled={busy}>
                <History />
              </IconButton>
              <Button variant="outline" size="sm" onClick={exportProject} disabled={busy || dirty}>
                <Download data-icon="inline-start" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreparationOpen(true)}
                disabled={busy || dirty}
              >
                <Check data-icon="inline-start" />
                Prepare for storefront
              </Button>
              <Button size="sm" onClick={save} disabled={busy || !dirty}>
                {busy ? (
                  <LoaderCircle className="spin" data-icon="inline-start" />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                {dirty ? 'Save draft' : 'Saved'}
              </Button>
            </div>
          </div>
          {newer && (
            <Alert>
              <RotateCcw />
              <AlertTitle>A newer revision is available</AlertTitle>
              <AlertDescription>
                Your local edits are still here. Copy anything you need, then discard and reload before
                saving.
              </AlertDescription>
            </Alert>
          )}
          {readiness && (!readiness.parentExists || !readiness.pathAvailableInCachedCatalog) && (
            <Alert>
              <FileText />
              <AlertTitle>Check the proposed page path</AlertTitle>
              <AlertDescription>
                {!readiness.pathAvailableInCachedCatalog
                  ? 'This path now exists in the cached catalog. Update the brief with a different path before exporting.'
                  : `The parent ${readiness.parentPath} is not in the cached catalog. It must exist before this page can be created on the storefront.`}
              </AlertDescription>
            </Alert>
          )}
          <div className="landing-editor-workspace">
            <aside className="landing-outline">
              <div className="landing-panel-heading">
                <div>
                  <span className="eyebrow">PAGE STRUCTURE</span>
                  <h2>Your story, section by section</h2>
                </div>
                <Badge variant="outline">{draft.sections.length}</Badge>
              </div>
              <div className="landing-outline-list">
                {draft.sections.map((section, index) => (
                  <button
                    key={section.id}
                    className={cn('landing-outline-item', activeSection?.id === section.id && 'is-active')}
                    onClick={() => setSectionId(section.id)}
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <strong>{section.title || `Section ${index + 1}`}</strong>
                      <small>{leafNodes(section).length} editable fields</small>
                    </div>
                    <ChevronRight />
                  </button>
                ))}
              </div>
              <div className="landing-add-section">
                <Field>
                  <FieldLabel id="landing-pattern-label">Add a section</FieldLabel>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    spacing={1}
                    className="grid grid-cols-2 gap-1"
                    value={pattern}
                    onValueChange={(value) => value && setPattern(value as SectionPattern)}
                    aria-labelledby="landing-pattern-label"
                    disabled={busy}
                  >
                    {Object.entries(sectionNames).map(([key, name]) => (
                      <ToggleGroupItem key={key} value={key}>
                        {name}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </Field>
                <Button variant="outline" size="sm" onClick={addSection} disabled={busy}>
                  <Plus data-icon="inline-start" />
                  Add section
                </Button>
              </div>
              <div className="landing-outline-footer">
                <Button variant="ghost" size="sm" onClick={() => setBriefOpen(true)}>
                  <FileText data-icon="inline-start" />
                  View the brief
                </Button>
                <Button variant="ghost" size="sm" onClick={archive} disabled={busy || dirty}>
                  <Archive data-icon="inline-start" />
                  Archive project
                </Button>
              </div>
            </aside>
            <main className="landing-canvas">
              <div className="landing-canvas-toolbar">
                <div>
                  <span className="landing-preview-dot" />
                  Local layout preview
                </div>
                <ToggleGroup
                  type="single"
                  value={device}
                  onValueChange={(value) => value && setDevice(value)}
                  size="sm"
                  aria-label="Preview width"
                >
                  <ToggleGroupItem value="desktop" aria-label="Desktop preview">
                    <Monitor />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="mobile" aria-label="Mobile preview">
                    <Smartphone />
                  </ToggleGroupItem>
                </ToggleGroup>
                <span>{dirty ? 'Unsaved edits' : 'Draft saved'}</span>
              </div>
              <div className="landing-canvas-scroll">
                <div className={cn('landing-preview-page', device === 'mobile' && 'is-mobile')}>
                  <div className="landing-preview-brand">
                    <strong>{boot.workspace.label}</strong>
                    <span>CAMPAIGN PREVIEW</span>
                  </div>
                  {draft.sections.map((section, index) => (
                    <div
                      key={section.id}
                      onClick={() => setSectionId(section.id)}
                      className={cn(
                        'landing-preview-section',
                        activeSection?.id === section.id && 'is-selected',
                        index === 0 && 'is-first'
                      )}
                    >
                      <NativePreview node={section} />
                      <span className="landing-preview-section-label">
                        {section.title || `Section ${index + 1}`}
                      </span>
                    </div>
                  ))}
                  <footer className="landing-preview-footer">{boot.workspace.label} · Local draft</footer>
                </div>
                <p className="landing-preview-disclaimer">
                  An approximate layout using your native content. The live theme, imagery, and responsive
                  styles may differ.
                </p>
              </div>
            </main>
            <aside className="landing-inspector">
              <div className="landing-inspector-top">
                <div>
                  <span className="eyebrow">EDIT SECTION</span>
                  <h2>{activeSection?.title || 'Section'}</h2>
                </div>
                {activeSection && (
                  <div className="landing-section-actions">
                    <IconButton
                      label="Move section up"
                      disabled={busy || draft.sections[0]?.id === activeSection.id}
                      onClick={() => modify({ kind: 'move', nodeId: activeSection.id, direction: 'up' })}
                    >
                      <ArrowUp />
                    </IconButton>
                    <IconButton
                      label="Move section down"
                      disabled={busy || draft.sections.at(-1)?.id === activeSection.id}
                      onClick={() => modify({ kind: 'move', nodeId: activeSection.id, direction: 'down' })}
                    >
                      <ArrowDown />
                    </IconButton>
                    <IconButton
                      label="Duplicate section"
                      disabled={busy}
                      onClick={() => modify({ kind: 'duplicate', nodeId: activeSection.id })}
                    >
                      <Copy />
                    </IconButton>
                    <IconButton
                      label="Remove section"
                      disabled={busy || draft.sections.length < 2}
                      onClick={() => modify({ kind: 'remove', nodeId: activeSection.id })}
                    >
                      <Trash2 />
                    </IconButton>
                  </div>
                )}
              </div>
              <div className="landing-inspector-scroll">
                {activeSection && (
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="landing-section-title">Section name</FieldLabel>
                      <Input
                        id="landing-section-title"
                        value={activeSection.title || ''}
                        onChange={(event) => updateNode(activeSection.id, 'title', event.target.value)}
                        maxLength={150}
                        disabled={busy}
                      />
                    </Field>
                    {leafNodes(activeSection).map((node) => (
                      <NativeField key={node.id} node={node} onChange={updateNode} disabled={busy} />
                    ))}
                  </FieldGroup>
                )}
                <div className="landing-agent-card">
                  <Sparkles />
                  <strong>Make the brief work harder.</strong>
                  <p>
                    The agent shares this brief and draft with your connected AI provider to refine the offer,
                    audience, and brand voice.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!onAgent || dirty || busy}
                    onClick={() =>
                      onAgent?.(
                        project,
                        `Improve this local landing project using its saved brief. Read project ${project.id}, preserve verified facts, replace placeholder copy where the brief supports it, and keep the page local. Ask for missing facts instead of inventing them.`
                      )
                    }
                  >
                    <Sparkles data-icon="inline-start" />
                    Refine with agent
                  </Button>
                  {dirty && <small>Save your edits before starting the agent.</small>}
                </div>
              </div>
              {dirty && (
                <div className="landing-discard">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      dirtyRef.current = false;
                      void open(project.id);
                    }}
                  >
                    <RotateCcw data-icon="inline-start" />
                    Discard unsaved edits
                  </Button>
                </div>
              )}
            </aside>
          </div>
          <div className="landing-status-line">
            <span>
              <Check />
              Stored locally · Native editable sections · Version history
            </span>
            <span>
              Structured starter · Review placeholder copy and button destinations before publishing
            </span>
          </div>
        </>
      )}
      <BriefDialog
        open={newOpen && workspace.current === boot.workspace.id}
        onOpenChange={setNewOpen}
        initial={blankBrief}
        busy={busy}
        create
        onSave={create}
      />
      {draft && draft.workspaceId === boot.workspace.id && (
        <BriefDialog
          open={briefOpen}
          onOpenChange={setBriefOpen}
          initial={draft.brief}
          busy={busy}
          onSave={(brief) => {
            setDraft({ ...draft, brief });
            setBriefOpen(false);
          }}
        />
      )}
      {project && project.workspaceId === boot.workspace.id && (
        <LandingPreparationDialog
          key={`${project.workspaceId}:${project.id}:${project.revision}`}
          project={project}
          open={preparationOpen}
          onOpenChange={setPreparationOpen}
        />
      )}
      <Dialog open={historyOpen && project?.workspaceId === boot.workspace.id} onOpenChange={setHistoryOpen}>
        <DialogContent className="landing-history-dialog">
          <DialogHeader>
            <DialogTitle>Every version, kept.</DialogTitle>
            <DialogDescription>
              Restoring creates a new revision. Current unsaved edits are replaced.
            </DialogDescription>
          </DialogHeader>
          <div className="landing-history-list">
            {history.map((item) => (
              <div key={item.revision}>
                <span className="landing-history-icon">
                  <History />
                </span>
                <div>
                  <strong>
                    Revision {item.revision}
                    {item.revision === project?.revision ? ' · Current' : ''}
                  </strong>
                  <p>{item.note}</p>
                  <small>
                    {new Date(item.at).toLocaleString()} · {item.sectionCount} sections
                  </small>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || item.revision === project?.revision}
                  onClick={() => void restore(item.revision)}
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

function LandingPreparationDialog({
  project,
  open,
  onOpenChange,
}: {
  project: LandingProject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [preparation, setPreparation] = useState<LandingPreparation | null>(null);
  const [groupTemplate, setGroupTemplate] = useState('');
  const [itemTemplate, setItemTemplate] = useState('');
  const [confirmedHost, setConfirmedHost] = useState('');
  const [step, setStep] = useState('templates');
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const target = { workspaceId: project.workspaceId, id: project.id, revision: project.revision };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void invoke<LandingPreparation | null>('landing.preparation', { id: project.id })
      .then((value) => {
        if (cancelled) return;
        setPreparation(value);
        if (value && !value.stale) {
          setGroupTemplate(value.groupTemplate ?? '');
          setItemTemplate(value.itemTemplate ?? '');
        }
      })
      .catch((error) => {
        if (!cancelled) toast.error(errorText(error));
      });
    return () => {
      cancelled = true;
    };
  }, [open, project.id]);
  async function prepare() {
    setBusy(true);
    try {
      const value = await invoke<LandingPreparation>('landing.prepare', {
        ...target,
        ...(groupTemplate ? { groupTemplate } : {}),
        ...(itemTemplate ? { itemTemplate } : {}),
      });
      if (!mounted.current) return;
      setPreparation(value);
      setConfirmedHost('');
      if (value.groupTemplate && value.itemTemplate) setStep('ids');
    } catch (error) {
      if (mounted.current) toast.error(errorText(error));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function reserve() {
    setBusy(true);
    try {
      const value = await invoke<LandingPreparation>('landing.reserveNativeIds', {
        ...target,
        confirmedHost,
      });
      if (!mounted.current) return;
      setPreparation(value);
      setConfirmedHost('');
      setStep('review');
      toast.success('Native IDs reserved. No page was published.');
    } catch (error) {
      if (mounted.current) toast.error(errorText(error));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function exportPrepared() {
    setBusy(true);
    try {
      const result = await invoke<{ saved: boolean }>('landing.prepareExport', target);
      if (mounted.current && result.saved) toast.success('Preparation package exported');
    } catch (error) {
      if (mounted.current) toast.error(errorText(error));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const current = preparation && !preparation.stale;
  const canReserve =
    current &&
    !preparation.sample &&
    preparation.parent &&
    preparation.pathAvailable &&
    preparation.groupTemplate &&
    preparation.itemTemplate &&
    preparation.validation.status === 'passed' &&
    preparation.nativeIds.status !== 'reserved';
  const choices = (type: 'group' | 'item') =>
    preparation?.templates.filter(
      (item) =>
        item.pageType === type &&
        item.metadataAvailable &&
        !item.system &&
        (type !== 'group' || item.visualBuilder === true)
    ) ?? [];
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <DialogContent className="landing-preparation-dialog">
        <DialogHeader>
          <DialogTitle>Prepare for storefront</DialogTitle>
          <DialogDescription>
            Review revision {project.revision} for {project.selection.storefront.host}
            {project.brief.path}. Preparation does not create or publish a page.
          </DialogDescription>
        </DialogHeader>
        <ToggleGroup
          type="single"
          value={step}
          onValueChange={(value) => value && setStep(value)}
          variant="outline"
          spacing={1}
          aria-label="Preparation step"
          className="landing-preparation-steps"
          disabled={busy}
        >
          <ToggleGroupItem value="templates">1 · Templates</ToggleGroupItem>
          <ToggleGroupItem value="ids">2 · Native IDs</ToggleGroupItem>
          <ToggleGroupItem value="review">3 · Review package</ToggleGroupItem>
        </ToggleGroup>
        <div className="landing-preparation-body">
          {preparation?.stale && (
            <Alert>
              <RotateCcw />
              <AlertTitle>The draft changed</AlertTitle>
              <AlertDescription>
                Refresh this preparation to review the current saved revision.
              </AlertDescription>
            </Alert>
          )}
          {step === 'templates' && (
            <>
              <p className="landing-preparation-intro">
                Read the current catalog and active theme, then choose the templates this new page would use.
                The parent must already exist.
              </p>
              <div className="landing-preparation-facts">
                <div>
                  <span>New page</span>
                  <strong>{project.brief.path}</strong>
                </div>
                <div>
                  <span>Parent page</span>
                  <strong>
                    {preparation?.parentPath ?? project.brief.path.split('/').slice(0, -2).join('/') + '/'}
                  </strong>
                </div>
                <div>
                  <span>Parent check</span>
                  <strong>{preparation?.parent ? 'Direct read confirmed' : 'Not verified'}</strong>
                </div>
                <div>
                  <span>Path check</span>
                  <strong>
                    {preparation
                      ? preparation.pathAvailable
                        ? 'Absent from cached catalog'
                        : 'Already in catalog'
                      : 'Not checked'}
                  </strong>
                </div>
              </div>
              {preparation && (
                <FieldGroup className="landing-preparation-fields">
                  <Field>
                    <FieldLabel htmlFor="landing-group-template">Page template</FieldLabel>
                    <select
                      id="landing-group-template"
                      value={groupTemplate}
                      onChange={(event) => setGroupTemplate(event.target.value)}
                      disabled={busy || preparation.sample}
                    >
                      <option value="">Choose a group template</option>
                      {choices('group').map((item) => (
                        <option key={item.name} value={item.name}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <FieldDescription>
                      Only group templates with known visual-builder support are listed. The body slot still
                      needs inspection.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="landing-item-template">Item template</FieldLabel>
                    <select
                      id="landing-item-template"
                      value={itemTemplate}
                      onChange={(event) => setItemTemplate(event.target.value)}
                      disabled={busy || preparation.sample}
                    >
                      <option value="">Choose an item template</option>
                      {choices('item').map((item) => (
                        <option key={item.name} value={item.name}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <FieldDescription>
                      UltraCart also requires the template for any item pages under this page.
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              )}
              <Button onClick={prepare} disabled={busy}>
                {busy ? <LoaderCircle className="spin" /> : <RotateCcw />}
                {preparation ? 'Refresh & validate selection' : 'Read catalog & template choices'}
              </Button>
              {preparation?.catalogCheckedAt && (
                <small className="landing-preparation-note">
                  Read {new Date(preparation.catalogCheckedAt).toLocaleString()} · Active theme{' '}
                  {preparation.themeId}
                </small>
              )}
            </>
          )}
          {step === 'ids' && (
            <>
              <div className="landing-preparation-check">
                <Layers3 />
                <div>
                  <h3>
                    {preparation?.nativeIds.status === 'reserved'
                      ? 'Native IDs reserved'
                      : 'Give each element a native ID'}
                  </h3>
                  <p>
                    {preparation
                      ? `${preparation.nativeIds.count} native elements in this page.`
                      : 'Read the catalog and choose both templates first.'}{' '}
                    The editable draft keeps its local IDs. Reserved IDs are saved in the preparation package.
                  </p>
                </div>
              </div>
              {preparation?.validation && (
                <Alert>
                  <FileText />
                  <AlertTitle>Local validation: {preparation.validation.status}</AlertTitle>
                  <AlertDescription>{preparation.validation.message}</AlertDescription>
                </Alert>
              )}
              {preparation?.validation.report && (
                <div className="landing-preparation-diagnostics">
                  <p>
                    {preparation.validation.report.errors} errors · {preparation.validation.report.warnings}{' '}
                    warnings
                  </p>
                  {preparation.validation.report.diagnostics.slice(0, 6).map((item, index) => (
                    <p key={index}>
                      <strong>{item.severity}</strong> · {item.message}
                    </p>
                  ))}
                </div>
              )}
              {preparation?.nativeIds.status !== 'reserved' && (
                <Field>
                  <FieldLabel htmlFor="landing-confirm-host">Confirm the storefront host</FieldLabel>
                  <Input
                    id="landing-confirm-host"
                    value={confirmedHost}
                    onChange={(event) => setConfirmedHost(event.target.value)}
                    placeholder={project.selection.storefront.host}
                    disabled={busy || !canReserve}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <FieldDescription>
                    This allocates widget IDs in the selected storefront. It does not create a page. If a
                    request has an uncertain result, Studio keeps its receipt and stops automatic retries.
                  </FieldDescription>
                </Field>
              )}
              <Button
                onClick={reserve}
                disabled={busy || !canReserve || confirmedHost !== project.selection.storefront.host}
              >
                {busy ? <LoaderCircle className="spin" /> : <Check />}Reserve native IDs
              </Button>
            </>
          )}
          {step === 'review' && (
            <>
              <div className="landing-preparation-check">
                <FileText />
                <div>
                  <h3>A reviewable handoff</h3>
                  <p>
                    The package includes the exact native body, brief, parent path, template choices,
                    validation report, and any allocation receipt.
                  </p>
                </div>
              </div>
              {preparation && (
                <div className="landing-preparation-facts">
                  <div>
                    <span>Page template</span>
                    <strong>{preparation.groupTemplate ?? 'Not selected'}</strong>
                  </div>
                  <div>
                    <span>Item template</span>
                    <strong>{preparation.itemTemplate ?? 'Not selected'}</strong>
                  </div>
                  <div>
                    <span>Native IDs</span>
                    <strong>
                      {preparation.nativeIds.status === 'reserved'
                        ? 'Reserved for this document'
                        : 'Local placeholders'}
                    </strong>
                  </div>
                  <div>
                    <span>Live verification</span>
                    <strong>Pending</strong>
                  </div>
                </div>
              )}
              {!!preparation?.blockers.length && (
                <Alert>
                  <FileText />
                  <AlertTitle>Preparation still needs attention</AlertTitle>
                  <AlertDescription>
                    <ul>
                      {preparation.blockers.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              <h3>Before this page can go live</h3>
              <ol className="landing-preparation-remaining">
                {(
                  preparation?.remainingSteps ?? [
                    'Read the catalog and validate this revision to get an exact preparation report.',
                  ]
                ).map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ol>
              <Button onClick={exportPrepared} disabled={busy || !current}>
                {busy ? <LoaderCircle className="spin" /> : <Download />}Export preparation package
              </Button>
              <small className="landing-preparation-note">
                Export is available with blockers so the remaining work stays visible in the handoff.
              </small>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {step !== 'review' && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setStep(step === 'templates' ? 'ids' : 'review')}
            >
              Next <ArrowRight />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function leafNodes(root: CjsonNode) {
  const result: CjsonNode[] = [];
  function visit(node: CjsonNode) {
    if (['text', 'textblock', 'headline', 'button', 'accordionitem'].includes(node.type)) result.push(node);
    node.childWidgets.forEach(visit);
  }
  visit(root);
  return result;
}
function NativeField({
  node,
  onChange,
  disabled,
}: {
  node: CjsonNode;
  onChange: (id: string, key: string, value: string) => void;
  disabled: boolean;
}) {
  const id = `landing-field-${node.id}`;
  if (node.type === 'button')
    return (
      <>
        <Field>
          <FieldLabel htmlFor={id}>Button label</FieldLabel>
          <Input
            id={id}
            value={landingText(node.config.buttonText)}
            onChange={(event) => onChange(node.id, 'buttonText', event.target.value)}
            maxLength={150}
            disabled={disabled}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-url`}>Button destination</FieldLabel>
          <Input
            id={`${id}-url`}
            value={String(node.config.buttonUrlAction || '')}
            onChange={(event) => onChange(node.id, 'buttonUrlAction', event.target.value)}
            placeholder="/shop/"
            maxLength={2048}
            disabled={disabled}
          />
          <FieldDescription>A storefront path or HTTPS address.</FieldDescription>
        </Field>
      </>
    );
  if (node.type === 'accordionitem')
    return (
      <Field>
        <FieldLabel htmlFor={id}>Question</FieldLabel>
        <Input
          id={id}
          value={landingText(node.config.accordionItemTitle)}
          onChange={(event) => onChange(node.id, 'accordionItemTitle', event.target.value)}
          maxLength={300}
          disabled={disabled}
        />
      </Field>
    );
  return (
    <Field>
      <FieldLabel htmlFor={id}>{node.title || 'Text'}</FieldLabel>
      <Textarea
        id={id}
        value={landingText(node.config.html || node.config.text)}
        onChange={(event) => onChange(node.id, 'html', event.target.value)}
        rows={String(node.config.html || '').includes('<h') ? 2 : 4}
        maxLength={4000}
        disabled={disabled}
      />
    </Field>
  );
}

function NativePreview({ node }: { node: CjsonNode }) {
  const children = node.childWidgets.map((child) => <NativePreview key={child.id} node={child} />);
  if (['text', 'textblock', 'headline'].includes(node.type)) {
    const html = String(node.config.html || node.config.text || '');
    const Tag = (html.match(/^<(h[1-3])>/i)?.[1]?.toLowerCase() || 'p') as 'h1' | 'h2' | 'h3' | 'p';
    return <Tag>{landingText(html)}</Tag>;
  }
  if (node.type === 'button')
    return (
      <span className="landing-native-button">
        <span>{landingText(node.config.buttonText) || 'Continue'}</span>
        <ArrowUpRight />
      </span>
    );
  if (node.type === 'accordionitem')
    return (
      <div className="landing-native-question">
        <h3>{landingText(node.config.accordionItemTitle)}</h3>
        {children}
      </div>
    );
  if (node.type === 'image') return <div className="landing-native-image">Image asset preview</div>;
  if (node.type === 'row' && node.childWidgets.length > 1)
    return (
      <div
        className="landing-native-columns"
        style={{ gridTemplateColumns: `repeat(${Math.min(node.childWidgets.length, 4)}, minmax(0,1fr))` }}
      >
        {children}
      </div>
    );
  return <div className={`landing-native-${node.type}`}>{children}</div>;
}

function BriefDialog({
  open,
  onOpenChange,
  initial,
  busy,
  create = false,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: LandingBrief;
  busy: boolean;
  create?: boolean;
  onSave: (brief: LandingBrief) => void;
}) {
  const [brief, setBrief] = useState(initial);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [pathEdited, setPathEdited] = useState(false);
  useEffect(() => {
    if (open) {
      setBrief(clone(initial));
      setIssues({});
      setPathEdited(!create);
    }
  }, [open]);
  function set(key: keyof LandingBrief, value: string) {
    setBrief((current) => ({
      ...current,
      [key]: value,
      ...(key === 'title' && !pathEdited
        ? {
            path: `/${
              value
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '') || 'new-landing-page'
            }/`,
          }
        : {}),
    }));
    if (key === 'path') setPathEdited(true);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const result = landingBriefSchema.safeParse(brief);
    if (!result.success) {
      setIssues(
        Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]))
      );
      return;
    }
    setIssues({});
    onSave(result.data);
  }
  const fields: {
    key: keyof LandingBrief;
    label: string;
    placeholder: string;
    description?: string;
    rows?: number;
    max: number;
  }[] = [
    { key: 'title', label: 'Page title', placeholder: 'The everyday essentials collection', max: 160 },
    {
      key: 'path',
      label: 'Proposed storefront path',
      placeholder: '/everyday-essentials/',
      description: 'A proposed address. Creating this draft does not create a live page.',
      max: 500,
    },
    {
      key: 'audience',
      label: 'Who is this for?',
      placeholder: 'New customers who want a simple daily routine.',
      rows: 2,
      max: 2000,
    },
    {
      key: 'offer',
      label: 'What is the offer?',
      placeholder: 'Describe the products, bundle, or service. Include only confirmed details.',
      rows: 3,
      max: 3000,
    },
    {
      key: 'goal',
      label: 'What should the visitor do?',
      placeholder: 'Explore the collection and choose the right product.',
      rows: 2,
      max: 2000,
    },
    {
      key: 'brandConstraints',
      label: 'Voice, facts, and boundaries',
      placeholder: 'Use a calm, direct voice. Avoid unverified claims. Do not invent discounts or reviews.',
      rows: 3,
      max: 4000,
    },
  ];
  return (
    <Dialog open={open} onOpenChange={(value) => !busy && onOpenChange(value)}>
      <DialogContent className="landing-brief-dialog">
        <DialogHeader>
          <DialogTitle>{create ? 'Start with a good brief.' : 'The story behind the page.'}</DialogTitle>
          <DialogDescription>
            {create
              ? 'Create a structured starter with native sections. Your agent can refine it after you review the brief.'
              : 'Changes to the brief are saved with your next draft revision.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <div className="landing-brief-fields">
            <FieldGroup>
              {fields.map((field) => (
                <Field key={field.key} data-invalid={!!issues[field.key]}>
                  <FieldLabel htmlFor={`landing-brief-${field.key}`}>
                    {field.label}
                    {field.key === 'brandConstraints' && <span className="landing-optional">Optional</span>}
                  </FieldLabel>
                  {field.rows ? (
                    <Textarea
                      id={`landing-brief-${field.key}`}
                      value={brief[field.key]}
                      onChange={(event) => set(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      rows={field.rows}
                      maxLength={field.max}
                      aria-invalid={!!issues[field.key]}
                      disabled={busy}
                    />
                  ) : (
                    <Input
                      id={`landing-brief-${field.key}`}
                      value={brief[field.key]}
                      onChange={(event) => set(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      maxLength={field.max}
                      aria-invalid={!!issues[field.key]}
                      disabled={busy}
                    />
                  )}
                  {(issues[field.key] || field.description) && (
                    <FieldDescription>{issues[field.key] || field.description}</FieldDescription>
                  )}
                </Field>
              ))}
            </FieldGroup>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" data-icon="inline-start" />
              ) : create ? (
                <Layers3 data-icon="inline-start" />
              ) : (
                <Check data-icon="inline-start" />
              )}
              {create ? 'Create local draft' : 'Update brief'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
