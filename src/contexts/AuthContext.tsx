import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import Storage from 'expo-sqlite/kv-store';
import { useRouter, useSegments } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

export interface AuthUser {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  is_admin: boolean;
}

export interface AuthTeam {
  id: number;
  nom: string;
  couleur_primaire: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  team: AuthTeam | null;
  isLoading: boolean;
  signIn: (apiKey: string, user: AuthUser, team: AuthTeam) => Promise<void>;
  signOut: () => Promise<void>;
  refreshFromDb: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const router = useRouter();
  const segments = useSegments();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [team, setTeam] = useState<AuthTeam | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on launch
  useEffect(() => {
    async function restore() {
      try {
        const apiKey = Storage.getItemSync('api_key');
        const storedUser = Storage.getItemSync('user');
        const storedTeam = Storage.getItemSync('team');

        if (apiKey && storedUser && storedTeam) {
          const parsedUser = JSON.parse(storedUser);
          console.log('[Auth] User connecté:', parsedUser);
          setUser(parsedUser);
          setTeam(JSON.parse(storedTeam));
        }
      } catch {
        // Corrupted storage — ignore and require new login
      } finally {
        setIsLoading(false);
      }
    }
    restore();
  }, []);

  // Route guard
  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) {
      router.replace('/(auth)');
    } else if (user && inAuth) {
      router.replace('/(app)');
    }
  }, [user, isLoading, segments]);

  async function signIn(apiKey: string, authUser: AuthUser, authTeam: AuthTeam) {
    // Persist to kv-store
    Storage.setItemSync('api_key', apiKey);
    Storage.setItemSync('team_id', String(authTeam.id));
    Storage.setItemSync('user', JSON.stringify(authUser));
    // console.log("User: ", authUser);
    
    Storage.setItemSync('team', JSON.stringify(authTeam));

    // Persist team to local SQLite — INSERT OR IGNORE preserves the existing row id
    // (INSERT OR REPLACE would delete+reinsert, changing the auto-increment id and
    //  orphaning all projets/notes/taches that reference the old team_id)
    await db.runAsync(
      `INSERT OR IGNORE INTO teams (server_id, nom, code_unique, couleur_primaire)
       VALUES (?, ?, ?, ?)`,
      authTeam.id,
      authTeam.nom,
      '',
      authTeam.couleur_primaire,
    );
    await db.runAsync(
      `UPDATE teams SET nom = ?, couleur_primaire = ? WHERE server_id = ?`,
      authTeam.nom,
      authTeam.couleur_primaire,
      authTeam.id,
    );

    const teamRow = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM teams WHERE server_id = ?',
      authTeam.id,
    );

    if (teamRow) {
      await db.runAsync(
        `INSERT OR IGNORE INTO users (server_id, nom, prenom, email, team_id, api_key)
         VALUES (?, ?, ?, ?, ?, ?)`,
        authUser.id,
        authUser.nom,
        authUser.prenom ?? '',
        authUser.email ?? '',
        teamRow.id,
        apiKey,
      );
      await db.runAsync(
        `UPDATE users SET nom = ?, prenom = ?, email = ?, api_key = ? WHERE server_id = ?`,
        authUser.nom,
        authUser.prenom ?? '',
        authUser.email ?? '',
        apiKey,
        authUser.id,
      );
    }

    setUser(authUser);
    setTeam(authTeam);
  }

  async function refreshFromDb() {
    try {
      const storedUser = Storage.getItemSync('user');
      const storedTeam = Storage.getItemSync('team');
      if (!storedUser || !storedTeam) return;

      const currentUser: AuthUser = JSON.parse(storedUser);
      const currentTeam: AuthTeam = JSON.parse(storedTeam);

      const teamRow = await db.getFirstAsync<{ nom: string; couleur_primaire: string }>(
        'SELECT nom, couleur_primaire FROM teams WHERE server_id = ?',
        currentTeam.id,
      );
      if (teamRow) {
        const freshTeam: AuthTeam = { ...currentTeam, nom: teamRow.nom, couleur_primaire: teamRow.couleur_primaire };
        Storage.setItemSync('team', JSON.stringify(freshTeam));
        setTeam(freshTeam);
      }

      const userRow = await db.getFirstAsync<{ nom: string; prenom: string; email: string }>(
        'SELECT nom, prenom, email FROM users WHERE server_id = ?',
        currentUser.id,
      );
      if (userRow) {
        const freshUser: AuthUser = { ...currentUser, nom: userRow.nom, prenom: userRow.prenom, email: userRow.email };
        Storage.setItemSync('user', JSON.stringify(freshUser));
        setUser(freshUser);
      }
    } catch (e) {
      console.warn('[Auth] refreshFromDb échoué:', e);
    }
  }

  async function signOut() {
    Storage.removeItemSync('api_key');
    Storage.removeItemSync('team_id');
    Storage.removeItemSync('user');
    Storage.removeItemSync('team');
    setUser(null);
    setTeam(null);
  }

  return (
    <AuthContext.Provider value={{ user, team, isLoading, signIn, signOut, refreshFromDb }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
