import * as SQLite from 'expo-sqlite';
import { PendingScan, ScanType } from '../types';

const DB_NAME = 'logiscan_offline.db';

let db: SQLite.SQLiteDatabase | null = null;

/** Initialize the SQLite database and create the scans table */
export async function initDB(): Promise<void> {
  db = await SQLite.openDatabaseAsync(DB_NAME);

  // Migrate: add clientId column if missing (table may predate this column)
  try {
    await db.runAsync('SELECT clientId FROM scans LIMIT 1');
  } catch {
    // Column doesn't exist — drop and recreate
    await db.execAsync('DROP TABLE IF EXISTS scans;');
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS scans (
      localId TEXT PRIMARY KEY,
      barcode TEXT NOT NULL,
      scanType TEXT NOT NULL,
      operationId TEXT NOT NULL,
      routeId TEXT NOT NULL,
      clientId TEXT,
      scannedAt TEXT NOT NULL,
      syncStatus TEXT NOT NULL DEFAULT 'pending',
      retryCount INTEGER NOT NULL DEFAULT 0,
      serverScanId TEXT
    );
  `);
}

function getDB(): SQLite.SQLiteDatabase {
  if (!db) throw new Error('Database not initialized. Call initDB() first.');
  return db;
}

/** Generate a simple UUID v4 */
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Add a scan to the offline queue */
export async function addScan(scan: {
  barcode: string;
  scanType: ScanType;
  operationId: string;
  routeId: string;
  clientId?: string | null;
}): Promise<string> {
  const localId = uuid();
  const scannedAt = new Date().toISOString();

  await getDB().runAsync(
    'INSERT INTO scans (localId, barcode, scanType, operationId, routeId, clientId, scannedAt, syncStatus, retryCount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [localId, scan.barcode, scan.scanType, scan.operationId, scan.routeId, scan.clientId ?? null, scannedAt, 'pending', 0]
  );

  return localId;
}

/** Get pending scans ready for sync */
export async function getPendingScans(limit: number = 50): Promise<PendingScan[]> {
  return getDB().getAllAsync<PendingScan>(
    'SELECT * FROM scans WHERE syncStatus = ? ORDER BY scannedAt ASC LIMIT ?',
    ['pending', limit]
  );
}

/** Mark a scan as successfully synced */
export async function markSynced(localId: string, serverScanId?: string): Promise<void> {
  await getDB().runAsync(
    'UPDATE scans SET syncStatus = ?, serverScanId = ? WHERE localId = ?',
    ['synced', serverScanId ?? null, localId]
  );
}

/** Mark a scan as failed (increment retry count) */
export async function markFailed(localId: string): Promise<void> {
  await getDB().runAsync(
    'UPDATE scans SET retryCount = retryCount + 1, syncStatus = CASE WHEN retryCount >= 2 THEN ? ELSE ? END WHERE localId = ?',
    ['failed', 'pending', localId]
  );
}

/** Get count of scans by sync status */
export async function getStats(): Promise<Record<string, number>> {
  const rows = await getDB().getAllAsync<{ syncStatus: string; count: number }>(
    'SELECT syncStatus, COUNT(*) as count FROM scans GROUP BY syncStatus'
  );
  const stats: Record<string, number> = { pending: 0, syncing: 0, synced: 0, failed: 0 };
  rows.forEach((row) => { stats[row.syncStatus] = row.count; });
  return stats;
}

/** Get all scans (for local history display), ordered by most recent first */
export async function getAllScans(limit: number = 100): Promise<PendingScan[]> {
  return getDB().getAllAsync<PendingScan>(
    'SELECT * FROM scans ORDER BY scannedAt DESC LIMIT ?',
    [limit]
  );
}

/** Clean up old synced scans (older than 24 hours) */
export async function cleanSynced(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await getDB().runAsync(
    'DELETE FROM scans WHERE syncStatus = ? AND scannedAt < ?',
    ['synced', cutoff]
  );
}
