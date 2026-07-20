import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'


const execPromise = promisify(exec)

export const applicationsPlugin = {
  async launch(args: { name: string }) {
    const isMac = process.platform === 'darwin'
    const isLinux = process.platform === 'linux'
    const name = args.name.trim()

    const isUrl = name.startsWith('http://') || name.startsWith('https://') || /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/\S*)?$/.test(name)
    let target = name
    if (isUrl && !target.startsWith('http://') && !target.startsWith('https://')) {
      target = `https://${target}`
    }

    let resolvedPath = name
    let isLocalFileOrFolder = false
    if (!isUrl) {
      try {
        await fs.stat(name)
        resolvedPath = path.resolve(name)
        isLocalFileOrFolder = true
      } catch {
        const found = await findMatchingFileOrFolder(name)
        if (found) {
          resolvedPath = found
          isLocalFileOrFolder = true
        }
      }
    }

    if (isMac) {
      if (isUrl || isLocalFileOrFolder) {
        await execPromise(`open "${resolvedPath}"`)
        return { success: true, opened: resolvedPath }
      }
      await execPromise(`open -a "${name}"`)
      return { success: true, launched: name }
    }

    if (isLinux) {
      if (isUrl || isLocalFileOrFolder) {
        await execPromise(`xdg-open "${resolvedPath}"`)
        return { success: true, opened: resolvedPath }
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
  },

  async openProject(args: { path: string; ide?: string }) {
    const queryPath = args.path.trim()
    const ide = (args.ide || 'code').trim().toLowerCase()

    const targetFolder = await findMatchingFolder(queryPath)
    if (!targetFolder) {
      return { error: `Directory not found: ${queryPath}` }
    }

    let command = ''
    if (ide === 'code' || ide === 'vscode' || ide === 'vs code') {
      command = `code "${targetFolder}"`
    } else if (ide === 'cursor') {
      command = `cursor "${targetFolder}"`
    } else if (ide === 'trae') {
      command = `trae "${targetFolder}"`
    } else if (ide === 'windsurf') {
      command = `windsurf "${targetFolder}"`
    } else {
      command = `${ide} "${targetFolder}"`
    }

    try {
      const proc = exec(command)
      proc.unref()
      return { success: true, message: `Opened project in ${ide}` }
    } catch (err: any) {
      return { error: `Failed to open project in ${ide}: ${err.message}` }
    }
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

async function findMatchingFolder(query: string): Promise<string | null> {
  // If absolute path, use it directly
  if (path.isAbsolute(query)) {
    try {
      const stats = await fs.stat(query)
      if (stats.isDirectory()) {
        return query
      }
    } catch {}
  }

  const cleanQuery = query.replace(/[\\/]+$/, '').toLowerCase()

  // Build candidate root directories to search in
  const homedir = os.homedir()
  const cwd = process.cwd()
  
  const searchRoots = new Set<string>()
  
  // 1. Sibling & parent directories of current workspace CWD
  try {
    searchRoots.add(path.join(cwd, '..'))
    searchRoots.add(path.join(cwd, '../..'))
    searchRoots.add(path.join(cwd, '../../..'))
  } catch {}
  
  // 2. Common developer directories
  searchRoots.add(path.join(homedir, 'Code'))
  searchRoots.add(path.join(homedir, 'Projects'))
  searchRoots.add(path.join(homedir, 'Development'))
  searchRoots.add(homedir)
  
  const startDirs = Array.from(searchRoots)

  for (const startDir of startDirs) {
    if (process.platform === 'darwin') {
      const command = `mdfind -onlyin "${startDir}" "kMDItemFSName == '*${cleanQuery}*' && kMDItemContentType == 'public.folder'" | head -n 1`
      try {
        const { stdout } = await execPromise(command, { timeout: 3000 })
        const trimmed = stdout.trim()
        if (trimmed) return trimmed
      } catch {}
    } else if (process.platform === 'win32') {
      const command = `powershell -Command "Get-ChildItem -Path '${startDir}' -Filter '*${cleanQuery}*' -Recurse -Directory -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName"`
      try {
        const { stdout } = await execPromise(command, { timeout: 3500 })
        const trimmed = stdout.trim()
        if (trimmed) return trimmed
      } catch {}
    } else if (process.platform === 'linux') {
      const excludePattern = `\\( -path "*/node_modules" -o -path "*/.*" -o -path "*/dist" -o -path "*/out" -o -path "*/build" \\) -prune`
      const command = `find "${startDir}" ${excludePattern} -o -type d -iname "*${cleanQuery}*" -print -quit`
      try {
        const { stdout } = await execPromise(command, { timeout: 3000 })
        const trimmed = stdout.trim()
        if (trimmed) return trimmed
      } catch {}
    }

    const result = await searchDirRecursive(startDir, cleanQuery, 1)
    if (result) return result
  }
  
  return null
}

async function searchDirRecursive(dir: string, query: string, depth: number): Promise<string | null> {
  if (depth > 4) return null

  let entries: fs.Dirent[] = []
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return null
  }

  // Phase 1: Exact matches in this directory level
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name.toLowerCase() === query) {
        return path.join(dir, entry.name)
      }
    }
  }

  // Phase 2: Partial matches in this directory level
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name.toLowerCase().includes(query)) {
        return path.join(dir, entry.name)
      }
    }
  }

  // Phase 3: Recurse into children
  for (const entry of entries) {
    if (
      entry.isDirectory() && 
      !entry.name.startsWith('.') && 
      entry.name !== 'node_modules' && 
      entry.name !== 'dist' && 
      entry.name !== 'out' &&
      entry.name !== 'build'
    ) {
      const result = await searchDirRecursive(path.join(dir, entry.name), query, depth + 1)
      if (result) return result
    }
  }

  return null
}

