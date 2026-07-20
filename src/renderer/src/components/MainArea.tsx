import { useState, useRef, useEffect, useCallback } from 'react'
import type { Page } from '../App'
import type { ToastMsg } from '../App'
import HistoryPage from './HistoryPage'
import PluginsPage from './PluginsPage'
import ShortcutsPage from './ShortcutsPage'
import UsagePage from './UsagePage'
import MarkdownRenderer from './MarkdownRenderer'
import logoUrl from '../assets/logo.svg'

interface Message { id: string; role: 'user' | 'assistant' | 'system'; content: string; ts: number }

export interface TokenUsage { promptTokens: number; completionTokens: number; totalTokens: number; contextLimit: number }

interface Props {
  page: Page
  setPage: (p: Page) => void
  addToast: (text: string, type?: ToastMsg['type']) => void
  setConnected: (v: boolean) => void
  onUsageUpdate: (u: TokenUsage) => void
  usage: TokenUsage | null
  currentTheme: string
  setCurrentTheme: (t: string) => void
}

const BUILT_IN = ['help','models','provider','apikey','plugins','settings','history','clear','about','doctor','exit','context']

const WELCOME_MESSAGES = [
  "Hey! Sentinel AI here — ready to open projects, search files, or automate your desktop. What can I do?",
  "Hello! I can open any project in VS Code, Cursor or another IDE — just ask. What shall we tackle today?",
  "Welcome back! Tell me a file name to find, a folder to open in an IDE, or any task you need done.",
  "Sentinel AI active. System-wide file search, IDE launching, web browsing — all at your command.",
  "Greetings! Ask me to open YouTube, find a file, edit code, or launch a project folder. Ready when you are.",
  "Hey there — your keyboard-first AI assistant is live. What project or file can I open for you?",
  "Sentinel AI online. I can read your active file, edit it, open browsers, or launch IDEs. What's first?",
  "Ready! I can find any file by name, open folders in your IDE, or browse the web. Just say the word."
]

const createWelcomeMessage = (): Message => {
  const idx = Math.floor(Math.random() * WELCOME_MESSAGES.length)
  return {
    id: 'welcome',
    role: 'assistant',
    content: WELCOME_MESSAGES[idx],
    ts: Date.now()
  }
}


