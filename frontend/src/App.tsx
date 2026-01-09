import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { ChatInterface } from './components/chat/ChatInterface'
import { ConfigPanel } from './components/config/ConfigPanel'
import { About } from './components/common/About'
import { ToolDiscoveryPanel } from './components/discovery/ToolDiscoveryPanel'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AuthPage } from './components/auth/AuthPage'
import { useHealthCheck } from './hooks/useConfig'
import { apiClient } from './services/api'
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
  const [currentView, setCurrentView] = useState<'chat' | 'config' | 'discovery' | 'about'>('chat')
  const { data: health } = useHealthCheck()
  const { user, token, logout, isLoading } = useAuth()

  // Update API client token when auth changes
  useEffect(() => {
    apiClient.setToken(token)
  }, [token])

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="app" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ color: '#00ffff', fontSize: '1.2rem' }}>Loading...</div>
      </div>
    )
  }

  // Show login page if not authenticated
  if (!user) {
    return <AuthPage />
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <img src="/logo.png" alt="TobyAI Logo" className="app-logo" />
          <h1>MCP Chatbot</h1>
        </div>
        <div className="header-actions">
          <div className="health-indicator">
            {health?.status === 'healthy' ? (
              <span className="status-healthy">● Connected</span>
            ) : (
              <span className="status-unhealthy">● Disconnected</span>
            )}
          </div>
          <button onClick={() => setCurrentView('chat')} className={currentView === 'chat' ? 'active' : ''}>
            Chat
          </button>
          <button onClick={() => setCurrentView('discovery')} className={currentView === 'discovery' ? 'active' : ''}>
            Discovery
          </button>
          <button onClick={() => setCurrentView('config')} className={currentView === 'config' ? 'active' : ''}>
            Settings
          </button>
          <button onClick={() => setCurrentView('about')} className={currentView === 'about' ? 'active' : ''}>
            About
          </button>
          <div className="user-profile">
            <span className="username">👤 {user.username}</span>
            <button onClick={logout} className="logout-button" title="Logout">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div style={{ display: currentView === 'chat' ? 'flex' : 'none', width: '100%', height: '100%', flexDirection: 'column' }}>
          <ChatInterface />
        </div>
        <div style={{ display: currentView === 'discovery' ? 'flex' : 'none', width: '100%', height: '100%', flexDirection: 'column' }}>
          <ToolDiscoveryPanel />
        </div>
        <div style={{ display: currentView === 'config' ? 'flex' : 'none', width: '100%', height: '100%', flexDirection: 'column' }}>
          <ConfigPanel />
        </div>
        <div style={{ display: currentView === 'about' ? 'flex' : 'none', width: '100%', height: '100%', flexDirection: 'column' }}>
          <About />
        </div>
      </main>

      <footer className="app-footer">
        <img src="/logo.png" alt="TobyAI Logo" className="footer-logo" />
        <p>MCP-Enabled Chatbot v1.0.0</p>
      </footer>
    </div>
  )
}

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <AppContent />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
