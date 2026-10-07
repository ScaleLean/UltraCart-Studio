import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Command,
  Database,
  BookOpen,
  FileText,
  Folder,
  Globe2,
  History,
  Home,
  Layers3,
  LayoutGrid,
  PanelsTopLeft,
  ListFilter,
  LoaderCircle,
  MessageSquare,
  PanelLeftClose,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  SquarePen,
  Store,
  Sun,
  Moon,
  WifiOff,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Bootstrap, Change, Session, StorePage } from '../shared/types';
import type { LandingProject } from '../shared/landing';
import { errorText, invoke, subscribe } from './api';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Input } from './components/ui/input';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from './components/ui/command';
import { Logo, IconButton, Loading, EmptyState, SectionHeading, relativeTime } from './components/common';
import { AgentPanel, WorkspaceCanvas } from './components/workspace';
import { LandingStudio } from './components/landing-studio';
import { Warehouse } from './components/warehouse';
import { ToolkitReference } from './components/toolkit-reference';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog';
import { SettingsDialog, ConnectDialog } from './components/settings';
import { cn } from './lib/utils';
import { catalogRows, pageAncestors } from './lib/catalog';

type Screen = 'home' | 'canvas' | 'landing' | 'warehouse' | 'toolkit' | 'changes' | 'activity';
type FeatureAgent = {
  instance: number;
  target: { landingId: string } | { warehouse: true };
  page: StorePage;
  title: string;
  sessionId: string | null;
  prompt: string;
};
function featurePage(title: string, path = '/'): StorePage {
  return {
    title,
    path,
    parent: '',
    description: null,
    template: null,
    itemTemplate: null,
    visible: null,
    search: 'unknown',
    children: 0,
    items: 0,
    type: null,
    catalogCopies: 0,
  };
}
export function App() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [failure, setFailure] = useState('');
  const [screen, setScreen] = useState<Screen>('home');
  const [page, setPage] = useState('/');
  const [slot, setSlot] = useState('body');
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState(false);
  const [connect, setConnect] = useState(false);
  const [palette, setPalette] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');
  const [engine, setEngine] = useState('ready');
  const [sidebar, setSidebar] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState('');
  const [selectedLandingId, setSelectedLandingId] = useState<string>();
  const [featureAgent, setFeatureAgent] = useState<FeatureAgent | null>(null);
  const sequence = useRef(0);
  const workspaceIdentity = useRef('');
  const featureSequence = useRef(0);
  const unsaved = useRef(new Set<Screen>());
  const [discard, setDiscard] = useState<{ action: () => void } | null>(null);
  // Bumped when the user confirms a discard, so editors remount even if the workspace did not change.
  const [discardEpoch, setDiscardEpoch] = useState(0);
  const reportUnsaved = useCallback((source: Screen, dirty: boolean) => {
    if (dirty) unsaved.current.add(source);
    else unsaved.current.delete(source);
  }, []);
  const refresh = useCallback(async () => {
    const seq = ++sequence.current;
    try {
      const result = await invoke<Bootstrap>('bootstrap');
      if (seq !== sequence.current) return;
      const identity = JSON.stringify([result.workspace.id, result.workspace.selection.verifiedAt]);
      const sameWorkspace = workspaceIdentity.current.startsWith(`["${result.workspace.id}",`);
      // A re-verify keeps the screen when there are unsaved edits; a different workspace remounts it anyway.
      if (
        workspaceIdentity.current &&
        workspaceIdentity.current !== identity &&
        !(sameWorkspace && unsaved.current.size)
      ) {
        setPage(result.pages.some((p) => p.path === '/') ? '/' : result.pages[0]?.path || '/');
        setActiveSession(null);
        setSlot('body');
        setSelectedLandingId(undefined);
        setFeatureAgent(null);
        setInitialPrompt('');
        setSearch('');
        setExpanded(new Set());
        setScreen('home');
      }
      workspaceIdentity.current = identity;
      setData(result);
      setFailure('');
    } catch (error) {
      if (seq === sequence.current) setFailure(errorText(error));
    }
  }, []);
  useEffect(() => {
    void refresh();
    let timer: ReturnType<typeof setTimeout>;
    const stop = subscribe((event) => {
      if (event.type === 'changed') {
        clearTimeout(timer);
        timer = setTimeout(() => void refresh(), 120);
      }
      if (event.type === 'auth')
        setData((previous) => (previous ? { ...previous, auth: event.status } : previous));
      if (event.type === 'worker') {
        setEngine(event.status);
        if (event.status === 'ready') void refresh();
      }
    });
    return () => {
      stop();
      clearTimeout(timer);
    };
  }, [refresh]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPalette((v) => !v);
      }
      if (
        event.key === '/' &&
        !(
          event.target instanceof HTMLElement &&
          event.target.closest('input, textarea, select, [contenteditable=true]')
        )
      ) {
        event.preventDefault();
        document.getElementById('page-search')?.focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault();
        setSettings(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = data?.settings.theme || 'light';
  }, [data?.settings.theme]);
  useEffect(() => {
    // The main process asks this before quitting so it can confirm natively before stopping the engine.
    (window as unknown as { __studioHasUnsaved?: () => boolean }).__studioHasUnsaved = () =>
      unsaved.current.size > 0;
    return () => {
      delete (window as unknown as { __studioHasUnsaved?: () => boolean }).__studioHasUnsaved;
    };
  }, []);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (unsaved.current.size) event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
  // Ask before a navigation would unmount a screen that holds unsaved edits.
  const leave = (next: Screen, action: () => void) => {
    if (unsaved.current.has(screen) && next !== screen) setDiscard({ action });
    else action();
  };
  const goTo = (next: Screen) =>
    leave(next, () => {
      setFeatureAgent(null);
      setScreen(next);
    });
  const openPage = (path: string, nextSlot = 'body') =>
    leave('canvas', () => {
      const known = new Set(data?.pages.map((p) => p.path) || []);
      setExpanded((previous) => new Set([...previous, ...pageAncestors(path, known)]));
      setPage(path);
      setSlot(nextSlot);
      setScreen('canvas');
      setActiveSession(null);
      setInitialPrompt('');
      setFeatureAgent(null);
    });
  const openFeature = (target: 'landing' | 'warehouse') =>
    leave(target, () => {
      setFeatureAgent(null);
      setScreen(target);
      setInitialPrompt('');
      setActiveSession(null);
    });
  const openLandingAgent = (project: LandingProject, prompt: string) => {
    if (project.workspaceId !== data?.workspace.id) return;
    const session = data.sessions.find(
      (item) => item.target?.kind === 'landing' && item.target.projectId === project.id
    );
    setSelectedLandingId(project.id);
    setScreen('landing');
    setActiveSession(null);
    setFeatureAgent({
      instance: ++featureSequence.current,
      target: { landingId: project.id },
      page: featurePage(project.brief.title, project.brief.path),
      title: project.brief.title,
      sessionId: session?.id || null,
      prompt,
    });
  };
  const openWarehouseAgent = (prompt: string) => {
    const session = data?.sessions.find((item) => item.target?.kind === 'warehouse');
    setScreen('warehouse');
    setActiveSession(null);
    setFeatureAgent({
      instance: ++featureSequence.current,
      target: { warehouse: true },
      page: featurePage('Data warehouse'),
      title: 'Data warehouse',
      sessionId: session?.id || null,
      prompt,
    });
  };
  const openSession = (session: Session) => {
    if (session.workspaceId !== data?.workspace.id) return;
    const next: Screen =
      session.target?.kind === 'landing'
        ? 'landing'
        : session.target?.kind === 'warehouse'
          ? 'warehouse'
          : 'canvas';
    leave(next, () => showSession(session));
  };
  const showSession = (session: Session) => {
    if (session.workspaceId !== data?.workspace.id) return;
    setInitialPrompt('');
    if (session.target?.kind === 'landing') {
      setSelectedLandingId(session.target.projectId);
      setScreen('landing');
      setActiveSession(null);
      setFeatureAgent({
        instance: ++featureSequence.current,
        target: { landingId: session.target.projectId },
        page: featurePage('Landing draft', session.scope.path),
        title: session.title,
        sessionId: session.id,
        prompt: '',
      });
      return;
    }
    if (session.target?.kind === 'warehouse') {
      setScreen('warehouse');
      setActiveSession(null);
      setFeatureAgent({
        instance: ++featureSequence.current,
        target: { warehouse: true },
        page: featurePage('Data warehouse'),
        title: session.title,
        sessionId: session.id,
        prompt: '',
      });
      return;
    }
    if (!data.pages.some((item) => item.path === session.scope.path)) {
      toast.error('This page is not in the current catalog. Refresh the storefront before reopening it.');
      return;
    }
    setFeatureAgent(null);
    setPage(session.scope.path);
    setSlot(session.scope.slot);
    setActiveSession(session.id);
    setScreen('canvas');
  };
  const ask = (prompt: string) =>
    leave('canvas', () => {
      setSlot('body');
      setFeatureAgent(null);
      setPage(data?.pages.some((p) => p.path === '/') ? '/' : data?.pages[0]?.path || '/');
      setInitialPrompt(prompt);
      setScreen('canvas');
      setActiveSession(null);
    });
  async function refreshCatalog() {
    setRefreshing(true);
    try {
      await invoke('workspace.refresh');
      await refresh();
      toast.success('Storefront refreshed');
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setRefreshing(false);
    }
  }
  if (!data)
    return (
      <div className="app-loading">
        <Logo />
        <h1>UltraCart Studio</h1>
        {failure ? (
          <>
            <p>{failure}</p>
            <Button onClick={refresh}>Try again</Button>
          </>
        ) : (
          <Loading label="Starting your local workspace" />
        )}
      </div>
    );
  const currentPage = data.pages.find((p) => p.path === page) || data.pages[0];
  const dirtyChanges = data.changes.filter((c) => c.draft.changedFields > 0 && c.status !== 'published');
  const rows = catalogRows(data.pages, search, expanded);
  const commandKey = /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl';
  const isSample = data.workspace.kind === 'sample';
  return (
    <div className={cn('studio-app', !sidebar && 'sidebar-collapsed')}>
      <header className="titlebar">
        <div className="titlebar-brand">
          <Logo small />
          <span>
            UltraCart <b>Studio</b>
          </span>
        </div>
        <div className="titlebar-center">
          <span className="status-dot" /> Local workspace <span className="titlebar-separator">/</span>{' '}
          {data.workspace.label}
        </div>
        <button className="titlebar-command" onClick={() => setPalette(true)}>
          <Search size={13} />
          <span>Search anything</span>
          <kbd>{commandKey} K</kbd>
        </button>
      </header>
      <aside className="sidebar">
        <button className="workspace-switch" onClick={() => setConnect(true)}>
          <span className="workspace-avatar">{isSample ? 'f' : data.workspace.label[0].toUpperCase()}</span>
          <span>
            <strong>{data.workspace.label}</strong>
            <small>{isSample ? 'Sample storefront' : data.workspace.selection.merchantId}</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <nav className="main-nav" aria-label="Workspace navigation">
          <button className={screen === 'home' ? 'active' : ''} onClick={() => goTo('home')}>
            <Home /> Overview
          </button>
          <button className={screen === 'canvas' ? 'active' : ''} onClick={() => goTo('canvas')}>
            <LayoutGrid /> Storefront <span>{data.pages.length}</span>
          </button>
          <button
            className={screen === 'landing' ? 'active' : ''}
            aria-current={screen === 'landing' ? 'page' : undefined}
            onClick={() => openFeature('landing')}
          >
            <PanelsTopLeft /> Landing Studio
          </button>
          <button
            className={screen === 'warehouse' ? 'active' : ''}
            aria-current={screen === 'warehouse' ? 'page' : undefined}
            onClick={() => openFeature('warehouse')}
          >
            <Database /> Data warehouse
          </button>
          <button className={screen === 'changes' ? 'active' : ''} onClick={() => goTo('changes')}>
            <Layers3 /> Changes{' '}
            {dirtyChanges.length > 0 && <span className="nav-count">{dirtyChanges.length}</span>}
          </button>
          <button className={screen === 'activity' ? 'active' : ''} onClick={() => goTo('activity')}>
            <History /> Activity
          </button>
          <button
            className={screen === 'toolkit' ? 'active' : ''}
            aria-current={screen === 'toolkit' ? 'page' : undefined}
            onClick={() => goTo('toolkit')}
          >
            <BookOpen /> Toolkit reference
          </button>
        </nav>
        <div className="sidebar-section-title">
          <span>PAGES</span>
          <IconButton label="Refresh storefront" onClick={refreshCatalog} disabled={refreshing}>
            {refreshing ? <LoaderCircle className="spin" /> : <RefreshCw />}
          </IconButton>
        </div>
        <div className="page-filter">
          <Search size={13} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a page..."
            aria-label="Find a page"
            id="page-search"
          />
          <kbd>/</kbd>
        </div>
        <div className="page-tree" role="navigation" aria-label="Storefront pages">
          {rows.slice(0, 120).map(({ page: p, depth, hasChildren }) => (
            <div
              key={p.path}
              className={cn('page-tree-item', page === p.path && screen === 'canvas' && 'selected')}
              style={{ paddingLeft: `${8 + depth * 12}px` }}
            >
              {hasChildren && !search ? (
                <button
                  className="tree-toggle"
                  aria-label={`${expanded.has(p.path) ? 'Collapse' : 'Expand'} ${p.title}`}
                  aria-expanded={expanded.has(p.path)}
                  onClick={() =>
                    setExpanded((previous) => {
                      const next = new Set(previous);
                      if (next.has(p.path)) next.delete(p.path);
                      else next.add(p.path);
                      return next;
                    })
                  }
                >
                  <ChevronRight className={expanded.has(p.path) ? 'expanded' : ''} />
                </button>
              ) : (
                <span className="tree-toggle-spacer" />
              )}
              <button className="page-row" onClick={() => openPage(p.path)} title={p.path}>
                <span className="tree-icon">
                  {p.path === '/' ? <Home /> : hasChildren ? <Folder /> : <FileText />}
                </span>
                <span className="page-tree-label">
                  {p.title}
                  {search && <small>{p.path}</small>}
                </span>
                {data.changes.some((c) => c.scope.path === p.path && c.draft.changedFields > 0) && (
                  <i className="draft-dot" />
                )}
              </button>
            </div>
          ))}
          {rows.length > 120 && (
            <div className="tree-more">Showing 120 of {rows.length} results. Search to narrow.</div>
          )}
          {rows.length === 0 && <div className="tree-more">No matching pages</div>}
        </div>
        {data.sessions.length > 0 && (
          <>
            <div className="sidebar-section-title">
              <span>RECENT CONVERSATIONS</span>
              <MessageSquare size={12} />
            </div>
            <div className="session-list">
              {data.sessions.slice(0, 4).map((s) => (
                <button
                  key={s.id}
                  onClick={() => openSession(s)}
                  className={activeSession === s.id || featureAgent?.sessionId === s.id ? 'selected' : ''}
                >
                  {s.status === 'working' ? (
                    <LoaderCircle className="spin" />
                  ) : s.target?.kind === 'warehouse' ? (
                    <Database />
                  ) : s.target?.kind === 'landing' ? (
                    <PanelsTopLeft />
                  ) : (
                    <MessageSquare />
                  )}
                  <span>{s.title}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <div className="sidebar-bottom">
          <div className="local-note">
            <ShieldCheck />
            <span>
              Saved on this computer<small>Drafts and conversation history.</small>
            </span>
          </div>
          <button className="settings-link" onClick={() => setSettings(true)}>
            <Settings2 />
            Settings
            <span className={cn('account-dot', data.auth.connected && 'connected')} />
            <span>{data.auth.connected ? 'Connected' : 'Connect AI'}</span>
          </button>
        </div>
      </aside>
      <main className="main-content">
        <div className="workspace-topbar">
          <div>
            <IconButton
              label={sidebar ? 'Hide sidebar' : 'Show sidebar'}
              onClick={() => setSidebar((v) => !v)}
            >
              <PanelLeftClose />
            </IconButton>
            <span className="breadcrumb">
              Workspace <ChevronRight />{' '}
              <b>
                {screen === 'home'
                  ? 'Overview'
                  : screen === 'canvas'
                    ? currentPage?.title || 'Storefront'
                    : screen === 'landing'
                      ? 'Landing Studio'
                      : screen === 'warehouse'
                        ? 'Data warehouse'
                        : screen === 'toolkit'
                          ? 'Toolkit reference'
                          : screen === 'changes'
                            ? 'Changes'
                            : 'Activity'}
              </b>
            </span>
          </div>
          <div>
            {isSample && <Badge variant="outline">Sample store</Badge>}
            <span className="engine-status">
              <span className={cn('status-dot', engine !== 'ready' && 'warning')} />
              {engine === 'ready' ? 'Local engine ready' : 'Reconnecting engine'}
            </span>
            <IconButton label="Settings" onClick={() => setSettings(true)}>
              <Settings2 />
            </IconButton>
          </div>
        </div>
        {engine === 'error' && (
          <div className="engine-banner">
            <WifiOff size={14} /> The engine needs a restart. Your saved work is on disk.
            <Button
              size="sm"
              variant="outline"
              onClick={() => invoke('app.restartEngine').catch((error) => toast.error(errorText(error)))}
            >
              Restart engine
            </Button>
          </div>
        )}
        {screen === 'home' && (
          <Overview
            data={data}
            openPage={openPage}
            ask={ask}
            connect={() => setConnect(true)}
            openChanges={() => goTo('changes')}
            openLanding={() => openFeature('landing')}
            openWarehouse={() => openFeature('warehouse')}
          />
        )}
        {screen === 'canvas' && currentPage && (
          <WorkspaceCanvas
            key={data.workspace.id}
            data={data}
            page={currentPage}
            slot={slot}
            onSelectSlot={(next) => {
              setSlot(next);
              setActiveSession(null);
              setInitialPrompt('');
            }}
            activeSession={activeSession}
            setActiveSession={setActiveSession}
            initialPrompt={initialPrompt}
            clearInitialPrompt={() => setInitialPrompt('')}
            overlayOpen={settings || connect || palette || !!featureAgent}
            openSettings={() => setSettings(true)}
            refresh={refresh}
          />
        )}
        {screen === 'landing' && (
          <LandingStudio
            key={`${data.workspace.id}:${discardEpoch}`}
            boot={data}
            selectedId={selectedLandingId}
            onAgent={openLandingAgent}
            onUnsavedChange={(dirty) => reportUnsaved('landing', dirty)}
          />
        )}
        {screen === 'warehouse' && (
          <Warehouse key={data.workspace.id} boot={data} onAgent={openWarehouseAgent} onOpenPage={openPage} />
        )}
        {screen === 'toolkit' && <ToolkitReference boot={data} onSettings={() => setSettings(true)} />}
        {screen === 'changes' && <Changes changes={data.changes} openPage={openPage} />}
        {screen === 'activity' && (
          <div className="document-screen">
            <SectionHeading
              eyebrow="YOUR WORK, IN CONTEXT"
              title="Activity"
              description="A local record of storefront work and decisions."
            />
            {data.activity.length ? (
              <div className="activity-feed">
                {data.activity.map((a) => (
                  <div className="activity-row" key={a.id}>
                    <span className="activity-icon">
                      {a.kind === 'agent' ? (
                        <Sparkles />
                      ) : a.kind === 'store' ? (
                        <Globe2 />
                      ) : a.kind === 'review' ? (
                        <ShieldCheck />
                      ) : (
                        <Layers3 />
                      )}
                    </span>
                    <div>
                      <strong>{a.text}</strong>
                      <p>{a.detail}</p>
                    </div>
                    <time>{relativeTime(a.at)}</time>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="A fresh workspace"
                description="Your drafts, reviews, and previews will appear here as you work."
              />
            )}
          </div>
        )}
      </main>
      <Dialog
        open={!!featureAgent}
        onOpenChange={(open) => {
          if (!open) setFeatureAgent(null);
        }}
      >
        <DialogContent className="feature-agent-dialog">
          {featureAgent && (
            <>
              <DialogHeader className="feature-agent-header">
                <div className="feature-agent-title-row">
                  <span className="feature-agent-icon">
                    {'landingId' in featureAgent.target ? (
                      <PanelsTopLeft size={19} />
                    ) : (
                      <Database size={19} />
                    )}
                  </span>
                  <div>
                    <DialogTitle>
                      {'landingId' in featureAgent.target ? 'Landing page agent' : 'Warehouse agent'}
                    </DialogTitle>
                    <span className="feature-agent-context">{featureAgent.title}</span>
                  </div>
                </div>
                <DialogDescription>
                  {'landingId' in featureAgent.target
                    ? 'Work on the selected brief and local draft. Review saved changes in Landing Studio.'
                    : 'Explore schemas and save SQL for review. Run queries explicitly in the warehouse controls.'}
                </DialogDescription>
              </DialogHeader>
              <AgentPanel
                key={`${data.workspace.id}:${featureAgent.instance}`}
                data={data}
                page={featureAgent.page}
                target={featureAgent.target}
                activeSession={featureAgent.sessionId}
                setActiveSession={(id) =>
                  setFeatureAgent((previous) =>
                    previous?.instance === featureAgent.instance ? { ...previous, sessionId: id } : previous
                  )
                }
                initialPrompt={featureAgent.prompt}
                clearInitialPrompt={() =>
                  setFeatureAgent((previous) =>
                    previous?.instance === featureAgent.instance ? { ...previous, prompt: '' } : previous
                  )
                }
                openSettings={() => setSettings(true)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!discard} onOpenChange={(open) => !open && setDiscard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard unsaved edits?</DialogTitle>
            <DialogDescription>
              You have unsaved edits in this screen. Leaving now will discard them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscard(null)}>
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const action = discard?.action;
                setDiscard(null);
                unsaved.current.clear();
                setDiscardEpoch((n) => n + 1);
                action?.();
              }}
            >
              Discard and continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SettingsDialog
        open={settings}
        onOpenChange={setSettings}
        data={data}
        refresh={refresh}
        initialTab={screen === 'toolkit' ? 'runtime' : undefined}
      />
      <ConnectDialog
        open={connect}
        onOpenChange={setConnect}
        data={data}
        refresh={refresh}
        guard={(action) => {
          if (unsaved.current.size)
            setDiscard({
              action: () => {
                unsaved.current.clear();
                action();
              },
            });
          else action();
        }}
      />
      <CommandDialog
        open={palette}
        onOpenChange={setPalette}
        title="Search your workspace"
        description="Find pages, conversations, and actions."
      >
        <CommandInput
          placeholder="Jump to a page or action..."
          value={commandSearch}
          onValueChange={setCommandSearch}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem
              value="landing studio pages create campaign brief draft"
              onSelect={() => {
                setPalette(false);
                openFeature('landing');
              }}
            >
              <PanelsTopLeft /> Open Landing Studio
            </CommandItem>
            <CommandItem
              value="data warehouse sql bigquery analytics tables schema"
              onSelect={() => {
                setPalette(false);
                openFeature('warehouse');
              }}
            >
              <Database /> Explore data warehouse
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setPalette(false);
                setConnect(true);
              }}
            >
              <Store />
              Connect a storefront
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setPalette(false);
                setSettings(true);
              }}
            >
              <Settings2 />
              Open settings
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setPalette(false);
                goTo('toolkit');
              }}
            >
              <BookOpen /> Toolkit commands, capabilities, and skills
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setPalette(false);
                goTo('changes');
              }}
            >
              <Layers3 />
              Review changes
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Pages">
            {data.pages
              .filter((p) => `${p.title} ${p.path}`.toLowerCase().includes(commandSearch.toLowerCase()))
              .slice(0, 100)
              .map((p) => (
                <CommandItem
                  key={p.path}
                  value={`${p.title} ${p.path}`}
                  onSelect={() => {
                    openPage(p.path);
                    setPalette(false);
                  }}
                >
                  <FileText />
                  <span>{p.title}</span>
                  <small className="command-path">{p.path}</small>
                </CommandItem>
              ))}
          </CommandGroup>
          {data.sessions.length > 0 && (
            <CommandGroup heading="Conversations">
              {data.sessions.map((s) => (
                <CommandItem
                  key={s.id}
                  onSelect={() => {
                    openSession(s);
                    setPalette(false);
                  }}
                >
                  {s.target?.kind === 'warehouse' ? (
                    <Database />
                  ) : s.target?.kind === 'landing' ? (
                    <PanelsTopLeft />
                  ) : (
                    <MessageSquare />
                  )}
                  {s.title}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </div>
  );
}

function Overview({
  data,
  openPage,
  ask,
  connect,
  openChanges,
  openLanding,
  openWarehouse,
}: {
  data: Bootstrap;
  openPage: (path: string) => void;
  ask: (prompt: string) => void;
  connect: () => void;
  openChanges: () => void;
  openLanding: () => void;
  openWarehouse: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const changes = data.changes.filter((c) => c.draft.changedFields > 0);
  const templates = new Set(data.pages.map((p) => p.template).filter(Boolean)).size;
  return (
    <div className="overview-screen">
      <div className="overview-greeting">
        <span className="eyebrow">
          <span className="status-dot" />
          {data.workspace.kind === 'sample'
            ? 'YOUR LOCAL CREATIVE WORKSPACE'
            : data.workspace.label.toUpperCase()}
        </span>
        <h1>
          A better storefront.
          <br />
          <span>One thoughtful change at a time.</span>
        </h1>
        <p>Shape your storefront. Build the next landing page. Learn from your data.</p>
      </div>
      <form
        className="hero-composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (prompt.trim()) ask(prompt);
        }}
      >
        <div>
          <span className="agent-glyph">
            <Sparkles size={19} />
          </span>
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            aria-label="What would you like to work on?"
            placeholder="What would you like to work on?"
          />
        </div>
        <footer>
          <span>
            <Globe2 size={13} /> {data.workspace.label}
            <ChevronRight size={12} /> Home
          </span>
          <Button size="sm" type="submit" disabled={!prompt.trim()}>
            Start creating <ArrowUpRight data-icon="inline-end" />
          </Button>
        </footer>
      </form>
      <div className="suggestion-chips">
        {['Understand this page', 'Improve the homepage copy', 'Review shared template impact'].map(
          (text) => (
            <button key={text} onClick={() => ask(text)}>
              <Sparkles size={12} />
              {text}
              <ArrowUpRight size={12} />
            </button>
          )
        )}
      </div>
      <div className="studio-feature-grid">
        <button className="studio-feature-card landing" onClick={openLanding}>
          <span className="studio-feature-icon">
            <PanelsTopLeft size={21} />
          </span>
          <span>
            <small>FROM BRIEF TO DRAFT</small>
            <strong>Landing Studio</strong>
            <p>Build a local page with editable sections and your agent.</p>
          </span>
          <ArrowUpRight size={17} />
        </button>
        <button className="studio-feature-card warehouse" onClick={openWarehouse}>
          <span className="studio-feature-icon">
            <Database size={21} />
          </span>
          <span>
            <small>FOLLOW THE EVIDENCE</small>
            <strong>Data warehouse</strong>
            <p>Inspect your schema, review a query, and explore the results.</p>
          </span>
          <ArrowUpRight size={17} />
        </button>
      </div>
      <div className="overview-metrics">
        <button onClick={() => openPage(data.pages[0]?.path || '/')}>
          <span>
            <LayoutGrid />
            Storefront pages
          </span>
          <strong>{data.pages.length.toLocaleString()}</strong>
          <small>
            Connected to your workspace <ArrowUpRight />
          </small>
        </button>
        <button onClick={() => openPage(data.pages[0]?.path || '/')}>
          <span>
            <Layers3 />
            Page templates
          </span>
          <strong>{templates.toLocaleString()}</strong>
          <small>
            Explore what connects your pages <ArrowUpRight />
          </small>
        </button>
        <button onClick={openChanges}>
          <span>
            <SquarePen />
            Changes in progress
          </span>
          <strong>{changes.length.toLocaleString()}</strong>
          <small>
            {changes.length ? 'Ready for your next decision' : 'A clean slate. Make it yours.'}{' '}
            <ArrowUpRight />
          </small>
        </button>
      </div>
      <div className="overview-section-head">
        <div>
          <h2>Your storefront, at a glance</h2>
          <p>A few good places to start.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => openPage('/')}>
          Explore storefront <ArrowUpRight data-icon="inline-end" />
        </Button>
      </div>
      <div className="page-cards">
        {data.pages
          .filter((p) => p.path === '/' || p.children > 0 || p.path.split('/').filter(Boolean).length === 1)
          .slice(0, 3)
          .map((p, i) => (
            <button className="page-card" key={p.path} onClick={() => openPage(p.path)}>
              <div className={`page-card-art art-${i}`}>
                <div className="mini-site">
                  <div className="mini-site-nav">
                    <b>{data.workspace.label.split('.')[0]}</b>
                    <i />
                    <i />
                  </div>
                  {i === 0 ? (
                    <div className="mini-site-hero">
                      <div>
                        <span />
                        <span />
                        <span />
                        <i />
                      </div>
                      <div className="mini-site-product" />
                    </div>
                  ) : i === 1 ? (
                    <div className="mini-grid">
                      <i />
                      <i />
                      <i />
                    </div>
                  ) : (
                    <div className="mini-story">
                      <div />
                      <span />
                      <span />
                    </div>
                  )}
                </div>
                <span className="card-open">
                  <ArrowUpRight size={16} />
                </span>
              </div>
              <div className="page-card-label">
                <span>
                  <strong>{p.title}</strong>
                  <small>{p.path}</small>
                </span>
                <Badge variant="secondary">{p.template?.replace('.vm', '') || 'Page'}</Badge>
              </div>
            </button>
          ))}
      </div>
      {data.workspace.kind === 'sample' && (
        <div className="connect-banner">
          <span className="connect-banner-icon">
            <Globe2 />
          </span>
          <div>
            <strong>Make yourself at home. Then bring your store.</strong>
            <p>You’re exploring a sample storefront. Connect UltraCart when you’re ready.</p>
          </div>
          <Button variant="outline" onClick={connect}>
            Connect storefront <ArrowUpRight data-icon="inline-end" />
          </Button>
        </div>
      )}
      <div className="overview-bottom">
        <ShieldCheck size={14} />
        <span>Local drafts. Persistent conversations. You decide what goes live.</span>
        <span>STUDIO / 01</span>
      </div>
    </div>
  );
}
function Changes({
  changes,
  openPage,
}: {
  changes: Change[];
  openPage: (path: string, slot?: string) => void;
}) {
  return (
    <div className="document-screen">
      <SectionHeading
        eyebrow="MAKE EVERY CHANGE COUNT"
        title="Changes"
        description="Saved drafts, checks, and previews. All in one place."
      >
        <Badge variant="secondary">{changes.length} change sets</Badge>
      </SectionHeading>
      {changes.length ? (
        <div className="change-list">
          {changes.map((c) => (
            <button
              key={c.id}
              className="change-list-row"
              onClick={() => openPage(c.scope.path, c.scope.slot)}
            >
              <span className="change-row-icon">
                <Layers3 />
              </span>
              <div>
                <strong>{c.scope.path === '/' ? 'Homepage' : c.scope.path}</strong>
                <p>
                  {c.draft.changedFields} content and structure changes · Revision {c.draft.revision} ·{' '}
                  {relativeTime(c.draft.updatedAt)}
                </p>
              </div>
              <Badge variant={c.status === 'conflict' ? 'destructive' : 'secondary'}>{c.status}</Badge>
              <ArrowUpRight size={16} />
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Your next change starts here"
          description="Open a page and save a draft. Every edit stays local until you choose to publish it."
        >
          <Button onClick={() => openPage('/')}>
            Open storefront
            <ArrowUpRight data-icon="inline-end" />
          </Button>
        </EmptyState>
      )}
    </div>
  );
}
