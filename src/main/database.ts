import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Activity, Session } from '../shared/types';

export class Store {
  readonly db: DatabaseSync;
  constructor(readonly directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(join(directory, 'studio.sqlite'));
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA busy_timeout = 5000');
    this.db.exec('PRAGMA synchronous = FULL');
    this.db.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS storefront_drafts (scope_key TEXT PRIMARY KEY, record TEXT NOT NULL)'
    );
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, updated_at TEXT NOT NULL, value TEXT NOT NULL)'
    );
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS activity (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, at TEXT NOT NULL, value TEXT NOT NULL)'
    );
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS revisions (draft_id TEXT NOT NULL, revision INTEGER NOT NULL, value TEXT NOT NULL, PRIMARY KEY(draft_id, revision))'
    );
  }
  get<T>(key: string, fallback: T): T {
    const row = this.db.prepare('SELECT value FROM kv WHERE key = ?').get(key) as
      { value: string } | undefined;
    return row ? (JSON.parse(row.value) as T) : fallback;
  }
  set(key: string, value: unknown) {
    this.db
      .prepare(
        'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
      .run(key, JSON.stringify(value));
  }
  session(id: string): Session {
    const row = this.db.prepare('SELECT value FROM sessions WHERE id = ?').get(id) as
      { value: string } | undefined;
    if (!row) throw new Error('This conversation no longer exists.');
    return JSON.parse(row.value);
  }
  saveSession(session: Session) {
    this.db
      .prepare(
        'INSERT INTO sessions (id, workspace_id, updated_at, value) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET workspace_id = excluded.workspace_id, updated_at = excluded.updated_at, value = excluded.value'
      )
      .run(session.id, session.workspaceId, session.updatedAt, JSON.stringify(session));
  }
  sessions(workspaceId?: string): Session[] {
    const rows = workspaceId
      ? this.db
          .prepare('SELECT value FROM sessions WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 100')
          .all(workspaceId)
      : this.db.prepare('SELECT value FROM sessions ORDER BY updated_at DESC LIMIT 100').all();
    return rows.map((row) => JSON.parse(row.value as string));
  }
  pendingSessions(): Session[] {
    return this.db
      .prepare("SELECT value FROM sessions WHERE json_extract(value, '$.status') = ?")
      .all('working')
      .map((row) => JSON.parse(row.value as string));
  }
  activity(workspaceId: string): Activity[] {
    return this.db
      .prepare('SELECT value FROM activity WHERE workspace_id = ? ORDER BY at DESC LIMIT 40')
      .all(workspaceId)
      .map((row) => JSON.parse(row.value as string));
  }
  log(workspaceId: string, kind: Activity['kind'], text: string, detail = '') {
    const item: Activity = {
      id: randomUUID(),
      workspaceId,
      kind,
      text,
      detail,
      at: new Date().toISOString(),
    };
    this.db
      .prepare('INSERT INTO activity (id, workspace_id, at, value) VALUES (?, ?, ?, ?)')
      .run(item.id, workspaceId, item.at, JSON.stringify(item));
  }
  close() {
    this.db.close();
  }
}
