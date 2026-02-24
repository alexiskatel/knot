import { type SQLiteDatabase } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';

export interface Commentaire {
  id: number;
  server_id: number | null;
  sync_id: string;
  contenu: string;
  note_id: number | null;
  tache_id: number | null;
  auteur_id: number;
  team_id: number;
  created_at: string;
  sync_status: string;
  // joined
  auteur_nom?: string;
  auteur_prenom?: string;
}

const SELECT_WITH_AUTEUR = `
  SELECT c.*, u.nom as auteur_nom, u.prenom as auteur_prenom
  FROM commentaires c
  LEFT JOIN users u ON u.id = c.auteur_id
`;

export async function getCommentairesByNote(
  db: SQLiteDatabase,
  noteLocalId: number,
): Promise<Commentaire[]> {
  return db.getAllAsync<Commentaire>(
    `${SELECT_WITH_AUTEUR} WHERE c.note_id = ? ORDER BY c.created_at ASC`,
    noteLocalId,
  );
}

export async function getCommentairesByTache(
  db: SQLiteDatabase,
  tacheLocalId: number,
): Promise<Commentaire[]> {
  return db.getAllAsync<Commentaire>(
    `${SELECT_WITH_AUTEUR} WHERE c.tache_id = ? ORDER BY c.created_at ASC`,
    tacheLocalId,
  );
}

export async function createCommentaire(
  db: SQLiteDatabase,
  data: {
    contenu: string;
    note_id?: number;
    tache_id?: number;
    auteur_id: number;
    team_id: number;
  },
): Promise<Commentaire> {
  const sync_id = randomUUID();
  const now = new Date().toISOString();

  const result = await db.runAsync(
    `INSERT INTO commentaires
       (sync_id, contenu, note_id, tache_id, auteur_id, team_id, created_at, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    sync_id,
    data.contenu,
    data.note_id ?? null,
    data.tache_id ?? null,
    data.auteur_id,
    data.team_id,
    now,
    now,
  );

  return {
    id: result.lastInsertRowId,
    server_id: null,
    sync_id,
    contenu: data.contenu,
    note_id: data.note_id ?? null,
    tache_id: data.tache_id ?? null,
    auteur_id: data.auteur_id,
    team_id: data.team_id,
    created_at: now,
    sync_status: 'pending',
  };
}

export async function deleteCommentaire(
  db: SQLiteDatabase,
  id: number,
): Promise<void> {
  await db.runAsync('DELETE FROM commentaires WHERE id = ?', id);
}

export async function upsertCommentaireFromServer(
  db: SQLiteDatabase,
  data: {
    id: number;
    contenu: string;
    created_at: string;
    updated_at: string;
    sync_id?: string;
  },
  auteurLocalId: number,
  teamLocalId: number,
  noteLocalId?: number,
  tacheLocalId?: number,
): Promise<void> {
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM commentaires WHERE server_id = ?',
    data.id,
  );

  if (existing) {
    await db.runAsync(
      `UPDATE commentaires
       SET contenu = ?, updated_at = ?, sync_status = 'synced'
       WHERE server_id = ?`,
      data.contenu, data.updated_at, data.id,
    );
  } else {
    const sync_id = data.sync_id ?? randomUUID();
    await db.runAsync(
      `INSERT OR IGNORE INTO commentaires
         (server_id, sync_id, contenu, note_id, tache_id, auteur_id, team_id, created_at, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
      data.id,
      sync_id,
      data.contenu,
      noteLocalId ?? null,
      tacheLocalId ?? null,
      auteurLocalId,
      teamLocalId,
      data.created_at,
      data.updated_at,
    );
  }
}
