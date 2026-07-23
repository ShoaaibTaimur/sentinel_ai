import { ipcMain, dialog, shell } from 'electron'
import activeWin from 'active-win'
import fs from 'fs'
import path from 'path'

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

  // Open native OS file/folder picker dialog
  ipcMain.handle('context:selectPath', async () => {
    const result = await dialog.showOpenDialog(win, {
      title: 'Select File or Directory to Attach as Context',
      properties: ['openFile', 'openDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const selectedPath = result.filePaths[0]
    let isDir = false
    try {
      const stat = fs.statSync(selectedPath)
      isDir = stat.isDirectory()
    } catch {
      // Ignore stat error
    }

    return {
      path: selectedPath,
      name: path.basename(selectedPath) || selectedPath,
      isDir
    }
  })

  // Open selected file or folder in OS Native File Manager
  ipcMain.handle('context:openPathInOS', async (_event, targetPath: string) => {
    if (!targetPath) return false
    try {
      if (fs.existsSync(targetPath)) {
        const stat = fs.statSync(targetPath)
        if (stat.isDirectory()) {
          await shell.openPath(targetPath)
        } else {
          shell.showItemInFolder(targetPath)
        }
        return true
      }
    } catch (err) {
      console.error('Failed to open path in OS:', err)
    }
    return false
  })

  // Cleanup on app quit
  win.on('closed', () => {
    if (pollInterval) clearInterval(pollInterval)
  })
}
