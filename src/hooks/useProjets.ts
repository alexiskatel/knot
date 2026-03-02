import { useState, useEffect, useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getAllProjets, createProjet, type Projet } from '@/src/db/projets';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSync } from '@/src/contexts/SyncContext';

export function useProjets() {
  const db = useSQLiteContext();
  const { team, user } = useAuth();
  const { syncVersion } = useSync();
  const [projets, setProjets] = useState<Projet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!team || !user) return;
    const localTeam = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM teams WHERE server_id = ?',
      team.id,
    );
    if (!localTeam) return;

    setIsLoading(true);
    try {
      const rows = await getAllProjets(db, localTeam.id);

      if (user.is_admin) {
        setProjets(rows);
      } else {
        // Filtrer par projet_membres (droits d'accès)
        const localUser = await db.getFirstAsync<{ id: number }>(
          'SELECT id FROM users WHERE server_id = ?', user.id,
        );
        if (!localUser) { setProjets([]); return; }
        const accessible = await db.getAllAsync<{ projet_id: number }>(
          'SELECT projet_id FROM projet_membres WHERE user_id = ?', localUser.id,
        );
        const ids = new Set(accessible.map((r) => r.projet_id));
        setProjets(rows.filter((p) => ids.has(p.id)));
      }
    } finally {
      setIsLoading(false);
    }
  }, [db, team, user]);

  useEffect(() => { load(); }, [load, syncVersion]);

  const add = useCallback(
    async (data: { titre: string; description?: string; couleur?: string }) => {
      if (!team) return null;
      const localTeam = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM teams WHERE server_id = ?',
        team.id,
      );
      if (!localTeam) return null;

      const projet = await createProjet(db, { ...data, team_id: localTeam.id });
      setProjets((prev) => [...prev, projet]);
      return projet;
    },
    [db, team],
  );

  return { projets, isLoading, refresh: load, add };
}
