/**
 * expo-sqlite outbox DB — metadata only (no DEKs, no patient names, no geo).
 */
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'hhos-photo-outbox.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS photo_outbox (
  client_photo_id TEXT PRIMARY KEY NOT NULL,
  patient_id TEXT NOT NULL,
  episode_id TEXT NOT NULL,
  wound_id TEXT,
  visit_id TEXT,
  consent_record_id TEXT NOT NULL,
  local_cipher_path TEXT NOT NULL,
  plaintext_sha256 TEXT NOT NULL,
  cipher_sha256 TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  meta_json TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER,
  last_error_code TEXT,
  server_photo_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_photo_outbox_status ON photo_outbox(status);
`;

export async function getOutboxDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(SCHEMA_SQL);
      return db;
    })();
  }
  return dbPromise;
}

/** Test helper: reset singleton (does not delete the file). */
export function resetOutboxDbSingleton(): void {
  dbPromise = null;
}
