import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as os from 'os'

export async function applyAutostartSetting(enabled: boolean): Promise<void> {
  if (process.platform === 'linux') {
    const autostartDir = path.join(os.homedir(), '.config', 'autostart')
    const desktopFilePath = path.join(autostartDir, 'sentinel-ai.desktop')

    if (enabled) {
      // Use process.env.APPIMAGE if running as AppImage package to avoid temporary /tmp/.mount path
      const realExecPath = process.env.APPIMAGE || app.getPath('exe')
      const appPath = app.getAppPath()
      const isPackaged = app.isPackaged

      // Standard freedesktop Exec line format
      const execCommand = isPackaged
        ? realExecPath
        : `${realExecPath} ${appPath} --no-sandbox`

      const desktopContent = `[Desktop Entry]
Type=Application
Version=1.0
Name=Sentinel AI
Comment=Keyboard-first desktop AI assistant
Exec=${execCommand}
Icon=sentinel-ai
StartupNotify=true
Terminal=false
Categories=Utility;Development;
X-GNOME-Autostart-enabled=true
`
      try {
        await fs.mkdir(autostartDir, { recursive: true })
        await fs.writeFile(desktopFilePath, desktopContent, 'utf-8')
      } catch (err) {
        console.error('Failed to write autostart desktop file:', err)
      }
    } else {
      try {
        await fs.rm(desktopFilePath, { force: true })
      } catch (err) {
        console.error('Failed to remove autostart desktop file:', err)
      }
    }
  } else {
    try {
      const realExecPath = process.env.APPIMAGE || app.getPath('exe')
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: false,
        path: realExecPath
      })
    } catch (err) {
      console.error('Failed to set login item settings:', err)
    }
  }
}
