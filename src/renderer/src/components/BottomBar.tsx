const SHORTCUTS = [
  { key: '↑↓', label: 'Navigate' },
  { key: 'Enter', label: 'Send' },
  { key: 'Tab', label: 'Menu' },
  { key: 'Esc', label: 'Back' },
  { key: 'Ctrl+M', label: 'Models' },
  { key: 'F11', label: 'Fullscreen' },
]

interface Props { sidebarOpen: boolean }

export default function BottomBar({ sidebarOpen: _ }: Props) {
  return (
    <div className="bottombar">
      {SHORTCUTS.map((s, i) => (
        <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {i > 0 && <span className="kb-sep" />}
          <span className="kb-item">
            <span className="kb-key">{s.key}</span>
            <span>{s.label}</span>
          </span>
        </span>
      ))}
    </div>
  )
}
