import { useState, useEffect, useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getAllProjets, createProjet, type Projet } from '@/src/db/projets';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSync } from '@/src/contexts/SyncContext';

export function useProjets() {
  const db = useSQLiteContext();
  const { team } = useAuth();
  const { syncVersion } = useSync();
  const [projets, setProjets] = useState<Projet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!team) return;
    const localTeam = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM teams WHERE server_id = ?',
      team.id,
    );
    if (!localTeam) return;

    setIsLoading(true);
    try {
      const rows = await getAllProjets(db, localTeam.id);
      setProjets(rows);
    } finally {
      setIsLoading(false);
    }
  }, [db, team]);

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
