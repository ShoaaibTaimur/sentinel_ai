import { useEffect, useRef, useState } from 'react'
import type { Page } from '../App'

const ITEMS: { id: Page; icon: string; label: string }[] = [
  { id: 'chat',     icon: '💬', label: 'Chat'     },
  { id: 'tasks',    icon: '✅', label: 'Tasks'    },
  { id: 'history',  icon: '🕑', label: 'History'  },
  { id: 'plugins',  icon: '🧩', label: 'Plugins'  },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
  { id: 'about',    icon: 'ℹ️',  label: 'About'   }
]

interface Props {
  currentPage: Page
  onNavigate: (p: Page) => void
  onClose: () => void
}

export default function Sidebar({ currentPage, onNavigate, onClose }: Props) {
  const [focused, setFocused] = useState(ITEMS.findIndex(i => i.id === currentPage))
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    refs.current[focused]?.focus()
  }, [focused])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, ITEMS.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)) }
      if (e.key === 'Enter')     { e.preventDefault(); onNavigate(ITEMS[focused].id) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focused, onNavigate])

  return (
    <div className="sidebar">
      <button
        className="sidebar-new-chat"
        onClick={() => {
          onNavigate('chat')
          // Trigger clear command to start a fresh chat session
          window.sentinel.runCommand('clear')
          onClose()
        }}
      >
        <span className="icon">➕</span> New Chat
      </button>
      <div className="sidebar-divider" />
      {ITEMS.map((item, i) => (
        <button
          key={item.id}
          ref={el => { refs.current[i] = el }}
          className={`sidebar-item ${currentPage === item.id ? 'active' : ''} ${focused === i ? 'focused' : ''}`}
          onClick={() => onNavigate(item.id)}
          onFocus={() => setFocused(i)}
        >
          <span className="icon">{item.icon}</span>
          {item.label}
        </button>
      ))}
      <div className="sidebar-spacer" />
      <button className="sidebar-item sidebar-exit" onClick={() => window.sentinel.closeWindow()}>
        <span className="icon">🚪</span>Exit
      </button>
    </div>
  )
}
