import { LLMService } from '../llm/LLMService.js'
import { MCPService } from '../mcp/MCPService.js'
import type { Message, ToolCall } from '../../../../shared/types/index.js'
import type { MCPTool, MCPToolResult } from '../../../../shared/types/index.js'

const MAX_ITERATIONS = 10
const TOOL_EXECUTION_TIMEOUT = 30000 // 30 seconds

interface ToolCallDelta {
  index: number
  id?: string
  type?: 'function'
  function?: {
    name?: string
    arguments?: string
  }
}

interface AccumulatedResponse {
  assistantMessage: Message
  toolCalls: ToolCall[]
  finishReason: string
}

/**
 * ChatOrchestrator manages the tool execution loop for MCP-enabled conversations.
 *
 * Responsibilities:
 * - Orchestrate multi-turn conversations with tool execution
 * - Accumulate streaming tool call chunks into complete ToolCall objects
 * - Execute tools via MCPService
 * - Build conversation history with tool results
 * - Stream status updates to client
 * - Handle errors gracefully
 */
export class ChatOrchestrator {
  constructor(
    private llmService: LLMService,
    private mcpService: MCPService
  ) {}

  /**
   * Main orchestration loop for chat with tool execution.
   *
   * Flow:
   * 1. Call LLM with current conversation history
   * 2. Stream content to client
   * 3. If LLM requests tool calls:
   *    a. Execute each tool
   *    b. Add results to history
   *    c. Continue loop
   * 4. If LLM gives final answer, stream it and finish
   *
   * @param messages - Conversation history
   * @param tools - Available MCP tools
   * @yields Stream chunks (content, tool_execution_start, tool_execution_result, done, error)
   */
  async *chatWithTools(
    messages: Message[],
    tools: MCPTool[]
  ): AsyncGenerator<{
    type: 'content' | 'tool_execution_start' | 'tool_execution_result' | 'done' | 'error'
    content?: string
    toolName?: string
    toolCallId?: string
    isError?: boolean
    error?: string
  }> {
    let conversationHistory = [...messages]
    let continueLoop = true
    let iteration = 0

    while (continueLoop && iteration < MAX_ITERATIONS) {
      iteration++

      console.log(`[ChatOrchestrator] Iteration ${iteration}/${MAX_ITERATIONS}`)

      try {
        // Step 1: Call LLM and accumulate response (streams content to client)
        const { assistantMessage, toolCalls, finishReason } =
          yield* this.accumulateStreamingResponse(conversationHistory, tools)

        console.log(`[ChatOrchestrator] LLM finish reason: ${finishReason}, tool calls: ${toolCalls.length}`)

        // Step 2: Check if LLM wants to call tools
        if (finishReason === 'tool_calls' && toolCalls.length > 0) {
          // Add assistant's tool call message to history
          conversationHistory.push(assistantMessage)

          // Step 3: Execute each tool
          for (const toolCall of toolCalls) {
            console.log(`[ChatOrchestrator] Executing tool: ${toolCall.function.name}`)

            yield {
              type: 'tool_execution_start',
              toolName: toolCall.function.name,
              toolCallId: toolCall.id
            }

            try {
              const result = await this.executeToolCallWithTimeout(toolCall, tools)

              // Add tool result to history
              const toolResultMessage: Message = {
                role: 'tool',
                content: this.formatToolResult(result),
                tool_call_id: toolCall.id,
                timestamp: Date.now()
              }
              conversationHistory.push(toolResultMessage)

              console.log(`[ChatOrchestrator] Tool ${toolCall.function.name} succeeded`)

              yield {
                type: 'tool_execution_result',
                toolName: toolCall.function.name,
                toolCallId: toolCall.id,
                isError: result.isError || false
              }
            } catch (error: any) {
              console.error(`[ChatOrchestrator] Tool ${toolCall.function.name} failed:`, error.message)

              // Add error result to history so LLM can explain
              const errorMessage: Message = {
                role: 'tool',
                content: `Error executing ${toolCall.function.name}: ${error.message}`,
                tool_call_id: toolCall.id,
                timestamp: Date.now()
              }
              conversationHistory.push(errorMessage)

              yield {
                type: 'tool_execution_result',
                toolName: toolCall.function.name,
                toolCallId: toolCall.id,
                isError: true
              }
            }
          }

          // Step 4: Continue loop - LLM will see tool results
          continueLoop = true
        } else {
          // Step 5: LLM gave final answer
          conversationHistory.push(assistantMessage)
          continueLoop = false
          console.log(`[ChatOrchestrator] Conversation complete`)
        }
      } catch (error: any) {
        console.error(`[ChatOrchestrator] Error in iteration ${iteration}:`, error.message)
        yield {
          type: 'error',
          error: error.message
        }
        break
      }
    }

    // Safety limit reached
    if (iteration >= MAX_ITERATIONS) {
      console.warn(`[ChatOrchestrator] Maximum iterations (${MAX_ITERATIONS}) reached`)
      yield {
        type: 'error',
        error: 'Maximum tool execution iterations reached. Stopping for safety.'
      }
    }

    yield { type: 'done' }
  }

