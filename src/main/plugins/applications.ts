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

    let target = await findMatchingFileOrFolder(queryPath)
    if (!target) {
      if (path.isAbsolute(queryPath)) {
        try {
          await fs.stat(queryPath)
          target = queryPath
        } catch {}
      }
    }

    if (!target) {
      return { error: `File or directory not found: ${queryPath}` }
    }

    const binMap: Record<string, string> = {
      'code': 'code',
      'vscode': 'code',
      'vs code': 'code',
      'cursor': 'cursor',
      'trae': 'trae',
      'windsurf': 'windsurf',
      'sublime': 'subl',
      'subl': 'subl',
      'sublime text': 'subl',
      'webstorm': 'webstorm',
      'pycharm': 'pycharm',
      'clion': 'clion',
      'intellij': 'idea',
      'idea': 'idea',
      'phpstorm': 'phpstorm',
      'goland': 'goland',
      'rider': 'rider',
      'android studio': 'android-studio',
      'android-studio': 'android-studio',
      'studio': 'android-studio',
      'vim': 'vim',
      'nvim': 'nvim',
      'neovim': 'nvim',
      'emacs': 'emacs'
    }

    const execBin = binMap[ide] || ide
    const command = `"${execBin}" "${target}"`

    try {
      const proc = exec(command)
      proc.unref()
      return { success: true, message: `Opened in ${execBin}` }
    } catch (err: any) {
      return { error: `Failed to open in ${execBin}: ${err.message}` }
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

function isSafeToSearch(dirPath: string): boolean {
  try {
    const resolved = path.resolve(dirPath)
    const normalized = resolved.replace(/\\/g, '/')
    const { root } = path.parse(resolved)
    if (resolved === root || normalized === '/') return false
    
    const lower = normalized.toLowerCase()
    if (
      lower === '/home' || 
      lower === '/users' || 
      lower === 'c:/users' || 
      lower === 'd:/users'
    ) {
      return false
    }
    
    const systemDirs = [
      '/usr', '/var', '/etc', '/opt', '/boot', '/sys', '/proc', 
      '/dev', '/run', '/tmp', '/lib', '/lib64', '/media', '/srv',
      '/sbin', '/bin', '/root'
    ]
    if (systemDirs.some(sys => lower === sys || lower.startsWith(sys + '/'))) {
      return false
    }
    
    if (
      lower.startsWith('c:/windows') || 
      lower.startsWith('c:/program files') || 
      lower.startsWith('c:/programdata')
    ) {
      return false
    }
    
    return true
  } catch {
    return false
  }
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
  
  const addIfSafe = (dir: string) => {
    if (isSafeToSearch(dir)) {
      searchRoots.add(dir)
    }
  }

  // 1. Sibling & parent directories of current workspace CWD
  try {
    addIfSafe(path.join(cwd, '..'))
    addIfSafe(path.join(cwd, '../..'))
    addIfSafe(path.join(cwd, '../../..'))
  } catch {}
  
  // 2. Common developer directories
  addIfSafe(path.join(homedir, 'Code'))
  addIfSafe(path.join(homedir, 'Projects'))
  addIfSafe(path.join(homedir, 'Development'))
  addIfSafe(homedir)
  
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
      const excludePattern = `\\( -type d \\( -name ".*" ! -name "." ! -name ".." -o -name "node_modules" -o -name "bower_components" -o -name "dist" -o -name "out" -o -name "build" -o -name "target" -o -name "venv" -o -name "env" -o -name "tmp" -o -name "temp" \\) \\) -prune`
      
      // Try exact match first
      let command = `find "${startDir}" ${excludePattern} -o -type d -iname "${cleanQuery}" -print -quit`
      try {
        const { stdout } = await execPromise(command, { timeout: 2000 })
        const trimmed = stdout.trim()
        if (trimmed) return trimmed
      } catch {}

      // Fallback to partial match
      command = `find "${startDir}" ${excludePattern} -o -type d -iname "*${cleanQuery}*" -print -quit`
      try {
        const { stdout } = await execPromise(command, { timeout: 2000 })
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
  
  const addIfSafe = (dir: string) => {
    if (isSafeToSearch(dir)) {
      searchRoots.add(dir)
    }
  }

  try {
    addIfSafe(cwd)
    addIfSafe(path.join(cwd, '..'))
    addIfSafe(path.join(cwd, '../..'))
    addIfSafe(path.join(cwd, '../../..'))
  } catch {}
  addIfSafe(path.join(homedir, 'Code'))
  addIfSafe(path.join(homedir, 'Projects'))
  addIfSafe(path.join(homedir, 'Development'))
  addIfSafe(homedir)
  
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
      const excludePattern = `\\( -type d \\( -name ".*" ! -name "." ! -name ".." -o -name "node_modules" -o -name "bower_components" -o -name "dist" -o -name "out" -o -name "build" -o -name "target" -o -name "venv" -o -name "env" -o -name "tmp" -o -name "temp" \\) \\) -prune`
      
      // Try exact match first
      let command = `find "${startDir}" ${excludePattern} -o \\( -type f -o -type d \\) -iname "${cleanQuery}" -print -quit`
      try {
        const { stdout } = await execPromise(command, { timeout: 2000 })
        const trimmed = stdout.trim()
        if (trimmed) return trimmed
      } catch {}

      // Fallback to partial match
      command = `find "${startDir}" ${excludePattern} -o \\( -type f -o -type d \\) -iname "*${cleanQuery}*" -print -quit`
      try {
        const { stdout } = await execPromise(command, { timeout: 2000 })
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
