import { Repository } from '../../db/repository.js'
import { LLMConfig, MCPServerConfig } from '../../../../shared/types/index.js'
import { v4 as uuidv4 } from 'uuid'

export class ConfigService {
  constructor(private repository: Repository) {}

  // LLM Configuration
  getLLMConfig(): LLMConfig | null {
    return this.repository.getLLMConfig()
  }

  saveLLMConfig(config: LLMConfig): void {
    this.repository.saveLLMConfig(config)
  }

  // MCP Server Configuration
  getAllMCPServers(): MCPServerConfig[] {
    return this.repository.getAllMCPServers()
  }

  getEnabledMCPServers(): MCPServerConfig[] {
    return this.repository.getEnabledMCPServers()
  }

  getMCPServer(id: string): MCPServerConfig | null {
    return this.repository.getMCPServer(id)
  }

  addMCPServer(
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

    this.repository.saveMCPServer(server)
    return server
  }

  updateMCPServer(id: string, updates: Partial<MCPServerConfig>): void {
    this.repository.updateMCPServer(id, updates)
  }

  deleteMCPServer(id: string): void {
    this.repository.deleteMCPServer(id)
  }

  toggleMCPServer(id: string, enabled: boolean): void {
    this.repository.updateMCPServer(id, { enabled })
  }
}
