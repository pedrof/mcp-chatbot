import { Request, Response } from 'express'
import { LLMService } from '../services/llm/LLMService.js'
import { MCPService } from '../services/mcp/MCPService.js'
import { ConfigService } from '../services/config/ConfigService.js'
import { ChatOrchestrator } from '../services/chat/ChatOrchestrator.js'
import type { ChatRequest, Message } from '../../../shared/types/index.js'
import { sendValidationError, sendErrorResponse, setupSSEHeaders } from './utils.js'
import { ChatRequestSchema } from './validation/schemas.js'

export class ChatAPI {
  constructor(
    private llmService: LLMService,
    private mcpService: MCPService,
    private configService: ConfigService
  ) {}

  async chat(req: Request, res: Response): Promise<void> {
    try {
      // Check authentication
      if (!req.user) {
        sendErrorResponse(res, 401, 'Not authenticated')
        return
      }

      // Validate request
      const validation = ChatRequestSchema.safeParse(req.body)
      if (!validation.success) {
        sendValidationError(res, validation.error)
        return
      }

      const { messages } = validation.data

      // Load user's LLM configuration
      const llmConfig = this.configService.getLLMConfig(req.user.userId)

      if (!llmConfig) {
        sendErrorResponse(
          res,
          503,
          'LLM not configured. Please configure via /api/config/llm'
        )
        return
      }

      // Configure LLM service with user's config
      const userLLMService = new LLMService(llmConfig)
      const chatOrchestrator = new ChatOrchestrator(userLLMService, this.mcpService)

      // Get available MCP tools (user-specific in the future if MCP becomes per-user)
      const mcpTools = this.mcpService.getAllTools()

      // Set up SSE headers
      setupSSEHeaders(res)

      // Stream response with tool execution
      try {
        for await (const chunk of chatOrchestrator.chatWithTools(messages, mcpTools)) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`)
        }
        res.write('data: [DONE]\n\n')
        res.end()
      } catch (error: any) {
        res.write(
          `data: ${JSON.stringify({
            type: 'error',
            error: error.message
          })}\n\n`
        )
        res.end()
      }
    } catch (error: any) {
      if (!res.headersSent) {
        sendErrorResponse(res, 500, error.message)
      }
    }
  }
}
