import { useState } from 'react'

interface Props { onDone: () => void }

export default function ApiKeySetup({ onDone }: Props) {
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!key.trim()) return
    setLoading(true); setError('')
    const result = await window.sentinel.setApiKey(key.trim())
    setLoading(false)
    if (result.ok) { onDone() }
    else { setError(result.error || 'Invalid key') }
  }

  return (
    <div className="overlay">
      <div className="setup-panel">
        <h2>🛡️ Sentinel AI</h2>
        <p>
          Enter your <strong>OpenCode Zen</strong> API key to get started.<br />
          Get one at <a href="https://opencode.ai/auth" target="_blank" rel="noreferrer">opencode.ai/auth</a>
        </p>
        <input
          className="setup-input"
          type="password"
          placeholder="zen-••••••••••••••••••"
          value={key}
          onChange={e => setKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          autoFocus
        />
        <div className="setup-error">{error}</div>
        <button className="setup-btn" onClick={submit} disabled={loading || !key.trim()}>
          {loading ? 'Validating…' : 'Connect'}
        </button>
        <div className="setup-link">
          <a href="https://opencode.ai/auth" target="_blank" rel="noreferrer">
            Get your API key →
          </a>
        </div>
      </div>
    </div>
  )
}
