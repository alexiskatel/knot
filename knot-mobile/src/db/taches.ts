import { type SQLiteDatabase } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { Projet } from './projets';

export interface Tache {
  id: number;
  server_id: number | null;
  sync_id: string;
  titre: string;
  description: string | null;
  statut: 'todo' | 'en_cours' | 'done';
  projet_id: number;
  projet: Projet;
  auteur_id: number;
  assigne_id: number | null;
  team_id: number;
  due_date: string | null;
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
  assigne_nom?: string;
  assigne_prenom?: string;
  commentaire_count?: number;
}

export async function getTachesByTeam(
  db: SQLiteDatabase,
  teamId: number,
  projetId?: number,
): Promise<Tache[]> {
  const sql = projetId
    ? `SELECT t.*, 
              u.nom as auteur_nom, u.prenom as auteur_prenom,
              a.nom as assigne_nom, a.prenom as assigne_prenom,
              (SELECT COUNT(*) FROM commentaires WHERE tache_id = t.id) as commentaire_count,
              p.id as projet_id_ref,
              p.titre as projet_titre,
              p.couleur as projet_couleur,
              p.statut as projet_statut
       FROM taches t
       LEFT JOIN projets p ON p.id = t.projet_id
       LEFT JOIN users u ON u.id = t.auteur_id
       LEFT JOIN users a ON a.id = t.assigne_id
       WHERE t.team_id = ? AND t.projet_id = ? AND t.deleted_at IS NULL
       ORDER BY t.due_date ASC, t.created_at DESC`
    : `SELECT t.*, 
              u.nom as auteur_nom, u.prenom as auteur_prenom,
              a.nom as assigne_nom, a.prenom as assigne_prenom,
              (SELECT COUNT(*) FROM commentaires WHERE tache_id = t.id) as commentaire_count,
              p.id as projet_id_ref,
              p.titre as projet_titre,
              p.couleur as projet_couleur,
              p.statut as projet_statut
       FROM taches t
       LEFT JOIN projets p ON p.id = t.projet_id
       LEFT JOIN users u ON u.id = t.auteur_id
       LEFT JOIN users a ON a.id = t.assigne_id
       WHERE t.team_id = ? AND t.deleted_at IS NULL
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
  data: {
    titre?: string;
    description?: string | null;
    statut?: Tache['statut'];
    projet_id?: number;
    assigne_id?: number | null; // undefined = ne pas modifier, null = effacer
    due_date?: string | null;   // undefined = ne pas modifier, null = effacer
  },
): Promise<void> {
  const now = new Date().toISOString();
  // Génération dynamique du SET pour supporter la mise à null explicite
  const clauses: string[] = ["updated_at = ?", "sync_status = 'pending'"];
  const params: (string | number | null)[] = [now];

  if (data.titre !== undefined)    { clauses.push('titre = ?');       params.push(data.titre); }
  if (data.description !== undefined) { clauses.push('description = ?'); params.push(data.description ?? null); }
  if (data.statut !== undefined)   { clauses.push('statut = ?');      params.push(data.statut); }
  if (data.projet_id !== undefined){ clauses.push('projet_id = ?');   params.push(data.projet_id); }
  if ('assigne_id' in data)        { clauses.push('assigne_id = ?');  params.push(data.assigne_id ?? null); }
  if ('due_date' in data)          { clauses.push('due_date = ?');    params.push(data.due_date ?? null); }

  params.push(id);
  await db.runAsync(
    `UPDATE taches SET ${clauses.join(', ')} WHERE id = ?`,
    ...params,
  );
}

export async function softDeleteTache(db: SQLiteDatabase, id: number, deletedBy: number): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync('UPDATE taches SET deleted_at = ?, deleted_by = ? WHERE id = ?', now, deletedBy, id);
}

export async function restoreTache(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('UPDATE taches SET deleted_at = NULL WHERE id = ?', id);
}

export async function deleteTache(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM taches WHERE id = ?', id);
}
