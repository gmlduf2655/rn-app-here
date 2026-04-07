import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import staticSeed from './seed.json';

// 모듈 로드 시점에 DB를 열어 undefined 상태를 방지
const db: SQLite.SQLiteDatabase = SQLite.openDatabaseSync('myapp.db');
//const db: SQLite.SQLiteDatabase
// 스키마가 바뀔 때마다 이 값을 올리면 테이블을 재생성합니다
const SCHEMA_VERSION = 5;

export async function initDb() {
  const versionRow = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  const currentVersion = versionRow?.user_version ?? 0;
  console.log("initDb Start 0")
  if (currentVersion < SCHEMA_VERSION) {
    // 스키마 버전이 낮으면 기존 테이블 삭제 후 재생성
    await db.execAsync(`
      DROP TABLE IF EXISTS tb_tbox_time_table;
      DROP TABLE IF EXISTS tb_tbox_brain_dump;
      DROP TABLE IF EXISTS tb_memo;
      DROP TABLE IF EXISTS tb_user;
    `);
  }
  console.log("initDb Start 1")
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS tb_user (
      user_id   TEXT PRIMARY KEY,
      user_pwd  TEXT NOT NULL,
      reg_date  TEXT,
      user_name TEXT,
      email     TEXT,
      address   TEXT,
      adm_yn    TEXT DEFAULT 'N',
      upd_id    TEXT,
      upd_dt    TEXT,
      reg_id    TEXT,
      reg_dt    TEXT
    );

    CREATE TABLE IF NOT EXISTS tb_memo (
      memo_id      TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL,
      reg_date     TEXT,
      title        TEXT NOT NULL,
      memo_content TEXT DEFAULT '',
      upd_id       TEXT,
      upd_dt       TEXT,
      reg_id       TEXT,
      reg_dt       TEXT,
      synced       INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES tb_user(user_id)
    );

    CREATE TABLE IF NOT EXISTS tb_tbox_brain_dump (
      dump_id      TEXT PRIMARY KEY,
      tbox_date    TEXT,
      user_id      TEXT NOT NULL,
      dump_title   TEXT NOT NULL,
      dump_content TEXT DEFAULT '',
      priority_yn  TEXT DEFAULT 'N',
      complete_yn  TEXT DEFAULT 'N',
      status       TEXT DEFAULT '0',
      reg_id       TEXT,
      reg_dt       TEXT,
      upd_id       TEXT,
      mod_dt       TEXT,
      synced       INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tb_tbox_time_table (
      time_table_id TEXT PRIMARY KEY,
      dump_id       TEXT,
      tbox_date     TEXT,
      user_id       TEXT NOT NULL,
      time_hour     INTEGER,
      time_minute   INTEGER DEFAULT 0,
      color         TEXT DEFAULT '#4f46e5',
      reg_id        TEXT,
      reg_dt        TEXT,
      upd_id        TEXT,
      mod_dt        TEXT,
      synced        INTEGER DEFAULT 0
    );

    PRAGMA user_version = ${SCHEMA_VERSION};
  `);
  console.log("initDb End")
  await seedData();
}

// 서버에서 받아온 백업 파일 경로 — 함수로 호출 시점에 평가 (documentDirectory가 null일 경우 방지)
export function getBackupPath(): string {
  const dir = FileSystem.documentDirectory ?? '';
  return `${dir}db_backup.json`;
}

async function seedData() {
  // seed.json의 첫 번째 user_id가 이미 존재하면 스킵
  const seedUserId = staticSeed.users[0]?.user_id;
  if (seedUserId) {
    const existing = await db.getFirstAsync(
      'SELECT user_id FROM tb_user WHERE user_id = ?',
      [seedUserId]
    );
    if (existing) return;
  }

  // 백업 파일 우선, 없으면 번들 seed.json 사용
  let seed: typeof staticSeed;
  try {
    const json = await FileSystem.readAsStringAsync(getBackupPath());
    seed = JSON.parse(json);
  } catch {
    seed = staticSeed;
  }

  await insertSeed(seed);
}

export async function insertSeed(seed: { users: any[]; memos: any[] }) {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  for (const user of seed.users) {
    await db.runAsync(
      `INSERT OR REPLACE INTO tb_user
        (user_id, user_pwd, reg_date, user_name, email, address, adm_yn, upd_id, upd_dt, reg_id, reg_dt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(user.user_id ?? ''),
        String(user.user_pwd ?? ''),
        today,
        String(user.user_name ?? ''),
        String(user.email ?? ''),
        String(user.address ?? ''),
        String(user.adm_yn ?? 'N'),
        String(user.user_id ?? ''),
        now,
        String(user.user_id ?? ''),
        now,
      ]
    );
  }

  for (const memo of seed.memos) {
    await db.runAsync(
      `INSERT OR REPLACE INTO tb_memo
        (memo_id, user_id, reg_date, title, memo_content, upd_id, upd_dt, reg_id, reg_dt, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        String(memo.memo_id ?? ''),
        String(memo.user_id ?? ''),
        String(memo.reg_date ?? today),
        String(memo.title ?? ''),
        String(memo.memo_content ?? ''),
        String(memo.user_id ?? ''),
        now,
        String(memo.user_id ?? ''),
        now,
      ]
    );
  }
}

// --- User ---
export async function createUser(
  userId: string,
  userPwd: string,
  userName: string,
  email: string,
  address: string
) {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  return db.runAsync(
    `INSERT OR REPLACE INTO tb_user
      (user_id, user_pwd, reg_date, user_name, email, address, adm_yn, upd_id, upd_dt, reg_id, reg_dt)
     VALUES (?, ?, ?, ?, ?, ?, 'N', ?, ?, ?, ?)`,
    [userId, userPwd, today, userName, email, address, userId, now, userId, now]
  );
}

export async function findUser(userId: string, userPwd: string) {
  return db.getFirstAsync<{
    user_id: string;
    user_name: string;
    email: string;
    address: string;
    adm_yn: string;
  }>(
    `SELECT user_id, user_name, email, address,
            CASE WHEN adm_yn = 'Y' THEN '관리자' ELSE '사용자' END AS position
     FROM tb_user
     WHERE user_id = ? AND user_pwd = ?`,
    [userId, userPwd]
  );
}

// --- Memo ---
export async function getMemos(userId: string, startDate: string, endDate: string) {
  return db.getAllAsync<{
    memo_id: string;
    user_id: string;
    reg_date: string;
    title: string;
    memo_content: string;
    upd_id: string;
    upd_dt: string;
    reg_id: string;
    reg_dt: string;
    synced: number;
  }>(
    `SELECT memo_id, user_id, reg_date, title, memo_content, upd_id, upd_dt, reg_id, reg_dt, synced
     FROM tb_memo
     WHERE user_id = ? AND reg_date BETWEEN ? AND ?
     ORDER BY reg_dt DESC`,
    [userId, startDate, endDate]
  );
}

export async function saveMemo(
  memoId: string,
  userId: string,
  regDate: string,
  title: string,
  memoContent: string,
  synced = 0   // 로컬 작성 = 0, 서버에서 받아온 데이터 = 1
) {
  const now = new Date().toISOString();
  return db.runAsync(
    `INSERT OR REPLACE INTO tb_memo
      (memo_id, user_id, reg_date, title, memo_content, upd_id, upd_dt, reg_id, reg_dt, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [memoId, userId, regDate, title, memoContent, userId, now, userId, now, synced]
  );
}

export async function updateMemo(memoId: string, userId: string, title: string, memoContent: string) {
  const now = new Date().toISOString();
  return db.runAsync(
    `UPDATE tb_memo
     SET title = ?, memo_content = ?, upd_id = ?, upd_dt = ?, synced = 0
     WHERE memo_id = ?`,
    [title, memoContent, userId, now, memoId]
  );
}

export async function deleteMemo(memoId: string) {
  return db.runAsync('DELETE FROM tb_memo WHERE memo_id = ?', [memoId]);
}

export async function getUnsyncedMemos(userId: string) {
  return db.getAllAsync<{
    memo_id: string;
    user_id: string;
    reg_date: string;
    title: string;
    memo_content: string;
  }>(
    'SELECT memo_id, user_id, reg_date, title, memo_content FROM tb_memo WHERE user_id = ? AND synced = 0',
    [userId]
  );
}

export async function markMemoSynced(memoId: string) {
  return db.runAsync('UPDATE tb_memo SET synced = 1 WHERE memo_id = ?', [memoId]);
}

// --- TimeBox Types ---
export type BrainDump = {
  dump_id: string;
  tbox_date: string;
  user_id: string;
  dump_title: string;
  dump_content: string;
  priority_yn: string;
  complete_yn: string;
  status: string;
  reg_dt: string;
};

export type TimeTableItem = {
  time_table_id: string;
  dump_id: string;
  tbox_date: string;
  user_id: string;
  time_hour: number;
  time_minute: number;
  color: string;
  dump_title: string;
  priority_yn: string;
  complete_yn: string;
};

// --- Brain Dump ---
export async function getBrainDumps(userId: string, tboxDate: string) {
  return db.getAllAsync<BrainDump>(
    `SELECT dump_id, tbox_date, user_id, dump_title, dump_content,
            priority_yn, complete_yn, status, reg_dt
     FROM tb_tbox_brain_dump
     WHERE user_id = ? AND tbox_date = ?
     ORDER BY priority_yn DESC, dump_id ASC`,
    [userId, tboxDate]
  );
}

export async function saveBrainDump(
  dumpId: string,
  userId: string,
  tboxDate: string,
  dumpTitle: string,
  dumpContent: string,
  priorityYn: string = 'N',
  status: string = '0',
  synced: number = 0
) {
  const now = new Date().toISOString();
  return db.runAsync(
    `INSERT OR REPLACE INTO tb_tbox_brain_dump
      (dump_id, user_id, tbox_date, dump_title, dump_content, priority_yn, complete_yn, status, reg_id, reg_dt, upd_id, mod_dt, synced)
     VALUES (?, ?, ?, ?, ?, ?, 'N', ?, ?, ?, ?, ?, ?)`,
    [
      String(dumpId),
      String(userId),
      String(tboxDate),
      String(dumpTitle),
      String(dumpContent),
      String(priorityYn),
      String(status),
      String(userId),
      now,
      String(userId),
      now,
      synced,
    ]
  );
}

export async function getUnsyncedBrainDumps(userId: string) {
  return db.getAllAsync<{
    dump_id: string;
    tbox_date: string;
    user_id: string;
    dump_title: string;
    dump_content: string;
    priority_yn: string;
    complete_yn: string;
    status: string;
  }>(
    `SELECT dump_id, tbox_date, user_id, dump_title, dump_content, priority_yn, complete_yn, status
     FROM tb_tbox_brain_dump WHERE user_id = ? AND synced = 0`,
    [userId]
  );
}

export async function markBrainDumpSynced(dumpId: string) {
  return db.runAsync('UPDATE tb_tbox_brain_dump SET synced = 1 WHERE dump_id = ?', [String(dumpId)]);
}

export async function togglePriority(dumpId: string, priorityYn: string) {
  const next = priorityYn === 'Y' ? 'N' : 'Y';
  const now = new Date().toISOString();
  return db.runAsync(
    `UPDATE tb_tbox_brain_dump SET priority_yn = ?, mod_dt = ? WHERE dump_id = ?`,
    [next, now, String(dumpId)]
  );
}

export async function toggleComplete(dumpId: string, completeYn: string) {
  const next = completeYn === 'Y' ? 'N' : 'Y';
  const now = new Date().toISOString();
  return db.runAsync(
    `UPDATE tb_tbox_brain_dump SET complete_yn = ?, mod_dt = ? WHERE dump_id = ?`,
    [next, now, String(dumpId)]
  );
}

export async function updateBrainDump(dumpId: string, userId: string, dumpTitle: string, dumpContent: string) {
  const now = new Date().toISOString();
  return db.runAsync(
    `UPDATE tb_tbox_brain_dump SET dump_title = ?, dump_content = ?, upd_id = ?, mod_dt = ?, synced = 0 WHERE dump_id = ?`,
    [String(dumpTitle), String(dumpContent), String(userId), now, String(dumpId)]
  );
}

export async function deleteBrainDump(dumpId: string) {
  return db.runAsync('DELETE FROM tb_tbox_brain_dump WHERE dump_id = ?', [String(dumpId)]);
}

// --- Time Table ---
export async function getTimeTable(userId: string, tboxDate: string) {
  return db.getAllAsync<TimeTableItem>(
    `SELECT t.time_table_id, t.dump_id, t.tbox_date, t.user_id,
            t.time_hour, t.time_minute, t.color,
            COALESCE(d.dump_title, '') AS dump_title,
            COALESCE(d.priority_yn, 'N') AS priority_yn,
            COALESCE(d.complete_yn, 'N') AS complete_yn
     FROM tb_tbox_time_table t
     LEFT JOIN tb_tbox_brain_dump d ON t.dump_id = d.dump_id
     WHERE t.user_id = ? AND t.tbox_date = ?
     ORDER BY t.time_hour ASC, t.time_minute ASC`,
    [userId, tboxDate]
  );
}

export async function saveTimeTable(
  timeTableId: string,
  dumpId: string,
  tboxDate: string,
  userId: string,
  timeHour: number,
  timeMinute: number,
  color: string,
  synced: string
) {
  const now = new Date().toISOString();
  return db.runAsync(
    `INSERT OR REPLACE INTO tb_tbox_time_table
      (time_table_id, dump_id, tbox_date, user_id, time_hour, time_minute, color, reg_id, reg_dt, upd_id, mod_dt, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      String(timeTableId),
      String(dumpId),
      String(tboxDate),
      String(userId),
      Number(timeHour),
      Number(timeMinute),
      String(color),
      String(userId),
      now,
      String(userId),
      now,
      String(synced)
    ]
  );
}

export async function deleteTimeTable(timeTableId: string) {
  return db.runAsync('DELETE FROM tb_tbox_time_table WHERE time_table_id = ?', [String(timeTableId)]);
}

export async function getUnsyncedTimeTables(userId: string) {
  return db.getAllAsync<{
    time_table_id: string;
    dump_id: string;
    tbox_date: string;
    user_id: string;
    time_hour: number;
    time_minute: number;
    color: string;
  }>(
    `SELECT time_table_id, dump_id, tbox_date, user_id, time_hour, time_minute, color
     FROM tb_tbox_time_table WHERE user_id = ? AND synced = 0`,
    [userId]
  );
}

export async function markTimeTableSynced(timeTableId: string) {
  return db.runAsync('UPDATE tb_tbox_time_table SET synced = 1 WHERE time_table_id = ?', [String(timeTableId)]);
}
