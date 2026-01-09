import { Repository } from '../../db/repository.js'
import { LLMConfig, MCPServerConfig } from '../../../../shared/types/index.js'
import { v4 as uuidv4 } from 'uuid'

export class ConfigService {
  constructor(private repository: Repository) {}

  // LLM Configuration
  getLLMConfig(userId: number): LLMConfig | null {
    return this.repository.getLLMConfig(userId)
  }

  saveLLMConfig(userId: number, config: LLMConfig): void {
    this.repository.saveLLMConfig(userId, config)
  }

  // MCP Server Configuration
  getAllMCPServers(userId: number): MCPServerConfig[] {
    return this.repository.getAllMCPServers(userId)
  }

  getEnabledMCPServers(userId: number): MCPServerConfig[] {
    return this.repository.getEnabledMCPServers(userId)
  }

  getMCPServer(userId: number, id: string): MCPServerConfig | null {
    return this.repository.getMCPServer(userId, id)
  }

  addMCPServer(
    userId: number,
    name: string,
    type: 'stdio' | 'http',
    config: any
  ): MCPServerConfig {
    const server: MCPServerConfig = {
      id: uuidv4(),
      name,
      type,
      enabled: true,
      config,
      createdAt: new Date().toISOString()
    }

    this.repository.saveMCPServer(userId, server)
    return server
  }

  updateMCPServer(userId: number, id: string, updates: Partial<MCPServerConfig>): void {
    this.repository.updateMCPServer(userId, id, updates)
  }

  deleteMCPServer(userId: number, id: string): void {
    this.repository.deleteMCPServer(userId, id)
  }

  toggleMCPServer(userId: number, id: string, enabled: boolean): void {
    this.repository.updateMCPServer(userId, id, { enabled })
  }
}
