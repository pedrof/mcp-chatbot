import type {
  Message,
  LLMConfig,
  MCPServerConfig,
  MCPServerRequest,
  HealthCheckResult,
  AppConfig
} from '../../../shared/types'
import {
  HealthCheckResultValidator,
  AppConfigValidator,
  MCPServerConfigValidator,
  StreamChunkValidator
} from '../../../shared/types/validators'
import { z } from 'zod'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export class APIClient {
  private baseURL: string
  private token: string | null = null

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
    // Load token from localStorage on init
    this.token = localStorage.getItem('auth_token')
  }

  setToken(token: string | null) {
    this.token = token
  }

  private getHeaders(additionalHeaders: HeadersInit = {}): HeadersInit {
    const headers: HeadersInit = {
      ...additionalHeaders
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    return headers
  }

  // Health Check
  async healthCheck(): Promise<HealthCheckResult> {
    const response = await fetch(`${this.baseURL}/health`)
    if (!response.ok) {
      throw new Error('Health check failed')
    }
    const data = await response.json()
    return HealthCheckResultValidator.parse(data)
  }

  // Configuration
  async getConfig(): Promise<AppConfig> {
    const response = await fetch(`${this.baseURL}/config`, {
      headers: this.getHeaders()
    })
    if (!response.ok) {
      throw new Error('Failed to fetch config')
    }
    const data = await response.json()
    return AppConfigValidator.parse(data)
  }

  async updateLLMConfig(config: LLMConfig): Promise<void> {
    const response = await fetch(`${this.baseURL}/config/llm`, {
      method: 'PUT',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(config)
    })
    if (!response.ok) {
      const error = await response.json()
      if (error.details && Array.isArray(error.details)) {
        const messages = error.details.map((d: any) => `${d.path.join('.')}: ${d.message}`).join(', ')
        throw new Error(`${error.error}: ${messages}`)
      }
      throw new Error(error.error || 'Failed to update LLM config')
    }
  }

  async getMCPServers(): Promise<MCPServerConfig[]> {
    const response = await fetch(`${this.baseURL}/config/mcp`, {
      headers: this.getHeaders()
    })
    if (!response.ok) {
      throw new Error('Failed to fetch MCP servers')
    }
    const data = await response.json()
    const validated = z.object({
      servers: z.array(MCPServerConfigValidator)
    }).parse(data)
    return validated.servers
  }

  async addMCPServer(server: MCPServerRequest): Promise<MCPServerConfig> {
    const response = await fetch(`${this.baseURL}/config/mcp`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(server)
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to add MCP server')
    }
    const data = await response.json()
    const validated = z.object({
      server: MCPServerConfigValidator
    }).parse(data)
    return validated.server
  }

  async deleteMCPServer(id: string): Promise<void> {
    const response = await fetch(`${this.baseURL}/config/mcp/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    })
    if (!response.ok) {
      throw new Error('Failed to delete MCP server')
    }
  }

  async toggleMCPServer(id: string, enabled: boolean): Promise<void> {
    const response = await fetch(`${this.baseURL}/config/mcp/${id}/toggle`, {
      method: 'PATCH',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ enabled })
    })
    if (!response.ok) {
      throw new Error('Failed to toggle MCP server')
    }
  }

  // Chat with SSE streaming
  async *chatStream(messages: Message[]): AsyncGenerator<{
    type: 'content' | 'tool_call' | 'done' | 'error'
    content?: string
    tool_call?: any
    error?: string
  }> {
    const response = await fetch(`${this.baseURL}/chat`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ messages })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Chat request failed')
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              return
            }
            try {
              const chunk = JSON.parse(data)
              const validated = StreamChunkValidator.parse(chunk)
              yield validated
            } catch (e) {
              console.error('Failed to parse or validate SSE data:', data, e)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}

export const apiClient = new APIClient()
