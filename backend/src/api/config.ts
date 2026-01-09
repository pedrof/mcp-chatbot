import { Request, Response } from 'express'
import { ConfigService } from '../services/config/ConfigService.js'
import { LLMService } from '../services/llm/LLMService.js'
import { MCPService } from '../services/mcp/MCPService.js'
import { asyncHandler, sendErrorResponse, sendValidationError } from './utils.js'
import {
  LLMConfigSchema,
  MCPServerSchema,
  MCPServerToggleSchema
} from './validation/schemas.js'
import type { LLMConfigRequest, MCPServerRequest } from '../../../shared/types/index.js'

export class ConfigAPI {
  constructor(
    private configService: ConfigService,
    private llmService: LLMService,
    private mcpService: MCPService
  ) {}

  // Get all config
  getConfig = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const llmConfig = this.configService.getLLMConfig(req.user.userId)
    const mcpServers = this.configService.getAllMCPServers(req.user.userId)

    res.json({
      llm: llmConfig,
      mcpServers
    })
  })

  // Update LLM config
  updateLLMConfig = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const validation = LLMConfigSchema.safeParse(req.body)
    if (!validation.success) {
      sendValidationError(res, validation.error)
      return
    }

    const config = validation.data

    // Test connection before saving
    const testService = new LLMService(config)
    const healthy = await testService.healthCheck()

    if (!healthy) {
      sendErrorResponse(res, 400, `Cannot connect to LLM endpoint at ${config.baseURL}`)
      return
    }

    // Save config for this user
    this.configService.saveLLMConfig(req.user.userId, config)

    res.json({
      success: true,
      config: {
        ...config,
        apiKey: config.apiKey ? '***' : undefined
      }
    })
  })

  // Get all MCP servers
  getMCPServers = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const servers = this.configService.getAllMCPServers(req.user.userId)
    res.json({ servers })
  })

  // Add MCP server
  addMCPServer = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const validation = MCPServerSchema.safeParse(req.body)
    if (!validation.success) {
      sendValidationError(res, validation.error)
      return
    }

    const { name, type, config } = validation.data
    const server = this.configService.addMCPServer(req.user.userId, name, type, config)

    // Connect server if enabled (works for both stdio and HTTP)
    const warnings: string[] = []
    if (server.enabled) {
      try {
        await this.mcpService.connectServer(server)
      } catch (error: any) {
        console.error(`Failed to connect MCP server '${server.name}':`, error.message)
        warnings.push(`Server saved but connection failed: ${error.message}`)
      }
    }

    res.status(201).json({
      server,
      ...(warnings.length > 0 && { warnings })
    })
  })

  // Delete MCP server
  deleteMCPServer = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const { id } = req.params

    const server = this.configService.getMCPServer(req.user.userId, id)
    if (!server) {
      sendErrorResponse(res, 404, 'Server not found')
      return
    }

    // Disconnect server first if it's connected
    await this.mcpService.disconnectServer(id)

    // Then delete from database
    this.configService.deleteMCPServer(req.user.userId, id)

    res.json({ success: true })
  })

  // Toggle MCP server
  toggleMCPServer = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    const { id } = req.params

    const validation = MCPServerToggleSchema.safeParse(req.body)
    if (!validation.success) {
      sendValidationError(res, validation.error)
      return
    }

    const { enabled } = validation.data

    const server = this.configService.getMCPServer(req.user.userId, id)
    if (!server) {
      sendErrorResponse(res, 404, 'Server not found')
      return
    }

    // Update database first
    this.configService.toggleMCPServer(req.user.userId, id, enabled)

    // Then connect or disconnect (works for both stdio and HTTP)
    const warnings: string[] = []
    if (enabled) {
      try {
        await this.mcpService.connectServer({ ...server, enabled: true })
      } catch (error: any) {
        console.error(`Failed to connect MCP server '${server.name}':`, error.message)
        warnings.push(`Toggle saved but connection failed: ${error.message}`)
      }
    } else {
      await this.mcpService.disconnectServer(id)
    }

    res.json({
      success: true,
      ...(warnings.length > 0 && { warnings })
    })
  })
}
