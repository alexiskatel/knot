import { type SQLiteDatabase } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';

export interface LinkedItem {
  liaison_id: number;
  liaison_server_id: number | null;
  liaison_sync_id: string;
  type: 'note' | 'tache';
  id: number;           // local id
  server_id: number | null;
  titre: string;
  statut: string;
  projet_titre: string | null;
  projet_couleur: string | null;
}

export async function getLiaisonsByNote(
  db: SQLiteDatabase,
  noteLocalId: number,
): Promise<LinkedItem[]> {
  // Links where note is source → fetch target
  const asSource = await db.getAllAsync<any>(
    `SELECT l.id as liaison_id, l.server_id as liaison_server_id, l.sync_id as liaison_sync_id,
            l.target_type as type,
            n.id, n.server_id, n.titre, n.statut,
            p.titre as projet_titre, p.couleur as projet_couleur
     FROM liaisons l
     JOIN notes n ON n.id = l.target_id AND l.target_type = 'note'
     LEFT JOIN projets p ON p.id = n.projet_id
     WHERE l.source_type = 'note' AND l.source_id = ?`,
    noteLocalId,
  );

  const asSourceTache = await db.getAllAsync<any>(
    `SELECT l.id as liaison_id, l.server_id as liaison_server_id, l.sync_id as liaison_sync_id,
            l.target_type as type,
            t.id, t.server_id, t.titre, t.statut,
            p.titre as projet_titre, p.couleur as projet_couleur
     FROM liaisons l
     JOIN taches t ON t.id = l.target_id AND l.target_type = 'tache'
     LEFT JOIN projets p ON p.id = t.projet_id
     WHERE l.source_type = 'note' AND l.source_id = ?`,
    noteLocalId,
  );

  // Links where note is target → fetch source
  const asTargetNote = await db.getAllAsync<any>(
    `SELECT l.id as liaison_id, l.server_id as liaison_server_id, l.sync_id as liaison_sync_id,
            l.source_type as type,
            n.id, n.server_id, n.titre, n.statut,
            p.titre as projet_titre, p.couleur as projet_couleur
     FROM liaisons l
     JOIN notes n ON n.id = l.source_id AND l.source_type = 'note'
     LEFT JOIN projets p ON p.id = n.projet_id
     WHERE l.target_type = 'note' AND l.target_id = ?`,
    noteLocalId,
  );

  const asTargetTache = await db.getAllAsync<any>(
    `SELECT l.id as liaison_id, l.server_id as liaison_server_id, l.sync_id as liaison_sync_id,
            l.source_type as type,
            t.id, t.server_id, t.titre, t.statut,
            p.titre as projet_titre, p.couleur as projet_couleur
     FROM liaisons l
     JOIN taches t ON t.id = l.source_id AND l.source_type = 'tache'
     LEFT JOIN projets p ON p.id = t.projet_id
     WHERE l.target_type = 'note' AND l.target_id = ?`,
    noteLocalId,
  );

  return [...asSource, ...asSourceTache, ...asTargetNote, ...asTargetTache] as LinkedItem[];
}

export async function getLiaisonsByTache(
  db: SQLiteDatabase,
  tacheLocalId: number,
): Promise<LinkedItem[]> {
  const asSourceNote = await db.getAllAsync<any>(
    `SELECT l.id as liaison_id, l.server_id as liaison_server_id, l.sync_id as liaison_sync_id,
            l.target_type as type,
            n.id, n.server_id, n.titre, n.statut,
            p.titre as projet_titre, p.couleur as projet_couleur
     FROM liaisons l
     JOIN notes n ON n.id = l.target_id AND l.target_type = 'note'
     LEFT JOIN projets p ON p.id = n.projet_id
     WHERE l.source_type = 'tache' AND l.source_id = ?`,
    tacheLocalId,
  );

  const asSource = await db.getAllAsync<any>(
    `SELECT l.id as liaison_id, l.server_id as liaison_server_id, l.sync_id as liaison_sync_id,
            l.target_type as type,
            t.id, t.server_id, t.titre, t.statut,
            p.titre as projet_titre, p.couleur as projet_couleur
     FROM liaisons l
     JOIN taches t ON t.id = l.target_id AND l.target_type = 'tache'
     LEFT JOIN projets p ON p.id = t.projet_id
     WHERE l.source_type = 'tache' AND l.source_id = ?`,
    tacheLocalId,
  );

  const asTargetTache = await db.getAllAsync<any>(
    `SELECT l.id as liaison_id, l.server_id as liaison_server_id, l.sync_id as liaison_sync_id,
            l.source_type as type,
            t.id, t.server_id, t.titre, t.statut,
            p.titre as projet_titre, p.couleur as projet_couleur
     FROM liaisons l
     JOIN taches t ON t.id = l.source_id AND l.source_type = 'tache'
     LEFT JOIN projets p ON p.id = t.projet_id
     WHERE l.target_type = 'tache' AND l.target_id = ?`,
    tacheLocalId,
  );

  const asTargetNote = await db.getAllAsync<any>(
    `SELECT l.id as liaison_id, l.server_id as liaison_server_id, l.sync_id as liaison_sync_id,
            l.source_type as type,
            n.id, n.server_id, n.titre, n.statut,
            p.titre as projet_titre, p.couleur as projet_couleur
     FROM liaisons l
     JOIN notes n ON n.id = l.source_id AND l.source_type = 'note'
     LEFT JOIN projets p ON p.id = n.projet_id
     WHERE l.target_type = 'tache' AND l.target_id = ?`,
    tacheLocalId,
  );

  return [...asSourceNote, ...asSource, ...asTargetTache, ...asTargetNote] as LinkedItem[];
}

export async function createLiaison(
  db: SQLiteDatabase,
  data: {
    source_type: 'note' | 'tache';
    source_id: number;
    target_type: 'note' | 'tache';
    target_id: number;
    team_id: number;
  },
): Promise<{ id: number; sync_id: string }> {
  const sync_id = randomUUID();
  const now = new Date().toISOString();

  const result = await db.runAsync(
    `INSERT OR IGNORE INTO liaisons
       (sync_id, source_type, source_id, target_type, target_id, team_id, created_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    sync_id,
    data.source_type,
    data.source_id,
    data.target_type,
    data.target_id,
    data.team_id,
    now,
  );

  return { id: result.lastInsertRowId, sync_id };
}

export async function deleteLiaison(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM liaisons WHERE id = ?', id);
}
