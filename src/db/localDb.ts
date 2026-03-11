import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('myapp.db');

export async function initDb() {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      synced INTEGER DEFAULT 0,
      server_id INTEGER DEFAULT NULL
    );
  `);
}

// --- User ---
export async function createUser(username: string, password: string) {
  return db.runAsync(
    'INSERT INTO users (username, password) VALUES (?, ?)',
    [username, password]
  );
}

export async function findUser(username: string, password: string) {
  return db.getFirstAsync<{ id: number; username: string }>(
    'SELECT id, username FROM users WHERE username = ? AND password = ?',
    [username, password]
  );
}

// --- Memo ---
export async function getMemos(userId: number) {
  return db.getAllAsync<{
    id: number;
    title: string;
    content: string;
    created_at: string;
    updated_at: string;
    synced: number;
    server_id: number | null;
  }>(
    'SELECT * FROM memos WHERE user_id = ? ORDER BY updated_at DESC',
    [userId]
  );
}

export async function createMemo(userId: number, title: string, content: string) {
  return db.runAsync(
    'INSERT INTO memos (user_id, title, content) VALUES (?, ?, ?)',
    [userId, title, content]
  );
}

export async function updateMemo(id: number, title: string, content: string) {
  return db.runAsync(
    "UPDATE memos SET title = ?, content = ?, updated_at = datetime('now', 'localtime'), synced = 0 WHERE id = ?",
    [title, content, id]
  );
}

export async function deleteMemo(id: number) {
  return db.runAsync('DELETE FROM memos WHERE id = ?', [id]);
}

export async function getUnsyncedMemos(userId: number) {
  return db.getAllAsync<{
    id: number;
    title: string;
    content: string;
    created_at: string;
    server_id: number | null;
  }>(
    'SELECT * FROM memos WHERE user_id = ? AND synced = 0',
    [userId]
  );
}

export async function markMemoSynced(localId: number, serverId: number) {
  return db.runAsync(
    'UPDATE memos SET synced = 1, server_id = ? WHERE id = ?',
    [serverId, localId]
  );
}
