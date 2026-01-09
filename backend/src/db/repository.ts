import Database from 'better-sqlite3'
import { LLMConfig, MCPServerConfig } from '../../../shared/types/index.js'
import { EncryptionService } from '../services/config/EncryptionService.js'

export class Repository {
  constructor(
    private db: Database.Database,
    private encryption: EncryptionService
  ) {}

  // LLM Config Operations
  getLLMConfig(userId: number): LLMConfig | null {
    const row = this.db
      .prepare('SELECT * FROM llm_config WHERE user_id = ?')
      .get(userId) as any

    if (!row) return null

    return {
      baseURL: row.base_url,
      apiKey: row.api_key_encrypted
        ? this.encryption.decrypt(row.api_key_encrypted)
        : undefined,
      model: row.model,
      temperature: row.temperature,
      maxTokens: row.max_tokens,
      topP: row.top_p,
      presencePenalty: row.presence_penalty,
      frequencyPenalty: row.frequency_penalty,
      systemPrompt: row.system_prompt
    }
  }

  saveLLMConfig(userId: number, config: LLMConfig): void {
    const apiKeyEncrypted = config.apiKey
      ? this.encryption.encrypt(config.apiKey)
      : null

    const stmt = this.db.prepare(`
      INSERT INTO llm_config (user_id, base_url, api_key_encrypted, model, temperature, max_tokens,
                              top_p, presence_penalty, frequency_penalty, system_prompt, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        base_url = excluded.base_url,
        api_key_encrypted = excluded.api_key_encrypted,
        model = excluded.model,
        temperature = excluded.temperature,
        max_tokens = excluded.max_tokens,
        top_p = excluded.top_p,
        presence_penalty = excluded.presence_penalty,
        frequency_penalty = excluded.frequency_penalty,
        system_prompt = excluded.system_prompt,
        updated_at = CURRENT_TIMESTAMP
    `)

    stmt.run(
      userId,
      config.baseURL,
      apiKeyEncrypted,
      config.model,
      config.temperature ?? 0.7,
      config.maxTokens ?? null,
      config.topP ?? 1.0,
      config.presencePenalty ?? 0.0,
      config.frequencyPenalty ?? 0.0,
      config.systemPrompt ?? null
    )
  }

  // MCP Server Operations
  private mapRowToMCPServer(row: any): MCPServerConfig {
    return {
      id: row.id,
      name: row.name,
      type: row.type as 'stdio' | 'http',
      enabled: row.enabled === 1,
      config: JSON.parse(row.config),
      createdAt: row.created_at
    }
  }

  getAllMCPServers(userId: number): MCPServerConfig[] {
    const rows = this.db
      .prepare('SELECT * FROM mcp_servers WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as any[]

    return rows.map(row => this.mapRowToMCPServer(row))
  }

  getEnabledMCPServers(userId: number): MCPServerConfig[] {
    const rows = this.db
      .prepare('SELECT * FROM mcp_servers WHERE user_id = ? AND enabled = 1 ORDER BY created_at DESC')
      .all(userId) as any[]

    return rows.map(row => this.mapRowToMCPServer(row))
  }

  getMCPServer(userId: number, id: string): MCPServerConfig | null {
    const row = this.db
      .prepare('SELECT * FROM mcp_servers WHERE user_id = ? AND id = ?')
      .get(userId, id) as any

    if (!row) return null

    return this.mapRowToMCPServer(row)
  }

  saveMCPServer(userId: number, server: MCPServerConfig): void {
    const stmt = this.db.prepare(`
      INSERT INTO mcp_servers (id, user_id, name, type, config, enabled, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      server.id,
      userId,
      server.name,
      server.type,
      JSON.stringify(server.config),
      server.enabled ? 1 : 0,
      server.createdAt
    )
  }

  updateMCPServer(userId: number, id: string, updates: Partial<MCPServerConfig>): void {
    const fields: string[] = []
    const values: any[] = []

    if (updates.name !== undefined) {
      fields.push('name = ?')
      values.push(updates.name)
    }
    if (updates.enabled !== undefined) {
      fields.push('enabled = ?')
      values.push(updates.enabled ? 1 : 0)
    }
    if (updates.config !== undefined) {
      fields.push('config = ?')
      values.push(JSON.stringify(updates.config))
    }

    if (fields.length === 0) return

    values.push(userId, id)
    const stmt = this.db.prepare(`
      UPDATE mcp_servers SET ${fields.join(', ')} WHERE user_id = ? AND id = ?
    `)
    stmt.run(...values)
  }

  deleteMCPServer(userId: number, id: string): void {
    this.db.prepare('DELETE FROM mcp_servers WHERE user_id = ? AND id = ?').run(userId, id)
  }

  // Chat History Operations
  saveChatHistory(userId: number, id: string, messages: any[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO chat_history (id, user_id, messages, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `)
    stmt.run(id, userId, JSON.stringify(messages))
  }

  getChatHistory(userId: number, id: string): any[] | null {
    const row = this.db
      .prepare('SELECT messages FROM chat_history WHERE user_id = ? AND id = ?')
      .get(userId, id) as any

    if (!row) return null
    return JSON.parse(row.messages)
  }
}
