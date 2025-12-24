import { useState, useEffect, FormEvent } from 'react'
import { useConfig } from '../../hooks/useConfig'
import type { LLMConfig as LLMConfigType } from '../../../../shared/types'

export function LLMConfig() {
  const { config, updateLLM, isUpdating } = useConfig()

  const [formData, setFormData] = useState<LLMConfigType>({
    baseURL: 'http://localhost:11434/v1',
    apiKey: '',
    model: 'llama2',
    temperature: 0.7,
    maxTokens: undefined
  })

  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Update form when config loads or changes
  useEffect(() => {
    if (config?.llm) {
      setFormData({
        baseURL: config.llm.baseURL,
        apiKey: config.llm.apiKey || '',
        model: config.llm.model,
        temperature: config.llm.temperature ?? 0.7,
        maxTokens: config.llm.maxTokens
      })
    }
  }, [config])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setMessage(null)

    try {
      await updateLLM(formData)
      setMessage({ type: 'success', text: 'LLM configuration saved successfully' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  return (
    <div className="llm-config">
      <h3>LLM Configuration</h3>

      {config?.llm && (
        <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
          <strong>Current Configuration:</strong> {config.llm.baseURL} / {config.llm.model}
          <br />
          <small>Edit the form below to update your settings</small>
        </div>
      )}

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="baseURL">Base URL</label>
          <input
            id="baseURL"
            type="url"
            value={formData.baseURL}
            onChange={(e) => setFormData({ ...formData, baseURL: e.target.value })}
            placeholder="http://localhost:11434/v1"
            required
          />
          <small>OpenAI-compatible endpoint (Ollama, vLLM, LocalAI, etc.)</small>
        </div>

        <div className="form-group">
          <label htmlFor="apiKey">API Key (optional)</label>
          <input
            id="apiKey"
            type="password"
            value={formData.apiKey}
            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
            placeholder="sk-..."
          />
          <small>Leave empty if not required</small>
        </div>

        <div className="form-group">
          <label htmlFor="model">Model</label>
          <input
            id="model"
            type="text"
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            placeholder="llama2"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="temperature">Temperature</label>
          <input
            id="temperature"
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={formData.temperature}
            onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="maxTokens">Max Tokens (optional)</label>
          <input
            id="maxTokens"
            type="number"
            min="1"
            value={formData.maxTokens || ''}
            onChange={(e) => setFormData({
              ...formData,
              maxTokens: e.target.value ? parseInt(e.target.value) : undefined
            })}
            placeholder="Leave empty for default"
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="submit" disabled={isUpdating}>
            {isUpdating ? 'Saving...' : 'Save Configuration'}
          </button>

          {config?.llm && (
            <button
              type="button"
              onClick={() => {
                setFormData({
                  baseURL: 'http://host.docker.internal:11434/v1',
                  apiKey: '',
                  model: 'llama2',
                  temperature: 0.7,
                  maxTokens: undefined
                })
                setMessage(null)
              }}
              style={{ backgroundColor: '#6b7280' }}
            >
              Reset to Ollama Defaults
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
