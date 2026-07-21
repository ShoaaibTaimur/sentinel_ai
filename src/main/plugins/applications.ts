import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { shell } from 'electron'

const execPromise = promisify(exec)

export const applicationsPlugin = {
  async launch(args: { name: string }) {
    const isMac = process.platform === 'darwin'
    const isLinux = process.platform === 'linux'
    const rawName = args.name.trim()

    // 1. Check if user request is asking to open in an IDE (e.g. "sentinelai in cursor", "open project in trae")
    const ideMap: Record<string, string> = {
      'cursor': 'cursor',
      'trae': 'trae',
      'antigravity': 'antigravity',
      'windsurf': 'windsurf',
      'vscode': 'code',
      'vs code': 'code',
      'code': 'code',
      'sublime': 'subl',
      'subl': 'subl',
      'webstorm': 'webstorm',
      'pycharm': 'pycharm'
    }

    for (const [key, ideVal] of Object.entries(ideMap)) {
      const regex = new RegExp(`\\b(in|with|using)?\\s*${key}\\b`, 'gi')
      if (regex.test(rawName)) {
        const cleanFolderQuery = rawName.replace(regex, '').replace(/\b(open|launch|project|folder|app)\b/gi, '').trim()
        const targetPath = cleanFolderQuery || os.homedir()
        return await this.openProject({ path: targetPath, ide: ideVal })
      }
    }

    // Clean file manager & directory keywords (e.g. "sentinelai in file manager" -> "sentinelai")
    const fmKeywords = ['file manager', 'file explorer', 'nautilus', 'dolphin', 'nemo', 'thunar', 'pcmanfm', 'explorer', 'finder', 'folder', 'directory']
    let cleanQuery = rawName
    let isFileManagerReq = false

    for (const kw of fmKeywords) {
      if (cleanQuery.toLowerCase().includes(kw)) {
        isFileManagerReq = true
        cleanQuery = cleanQuery.replace(new RegExp(`\\b(in|with|using|the|open)?\\s*${kw}\\b`, 'gi'), '').trim()
        break
      }
    }

    if (isFileManagerReq && !cleanQuery) {
      const err = await shell.openPath(os.homedir())
      if (!err) return { success: true, opened: os.homedir(), via: 'shell.openPath' }
    }

    const searchQuery = cleanQuery || rawName
    const isUrl = searchQuery.startsWith('http://') || searchQuery.startsWith('https://') || /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/\S*)?$/.test(searchQuery)
    let target = searchQuery
    if (isUrl && !target.startsWith('http://') && !target.startsWith('https://')) {
      target = `https://${target}`
    }

    let resolvedPath = searchQuery
    let isLocalFileOrFolder = false
    if (!isUrl) {
      try {
        await fs.stat(searchQuery)
        resolvedPath = path.resolve(searchQuery)
        isLocalFileOrFolder = true
      } catch {
        const found = await findMatchingFileOrFolder(searchQuery)
        if (found) {
          resolvedPath = found
          isLocalFileOrFolder = true
        }
      }
    }

    if (isLocalFileOrFolder) {
      const openErr = await shell.openPath(resolvedPath)
      if (!openErr) {
        return { success: true, opened: resolvedPath, via: 'shell.openPath' }
      }
    }

    if (isMac) {
      if (isUrl) {
        await execPromise(`open "${target}"`)
        return { success: true, opened: target }
      }
      try {
        await execPromise(`open -a "${rawName}"`)
        return { success: true, launched: rawName }
      } catch {
        return { error: `File or application not found: ${rawName}` }
      }
    }

    if (isLinux) {
      if (isUrl) {
        await execPromise(`xdg-open "${target}"`)
        return { success: true, opened: target }
      }

      // 2. Try gtk-launch (which uses desktop files)
      try {
        const desktopFiles = await getLinuxDesktopFiles()
        const match = desktopFiles.find(f => 
          f.name.toLowerCase() === rawName.toLowerCase() || 
          f.id.toLowerCase() === `${rawName.toLowerCase()}.desktop`
        )
        if (match) {
          await execPromise(`gtk-launch "${match.id}"`, { env: getEnrichedEnv() })
          return { success: true, launched: match.name, via: 'gtk-launch' }
        }
      } catch {
        // Fallback
      }

      // 3. Fallback: check if binary exists in PATH before spawning
      try {
        await execPromise(`which "${rawName}"`, { env: getEnrichedEnv() })
        const proc = spawn(rawName, [], { detached: true, stdio: 'ignore', env: getEnrichedEnv() })
        proc.unref()
        return { success: true, launched: rawName, via: 'spawn' }
      } catch {
        return { error: `File or application not found: ${rawName}` }
      }
    }

    return { error: `File or application not found: ${rawName}` }
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
      'antigravity': 'antigravity',
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
    const homedir = os.homedir()
    const candidates = [
      execBin,
      `/usr/bin/${execBin}`,
      `/usr/local/bin/${execBin}`,
      path.join(homedir, '.local/bin', execBin),
      `/snap/bin/${execBin}`
    ]

    for (const binPath of candidates) {
      try {
        if (binPath.includes('/')) {
          await fs.access(binPath, fs.constants.X_OK)
        }
        const proc = spawn(binPath, [target], {
          detached: true,
          stdio: 'ignore',
          env: getEnrichedEnv()
        })
        proc.unref()
        return { success: true, message: `Opened in ${execBin}` }
      } catch {}
    }

    if (process.platform === 'linux') {
      try {
        const desktopFiles = await getLinuxDesktopFiles()
        const match = desktopFiles.find(f => 
          f.name.toLowerCase().includes(execBin) || 
          f.id.toLowerCase().includes(execBin) ||
          f.name.toLowerCase().includes(ide) ||
          f.id.toLowerCase().includes(ide)
        )
        if (match) {
          await execPromise(`gtk-launch "${match.id}" "${target}"`, { env: getEnrichedEnv() })
          return { success: true, message: `Opened in ${match.name} via gtk-launch` }
        }
      } catch {}
    }

    return { error: `Failed to open in ${execBin}` }
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

function getEnrichedEnv() {
  const env = { ...process.env }
  const homedir = os.homedir()
  const extraPaths = [
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/snap/bin',
    path.join(homedir, '.local/bin'),
    path.join(homedir, '.cargo/bin'),
    '/var/lib/flatpak/exports/bin',
    path.join(homedir, '.local/share/flatpak/exports/bin')
  ]
  const currentPath = env.PATH || ''
  env.PATH = Array.from(new Set([...extraPaths, ...currentPath.split(':')])).filter(Boolean).join(':')
  return env
}

function isSafeToSearch(dirPath: string): boolean {
  try {
    const resolved = path.resolve(dirPath)
    const normalized = resolved.replace(/\\/g, '/')
    const { root } = path.parse(resolved)
    if (resolved === root || normalized === '/') return false
    
    const lower = normalized.toLowerCase()
    
    const systemDirs = [
      '/usr', '/var', '/etc', '/opt', '/boot', '/sys', '/proc', 
      '/dev', '/run', '/tmp', '/lib', '/lib64', '/srv',
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
  const isPackagedApp = cwd === '/' || cwd.includes('.app/Contents') || cwd.includes('/resources/app') || cwd.endsWith('/out') || cwd.endsWith('/dist')
  
  const searchRoots = new Set<string>()
  
  const addIfSafe = (dir: string) => {
    if (isSafeToSearch(dir)) {
      searchRoots.add(dir)
    }
  }

  // 1. Sibling & parent directories of current workspace CWD (if valid project workspace)
  if (!isPackagedApp) {
    try {
      addIfSafe(cwd)
      addIfSafe(path.join(cwd, '..'))
      addIfSafe(path.join(cwd, '../..'))
      addIfSafe(path.join(cwd, '../../..'))
    } catch {}
  }
  
  // 2. Common developer directories & user homedir
  addIfSafe(homedir)
  addIfSafe(path.join(homedir, 'Desktop'))
  addIfSafe(path.join(homedir, 'Documents'))
  addIfSafe(path.join(homedir, 'Downloads'))
  addIfSafe(path.join(homedir, 'Code'))
  addIfSafe(path.join(homedir, 'Projects'))
  addIfSafe(path.join(homedir, 'Development'))

  // 3. Scan mounted media/mnt drives (e.g. /mnt/personal, /media/$USER/*)
  const mountBases = ['/mnt', '/media', path.join('/media', os.userInfo().username)]
  for (const mbase of mountBases) {
    try {
      const entries = await fs.readdir(mbase)
      for (const entry of entries) {
        addIfSafe(path.join(mbase, entry))
      }
    } catch {}
  }

  // macOS system-wide Spotlight fast-path check first
  if (process.platform === 'darwin') {
    const sysCmd = `mdfind "kMDItemFSName == '*${cleanQuery}*' && kMDItemContentType == 'public.folder'" | head -n 1`
    try {
      const { stdout } = await execPromise(sysCmd, { timeout: 3000 })
      const trimmed = stdout.trim()
      if (trimmed) return trimmed
    } catch {}
  }
  
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
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      if (entry.name.toLowerCase() === query) {
        return path.join(dir, entry.name)
      }
    }
  }

  // Phase 2: Partial matches in this directory level
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
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
  const isPackagedApp = cwd === '/' || cwd.includes('.app/Contents') || cwd.includes('/resources/app') || cwd.endsWith('/out') || cwd.endsWith('/dist')
  
  const searchRoots = new Set<string>()
  
  const addIfSafe = (dir: string) => {
    if (isSafeToSearch(dir)) {
      searchRoots.add(dir)
    }
  }

  if (!isPackagedApp) {
    try {
      addIfSafe(cwd)
      addIfSafe(path.join(cwd, '..'))
      addIfSafe(path.join(cwd, '../..'))
      addIfSafe(path.join(cwd, '../../..'))
    } catch {}
  }

  addIfSafe(homedir)
  addIfSafe(path.join(homedir, 'Desktop'))
  addIfSafe(path.join(homedir, 'Documents'))
  addIfSafe(path.join(homedir, 'Downloads'))
  addIfSafe(path.join(homedir, 'Code'))
  addIfSafe(path.join(homedir, 'Projects'))
  addIfSafe(path.join(homedir, 'Development'))

  const mountBases = ['/mnt', '/media', path.join('/media', os.userInfo().username)]
  for (const mbase of mountBases) {
    try {
      const entries = await fs.readdir(mbase)
      for (const entry of entries) {
        addIfSafe(path.join(mbase, entry))
      }
    } catch {}
  }

  // macOS system-wide Spotlight fast-path check first
  if (process.platform === 'darwin') {
    const sysCmd = `mdfind "kMDItemFSName == '*${cleanQuery}*'" | head -n 1`
    try {
      const { stdout } = await execPromise(sysCmd, { timeout: 3000 })
      const trimmed = stdout.trim()
      if (trimmed) return trimmed
    } catch {}
  }
  
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
    if (!entry.name.startsWith('.')) {
      if (entry.name.toLowerCase() === query) {
        return path.join(dir, entry.name)
      }
    }
  }

  for (const entry of entries) {
    if (!entry.name.startsWith('.')) {
      if (entry.name.toLowerCase().includes(query)) {
        return path.join(dir, entry.name)
      }
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
