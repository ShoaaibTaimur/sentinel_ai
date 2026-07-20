import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as os from 'os'

export async function applyAutostartSetting(enabled: boolean): Promise<void> {
  if (process.platform === 'linux') {
    const autostartDir = path.join(os.homedir(), '.config', 'autostart')
    const desktopFilePath = path.join(autostartDir, 'sentinel-ai.desktop')

    if (enabled) {
      const execPath = app.getPath('exe')
      const appPath = app.getAppPath()
      const isPackaged = app.isPackaged
      
      const execLine = isPackaged
        ? `Exec="${execPath}"`
        : `Exec="${execPath}" "${appPath}" --no-sandbox`
      
      const iconPath = path.join(appPath, 'resources', 'icon.svg')

      const desktopContent = `[Desktop Entry]
Type=Application
Version=1.0
Name=Sentinel AI
Comment=Sentinel AI Assistant
${execLine}
Icon=${iconPath}
StartupNotify=false
Terminal=false
Categories=Utility;
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
      app.setLoginItemSettings({
        openAtLogin: enabled,
        path: app.getPath('exe')
      })
    } catch (err) {
      console.error('Failed to set login item settings:', err)
    }
  }
}
