import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { useSQLiteContext } from 'expo-sqlite';
import { usePathname } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';

import { syncAll, checkDueNotifications } from '../services/sync';
import { useAuth } from './AuthContext';

interface SyncContextValue {
  isSyncing: boolean;
  lastSyncAt: Date | null;
  syncVersion: number;   // s'incrémente après chaque sync réussie ou bump local
  sync: () => Promise<void>;
  bumpSyncVersion: () => void; // force les hooks à relire SQLite sans sync réseau
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const { user, team, refreshFromDb } = useAuth();
  const pathname = usePathname();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncVersion, setSyncVersion] = useState(0);
  const isSyncingRef = useRef(false);
  const lastSyncAtRef = useRef<number>(0);
  const wasConnectedRef = useRef<boolean | null>(null);
  // Always points to the latest sync() — prevents stale closures in effects
  const syncRef = useRef<() => Promise<void>>(async () => {});

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
      await syncAll(db, teamRow.id, team.id, user.id);
      await refreshFromDb();
      // Vérification des notifications d'échéance après chaque sync
      checkDueNotifications(db, user.id, user.is_admin === true).catch(() => {});
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

  // Keep syncRef up-to-date every render so effects never call a stale sync
  syncRef.current = sync;

  // Sync au login / changement de compte
  useEffect(() => {
    if (user && team) syncRef.current();
  }, [user?.id]);

  // Sync à chaque changement de page
  useEffect(() => {
    syncRef.current();
  }, [pathname]);

  // Sync quand l'app revient au premier plan
  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') syncRef.current();
    });
    return () => sub.remove();
  }, [user?.id]);

  // Sync automatique quand la connectivité est restaurée
  useEffect(() => {
    if (!user) return;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isNowConnected = state.isConnected === true && state.isInternetReachable !== false;
      if (isNowConnected && wasConnectedRef.current === false) {
        syncRef.current();
      }
      wasConnectedRef.current = isNowConnected;
    });
    return () => unsubscribe();
  }, [user?.id]);

  const bumpSyncVersion = () => setSyncVersion((v) => v + 1);

  return (
    <SyncContext.Provider value={{ isSyncing, lastSyncAt, syncVersion, sync, bumpSyncVersion }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be inside SyncProvider');
  return ctx;
}
