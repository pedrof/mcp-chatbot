import { useState, FormEvent } from 'react'
import { useConfig } from '../../hooks/useConfig'
import type { MCPServerRequest } from '../../../../shared/types'

export function MCPServerConfig() {
  const { config, addMCPServer, deleteMCPServer, toggleMCPServer, isUpdating } = useConfig()

  const [showForm, setShowForm] = useState(false)
  const [serverType, setServerType] = useState<'stdio' | 'http'>('stdio')
  const [formData, setFormData] = useState<MCPServerRequest>({
    name: '',
    type: 'stdio',
    config: {
      command: '',
      args: []
    }
  })
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setMessage(null)

    try {
      await addMCPServer(formData)
      setMessage({ type: 'success', text: 'MCP server added successfully' })
      setShowForm(false)
      setFormData({
        name: '',
        type: 'stdio',
        config: { command: '', args: [] }
      })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this MCP server?')) {
      try {
        await deleteMCPServer(id)
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message })
      }
    }
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleMCPServer({ id, enabled })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  return (
    <div className="mcp-server-config">
      <div className="section-header">
        <h3>MCP Servers</h3>
        <button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add Server'}
        </button>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mcp-form">
          <div className="form-group">
            <label>Server Type</label>
            <select
              value={serverType}
              onChange={(e) => {
                const type = e.target.value as 'stdio' | 'http'
                setServerType(type)
                setFormData({
                  ...formData,
                  type,
                  config: type === 'stdio'
                    ? { command: '', args: [] }
                    : { url: '', headers: {} }
                })
              }}
            >
              <option value="stdio">stdio (Local Process)</option>
              <option value="http">HTTP (Remote Server)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          {serverType === 'stdio' && (
            <>
              <div className="form-group">
                <label htmlFor="command">Command</label>
                <input
                  id="command"
                  type="text"
                  value={(formData.config as any).command || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    config: { ...formData.config, command: e.target.value }
                  })}
                  placeholder="npx"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="args">Arguments (one per line)</label>
                <textarea
                  id="args"
                  value={((formData.config as any).args || []).join('\n')}
                  onChange={(e) => setFormData({
                    ...formData,
                    config: {
                      ...formData.config,
                      args: e.target.value.split('\n').filter(a => a.trim())
                    }
                  })}
                  placeholder="-y&#10;@modelcontextprotocol/server-filesystem&#10;/path/to/dir"
                  rows={4}
                />
              </div>
            </>
          )}

          {serverType === 'http' && (
            <div className="form-group">
              <label htmlFor="url">URL</label>
              <input
                id="url"
                type="url"
                value={(formData.config as any).url || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  config: { ...formData.config, url: e.target.value }
                })}
                placeholder="http://localhost:8080/mcp"
                required
              />
            </div>
          )}

          <button type="submit" disabled={isUpdating}>
            {isUpdating ? 'Adding...' : 'Add Server'}
          </button>
        </form>
      )}

      <div className="mcp-server-list">
        {config?.mcpServers && config.mcpServers.length === 0 && (
          <p className="empty-state">No MCP servers configured</p>
        )}

        {config?.mcpServers?.map((server) => (
          <div key={server.id} className="mcp-server-item">
            <div className="server-info">
              <div className="server-name">{server.name}</div>
              <div className="server-type">{server.type}</div>
              {server.type === 'stdio' && (
                <div className="server-command">
                  {(server.config as any).command} {((server.config as any).args || []).join(' ')}
                </div>
              )}
              {server.type === 'http' && (
                <div className="server-url">{(server.config as any).url}</div>
              )}
            </div>
            <div className="server-actions">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={server.enabled}
                  onChange={(e) => handleToggle(server.id, e.target.checked)}
                />
                <span>{server.enabled ? 'Enabled' : 'Disabled'}</span>
              </label>
              <button
                onClick={() => handleDelete(server.id)}
                className="btn-danger"
                disabled={isUpdating}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
