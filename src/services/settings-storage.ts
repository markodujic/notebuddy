/**
 * Settings-Persistenz – Ersatz für `localStorage` der notenlern-app.
 *
 * 1:1 wie im Original wird nur der Dark-Mode persistiert
 * (`localStorage.getItem('darkMode')` / `setItem`).
 * Speicherung via expo-sqlite (Key-Value-Tabelle), synchroner API.
 */

import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;
let initialized = false;

function getDb(): SQLite.SQLiteDatabase | null {
  if (!initialized) {
    try {
      db = SQLite.openDatabaseSync('notebuddy-settings.db');
      db.execSync('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);');
      initialized = true;
    } catch {
      return null;
    }
  }
  return db;
}

/** Lädt den persistierten Dark-Mode (null = noch nie gespeichert). */
export function loadDarkMode(): boolean | null {
  const database = getDb();
  if (!database) return null;
  try {
    const row = database.getFirstSync<{ value: string }>(
      'SELECT value FROM kv WHERE key = ?;',
      ['darkMode'],
    );
    if (!row) return null;
    return row.value === 'true';
  } catch {
    return null;
  }
}

/** Speichert den Dark-Mode (1:1 wie localStorage.setItem('darkMode', …)). */
export function saveDarkMode(value: boolean): void {
  const database = getDb();
  if (!database) return;
  try {
    database.runSync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?);', [
      'darkMode',
      String(value),
    ]);
  } catch {
    // Persistenz darf die App nie blockieren
  }
}
