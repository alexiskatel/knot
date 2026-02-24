import { type SQLiteDatabase } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { api } from '../api/client';

// ── Helpers ──────────────────────────────────────────────────────────────────

// Le backend retourne { list: { data: [...] } } pour ?all=1
// ou { list: [...] } pour les collections sans pagination
function extractList<T>(res: any): T[] {
  if (Array.isArray(res?.list)) return res.list;
  if (Array.isArray(res?.list?.data)) return res.list.data;
  return [];
}

async function safeSync(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.warn(`[Sync] ${label} échoué:`, e);
  }
}

// Le backend stocke les statuts avec accents (publié/archivé).
// Le mobile utilise les versions sans accent (publie/archive).
function normalizeStatutNote(s: string): string {
  if (s === 'publié')  return 'publie';
  if (s === 'archivé') return 'archive';
  return s;
}

function accentStatutNote(s: string): string {
  if (s === 'publie')  return 'publié';
  if (s === 'archive') return 'archivé';
  return s;
}

// ── Types serveur ─────────────────────────────────────────────────────────────

interface ServerTeam {
  id: number;
  nom: string;
  code_unique: string;
  couleur_primaire: string;
  description: string | null;
}

interface ServerUser {
  id: number;
  nom: string;
  prenom: string | null;
  email: string | null;
}

interface ServerProjet {
  id: number;
  titre: string;
  description: string | null;
  couleur: string;
  statut: boolean | number;
  team_id: number;
  created_at: string;
  updated_at: string;
}

interface ServerNote {
  id: number;
  titre: string;
  contenu: string;
  statut: string;
  projet_id: number;
  auteur_id: number;
  team_id: number;
  created_at: string;
  updated_at: string;
}

interface ServerTache {
  id: number;
  titre: string;
  description: string | null;
  statut: string;
  projet_id: number;
  auteur_id: number;
  assigne_id: number | null;
  team_id: number;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

// ── Sync principal ────────────────────────────────────────────────────────────

export async function syncAll(
  db: SQLiteDatabase,
  teamLocalId: number,
  teamServerId: number,
): Promise<void> {

  // ── Team info ─────────────────────────────────────────────────────────────
  await safeSync('team', async () => {
    const res = await api.get<any>(`/teams/${teamServerId}`);
    const team: ServerTeam = res.list;
    if (!team) return;
    await db.runAsync(
      `UPDATE teams SET nom = ?, code_unique = ?, couleur_primaire = ?
       WHERE server_id = ?`,
      team.nom, team.code_unique, team.couleur_primaire, teamServerId,
    );
  });

  // ── Membres ───────────────────────────────────────────────────────────────
  await safeSync('membres', async () => {
    const res = await api.get<any>(`/teams/${teamServerId}/members`);
    const users = extractList<ServerUser>(res);
    for (const u of users) {
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM users WHERE server_id = ?', u.id,
      );
      if (existing) {
        await db.runAsync(
          'UPDATE users SET nom = ?, prenom = ?, email = ? WHERE server_id = ?',
          u.nom, u.prenom ?? '', u.email ?? '', u.id,
        );
      } else {
        await db.runAsync(
          `INSERT OR IGNORE INTO users (server_id, nom, prenom, email, team_id, api_key)
           VALUES (?, ?, ?, ?, ?, '')`,
          u.id, u.nom, u.prenom ?? '', u.email ?? '', teamLocalId,
        );
      }
    }
  });

  // ── Projets ───────────────────────────────────────────────────────────────
  await safeSync('projets', async () => {
    const res = await api.get<any>(`/teams/${teamServerId}/projets?all=1`);
    const projets = extractList<ServerProjet>(res);
    for (const p of projets) {
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM projets WHERE server_id = ?', p.id,
      );
      if (existing) {
        await db.runAsync(
          `UPDATE projets
           SET titre = ?, description = ?, couleur = ?, statut = ?, updated_at = ?, sync_status = 'synced'
           WHERE server_id = ?`,
          p.titre, p.description ?? null, p.couleur ?? '#2F3C73',
          p.statut ? 1 : 0, p.updated_at, p.id,
        );
      } else {
        await db.runAsync(
          `INSERT INTO projets
             (server_id, sync_id, titre, description, couleur, statut, team_id, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
          p.id, randomUUID(), p.titre, p.description ?? null,
          p.couleur ?? '#2F3C73', p.statut ? 1 : 0,
          teamLocalId, p.created_at, p.updated_at,
        );
      }
    }
  });

  // ── Notes ─────────────────────────────────────────────────────────────────
  await safeSync('notes', async () => {
    const res = await api.get<any>(`/teams/${teamServerId}/notes?all=1`);
    const notes = extractList<ServerNote>(res);
    for (const n of notes) {
      const projetRow = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM projets WHERE server_id = ?', n.projet_id,
      );
      if (!projetRow) continue;

      const auteurRow = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM users WHERE server_id = ?', n.auteur_id,
      );

      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM notes WHERE server_id = ?', n.id,
      );
      const statut = normalizeStatutNote(n.statut ?? 'publie');
      if (existing) {
        await db.runAsync(
          `UPDATE notes
           SET titre = ?, contenu = ?, statut = ?, projet_id = ?, updated_at = ?, sync_status = 'synced'
           WHERE server_id = ?`,
          n.titre, n.contenu ?? '', statut,
          projetRow.id, n.updated_at, n.id,
        );
      } else {
        await db.runAsync(
          `INSERT INTO notes
             (server_id, sync_id, titre, contenu, statut, projet_id, auteur_id, team_id, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
          n.id, randomUUID(), n.titre, n.contenu ?? '',
          statut, projetRow.id,
          auteurRow?.id ?? 1, teamLocalId,
          n.created_at, n.updated_at,
        );
      }
    }
  });

