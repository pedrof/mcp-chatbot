import { useChat } from '../../hooks/useChat'
import { useHealthCheck } from '../../hooks/useConfig'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'

export function ChatInterface() {
  const { messages, isStreaming, error, sendMessage, clearMessages } = useChat()
  const { data: health } = useHealthCheck()

  const isLLMConfigured = health?.llm.configured ?? false
  const isLLMReachable = health?.llm.reachable ?? false
  const canChat = isLLMConfigured && isLLMReachable && !isStreaming

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <h2>Chat</h2>
        <div className="chat-actions">
          {messages.length > 0 && (
            <button onClick={clearMessages} disabled={isStreaming}>
              Clear
            </button>
          )}
        </div>
      </div>

      {!isLLMConfigured && (
        <div className="alert alert-warning">
          LLM not configured. Please configure in the Settings panel.
        </div>
      )}

      {isLLMConfigured && !isLLMReachable && (
        <div className="alert alert-error">
          Cannot reach LLM endpoint at {health?.llm.error}
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          Error: {error}
        </div>
      )}

      <MessageList messages={messages} isStreaming={isStreaming} />

      <MessageInput
        onSend={sendMessage}
        disabled={!canChat}
      />
    </div>
  )
}
