import { useState, useEffect, useCallback } from 'react'
import TopBar from './components/TopBar'
import MainArea from './components/MainArea'
import type { TokenUsage } from './components/MainArea'
import Sidebar from './components/Sidebar'
import PermissionDialog from './components/PermissionDialog'
import ModelSwitcher from './components/ModelSwitcher'
import Notification from './components/Notification'
import ApiKeySetup from './components/ApiKeySetup'
import './styles/app.css'

export type Page = 'chat' | 'tasks' | 'history' | 'plugins' | 'settings' | 'shortcuts' | 'usage' | 'about'

export interface ToastMsg { id: string; text: string; type: 'success' | 'error' | 'info' }
export interface PermReq { id: string; action: string; command: string; reason: string; risk: 'low' | 'medium' | 'high' }

export default function App() {
  const [page, setPage] = useState<Page>('chat')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [modelSwitcherOpen, setModelSwitcherOpen] = useState(false)
  const [currentModel, setCurrentModel] = useState('gpt-4o')
  const [connected, setConnected] = useState(false)
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const [permReq, setPermReq] = useState<PermReq | null>(null)
  const [needsApiKey, setNeedsApiKey] = useState(false)
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentTheme, setCurrentTheme] = useState('tokyo-night')

  const addToast = useCallback((text: string, type: ToastMsg['type'] = 'success') => {
    const id = crypto.randomUUID()
    setToasts(t => [...t, { id, text, type }])
    setTimeout(() => setToasts(t => t.filter(m => m.id !== id)), 3200)
  }, [])

  const handleUsageUpdate = useCallback((u: TokenUsage) => setTokenUsage(u), [])

  const handleToggleFullscreen = useCallback(() => {
    window.sentinel.toggleFullscreen()
  }, [])

  useEffect(() => {
    const s = window.sentinel
    s.getModel().then((m: string) => setCurrentModel(m))
    s.getTheme().then((t: string) => setCurrentTheme(t || 'tokyo-night'))
    s.hasApiKey().then((has: boolean) => {
      setConnected(has)
      if (!has) setNeedsApiKey(true)
    })
    s.isFullscreen().then((fs: boolean) => setIsFullscreen(fs))

    const cleanups = [
      s.on('ai:modelChanged', (m: unknown) => setCurrentModel(m as string)),
      s.on('permission:request', (req: unknown) => setPermReq(req as PermReq)),
      s.on('ui:openModelSwitcher', () => setModelSwitcherOpen(true)),
      s.on('ui:openSettings', () => { setPage('settings'); setSidebarOpen(false) }),
      s.on('ui:openHistory', () => { setPage('history'); setSidebarOpen(false) }),
      s.on('ui:openPlugins', () => { setPage('plugins'); setSidebarOpen(false) }),
      s.on('window:fullscreenChange', (fs: unknown) => setIsFullscreen(fs as boolean)),
    ]
    return () => cleanups.forEach(fn => fn())
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Fullscreen
      if (e.key === 'F11') { e.preventDefault(); window.sentinel.toggleFullscreen(); return }
      if (e.ctrlKey && e.shiftKey && e.key === 'F') { e.preventDefault(); window.sentinel.toggleFullscreen(); return }

      if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); setSidebarOpen(o => !o) }
      if (e.key === 'Escape') {
        if (modelSwitcherOpen) { setModelSwitcherOpen(false); return }
        if (sidebarOpen) { setSidebarOpen(false); return }
        if (isFullscreen) { window.sentinel.toggleFullscreen(); return }
        if (permReq) return
        window.sentinel.hideWindow()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'm') { e.preventDefault(); setModelSwitcherOpen(o => !o) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sidebarOpen, modelSwitcherOpen, permReq, isFullscreen])

  return (
    <div className={`app-shell ${isFullscreen ? 'fullscreen' : ''} theme-${currentTheme}`}>
      <TopBar
        model={currentModel}
        connected={connected}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(o => !o)}
        usage={tokenUsage}
      />

      <div className="app-body">
        {sidebarOpen && (
          <Sidebar
            currentPage={page}
            onNavigate={(p) => { setPage(p); setSidebarOpen(false) }}
            onClose={() => setSidebarOpen(false)}
          />
        )}
        <MainArea
          page={page}
          setPage={setPage}
          addToast={addToast}
          setConnected={setConnected}
          onUsageUpdate={handleUsageUpdate}
          usage={tokenUsage}
          currentTheme={currentTheme}
          setCurrentTheme={setCurrentTheme}
        />
      </div>

      {modelSwitcherOpen && (
        <ModelSwitcher
          currentModel={currentModel}
          onSelect={(m) => { window.sentinel.setModel(m); setModelSwitcherOpen(false); addToast(`Model: ${m}`) }}
          onClose={() => setModelSwitcherOpen(false)}
        />
      )}

      {permReq && (
        <PermissionDialog
          req={permReq}
          onRespond={(result) => {
            window.sentinel.respondPermission(permReq.id, result)
            setPermReq(null)
          }}
        />
      )}

      {needsApiKey && (
        <ApiKeySetup
          onDone={() => { setNeedsApiKey(false); setConnected(true); addToast('API key saved'); setModelSwitcherOpen(true) }}
        />
      )}

      <div className="toasts">
        {toasts.map(t => <Notification key={t.id} msg={t} />)}
      </div>
    </div>
  )
}
