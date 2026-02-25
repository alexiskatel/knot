import { type SQLiteDatabase } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { api } from '../api/client';
import { createNotification } from '../db/notifications';
import { sendLocalNotification } from './pushNotifications';
import { upsertCommentaireFromServer } from '../db/commentaires';

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
  deleted_at: string | null;
  deleted_by: number | null;
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
  deleted_at: string | null;
  deleted_by: number | null;
}

interface ServerCommentaire {
  id: number;
  contenu: string;
  type: string;
  note_id: number | null;
  tache_id: number | null;
  auteur_id: number;
  team_id: number;
  sync_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ServerLiaison {
  id: number;
  source_type: 'note' | 'tache';
  source_id: number;
  target_type: 'note' | 'tache';
  target_id: number;
  team_id: number;
  sync_id: string;
  created_at: string;
}

interface ServerProjetWithDelete {
  id: number;
  titre: string;
  description: string | null;
  couleur: string;
  statut: boolean | number;
  team_id: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: number | null;
}

// ── Sync principal ────────────────────────────────────────────────────────────

export async function syncAll(
  db: SQLiteDatabase,
  teamLocalId: number,
  teamServerId: number,
  currentUserServerId?: number,
): Promise<void> {

  // Resolve current user's local ID for assignment detection
  let currentUserLocalId: number | null = null;
  if (currentUserServerId) {
    const userRow = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM users WHERE server_id = ?', currentUserServerId,
    );
    currentUserLocalId = userRow?.id ?? null;
  }

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
    const projets = extractList<ServerProjetWithDelete>(res);
    for (const p of projets) {
      const existing = await db.getFirstAsync<{ id: number; sync_status: string; updated_at: string }>(
        'SELECT id, sync_status, updated_at FROM projets WHERE server_id = ?', p.id,
      );
      const deletedByRow = p.deleted_by
        ? await db.getFirstAsync<{ id: number }>('SELECT id FROM users WHERE server_id = ?', p.deleted_by)
        : null;
      if (existing) {
        // Conflict resolution : local pending + plus récent → skip (sera pushé)
        if (existing.sync_status === 'pending' && existing.updated_at > p.updated_at) continue;
        await db.runAsync(
          `UPDATE projets
           SET titre = ?, description = ?, couleur = ?, statut = ?, updated_at = ?, deleted_at = ?, deleted_by = ?, sync_status = 'synced'
           WHERE server_id = ?`,
          p.titre, p.description ?? null, p.couleur ?? '#2F3C73',
          p.statut ? 1 : 0, p.updated_at, p.deleted_at ?? null, deletedByRow?.id ?? null, p.id,
        );
      } else {
        await db.runAsync(
          `INSERT INTO projets
             (server_id, sync_id, titre, description, couleur, statut, team_id, created_at, updated_at, deleted_at, deleted_by, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
          p.id, randomUUID(), p.titre, p.description ?? null,
          p.couleur ?? '#2F3C73', p.statut ? 1 : 0,
          teamLocalId, p.created_at, p.updated_at, p.deleted_at ?? null, deletedByRow?.id ?? null,
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

      const existing = await db.getFirstAsync<{ id: number; sync_status: string; updated_at: string }>(
        'SELECT id, sync_status, updated_at FROM notes WHERE server_id = ?', n.id,
      );
      const statut = normalizeStatutNote(n.statut ?? 'publie');
      const noteDeletedByRow = n.deleted_by
        ? await db.getFirstAsync<{ id: number }>('SELECT id FROM users WHERE server_id = ?', n.deleted_by)
        : null;
      if (existing) {
        // Conflict resolution : local pending + plus récent → skip (sera pushé)
        if (existing.sync_status === 'pending' && existing.updated_at > n.updated_at) continue;
        await db.runAsync(
          `UPDATE notes
           SET titre = ?, contenu = ?, statut = ?, projet_id = ?, updated_at = ?, deleted_at = ?, deleted_by = ?, sync_status = 'synced'
           WHERE server_id = ?`,
          n.titre, n.contenu ?? '', statut,
          projetRow.id, n.updated_at, n.deleted_at ?? null, noteDeletedByRow?.id ?? null, n.id,
        );
      } else {
        await db.runAsync(
          `INSERT INTO notes
             (server_id, sync_id, titre, contenu, statut, projet_id, auteur_id, team_id, created_at, updated_at, deleted_at, deleted_by, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
          n.id, randomUUID(), n.titre, n.contenu ?? '',
          statut, projetRow.id,
          auteurRow?.id ?? 1, teamLocalId,
          n.created_at, n.updated_at, n.deleted_at ?? null, noteDeletedByRow?.id ?? null,
        );
      }
    }
  });

  // ── Tâches (pull) ─────────────────────────────────────────────────────────
  await safeSync('taches', async () => {
    const res = await api.get<any>(`/teams/${teamServerId}/taches?all=1`);
    
    const taches = extractList<ServerTache>(res);
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

      const existing = await db.getFirstAsync<{ id: number; sync_status: string; updated_at: string }>(
        'SELECT id, sync_status, updated_at FROM taches WHERE server_id = ?', t.id,
      );
      const tacheDeletedByRow = t.deleted_by
        ? await db.getFirstAsync<{ id: number }>('SELECT id FROM users WHERE server_id = ?', t.deleted_by)
        : null;
      if (existing) {
        // Conflict resolution : local pending + plus récent → skip (sera pushé)
        if (existing.sync_status === 'pending' && existing.updated_at > t.updated_at) continue;
        await db.runAsync(
          `UPDATE taches
           SET titre = ?, description = ?, statut = ?, projet_id = ?,
               assigne_id = ?, due_date = ?, updated_at = ?, deleted_at = ?, deleted_by = ?, sync_status = 'synced'
           WHERE server_id = ?`,
          t.titre, t.description ?? null, t.statut ?? 'todo',
          projetRow.id, assigneRow?.id ?? null, t.due_date ?? null,
          t.updated_at, t.deleted_at ?? null, tacheDeletedByRow?.id ?? null, t.id,
        );
      } else {
        await db.runAsync(
          `INSERT INTO taches
             (server_id, sync_id, titre, description, statut, projet_id, auteur_id,
              assigne_id, team_id, due_date, created_at, updated_at, deleted_at, deleted_by, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
          t.id, randomUUID(), t.titre, t.description ?? null,
          t.statut ?? 'todo', projetRow.id, auteurRow?.id ?? 1,
          assigneRow?.id ?? null, teamLocalId,
          t.due_date ?? null, t.created_at, t.updated_at, t.deleted_at ?? null, tacheDeletedByRow?.id ?? null,
        );

        // Notification d'assignation : nouvelle tâche assignée à l'utilisateur courant
        if (
          currentUserLocalId !== null &&
          assigneRow?.id === currentUserLocalId &&
          t.statut !== 'done' &&
          !t.deleted_at
        ) {
          const newTacheRow = await db.getFirstAsync<{ id: number }>(
            'SELECT id FROM taches WHERE server_id = ?', t.id,
          );
          if (newTacheRow) {
            await safeSync('notif-assignment', async () => {
              await createNotification(db, {
                ref_id: `assignment_tache_${t.id}`,
                type: 'assignment',
                titre: 'Nouvelle tâche assignée',
                corps: `"${t.titre}" vous a été assignée`,
                entity_type: 'tache',
                entity_id: newTacheRow.id,
              });
              await sendLocalNotification(
                'Nouvelle tâche assignée',
                `"${t.titre}" vous a été assignée`,
                { entity_type: 'tache', entity_id: newTacheRow.id },
              );
            });
          }
        }
      }
    }
  });

  // ── Commentaires (pull) ───────────────────────────────────────────────────
  await safeSync('commentaires', async () => {
    const res = await api.get<any>(`/commentaires?team_id=${teamServerId}&all=1`);
    const serverCommentaires = extractList<ServerCommentaire>(res);

    for (const c of serverCommentaires) {
      const auteurRow = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM users WHERE server_id = ?', c.auteur_id,
      );
      if (!auteurRow) continue;

      let noteLocalId: number | undefined;
      let tacheLocalId: number | undefined;

      if (c.note_id) {
        const noteRow = await db.getFirstAsync<{ id: number }>(
          'SELECT id FROM notes WHERE server_id = ?', c.note_id,
        );
        noteLocalId = noteRow?.id;
      }
      if (c.tache_id) {
        const tacheRow = await db.getFirstAsync<{ id: number }>(
          'SELECT id FROM taches WHERE server_id = ?', c.tache_id,
        );
        tacheLocalId = tacheRow?.id;
      }

      if (!noteLocalId && !tacheLocalId) continue;

      await upsertCommentaireFromServer(
        db,
        {
          id: c.id,
          contenu: c.contenu,
          created_at: c.created_at,
          updated_at: c.updated_at,
          sync_id: c.sync_id ?? undefined,
        },
        auteurRow.id,
        teamLocalId,
        noteLocalId,
        tacheLocalId,
      );
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

  // ── Push pending commentaires ─────────────────────────────────────────────
  await safeSync('push-commentaires-pending', async () => {
    const pending = await db.getAllAsync<{ id: number }>(
      "SELECT id FROM commentaires WHERE sync_status = 'pending' AND team_id = ?",
      teamLocalId,
    );
    for (const c of pending) {
      await pushCommentaire(db, c.id);
    }
  });

  // ── Liaisons (pull) ───────────────────────────────────────────────────────
  await safeSync('liaisons', async () => {
    const res = await api.get<any>(`/teams/${teamServerId}/liaisons?all=1`);
    const serverLiaisons = extractList<ServerLiaison>(res);

    for (const l of serverLiaisons) {
      const sourceRow = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM ${l.source_type === 'note' ? 'notes' : 'taches'} WHERE server_id = ?`,
        l.source_id,
      );
      const targetRow = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM ${l.target_type === 'note' ? 'notes' : 'taches'} WHERE server_id = ?`,
        l.target_id,
      );
      if (!sourceRow || !targetRow) continue;

      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM liaisons WHERE server_id = ?', l.id,
      );
      if (!existing) {
        await db.runAsync(
          `INSERT OR IGNORE INTO liaisons
             (server_id, sync_id, source_type, source_id, target_type, target_id, team_id, created_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
          l.id, l.sync_id,
          l.source_type, sourceRow.id,
          l.target_type, targetRow.id,
          teamLocalId, l.created_at,
        );
      }
    }

    // Delete local liaisons whose server_id is no longer in the server list
    if (serverLiaisons.length > 0) {
      const serverIds = serverLiaisons.map((l) => l.id);
      await db.runAsync(
        `DELETE FROM liaisons WHERE server_id IS NOT NULL AND server_id NOT IN (${serverIds.map(() => '?').join(',')})`,
        ...serverIds,
      );
    }
  });

  // ── Push pending liaisons ─────────────────────────────────────────────────
  await safeSync('push-liaisons-pending', async () => {
    const pending = await db.getAllAsync<{ id: number }>(
      "SELECT id FROM liaisons WHERE sync_status = 'pending' AND team_id = ?",
      teamLocalId,
    );
    for (const l of pending) {
      await pushLiaison(db, l.id, teamServerId);
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

export async function pushLiaison(
  db: SQLiteDatabase,
  liaisonLocalId: number,
  teamServerId: number,
): Promise<void> {
  const liaison = await db.getFirstAsync<any>('SELECT * FROM liaisons WHERE id = ?', liaisonLocalId);
  if (!liaison) return;

  // Resolve server IDs depending on type
  const sourceServerRow = await db.getFirstAsync<{ server_id: number | null }>(
    `SELECT server_id FROM ${liaison.source_type === 'note' ? 'notes' : 'taches'} WHERE id = ?`,
    liaison.source_id,
  );
  const targetServerRow = await db.getFirstAsync<{ server_id: number | null }>(
    `SELECT server_id FROM ${liaison.target_type === 'note' ? 'notes' : 'taches'} WHERE id = ?`,
    liaison.target_id,
  );

  if (!sourceServerRow?.server_id || !targetServerRow?.server_id) {
    console.warn('[Push] Liaison', liaisonLocalId, '- source ou target sans server_id, push ignoré');
    return;
  }

  if (liaison.server_id) {
    // Already pushed, mark synced
    await db.runAsync(`UPDATE liaisons SET sync_status = 'synced' WHERE id = ?`, liaisonLocalId);
    return;
  }

  try {
    const res = await api.post<any>('/liaisons', {
      source_type: liaison.source_type,
      source_id:   sourceServerRow.server_id,
      target_type: liaison.target_type,
      target_id:   targetServerRow.server_id,
      sync_id:     liaison.sync_id,
    });
    const created = res.list?.list ?? res.list;
    if (created?.id) {
      await db.runAsync(
        `UPDATE liaisons SET server_id = ?, sync_status = 'synced' WHERE id = ?`,
        created.id, liaisonLocalId,
      );
    }
  } catch (e) {
    console.warn('[Push] Liaison', liaisonLocalId, 'échoué:', e);
  }
}

export async function pushCommentaire(
  db: SQLiteDatabase,
  commentaireLocalId: number,
): Promise<void> {
  const commentaire = await db.getFirstAsync<any>(
    `SELECT c.*,
            u.server_id  as auteur_server_id,
            n.server_id  as note_server_id,
            t.server_id  as tache_server_id,
            tm.server_id as team_server_id
     FROM commentaires c
     LEFT JOIN users u  ON c.auteur_id = u.id
     LEFT JOIN notes n  ON c.note_id   = n.id
     LEFT JOIN taches t ON c.tache_id  = t.id
     LEFT JOIN teams tm ON c.team_id   = tm.id
     WHERE c.id = ?`,
    commentaireLocalId,
  );
  if (!commentaire) return;

  if (!commentaire.auteur_server_id || !commentaire.team_server_id) {
    console.warn('[Push] Commentaire', commentaireLocalId, '- auteur ou team sans server_id, ignoré');
    return;
  }
  if (commentaire.note_id !== null && !commentaire.note_server_id) {
    console.warn('[Push] Commentaire', commentaireLocalId, '- note sans server_id, ignoré');
    return;
  }
  if (commentaire.tache_id !== null && !commentaire.tache_server_id) {
    console.warn('[Push] Commentaire', commentaireLocalId, '- tache sans server_id, ignoré');
    return;
  }
  if (!commentaire.note_server_id && !commentaire.tache_server_id) {
    console.warn('[Push] Commentaire', commentaireLocalId, '- ni note ni tache, ignoré');
    return;
  }

  try {
    const res = await api.post<any>('/commentaires', {
      contenu:   commentaire.contenu,
      type:      'texte',
      note_id:   commentaire.note_server_id  ?? undefined,
      tache_id:  commentaire.tache_server_id ?? undefined,
      auteur_id: commentaire.auteur_server_id,
      team_id:   commentaire.team_server_id,
      sync_id:   commentaire.sync_id,
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

// ── Vérification des échéances ────────────────────────────────────────────────
// Crée des notifications locales pour les tâches dues bientôt ou en retard
// assignées à l'utilisateur courant. Dédupliquées par ref_id journalier.

export async function checkDueNotifications(
  db: SQLiteDatabase,
  currentUserServerId: number,
  isAdmin = false,
): Promise<void> {
  const userRow = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM users WHERE server_id = ?', currentUserServerId,
  );
  if (!userRow) return;
  const currentUserLocalId = userRow.id;
  const today = new Date().toDateString();
  const in48h = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  // ── Tâches dues dans les 48h assignées à l'utilisateur courant ────────────
  const dueSoon = await db.getAllAsync<{ id: number; titre: string; due_date: string }>(
    `SELECT id, titre, due_date FROM taches
     WHERE assigne_id = ? AND statut != 'done' AND deleted_at IS NULL
       AND due_date IS NOT NULL AND due_date > datetime('now') AND due_date <= ?`,
    currentUserLocalId, in48h,
  );
  for (const t of dueSoon) {
    const daysLeft = Math.max(
      Math.ceil((new Date(t.due_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
      0,
    );
    await safeSync('notif-due_soon', async () => {
      await createNotification(db, {
        ref_id: `due_soon_${t.id}_${today}`,
        type: 'due_soon',
        titre: 'Échéance proche',
        corps: `"${t.titre}" est due dans ${daysLeft} jour(s)`,
        entity_type: 'tache',
        entity_id: t.id,
      });
      await sendLocalNotification(
        'Échéance proche',
        `"${t.titre}" est due dans ${daysLeft} jour(s)`,
        { entity_type: 'tache', entity_id: t.id },
      );
    });
  }

  // ── Tâches en retard assignées à l'utilisateur courant ───────────────────
  const overdue = await db.getAllAsync<{ id: number; titre: string }>(
    `SELECT id, titre FROM taches
     WHERE assigne_id = ? AND statut != 'done' AND deleted_at IS NULL
       AND due_date IS NOT NULL AND due_date < datetime('now')`,
    currentUserLocalId,
  );
  for (const t of overdue) {
    await safeSync('notif-overdue', async () => {
      await createNotification(db, {
        ref_id: `overdue_${t.id}_${today}`,
        type: 'overdue',
        titre: 'Tâche en retard',
        corps: `"${t.titre}" est en retard`,
        entity_type: 'tache',
        entity_id: t.id,
      });
      await sendLocalNotification(
        'Tâche en retard',
        `"${t.titre}" est en retard`,
        { entity_type: 'tache', entity_id: t.id },
      );
    });
  }

  // ── Notifications admin : toutes les tâches critiques de l'équipe ─────────
  if (!isAdmin) return;

  // Dues dans les 48h (autres membres)
  const adminDueSoon = await db.getAllAsync<{
    id: number; titre: string; due_date: string;
    assigne_nom: string | null; assigne_prenom: string | null;
  }>(
    `SELECT t.id, t.titre, t.due_date, u.nom as assigne_nom, u.prenom as assigne_prenom
     FROM taches t
     LEFT JOIN users u ON t.assigne_id = u.id
     WHERE (t.assigne_id IS NULL OR t.assigne_id != ?) AND t.statut != 'done' AND t.deleted_at IS NULL
       AND t.due_date IS NOT NULL AND t.due_date > datetime('now') AND t.due_date <= ?`,
    currentUserLocalId, in48h,
  );
  for (const t of adminDueSoon) {
    const daysLeft = Math.max(
      Math.ceil((new Date(t.due_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
      0,
    );
    const assigneName = t.assigne_prenom
      ? `${t.assigne_prenom} ${t.assigne_nom ?? ''}`.trim()
      : (t.assigne_nom ?? 'Non assigné');
    await safeSync('notif-admin-due_soon', async () => {
      await createNotification(db, {
        ref_id: `admin_due_soon_${t.id}_${today}`,
        type: 'due_soon',
        titre: 'Échéance proche (équipe)',
        corps: `"${t.titre}" (${assigneName}) — J-${daysLeft}`,
        entity_type: 'tache',
        entity_id: t.id,
      });
    });
  }

  // En retard (autres membres)
  const adminOverdue = await db.getAllAsync<{
    id: number; titre: string;
    assigne_nom: string | null; assigne_prenom: string | null;
  }>(
    `SELECT t.id, t.titre, u.nom as assigne_nom, u.prenom as assigne_prenom
     FROM taches t
     LEFT JOIN users u ON t.assigne_id = u.id
     WHERE (t.assigne_id IS NULL OR t.assigne_id != ?) AND t.statut != 'done' AND t.deleted_at IS NULL
       AND t.due_date IS NOT NULL AND t.due_date < datetime('now')`,
    currentUserLocalId,
  );
  for (const t of adminOverdue) {
    const assigneName = t.assigne_prenom
      ? `${t.assigne_prenom} ${t.assigne_nom ?? ''}`.trim()
      : (t.assigne_nom ?? 'Non assigné');
    await safeSync('notif-admin-overdue', async () => {
      await createNotification(db, {
        ref_id: `admin_overdue_${t.id}_${today}`,
        type: 'overdue',
        titre: 'Tâche en retard (équipe)',
        corps: `"${t.titre}" (${assigneName}) est en retard`,
        entity_type: 'tache',
        entity_id: t.id,
      });
      await sendLocalNotification(
        'Tâche en retard (équipe)',
        `"${t.titre}" (${assigneName}) est en retard`,
        { entity_type: 'tache', entity_id: t.id },
      );
    });
  }
}
