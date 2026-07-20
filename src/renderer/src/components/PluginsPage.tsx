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

export default function PluginsPage({ onBack }: Props) {
  const [focusedPluginIdx, setFocusedPluginIdx] = useState<number>(0)
  const pluginRefs = useRef<(HTMLDivElement | null)[]>([])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedPluginIdx(i => Math.min(i + 1, PLUGINS.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedPluginIdx(i => Math.max(i - 1, 0))
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onBack()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Scroll focused elements into view
  useEffect(() => {
    pluginRefs.current[focusedPluginIdx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [focusedPluginIdx])

  return (
    <div className="plugins-page">
      <div className="col-header">
        <h3>🧩 System Plugins</h3>
        <span className="col-hint">Arrow keys to browse • Escape to back</span>
      </div>

      <div className="plugins-list single-col">
        {PLUGINS.map((plugin, idx) => (
          <div
            key={plugin.id}
            ref={el => { pluginRefs.current[idx] = el }}
            className={`plugin-card ${focusedPluginIdx === idx ? 'focused' : ''}`}
            onClick={() => setFocusedPluginIdx(idx)}
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
  )
}
