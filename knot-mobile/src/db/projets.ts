import { type SQLiteDatabase } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';

export interface Projet {
  id: number;
  server_id: number | null;
  sync_id: string;
  titre: string;
  description: string | null;
  couleur: string;
  statut: number;
  team_id: number;
  created_at: string;
  updated_at: string;
  sync_status: string;
  note_count: number;
}

export async function getAllProjets(db: SQLiteDatabase, teamId: number): Promise<Projet[]> {
  return db.getAllAsync<Projet>(
    `SELECT p.*, COUNT(n.id) as note_count
     FROM projets p
     LEFT JOIN notes n ON n.projet_id = p.id
     WHERE p.team_id = ? AND p.statut = 1
     GROUP BY p.id
     ORDER BY p.created_at ASC`,
    teamId,
  );
}

export async function getProjetById(db: SQLiteDatabase, id: number): Promise<Projet | null> {
  return db.getFirstAsync<Projet>('SELECT * FROM projets WHERE id = ?', id);
}

export async function createProjet(
  db: SQLiteDatabase,
  data: { titre: string; description?: string; couleur?: string; team_id: number },
): Promise<Projet> {
  const sync_id = randomUUID();
  const now = new Date().toISOString();

  const result = await db.runAsync(
    `INSERT INTO projets (sync_id, titre, description, couleur, statut, team_id, created_at, updated_at, sync_status)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?, 'pending')`,
    sync_id,
    data.titre,
    data.description ?? null,
    data.couleur ?? '#2F3C73',
    data.team_id,
    now,
    now,
  );

  return {
    id: result.lastInsertRowId,
    server_id: null,
    sync_id,
    titre: data.titre,
    description: data.description ?? null,
    couleur: data.couleur ?? '#2F3C73',
    statut: 1,
    team_id: data.team_id,
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
    note_count: 0,
  };
}

export async function updateProjet(
  db: SQLiteDatabase,
  id: number,
  data: Partial<Pick<Projet, 'titre' | 'description' | 'couleur'>>,
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE projets SET titre = COALESCE(?, titre), description = COALESCE(?, description),
     couleur = COALESCE(?, couleur), updated_at = ?, sync_status = 'pending' WHERE id = ?`,
    data.titre ?? null,
    data.description ?? null,
    data.couleur ?? null,
    now,
    id,
  );
}

export async function deleteProjet(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM projets WHERE id = ?', id);
}
