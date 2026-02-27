import { type SQLiteDatabase } from 'expo-sqlite';

export interface AppNotification {
  id: number;
  ref_id: string | null;
  type: 'assignment' | 'mention' | 'due_soon' | 'overdue';
  titre: string;
  corps: string | null;
  entity_type: 'note' | 'tache' | null;
  entity_id: number | null;
  is_read: number;
  created_at: string;
}

export async function getNotifications(db: SQLiteDatabase): Promise<AppNotification[]> {
  return db.getAllAsync<AppNotification>(
    'SELECT * FROM notifications ORDER BY created_at DESC',
  );
}

export async function getUnreadCount(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM notifications WHERE is_read = 0',
  );
  return row?.count ?? 0;
}

export async function markAllRead(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('UPDATE notifications SET is_read = 1');
}

export async function markRead(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('UPDATE notifications SET is_read = 1 WHERE id = ?', id);
}

export async function createNotification(
  db: SQLiteDatabase,
  data: {
    ref_id?: string;
    type: AppNotification['type'];
    titre: string;
    corps?: string;
    entity_type?: 'note' | 'tache';
    entity_id?: number;
  },
): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO notifications (ref_id, type, titre, corps, entity_type, entity_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    data.ref_id ?? null,
    data.type,
    data.titre,
    data.corps ?? null,
    data.entity_type ?? null,
    data.entity_id ?? null,
  );
}

export async function deleteNotification(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM notifications WHERE id = ?', id);
}

export async function clearAllNotifications(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM notifications');
}
