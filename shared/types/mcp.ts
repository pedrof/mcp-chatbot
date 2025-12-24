export type MCPServerType = 'stdio' | 'http'

export interface MCPServerConfig {
  id: string
  name: string
  type: MCPServerType
  enabled: boolean
  config: StdioConfig | HTTPConfig
  createdAt: string
}

export interface StdioConfig {
  command: string
  args: string[]
  env?: Record<string, string>
}

export interface HTTPConfig {
  url: string
  headers?: Record<string, string>
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: string
    properties?: Record<string, any>
    required?: string[]
  }
  serverId: string
}

export interface MCPToolCall {
  name: string
  arguments: Record<string, any>
}

export interface MCPToolResult {
  content: Array<{
    type: string
    text?: string
    data?: any
  }>
  isError?: boolean
}

export interface MCPServerStatus {
  id: string
  connected: boolean
  toolCount: number
  error?: string
}
