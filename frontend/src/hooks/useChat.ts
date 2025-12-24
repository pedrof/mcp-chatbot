import { useState, useCallback } from 'react'
import { apiClient } from '../services/api'
import type { Message } from '../../../shared/types'

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(async (content: string) => {
    setError(null)
    setIsStreaming(true)

    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMessage])

    let assistantMessage: Message = {
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }

    try {
      // Add system message to ensure English responses and set context
      const systemMessage: Message = {
        role: 'system',
        content: 'You are an MCP (Model Context Protocol) chatbot assistant designed to help developers troubleshoot and develop MCP servers. You have access to MCP tools that can interact with the system. Always respond in English, regardless of the language used in the user\'s message. Help users debug their MCP server implementations, explain MCP concepts, and assist with integration issues.',
        timestamp: 0 // System message always at timestamp 0
      }

      const stream = apiClient.chatStream([systemMessage, ...messages, userMessage])

      for await (const chunk of stream) {
        if (chunk.type === 'content' && chunk.content) {
          assistantMessage.content += chunk.content
          setMessages(prev => {
            const newMessages = [...prev]
            if (newMessages[newMessages.length - 1]?.role === 'assistant') {
              newMessages[newMessages.length - 1] = { ...assistantMessage }
            } else {
              newMessages.push({ ...assistantMessage })
            }
            return newMessages
          })
        } else if (chunk.type === 'error') {
          setError(chunk.error || 'An error occurred')
          break
        }
      }
    } catch (err: any) {
      setError(err.message)
      setMessages(prev => prev.filter(m => m !== userMessage))
    } finally {
      setIsStreaming(false)
    }
  }, [messages])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    clearMessages
  }
}
