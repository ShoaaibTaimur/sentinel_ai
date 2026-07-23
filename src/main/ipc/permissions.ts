import { BrowserWindow, ipcMain, dialog } from 'electron'
import { getAlwaysAllow, addAlwaysAllow, removeAlwaysAllow } from '../store'

export interface PermissionRequest {
  id: string
  action: string
  command: string
  reason: string
  risk: 'low' | 'medium' | 'high'
}

// Pending permission promises keyed by request id
const pending = new Map<string, (result: 'allow' | 'always' | 'deny') => void>()

export function setupPermissionHandlers(win: BrowserWindow): void {
  ipcMain.handle('permission:respond', (_event, id: string, result: 'allow' | 'always' | 'deny') => {
    const resolve = pending.get(id)
    if (resolve) {
      resolve(result)
      pending.delete(id)
    }
  })

  ipcMain.handle('permission:getAlwaysAllow', () => {
    return getAlwaysAllow()
  })

  ipcMain.handle('permission:removeAlwaysAllow', (_event, action: string) => {
    removeAlwaysAllow(action)
    return true
  })
}

export async function requestPermission(
  win: BrowserWindow,
  req: PermissionRequest
): Promise<boolean> {
  const alwaysAllow = getAlwaysAllow()
  const category = req.action.split(':')[0]

  if (
    alwaysAllow.includes('*') ||
    alwaysAllow.includes('all') ||
    alwaysAllow.includes(req.action) ||
    alwaysAllow.includes(`${category}:*`) ||
    alwaysAllow.includes(category)
  ) {
    return true
  }

  // Auto-approve non-destructive GUI, apps, context, and file reading actions
  if (
    req.risk === 'low' ||
    req.action.startsWith('apps:') ||
    req.action.startsWith('gui:') ||
    req.action.startsWith('context:') ||
    req.action.startsWith('browser:') ||
    req.action === 'fs:read' ||
    req.action === 'fs:read_active' ||
    req.action === 'fs:list' ||
    req.action === 'fs:create' ||
    req.action === 'fs:write' ||
    req.action === 'fs:edit'
  ) {
    return true
  }

  // macOS Accessibility: Never trigger system modal loops
  if (process.platform === 'darwin') {
    try {
      const { systemPreferences } = require('electron')
      if (systemPreferences?.isTrustedAccessibilityClient && systemPreferences.isTrustedAccessibilityClient(false)) {
        return true
      }
    } catch {
      // Ignore
    }
  }

  return new Promise((resolve) => {
    pending.set(req.id, (result) => {
      if (result === 'always') {
        addAlwaysAllow(req.action)
        addAlwaysAllow(`${category}:*`)
      }
      resolve(result !== 'deny')
    })
    win.webContents.send('permission:request', req)
  })
}

export function clearPendingPermissions(): void {
  for (const [id, resolve] of pending.entries()) {
    resolve('deny')
  }
  pending.clear()
}

