import { z } from 'zod'

/**
 * Health check result validator
 */
export const HealthCheckResultValidator = z.object({
  status: z.enum(['healthy', 'unhealthy']),
  llm: z.object({
    configured: z.boolean(),
    reachable: z.boolean(),
    error: z.string().optional()
  }),
  mcpServers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      connected: z.boolean(),
      toolCount: z.number(),
      error: z.string().optional()
    })
  )
})

/**
 * LLM config validator
 */
export const LLMConfigValidator = z.object({
  baseURL: z.string(),
  apiKey: z.string().optional().nullable(),
  model: z.string(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional().nullable(),
  topP: z.number().optional(),
  presencePenalty: z.number().optional(),
  frequencyPenalty: z.number().optional(),
  systemPrompt: z.string().optional().nullable()
})

/**
 * MCP server config validator
 */
const StdioConfigValidator = z.object({
  command: z.string(),
  args: z.array(z.string()),
  env: z.record(z.string()).optional()
})

const HTTPConfigValidator = z.object({
  url: z.string(),
  headers: z.record(z.string()).optional()
})

const StdioMCPServerValidator = z.object({
  id: z.string(),
  name: z.string(),
  type: z.literal('stdio'),
  enabled: z.boolean(),
  config: StdioConfigValidator,
  createdAt: z.string(),
  updatedAt: z.string().optional()
})

const HTTPMCPServerValidator = z.object({
  id: z.string(),
  name: z.string(),
  type: z.literal('http'),
  enabled: z.boolean(),
  config: HTTPConfigValidator,
  createdAt: z.string(),
  updatedAt: z.string().optional()
})

export const MCPServerConfigValidator = z.union([
  StdioMCPServerValidator,
  HTTPMCPServerValidator
])

/**
 * App config validator
 */
export const AppConfigValidator = z.object({
  llm: LLMConfigValidator.nullable(),
  mcpServers: z.array(MCPServerConfigValidator)
})

/**
 * Stream chunk validator
 */
export const StreamChunkValidator = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('content'),
    content: z.string()
  }),
  z.object({
    type: z.literal('tool_call'),
    tool_call: z.any()
  }),
  z.object({
    type: z.literal('chart_data'),
    chart_data: z.any()
  }),
  z.object({
    type: z.literal('done')
  }),
  z.object({
    type: z.literal('error'),
    error: z.string()
  })
])
