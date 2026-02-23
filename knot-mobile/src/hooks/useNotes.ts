import { useState, useEffect, useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getNotesByTeam, deleteNote, type Note } from '@/src/db/notes';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSync } from '@/src/contexts/SyncContext';

export function useNotes(projetId?: number) {
  const db = useSQLiteContext();
  const { team } = useAuth();
  const { syncVersion } = useSync();
  const [notes, setNotes] = useState<Note[]>([]);
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
      const rows = await getNotesByTeam(db, localTeam.id, projetId);
      setNotes(rows);
    } finally {
      setIsLoading(false);
    }
  }, [db, team, projetId]);

  useEffect(() => { load(); }, [load, syncVersion]);

  const remove = useCallback(async (id: number) => {
    await deleteNote(db, id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, [db]);

  return { notes, isLoading, refresh: load, remove };
}
