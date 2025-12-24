import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { ChatInterface } from './components/chat/ChatInterface'
import { ConfigPanel } from './components/config/ConfigPanel'
import { useHealthCheck } from './hooks/useConfig'
import './App.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
})

function AppContent() {
  const [showConfig, setShowConfig] = useState(false)
  const { data: health } = useHealthCheck()

  return (
    <div className="app">
      <header className="app-header">
        <h1>MCP Chatbot</h1>
        <div className="header-actions">
          <div className="health-indicator">
            {health?.status === 'healthy' ? (
              <span className="status-healthy">● Connected</span>
            ) : (
              <span className="status-unhealthy">● Disconnected</span>
            )}
          </div>
          <button onClick={() => setShowConfig(!showConfig)}>
            {showConfig ? 'Chat' : 'Settings'}
          </button>
        </div>
      </header>

      <main className="app-main">
        {showConfig ? <ConfigPanel /> : <ChatInterface />}
      </main>

      <footer className="app-footer">
        <p>MCP-Enabled Chatbot v1.0.0</p>
      </footer>
    </div>
  )
}

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
