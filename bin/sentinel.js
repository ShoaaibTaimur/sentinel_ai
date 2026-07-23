#!/usr/bin/env node

const net = require('net')
const path = require('path')
const os = require('os')

function getSocketPath() {
  if (process.platform === 'win32') {
    return '\\\\.\\pipe\\sentinel-ai'
  }
  return path.join(os.tmpdir(), 'sentinel-ai.sock')
}

const args = process.argv.slice(2)
const inputPath = args[0] || '.'
const targetPath = path.resolve(process.cwd(), inputPath)

const socketPath = getSocketPath()
const client = net.createConnection(socketPath, () => {
  const payload = JSON.stringify({ action: 'PIN_PATH', targetPath }) + '\n'
  client.write(payload)
})

let responseReceived = false

client.on('data', (data) => {
  responseReceived = true
  try {
    const res = JSON.parse(data.toString().trim())
    if (res.status === 'ok') {
      console.log(`\x1b[32m✔ Pinned to Sentinel AI:\x1b[0m ${targetPath}`)
    } else {
      console.error(`\x1b[31m✖ Error from Sentinel AI:\x1b[0m ${res.message}`)
    }
  } catch {
    console.log(data.toString().trim())
  }
  client.end()
})

client.on('error', (err) => {
  if (err.code === 'ENOENT' || err.code === 'ECONNREFUSED') {
    console.error(`\x1b[31m✖ Sentinel AI application is not currently running.\x1b[0m`)
    console.error(`  Please start Sentinel AI application first.`)
  } else {
    console.error(`\x1b[31m✖ Failed to connect to Sentinel AI:\x1b[0m`, err.message)
  }
  process.exit(1)
})

setTimeout(() => {
  if (!responseReceived) {
    client.destroy()
    process.exit(0)
  }
}, 3000)
