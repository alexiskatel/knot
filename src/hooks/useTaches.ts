import { useAuth } from '@/src/contexts/AuthContext';
import { useSync } from '@/src/contexts/SyncContext';
import { deleteTache, getTachesByTeam, type Tache } from '@/src/db/taches';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

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

      rows.map(row => ({
        ...row,
        projet: typeof row.projet === 'string' ? JSON.parse(row.projet) : row.projet
      }));

      // console.log('Ici (formaté):', tachesAvecProjets);
      
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
