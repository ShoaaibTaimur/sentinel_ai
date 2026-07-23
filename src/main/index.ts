import { app, BrowserWindow, globalShortcut, shell, screen, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupHotkey } from './hotkey'
import { setupStore } from './store'
import { setupIPC } from './ipc'
import { startBackgroundService } from './background-service'
import { setupCLIServer } from './cli-server'

import { execSync } from 'child_process'
import os from 'os'
import path from 'path'

// ── Inherit Interactive Shell PATH Environment ────────────────────────────────
function loadInteractiveShellEnv(): void {
  if (process.platform === 'win32') return
  try {
    const userShell = process.env.SHELL || '/bin/bash'
    const output = execSync(`${userShell} -ic 'echo __PATH_START__; echo "$PATH"; echo __PATH_END__'`, {
      encoding: 'utf-8',
      timeout: 2500
    })
    const match = output.match(/__PATH_START__\n([\s\S]*?)\n__PATH_END__/)
    if (match && match[1]) {
      const shellPath = match[1].trim()
      if (shellPath) {
        const current = (process.env.PATH || '').split(':')
        const loaded = shellPath.split(':')
        process.env.PATH = Array.from(new Set([...loaded, ...current])).filter(Boolean).join(':')
      }
    }
  } catch {
    // Fallback if interactive shell spawn fails
  }

  const homedir = os.homedir()
  const extraPaths = [
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/snap/bin',
    path.join(homedir, '.local/bin'),
    path.join(homedir, '.cargo/bin'),
    path.join(homedir, '.nvm/versions/node'),
    '/var/lib/flatpak/exports/bin',
    path.join(homedir, '.local/share/flatpak/exports/bin')
  ]
  const existing = (process.env.PATH || '').split(':')
  process.env.PATH = Array.from(new Set([...existing, ...extraPaths])).filter(Boolean).join(':')
}

loadInteractiveShellEnv()

// ── Linux HiDPI / fractional scaling fix ──────────────────────────────────────
// Must run before app.whenReady. Fixes blurry rendering on Zorin/GNOME with
// 125%/150% display scaling (Chromium renders at 1x and OS upscales otherwise).
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('force-color-profile', 'srgb')
  app.commandLine.appendSwitch('high-dpi-support', '1')
  app.commandLine.appendSwitch('enable-accelerated-2d-canvas', 'true')
  app.commandLine.appendSwitch('disable-software-rasterizer', 'true')
}

let mainWindow: BrowserWindow | null = null

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

function createWindow(): BrowserWindow {
  // Match display scale factor for crisp rendering on HiDPI / fractional scaling
  const scaleFactor = screen.getPrimaryDisplay().scaleFactor

  const iconPath = join(__dirname, '../../resources/icon.png')
  const appIcon = nativeImage.createFromPath(iconPath)

  mainWindow = new BrowserWindow({
    width: 780,
    height: 540,
    minWidth: 640,
    minHeight: 440,
    show: false,
    frame: false,
    transparent: true,
    resizable: true,
    center: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#00000000',
    icon: appIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // Apply fractional scale factor so Chromium renders at native resolution
      zoomFactor: scaleFactor
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
    mainWindow!.focus()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('blur', () => {
    // Keep window open when losing focus (user may click elsewhere)
  })

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('ai.sentinel')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupStore()
  const win = createWindow()
  setupHotkey(win)
  setupIPC(win)
  startBackgroundService(win)
  setupCLIServer(win)

  if (win) {
    win.show()
    win.focus()
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
