export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
  timestamp: number // Required for stable React keys
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ChatRequest {
  messages: Message[]
}

export interface ChatResponse {
  message: Message
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface StreamChunk {
  type: 'content' | 'tool_call' | 'done' | 'error'
  content?: string
  tool_call?: ToolCall
  error?: string
}