  // ── Tâches (pull) ─────────────────────────────────────────────────────────
  await safeSync('taches', async () => {
    const res = await api.get<any>(`/teams/${teamServerId}/taches?all=1`);
    
    const taches = extractList<ServerTache>(res);
    console.log('Ha ', taches);
    for (const t of taches) {
      const projetRow = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM projets WHERE server_id = ?', t.projet_id,
      );
      if (!projetRow) continue;

      const auteurRow = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM users WHERE server_id = ?', t.auteur_id,
      );
      const assigneRow = t.assigne_id
        ? await db.getFirstAsync<{ id: number }>(
            'SELECT id FROM users WHERE server_id = ?', t.assigne_id,
          )
        : null;

      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM taches WHERE server_id = ?', t.id,
      );
      if (existing) {
        await db.runAsync(
          `UPDATE taches
           SET titre = ?, description = ?, statut = ?, projet_id = ?,
               assigne_id = ?, due_date = ?, updated_at = ?, sync_status = 'synced'
           WHERE server_id = ?`,
          t.titre, t.description ?? null, t.statut ?? 'todo',
          projetRow.id, assigneRow?.id ?? null, t.due_date ?? null,
          t.updated_at, t.id,
        );
      } else {
        await db.runAsync(
          `INSERT INTO taches
             (server_id, sync_id, titre, description, statut, projet_id, auteur_id,
              assigne_id, team_id, due_date, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
          t.id, randomUUID(), t.titre, t.description ?? null,
          t.statut ?? 'todo', projetRow.id, auteurRow?.id ?? 1,
          assigneRow?.id ?? null, teamLocalId,
          t.due_date ?? null, t.created_at, t.updated_at,
        );
      }
    }
  });

  // ── Push pending locaux (offline-first) ───────────────────────────────────
  await safeSync('push-projets-pending', async () => {
    const pending = await db.getAllAsync<{ id: number }>(
      "SELECT id FROM projets WHERE sync_status = 'pending' AND team_id = ?",
      teamLocalId,
    );
    for (const p of pending) {
      await pushProjet(db, p.id, teamServerId);
    }
  });

  await safeSync('push-notes-pending', async () => {
    const pending = await db.getAllAsync<{ id: number }>(
      "SELECT id FROM notes WHERE sync_status = 'pending' AND team_id = ?",
      teamLocalId,
    );
    for (const n of pending) {
      await pushNote(db, n.id, teamServerId);
    }
  });

  await safeSync('push-taches-pending', async () => {
    const pending = await db.getAllAsync<{ id: number }>(
      "SELECT id FROM taches WHERE sync_status = 'pending' AND team_id = ?",
      teamLocalId,
    );
    for (const t of pending) {
      await pushTache(db, t.id, teamServerId);
    }
  });
}

// ── Push sync ─────────────────────────────────────────────────────────────────
// Appelé après chaque création/modification locale pour tenter une sync immédiate

export async function pushProjet(
  db: SQLiteDatabase,
  projetLocalId: number,
  teamServerId: number,
): Promise<void> {
  const projet = await db.getFirstAsync<any>(
    'SELECT * FROM projets WHERE id = ?',
    projetLocalId,
  );
  if (!projet) return;

  const payload = {
    titre: projet.titre,
    description: projet.description ?? null,
    couleur: projet.couleur,
    statut: projet.statut,
    team_id: teamServerId,
  };

  try {
    if (projet.server_id) {
      await api.put(`/projets/${projet.server_id}`, payload);
    } else {
      const res = await api.post<any>('/projets', { ...payload, sync_id: projet.sync_id });
      const created = res.list;
      if (created?.id) {
        await db.runAsync('UPDATE projets SET server_id = ? WHERE id = ?', created.id, projetLocalId);
      }
    }
    await db.runAsync(`UPDATE projets SET sync_status = 'synced' WHERE id = ?`, projetLocalId);
  } catch (e) {
    console.warn('[Push] Projet', projetLocalId, 'échoué:', e);
  }
}

export async function pushNote(
  db: SQLiteDatabase,
  noteLocalId: number,
  teamServerId: number,
): Promise<void> {
  const note = await db.getFirstAsync<any>(
    `SELECT n.*, p.server_id as projet_server_id, u.server_id as auteur_server_id
     FROM notes n
     JOIN projets p ON n.projet_id = p.id
     JOIN users u ON n.auteur_id = u.id
     WHERE n.id = ?`,
    noteLocalId,
  );
  if (!note) return;

  // Si le projet ou l'auteur n'a pas encore de server_id, on ne peut pas pousser
  if (!note.projet_server_id || !note.auteur_server_id) {
    console.warn('[Push] Note', noteLocalId, '- projet ou auteur sans server_id, push ignoré');
    return;
  }

  const payload = {
    titre: note.titre,
    contenu: note.contenu,
    statut: accentStatutNote(note.statut), // mapping sans-accent → accentué
    projet_id: note.projet_server_id,
    auteur_id: note.auteur_server_id,
    team_id: teamServerId,
  };

  try {
    if (note.server_id) {
      await api.put(`/notes/${note.server_id}`, payload);
    } else {
      const res = await api.post<any>('/notes', { ...payload, sync_id: note.sync_id });
      const created = res.list;
      if (created?.id) {
        await db.runAsync('UPDATE notes SET server_id = ? WHERE id = ?', created.id, noteLocalId);
      }
    }
    await db.runAsync(`UPDATE notes SET sync_status = 'synced' WHERE id = ?`, noteLocalId);
  } catch (e) {
    console.warn('[Push] Note', noteLocalId, 'échoué:', e);
    // Offline ou erreur → reste en pending, badge visible
  }
}

export async function pushTache(
  db: SQLiteDatabase,
  tacheLocalId: number,
  teamServerId: number,
): Promise<void> {
  const tache = await db.getFirstAsync<any>(
    `SELECT t.*, p.server_id as projet_server_id,
            u.server_id as auteur_server_id,
            a.server_id as assigne_server_id
     FROM taches t
     JOIN projets p ON t.projet_id = p.id
     JOIN users u ON t.auteur_id = u.id
     LEFT JOIN users a ON t.assigne_id = a.id
     WHERE t.id = ?`,
    tacheLocalId,
  );
  if (!tache) return;

  if (!tache.projet_server_id || !tache.auteur_server_id) {
    console.warn('[Push] Tache', tacheLocalId, '- projet ou auteur sans server_id, push ignoré');
    return;
  }

  const payload = {
    titre: tache.titre,
    description: tache.description ?? null,
    statut: tache.statut,
    projet_id: tache.projet_server_id,
    auteur_id: tache.auteur_server_id,
    assigne_id: tache.assigne_server_id ?? null,
    team_id: teamServerId,
    due_date: tache.due_date ?? null,
  };

  try {
    if (tache.server_id) {
      await api.put(`/taches/${tache.server_id}`, payload);
    } else {
      const res = await api.post<any>('/taches', { ...payload, sync_id: tache.sync_id });
      const created = res.list;
      if (created?.id) {
        await db.runAsync('UPDATE taches SET server_id = ? WHERE id = ?', created.id, tacheLocalId);
      }
    }
    await db.runAsync(`UPDATE taches SET sync_status = 'synced' WHERE id = ?`, tacheLocalId);
  } catch (e) {
    console.warn('[Push] Tache', tacheLocalId, 'échoué:', e);
    // Offline → reste en pending
  }
}

export async function pushCommentaire(
  db: SQLiteDatabase,
  commentaireLocalId: number,
): Promise<void> {
  const commentaire = await db.getFirstAsync<any>(
    `SELECT c.*,
            u.server_id as auteur_server_id,
            n.server_id as note_server_id,
            t.server_id as tache_server_id
     FROM commentaires c
     LEFT JOIN users u ON c.auteur_id = u.id
     LEFT JOIN notes n ON c.note_id = n.id
     LEFT JOIN taches t ON c.tache_id = t.id
     WHERE c.id = ?`,
    commentaireLocalId,
  );
  if (!commentaire) return;

  // Déterminer la route selon note ou tâche
  let route: string | null = null;
  if (commentaire.note_id !== null && commentaire.note_server_id) {
    route = `/notes/${commentaire.note_server_id}/commentaires`;
  } else if (commentaire.tache_id !== null && commentaire.tache_server_id) {
    route = `/taches/${commentaire.tache_server_id}/commentaires`;
  }

  if (!route || !commentaire.auteur_server_id) {
    console.warn('[Push] Commentaire', commentaireLocalId, '- route ou auteur manquant, push ignoré');
    return;
  }

  try {
    const res = await api.post<any>(route, {
      contenu: commentaire.contenu,
      auteur_id: commentaire.auteur_server_id,
      sync_id: commentaire.sync_id,
    });
    const created = res.list;
    if (created?.id) {
      await db.runAsync(
        `UPDATE commentaires SET server_id = ?, sync_status = 'synced' WHERE id = ?`,
        created.id, commentaireLocalId,
      );
    }
  } catch (e) {
    console.warn('[Push] Commentaire', commentaireLocalId, 'échoué:', e);
  }
}
