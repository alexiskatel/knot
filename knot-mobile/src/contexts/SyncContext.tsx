import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { useSQLiteContext } from 'expo-sqlite';
import { usePathname } from 'expo-router';

import { syncAll } from '../services/sync';
import { useAuth } from './AuthContext';

interface SyncContextValue {
  isSyncing: boolean;
  lastSyncAt: Date | null;
  syncVersion: number;   // s'incrémente après chaque sync réussie
  sync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const { user, team } = useAuth();
  const pathname = usePathname();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncVersion, setSyncVersion] = useState(0);
  const isSyncingRef = useRef(false);
  const lastSyncAtRef = useRef<number>(0);

  async function sync() {
    if (isSyncingRef.current || !user || !team) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      const teamRow = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM teams WHERE server_id = ?',
        team.id,
      );
      if (!teamRow) return;
      await syncAll(db, teamRow.id, team.id);
      const now = new Date();
      setLastSyncAt(now);
      lastSyncAtRef.current = Date.now();
      Storage.setItemSync('last_sync', now.toISOString());
      setSyncVersion((v) => v + 1); // signal aux hooks de se recharger
    } catch (e) {
      console.warn('[Sync] Erreur:', e);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }

  // Sync au login
  useEffect(() => {
    if (user && team) sync();
  }, [user?.id]);

  // Sync à chaque changement de page (throttle 5s)
  useEffect(() => {
    if (!user || !team) return;
    const elapsed = Date.now() - lastSyncAtRef.current;
    if (elapsed > 5_000) sync();
  }, [pathname]);

  // Sync quand l'app revient au premier plan
  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') sync();
    });
    return () => sub.remove();
  }, [user?.id]);

  return (
    <SyncContext.Provider value={{ isSyncing, lastSyncAt, syncVersion, sync }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be inside SyncProvider');
  return ctx;
}
