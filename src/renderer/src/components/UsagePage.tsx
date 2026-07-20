import { useEffect } from 'react'
import type { TokenUsage } from './MainArea'

interface Props {
  usage: TokenUsage | null
  onBack: () => void
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function severity(pct: number): 'ok' | 'warn' | 'danger' | 'critical' {
  if (pct >= 95) return 'critical'
  if (pct >= 80) return 'danger'
  if (pct >= 60) return 'warn'
  return 'ok'
}

const SEV_COLOR: Record<string, string> = {
  ok:       'var(--green)',
  warn:     'var(--yellow)',
  danger:   'var(--red)',
  critical: 'var(--red)',
}

const SEV_LABEL: Record<string, string> = {
  ok:       'Good',
  warn:     'Getting Full',
  danger:   'Nearly Full',
  critical: '⚠ Almost Exhausted',
}

export default function UsagePage({ usage, onBack }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onBack()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onBack])

  if (!usage) {
    return (
      <div className="usage-page">
        <div className="col-header">
          <h3>📊 AI Model Usage</h3>
          <span className="col-hint">Escape to back</span>
        </div>
        <div className="usage-empty">
          <span className="usage-empty-icon">📊</span>
          <p>No model usage recorded in this session.</p>
          <p className="usage-empty-sub">Start a conversation with the assistant to track token and context usage details.</p>
        </div>
      </div>
    )
  }

  const { promptTokens, completionTokens, totalTokens, contextLimit } = usage
  const remaining = contextLimit - totalTokens
  const pct = Math.min(100, (totalTokens / contextLimit) * 100)
  const sev = severity(pct)
  const color = SEV_COLOR[sev]
  const isCritical = sev === 'critical'

  return (
    <div className="usage-page">
      <div className="col-header">
        <h3>📊 AI Model Usage</h3>
        <span className="col-hint">Escape to back</span>
      </div>

      <div className="usage-content-card">
        <div className="usage-summary-section">
          <div className="usage-percentage-large" style={{ color }}>
            {pct.toFixed(1)}%
            <span className="usage-percentage-sub">of context used</span>
          </div>
          <span className={`ctx-severity-badge sev-${sev}`} style={{ borderColor: color, color }}>
            {SEV_LABEL[sev]}
          </span>
        </div>

        <div className="usage-progress-bar-container">
          <div className="usage-progress-track">
            <div
              className={`usage-progress-fill ${isCritical ? 'pulse-fill' : ''}`}
              style={{ width: `${pct}%`, background: color }}
            />
          </div>
        </div>

        <div className="usage-stats-grid">
          <div className="usage-stat-box">
            <span className="usage-stat-label">Total Tokens Used</span>
            <span className="usage-stat-value">{fmt(totalTokens)}</span>
          </div>
          
          <div className="usage-stat-box">
            <span className="usage-stat-label">Model Context Limit</span>
            <span className="usage-stat-value">{fmt(contextLimit)}</span>
          </div>

          <div className="usage-stat-box">
            <span className="usage-stat-label">Remaining Tokens</span>
            <span className="usage-stat-value" style={{ color }}>{fmt(remaining)}</span>
          </div>

          <div className="usage-stat-box">
            <span className="usage-stat-label">Prompt Tokens</span>
            <span className="usage-stat-value">{fmt(promptTokens)}</span>
          </div>

          <div className="usage-stat-box">
            <span className="usage-stat-label">Response Tokens</span>
            <span className="usage-stat-value">{fmt(completionTokens)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
