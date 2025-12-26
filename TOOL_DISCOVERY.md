# Tool Discovery UI for Air-Gap Environments

## Overview

This document describes the implementation of a **Tool Discovery System** designed for air-gap (disconnected) environments where external MCP server registries are not accessible.

## Architecture

### Multi-Layer Discovery System

```
┌─────────────────────────────────────────────┐
│           Air-Gap Environment               │
├─────────────────────────────────────────────┤
│                                             │
│  Layer 1: Pre-Populated Catalog             │
│  ├─ MCPServerCatalog.ts                     │
│  ├─ Built-in server templates               │
│  └─ Can be imported/exported as JSON        │
│                                             │
│  Layer 2: Connected Tools Discovery         │
│  ├─ Query connected MCP servers             │
│  ├─ List available tools                    │
│  └─ Get tool schemas                        │
│                                             │
│  Layer 3: Tool Testing                      │
│  ├─ Test tools with sample inputs           │
│  ├─ Validate tool functionality             │
│  └─ View results before using in chat       │
│                                             │
└─────────────────────────────────────────────┘
```

## Components

### Backend

#### 1. MCPServerCatalog.ts
**Location**: `backend/src/services/mcp/MCPServerCatalog.ts`

**Purpose**: Pre-populated catalog of known MCP servers

**Features**:
- Server templates with configuration details
- Categorization (filesystem, database, API, etc.)
- Example tools for each server
- Air-gap deployment instructions
- Import/Export functionality for sharing configs

**Example Template**:
```typescript
{
  id: 'filesystem',
  name: 'Filesystem Server',
  description: 'Read and write files on the local filesystem',
  category: 'filesystem',
  type: 'stdio',
  stdio: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/path'],
    packageName: '@modelcontextprotocol/server-filesystem'
  },
  exampleTools: [
    { name: 'read_file', description: 'Read contents of a file' },
    { name: 'write_file', description: 'Write contents to a file' }
  ],
  airgapInstructions: 'npm install -g @modelcontextprotocol/server-filesystem'
}
```

#### 2. Discovery API
**Location**: `backend/src/api/discovery.ts`

**Endpoints**:

```
GET  /api/discovery/catalog                    # Get full catalog
GET  /api/discovery/catalog/:id                # Get specific template
GET  /api/discovery/catalog/category/:category # Get servers by category
GET  /api/discovery/catalog/search?q=keyword   # Search catalog
GET  /api/discovery/tools                      # Get connected tools
GET  /api/discovery/tools/:serverId            # Get tools from server
POST /api/discovery/tools/:serverId/:toolName/test  # Test a tool
GET  /api/discovery/status                     # Get discovery stats
```

### Frontend

#### 3. ToolDiscoveryPanel Component
**Location**: `frontend/src/components/discovery/ToolDiscoveryPanel.tsx`

**Features**:

**Tab 1: Server Catalog**
- Browse pre-populated MCP server templates
- Filter by category (filesystem, database, API, etc.)
- Search by keyword
- View server details and configuration
- Copy configuration to clipboard
- Air-gap deployment instructions

**Tab 2: Connected Tools**
- View all tools from connected MCP servers
- Grouped by server
- View tool schemas
- Test tools with custom arguments
- See real-time results

## Usage Scenarios

### Scenario 1: Initial Deployment in Air-Gap Environment

1. **Bundle MCP servers with application**:
   ```bash
   # Pre-install commonly used MCP servers
   npm install -g @modelcontextprotocol/server-filesystem
   npm install -g @modelcontextprotocol/server-sqlite
   npm install -g @modelcontextprotocol/server-git

   # Include in deployment package
   tar -czf mcp-chatbot-airgap.tar.gz \
     mcp-chatbot/ \
     /usr/local/lib/node_modules/@modelcontextprotocol/
   ```

2. **Browse catalog to find needed servers**:
   - User opens Tool Discovery UI
   - Browses by category or searches for functionality
   - Views configuration details

3. **Configure server from template**:
   - Copy command and args from template
   - Go to Settings
   - Add new MCP server with pre-filled config
   - Connect to server

4. **Verify tools are available**:
   - Switch to "Connected Tools" tab
   - See all discovered tools
   - Test tools before using in chat

### Scenario 2: Sharing Configurations Across Teams

**Export custom catalog**:
```typescript
// On System A
const customServers = [
  {
    id: 'custom-internal-api',
    name: 'Internal Company API',
    description: 'Access internal company data',
    type: 'http',
    http: {
      defaultUrl: 'http://internal-api.company.local:8080/mcp',
      requiresAuth: true
    },
    configurationHints: {
      envVars: [
        { name: 'API_TOKEN', description: 'Internal API token', required: true }
      ]
    }
  }
]

// Export to JSON file
const json = JSON.stringify(customServers, null, 2)
// Share via USB drive or secure transfer
```

**Import on System B**:
```typescript
// Import via Discovery API or UI
POST /api/discovery/catalog/import
Body: { servers: [...customServers] }
```

### Scenario 3: Tool Testing Before Production Use

