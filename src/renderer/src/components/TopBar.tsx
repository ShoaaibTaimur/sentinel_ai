import type { TokenUsage } from './MainArea'
import logoUrl from '../assets/logo.svg'

interface Props {
  model: string
  connected: boolean
  isFullscreen: boolean
  onToggleFullscreen: () => void
  usage: TokenUsage | null
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function severityColor(pct: number): string {
  if (pct >= 95) return 'var(--red)'
  if (pct >= 80) return 'var(--red)'
  if (pct >= 60) return 'var(--yellow)'
  return 'var(--green)'
}

export default function TopBar({ model, connected, isFullscreen, onToggleFullscreen, usage }: Props) {
  const pct = usage ? Math.min(100, (usage.totalTokens / usage.contextLimit) * 100) : 0
  const color = usage ? severityColor(pct) : 'var(--border-bright)'
  const strokeDash = 25.12 // 2 * pi * r (r=4)
  const strokeOffset = strokeDash - (strokeDash * pct) / 100

  return (
    <div className="topbar">
      <div className="topbar-left">
        <img src={logoUrl} className="topbar-logo-img" alt="logo" style={{ width: '18px', height: '18px', marginRight: '6px', filter: 'drop-shadow(0 0 3px var(--accent-dim))' }} />
        <span className="topbar-logo">Sentinel<span>AI</span> <small style={{ fontSize: '9px', opacity: 0.6, marginLeft: '4px', fontWeight: 'normal' }}>v1.0</small></span>
        <span className="topbar-sep">·</span>
        <div className="topbar-provider">
          <span className={`status-dot ${connected ? '' : 'offline'}`} />
          <span>Zen {connected ? '● Connected' : '○ Disconnected'}</span>
        </div>
      </div>

      <div className="topbar-center">
        <div className="topbar-model-badge">
          <span className="topbar-model">{model}</span>
          <div className="model-usage-indicator">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <circle cx="6" cy="6" r="4" className="usage-track" />
              <circle
                cx="6"
                cy="6"
                r="4"
                className="usage-progress"
                style={{
                  strokeDasharray: strokeDash,
                  strokeDashoffset: strokeOffset,
                  stroke: color
                }}
              />
            </svg>
          </div>

          <div className="model-usage-tooltip">
            {usage ? (
              <>
                <div className="tooltip-title">Context Usage</div>
                <div className="tooltip-item">
                  <span>Used:</span>
                  <span style={{ color }}>{pct.toFixed(1)}% ({fmt(usage.totalTokens)})</span>
                </div>
                <div className="tooltip-item">
                  <span>Remaining:</span>
                  <span style={{ color }}>{fmt(usage.contextLimit - usage.totalTokens)}</span>
                </div>
              </>
            ) : (
              <div className="tooltip-empty">No usage this session</div>
            )}
          </div>
        </div>
      </div>

      <div className="topbar-actions">
        <button
          className="win-btn-icon"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen (F11)' : 'Fullscreen (F11)'}
        >
          {isFullscreen ? '⤢' : '⤡'}
        </button>
        <button className="win-btn min" onClick={() => window.sentinel.minimizeWindow()} title="Minimize" />
        <button className="win-btn close" onClick={() => window.sentinel.hideWindow()} title="Hide (Esc)" />
      </div>
    </div>
  )
}