async function findMatchingFileOrFolder(query: string): Promise<string | null> {
  if (path.isAbsolute(query)) {
    try {
      const stats = await fs.stat(query)
      return query
    } catch {}
  }

  const cleanQuery = query.replace(/[\\/]+$/, '').toLowerCase()

  const homedir = os.homedir()
  const cwd = process.cwd()
  
  const searchRoots = new Set<string>()
  try {
    searchRoots.add(cwd)
    searchRoots.add(path.join(cwd, '..'))
    searchRoots.add(path.join(cwd, '../..'))
    searchRoots.add(path.join(cwd, '../../..'))
  } catch {}
  searchRoots.add(path.join(homedir, 'Code'))
  searchRoots.add(path.join(homedir, 'Projects'))
  searchRoots.add(path.join(homedir, 'Development'))
  searchRoots.add(homedir)
  
  const startDirs = Array.from(searchRoots)

  for (const startDir of startDirs) {
    if (process.platform === 'darwin') {
      const command = `mdfind -onlyin "${startDir}" "kMDItemFSName == '*${cleanQuery}*'" | head -n 1`
      try {
        const { stdout } = await execPromise(command, { timeout: 3000 })
        const trimmed = stdout.trim()
        if (trimmed) return trimmed
      } catch {}
    } else if (process.platform === 'win32') {
      const command = `powershell -Command "Get-ChildItem -Path '${startDir}' -Filter '*${cleanQuery}*' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName"`
      try {
        const { stdout } = await execPromise(command, { timeout: 3500 })
        const trimmed = stdout.trim()
        if (trimmed) return trimmed
      } catch {}
    } else if (process.platform !== 'win32') {
      const excludePattern = `\\( -path "*/node_modules" -o -path "*/.*" -o -path "*/dist" -o -path "*/out" -o -path "*/build" \\) -prune`
      const command = `find "${startDir}" ${excludePattern} -o \\( -type f -o -type d \\) -iname "*${cleanQuery}*" -print -quit`
      try {
        const { stdout } = await execPromise(command, { timeout: 3000 })
        const trimmed = stdout.trim()
        if (trimmed) return trimmed
      } catch {}
    }

    const result = await searchDirRecursiveFiles(startDir, cleanQuery, 1)
    if (result) return result
  }
  
  return null
}

async function searchDirRecursiveFiles(dir: string, query: string, depth: number): Promise<string | null> {
  if (depth > 4) return null

  let entries: fs.Dirent[] = []
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return null
  }

  for (const entry of entries) {
    if (entry.name.toLowerCase() === query) {
      return path.join(dir, entry.name)
    }
  }

  for (const entry of entries) {
    if (entry.name.toLowerCase().includes(query)) {
      return path.join(dir, entry.name)
    }
  }

  for (const entry of entries) {
    if (
      entry.isDirectory() && 
      !entry.name.startsWith('.') && 
      entry.name !== 'node_modules' && 
      entry.name !== 'dist' && 
      entry.name !== 'out' &&
      entry.name !== 'build'
    ) {
      const result = await searchDirRecursiveFiles(path.join(dir, entry.name), query, depth + 1)
      if (result) return result
    }
  }

  return null
}
