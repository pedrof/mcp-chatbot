import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { apiClient } from '../../services/api'
import './ToolDiscoveryPanel.css'

interface MCPServerTemplate {
  id: string
  name: string
  description: string
  category: string
  type: 'stdio' | 'http'
  stdio?: {
    command: string
    args: string[]
    description: string
    packageName?: string
  }
  http?: {
    defaultUrl: string
    requiresAuth?: boolean
  }
  exampleTools?: Array<{
    name: string
    description: string
  }>
  airgapInstructions?: string
}

interface Tool {
  name: string
  description: string
  inputSchema: any
  serverId: string
}

export function ToolDiscoveryPanel() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedServer, setSelectedServer] = useState<MCPServerTemplate | null>(null)
  const [testingTool, setTestingTool] = useState<Tool | null>(null)
  const [testArgs, setTestArgs] = useState<string>('{}')
  const [activeTab, setActiveTab] = useState<'catalog' | 'connected'>('catalog')

  // Fetch server catalog
  const { data: catalog } = useQuery({
    queryKey: ['discovery', 'catalog'],
    queryFn: async () => {
      const response = await fetch('/api/discovery/catalog')
      return response.json()
    }
  })

  // Fetch connected tools
  const { data: connectedTools, refetch: refetchTools } = useQuery({
    queryKey: ['discovery', 'tools'],
    queryFn: async () => {
      const response = await fetch('/api/discovery/tools')
      return response.json()
    },
    enabled: activeTab === 'connected'
  })

  // Test tool mutation
  const testToolMutation = useMutation({
    mutationFn: async ({ serverId, toolName, args }: { serverId: string, toolName: string, args: any }) => {
      const response = await fetch(`/api/discovery/tools/${serverId}/${toolName}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arguments: args })
      })
      return response.json()
    }
  })

  const categories = ['all', 'filesystem', 'database', 'api', 'productivity', 'development', 'custom']

  const filteredServers = catalog?.servers?.filter((server: MCPServerTemplate) => {
    const matchesCategory = selectedCategory === 'all' || server.category === selectedCategory
    const matchesSearch = !searchQuery ||
      server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  }) || []

  const handleTestTool = async () => {
    if (!testingTool) return

    try {
      const args = JSON.parse(testArgs)
      await testToolMutation.mutateAsync({
        serverId: testingTool.serverId,
        toolName: testingTool.name,
        args
      })
    } catch (error) {
      alert('Invalid JSON in test arguments')
    }
  }

  return (
    <div className="tool-discovery-panel">
      <div className="discovery-header">
        <h2>🔍 Tool Discovery</h2>
        <p>Discover and test MCP servers and tools in your air-gap environment</p>
      </div>

      <div className="discovery-tabs">
        <button
          className={activeTab === 'catalog' ? 'active' : ''}
          onClick={() => setActiveTab('catalog')}
        >
          📚 Server Catalog ({catalog?.count || 0})
        </button>
        <button
          className={activeTab === 'connected' ? 'active' : ''}
          onClick={() => setActiveTab('connected')}
        >
          🔗 Connected Tools ({connectedTools?.totalTools || 0})
        </button>
      </div>

      {activeTab === 'catalog' && (
        <div className="catalog-view">
          <div className="discovery-controls">
            <input
              type="text"
              placeholder="Search servers or tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />

            <div className="category-filters">
              {categories.map(cat => (
                <button
                  key={cat}
                  className={selectedCategory === cat ? 'active' : ''}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="server-grid">
            {filteredServers.map((server: MCPServerTemplate) => (
              <div
                key={server.id}
                className="server-card"
                onClick={() => setSelectedServer(server)}
              >
                <div className="server-header">
                  <h3>{server.name}</h3>
                  <span className={`badge badge-${server.type}`}>{server.type}</span>
                </div>
                <p className="server-description">{server.description}</p>
                <div className="server-category">{server.category}</div>
                {server.exampleTools && (
                  <div className="example-tools">
                    <strong>{server.exampleTools.length} tools</strong>
                    <ul>
                      {server.exampleTools.slice(0, 3).map((tool, idx) => (
                        <li key={idx}>{tool.name}</li>
                      ))}
                      {server.exampleTools.length > 3 && <li>+{server.exampleTools.length - 3} more...</li>}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>

          {selectedServer && (
            <div className="server-detail-modal" onClick={() => setSelectedServer(null)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="close-button" onClick={() => setSelectedServer(null)}>×</button>

                <h2>{selectedServer.name}</h2>
                <p>{selectedServer.description}</p>

                <div className="detail-section">
                  <h3>Type</h3>
                  <span className={`badge badge-${selectedServer.type}`}>{selectedServer.type}</span>
                </div>

                {selectedServer.stdio && (
                  <div className="detail-section">
                    <h3>Command</h3>
                    <pre>{selectedServer.stdio.command} {selectedServer.stdio.args.join(' ')}</pre>
                    {selectedServer.stdio.packageName && (
                      <p className="hint">Package: <code>{selectedServer.stdio.packageName}</code></p>
                    )}
                  </div>
                )}

                {selectedServer.http && (
                  <div className="detail-section">
                    <h3>HTTP Configuration</h3>
                    <p>URL: <code>{selectedServer.http.defaultUrl}</code></p>
                    {selectedServer.http.requiresAuth && (
                      <p className="hint">⚠️ Requires authentication</p>
                    )}
                  </div>
                )}

                {selectedServer.exampleTools && selectedServer.exampleTools.length > 0 && (
                  <div className="detail-section">
                    <h3>Available Tools</h3>
                    <ul className="tool-list">
                      {selectedServer.exampleTools.map((tool, idx) => (
                        <li key={idx}>
                          <strong>{tool.name}</strong> - {tool.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedServer.airgapInstructions && (
                  <div className="detail-section">
                    <h3>Air-Gap Deployment</h3>
                    <div className="airgap-instructions">
                      {selectedServer.airgapInstructions}
                    </div>
                  </div>
                )}

                <div className="modal-actions">
                  <button onClick={() => {
                    // Copy configuration to clipboard
                    const config = selectedServer.stdio
                      ? `Command: ${selectedServer.stdio.command}\nArgs: ${selectedServer.stdio.args.join(' ')}`
                      : `URL: ${selectedServer.http?.defaultUrl}`
                    navigator.clipboard.writeText(config)
                    alert('Configuration copied to clipboard!')
                  }}>
                    📋 Copy Configuration
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'connected' && (
        <div className="connected-view">
          {connectedTools && connectedTools.totalTools > 0 ? (
            <>
              <div className="connected-stats">
                <div className="stat">
                  <strong>{connectedTools.connectedServers}</strong>
                  <span>Connected Servers</span>
                </div>
                <div className="stat">
                  <strong>{connectedTools.totalTools}</strong>
                  <span>Available Tools</span>
                </div>
              </div>

              <div className="tools-by-server">
                {Object.entries(connectedTools.toolsByServer || {}).map(([serverId, tools]: [string, any]) => (
                  <div key={serverId} className="server-tools-section">
                    <h3>📦 {serverId}</h3>
                    <div className="tool-cards">
                      {tools.map((tool: any) => (
                        <div key={tool.name} className="tool-card">
                          <div className="tool-header">
                            <h4>{tool.name}</h4>
                            <button
                              onClick={() => {
                                setTestingTool({ ...tool, serverId })
                                setTestArgs(JSON.stringify(tool.inputSchema?.properties || {}, null, 2))
                              }}
                              className="test-button"
                            >
                              🧪 Test
                            </button>
                          </div>
                          <p>{tool.description}</p>
                          {tool.inputSchema && (
                            <details className="schema-details">
                              <summary>View Schema</summary>
                              <pre>{JSON.stringify(tool.inputSchema, null, 2)}</pre>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>No MCP servers connected yet.</p>
              <p>Configure servers in Settings to see available tools here.</p>
            </div>
          )}

          {testingTool && (
            <div className="tool-test-modal" onClick={() => setTestingTool(null)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="close-button" onClick={() => setTestingTool(null)}>×</button>

                <h2>🧪 Test Tool: {testingTool.name}</h2>
                <p>{testingTool.description}</p>

                <div className="test-form">
                  <label>Arguments (JSON)</label>
                  <textarea
                    value={testArgs}
                    onChange={(e) => setTestArgs(e.target.value)}
                    rows={10}
                    className="json-editor"
                  />

                  <button onClick={handleTestTool} disabled={testToolMutation.isPending}>
                    {testToolMutation.isPending ? 'Testing...' : 'Execute Test'}
                  </button>
                </div>

                {testToolMutation.data && (
                  <div className={`test-result ${testToolMutation.data.success ? 'success' : 'error'}`}>
                    <h3>Result:</h3>
                    <pre>{JSON.stringify(testToolMutation.data, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
