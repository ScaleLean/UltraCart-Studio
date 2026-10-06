import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Cpu,
  Globe2,
  KeyRound,
  Laptop,
  Link2,
  LoaderCircle,
  LogOut,
  Moon,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Bootstrap, Login, Profile, Settings, Storefront } from '../../shared/types';
import { errorText, invoke } from '../api';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from './ui/field';
import { Input } from './ui/input';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: Bootstrap;
  refresh: () => Promise<void>;
  initialTab?: 'agent' | 'runtime' | 'appearance';
};
export function SettingsDialog({ open, onOpenChange, data, refresh, initialTab }: DialogProps) {
  const [settings, setSettings] = useState<Settings>(data.settings);
  const [tab, setTab] = useState('agent');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState('');
  useEffect(() => {
    if (open) {
      setSettings(data.settings);
      setAnswer('');
      if (initialTab) setTab(initialTab);
    }
  }, [open, initialTab]);
  async function save(next = settings) {
    setBusy(true);
    try {
      await invoke('settings.save', next);
      await refresh();
      toast.success('Preferences saved');
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function login() {
    setBusy(true);
    try {
      await invoke('settings.save', settings);
      await invoke('auth.begin');
      await refresh();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="settings-dialog">
        <DialogHeader>
          <DialogTitle>Make Studio yours</DialogTitle>
          <DialogDescription>Your agent, connections, and local workspace.</DialogDescription>
        </DialogHeader>
        <div className="settings-layout">
          <nav className="settings-nav">
            <button className={tab === 'agent' ? 'active' : ''} onClick={() => setTab('agent')}>
              <Sparkles />
              Agent
            </button>
            <button className={tab === 'runtime' ? 'active' : ''} onClick={() => setTab('runtime')}>
              <Cpu />
              Toolkit
            </button>
            <button className={tab === 'appearance' ? 'active' : ''} onClick={() => setTab('appearance')}>
              <Sun />
              Appearance
            </button>
          </nav>
          <div className="settings-content">
            {tab === 'agent' && (
              <>
                <div className="settings-section-intro">
                  <span className="settings-icon">
                    <Sparkles />
                  </span>
                  <h2>Your AI, connected.</h2>
                  <p>Use your ChatGPT sign-in. No API key required.</p>
                </div>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="provider">Connection</FieldLabel>
                    <select
                      id="provider"
                      disabled={busy || data.auth.phase === 'waiting'}
                      className="native-select"
                      value={settings.provider}
                      onChange={(event) => {
                        const provider = event.target.value;
                        const next = {
                          ...settings,
                          provider,
                          model: provider === 'openai' ? 'gpt-6.1-sol' : 'gpt-5.4',
                        };
                        setSettings(next);
                        void save(next);
                      }}
                    >
                      <option value="openai">OpenAI · Sign in with ChatGPT</option>
                      <option value="openai-codex">OpenAI Codex · Compatibility</option>
                    </select>
                  </Field>
                  <div className="account-card">
                    <div>
                      <span className={data.auth.connected ? 'account-icon connected' : 'account-icon'}>
                        {data.auth.connected ? <CheckCircle2 /> : <KeyRound />}
                      </span>
                      <span>
                        <strong>{data.auth.connected ? 'ChatGPT connected' : 'Connect your account'}</strong>
                        <small>
                          {data.auth.connected
                            ? 'Credentials are encrypted on this computer.'
                            : 'Sign in through your browser.'}
                        </small>
                      </span>
                    </div>
                    {data.auth.connected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          invoke('auth.logout')
                            .then(refresh)
                            .catch((e) => toast.error(errorText(e)))
                        }
                      >
                        <LogOut data-icon="inline-start" />
                        Disconnect
                      </Button>
                    ) : (
                      <Button size="sm" onClick={login} disabled={busy || data.auth.phase === 'waiting'}>
                        {data.auth.phase === 'waiting' ? (
                          <LoaderCircle className="spin" data-icon="inline-start" />
                        ) : (
                          <ArrowUpRight data-icon="inline-end" />
                        )}
                        {data.auth.phase === 'waiting' ? 'Waiting for sign-in' : 'Sign in'}
                      </Button>
                    )}
                  </div>
                  {data.auth.message && <p className="settings-note">{data.auth.message}</p>}
                  {data.auth.phase === 'waiting' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => invoke('auth.cancel').catch((e) => toast.error(errorText(e)))}
                    >
                      Cancel sign-in
                    </Button>
                  )}
                  {data.auth.prompt && (
                    <Field>
                      <FieldLabel htmlFor="auth-answer">{data.auth.prompt.message}</FieldLabel>
                      {data.auth.prompt.options ? (
                        <select
                          id="auth-answer"
                          className="native-select"
                          value={answer}
                          onChange={(event) => setAnswer(event.target.value)}
                        >
                          <option value="">Choose an option</option>
                          {data.auth.prompt.options.map((o) => (
                            <option value={o.value} key={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          id="auth-answer"
                          type="password"
                          autoComplete="off"
                          value={answer}
                          onChange={(event) => setAnswer(event.target.value)}
                        />
                      )}
                      <Button
                        size="sm"
                        disabled={!answer}
                        onClick={() => {
                          void invoke('auth.answer', { id: data.auth.prompt!.id, value: answer }).catch((e) =>
                            toast.error(errorText(e))
                          );
                          setAnswer('');
                        }}
                      >
                        Continue
                      </Button>
                    </Field>
                  )}
                  <Field>
                    <FieldLabel htmlFor="model">Model</FieldLabel>
                    <select
                      id="model"
                      className="native-select"
                      value={settings.model}
                      onChange={(event) => setSettings({ ...settings, model: event.target.value })}
                    >
                      {!data.auth.models.some((m) => m.id === settings.model) && (
                        <option value={settings.model}>{settings.model}</option>
                      )}
                      {data.auth.models.map((model) => (
                        <option value={model.id} key={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                    <FieldDescription>Availability depends on your connected account.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel>Reasoning effort</FieldLabel>
                    <ToggleGroup
                      type="single"
                      value={settings.reasoning}
                      onValueChange={(value) =>
                        value && setSettings({ ...settings, reasoning: value as Settings['reasoning'] })
                      }
                      variant="outline"
                    >
                      <ToggleGroupItem value="low">Quick</ToggleGroupItem>
                      <ToggleGroupItem value="medium">Balanced</ToggleGroupItem>
                      <ToggleGroupItem value="high">Thorough</ToggleGroupItem>
                    </ToggleGroup>
                  </Field>
                </FieldGroup>
              </>
            )}
            {tab === 'runtime' && (
              <>
                <div className="settings-section-intro">
                  <span className="settings-icon">
                    <Cpu />
                  </span>
                  <h2>The local engine.</h2>
                  <p>
                    The UltraCart toolkit handles store access and keeps credentials in the OS credential
                    store.
                  </p>
                </div>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="node-path">Node 24 executable</FieldLabel>
                    <Input
                      id="node-path"
                      value={settings.nodePath}
                      onChange={(event) => setSettings({ ...settings, nodePath: event.target.value })}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="cli-path">UltraCart toolkit entry</FieldLabel>
                    <Input
                      id="cli-path"
                      value={settings.cliPath}
                      onChange={(event) => setSettings({ ...settings, cliPath: event.target.value })}
                    />
                  </Field>
                </FieldGroup>
                <div className="runtime-note">
                  <ShieldCheck />
                  <p>
                    Conversations and drafts are saved locally. Closing the window keeps the engine available.
                    Quitting stops execution; reopening recovers pending work.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    invoke('app.restartEngine')
                      .then(() => toast.info('Restarting the engine. Saved work will reconnect.'))
                      .catch((e) => toast.error(errorText(e)))
                  }
                >
                  <RefreshCw data-icon="inline-start" />
                  Restart engine
                </Button>
              </>
            )}
            {tab === 'appearance' && (
              <>
                <div className="settings-section-intro">
                  <span className="settings-icon">
                    <Sun />
                  </span>
                  <h2>A space to focus.</h2>
                  <p>Choose the appearance of your workspace.</p>
                </div>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={settings.theme}
                  onValueChange={(value) => {
                    if (value) {
                      const next = { ...settings, theme: value as Settings['theme'] };
                      setSettings(next);
                      void save(next);
                    }
                  }}
                >
                  <ToggleGroupItem value="light">
                    <Sun />
                    Light
                  </ToggleGroupItem>
                  <ToggleGroupItem value="dark">
                    <Moon />
                    Dark
                  </ToggleGroupItem>
                </ToggleGroup>
                <p className="settings-note">Storefront previews keep the store’s own appearance.</p>
              </>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
          <Button onClick={() => save()} disabled={busy}>
            {busy && <LoaderCircle className="spin" data-icon="inline-start" />}Save preferences
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConnectDialog({ open, onOpenChange, data, refresh }: DialogProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState('');
  const [stores, setStores] = useState<Storefront[]>([]);
  const [merchantId, setMerchantId] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [version, setVersion] = useState('');
  const [newProfile, setNewProfile] = useState('my-store');
  const [login, setLogin] = useState<Login | null>(null);
  const loginRef = useRef<Login | null>(null);
  loginRef.current = login;
  async function inspect() {
    setBusy('inspect');
    setError('');
    try {
      const result = await invoke<{ version: string; profiles: Profile[] }>('connection.inspect');
      setProfiles(result.profiles);
      setVersion(result.version);
      setProfile((previous) => previous || result.profiles[0]?.id || '');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy('');
    }
  }
  useEffect(() => {
    if (open) void inspect();
    return () => {
      const active = loginRef.current;
      if (active && ['waiting', 'starting'].includes(active.phase))
        void invoke('connection.cancel', { id: active.id }).catch(() => {});
    };
  }, [open]);
  useEffect(() => {
    if (!open || !login || !['starting', 'waiting'].includes(login.phase)) return;
    const timer = setInterval(
      () =>
        invoke<Login>('connection.poll', { id: login.id })
          .then((value) => {
            setLogin(value);
            if (value.phase === 'succeeded') {
              setProfile(value.profile);
              void inspect();
            }
          })
          .catch((e) => setError(errorText(e))),
      1000
    );
    return () => clearInterval(timer);
  }, [open, login?.id, login?.phase]);
  async function load() {
    setBusy('load');
    setError('');
    setStores([]);
    setSelected(null);
    try {
      const result = await invoke<{ merchantId: string; storefronts: Storefront[] }>(
        'connection.storefronts',
        { profile }
      );
      setStores(result.storefronts);
      setMerchantId(result.merchantId);
      if (result.storefronts.length === 1) setSelected(result.storefronts[0].id);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy('');
    }
  }
  async function connect() {
    if (!selected) return;
    setBusy('connect');
    setError('');
    try {
      await invoke('workspace.connect', { profile, merchantId, storefrontId: selected });
      await refresh();
      onOpenChange(false);
      toast.success('Your storefront is connected');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy('');
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="connect-dialog">
        <DialogHeader>
          <span className="connect-dialog-icon">
            <Globe2 />
          </span>
          <DialogTitle>Bring your storefront.</DialogTitle>
          <DialogDescription>
            Connect to UltraCart to explore your pages and work on local drafts.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Connection needs attention</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {busy === 'inspect' ? (
          <div className="connection-loading">
            <LoaderCircle className="spin" />
            Finding your local toolkit
          </div>
        ) : (
          <FieldGroup>
            {profiles.length > 0 && (
              <Field>
                <FieldLabel htmlFor="profile">UltraCart profile</FieldLabel>
                <div className="field-inline">
                  <select
                    className="native-select"
                    id="profile"
                    value={profile}
                    onChange={(event) => {
                      setProfile(event.target.value);
                      setStores([]);
                      setSelected(null);
                    }}
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.merchantId ? ` · ${p.merchantId}` : ''}
                      </option>
                    ))}
                  </select>
                  <Button variant="outline" disabled={!!busy || !profile} onClick={load}>
                    {busy === 'load' ? <LoaderCircle className="spin" /> : 'Load stores'}
                  </Button>
                </div>
              </Field>
            )}
            {stores.length > 0 && (
              <Field>
                <FieldLabel>Choose a storefront</FieldLabel>
                <div className="store-options">
                  {stores.map((store) => (
                    <button
                      key={store.id}
                      className={selected === store.id ? 'selected' : ''}
                      onClick={() => setSelected(store.id)}
                    >
                      <Globe2 />
                      <span>
                        <strong>{store.host}</strong>
                        <small>
                          {merchantId} · Storefront {store.id}
                        </small>
                      </span>
                      {selected === store.id ? <Check /> : <ChevronRight />}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            <details className="new-profile" open={!profiles.length}>
              <summary>
                <Link2 size={14} />
                Sign in to another UltraCart account
              </summary>
              <Field>
                <FieldLabel htmlFor="new-profile">Profile name</FieldLabel>
                <div className="field-inline">
                  <Input
                    id="new-profile"
                    value={newProfile}
                    onChange={(event) => setNewProfile(event.target.value)}
                  />
                  <Button
                    variant="outline"
                    disabled={!!busy || login?.phase === 'waiting' || !newProfile}
                    onClick={async () => {
                      setBusy('login');
                      setError('');
                      try {
                        setLogin(await invoke('connection.begin', { profile: newProfile }));
                      } catch (e) {
                        setError(errorText(e));
                      } finally {
                        setBusy('');
                      }
                    }}
                  >
                    Sign in
                    <ArrowUpRight data-icon="inline-end" />
                  </Button>
                </div>
              </Field>
            </details>
            {login && (
              <div className="login-state">
                <p>{login.message}</p>
                {login.code && <strong>{login.code}</strong>}
                {login.url && (
                  <Button
                    size="sm"
                    onClick={() =>
                      invoke('window.openAuth', { url: login.url }).catch((e) => toast.error(errorText(e)))
                    }
                  >
                    Open UltraCart sign-in
                    <ArrowUpRight data-icon="inline-end" />
                  </Button>
                )}
              </div>
            )}
          </FieldGroup>
        )}
        <div className="connection-assurance">
          <ShieldCheck size={15} />
          <span>Connecting reads your catalog. Your live storefront stays unchanged.</span>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={async () => {
              try {
                await invoke('workspace.sample');
                await refresh();
                onOpenChange(false);
              } catch (error) {
                toast.error(errorText(error));
              }
            }}
          >
            Use sample store
          </Button>
          <Button disabled={!selected || !!busy} onClick={connect}>
            {busy === 'connect' ? (
              <LoaderCircle className="spin" data-icon="inline-start" />
            ) : (
              <Globe2 data-icon="inline-start" />
            )}
            {busy === 'connect' ? 'Loading your storefront...' : 'Connect storefront'}
          </Button>
        </DialogFooter>
        {version && <small className="toolkit-version">Toolkit {version}</small>}
      </DialogContent>
    </Dialog>
  );
}
