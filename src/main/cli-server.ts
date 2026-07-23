import net from 'net'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { BrowserWindow } from 'electron'

function getSocketPath(): string {
  if (process.platform === 'win32') {
    return '\\\\.\\pipe\\sentinel-ai'
  }
  return path.join(os.tmpdir(), 'sentinel-ai.sock')
}

export function setupCLIServer(win: BrowserWindow): net.Server {
  const socketPath = getSocketPath()

  if (process.platform !== 'win32') {
    if (fs.existsSync(socketPath)) {
      try {
        fs.unlinkSync(socketPath)
      } catch {
        // Ignore error if socket removal fails
      }
    }
  }

  const server = net.createServer((socket) => {
    let dataBuffer = ''

    socket.on('data', (chunk) => {
      dataBuffer += chunk.toString()
      if (dataBuffer.includes('\n')) {
        const lines = dataBuffer.split('\n')
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const payload = JSON.parse(line.trim())
            if (payload.action === 'PIN_PATH' && payload.targetPath) {
              const absPath = path.resolve(payload.targetPath)
              let isDir = false
              let exists = false
              try {
                const stat = fs.statSync(absPath)
                exists = true
                isDir = stat.isDirectory()
              } catch {
                // Ignore stat errors if path non-existent
              }

              if (exists) {
                if (win.isMinimized()) win.restore()
                win.show()
                win.focus()

                const name = path.basename(absPath) || absPath
                win.webContents.send('context:pathPinned', {
                  path: absPath,
                  name,
                  isDir
                })

                socket.write(JSON.stringify({ status: 'ok', message: `Pinned ${name}` }) + '\n')
              } else {
                socket.write(JSON.stringify({ status: 'error', message: `Path does not exist: ${absPath}` }) + '\n')
              }
            }
          } catch (err) {
            socket.write(JSON.stringify({ status: 'error', message: 'Invalid payload' }) + '\n')
          }
        }
      }
    })
  })

  server.listen(socketPath, () => {
    // Set socket file permissions on Linux/macOS so non-root users can write to it
    if (process.platform !== 'win32') {
      try {
        fs.chmodSync(socketPath, '0777')
      } catch {
        // Ignore chmod errors
      }
    }
  })

  return server
}
