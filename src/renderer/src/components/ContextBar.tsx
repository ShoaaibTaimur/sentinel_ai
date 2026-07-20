import type { TokenUsage } from './MainArea'

interface Props { usage: TokenUsage | null }

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

export default function ContextBar({ usage }: Props) {
  if (!usage) return null

  const { promptTokens, completionTokens, totalTokens, contextLimit } = usage
  const remaining = contextLimit - totalTokens
  const pct = Math.min(100, (totalTokens / contextLimit) * 100)
  const sev = severity(pct)
  const color = SEV_COLOR[sev]
  const isCritical = sev === 'critical'

  return (
    <div className={`ctx-bar-panel ${sev}`}>
      {/* Main progress bar */}
      <div className="ctx-progress-track">
        <div
          className={`ctx-progress-fill ${isCritical ? 'pulse-fill' : ''}`}
          style={{ width: `${pct}%`, background: color }}
        />
      </div>

      {/* Stats row */}
      <div className="ctx-stats-row">
        <div className="ctx-stat-group">
          <span className="ctx-stat-label">Context</span>
          <span className="ctx-stat-value" style={{ color }}>
            {fmt(totalTokens)} / {fmt(contextLimit)}
          </span>
          <span className={`ctx-severity-badge sev-${sev}`}>{SEV_LABEL[sev]}</span>
        </div>

        <div className="ctx-stat-group ctx-center">
          <div className="ctx-mini-stats">
            <span className="ctx-mini-item">
              <span className="ctx-mini-label">Prompt</span>
              <span className="ctx-mini-val">{fmt(promptTokens)}</span>
            </span>
            <span className="ctx-mini-sep">·</span>
            <span className="ctx-mini-item">
              <span className="ctx-mini-label">Response</span>
              <span className="ctx-mini-val">{fmt(completionTokens)}</span>
            </span>
            <span className="ctx-mini-sep">·</span>
            <span className="ctx-mini-item">
              <span className="ctx-mini-label">Used</span>
              <span className="ctx-mini-val">{pct.toFixed(1)}%</span>
            </span>
          </div>
        </div>

        <div className="ctx-stat-group ctx-right">
          <span className="ctx-stat-label">Remaining</span>
          <span className="ctx-remaining" style={{ color }}>
            {fmt(remaining)}
          </span>
          <span className="ctx-remaining-sub">tokens left</span>
        </div>
      </div>
    </div>
  )
}
