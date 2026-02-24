import { useState, useEffect, useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getTachesByTeam, deleteTache, type Tache } from '@/src/db/taches';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSync } from '@/src/contexts/SyncContext';

export function useTaches(projetId?: number) {
  const db = useSQLiteContext();
  const { team } = useAuth();
  const { syncVersion } = useSync();
  const [taches, setTaches] = useState<Tache[]>([]);
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
      const rows = await getTachesByTeam(db, localTeam.id, projetId);
      setTaches(rows);
    } finally {
      setIsLoading(false);
    }
  }, [db, team, projetId]);

  useEffect(() => { load(); }, [load, syncVersion]);

  const remove = useCallback(async (id: number) => {
    await deleteTache(db, id);
    setTaches((prev) => prev.filter((t) => t.id !== id));
  }, [db]);

  return { taches, isLoading, refresh: load, remove };
}