  /**
   * Accumulate streaming LLM response into complete message.
   *
   * Streams content chunks to client immediately.
   * Buffers tool call deltas until complete.
   *
   * @param messages - Current conversation history
   * @param tools - Available tools
   * @returns Complete assistant message with any tool calls
   */
  private async *accumulateStreamingResponse(
    messages: Message[],
    tools: MCPTool[]
  ): AsyncGenerator<any, AccumulatedResponse> {
    let contentBuffer = ''
    let toolCallsBuffer: Map<number, Partial<ToolCall>> = new Map()
    let finishReason = 'stop'

    const stream = this.llmService.chatStream(messages, tools)

    for await (const chunk of stream) {
      // Stream content immediately
      if (chunk.type === 'content' && chunk.content) {
        contentBuffer += chunk.content
        yield { type: 'content', content: chunk.content }
      }

      // Accumulate tool call deltas (don't stream)
      if (chunk.type === 'tool_call' && chunk.tool_call) {
        const deltas: ToolCallDelta[] = Array.isArray(chunk.tool_call)
          ? chunk.tool_call
          : [chunk.tool_call]

        for (const delta of deltas) {
          const existing = toolCallsBuffer.get(delta.index) || {}

          // Merge delta into existing
          if (delta.id) {
            existing.id = delta.id
          }
          if (delta.type) {
            existing.type = delta.type
          }
          if (delta.function?.name) {
            if (!existing.function) existing.function = { name: '', arguments: '' }
            existing.function.name = delta.function.name
          }
          if (delta.function?.arguments) {
            if (!existing.function) existing.function = { name: '', arguments: '' }
            existing.function.arguments = (existing.function.arguments || '') + delta.function.arguments
          }

          toolCallsBuffer.set(delta.index, existing)
        }
        finishReason = 'tool_calls'
      }
    }

    // Convert accumulated tool calls to array
    const toolCalls: ToolCall[] = Array.from(toolCallsBuffer.values())
      .filter(tc => tc.id && tc.function?.name)
      .map(tc => ({
        id: tc.id!,
        type: 'function',
        function: {
          name: tc.function!.name,
          arguments: tc.function!.arguments || '{}'
        }
      }))

    const assistantMessage: Message = {
      role: 'assistant',
      content: contentBuffer,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      timestamp: Date.now()
    }

    return {
      assistantMessage,
      toolCalls,
      finishReason
    }
  }

  /**
   * Execute a tool call with timeout protection.
   *
   * @param toolCall - Tool call to execute
   * @param availableTools - Available tools
   * @returns Tool execution result
   */
  private async executeToolCallWithTimeout(
    toolCall: ToolCall,
    availableTools: MCPTool[]
  ): Promise<MCPToolResult> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Tool execution timeout after ${TOOL_EXECUTION_TIMEOUT}ms`)),
        TOOL_EXECUTION_TIMEOUT
      )
    )

    return Promise.race([
      this.executeToolCall(toolCall, availableTools),
      timeoutPromise
    ])
  }

  /**
   * Execute a single tool call.
   *
   * @param toolCall - Tool call from LLM
   * @param availableTools - Available MCP tools
   * @returns Tool execution result
   */
  private async executeToolCall(
    toolCall: ToolCall,
    availableTools: MCPTool[]
  ): Promise<MCPToolResult> {
    const toolName = toolCall.function.name

    // Find tool to get serverId
    const tool = availableTools.find(t => t.name === toolName)
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`)
    }

    // Parse arguments
    let args: Record<string, any>
    try {
      args = JSON.parse(toolCall.function.arguments)
    } catch (error: any) {
      throw new Error(`Invalid tool arguments: ${error.message}`)
    }

    // Execute via MCPService
    return await this.mcpService.executeTool(
      tool.serverId,
      toolName,
      args
    )
  }

  /**
   * Format MCPToolResult (structured content array) to string for LLM.
   *
   * @param result - Tool execution result
   * @returns Formatted string
   */
  private formatToolResult(result: MCPToolResult): string {
    return result.content
      .map(item => {
        if (item.type === 'text' && item.text) {
          return item.text
        }
        if (item.data) {
          return JSON.stringify(item.data, null, 2)
        }
        return ''
      })
      .filter(s => s.length > 0)
      .join('\n\n')
  }
}
