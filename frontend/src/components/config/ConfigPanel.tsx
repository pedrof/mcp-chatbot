import { useState } from 'react'
import { LLMConfig } from './LLMConfig'
import { MCPServerConfig } from './MCPServerConfig'

export function ConfigPanel() {
  const [activeTab, setActiveTab] = useState<'llm' | 'mcp'>('llm')

  return (
    <div className="config-panel">
      <div className="config-header">
        <h2>Settings</h2>
      </div>

      <div className="config-tabs">
        <button
          className={activeTab === 'llm' ? 'active' : ''}
          onClick={() => setActiveTab('llm')}
        >
          LLM Configuration
        </button>
        <button
          className={activeTab === 'mcp' ? 'active' : ''}
          onClick={() => setActiveTab('mcp')}
        >
          MCP Servers
        </button>
      </div>

      <div className="config-content">
        {activeTab === 'llm' && <LLMConfig />}
        {activeTab === 'mcp' && <MCPServerConfig />}
      </div>
    </div>
  )
}
