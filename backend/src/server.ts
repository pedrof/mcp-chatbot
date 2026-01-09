import express from 'express'
import cors from 'cors'
import { config as dotenvConfig } from 'dotenv'
import path from 'path'
import { initializeDatabase } from './db/schema.js'
import { Repository } from './db/repository.js'
import { EncryptionService } from './services/config/EncryptionService.js'
import { ConfigService } from './services/config/ConfigService.js'
import { LLMService } from './services/llm/LLMService.js'
import { MCPService } from './services/mcp/MCPService.js'
import { AuthService } from './services/auth/AuthService.js'
import { ChatAPI } from './api/chat.js'
import { ConfigAPI } from './api/config.js'
import { HealthAPI } from './api/health.js'
import { MCPAPI } from './api/mcp.js'
import { DiscoveryAPI } from './api/discovery.js'
import { AuthAPI } from './api/auth.js'
import { createAuthMiddleware } from './middleware/auth.js'

// Load environment variables
dotenvConfig()

const PORT = process.env.PORT || 3000
const APP_SECRET = process.env.APP_SECRET
const JWT_SECRET = process.env.JWT_SECRET || APP_SECRET // Use APP_SECRET as fallback
const DATABASE_PATH = process.env.DATABASE_PATH || './data/config.db'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

if (!APP_SECRET) {
  console.error('ERROR: APP_SECRET environment variable is required')
  process.exit(1)
}

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('ERROR: JWT_SECRET must be at least 32 characters long')
  process.exit(1)
}

// Initialize services
const db = initializeDatabase(DATABASE_PATH)
const encryption = new EncryptionService(APP_SECRET)
const repository = new Repository(db, encryption)
const configService = new ConfigService(repository)
const authService = new AuthService(JWT_SECRET)

// Initialize MCP service
const mcpService = new MCPService(configService)

// Initialize LLM service (will be configured per-user)
const llmService = new LLMService(undefined)

// Initialize API handlers
const authAPI = new AuthAPI(db, authService)
const chatAPI = new ChatAPI(llmService, mcpService, configService)
const configAPI = new ConfigAPI(configService, llmService, mcpService)
const healthAPI = new HealthAPI(llmService, configService, mcpService)
const mcpAPI = new MCPAPI(mcpService)
const discoveryAPI = new DiscoveryAPI(mcpService)

// Create auth middleware
const authMiddleware = createAuthMiddleware(authService)

// Create Express app
const app = express()

// Middleware
app.use(cors({
  origin: FRONTEND_URL.split(','),
  credentials: true
}))
app.use(express.json())

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`)
  next()
})

// Public routes (no authentication required)
app.get('/api/health', (req, res) => healthAPI.check(req, res))
app.post('/api/auth/register', (req, res) => authAPI.register(req, res))
app.post('/api/auth/login', (req, res) => authAPI.login(req, res))

// Protected routes (authentication required)
app.get('/api/auth/me', authMiddleware, (req, res) => authAPI.me(req, res))
app.post('/api/auth/change-password', authMiddleware, (req, res) => authAPI.changePassword(req, res))

app.get('/api/config', authMiddleware, (req, res) => configAPI.getConfig(req, res))
app.put('/api/config/llm', authMiddleware, (req, res) => configAPI.updateLLMConfig(req, res))

app.get('/api/config/mcp', authMiddleware, (req, res) => configAPI.getMCPServers(req, res))
app.post('/api/config/mcp', authMiddleware, (req, res) => configAPI.addMCPServer(req, res))
app.delete('/api/config/mcp/:id', authMiddleware, (req, res) => configAPI.deleteMCPServer(req, res))
app.patch('/api/config/mcp/:id/toggle', authMiddleware, (req, res) => configAPI.toggleMCPServer(req, res))

app.get('/api/mcp/tools', authMiddleware, (req, res) => mcpAPI.getTools(req, res))
app.get('/api/mcp/status', authMiddleware, (req, res) => mcpAPI.getStatus(req, res))
app.post('/api/mcp/servers/:id/reconnect', authMiddleware, (req, res) => mcpAPI.reconnectServer(req, res))

app.get('/api/discovery/catalog', authMiddleware, (req, res) => discoveryAPI.getCatalog(req, res))
app.get('/api/discovery/catalog/:id', authMiddleware, (req, res) => discoveryAPI.getServerTemplate(req, res))
app.get('/api/discovery/catalog/category/:category', authMiddleware, (req, res) => discoveryAPI.getServersByCategory(req, res))
app.get('/api/discovery/catalog/search', authMiddleware, (req, res) => discoveryAPI.searchCatalog(req, res))
app.get('/api/discovery/tools', authMiddleware, (req, res) => discoveryAPI.getAvailableTools(req, res))
app.get('/api/discovery/tools/:serverId', authMiddleware, (req, res) => discoveryAPI.getToolsByServer(req, res))
app.post('/api/discovery/tools/:serverId/:toolName/test', authMiddleware, (req, res) => discoveryAPI.testTool(req, res))
app.get('/api/discovery/status', authMiddleware, (req, res) => discoveryAPI.getDiscoveryStatus(req, res))

app.post('/api/chat', authMiddleware, (req, res) => chatAPI.chat(req, res))

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  })
})

// Async startup function
async function startServer() {
  try {
    // Connect to enabled MCP servers
    await mcpService.initialize()
  } catch (error) {
    console.error('Error initializing MCP service:', error)
    // Don't exit - continue without MCP servers
  }

  // Start HTTP server
  const server = app.listen(PORT, () => {
    console.log(`🚀 MCP Chatbot server running on http://localhost:${PORT}`)
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`)
    console.log(`🔐 Multi-tenant authentication enabled`)
    console.log(`📝 Default admin user: username=admin, password=admin123`)
  })

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down gracefully`)

    server.close(async () => {
      console.log('Server closed')

      // Shutdown MCP connections
      await mcpService.shutdown()

      // Close database
      db.close()

      process.exit(0)
    })
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  return server
}

// Start the server
const server = await startServer()

export { app, server }
