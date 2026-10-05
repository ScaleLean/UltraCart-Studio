import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Command,
  FileText,
  Folder,
  Globe2,
  History,
  Home,
  Layers3,
  LayoutGrid,
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
import { WorkspaceCanvas } from './components/workspace';
import { SettingsDialog, ConnectDialog } from './components/settings';
import { cn } from './lib/utils';
import { catalogRows, pageAncestors } from './lib/catalog';

type Screen = 'home' | 'canvas' | 'changes' | 'activity';
export function App() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [failure, setFailure] = useState('');
  const [screen, setScreen] = useState<Screen>('home');
  const [page, setPage] = useState('/');
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
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const seq = ++sequence.current;
    try {
      const result = await invoke<Bootstrap>('bootstrap');
      if (seq !== sequence.current) return;
      setData((previous) => {
        if (previous && previous.workspace.id !== result.workspace.id) {
          setPage(result.pages.some((p) => p.path === '/') ? '/' : result.pages[0]?.path || '/');
          setActiveSession(null);
          setSearch('');
        }
        return result;
      });
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
  const openPage = (path: string) => {
    const known = new Set(data?.pages.map((p) => p.path) || []);
    setExpanded((previous) => new Set([...previous, ...pageAncestors(path, known)]));
    setPage(path);
    setScreen('canvas');
    setActiveSession(null);
    setInitialPrompt('');
  };
  const openSession = (session: Session) => {
    setPage(session.scope.path);
    setActiveSession(session.id);
    setScreen('canvas');
  };
  const ask = (prompt: string) => {
    setPage(data?.pages.some((p) => p.path === '/') ? '/' : data?.pages[0]?.path || '/');
    setInitialPrompt(prompt);
    setScreen('canvas');
    setActiveSession(null);
  };
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
          <kbd>⌘ K</kbd>
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
          <button className={screen === 'home' ? 'active' : ''} onClick={() => setScreen('home')}>
            <Home /> Overview
          </button>
          <button className={screen === 'canvas' ? 'active' : ''} onClick={() => setScreen('canvas')}>
            <LayoutGrid /> Storefront <span>{data.pages.length}</span>
          </button>
          <button className={screen === 'changes' ? 'active' : ''} onClick={() => setScreen('changes')}>
            <Layers3 /> Changes{' '}
            {dirtyChanges.length > 0 && <span className="nav-count">{dirtyChanges.length}</span>}
          </button>
          <button className={screen === 'activity' ? 'active' : ''} onClick={() => setScreen('activity')}>
            <History /> Activity
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
                  className={activeSession === s.id ? 'selected' : ''}
                >
                  {s.status === 'working' ? <LoaderCircle className="spin" /> : <MessageSquare />}
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
              Saved on this Mac<small>Your work stays with you.</small>
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
            <Button size="sm" variant="outline" onClick={() => invoke('app.restartEngine')}>
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
            openChanges={() => setScreen('changes')}
          />
        )}
        {screen === 'canvas' && currentPage && (
          <WorkspaceCanvas
            key={data.workspace.id}
            data={data}
            page={currentPage}
            activeSession={activeSession}
            setActiveSession={setActiveSession}
            initialPrompt={initialPrompt}
            clearInitialPrompt={() => setInitialPrompt('')}
            overlayOpen={settings || connect || palette}
            openSettings={() => setSettings(true)}
            refresh={refresh}
          />
        )}
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
      <SettingsDialog open={settings} onOpenChange={setSettings} data={data} refresh={refresh} />
      <ConnectDialog open={connect} onOpenChange={setConnect} data={data} refresh={refresh} />
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
                setScreen('changes');
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
                  <MessageSquare />
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
}: {
  data: Bootstrap;
  openPage: (path: string) => void;
  ask: (prompt: string) => void;
  connect: () => void;
  openChanges: () => void;
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
        <p>Explore your store. Work with your agent. Make every change count.</p>
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
function Changes({ changes, openPage }: { changes: Change[]; openPage: (path: string) => void }) {
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
            <button key={c.id} className="change-list-row" onClick={() => openPage(c.scope.path)}>
              <span className="change-row-icon">
                <Layers3 />
              </span>
              <div>
                <strong>{c.scope.path === '/' ? 'Homepage' : c.scope.path}</strong>
                <p>
                  {c.draft.changedFields} edited fields · Revision {c.draft.revision} ·{' '}
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
