import type { Selection, Profile, Storefront, Login } from './connection';
import type { StorePage, TemplateResult } from './storefront';
import type { Draft, DraftReview, DraftScope } from './drafts';
export type {
  Selection,
  Profile,
  Storefront,
  Login,
  StorePage,
  TemplateResult,
  Draft,
  DraftReview,
  DraftScope,
};

export type Workspace = { id: string; kind: 'sample' | 'live'; label: string; selection: Selection };
export type TemplateSource = {
  path: string;
  content: string;
  truncated: boolean;
  kind: 'group' | 'item';
};
export type Settings = {
  nodePath: string;
  cliPath: string;
  provider: string;
  model: string;
  reasoning: 'low' | 'medium' | 'high';
  theme: 'light' | 'dark';
};
export type Session = {
  id: string;
  workspaceId: string;
  scope: DraftScope;
  title: string;
  status: 'idle' | 'working' | 'interrupted' | 'error';
  createdAt: string;
  updatedAt: string;
  error?: string;
  target?: { kind: 'landing'; projectId: string } | { kind: 'warehouse' };
};
export type Message = {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  text: string;
  tool?: string;
  error?: boolean;
  running?: boolean;
};
export type ConversationView = {
  messages: Message[];
  busy: boolean;
  queued: number;
  tokens: number;
  error?: string;
};
export type Change = {
  id: string;
  scope: DraftScope;
  draft: Draft;
  review: DraftReview | null;
  previewedRevision: number | null;
  publishedAt: string | null;
  publishPending: boolean;
  status: 'draft' | 'reviewed' | 'previewed' | 'published' | 'conflict' | 'unverified';
};
export type Activity = {
  id: string;
  workspaceId: string;
  text: string;
  detail: string;
  kind: 'draft' | 'review' | 'preview' | 'agent' | 'store';
  at: string;
};
export type AuthStatus = {
  connected: boolean;
  provider: string;
  source: string | null;
  phase: 'idle' | 'waiting' | 'connected' | 'error';
  message?: string;
  prompt?: { id: string; message: string; type: string; options?: { label: string; value: string }[] };
  models: { id: string; name: string }[];
};
export type Bootstrap = {
  workspace: Workspace;
  settings: Settings;
  pages: StorePage[];
  sessions: Session[];
  changes: Change[];
  activity: Activity[];
  auth: AuthStatus;
  version: string;
};
export type StudioEvent =
  | { type: 'changed' }
  | { type: 'conversation'; id: string; view: ConversationView }
  | { type: 'auth'; status: AuthStatus }
  | { type: 'preview'; loading: boolean; applied?: boolean; error?: string }
  | { type: 'worker'; status: 'restarting' | 'ready' | 'error'; message?: string };

export interface StudioBridge {
  invoke<T = unknown>(method: string, params?: unknown): Promise<T>;
  subscribe(callback: (event: StudioEvent) => void): () => void;
  previewBounds(bounds: { x: number; y: number; width: number; height: number; visible: boolean }): void;
}
declare global {
  interface Window {
    studio?: StudioBridge;
  }
}
