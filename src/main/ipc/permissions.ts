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
  if (alwaysAllow.includes(req.action)) return true

  // Auto-approve low risk actions (read file, list dir, search, web fetch, focus window)
  if (req.risk === 'low') return true

  // Auto-approve non-destructive launcher and GUI automation actions
  if (
    req.action === 'apps:open_project' ||
    req.action === 'apps:launch' ||
    req.action === 'fs:read' ||
    req.action === 'gui:input' ||
    req.action === 'apps:focus' ||
    req.action === 'fs:read_active'
  ) return true

  // macOS: Check if system accessibility permission is granted without triggering prompt loops
  if (process.platform === 'darwin') {
    try {
      const { systemPreferences } = require('electron')
      if (systemPreferences?.isTrustedAccessibilityClient && systemPreferences.isTrustedAccessibilityClient(false)) {
        if (req.action === 'gui:input' || req.action === 'apps:focus') {
          return true
        }
      }
    } catch {
      // Ignore
    }
  }

  return new Promise((resolve) => {
    pending.set(req.id, (result) => {
      if (result === 'always') {
        addAlwaysAllow(req.action)
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

