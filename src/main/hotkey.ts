import { BrowserWindow, globalShortcut } from 'electron'

export function setupHotkey(win: BrowserWindow): void {
  // Super+Space = show/hide Sentinel
  const registered = globalShortcut.register('Super+Space', () => {
    if (win.isVisible()) {
      win.hide()
    } else {
      win.show()
      win.focus()
    }
  })

  if (!registered) {
    console.warn('[hotkey] Super+Space registration failed. Trying Alt+Space fallback.')
    globalShortcut.register('Alt+Space', () => {
      if (win.isVisible()) {
        win.hide()
      } else {
        win.show()
        win.focus()
      }
    })
  }
}
