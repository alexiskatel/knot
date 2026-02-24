import { type SQLiteDatabase } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';

export interface Tache {
  id: number;
  server_id: number | null;
  sync_id: string;
  titre: string;
  description: string | null;
  statut: 'todo' | 'en_cours' | 'done';
  projet_id: number;
  auteur_id: number;
  assigne_id: number | null;
  team_id: number;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  sync_status: string;
  // Joined fields
  projet_titre?: string;
  projet_couleur?: string;
  auteur_nom?: string;
  auteur_prenom?: string;
  assigne_nom?: string;
  assigne_prenom?: string;
}

export async function getTachesByTeam(
  db: SQLiteDatabase,
  teamId: number,
  projetId?: number,
): Promise<Tache[]> {
  const sql = projetId
    ? `SELECT t.*, p.titre as projet_titre, p.couleur as projet_couleur,
              u.nom as auteur_nom, u.prenom as auteur_prenom,
              a.nom as assigne_nom, a.prenom as assigne_prenom
       FROM taches t
       LEFT JOIN projets p ON p.id = t.projet_id
       LEFT JOIN users u ON u.id = t.auteur_id
       LEFT JOIN users a ON a.id = t.assigne_id
       WHERE t.team_id = ? AND t.projet_id = ?
       ORDER BY t.due_date ASC, t.created_at DESC`
    : `SELECT t.*, p.titre as projet_titre, p.couleur as projet_couleur,
              u.nom as auteur_nom, u.prenom as auteur_prenom,
              a.nom as assigne_nom, a.prenom as assigne_prenom
       FROM taches t
       LEFT JOIN projets p ON p.id = t.projet_id
       LEFT JOIN users u ON u.id = t.auteur_id
       LEFT JOIN users a ON a.id = t.assigne_id
       WHERE t.team_id = ?
       ORDER BY t.statut ASC, t.due_date ASC, t.created_at DESC`;

  return db.getAllAsync<Tache>(sql, ...(projetId ? [teamId, projetId] : [teamId]));
}

export async function getTacheById(db: SQLiteDatabase, id: number): Promise<Tache | null> {
  return db.getFirstAsync<Tache>(
    `SELECT t.*, p.titre as projet_titre, p.couleur as projet_couleur,
            u.nom as auteur_nom, u.prenom as auteur_prenom,
            a.nom as assigne_nom, a.prenom as assigne_prenom
     FROM taches t
     LEFT JOIN projets p ON p.id = t.projet_id
     LEFT JOIN users u ON u.id = t.auteur_id
     LEFT JOIN users a ON a.id = t.assigne_id
     WHERE t.id = ?`,
    id,
  );
}

export async function createTache(
  db: SQLiteDatabase,
  data: {
    titre: string;
    description?: string;
    statut?: Tache['statut'];
    projet_id: number;
    auteur_id: number;
    assigne_id?: number | null;
    team_id: number;
    due_date?: string | null;
  },
): Promise<Tache> {
  const sync_id = randomUUID();
  const now = new Date().toISOString();
  const statut = data.statut ?? 'todo';

  const result = await db.runAsync(
    `INSERT INTO taches
       (sync_id, titre, description, statut, projet_id, auteur_id, assigne_id,
        team_id, due_date, created_at, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    sync_id,
    data.titre,
    data.description ?? null,
    statut,
    data.projet_id,
    data.auteur_id,
    data.assigne_id ?? null,
    data.team_id,
    data.due_date ?? null,
    now,
    now,
  );

  return {
    id: result.lastInsertRowId,
    server_id: null,
    sync_id,
    titre: data.titre,
    description: data.description ?? null,
    statut,
    projet_id: data.projet_id,
    auteur_id: data.auteur_id,
    assigne_id: data.assigne_id ?? null,
    team_id: data.team_id,
    due_date: data.due_date ?? null,
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };
}

export async function updateTache(
  db: SQLiteDatabase,
  id: number,
  data: Partial<Pick<Tache, 'titre' | 'description' | 'statut' | 'projet_id' | 'assigne_id' | 'due_date'>>,
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE taches
     SET titre      = COALESCE(?, titre),
         description = COALESCE(?, description),
         statut     = COALESCE(?, statut),
         projet_id  = COALESCE(?, projet_id),
         assigne_id = COALESCE(?, assigne_id),
         due_date   = COALESCE(?, due_date),
         updated_at = ?,
         sync_status = 'pending'
     WHERE id = ?`,
    data.titre ?? null,
    data.description ?? null,
    data.statut ?? null,
    data.projet_id ?? null,
    data.assigne_id ?? null,
    data.due_date ?? null,
    now,
    id,
  );
}

export async function deleteTache(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM taches WHERE id = ?', id);
}
