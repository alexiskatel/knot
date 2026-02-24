import { type SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 4;

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) return;

  // WAL mode doit être activé HORS transaction
  await db.execAsync('PRAGMA journal_mode = WAL');

  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS teams (
        id              INTEGER PRIMARY KEY NOT NULL,
        server_id       INTEGER NOT NULL UNIQUE,
        nom             TEXT    NOT NULL,
        code_unique     TEXT    NOT NULL UNIQUE,
        couleur_primaire TEXT   NOT NULL DEFAULT '#2F3C73',
        created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS users (
        id              INTEGER PRIMARY KEY NOT NULL,
        server_id       INTEGER NOT NULL UNIQUE,
        nom             TEXT    NOT NULL,
        prenom          TEXT,
        email           TEXT,
        team_id         INTEGER NOT NULL REFERENCES teams(id),
        api_key         TEXT    NOT NULL,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS projets (
        id              INTEGER PRIMARY KEY NOT NULL,
        server_id       INTEGER,
        sync_id         TEXT    NOT NULL UNIQUE,
        titre           TEXT    NOT NULL,
        description     TEXT,
        couleur         TEXT    NOT NULL DEFAULT '#2F3C73',
        statut          INTEGER NOT NULL DEFAULT 1,
        team_id         INTEGER NOT NULL REFERENCES teams(id),
        created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
        sync_status     TEXT    NOT NULL DEFAULT 'synced'
      );

      CREATE TABLE IF NOT EXISTS notes (
        id              INTEGER PRIMARY KEY NOT NULL,
        server_id       INTEGER,
        sync_id         TEXT    NOT NULL UNIQUE,
        titre           TEXT    NOT NULL,
        contenu         TEXT    NOT NULL DEFAULT '',
        statut          TEXT    NOT NULL DEFAULT 'publie',
        projet_id       INTEGER NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
        auteur_id       INTEGER NOT NULL REFERENCES users(id),
        team_id         INTEGER NOT NULL REFERENCES teams(id),
        created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
        sync_status     TEXT    NOT NULL DEFAULT 'synced'
      );

      CREATE TABLE IF NOT EXISTS taches (
        id              INTEGER PRIMARY KEY NOT NULL,
        server_id       INTEGER,
        sync_id         TEXT    NOT NULL UNIQUE,
        titre           TEXT    NOT NULL,
        description     TEXT,
        statut          TEXT    NOT NULL DEFAULT 'todo',
        projet_id       INTEGER NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
        auteur_id       INTEGER NOT NULL REFERENCES users(id),
        assigne_id      INTEGER REFERENCES users(id),
        team_id         INTEGER NOT NULL REFERENCES teams(id),
        due_date        TEXT,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
        sync_status     TEXT    NOT NULL DEFAULT 'synced'
      );

      CREATE TABLE IF NOT EXISTS commentaires (
        id              INTEGER PRIMARY KEY NOT NULL,
        server_id       INTEGER,
        sync_id         TEXT    NOT NULL UNIQUE,
        contenu         TEXT    NOT NULL,
        type            TEXT    NOT NULL DEFAULT 'texte',
        note_id         INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        auteur_id       INTEGER NOT NULL REFERENCES users(id),
        team_id         INTEGER NOT NULL REFERENCES teams(id),
        created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
        sync_status     TEXT    NOT NULL DEFAULT 'synced'
      );

      CREATE TABLE IF NOT EXISTS reactions (
        id              INTEGER PRIMARY KEY NOT NULL,
        server_id       INTEGER,
        sync_id         TEXT    NOT NULL UNIQUE,
        type            TEXT    NOT NULL,
        commentaire_id  INTEGER NOT NULL REFERENCES commentaires(id) ON DELETE CASCADE,
        auteur_id       INTEGER NOT NULL REFERENCES users(id),
        team_id         INTEGER NOT NULL REFERENCES teams(id),
        created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
        sync_status     TEXT    NOT NULL DEFAULT 'synced',
        UNIQUE(type, commentaire_id, auteur_id)
      );

      CREATE INDEX IF NOT EXISTS idx_notes_projet ON notes(projet_id);
      CREATE INDEX IF NOT EXISTS idx_notes_team   ON notes(team_id);
      CREATE INDEX IF NOT EXISTS idx_taches_projet ON taches(projet_id);
      CREATE INDEX IF NOT EXISTS idx_taches_team   ON taches(team_id);
      CREATE INDEX IF NOT EXISTS idx_commentaires_note ON commentaires(note_id);

      PRAGMA user_version = 1;
    `);
  });

  if (currentVersion < 2) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE commentaires_new (
          id        INTEGER PRIMARY KEY NOT NULL,
          server_id INTEGER,
          sync_id   TEXT    NOT NULL UNIQUE,
          contenu   TEXT    NOT NULL,
          type      TEXT    NOT NULL DEFAULT 'texte',
          note_id   INTEGER REFERENCES notes(id)  ON DELETE CASCADE,
          tache_id  INTEGER REFERENCES taches(id) ON DELETE CASCADE,
          auteur_id INTEGER NOT NULL REFERENCES users(id),
          team_id   INTEGER NOT NULL REFERENCES teams(id),
          created_at  TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
          sync_status TEXT NOT NULL DEFAULT 'synced'
        );
        INSERT INTO commentaires_new
          SELECT id, server_id, sync_id, contenu, type,
                 note_id, NULL, auteur_id, team_id,
                 created_at, updated_at, sync_status
          FROM commentaires;
        DROP TABLE commentaires;
        ALTER TABLE commentaires_new RENAME TO commentaires;
        CREATE INDEX IF NOT EXISTS idx_commentaires_note  ON commentaires(note_id);
        CREATE INDEX IF NOT EXISTS idx_commentaires_tache ON commentaires(tache_id);
        PRAGMA user_version = 2;
      `);
    });
  }

  if (currentVersion < 3) {
    const alters3: [string, string][] = [
      ['notes',   'deleted_at TEXT'],
      ['taches',  'deleted_at TEXT'],
      ['projets', 'deleted_at TEXT'],
      ['users',   'is_admin INTEGER NOT NULL DEFAULT 0'],
    ];
    for (const [table, col] of alters3) {
      try { await db.runAsync(`ALTER TABLE ${table} ADD COLUMN ${col}`); } catch {}
    }
    await db.runAsync('PRAGMA user_version = 3');
  }

  if (currentVersion < 4) {
    const alters4: [string, string][] = [
      ['notes',   'deleted_by INTEGER REFERENCES users(id)'],
      ['taches',  'deleted_by INTEGER REFERENCES users(id)'],
      ['projets', 'deleted_by INTEGER REFERENCES users(id)'],
    ];
    for (const [table, col] of alters4) {
      try { await db.runAsync(`ALTER TABLE ${table} ADD COLUMN ${col}`); } catch {}
    }
    await db.runAsync('PRAGMA user_version = 4');
  }
}
