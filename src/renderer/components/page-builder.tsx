import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  Layers3,
  LayoutTemplate,
  LoaderCircle,
  MessageSquare,
  Monitor,
  Plus,
  Search,
  Smartphone,
  Trash2,
  Type,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  BuilderNode,
  BuilderOperation,
  PageBuilderView,
  SectionPattern,
} from '../../shared/page-builder';
import { errorText, invoke } from '../api';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Field, FieldDescription, FieldGroup, FieldLabel } from './ui/field';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { EmptyState, Loading } from './common';
import './page-builder.css';

const patterns: { kind: SectionPattern; label: string; description: string; glyph: string }[] = [
  { kind: 'hero', label: 'Hero', description: 'Headline, introduction, action', glyph: 'hero' },
  { kind: 'benefits', label: 'Benefits', description: 'Three reasons to choose you', glyph: 'benefits' },
  { kind: 'faq', label: 'FAQ', description: 'Questions and clear answers', glyph: 'faq' },
  { kind: 'cta', label: 'Call to action', description: 'One clear next step', glyph: 'cta' },
];
type Props = {
  path: string;
  slot?: string;
  revision?: number;
  disabled?: boolean;
  onChange: () => Promise<void> | void;
  onSelectSection?: (node: BuilderNode) => void;
};
const CACHE_PREFIX = 'studio-builder-unsaved:';
const CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 50;
const cacheName = (draftId: string) => `${CACHE_PREFIX}${draftId}`;
function clearCache(draftId: string) {
  try {
    localStorage.removeItem(cacheName(draftId));
  } catch {}
}
// Drop edits cached for drafts that were abandoned: too old, or beyond the newest entries.
function pruneCache() {
  try {
    const entries: { key: string; savedAt: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(CACHE_PREFIX)) continue;
      let savedAt = 0;
      try {
        savedAt = Number(JSON.parse(localStorage.getItem(key) || 'null')?.savedAt) || 0;
      } catch {}
      entries.push({ key, savedAt });
    }
    entries.sort((a, b) => b.savedAt - a.savedAt);
    const now = Date.now();
    entries.forEach((entry, index) => {
      if (index >= CACHE_MAX_ENTRIES || now - entry.savedAt > CACHE_MAX_AGE)
        localStorage.removeItem(entry.key);
    });
  } catch {}
}
function readCache(draftId: string): { revision: number; values: Record<string, string> } | null {
  try {
    const cached = JSON.parse(localStorage.getItem(cacheName(draftId)) || 'null');
    if (cached?.values && typeof cached.values === 'object' && Number.isSafeInteger(cached.revision))
      return cached;
  } catch {}
  return null;
}
function flatten(root: BuilderNode, depth = 0): { node: BuilderNode; depth: number }[] {
  return [{ node: root, depth }, ...root.children.flatMap((child) => flatten(child, depth + 1))];
}

