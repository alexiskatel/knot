import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import Storage from 'expo-sqlite/kv-store';
import { useRouter, useSegments } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

export interface AuthUser {
  id: number;
  nom: string;
  prenom: string;
  email: string;
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
          setUser(JSON.parse(storedUser));
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
    Storage.setItemSync('team', JSON.stringify(authTeam));

    // Persist team and user to local SQLite
    await db.runAsync(
      `INSERT OR REPLACE INTO teams (server_id, nom, code_unique, couleur_primaire)
       VALUES (?, ?, ?, ?)`,
      authTeam.id,
      authTeam.nom,
      '',
      authTeam.couleur_primaire,
    );

    const teamRow = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM teams WHERE server_id = ?',
      authTeam.id,
    );

    if (teamRow) {
      await db.runAsync(
        `INSERT OR REPLACE INTO users (server_id, nom, prenom, email, team_id, api_key)
         VALUES (?, ?, ?, ?, ?, ?)`,
        authUser.id,
        authUser.nom,
        authUser.prenom ?? '',
        authUser.email ?? '',
        teamRow.id,
        apiKey,
      );
    }

    setUser(authUser);
    setTeam(authTeam);
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
    <AuthContext.Provider value={{ user, team, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
