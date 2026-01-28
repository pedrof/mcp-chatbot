# MCP-Enabled Chatbot

A production-grade web application that enables conversational interaction with configurable LLM backends while supporting Model Context Protocol (MCP) servers for extended capabilities. Built with TypeScript, React, and Express, designed for air-gap compatibility.

## Features

### Core Features (Complete ✅)
- ✅ **Configurable LLM Backend** - Works with any OpenAI-compatible endpoint (OpenAI, Ollama, vLLM, LocalAI, Azure OpenAI, AWS Bedrock, etc.)
- ✅ **Real-time Chat Interface** - Clean, modern UI with Server-Sent Events (SSE) streaming
- ✅ **Persistent Chat History** - Chat messages preserved when navigating between pages
- ✅ **MCP Server Integration** - Full support for stdio and HTTP/SSE MCP servers
- ✅ **Automatic Tool Execution** - MCP tools automatically called during chat conversations
- ✅ **Automatic Chart Visualization** - Interactive charts automatically generated from MCP tool data
- ✅ **Intelligent Data Presentation** - Smart metric selection based on user queries
- ✅ **Garmin Health Integration** - Built-in support for Garmin health data via MCP
- ✅ **Persistent Configuration** - SQLite database with encrypted API keys
- ✅ **Health Monitoring** - Real-time connection status indicators
- ✅ **TobyAI Branding** - Professional logo integration throughout the application
- ✅ **Air-Gap Ready** - All assets bundled, no CDN dependencies
- ✅ **Comprehensive Testing** - 27/27 tests passing with real components (no mocks)
- ✅ **Container Support** - Full Podman/Docker support for easy deployment

### Coming Soon
- 🚧 **Advanced MCP Configuration** - UI for managing multiple MCP servers
- 🚧 **Server Health Monitoring** - Real-time MCP server status indicators
- 🚧 **Tool Discovery UI** - Browse and test available MCP tools
- 🚧 **Production Optimizations** - Performance tuning and monitoring

## Architecture

```
mcp-chatbot/
├── backend/          # Express.js API server
│   ├── src/
│   │   ├── api/      # REST API endpoints
│   │   ├── services/ # Business logic
│   │   ├── db/       # Database layer
│   │   └── tests/    # Integration tests
│   └── package.json
├── frontend/         # React + Vite UI
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── hooks/       # Custom React hooks
│   │   └── services/    # API client
│   └── package.json
├── shared/           # Shared TypeScript types
└── package.json      # Root workspace config
```

## Prerequisites

### Option 1: Containers (Recommended - No Node.js Installation Required!)

- **Podman** or **Docker** (with compose plugin)
- **LLM Endpoint** (Ollama, vLLM, or any OpenAI-compatible API)

See [PODMAN.md](PODMAN.md) for detailed container setup instructions.

### Option 2: Local Development

- **Node.js** 22+ (for development)
- **npm** or **pnpm** (package manager)
- **LLM Endpoint** (Ollama, vLLM, or any OpenAI-compatible API)

## Quick Start

### Option A: Using Podman/Docker (No Node.js Installation!)

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Edit .env and set APP_SECRET (at least 32 characters)
nano .env

# 3. Start with Podman
podman-compose up --build

# Or with Docker
docker-compose up --build

# 4. Open http://localhost:5173
```

**That's it!** See [PODMAN.md](PODMAN.md) for more details.

## Recent Improvements

### December 2024
- ✅ **All Tests Passing** - Fixed 4 test failures, now 27/27 tests passing
  - Fixed MCPService import error (vitest vs jest)
  - Fixed LLM error message test expectations
  - Fixed SSE integration tests with proper MockResponse implementation
  - Fixed MCPService tool response timing issue
- ✅ **Persistent Chat History** - Chat messages now preserved when navigating between Settings/About pages
- ✅ **Code Quality** - Refactored for DRY principles:
  - Extracted chart patterns to centralized configuration module
  - Consolidated CSS animations with CSS variables
  - Extracted magic numbers to named constants
  - Improved MockResponse class with proper header handling

### Option B: Local Development (Requires Node.js)

#### 1. Install Dependencies

```bash
# Install all workspace dependencies
npm install
```

#### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and set APP_SECRET (must be at least 32 characters)
nano .env
```

**Important:** Change `APP_SECRET` to a secure random string!

#### 3. Start Development Servers

```bash
# Start both backend and frontend in development mode
npm run dev
```

This will start:
- Backend API server on http://localhost:3000
- Frontend dev server on http://localhost:5173

