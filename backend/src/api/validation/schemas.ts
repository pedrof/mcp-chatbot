import { z } from 'zod'

/**
 * Allowed MCP server commands (whitelist for security)
 * Only these commands and absolute paths in /usr/local/bin/ are permitted
 */
const ALLOWED_COMMANDS = [
  'node',
  'npx',
  'python',
  'python3',
  'uvx',
  '/usr/bin/node',
  '/usr/bin/python',
  '/usr/bin/python3',
  '/usr/local/bin/node',
  '/usr/local/bin/python',
  '/usr/local/bin/python3'
]

/**
 * Message schema for chat requests
 */
export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string(),
  tool_calls: z.array(
    z.object({
      id: z.string(),
      type: z.literal('function'),
      function: z.object({
        name: z.string(),
        arguments: z.string()
      })
    })
  ).optional(),
  tool_call_id: z.string().optional(),
  timestamp: z.number().optional()
})

/**
 * Chat request schema
 */
export const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema)
})

/**
 * LLM configuration schema
 */
export const LLMConfigSchema = z.object({
  baseURL: z.string().url(),
  apiKey: z.string().optional().nullable(),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().positive().optional().nullable(),
  topP: z.number().min(0).max(1).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  systemPrompt: z.string().optional().nullable()
})

/**
 * Stdio MCP server configuration schema with command whitelist validation
 */
export const StdioMCPServerSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.literal('stdio'),
  config: z.object({
    command: z.string().refine(
      (cmd) => ALLOWED_COMMANDS.includes(cmd) || cmd.startsWith('/usr/local/bin/'),
      {
        message: `Command must be one of: ${ALLOWED_COMMANDS.join(', ')} or start with /usr/local/bin/`
      }
    ),
    args: z.array(z.string()),
    env: z.record(z.string()).optional()
  })
})

/**
 * HTTP MCP server configuration schema
 */
export const HTTPMCPServerSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.literal('http'),
  config: z.object({
    url: z.string().url(),
    headers: z.record(z.string()).optional()
  })
})

/**
 * Union schema for any MCP server type
 */
export const MCPServerSchema = z.union([StdioMCPServerSchema, HTTPMCPServerSchema])

/**
 * MCP server toggle request schema
 */
export const MCPServerToggleSchema = z.object({
  enabled: z.boolean()
})