1. **Browse connected tools**
2. **Select a tool to test**
3. **Provide sample arguments**:
   ```json
   {
     "path": "/tmp/test.txt",
     "content": "Hello World"
   }
   ```
4. **Execute test**
5. **View results**:
   ```json
   {
     "success": true,
     "result": {
       "content": [
         { "type": "text", "text": "File written successfully" }
       ]
     }
   }
   ```
6. **Use tool confidently in chat**

## Air-Gap Deployment Strategy

### Pre-Installation Package

Create a complete air-gap deployment package:

```bash
#!/bin/bash
# prepare-airgap-package.sh

# 1. Install common MCP servers globally
npm install -g @modelcontextprotocol/server-filesystem
npm install -g @modelcontextprotocol/server-sqlite
npm install -g @modelcontextprotocol/server-git
npm install -g @modelcontextprotocol/server-fetch

# 2. Build the application
cd mcp-chatbot
npm run build

# 3. Create package with everything needed
tar -czf mcp-chatbot-airgap-complete.tar.gz \
  --transform 's,^,mcp-chatbot/,' \
  backend/dist \
  backend/package.json \
  backend/node_modules \
  frontend/dist \
  /usr/local/lib/node_modules/@modelcontextprotocol \
  PODMAN.md \
  TOOL_DISCOVERY.md \
  .env.example \
  README.md

echo "Air-gap package created: mcp-chatbot-airgap-complete.tar.gz"
echo "Transfer this file to your air-gap environment"
```

### Installation in Air-Gap Environment

```bash
#!/bin/bash
# install-airgap.sh

# 1. Extract package
tar -xzf mcp-chatbot-airgap-complete.tar.gz
cd mcp-chatbot

# 2. Set up environment
cp .env.example .env
nano .env  # Set APP_SECRET

# 3. Restore global MCP servers
mkdir -p /usr/local/lib/node_modules
cp -r usr/local/lib/node_modules/@modelcontextprotocol \
      /usr/local/lib/node_modules/

# 4. Start application
npm start
```

## Extension Points

### Adding Custom MCP Servers to Catalog

```typescript
// In MCPServerCatalog.ts, add to MCP_SERVER_CATALOG array:

{
  id: 'my-custom-server',
  name: 'My Custom MCP Server',
  description: 'Company-specific functionality',
  category: 'custom',
  type: 'stdio',
  stdio: {
    command: 'node',
    args: ['/opt/company/mcp-server.js'],
    description: 'Internal MCP server'
  },
  exampleTools: [
    { name: 'custom_tool', description: 'Does something specific' }
  ],
  airgapInstructions: 'Deploy /opt/company/mcp-server.js from internal repo'
}
```

### Importing External Catalogs

```typescript
// Import additional server templates from JSON file
const externalCatalog = await fetch('/api/discovery/catalog/import', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    servers: [...customServerTemplates]
  })
})
```

## Benefits for Air-Gap Environments

1. **Self-Contained**: No external dependencies or registries needed
2. **Discoverable**: Users can browse available options without internet
3. **Documented**: Each server includes air-gap installation instructions
4. **Testable**: Verify tool functionality before production use
5. **Shareable**: Export/import configurations across systems
6. **Extensible**: Easy to add custom internal MCP servers

## Security Considerations

### In Air-Gap Deployments

1. **Validate MCP Server Sources**:
   - Only include vetted, approved MCP servers in catalog
   - Verify npm package integrity before bundling
   - Code review custom MCP servers

2. **Credential Management**:
   - Don't include credentials in catalog
   - Use environment variables
   - Leverage existing encryption (AES-256-CBC)

3. **Network Isolation**:
   - Stdio servers: Safe (no network access)
   - HTTP servers: Review URL and auth requirements
   - Test tools with non-sensitive data first

## Future Enhancements

1. **Visual Server Builder**: GUI for creating MCP server configs
2. **Automatic Package Detection**: Scan node_modules for MCP servers
3. **Catalog Versioning**: Track catalog updates over time
4. **Tool Usage Analytics**: Track which tools are most used
5. **Configuration Templates**: Save common configurations
6. **Bulk Server Management**: Enable/disable multiple servers at once

## Implementation Status

- ✅ MCPServerCatalog.ts created
- ✅ Discovery API endpoints implemented
- ✅ ToolDiscoveryPanel component created
- ✅ CSS styling completed
- ⏳ API routes need to be registered in main app
- ⏳ Component needs to be added to App.tsx
- ⏳ Testing with real MCP servers
- ⏳ Documentation and examples

## Next Steps

1. Register Discovery API routes in `backend/src/app.ts`
2. Add ToolDiscoveryPanel to `frontend/src/App.tsx`
3. Test with connected MCP servers
4. Create sample custom catalog for sharing
5. Document common deployment scenarios
6. Add to README.md

## Conclusion

This tool discovery system provides a complete solution for managing MCP servers in air-gap environments. By combining:
- Pre-populated catalog of known servers
- Real-time discovery from connected servers
- Tool testing capabilities
- Import/export functionality

Users can effectively discover, configure, test, and use MCP tools without requiring external network access.