#### 4. Configure LLM Endpoint

1. Open http://localhost:5173 in your browser
2. Click "Settings" in the top right
3. Configure your LLM endpoint:
   - **For Ollama**: `http://localhost:11434/v1`
   - **For vLLM**: `http://localhost:8000/v1`
   - **For OpenAI**: `https://api.openai.com/v1` (requires API key)

4. Enter the model name (e.g., `llama2`, `mistral`, `gpt-4`)
5. Click "Save Configuration"

#### 5. Start Chatting!

Switch back to "Chat" view and start a conversation!

#### 6. Automatic Chart Visualization

When you request data from MCP tools (e.g., "Show me my steps for the last 7 days"), the chatbot will:

- **Automatically detect chart-worthy data** in MCP tool responses
- **Intelligently select relevant metrics** based on your query
- **Generate interactive charts** using Recharts library
- **Provide concise summaries** without overwhelming data tables

The system analyzes your question to show only the metrics you asked for:
- "Show my heart rate" → displays only heart rate data
- "How many steps?" → displays only step count
- "My activity summary" → displays multiple relevant metrics

## LLM Setup Examples

### Ollama (Local)

```bash
# Install Ollama from https://ollama.ai
# Pull a model
ollama pull llama2

# Ollama runs on http://localhost:11434 by default
```

**Configuration:**
- Base URL: `http://localhost:11434/v1`
- Model: `llama2`
- API Key: (leave empty)

### vLLM (Local)

```bash
# Install vLLM
pip install vllm

# Start server with a model
python -m vllm.entrypoints.openai.api_server \
  --model mistralai/Mistral-7B-Instruct-v0.2 \
  --port 8000
```

**Configuration:**
- Base URL: `http://localhost:8000/v1`
- Model: `mistralai/Mistral-7B-Instruct-v0.2`
- API Key: (leave empty)

### OpenAI (Cloud)

**Configuration:**
- Base URL: `https://api.openai.com/v1`
- Model: `gpt-4` or `gpt-3.5-turbo`
- API Key: Your OpenAI API key

## Development

### Run Tests

```bash
# Run all tests (27/27 passing ✅)
npm test

# Run tests in container
podman exec -it mcp-chatbot-backend npm test

# Run integration tests
npm run test:integration --workspace=backend

# Watch mode
npm run test:watch --workspace=backend
```

**Test Coverage:**
- ✅ LLMService: 11/11 tests passing
- ✅ MCPService: 12/12 tests passing
- ✅ Chat Integration: 4/4 tests passing
- ✅ Total: 27/27 tests passing

### Build for Production

```bash
# Build all workspaces
npm run build

# Start production server
cd backend
npm start
```

### Project Structure

- **Backend** (`backend/`):
  - `src/api/` - HTTP route handlers
  - `src/services/llm/` - LLM integration with OpenAI SDK
  - `src/services/config/` - Configuration management
  - `src/db/` - SQLite database schema and repository
  - `src/tests/` - Integration tests

- **Frontend** (`frontend/`):
  - `src/components/chat/` - Chat interface components
  - `src/components/config/` - Configuration UI
  - `src/hooks/` - React hooks for API integration
  - `src/services/` - API client with SSE support

- **Shared** (`shared/`):
  - `types/` - TypeScript type definitions shared between frontend and backend

## API Endpoints

### Health Check
```
GET /api/health
```

### Configuration
```
GET    /api/config          # Get all configuration
PUT    /api/config/llm      # Update LLM configuration
GET    /api/config/mcp      # Get MCP servers
POST   /api/config/mcp      # Add MCP server
DELETE /api/config/mcp/:id  # Delete MCP server
PATCH  /api/config/mcp/:id/toggle  # Toggle MCP server
```

### Chat
```
POST /api/chat  # Send message (returns SSE stream)
```

## Testing Strategy

This project follows a **TDD approach without mocks**:

- **LLM Testing**: Uses `TestLLMServer` - a real Express server that mimics OpenAI API
- **MCP Testing**: Uses `TestMCPServer` - generates real MCP servers for stdio protocol testing
- **Database Testing**: Uses in-memory SQLite (`:memory:`)
- **Integration Tests**: Test complete flows with real components
- **No Mocking**: All tests use real implementations
- **Current Status**: 27/27 tests passing ✅

### Example Test

