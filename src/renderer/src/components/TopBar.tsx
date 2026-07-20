interface Props {
  model: string
  connected: boolean
  isFullscreen: boolean
  onToggleFullscreen: () => void
}

export default function TopBar({ model, connected, isFullscreen, onToggleFullscreen }: Props) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <span className="topbar-logo">Sentinel<span>AI</span></span>
        <span className="topbar-sep">·</span>
        <div className="topbar-provider">
          <span className={`status-dot ${connected ? '' : 'offline'}`} />
          <span>Zen {connected ? '● Connected' : '○ Disconnected'}</span>
        </div>
      </div>

      <div className="topbar-center">
        <span className="topbar-model">{model}</span>
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
