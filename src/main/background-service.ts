import { BrowserWindow, Tray, nativeImage } from 'electron'
import { join } from 'path'

let tray: Tray | null = null

export function startBackgroundService(win: BrowserWindow): void {
  // Prevent app quit when all windows are closed on macOS
  // Tray icon for quick access
  try {
    const iconPath = join(__dirname, '../../resources/tray-icon.png')
    const icon = nativeImage.createFromPath(iconPath)
    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
    tray.setToolTip('Sentinel AI')
    tray.on('click', () => {
      if (win.isVisible()) {
        win.hide()
      } else {
        win.show()
        win.focus()
      }
    })
  } catch {
    // Tray optional — don't crash if icon missing
  }
}
