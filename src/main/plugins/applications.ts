import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'

const execPromise = promisify(exec)

export const applicationsPlugin = {
  async launch(args: { name: string }) {
    const isMac = process.platform === 'darwin'
    const isLinux = process.platform === 'linux'
    const name = args.name.trim()

    if (isMac) {
      await execPromise(`open -a "${name}"`)
      return { success: true, launched: name }
    }

    if (isLinux) {
      // 1. Try xdg-open if it looks like a path or URL
      if (name.startsWith('/') || name.startsWith('http://') || name.startsWith('https://')) {
        await execPromise(`xdg-open "${name}"`)
        return { success: true, opened: name }
      }

      // 2. Try gtk-launch (which uses desktop files)
      try {
        // Look for desktop file in /usr/share/applications or ~/.local/share/applications
        const desktopFiles = await getLinuxDesktopFiles()
        const match = desktopFiles.find(f => 
          f.name.toLowerCase() === name.toLowerCase() || 
          f.id.toLowerCase() === `${name.toLowerCase()}.desktop`
        )
        if (match) {
          await execPromise(`gtk-launch "${match.id}"`)
          return { success: true, launched: match.name, via: 'gtk-launch' }
        }
      } catch {
        // Fallback
      }

      // 3. Fallback: run application as background process
      const proc = exec(name)
      proc.unref()
      return { success: true, launched: name, via: 'spawn' }
    }

    return { error: 'Unsupported platform' }
  },

  async close(args: { name: string }) {
    const isMac = process.platform === 'darwin'
    const isLinux = process.platform === 'linux'
    const name = args.name.trim()

    if (isMac) {
      await execPromise(`osascript -e 'tell application "${name}" to quit'`)
      return { success: true, closed: name }
    }

    if (isLinux) {
      // Kill by process name or matching pattern
      await execPromise(`pkill -f "${name}" || killall "${name}"`)
      return { success: true, closed: name }
    }

    return { error: 'Unsupported platform' }
  },

  async focus(args: { name: string }) {
    const isMac = process.platform === 'darwin'
    const isLinux = process.platform === 'linux'
    const name = args.name.trim()

    if (isMac) {
      await execPromise(`osascript -e 'tell application "${name}" to activate'`)
      return { success: true, focused: name }
    }

    if (isLinux) {
      // Use wmctrl if available
      try {
        await execPromise(`wmctrl -a "${name}"`)
        return { success: true, focused: name, via: 'wmctrl' }
      } catch {
        // If wmctrl not found, report error
        return { error: 'wmctrl not installed or failed to focus' }
      }
    }

    return { error: 'Unsupported platform' }
  },

  async list() {
    const isMac = process.platform === 'darwin'
    const isLinux = process.platform === 'linux'

    if (isMac) {
      const { stdout } = await execPromise(`osascript -e 'tell application "System Events" to get name of every process whose background only is false'`)
      return stdout.split(',').map(s => s.trim())
    }

    if (isLinux) {
      // Use wmctrl to list windows, or look at desktop files
      try {
        const { stdout } = await execPromise(`wmctrl -l`)
        const lines = stdout.split('\n').filter(Boolean)
        return lines.map(line => {
          // Format of wmctrl -l: 0x03400003  0 shoaib-desktop Sentinel AI
          const parts = line.split(/\s+/)
          const title = parts.slice(3).join(' ')
          return { id: parts[0], host: parts[2], title }
        })
      } catch {
        // Fallback to desktop apps list
        const files = await getLinuxDesktopFiles()
        return files.map(f => f.name)
      }
    }

    return []
  }
}

// Helper to scan for installed desktop files on Linux
async function getLinuxDesktopFiles() {
  const dirs = [
    '/usr/share/applications',
    '/usr/local/share/applications',
    path.join(process.env.HOME || '', '.local/share/applications')
  ]
  const list: Array<{ id: string; name: string }> = []

  for (const dir of dirs) {
    try {
      const files = await fs.readdir(dir)
      for (const file of files) {
        if (file.endsWith('.desktop')) {
          try {
            const content = await fs.readFile(path.join(dir, file), 'utf-8')
            const nameLine = content.split('\n').find(l => l.startsWith('Name='))
            if (nameLine) {
              list.push({
                id: file,
                name: nameLine.split('=')[1].trim()
              })
            }
          } catch {
            // Ignore unreadable
          }
        }
      }
    } catch {
      // Directory may not exist
    }
  }

  return list
}
