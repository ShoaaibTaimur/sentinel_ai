import * as fs from 'fs/promises'
import * as path from 'path'
import { glob } from 'glob' // Let's check if glob or other packages are available, or use a simple recursive walk.
// Let's implement recursive walk ourselves to avoid depending on external glob if not installed.

async function walk(dir: string, pattern: string): Promise<string[]> {
  const results: string[] = []
  const list = await fs.readdir(dir, { withFileTypes: true })
  const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i')

  for (const file of list) {
    const resPath = path.resolve(dir, file.name)
    if (file.isDirectory()) {
      try {
        const sub = await walk(resPath, pattern)
        results.push(...sub)
      } catch {
        // Skip inaccessible dirs
      }
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
    return results.slice(0, 50) // Limit to top 50 matches
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
