import { useState, useEffect, useRef } from 'react'
import type { ToastMsg } from '../App'

interface PluginInfo {
  id: string
  name: string
  icon: string
  description: string
  actions: { name: string; risk: 'low' | 'medium' | 'high'; desc: string }[]
}

const PLUGINS: PluginInfo[] = [
  {
    id: 'filesystem',
    name: 'Filesystem Guard',
    icon: '📁',
    description: 'File and directory operations (read, write, delete, search).',
    actions: [
      { name: 'fs:read', risk: 'low', desc: 'Read file contents' },
      { name: 'fs:write', risk: 'medium', desc: 'Create or modify files' },
      { name: 'fs:delete', risk: 'high', desc: 'Delete files or folders' },
      { name: 'fs:search', risk: 'low', desc: 'Search for files' }
    ]
  },
  {
    id: 'terminal',
    name: 'Terminal Executor',
    icon: '💻',
    description: 'Executes commands in the local system shell.',
    actions: [
      { name: 'terminal:exec', risk: 'high', desc: 'Execute bash/shell command' }
    ]
  },
  {
    id: 'git',
    name: 'Git Orchestrator',
    icon: '🌿',
    description: 'Manage git repositories, commits, branch operations.',
    actions: [
      { name: 'git:status', risk: 'low', desc: 'Get repo status' },
      { name: 'git:commit', risk: 'medium', desc: 'Create local commits' },
      { name: 'git:push', risk: 'high', desc: 'Push commits to remote' }
    ]
  },
  {
    id: 'applications',
    name: 'App Launcher',
    icon: '🚀',
    description: 'Launch, close, focus desktop application windows.',
    actions: [
      { name: 'apps:launch', risk: 'medium', desc: 'Start an external app' },
      { name: 'apps:close', risk: 'medium', desc: 'Terminate running app' }
    ]
  },
  {
    id: 'gui',
    name: 'GUI Controller',
    icon: '🎛️',
    description: 'Interact with active desktop windows or write/edit screen elements.',
    actions: [
      { name: 'gui:input', risk: 'medium', desc: 'Type keys or edit files' }
    ]
  },
  {
    id: 'web',
    name: 'Web Reader',
    icon: '🌐',
    description: 'Fetch and parse text from external web pages and URLs.',
    actions: [
      { name: 'web:fetch', risk: 'low', desc: 'Fetch web page content' }
    ]
  }
]

interface Props {
  addToast: (text: string, type?: ToastMsg['type']) => void
  onBack: () => void
}

export default function PluginsPage({ addToast, onBack }: Props) {
  const [alwaysAllowed, setAlwaysAllowed] = useState<string[]>([])
  const [activeSection, setActiveSection] = useState<'plugins' | 'permissions'>('plugins')
  const [focusedPluginIdx, setFocusedPluginIdx] = useState<number>(0)
  const [focusedPermIdx, setFocusedPermIdx] = useState<number>(0)

  const pluginRefs = useRef<(HTMLDivElement | null)[]>([])
  const permRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    loadAlwaysAllowed()
  }, [])

  const loadAlwaysAllowed = async () => {
    const list = await window.sentinel.getAlwaysAllow()
    setAlwaysAllowed(list as string[])
  }

  const handleRevoke = async (action: string) => {
    await window.sentinel.removeAlwaysAllow(action)
    addToast(`Revoked permission for ${action}`)
    loadAlwaysAllowed()
  }

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault()
        setActiveSection(s => s === 'plugins' ? 'permissions' : 'plugins')
        setFocusedPluginIdx(0)
        setFocusedPermIdx(0)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (activeSection === 'plugins') {
          setFocusedPluginIdx(i => Math.min(i + 1, PLUGINS.length - 1))
        } else if (alwaysAllowed.length > 0) {
          setFocusedPermIdx(i => Math.min(i + 1, alwaysAllowed.length - 1))
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (activeSection === 'plugins') {
          setFocusedPluginIdx(i => Math.max(i - 1, 0))
        } else if (alwaysAllowed.length > 0) {
          setFocusedPermIdx(i => Math.max(i - 1, 0))
        }
      } else if (e.key === 'Enter') {
        if (activeSection === 'permissions' && alwaysAllowed[focusedPermIdx]) {
          e.preventDefault()
          handleRevoke(alwaysAllowed[focusedPermIdx])
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onBack()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeSection, alwaysAllowed, focusedPermIdx])

  // Scroll focused elements into view
  useEffect(() => {
    if (activeSection === 'plugins') {
      pluginRefs.current[focusedPluginIdx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    } else {
      permRefs.current[focusedPermIdx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [focusedPluginIdx, focusedPermIdx, activeSection])

  return (
    <div className="plugins-page">
      <div className="plugins-grid">
        {/* Left Section: Plugins List */}
        <div className={`plugins-column ${activeSection === 'plugins' ? 'active-col' : ''}`}>
          <div className="col-header">
            <h3>🧩 System Plugins</h3>
            <span className="col-hint">Arrow keys to browse</span>
          </div>

          <div className="plugins-list">
            {PLUGINS.map((plugin, idx) => (
              <div
                key={plugin.id}
                ref={el => { pluginRefs.current[idx] = el }}
                className={`plugin-card ${activeSection === 'plugins' && focusedPluginIdx === idx ? 'focused' : ''}`}
                onClick={() => {
                  setActiveSection('plugins')
                  setFocusedPluginIdx(idx)
                }}
              >
                <div className="plugin-card-header">
                  <span className="plugin-icon">{plugin.icon}</span>
                  <div className="plugin-title-wrap">
                    <h4>{plugin.name}</h4>
                    <span className="plugin-status-badge">active</span>
                  </div>
                </div>
                <p className="plugin-desc">{plugin.description}</p>
                
                <div className="plugin-actions-list">
                  {plugin.actions.map(act => (
                    <div key={act.name} className="plugin-action-row">
                      <span className="action-name">{act.name}</span>
                      <span className={`risk-badge ${act.risk}`}>{act.risk}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Section: Always-Allowed Permissions */}
        <div className={`plugins-column ${activeSection === 'permissions' ? 'active-col' : ''}`}>
          <div className="col-header">
            <h3>🛡️ Always-Allowed Actions</h3>
            <span className="col-hint">Enter to revoke</span>
          </div>

          <div className="permissions-list">
            {alwaysAllowed.length === 0 ? (
              <div className="perm-empty">
                <span className="perm-empty-icon">🛡️</span>
                <p>No automatic permissions configured yet.</p>
                <p className="perm-empty-sub">When plugins request permissions, choose "Always Allow" to see them here.</p>
              </div>
            ) : (
              alwaysAllowed.map((act, idx) => (
                <div
                  key={act}
                  ref={el => { permRefs.current[idx] = el }}
                  className={`perm-card ${activeSection === 'permissions' && focusedPermIdx === idx ? 'focused' : ''}`}
                  onClick={() => {
                    setActiveSection('permissions')
                    setFocusedPermIdx(idx)
                  }}
                >
                  <div className="perm-info">
                    <span className="perm-action-name">{act}</span>
                    <span className="perm-origin-tag">Auto-Approved</span>
                  </div>
                  <button
                    className="perm-revoke-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRevoke(act)
                    }}
                    title="Revoke Permission"
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
