import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import bcrypt from 'bcrypt'

export function initializeDatabase(dbPath: string): Database.Database {
  // Ensure directory exists
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const db = new Database(dbPath)

  // Enable foreign keys
  db.pragma('foreign_keys = ON')

  // Check if migration is needed (detect old schema)
  const needsMigration = checkIfMigrationNeeded(db)

  if (needsMigration) {
    console.log('Migrating database to multi-tenant schema...')
    migrateToMultiTenant(db)
    console.log('Migration complete!')
  }

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS llm_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      base_url TEXT NOT NULL,
      api_key_encrypted TEXT,
      model TEXT NOT NULL,
      temperature REAL DEFAULT 0.7,
      max_tokens INTEGER,
      top_p REAL DEFAULT 1.0,
      presence_penalty REAL DEFAULT 0.0,
      frequency_penalty REAL DEFAULT 0.0,
      system_prompt TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id)
    );

    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('stdio', 'http')),
      config TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_history (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      messages TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_llm_config_user ON llm_config(user_id);
    CREATE INDEX IF NOT EXISTS idx_mcp_servers_user ON mcp_servers(user_id);
    CREATE INDEX IF NOT EXISTS idx_mcp_servers_enabled ON mcp_servers(user_id, enabled);
    CREATE INDEX IF NOT EXISTS idx_chat_history_user ON chat_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_history_created ON chat_history(created_at DESC);
  `)

  return db
}

function checkIfMigrationNeeded(db: Database.Database): boolean {
  try {
    // Check if old llm_config table exists (without user_id column)
    const oldLLMConfig = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='llm_config'").get()
    const usersTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get()

    // Migration is needed if we have old tables but no users table
    return oldLLMConfig && !usersTable
  } catch {
    return false
  }
}

function migrateToMultiTenant(db: Database.Database): void {

  // Start transaction
  db.exec('BEGIN TRANSACTION')

  try {
    // Create users table first
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create default admin user (password: admin123 - user should change this)
    const defaultPassword = 'admin123'
    const passwordHash = bcrypt.hashSync(defaultPassword, 10)

    const insertUser = db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
    const userResult = insertUser.run('admin', 'admin@localhost', passwordHash)
    const adminUserId = userResult.lastInsertRowid

    console.log(`Created default admin user (username: admin, password: admin123)`)
    console.log('IMPORTANT: Please change the default password after first login!')

    // Migrate llm_config - check if table exists first
    let oldLLMConfig: any = null
    try {
      oldLLMConfig = db.prepare('SELECT * FROM llm_config WHERE id = 1').get() as any
    } catch (error) {
      console.log('No old llm_config table found, skipping migration')
    }

    if (oldLLMConfig) {
      // Rename old table
      db.exec('ALTER TABLE llm_config RENAME TO llm_config_old')

      // Create new table
      db.exec(`
        CREATE TABLE llm_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          base_url TEXT NOT NULL,
          api_key_encrypted TEXT,
          model TEXT NOT NULL,
          temperature REAL DEFAULT 0.7,
          max_tokens INTEGER,
          top_p REAL DEFAULT 1.0,
          presence_penalty REAL DEFAULT 0.0,
          frequency_penalty REAL DEFAULT 0.0,
          system_prompt TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id)
        )
      `)

      // Copy data with admin user_id
      db.prepare(`
        INSERT INTO llm_config (user_id, base_url, api_key_encrypted, model, temperature,
                                max_tokens, top_p, presence_penalty, frequency_penalty,
                                system_prompt, updated_at)
        SELECT ?, base_url, api_key_encrypted, model, temperature,
               max_tokens, top_p, presence_penalty, frequency_penalty,
               system_prompt, updated_at
        FROM llm_config_old WHERE id = 1
      `).run(adminUserId)

      // Drop old table
      db.exec('DROP TABLE llm_config_old')

      console.log('Migrated LLM config to admin user')
    }

    // Migrate mcp_servers - check if table exists first
    let oldMCPServers: any = { count: 0 }
    try {
      oldMCPServers = db.prepare('SELECT COUNT(*) as count FROM mcp_servers').get() as any
    } catch (error) {
      console.log('No old mcp_servers table found, skipping migration')
    }

    if (oldMCPServers.count > 0) {
      // Add user_id column with default value
      db.exec(`ALTER TABLE mcp_servers ADD COLUMN user_id INTEGER DEFAULT ${adminUserId}`)

      // Update all existing servers to belong to admin
      db.prepare('UPDATE mcp_servers SET user_id = ?').run(adminUserId)

      // Now make user_id NOT NULL and add foreign key
      // SQLite doesn't support ALTER COLUMN, so we need to recreate the table
      db.exec('ALTER TABLE mcp_servers RENAME TO mcp_servers_old')

      db.exec(`
        CREATE TABLE mcp_servers (
          id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('stdio', 'http')),
          config TEXT NOT NULL,
          enabled INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `)

      db.exec(`
        INSERT INTO mcp_servers (id, user_id, name, type, config, enabled, created_at)
        SELECT id, user_id, name, type, config, enabled, created_at
        FROM mcp_servers_old
      `)

      db.exec('DROP TABLE mcp_servers_old')

      console.log(`Migrated ${oldMCPServers.count} MCP servers to admin user`)
    }

    // Migrate chat_history - check if table exists first
    let oldChatHistory: any = { count: 0 }
    try {
      oldChatHistory = db.prepare('SELECT COUNT(*) as count FROM chat_history').get() as any
    } catch (error) {
      console.log('No old chat_history table found, skipping migration')
    }

    if (oldChatHistory.count > 0) {
      db.exec(`ALTER TABLE chat_history ADD COLUMN user_id INTEGER DEFAULT ${adminUserId}`)
      db.prepare('UPDATE chat_history SET user_id = ?').run(adminUserId)

      db.exec('ALTER TABLE chat_history RENAME TO chat_history_old')

      db.exec(`
        CREATE TABLE chat_history (
          id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          messages TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `)

      db.exec(`
        INSERT INTO chat_history (id, user_id, messages, created_at)
        SELECT id, user_id, messages, created_at
        FROM chat_history_old
      `)

      db.exec('DROP TABLE chat_history_old')

      console.log(`Migrated ${oldChatHistory.count} chat history entries to admin user`)
    }

    // Commit transaction
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function createTestDatabase(): Database.Database {
  // Use in-memory database for tests
  const db = new Database(':memory:')

  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE llm_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      base_url TEXT NOT NULL,
      api_key_encrypted TEXT,
      model TEXT NOT NULL,
      temperature REAL DEFAULT 0.7,
      max_tokens INTEGER,
      top_p REAL DEFAULT 1.0,
      presence_penalty REAL DEFAULT 0.0,
      frequency_penalty REAL DEFAULT 0.0,
      system_prompt TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id)
    );

    CREATE TABLE mcp_servers (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('stdio', 'http')),
      config TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE chat_history (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      messages TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX idx_llm_config_user ON llm_config(user_id);
    CREATE INDEX idx_mcp_servers_user ON mcp_servers(user_id);
    CREATE INDEX idx_mcp_servers_enabled ON mcp_servers(user_id, enabled);
    CREATE INDEX idx_chat_history_user ON chat_history(user_id);
    CREATE INDEX idx_chat_history_created ON chat_history(created_at DESC);
  `)

  return db
}