```typescript
test('chat with LLM', async () => {
  // Start real test LLM server
  const testLLM = new TestLLMServer()
  await testLLM.start()

  // Configure real LLM service
  const llmService = new LLMService({ baseURL: testLLM.url, model: 'test' })

  // Test real chat flow
  const response = await llmService.chat([
    { role: 'user', content: 'Hello' }
  ])

  expect(response.message.role).toBe('assistant')
})
```

## Security

- **API Keys**: Encrypted with AES-256-CBC using `APP_SECRET`
- **Input Validation**: All inputs validated with Zod schemas
- **CORS**: Configurable allowed origins
- **Command Injection**: MCP server commands validated against whitelist
- **Database**: SQLite file with 600 permissions

## Air-Gap Deployment

This application is designed for air-gap environments:

1. **No CDN Dependencies**: All assets bundled in build
2. **SQLite Database**: No network database required
3. **Local LLM Support**: Works with locally-hosted models
4. **Offline-First**: No external API calls required

### Deployment Package

```bash
# Build everything
npm run build

# Create deployment package
tar -czf mcp-chatbot.tar.gz \
  backend/dist \
  backend/package.json \
  backend/node_modules \
  frontend/dist \
  .env.example \
  README.md

# Deploy to air-gap system
scp mcp-chatbot.tar.gz user@airgap-system:/opt/
```

## Kubernetes Deployment (GitOps)

For production deployment to K3s Kubernetes cluster using ArgoCD and Gitea:

**Quick Start:**
```bash
# See DEPLOYMENT_QUICKSTART.md for 5-minute deployment guide
cat DEPLOYMENT_QUICKSTART.md
```

**Full Documentation:**
- [DEPLOYMENT.md](DEPLOYMENT.md) - Complete GitOps deployment guide
- [DEPLOYMENT_QUICKSTART.md](DEPLOYMENT_QUICKSTART.md) - Fast-track deployment

**Key Features:**
- GitOps with ArgoCD
- Sealed Secrets for sensitive data
- Cilium Ingress with Let's Encrypt TLS
- Separate backend/frontend deployments
- Persistent storage for SQLite database
- MCP server communication via internal cluster DNS
- Automated builds and deployments via Makefile

**Quick Deploy:**
```bash
# Build and push container images
make deploy

# Create sealed secret
make kube-create-secret

# Deploy via ArgoCD
kubectl apply -f argocd/mcp-chatbot-application.yaml
argocd app sync mcp-chatbot
```

**Architecture:**
```
Cilium Ingress (10.10.10.200)
    ├─ / → Frontend (Nginx + React)
    └─ /api → Backend (Express.js)
        └─ MCP Servers (internal cluster DNS)
```

**Access:** https://mcp-chatbot.local.shadyknollcave.io

## Troubleshooting

### Backend won't start
- Check `APP_SECRET` is set in `.env` and is at least 32 characters
- Ensure port 3000 is available

### Frontend can't connect to backend
- Verify backend is running on http://localhost:3000
- Check CORS settings in `.env` (FRONTEND_URL)

### LLM connection failed
- Verify LLM server is running
- Check Base URL is correct (include `/v1` suffix for most servers)
- Test endpoint directly: `curl http://localhost:11434/v1/models`

### Database errors
- Ensure `data/` directory exists and is writable
- Check SQLite database isn't corrupted: `sqlite3 data/config.db .tables`

## Contributing

This project follows clean architecture principles:
- **SOLID** principles throughout
- **Separation of concerns** (presentation, business logic, data access)
- **Dependency injection** for testability
- **Integration tests** over unit tests
- **No mocks** in testing

## License

MIT

## Roadmap

- [x] Phase 1: Core infrastructure & basic chat ✅
- [x] Phase 2: MCP stdio integration ✅
- [x] Phase 3: MCP HTTP/SSE integration ✅
- [x] Phase 4: Configuration management UI ✅
- [x] Phase 5: Tool execution in chat flow ✅
- [x] Phase 6: Chart visualization & data presentation ✅
- [x] Phase 7: Garmin health data integration ✅
- [ ] Phase 8: Advanced MCP management UI
- [ ] Phase 9: Production optimizations & monitoring

## Credits

Built with:
- [Model Context Protocol](https://modelcontextprotocol.io) - MCP SDK
- [OpenAI SDK](https://github.com/openai/openai-node) - LLM integration
- [React](https://react.dev) - UI framework
- [Express](https://expressjs.com) - API server
- [Vite](https://vitejs.dev) - Build tool
- [Recharts](https://recharts.org) - Chart visualization
- [TanStack Query](https://tanstack.com/query) - State management
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - Database
