import * as fs from 'fs/promises'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execPromise = promisify(exec)

async function walk(dir: string, pattern: string): Promise<string[]> {
  const cleanDir = path.resolve(dir)
  let cleanPattern = pattern
  if (!cleanPattern.includes('*')) {
    cleanPattern = `*${cleanPattern}*`
  }

  // macOS Spotlight fast path
  if (process.platform === 'darwin') {
    const command = `mdfind -onlyin "${cleanDir}" "kMDItemFSName == '${cleanPattern}'"`
    try {
      const { stdout } = await execPromise(command, { timeout: 5000 })
      const res = stdout.split('\n').map(l => l.trim()).filter(Boolean)
      if (res.length > 0) return res
    } catch {
      // Fallback to find
    }
  }

  // Windows PowerShell fast path
  if (process.platform === 'win32') {
    const command = `powershell -Command "Get-ChildItem -Path '${cleanDir}' -Filter '${cleanPattern}' -Recurse -File -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName"`
    try {
      const { stdout } = await execPromise(command, { timeout: 6000 })
      const res = stdout.split('\n').map(l => l.trim()).filter(Boolean)
      if (res.length > 0) return res
    } catch {
      // Fallback
    }
  }

  // Linux & macOS deep find path
  if (process.platform === 'linux' || process.platform === 'darwin') {
    // Only exclude heavy build caches — DO NOT exclude hidden dot directories like .config, .local, etc.
    const excludePattern = `\\( -type d \\( -name "node_modules" -o -name ".git" -o -name "dist" -o -name "out" -o -name "build" \\) \\) -prune`
    const command = `find "${cleanDir}" ${excludePattern} -o -type f -iname "${cleanPattern}" -print`
    try {
      const { stdout } = await execPromise(command, { timeout: 8000 })
      const res = stdout.split('\n').map(l => l.trim()).filter(Boolean)
      if (res.length > 0) return res
    } catch {
      // Fallback
    }
  }

  return walkJS(cleanDir, pattern, 0)
}

async function walkJS(dir: string, pattern: string, depth: number): Promise<string[]> {
  if (depth > 5) return []
  const results: string[] = []
  
  let list: fs.Dirent[] = []
  try {
    list = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  
  const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i')

  for (const file of list) {
    const resPath = path.resolve(dir, file.name)
    if (file.isDirectory()) {
      if (
        file.name.startsWith('.') || 
        file.name === 'node_modules' || 
        file.name === 'dist' || 
        file.name === 'out' || 
        file.name === 'build'
      ) {
        continue
      }
      try {
        const sub = await walkJS(resPath, pattern, depth + 1)
        results.push(...sub)
      } catch {}
    } else {
      if (regex.test(file.name) || regex.test(resPath)) {
        results.push(resPath)
      }
    }
  }
  return results
}


export const filesystemPlugin = {
  async listDir(args: { directory: string }) {
    const target = path.resolve(args.directory)
    const files = await fs.readdir(target, { withFileTypes: true })
    return files.map(f => ({
      name: f.name,
      isDirectory: f.isDirectory(),
      size: f.isFile() ? (f as any).size : undefined
    }))
  },

  async readFile(args: { path: string }) {
    const target = path.resolve(args.path)
    return await fs.readFile(target, 'utf-8')
  },

  async createFile(args: { path: string; content: string }) {
    const target = path.resolve(args.path)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, args.content, 'utf-8')
    return { success: true, path: target }
  },

  async writeFile(args: { path: string; content: string }) {
    const target = path.resolve(args.path)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, args.content, 'utf-8')
    return { success: true, path: target }
  },

  async deleteFile(args: { path: string }) {
    const target = path.resolve(args.path)
    const stat = await fs.stat(target)
    if (stat.isDirectory()) {
      await fs.rm(target, { recursive: true, force: true })
    } else {
      await fs.unlink(target)
    }
    return { success: true, path: target }
  },

  async renameFile(args: { oldPath: string; newPath: string }) {
    const src = path.resolve(args.oldPath)
    const dest = path.resolve(args.newPath)
    await fs.rename(src, dest)
    return { success: true, from: src, to: dest }
  },

  async copyFile(args: { src: string; dest: string }) {
    const src = path.resolve(args.src)
    const dest = path.resolve(args.dest)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    const stat = await fs.stat(src)
    if (stat.isDirectory()) {
      await fs.cp(src, dest, { recursive: true })
    } else {
      await fs.copyFile(src, dest)
    }
    return { success: true, from: src, to: dest }
  },

  async moveFile(args: { src: string; dest: string }) {
    const src = path.resolve(args.src)
    const dest = path.resolve(args.dest)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.rename(src, dest)
    return { success: true, from: src, to: dest }
  },

  async searchFiles(args: { pattern: string; directory: string }) {
    const dir = path.resolve(args.directory)
    const results = await walk(dir, args.pattern)
    if (results.length === 0) {
      return {
        success: false,
        count: 0,
        results: [],
        message: `No files found matching pattern "${args.pattern}" in directory "${dir}". Deep system search completed.`
      }
    }
    return {
      success: true,
      count: results.length,
      results: results.slice(0, 50)
    }
  },

  async findDuplicates(args: { directory: string }) {
    const dir = path.resolve(args.directory)
    const files: { [hash: string]: string[] } = {}
    const list = await walk(dir, '*')
    
    // Quick size-based duplicate detection (or simple content hash)
    // To keep it fast and dependency-free, let's compare sizes first
    const sizeMap: { [size: number]: string[] } = {}
    for (const f of list) {
      try {
        const stat = await fs.stat(f)
        if (stat.isFile()) {
          const size = stat.size
          if (!sizeMap[size]) sizeMap[size] = []
          sizeMap[size].push(f)
        }
      } catch {
        // Skip unreadable files
      }
    }

    const duplicates: string[][] = []
    for (const size in sizeMap) {
      if (sizeMap[size].length > 1) {
        duplicates.push(sizeMap[size])
      }
    }
    return duplicates
  }
}