export function PageBuilder({
  path,
  slot = 'body',
  revision,
  disabled = false,
  onChange,
  onSelectSection,
}: Props) {
  const [view, setView] = useState<PageBuilderView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('layers');
  const [device, setDevice] = useState('desktop');
  const [version, setVersion] = useState('draft');
  const [values, setValues] = useState<Record<string, string>>({});
  const [baseRevision, setBaseRevision] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const hydrated = useRef('');
  const activePath = useRef(path);
  activePath.current = path;
  useEffect(pruneCache, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void invoke<PageBuilderView | null>('builder.inspect', { path, slot })
      .then((result) => {
        if (!cancelled) {
          setView(result);
          // The draft no longer exists: its cached edits can never be restored.
          if (!result && hydrated.current) clearCache(hydrated.current);
          // Keep what the user typed when the revision changes; restore cached edits after a remount.
          if (result && hydrated.current !== result.draft.id) {
            const cached = readCache(result.draft.id);
            hydrated.current = result.draft.id;
            setValues(cached?.values ?? {});
            setBaseRevision(cached ? cached.revision : null);
          }
          setSelectedId((current) =>
            result && flatten(result.root).some((item) => item.node.id === current)
              ? current
              : (result?.root.children[0]?.id ?? result?.root.id ?? '')
          );
        }
      })
      .catch((error) => {
        if (!cancelled) setError(errorText(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, slot, revision]);
  const allNodes = useMemo(() => (view ? flatten(view.root) : []), [view]);
  const selected = allNodes.find((item) => item.node.id === selectedId)?.node ?? null;
  const visible = allNodes
    .filter(
      (item) =>
        !query ||
        `${item.node.title} ${item.node.type} ${item.node.text}`.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 400);
  const selectedFields =
    view?.draft.fields.filter(
      (field) =>
        selected &&
        (field.pointer.startsWith(`${selected.pointer}/config/`) ||
          (selected.pointer && field.pointer.startsWith(`${selected.pointer}/childWidgets/`)))
    ) ?? [];
  const dirty =
    !!view &&
    view.draft.fields.some(
      (field) => values[field.pointer] !== undefined && values[field.pointer] !== field.value
    );
  const stale = dirty && baseRevision !== null && view?.draft.revision !== baseRevision;
  const edits = selectedFields
    .filter((field) => values[field.pointer] !== undefined && values[field.pointer] !== field.value)
    .map((field) => ({ pointer: field.pointer, value: values[field.pointer] }));
  const locked = disabled || !!busy;
  const draftId = view?.draft.id;
  useEffect(() => {
    if (!view || !draftId || hydrated.current !== draftId) return;
    try {
      if (dirty)
        localStorage.setItem(
          cacheName(draftId),
          JSON.stringify({ revision: baseRevision, values, savedAt: Date.now() })
        );
      else localStorage.removeItem(cacheName(draftId));
    } catch {
      toast.error('Unsaved edits could not be cached. Save your draft before closing.');
    }
  }, [values, dirty, baseRevision, draftId]);
  function editField(pointer: string, value: string) {
    setValues((current) => ({ ...current, [pointer]: value }));
    setBaseRevision((current) => current ?? view?.draft.revision ?? null);
  }
  function clearEdits() {
    if (view) clearCache(view.draft.id);
    setValues({});
    setBaseRevision(null);
  }
  const parent = allNodes.find((item) => item.node.id === selected?.parentId)?.node;
  const index = parent?.children.findIndex((node) => node.id === selectedId) ?? -1;
  const changedIds = new Set(view?.structureChanges.map((change) => change.id));

  async function execute(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError('');
    try {
      await action();
    } catch (error) {
      if (activePath.current === path) setError(errorText(error));
    } finally {
      if (activePath.current === path) setBusy('');
    }
  }
  async function apply(operation: BuilderOperation) {
    if (!view) return;
    if (dirty) {
      setError('Save or discard your text edits before changing the structure.');
      return;
    }
    await execute(operation.kind, async () => {
      const result = await invoke<PageBuilderView>('builder.apply', {
        path,
        slot,
        id: view.draft.id,
        revision: view.draft.revision,
        operation,
      });
      if (activePath.current !== path) return;
      setView(result);
      clearEdits();
      setRemoving(false);
      setVersion('draft');
      if (operation.kind === 'add') {
        const newNode = result.root.children.find(
          (node) => !view.root.children.some((old) => old.id === node.id)
        );
        if (newNode) setSelectedId(newNode.id);
      } else if (operation.kind === 'remove') setSelectedId(parent?.id ?? result.root.id);
      await onChange();
      toast.success('Page structure saved locally');
    });
  }
  async function openDraft() {
    await execute('open', async () => {
      await invoke('draft.pull', { path, slot });
      const result = await invoke<PageBuilderView>('builder.inspect', { path, slot });
      if (activePath.current !== path) return;
      setView(result);
      if (result) hydrated.current = result.draft.id;
      setSelectedId(result.root.children[0]?.id ?? result.root.id);
      await onChange();
    });
  }
  async function saveText() {
    if (!view || !edits.length || stale) return;
    await execute('text', async () => {
      await invoke('draft.save', { path, slot, id: view.draft.id, revision: view.draft.revision, edits });
      clearCache(view.draft.id);
      const result = await invoke<PageBuilderView>('builder.inspect', { path, slot });
      if (activePath.current !== path) return;
      setView(result);
      clearEdits();
      await onChange();
      toast.success('Section text saved');
    });
  }
  function select(node: BuilderNode) {
    if (edits.length && node.id !== selectedId) {
      setError('Save or discard the selected text edits before choosing another section.');
      return;
    }
    setSelectedId(node.id);
    setRemoving(false);
    setTab('layers');
  }
  if (loading && !view) return <Loading label="Reading page structure" />;
  if (!view)
    return (
      <div className="builder-empty">
        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <EmptyState
          icon={<Layers3 />}
          title="Build on what is already there"
          description="Open a local slot draft to arrange sections, edit their content, and add native UltraCart patterns."
        >
          <Button onClick={() => void openDraft()} disabled={locked}>
            {busy ? (
              <LoaderCircle className="spin" data-icon="inline-start" />
            ) : (
              <LayoutTemplate data-icon="inline-start" />
            )}{' '}
            Open page builder
          </Button>
        </EmptyState>
      </div>
    );
  return (
    <div className="page-builder">
      <div className="builder-heading">
        <div>
          <Layers3 size={17} />
          <strong>Page builder</strong>
          <Badge variant="secondary">Revision {view.draft.revision}</Badge>
        </div>
        <span>
          {busy ? (
            'Saving…'
          ) : dirty ? (
            'Unsaved text edits'
          ) : (
            <>
              <Check size={13} /> Saved locally
            </>
          )}
        </span>
      </div>
      {stale && (
        <Alert variant="destructive" className="builder-alert">
          <TriangleAlert />
          <AlertDescription>
            A newer revision was saved while you were editing. Your unsaved text is preserved. Copy any text
            you want to keep before loading the latest version.
            <Button size="sm" variant="outline" onClick={clearEdits}>
              Load latest saved fields
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" className="builder-alert">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="builder-body">
        <aside className="builder-sidebar">
          <ToggleGroup
            type="single"
            value={tab}
            onValueChange={(value) => value && setTab(value)}
            aria-label="Builder tools"
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="layers">
              <Layers3 /> Layers
            </ToggleGroupItem>
            <ToggleGroupItem value="add">
              <Plus /> Add section
            </ToggleGroupItem>
          </ToggleGroup>
          {tab === 'add' ? (
            <div className="builder-patterns">
              <p>Native sections, ready to adapt.</p>
              {patterns.map((pattern) => (
                <Button
                  key={pattern.kind}
                  variant="outline"
                  className="builder-pattern"
                  disabled={locked}
                  onClick={() =>
                    void apply({
                      kind: 'add',
                      parentId: view.root.id,
                      pattern: pattern.kind,
                      ...(selected?.parentId === view.root.id ? { afterId: selected.id } : {}),
                    })
                  }
                >
                  <span
                    className={cn('builder-pattern-art', `builder-art-${pattern.glyph}`)}
                    aria-hidden="true"
                  >
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>
                    <strong>{pattern.label}</strong>
                    <small>{pattern.description}</small>
                  </span>
                  <Plus data-icon="inline-end" />
                </Button>
              ))}
              <p>
                Inserted after the selected top-level section. New widgets remain local until their IDs are
                reserved.
              </p>
            </div>
          ) : (
            <>
              <div className="builder-search">
                <Search size={14} />
                <Input
                  aria-label="Find a section"
                  placeholder="Find a section…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <div className="builder-tree" aria-label="Page layers">
                {visible.map(({ node, depth }) => (
                  <button
                    key={node.id}
                    className={cn('builder-tree-node', node.id === selectedId && 'is-selected')}
                    style={{ paddingLeft: 10 + Math.min(depth, 5) * 12 }}
                    onClick={() => select(node)}
                    title={`${node.title} · ${node.id}`}
                  >
                    {node.childCount ? <Layers3 size={13} /> : <Type size={13} />}
                    <span>
                      {node.title === node.type ? node.text.slice(0, 45) || node.title : node.title}
                    </span>
                    {node.local && <i title="New local widget" />}
                  </button>
                ))}
                {allNodes.length > 400 && (
                  <p className="builder-caption">Showing 400 layers. Use search to find more.</p>
                )}
              </div>
              {selected && (
                <section className="builder-inspector" key={selected.id}>
                  <div className="builder-inspector-heading">
                    <div>
                      <small>SELECTED</small>
                      <strong>{selected.title}</strong>
                    </div>
                    <Badge variant="outline">{selected.type}</Badge>
                  </div>
                  <div className="builder-actions">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Move section up"
                      title="Move up"
                      disabled={locked || index <= 0}
                      onClick={() => void apply({ kind: 'move', nodeId: selected.id, direction: 'up' })}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Move section down"
                      title="Move down"
                      disabled={locked || !parent || index >= parent.children.length - 1}
                      onClick={() => void apply({ kind: 'move', nodeId: selected.id, direction: 'down' })}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Duplicate section"
                      title="Duplicate"
                      disabled={locked || !parent}
                      onClick={() => void apply({ kind: 'duplicate', nodeId: selected.id })}
                    >
                      <Copy />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Remove section"
                      title="Remove"
                      disabled={locked || !parent}
                      onClick={() => setRemoving(true)}
                    >
                      <Trash2 />
                    </Button>
                    {onSelectSection && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={locked}
                        onClick={() => onSelectSection(selected)}
                      >
                        <MessageSquare data-icon="inline-start" /> Ask agent
                      </Button>
                    )}
                  </div>
                  {removing && (
                    <Alert>
                      <TriangleAlert />
                      <AlertDescription>
                        <p>Remove this widget and all its children from the local draft?</p>
                        <div className="builder-confirm">
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={locked}
                            onClick={() => void apply({ kind: 'remove', nodeId: selected.id })}
                          >
                            Remove
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setRemoving(false)}>
                            Keep
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                  <FieldGroup className="builder-fields">
                    {selectedFields.slice(0, 20).map((field, index) => (
                      <Field key={field.pointer}>
                        <FieldLabel htmlFor={`builder-field-${index}`}>{field.key}</FieldLabel>
                        <Textarea
                          id={`builder-field-${index}`}
                          value={values[field.pointer] ?? field.value}
                          maxLength={16384}
                          disabled={locked}
                          rows={field.key.includes('html') ? 4 : 2}
                          onChange={(event) => editField(field.pointer, event.target.value)}
                        />
                        {field.key.includes('html') && (
                          <FieldDescription>Rich text keeps the storefront HTML.</FieldDescription>
                        )}
                      </Field>
                    ))}
                  </FieldGroup>
                  {selectedFields.length > 20 && (
                    <p className="builder-caption">Select a child layer to edit its remaining fields.</p>
                  )}
                  {edits.length > 0 && (
                    <div className="builder-save">
                      <Button size="sm" disabled={locked || stale} onClick={() => void saveText()}>
                        Save text
                      </Button>
                      <Button variant="ghost" size="sm" disabled={locked} onClick={clearEdits}>
                        Discard
                      </Button>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </aside>
        <section className="builder-canvas-area">
          <div className="builder-canvas-toolbar">
            <ToggleGroup
              type="single"
              value={version}
              onValueChange={(value) => value && setVersion(value)}
              aria-label="Compare structure"
              size="sm"
            >
              <ToggleGroupItem value="baseline">Before</ToggleGroupItem>
              <ToggleGroupItem value="draft">Draft</ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup
              type="single"
              value={device}
              onValueChange={(value) => value && setDevice(value)}
              aria-label="Layout width"
              size="sm"
            >
              <ToggleGroupItem value="desktop" aria-label="Desktop layout">
                <Monitor />
              </ToggleGroupItem>
              <ToggleGroupItem value="mobile" aria-label="Mobile layout">
                <Smartphone />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="builder-canvas-scroll">
            <div className={cn('builder-wireframe', device === 'mobile' && 'builder-mobile')}>
              <div className="builder-wireframe-label">
                <LayoutTemplate size={14} />
                <span>{version === 'baseline' ? 'Original structure' : 'Draft structure'}</span>
              </div>
              <StructureCanvas
                root={version === 'baseline' && view.baselineRoot ? view.baselineRoot : view.root}
                selectedId={version === 'draft' ? selectedId : ''}
                changedIds={version === 'draft' ? changedIds : new Set()}
                onSelect={version === 'draft' ? select : undefined}
              />
            </div>
          </div>
          <div className="builder-canvas-note">
            <LayoutTemplate size={13} />
            <span>Layout and text preview. Check the storefront preview for theme styling and behavior.</span>
          </div>
          <div className="builder-status">
            <span>
              {view.nodeCount} widgets
              {view.localNodeIds.length ? ` · ${view.localNodeIds.length} new local widgets` : ''}
            </span>
            <span>
              {view.structureChanges.length} structural changes <ChevronRight size={12} />
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}

export function StructureCanvas({
  root,
  selectedId = '',
  changedIds = new Set<string>(),
  onSelect,
}: {
  root: BuilderNode;
  selectedId?: string;
  changedIds?: Set<string>;
  onSelect?: (node: BuilderNode) => void;
}) {
  let visible = 0;
  function render(node: BuilderNode, depth: number): React.ReactNode {
    if (++visible > 250 || depth > 12) return null;
    const isRoot = depth === 0;
    const container = node.children.length > 0 || isRoot;
    const kind = [
      'row',
      'column',
      'section',
      'container',
      'accordion',
      'accordionitem',
      'button',
      'text',
    ].includes(node.type)
      ? node.type
      : 'unknown';
    return (
      <div
        key={node.id}
        className={cn(
          'builder-widget',
          `builder-widget-${kind}`,
          selectedId === node.id && 'is-selected',
          changedIds.has(node.id) && 'is-changed',
          !container && 'builder-widget-leaf'
        )}
        data-widget-id={node.id}
      >
        {!isRoot && container && (
          <button className="builder-widget-label" disabled={!onSelect} onClick={() => onSelect?.(node)}>
            {node.title}
          </button>
        )}
        {node.text && (
          <button
            className="builder-widget-content"
            disabled={!onSelect}
            onClick={() => onSelect?.(node)}
            aria-label={`Select ${node.title}: ${node.text.replace(/\s+/g, ' ').slice(0, 120)}`}
          >
            {node.text}
          </button>
        )}
        {!container && !node.text && (
          <button
            className="builder-widget-placeholder"
            disabled={!onSelect}
            onClick={() => onSelect?.(node)}
          >
            <LayoutTemplate size={16} />
            <span>{node.title}</span>
          </button>
        )}
        {node.children.length > 0 && (
          <div className="builder-widget-children">
            {node.children.map((child) => render(child, depth + 1))}
          </div>
        )}
        {isRoot && !node.children.length && (
          <div className="builder-wireframe-empty">Your page body is empty. Add a section to begin.</div>
        )}
      </div>
    );
  }
  return (
    <div className="builder-structure">
      {render(root, 0)}
      {visible > 250 && (
        <p className="builder-caption">Canvas limited to 250 widgets. Find any section in Layers.</p>
      )}
    </div>
  );
}
