import { type SQLiteDatabase } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';

export interface Note {
  id: number;
  server_id: number | null;
  sync_id: string;
  titre: string;
  contenu: string;
  statut: 'brouillon' | 'publie' | 'archive';
  projet_id: number;
  auteur_id: number;
  team_id: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: number | null;
  sync_status: string;
  // Joined fields
  projet_titre?: string;
  projet_couleur?: string;
  auteur_nom?: string;
  auteur_prenom?: string;
  commentaire_count?: number;
}

export async function getNotesByTeam(
  db: SQLiteDatabase,
  teamId: number,
  projetId?: number,
): Promise<Note[]> {
  const sql = projetId
    ? `SELECT n.*, p.titre as projet_titre, p.couleur as projet_couleur,
              u.nom as auteur_nom, u.prenom as auteur_prenom,
              (SELECT COUNT(*) FROM commentaires WHERE note_id = n.id) as commentaire_count
       FROM notes n
       LEFT JOIN projets p ON p.id = n.projet_id
       LEFT JOIN users u ON u.id = n.auteur_id
       WHERE n.team_id = ? AND n.projet_id = ? AND n.statut != 'archive' AND n.deleted_at IS NULL
       ORDER BY n.updated_at DESC`
    : `SELECT n.*, p.titre as projet_titre, p.couleur as projet_couleur,
              u.nom as auteur_nom, u.prenom as auteur_prenom,
              (SELECT COUNT(*) FROM commentaires WHERE note_id = n.id) as commentaire_count
       FROM notes n
       LEFT JOIN projets p ON p.id = n.projet_id
       LEFT JOIN users u ON u.id = n.auteur_id
       WHERE n.team_id = ? AND n.statut != 'archive' AND n.deleted_at IS NULL
       ORDER BY n.updated_at DESC`;

  return db.getAllAsync<Note>(sql, ...(projetId ? [teamId, projetId] : [teamId]));
}

export async function getNoteById(db: SQLiteDatabase, id: number): Promise<Note | null> {
  return db.getFirstAsync<Note>(
    `SELECT n.*, p.titre as projet_titre, p.couleur as projet_couleur,
            u.nom as auteur_nom, u.prenom as auteur_prenom
     FROM notes n
     LEFT JOIN projets p ON p.id = n.projet_id
     LEFT JOIN users u ON u.id = n.auteur_id
     WHERE n.id = ?`,
    id,
  );
}

export async function createNote(
  db: SQLiteDatabase,
  data: {
    titre: string;
    contenu?: string;
    statut?: Note['statut'];
    projet_id: number;
    auteur_id: number;
    team_id: number;
  },
): Promise<Note> {
  const sync_id = randomUUID();
  const now = new Date().toISOString();
  const statut = data.statut ?? 'brouillon';

  const result = await db.runAsync(
    `INSERT INTO notes (sync_id, titre, contenu, statut, projet_id, auteur_id, team_id, created_at, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    sync_id,
    data.titre,
    data.contenu ?? '',
    statut,
    data.projet_id,
    data.auteur_id,
    data.team_id,
    now,
    now,
  );

  return {
    id: result.lastInsertRowId,
    server_id: null,
    sync_id,
    titre: data.titre,
    contenu: data.contenu ?? '',
    statut,
    projet_id: data.projet_id,
    auteur_id: data.auteur_id,
    team_id: data.team_id,
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };
}

export async function updateNote(
  db: SQLiteDatabase,
  id: number,
  data: Partial<Pick<Note, 'titre' | 'contenu' | 'statut' | 'projet_id'>>,
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE notes
     SET titre = COALESCE(?, titre),
         contenu = COALESCE(?, contenu),
         statut = COALESCE(?, statut),
         projet_id = COALESCE(?, projet_id),
         updated_at = ?,
         sync_status = 'pending'
     WHERE id = ?`,
    data.titre ?? null,
    data.contenu ?? null,
    data.statut ?? null,
    data.projet_id ?? null,
    now,
    id,
  );
}

export async function softDeleteNote(db: SQLiteDatabase, id: number, deletedBy: number): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync('UPDATE notes SET deleted_at = ?, deleted_by = ? WHERE id = ?', now, deletedBy, id);
}

export async function restoreNote(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('UPDATE notes SET deleted_at = NULL WHERE id = ?', id);
}

export async function deleteNote(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM notes WHERE id = ?', id);
}
