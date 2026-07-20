import { ipcMain } from 'electron'
import activeWin from 'active-win'

let pollInterval: NodeJS.Timeout | null = null
let lastContext: ActiveContext | null = null

export interface ActiveContext {
  appName: string
  title: string
  url: string | null
  pid: number
}

export function setupContextHandlers(win: Electron.BrowserWindow): void {
  // Poll active window every 2s (low overhead)
  pollInterval = setInterval(async () => {
    try {
      const result = await activeWin()
      if (!result) return
      const ctx: ActiveContext = {
        appName: result.owner.name,
        title: result.title,
        url: (result as Record<string, unknown>).url as string | null ?? null,
        pid: result.owner.processId
      }
      lastContext = ctx
    } catch {
      // active-win may fail if no window focused
    }
  }, 2000)

  ipcMain.handle('context:get', async () => {
    if (lastContext) return lastContext
    try {
      const result = await activeWin()
      if (!result) return null
      return {
        appName: result.owner.name,
        title: result.title,
        url: (result as Record<string, unknown>).url as string | null ?? null,
        pid: result.owner.processId
      }
    } catch {
      return null
    }
  })

  // Cleanup on app quit
  win.on('closed', () => {
    if (pollInterval) clearInterval(pollInterval)
  })
}