export default function MainArea({
  page,
  setPage,
  addToast,
  onUsageUpdate,
  usage,
  currentTheme,
  setCurrentTheme
}: Props) {
  const [messages, setMessages] = useState<Message[]>([createWelcomeMessage()])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [currentConvId, setCurrentConvId] = useState<string | null>(null)
  const [convTitle, setConvTitle] = useState<string>('New Conversation')
  const [createdAt, setCreatedAt] = useState<number | null>(null)
  const [alwaysAllowed, setAlwaysAllowed] = useState<string[]>([])
  const [startOnLogin, setStartOnLogin] = useState(false)

  const loadAlwaysAllowed = useCallback(async () => {
    const list = await window.sentinel.getAlwaysAllow()
    setAlwaysAllowed(list as string[])
  }, [])

  const loadStartOnLogin = useCallback(async () => {
    const val = await window.sentinel.getStartOnLogin()
    setStartOnLogin(!!val)
  }, [])

  useEffect(() => {
    if (page === 'settings') {
      loadAlwaysAllowed()
      loadStartOnLogin()
    }
  }, [page, loadAlwaysAllowed, loadStartOnLogin])

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Track whether we're currently accumulating a streamed reply
  const streamingRef = useRef(false)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streamingContent, loading])
  useEffect(() => {
    if (!loading && page === 'chat') {
      inputRef.current?.focus()
    }
  }, [loading, page])

  // Stable callbacks so cleanup removes exactly the right ref
  const onToken = useCallback((token: string) => {
    streamingRef.current = true
    setStreamingContent(prev => prev + (token as string))
  }, [])

  const onDone = useCallback((full: string) => {
    setMessages(m => {
      const updated = [...m, { id: crypto.randomUUID(), role: 'assistant', content: full as string, ts: Date.now() }]
      if (currentConvId) {
        const convObj = {
          id: currentConvId,
          title: convTitle,
          createdAt: createdAt || Date.now(),
          updatedAt: Date.now(),
          messages: updated.map(msg => ({ id: msg.id, role: msg.role, content: msg.content, ts: msg.ts }))
        }
        window.sentinel.saveConversation(convObj)
      }
      return updated
    })
    setStreamingContent('')
    streamingRef.current = false
    setLoading(false)
  }, [currentConvId, convTitle, createdAt])

  const onError = useCallback((err: string) => {
    if (err === 'Cancelled by user') {
      setMessages(prev => {
        const copy = [...prev]
        if (copy.length > 0 && copy[copy.length - 1].role === 'assistant') {
          copy.pop()
        }
        if (copy.length > 0 && copy[copy.length - 1].role === 'user') {
          copy.pop()
        }
        if (currentConvId) {
          const convObj = {
            id: currentConvId,
            title: convTitle,
            createdAt: createdAt || Date.now(),
            updatedAt: Date.now(),
            messages: copy.map(msg => ({ id: msg.id, role: msg.role, content: msg.content, ts: msg.ts }))
          }
          window.sentinel.saveConversation(convObj)
        }
        return copy
      })
    } else {
      setMessages(m => [...m, { id: crypto.randomUUID(), role: 'system', content: `Error: ${err as string}`, ts: Date.now() }])
    }
    setStreamingContent('')
    streamingRef.current = false
    setLoading(false)
  }, [currentConvId, convTitle, createdAt])

  const onUsage = useCallback((usage: TokenUsage) => {
    onUsageUpdate(usage)
  }, [onUsageUpdate])

  const onClear = useCallback(() => {
    setMessages([createWelcomeMessage()])
    setCurrentConvId(null)
    setConvTitle('New Conversation')
    setCreatedAt(null)
  }, [])

  const onCtxGet = useCallback(async () => {
    const ctx = await window.sentinel.getContext()
    const text = ctx
      ? `**Context**\n- App: ${(ctx as Record<string,unknown>).appName}\n- Title: ${(ctx as Record<string,unknown>).title}${(ctx as Record<string,unknown>).url ? `\n- URL: ${(ctx as Record<string,unknown>).url}` : ''}`
      : 'No active window detected.'
    
    setMessages(m => {
      const updated = [...m, { id: crypto.randomUUID(), role: 'assistant', content: text, ts: Date.now() }]
      if (currentConvId) {
        const convObj = {
          id: currentConvId,
          title: convTitle,
          createdAt: createdAt || Date.now(),
          updatedAt: Date.now(),
          messages: updated.map(msg => ({ id: msg.id, role: msg.role, content: msg.content, ts: msg.ts }))
        }
        window.sentinel.saveConversation(convObj)
      }
      return updated
    })
  }, [currentConvId, convTitle, createdAt])

  useEffect(() => {
    // Register listeners — each returns cleanup fn
    const cleanups = [
      window.sentinel.on('ai:token', onToken as (...args: unknown[]) => void),
      window.sentinel.on('ai:done', onDone as (...args: unknown[]) => void),
      window.sentinel.on('ai:error', onError as (...args: unknown[]) => void),
      window.sentinel.on('ai:usage', onUsage as (...args: unknown[]) => void),
      window.sentinel.on('chat:clear', onClear as (...args: unknown[]) => void),
      window.sentinel.on('command:getContext', onCtxGet as (...args: unknown[]) => void),
    ]
    return () => cleanups.forEach(fn => fn())
  }, [onToken, onDone, onError, onUsage, onClear, onCtxGet])

  const handleCancel = useCallback(async () => {
    setLoading(false)
    await window.sentinel.cancel()
    setMessages(prev => {
      const copy = [...prev]
      if (copy.length > 0 && copy[copy.length - 1].role === 'assistant') {
        copy.pop()
      }
      if (copy.length > 0 && copy[copy.length - 1].role === 'user') {
        copy.pop()
      }
      if (currentConvId) {
        const convObj = {
          id: currentConvId,
          title: convTitle,
          createdAt: createdAt || Date.now(),
          updatedAt: Date.now(),
          messages: copy.map(msg => ({ id: msg.id, role: msg.role, content: msg.content, ts: msg.ts }))
        }
        window.sentinel.saveConversation(convObj)
      }
      return copy
    })
    addToast('Execution cancelled', 'info')
  }, [currentConvId, convTitle, createdAt, addToast])

  useEffect(() => {
    const handleGlobalEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && loading) {
        e.preventDefault()
        e.stopPropagation()
        handleCancel()
      }
    }
    window.addEventListener('keydown', handleGlobalEsc, { capture: true })
    return () => window.removeEventListener('keydown', handleGlobalEsc, { capture: true })
  }, [loading, handleCancel])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    const newUserMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, ts: Date.now() }
    const updated = [...messages, newUserMsg]
    setMessages(updated)

    // Determine ID and Title
    let activeId = currentConvId
    let activeTitle = convTitle
    let activeCreatedAt = createdAt
    if (!activeId) {
      activeId = crypto.randomUUID()
      activeTitle = text.slice(0, 40) + (text.length > 40 ? '...' : '')
      activeCreatedAt = Date.now()
      setCurrentConvId(activeId)
      setConvTitle(activeTitle)
      setCreatedAt(activeCreatedAt)
    }

    const save = async (msgsList: Message[]) => {
      const convObj = {
        id: activeId!,
        title: activeTitle,
        createdAt: activeCreatedAt || Date.now(),
        updatedAt: Date.now(),
        messages: msgsList.map(m => ({ id: m.id, role: m.role, content: m.content, ts: m.ts }))
      }
      await window.sentinel.saveConversation(convObj)
    }

    const lower = text.toLowerCase()
    if (BUILT_IN.includes(lower)) {
      setLoading(true)
      const result = await window.sentinel.runCommand(lower)
      setLoading(false)
      if (result) {
        const sysMsg: Message = {
          id: crypto.randomUUID(),
          role: (result as {type:string}).type === 'system' ? 'system' : 'assistant',
          content: (result as {content:string}).content,
          ts: Date.now()
        }
        const updatedWithSys = [...updated, sysMsg]
        setMessages(updatedWithSys)
        await save(updatedWithSys)
        return
      }
    }

    await save(updated)

    setLoading(true)
    const history = updated.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content }))
    // Fire-and-forget: response comes via ai:done event
    window.sentinel.chat(history).catch((err: unknown) => {
      console.error('chat error', err)
    })
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  if (page !== 'chat') {
    if (page === 'history') {
      return (
        <div className="main-area">
          <HistoryPage
            onSelect={(conv) => {
              setCurrentConvId(conv.id)
              setConvTitle(conv.title)
              setCreatedAt(conv.createdAt)
              setMessages(conv.messages.map(m => ({
                id: (m as any).id || crypto.randomUUID(),
                role: m.role as any,
                content: m.content,
                ts: (m as any).ts || Date.now()
              })))
              setPage('chat')
              addToast('Conversation loaded')
            }}
            addToast={addToast}
          />
        </div>
      )
    }

    if (page === 'shortcuts') {
      return (
        <div className="main-area">
          <ShortcutsPage
            onBack={() => setPage('chat')}
          />
        </div>
      )
    }

    if (page === 'usage') {
      return (
        <div className="main-area">
          <UsagePage
            usage={usage}
            onBack={() => setPage('chat')}
          />
        </div>
      )
    }

    if (page === 'plugins') {
      return (
        <div className="main-area">
          <PluginsPage
            addToast={addToast}
            onBack={() => setPage('chat')}
          />
        </div>
      )
    }

    if (page === 'settings') {
      return (
        <div className="main-area">
          <div className="page settings-page">
            <h2>Settings</h2>
            <div className="settings-section">
              <h3>Appearance</h3>
              <p className="settings-section-desc">Select an interface theme for Sentinel AI.</p>
              
              <div className="themes-grid">
                <div 
                  className={`theme-card ${currentTheme === 'tokyo-night' ? 'active' : ''}`}
                  onClick={async () => {
                    await window.sentinel.setTheme('tokyo-night')
                    setCurrentTheme('tokyo-night')
                    addToast('Theme: Dark Mode')
                  }}
                >
                  <div className="theme-preview tokyo-night">
                    <span className="swatch swatch-bg"></span>
                    <span className="swatch swatch-accent"></span>
                    <span className="swatch swatch-text"></span>
                  </div>
                  <div className="theme-card-info">
                    <h4>Dark Mode</h4>
                    <p>Dark purple neon theme</p>
                  </div>
                </div>

                <div 
                  className={`theme-card ${currentTheme === 'light' ? 'active' : ''}`}
                  onClick={async () => {
                    await window.sentinel.setTheme('light')
                    setCurrentTheme('light')
                    addToast('Theme: Light Mode')
                  }}
                >
                  <div className="theme-preview light">
                    <span className="swatch swatch-bg"></span>
                    <span className="swatch swatch-accent"></span>
                    <span className="swatch swatch-text"></span>
                  </div>
                  <div className="theme-card-info">
                    <h4>Light Mode</h4>
                    <p>Clean high-contrast theme</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <h3>⚙️ General Settings</h3>
              <p className="settings-section-desc">Configure application start behaviors.</p>
              
              <div className="settings-row">
                <div>
                  <h4 style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)' }}>Start on System Login</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-dim)' }}>
                    Automatically launch Sentinel AI when you turn on your computer.
                  </p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={startOnLogin}
                    onChange={async (e) => {
                      const val = e.target.checked
                      await window.sentinel.setStartOnLogin(val)
                      setStartOnLogin(val)
                      addToast(val ? 'Auto-start enabled' : 'Auto-start disabled')
                    }}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            </div>

            <div className="settings-section">
              <h3>🛡️ Always-Allowed Permissions</h3>
              <p className="settings-section-desc">Manage system commands that you have authorized to execute automatically.</p>
              
              <div className="permissions-list">
                {alwaysAllowed.length === 0 ? (
                  <div className="perm-empty">
                    <span className="perm-empty-icon">🛡️</span>
                    <p>No automatic permissions configured yet.</p>
                  </div>
                ) : (
                  alwaysAllowed.map((act) => (
                    <div key={act} className="perm-card">
                      <div className="perm-info">
                        <span className="perm-action-name">{act}</span>
                        <span className="perm-origin-tag">Auto-Approved</span>
                      </div>
                      <button
                        className="perm-revoke-btn"
                        onClick={async (e) => {
                          e.stopPropagation()
                          await window.sentinel.removeAlwaysAllow(act)
                          addToast(`Revoked permission for ${act}`)
                          loadAlwaysAllowed()
                        }}
                      >
                        Revoke
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )
    }

    return (
      <div className="main-area">
        <div className="page">
          <h2>{page.charAt(0).toUpperCase() + page.slice(1)}</h2>
          <p className="page-placeholder">
            {page === 'tasks' && 'Task queue coming soon.'}
            {page === 'about' && 'Sentinel AI v1.0 — Keyboard-first desktop AI assistant.\nProvider: OpenCode Zen (opencode.ai)'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="main-area">
      <div className="chat-messages">
        {messages.length === 0 && !loading && (
          <div className="chat-empty">
            <img src={logoUrl} className="chat-empty-logo-img" alt="Sentinel AI" />
            <h2>Sentinel AI</h2>
            <p>Your keyboard-first desktop assistant. Type a command or ask anything.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={m.id} className={`msg ${m.role}`} style={{ animationDelay: `${Math.min(i * 30, 180)}ms` }}>
            {m.role === 'assistant' && (
              <div className="msg-header">
                <img src={logoUrl} className="msg-avatar-img" alt="logo" style={{ width: '20px', height: '20px', flexShrink: 0, filter: 'drop-shadow(0 0 4px var(--accent-dim))' }} />
                <span className="msg-author">Sentinel</span>
              </div>
            )}
            <div className="msg-bubble">
              <MarkdownRenderer content={m.content} />
            </div>
            <span className="msg-time">{new Date(m.ts).toLocaleTimeString()}</span>
          </div>
        ))}
        {loading && !streamingContent && (
          <div className="msg assistant thinking">
            <div className="msg-bubble">
              <div className="thinking-loader">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            </div>
          </div>
        )}
        {streamingContent && (
          <div className="msg assistant">
            <div className="msg-bubble">
              <MarkdownRenderer content={streamingContent} isStreaming={true} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="prompt-area">
        <div className="prompt-wrap">
          <textarea
            ref={inputRef}
            className="prompt-input"
            placeholder="Ask anything — open files, launch IDEs, search, edit code…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            disabled={loading}
          />
          <button 
            className={`prompt-send ${loading ? 'loading' : ''}`} 
            onClick={loading ? handleCancel : send}
            title={loading ? "Cancel Execution (Esc)" : "Send Message"}
          >
            {loading ? '■' : '↑'}
          </button>
        </div>
      </div>
    </div>
  )
}
