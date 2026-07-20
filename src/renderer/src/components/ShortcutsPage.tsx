import { useEffect, useRef, useState } from 'react'

const SHORTCUTS = [
  { key: 'Tab', label: 'Toggle Sidebar Menu' },
  { key: '↑ / ↓', label: 'Navigate active items / command history' },
  { key: 'Enter', label: 'Submit prompt / confirm action' },
  { key: 'Esc', label: 'Return to Chat / dismiss modal panel' },
  { key: 'Ctrl + M', label: 'Open Model selection dropdown' },
  { key: 'F11', label: 'Toggle Fullscreen mode' }
]

interface Props {
  onBack: () => void
}

export default function ShortcutsPage({ onBack }: Props) {
  const [focusedIdx, setFocusedIdx] = useState(0)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIdx(i => Math.min(i + 1, SHORTCUTS.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIdx(i => Math.max(i - 1, 0))
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onBack()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onBack])

  useEffect(() => {
    itemRefs.current[focusedIdx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [focusedIdx])

  return (
    <div className="shortcuts-page">
      <div className="col-header">
        <h3>⌨️ Keyboard Shortcuts</h3>
        <span className="col-hint">Arrow keys to browse • Escape to back</span>
      </div>

      <div className="shortcuts-list single-col">
        {SHORTCUTS.map((s, idx) => (
          <div
            key={s.key}
            ref={el => { itemRefs.current[idx] = el }}
            className={`shortcut-card ${focusedIdx === idx ? 'focused' : ''}`}
            onClick={() => setFocusedIdx(idx)}
          >
            <kbd className="shortcut-key-badge">{s.key}</kbd>
            <span className="shortcut-desc">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
