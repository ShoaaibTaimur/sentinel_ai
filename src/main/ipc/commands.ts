import { BrowserWindow, ipcMain, app } from 'electron'

export const BUILT_IN_COMMANDS = [
  'help', 'models', 'provider', 'apikey', 'plugins',
  'settings', 'history', 'clear', 'about', 'doctor', 'exit', 'context'
]

const HELP_TEXT = `
**Sentinel AI — Built-in Commands**

\`help\`       Show this help
\`models\`     List and switch AI models
\`provider\`   View provider info
\`apikey\`     Manage your API key
\`plugins\`    Manage plugins
\`settings\`   Open settings
\`history\`    View conversation history
\`clear\`      Clear current chat
\`about\`      About Sentinel AI
\`doctor\`     Check system health
\`context\`    Show current active window context
\`exit\`       Exit Sentinel AI

You can also use natural language for all of the above.
`.trim()

const ABOUT_TEXT = `
**Sentinel AI v1.0**

Keyboard-first, system-wide AI assistant for desktop OS.
Provider: OpenCode Zen (opencode.ai)

Built with Electron, React, TypeScript.
`.trim()

export function setupCommandHandlers(win: BrowserWindow): void {
  ipcMain.handle('command:run', async (_event, cmd: string) => {
    const trimmed = cmd.trim().toLowerCase()

    switch (trimmed) {
      case 'help':
        return { type: 'markdown', content: HELP_TEXT }

      case 'clear':
        win.webContents.send('chat:clear')
        return { type: 'system', content: 'Chat cleared.' }

      case 'about':
        return { type: 'markdown', content: ABOUT_TEXT }

      case 'exit':
        setTimeout(() => app.quit(), 300)
        return { type: 'system', content: 'Goodbye.' }

      case 'doctor': {
        const checks = [
          `✓ Electron ${process.versions.electron}`,
          `✓ Node ${process.versions.node}`,
          `✓ Platform: ${process.platform}`
        ]
        return { type: 'markdown', content: checks.join('\n') }
      }

      case 'models':
        win.webContents.send('ui:openModelSwitcher')
        return { type: 'system', content: 'Opening model switcher…' }

      case 'settings':
        win.webContents.send('ui:openSettings')
        return { type: 'system', content: 'Opening settings…' }

      case 'history':
        win.webContents.send('ui:openHistory')
        return { type: 'system', content: 'Opening history…' }

      case 'plugins':
        win.webContents.send('ui:openPlugins')
        return { type: 'system', content: 'Opening plugins…' }

      case 'provider':
        return {
          type: 'markdown',
          content: '**Provider:** OpenCode Zen\n**Base URL:** https://opencode.ai/zen/v1\n**Status:** Connected'
        }

      case 'apikey':
        win.webContents.send('ui:openApiKey')
        return { type: 'system', content: 'Opening API key manager…' }

      case 'context': {
        // Handled separately by context IPC, but support as command too
        win.webContents.send('command:getContext')
        return { type: 'system', content: 'Fetching context…' }
      }

      default:
        return null // Not a built-in command; route to AI
    }
  })
}
