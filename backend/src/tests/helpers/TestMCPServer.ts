import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { MCPTool, MCPToolResult } from '../../../../shared/types/index.js'

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: string
    properties?: Record<string, any>
    required?: string[]
  }
}

/**
 * TestMCPServer creates a real MCP stdio server for testing
 * Following the same pattern as TestLLMServer - real implementations, no mocks
 */
export class TestMCPServer {
  private scriptPath: string
  private tools: ToolDefinition[]
  private toolResponses: Map<string, MCPToolResult> = new Map()
  private defaultResponse: MCPToolResult

  constructor(options?: { tools?: ToolDefinition[] }) {
    this.tools = options?.tools || []
    this.scriptPath = join(tmpdir(), `test-mcp-server-${Date.now()}.js`)

    this.defaultResponse = {
      content: [
        {
          type: 'text',
          text: 'Test tool executed successfully'
        }
      ]
    }
  }

  /**
   * Configure the tools this MCP server should expose
   */
  setTools(tools: ToolDefinition[]): void {
    this.tools = tools
  }

  /**
   * Configure a specific response for a tool call
   */
  setToolResponse(toolName: string, response: MCPToolResult): void {
    this.toolResponses.set(toolName, response)
  }

  /**
   * Set the default response for any tool call
   */
  setDefaultResponse(response: MCPToolResult): void {
    this.defaultResponse = response
  }

  /**
   * Generate and write the MCP server script
   * Returns the command and args needed to run it
   */
  async setup(): Promise<{ command: string; args: string[] }> {
    const serverScript = this.generateMCPServerScript()
    writeFileSync(this.scriptPath, serverScript, 'utf-8')

    return {
      command: 'node',
      args: [this.scriptPath]
    }
  }

  /**
   * Generate a Node.js script that implements the MCP stdio protocol
   */
  private generateMCPServerScript(): string {
    const tools = JSON.stringify(this.tools)
    const toolResponses = JSON.stringify(Object.fromEntries(this.toolResponses))
    const defaultResponse = JSON.stringify(this.defaultResponse)

    return `
// Auto-generated test MCP server
// Implements basic MCP protocol over stdio

const readline = require('readline');

const tools = ${tools};
const toolResponses = ${toolResponses};
const defaultResponse = ${defaultResponse};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Send a JSON-RPC response
function sendResponse(id, result) {
  const response = {
    jsonrpc: '2.0',
    id: id,
    result: result
  };
  console.log(JSON.stringify(response));
}

// Send a JSON-RPC error
function sendError(id, code, message) {
  const response = {
    jsonrpc: '2.0',
    id: id,
    error: {
      code: code,
      message: message
    }
  };
  console.log(JSON.stringify(response));
}

// Handle incoming JSON-RPC requests
rl.on('line', (line) => {
  try {
    const request = JSON.parse(line);

    // Handle initialize
    if (request.method === 'initialize') {
      sendResponse(request.id, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'test-mcp-server',
          version: '1.0.0'
        }
      });
    }
    // Handle tools/list
    else if (request.method === 'tools/list') {
      sendResponse(request.id, {
        tools: tools
      });
    }
    // Handle tools/call
    else if (request.method === 'tools/call') {
      const toolName = request.params.name;
      const toolArgs = request.params.arguments;

      // Check if we have a custom response for this tool
      const response = toolResponses[toolName] || defaultResponse;

      sendResponse(request.id, response);
    }
    // Handle notifications/initialized
    else if (request.method === 'notifications/initialized') {
      // No response needed for notifications
    }
    // Unknown method
    else {
      sendError(request.id, -32601, \`Method not found: \${request.method}\`);
    }
  } catch (error) {
    // Invalid JSON or processing error
    console.error('Error processing request:', error.message);
  }
});

// Handle stdio errors
process.stdin.on('error', (err) => {
  console.error('stdin error:', err);
  process.exit(1);
});

process.stdout.on('error', (err) => {
  console.error('stdout error:', err);
  process.exit(1);
});

// Keep process alive
process.stdin.resume();
`.trim()
  }

  /**
   * Cleanup temporary files
   */
  async cleanup(): Promise<void> {
    if (existsSync(this.scriptPath)) {
      try {
        unlinkSync(this.scriptPath)
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Get the path to the generated script (useful for debugging)
   */
  getScriptPath(): string {
    return this.scriptPath
  }
}
