import { useState, useEffect, useRef } from 'react'
import type { ToastMsg } from '../App'

interface SavedConversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: Array<{ role: string; content: string }>
}

interface Props {
  onSelect: (conv: SavedConversation) => void
  addToast: (text: string, type?: ToastMsg['type']) => void
}

export default function HistoryPage({ onSelect, addToast }: Props) {
  const [conversations, setConversations] = useState<SavedConversation[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [focusedIdx, setFocusedIdx] = useState<number>(0)

  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadConversations()
  }, [])

  const loadConversations = async () => {
    const list = await window.sentinel.getConversations()
    setConversations(list as SavedConversation[])
  }

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await window.sentinel.deleteConversation(id)
    addToast('Conversation deleted', 'info')
    loadConversations()
  }

  const handleStartRename = (conv: SavedConversation, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditingId(conv.id)
    setEditTitle(conv.title)
  }

  const handleSaveRename = async (conv: SavedConversation, e: React.FormEvent) => {
    e.preventDefault()
    if (!editTitle.trim()) return
    const updated = {
      ...conv,
      title: editTitle.trim(),
      updatedAt: Date.now()
    }
    await window.sentinel.saveConversation(updated)
    setEditingId(null)
    addToast('Renamed successfully')
    loadConversations()
  }

  const handleExport = async (conv: SavedConversation, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const result = await window.sentinel.exportConversation(conv)
    if ((result as any).success) {
      addToast(`Exported to ${(result as any).filePath}`)
    } else if (!(result as any).cancelled) {
      addToast(`Export failed: ${(result as any).error}`, 'error')
    }
  }

  const filtered = conversations.filter(c => {
    const query = searchQuery.toLowerCase()
    return (
      c.title.toLowerCase().includes(query) ||
      c.messages.some(m => m.content.toLowerCase().includes(query))
    )
  })

  // Keep focused index within bounds
  useEffect(() => {
    if (focusedIdx >= filtered.length) {
      setFocusedIdx(Math.max(0, filtered.length - 1))
    }
  }, [filtered, focusedIdx])

  // Keyboard navigation listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when user is renaming
      if (editingId) return

      const isSearchFocused = document.activeElement === searchRef.current

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (isSearchFocused) {
          searchRef.current?.blur()
          setFocusedIdx(0)
        } else {
          setFocusedIdx(f => Math.min(f + 1, filtered.length - 1))
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (!isSearchFocused && focusedIdx === 0) {
          searchRef.current?.focus()
        } else if (!isSearchFocused) {
          setFocusedIdx(f => Math.max(f - 1, 0))
        }
      } else if (e.key === 'Enter') {
        if (!isSearchFocused && filtered[focusedIdx]) {
          e.preventDefault()
          onSelect(filtered[focusedIdx])
        }
      } else if (e.key === 'Delete' || (e.key === 'Backspace' && e.ctrlKey)) {
        if (!isSearchFocused && filtered[focusedIdx]) {
          e.preventDefault()
          handleDelete(filtered[focusedIdx].id)
        }
      } else if (e.key === 'r' && !isSearchFocused) {
        if (filtered[focusedIdx]) {
          e.preventDefault()
          handleStartRename(filtered[focusedIdx])
        }
      } else if (e.key === 'e' && !isSearchFocused) {
        if (filtered[focusedIdx]) {
          e.preventDefault()
          handleExport(filtered[focusedIdx])
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        if (!isSearchFocused) {
          searchRef.current?.focus()
        } else {
          setSearchQuery('')
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [filtered, focusedIdx, editingId])

  // Scroll focused card into view
  useEffect(() => {
    if (listRef.current) {
      const container = listRef.current
      const activeEl = container.children[focusedIdx] as HTMLElement
      if (activeEl) {
        const cTop = container.scrollTop
        const cBottom = cTop + container.clientHeight
        const elTop = activeEl.offsetTop
        const elBottom = elTop + activeEl.clientHeight

        if (elTop < cTop) {
          container.scrollTop = elTop
        } else if (elBottom > cBottom) {
          container.scrollTop = elBottom - container.clientHeight
        }
      }
    }
  }, [focusedIdx])

  return (
    <div className="history-page">
      <div className="history-header">
        <input
          ref={searchRef}
          type="text"
          className="history-search"
          placeholder="Search past conversations... (Arrow keys to navigate, Enter to open, R to rename, Del to delete)"
          value={searchQuery}
          onChange={e => {
            setSearchQuery(e.target.value)
            setFocusedIdx(0)
          }}
          autoFocus
        />
      </div>

      <div ref={listRef} className="history-list">
        {filtered.length === 0 ? (
          <div className="history-empty">
            <span className="history-empty-icon">📂</span>
            <h3>No conversations found</h3>
            <p>{searchQuery ? 'Try another search query' : 'Your past chats will appear here'}</p>
          </div>
        ) : (
          filtered.map((c, idx) => (
            <div
              key={c.id}
              className={`history-card ${focusedIdx === idx ? 'focused' : ''}`}
              onClick={() => onSelect(c)}
            >
              <div className="history-card-body">
                {editingId === c.id ? (
                  <form
                    className="history-rename-form"
                    onSubmit={(e) => handleSaveRename(c, e)}
                    onClick={e => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      className="history-rename-input"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      autoFocus
                      onBlur={() => setEditingId(null)}
                    />
                    <button type="submit" className="history-rename-btn">Save</button>
                  </form>
                ) : (
                  <h4 className="history-card-title">{c.title}</h4>
                )}

                <div className="history-card-meta">
                  <span>{c.messages.length} messages</span>
                  <span>·</span>
                  <span>{new Date(c.updatedAt).toLocaleString()}</span>
                </div>
              </div>

              <div className="history-card-actions">
                <button
                  className="history-action-btn"
                  onClick={(e) => handleStartRename(c, e)}
                  title="Rename (R)"
                >
                  ✎
                </button>
                <button
                  className="history-action-btn"
                  onClick={(e) => handleExport(c, e)}
                  title="Export (E)"
                >
                  ⤓
                </button>
                <button
                  className="history-action-btn delete"
                  onClick={(e) => handleDelete(c.id, e)}
                  title="Delete (Del)"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

