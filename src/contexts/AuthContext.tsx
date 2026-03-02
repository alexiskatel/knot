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
  code: string;
  couleur_primaire: string;
}

export interface Account {
  api_key: string;
  team_id: string;
  user: AuthUser;
  team: AuthTeam;
}

interface AuthContextValue {
  user: AuthUser | null;
  team: AuthTeam | null;
  accounts: Account[];
  activeIdx: number;
  isLoading: boolean;
  signIn: (apiKey: string, user: AuthUser, team: AuthTeam) => Promise<void>;
  signOut: () => Promise<void>;
  addAccount: (apiKey: string, user: AuthUser, team: AuthTeam) => Promise<void>;
  switchAccount: (idx: number) => Promise<void>;
  removeAccount: (idx: number) => Promise<void>;
  refreshFromDb: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function persistActive(apiKey: string, teamId: string, user: AuthUser, team: AuthTeam) {
  Storage.setItemSync('api_key', apiKey);
  Storage.setItemSync('team_id', teamId);
  Storage.setItemSync('user', JSON.stringify(user));
  Storage.setItemSync('team', JSON.stringify(team));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const router = useRouter();
  const segments = useSegments();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [team, setTeam] = useState<AuthTeam | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on launch (with migration from old single-account format)
  useEffect(() => {
    async function restore() {
      try {
        const storedAccounts = Storage.getItemSync('accounts');
        const storedIdx = Storage.getItemSync('active_idx');

        if (storedAccounts) {
          // New multi-account format
          const parsed: Account[] = JSON.parse(storedAccounts);
          const idx = storedIdx ? parseInt(storedIdx, 10) : 0;
          const safeIdx = idx < parsed.length ? idx : 0;
          setAccounts(parsed);
          setActiveIdx(safeIdx);
          if (parsed[safeIdx]) {
            setUser(parsed[safeIdx].user);
            setTeam(parsed[safeIdx].team);
            persistActive(
              parsed[safeIdx].api_key,
              parsed[safeIdx].team_id,
              parsed[safeIdx].user,
              parsed[safeIdx].team,
            );
          }
        } else {
          // Migration from old single-account format
          const apiKey = Storage.getItemSync('api_key');
          const storedUser = Storage.getItemSync('user');
          const storedTeam = Storage.getItemSync('team');
          const teamId = Storage.getItemSync('team_id');

          if (apiKey && storedUser && storedTeam && teamId) {
            const parsedUser: AuthUser = JSON.parse(storedUser);
            const parsedTeam: AuthTeam = JSON.parse(storedTeam);
            const migrated: Account[] = [{ api_key: apiKey, team_id: teamId, user: parsedUser, team: parsedTeam }];
            Storage.setItemSync('accounts', JSON.stringify(migrated));
            Storage.setItemSync('active_idx', '0');
            setAccounts(migrated);
            setActiveIdx(0);
            setUser(parsedUser);
            setTeam(parsedTeam);
          }
        }
      } catch {
        // Corrupted storage — require new login
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

  async function ensureTeamInDb(authTeam: AuthTeam, apiKey: string, authUser: AuthUser) {
    await db.runAsync(
      `INSERT OR IGNORE INTO teams (server_id, nom, code_unique, couleur_primaire)
       VALUES (?, ?, ?, ?)`,
      authTeam.id, authTeam.nom, '', authTeam.couleur_primaire,
    );
    await db.runAsync(
      `UPDATE teams SET nom = ?, couleur_primaire = ? WHERE server_id = ?`,
      authTeam.nom, authTeam.couleur_primaire, authTeam.id,
    );

    const teamRow = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM teams WHERE server_id = ?', authTeam.id,
    );

    if (teamRow) {
      await db.runAsync(
        `INSERT OR IGNORE INTO users (server_id, nom, prenom, email, team_id, api_key)
         VALUES (?, ?, ?, ?, ?, ?)`,
        authUser.id, authUser.nom, authUser.prenom ?? '', authUser.email ?? '',
        teamRow.id, apiKey,
      );
      await db.runAsync(
        `UPDATE users SET nom = ?, prenom = ?, email = ?, api_key = ? WHERE server_id = ?`,
        authUser.nom, authUser.prenom ?? '', authUser.email ?? '', apiKey, authUser.id,
      );
    }
  }

  async function addAccount(apiKey: string, authUser: AuthUser, authTeam: AuthTeam) {
    // Prevent duplicates: same team + same user → just switch to existing account
    const existing = accounts.findIndex(
      (a) => a.team_id === String(authTeam.id) && a.user.id === authUser.id,
    );
    if (existing >= 0) {
      await switchAccount(existing);
      return;
    }

    await ensureTeamInDb(authTeam, apiKey, authUser);

    const newAccount: Account = { api_key: apiKey, team_id: String(authTeam.id), user: authUser, team: authTeam };
    const updated = [...accounts, newAccount];
    const newIdx = updated.length - 1;

    Storage.setItemSync('accounts', JSON.stringify(updated));
    Storage.setItemSync('active_idx', String(newIdx));
    persistActive(apiKey, String(authTeam.id), authUser, authTeam);

    setAccounts(updated);
    setActiveIdx(newIdx);
    setUser(authUser);
    setTeam(authTeam);
  }

  async function switchAccount(idx: number) {
    const acc = accounts[idx];
    if (!acc) return;
    Storage.setItemSync('active_idx', String(idx));
    persistActive(acc.api_key, acc.team_id, acc.user, acc.team);
    setActiveIdx(idx);
    setUser(acc.user);
    setTeam(acc.team);
  }

  async function removeAccount(idx: number) {
    const updated = accounts.filter((_, i) => i !== idx);
    if (updated.length === 0) {
      // Last account → full signOut
      Storage.removeItemSync('accounts');
      Storage.removeItemSync('active_idx');
      Storage.removeItemSync('api_key');
      Storage.removeItemSync('team_id');
      Storage.removeItemSync('user');
      Storage.removeItemSync('team');
      setAccounts([]);
      setActiveIdx(0);
      setUser(null);
      setTeam(null);
      return;
    }
    const newIdx = idx >= updated.length ? updated.length - 1 : idx;
    Storage.setItemSync('accounts', JSON.stringify(updated));
    Storage.setItemSync('active_idx', String(newIdx));
    persistActive(updated[newIdx].api_key, updated[newIdx].team_id, updated[newIdx].user, updated[newIdx].team);
    setAccounts(updated);
    setActiveIdx(newIdx);
    setUser(updated[newIdx].user);
    setTeam(updated[newIdx].team);
  }

  async function signIn(apiKey: string, authUser: AuthUser, authTeam: AuthTeam) {
    await ensureTeamInDb(authTeam, apiKey, authUser);

    const newAccount: Account = { api_key: apiKey, team_id: String(authTeam.id), user: authUser, team: authTeam };

    // Check if this account (same team_id + user) already exists
    const existing = accounts.findIndex(
      (a) => a.team_id === String(authTeam.id) && a.user.id === authUser.id,
    );

    let updated: Account[];
    let newIdx: number;

    if (existing >= 0) {
      updated = accounts.map((a, i) => (i === existing ? newAccount : a));
      newIdx = existing;
    } else {
      updated = [...accounts, newAccount];
      newIdx = updated.length - 1;
    }

    Storage.setItemSync('accounts', JSON.stringify(updated));
    Storage.setItemSync('active_idx', String(newIdx));
    persistActive(apiKey, String(authTeam.id), authUser, authTeam);

    setAccounts(updated);
    setActiveIdx(newIdx);
    setUser(authUser);
    setTeam(authTeam);
  }

  async function refreshFromDb() {
    try {
      // Read from KV-Store (not from React closure) to avoid stale activeIdx/accounts
      const storedAccountsStr = Storage.getItemSync('accounts');
      const storedIdx = Storage.getItemSync('active_idx');
      if (!storedAccountsStr) return;

      const currentAccounts: Account[] = JSON.parse(storedAccountsStr);
      const currentIdx = storedIdx ? parseInt(storedIdx, 10) : 0;
      const currentAccount = currentAccounts[currentIdx];
      if (!currentAccount) return;

      const currentUser = currentAccount.user;
      const currentTeam = currentAccount.team;

      let updatedAccounts = [...currentAccounts];
      let freshTeam = currentTeam;
      let freshUser = currentUser;

      const teamRow = await db.getFirstAsync<{ nom: string; couleur_primaire: string }>(
        'SELECT nom, couleur_primaire FROM teams WHERE server_id = ?',
        currentTeam.id,
      );
      if (teamRow) {
        freshTeam = { ...currentTeam, nom: teamRow.nom, couleur_primaire: teamRow.couleur_primaire };
        updatedAccounts = updatedAccounts.map((a, i) => (i === currentIdx ? { ...a, team: freshTeam } : a));
      }

      const userRow = await db.getFirstAsync<{ nom: string; prenom: string; email: string }>(
        'SELECT nom, prenom, email FROM users WHERE server_id = ?',
        currentUser.id,
      );
      if (userRow) {
        freshUser = { ...currentUser, nom: userRow.nom, prenom: userRow.prenom, email: userRow.email };
        updatedAccounts = updatedAccounts.map((a, i) => (i === currentIdx ? { ...a, user: freshUser } : a));
      }

      Storage.setItemSync('accounts', JSON.stringify(updatedAccounts));
      Storage.setItemSync('user', JSON.stringify(freshUser));
      Storage.setItemSync('team', JSON.stringify(freshTeam));
      setAccounts(updatedAccounts);
      setTeam(freshTeam);
      setUser(freshUser);
    } catch (e) {
      console.warn('[Auth] refreshFromDb échoué:', e);
    }
  }

  async function signOut() {
    Storage.removeItemSync('accounts');
    Storage.removeItemSync('active_idx');
    Storage.removeItemSync('api_key');
    Storage.removeItemSync('team_id');
    Storage.removeItemSync('user');
    Storage.removeItemSync('team');
    setAccounts([]);
    setActiveIdx(0);
    setUser(null);
    setTeam(null);
  }

  return (
    <AuthContext.Provider value={{
      user, team, accounts, activeIdx, isLoading,
      signIn, signOut, addAccount, switchAccount, removeAccount, refreshFromDb,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
