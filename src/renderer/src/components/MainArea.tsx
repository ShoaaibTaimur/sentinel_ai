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
  const [statusText, setStatusText] = useState<string | null>(null)

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

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 180)}px`
    }
  }, [input])

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
        copy.push({ id: crypto.randomUUID(), role: 'system', content: 'Cancelled', ts: Date.now() })
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

  const THINKING_STEPS = [
    'Analyzing request...',
    'Evaluating system context...',
    'Processing capabilities...',
    'Synthesizing plan...'
  ]
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    if (!loading || streamingContent) {
      setStepIndex(0)
      return
    }
    const interval = setInterval(() => {
      setStepIndex(idx => (idx + 1) % THINKING_STEPS.length)
    }, 2200)
    return () => clearInterval(interval)
  }, [loading, streamingContent])

  const onStatus = useCallback((status: unknown) => {
    setStatusText(status as string | null)
  }, [])

  useEffect(() => {
    // Register listeners — each returns cleanup fn
    const cleanups = [
      window.sentinel.on('ai:token', onToken as (...args: unknown[]) => void),
      window.sentinel.on('ai:done', ((full: string) => { setStatusText(null); onDone(full) }) as (...args: unknown[]) => void),
      window.sentinel.on('ai:error', ((err: string) => { setStatusText(null); onError(err) }) as (...args: unknown[]) => void),
      window.sentinel.on('ai:status', onStatus as (...args: unknown[]) => void),
      window.sentinel.on('ai:usage', onUsage as (...args: unknown[]) => void),
      window.sentinel.on('chat:clear', (() => { setStatusText(null); onClear() }) as (...args: unknown[]) => void),
      window.sentinel.on('command:getContext', onCtxGet as (...args: unknown[]) => void),
    ]
    return () => cleanups.forEach(fn => fn())
  }, [onToken, onDone, onError, onStatus, onUsage, onClear, onCtxGet])

  const handleCancel = useCallback(async () => {
    setLoading(false)
    await window.sentinel.cancel()
    setMessages(prev => {
      const copy = [...prev]
      if (copy.length > 0 && copy[copy.length - 1].role === 'assistant') {
        copy.pop()
      }
      copy.push({ id: crypto.randomUUID(), role: 'system', content: 'Cancelled', ts: Date.now() })
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
    // Filter out cancelled requests and system Cancelled notices from history sent to LLM
    const validMessages: Message[] = []
    for (let i = 0; i < updated.length; i++) {
      const msg = updated[i]
      const nextMsg = updated[i + 1]
      if (msg.role === 'user' && nextMsg && nextMsg.role === 'system' && nextMsg.content === 'Cancelled') {
        i++ // skip both cancelled user prompt and Cancelled system notice
        continue
      }
      if (msg.role === 'system' && msg.content === 'Cancelled') {
        continue
      }
      validMessages.push(msg)
    }

    const history = validMessages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content }))
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

    if (page === 'about') {
      return (
        <div className="main-area">
          <div className="page about-page" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>About Sentinel AI</h2>
            <div className="about-card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 24px', maxWidth: '540px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                <img src={logoUrl} alt="Sentinel AI" style={{ width: '42px', height: '42px' }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Sentinel AI v1.0.2</h3>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-dim)' }}>Keyboard-first, system-wide desktop AI assistant</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Developer:</strong>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Md Shoaaib Taimur</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Portfolio:</strong>
                  <a href="https://taimur.dev" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>taimur.dev</a>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>AI Infrastructure:</strong>
                  <span style={{ color: 'var(--text-dim)' }}>OpenCode Zen (opencode.ai)</span>
                </div>
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
            {m.role === 'user' && (
              <div className="msg-header user-msg-header">
                <span className="msg-author">You</span>
                <button
                  className="copy-user-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(m.content)
                    addToast('Message copied to clipboard', 'info')
                  }}
                  title="Copy your prompt"
                >
                  📋 Copy
                </button>
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
                <span className="status-text-pill" key={statusText || stepIndex}>
                  <span className="status-label">{statusText || THINKING_STEPS[stepIndex]}</span>
                  <span className="status-dots">
                    <span className="sdot">.</span>
                    <span className="sdot">.</span>
                    <span className="sdot">.</span>
                  </span>
                </span>
              </div>
            </div>
          </div>
        )}
        {streamingContent && (
          <div className="msg assistant">
            <div className="msg-bubble">
              <MarkdownRenderer content={streamingContent} isStreaming={true} />
              {loading && (
                <div className="thinking-loader" style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="status-text-pill" key={statusText || stepIndex}>
                    <span className="status-label">{statusText || THINKING_STEPS[stepIndex]}</span>
                    <span className="status-dots">
                      <span className="sdot">.</span>
                      <span className="sdot">.</span>
                      <span className="sdot">.</span>
                    </span>
                  </span>
                </div>
              )}
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
