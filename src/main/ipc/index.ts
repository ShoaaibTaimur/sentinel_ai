import { BrowserWindow, ipcMain } from 'electron'
import { setupAIHandlers } from './ai'
import { setupPermissionHandlers } from './permissions'
import { setupContextHandlers } from './context'
import { setupCommandHandlers } from './commands'
import { setupStoreHandlers } from './store-ipc'

export function setupIPC(win: BrowserWindow): void {
  setupAIHandlers(win)
  setupPermissionHandlers(win)
  setupContextHandlers(win)
  setupCommandHandlers(win)
  setupStoreHandlers()

  // Window & App controls
  ipcMain.handle('window:hide', () => win.hide())
  ipcMain.handle('window:minimize', () => win.minimize())
  ipcMain.handle('window:close', () => win.close())
  ipcMain.handle('app:quit', () => {
    const { app } = require('electron')
    app.quit()
  })
  ipcMain.handle('window:toggleFullscreen', () => {
    const next = !win.isFullScreen()
    win.setFullScreen(next)
    // Notify renderer so it can update UI
    win.webContents.send('window:fullscreenChange', next)
    return next
  })
  ipcMain.handle('window:isFullscreen', () => win.isFullScreen())

  // Forward native fullscreen events (F11, OS gesture)
  win.on('enter-full-screen', () => win.webContents.send('window:fullscreenChange', true))
  win.on('leave-full-screen', () => win.webContents.send('window:fullscreenChange', false))
}

