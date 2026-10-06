import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Activity, Session } from '../shared/types';

function parse<T>(text: string, message: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(message);
  }
}
function readable<T>(rows: Record<string, unknown>[], table: string): T[] {
  return rows.flatMap((row) => {
    try {
      return [JSON.parse(row.value as string) as T];
    } catch {
      console.error(`Skipped an unreadable ${table} row.`);
      return [];
    }
  });
}
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
    return row ? parse<T>(row.value, `Saved ${key.split(':')[0]} data is unreadable.`) : fallback;
  }
  set(key: string, value: unknown) {
    this.db
      .prepare(
        'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
      .run(key, JSON.stringify(value));
  }
  delete(key: string) {
    this.db.prepare('DELETE FROM kv WHERE key = ?').run(key);
  }
  session(id: string): Session {
    const row = this.db.prepare('SELECT value FROM sessions WHERE id = ?').get(id) as
      { value: string } | undefined;
    if (!row) throw new Error('This conversation no longer exists.');
    return parse(row.value, 'This conversation is unreadable.');
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
    return readable(rows, 'conversation');
  }
  pendingSessions(): Session[] {
    return readable(
      this.db
        .prepare("SELECT value FROM sessions WHERE json_valid(value) AND json_extract(value, '$.status') = ?")
        .all('working'),
      'conversation'
    );
  }
  activity(workspaceId: string): Activity[] {
    return readable(
      this.db
        .prepare('SELECT value FROM activity WHERE workspace_id = ? ORDER BY at DESC LIMIT 40')
        .all(workspaceId),
      'activity'
    );
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
