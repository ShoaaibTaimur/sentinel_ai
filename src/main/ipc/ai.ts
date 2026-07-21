import { BrowserWindow, ipcMain } from 'electron'
import { streamChatWithUsage, fetchModels, validateApiKey, MODEL_CONTEXT_LIMITS, DEFAULT_CONTEXT_LIMIT } from '../providers/opencode-zen'
import { getModel, setModel, getApiKey, setApiKey } from '../store'
import { TOOLS, HANDLERS, executeTool } from '../plugins'
import { terminalPlugin } from '../plugins/terminal'
import { clearPendingPermissions } from './permissions'
import activeWin from 'active-win'


export function setupAIHandlers(win: BrowserWindow): void {
  let activeAbortController: AbortController | null = null

  ipcMain.handle('ai:cancel', () => {
    if (activeAbortController) {
      activeAbortController.abort()
      activeAbortController = null
    }
    clearPendingPermissions()
    terminalPlugin.killActiveCommand()
    return { ok: true }
  })

  ipcMain.handle(
    'ai:chat',
    async (
      _event,
      messages: Array<any>
    ) => {
      if (activeAbortController) {
        activeAbortController.abort()
      }
      activeAbortController = new AbortController()
      const signal = activeAbortController.signal

      try {
        const active = await activeWin().catch(() => null)
        const isLinux = process.platform === 'linux'
        const isWayland = isLinux && (process.env.XDG_SESSION_TYPE === 'wayland' || !!process.env.WAYLAND_DISPLAY)

        let activeContextStr = active
          ? `Active Window Info:\n- App: ${active.owner.name}\n- Window Title: ${active.title}\n- URL: ${(active as any).url || 'none'}`
          : 'Active Window Info: Unknown'

        if (isWayland) {
          activeContextStr += `\n- Session Type: Wayland\nNote: Active window detection and virtual keyboard/mouse event simulation are blocked under Wayland. You CANNOT simulate typing or hotkeys (like opening/saving a note in Keep). Instead, you MUST use clipboard fallback (call gui_simulate_input or copy text) and guide the user to paste manually with Ctrl+V. If the user wants to analyze/inspect a webpage/tab, you MUST ask them for the URL first, then fetch it with web_fetch, then guide them accordingly.`
        }

        const systemPrompt = {
          role: 'system',
          content: `You are Sentinel AI, a keyboard-first, system-wide desktop AI assistant.
Platform: ${process.platform} (${process.arch})
Home: ${require('os').homedir()}
${activeContextStr}

## Capabilities & Strict Rules

1. **Active Window / Screen Reading**:
   - When the user says "read what I have open", "what's on my screen", "read current file", or similar: call \`fs_read_active_file\`. This reads the active editor file's content from the filesystem.
   - Do NOT guess file content. Always call \`fs_read_active_file\` first.

2. **File Editing**:
   - When the user asks to edit, fix, rewrite, or update a specific file: first call \`fs_read_active_file\` or \`fs_read_file\` to get current content, then call \`fs_edit_file\` with the complete new content.
   - \`fs_edit_file\` overwrites the entire file. Always include the full file content.
   - For smaller edits inside files, you may also use \`fs_write_file\`.

3. **Web Apps & Browser Automation**:
   - For native browser automation (clicking, typing, creating Keep notes): Use MCP Browser tools (\`mcp_browser_open\`, \`mcp_browser_click\`, \`mcp_browser_type\`, \`mcp_browser_exec\`, \`mcp_browser_get_content\`).
   - Works reliably on Linux Wayland/X11, macOS, and Windows.

4. **Opening Websites (User Viewing)**:
   - When user says "open YouTube", "open Facebook", "open google.com": call \`apps_launch\` with the full URL. Do NOT use MCP browser for this.
   - For multiple pages, call \`apps_launch\` once per URL.

5. **Opening Projects in IDEs**:
   - When user says "open [project/folder] in VS Code / Cursor / Trae / Windsurf": call \`apps_open_project\` with the folder path and IDE name.
   - Supported IDE values: \`code\` (VS Code), \`cursor\`, \`trae\`, \`windsurf\`.
   - The tool will search for the folder by name if an absolute path isn't given.

6. **Opening Files**:
   - When user asks to open a specific file (not an IDE project): call \`apps_launch\` with the filename or path. It opens with the system default application.

7. **System-Wide File & Folder Search**:
   - Use \`fs_search\` with a pattern for file content searching.
   - For opening files/folders by partial name: \`apps_launch\` and \`apps_open_project\` both accept partial names and resolve them via fast native \`find\` / \`mdfind\` / PowerShell search.

8. **Platform Notes**:
   - Linux Wayland: keyboard simulation blocked. Use clipboard fallback or MCP browser.
   - macOS: uses AppleScript for input simulation and \`mdfind\` for fast file indexing.
   - Windows: uses PowerShell \`Get-ChildItem\` for file search.

9. **Critical Browser Rule**: NEVER hallucinate web page state. Always fetch/read with \`web_fetch\` or \`mcp_browser_get_content\` before acting on web content.

10. **Only Act On Latest Request**: ONLY execute tools or perform actions for the LATEST user message in the chat history. Do NOT re-execute tools or perform actions for past messages in the conversation history. If a past message contains an instruction (e.g., "open project X"), and it is followed by newer messages, IGNORE the past instruction completely and focus only on the latest request.

11. **File Opening vs Creation**: If a requested file, folder, or application is not found when the user asks to open, read, or view it, report that it was not found. Do NOT call \`fs_create_file\` or \`fs_write_file\` to create a new file unless the user explicitly requested creating a file.`
        }

        const currentMessages = [systemPrompt, ...messages]
        let loop = true
        let finalContent = ''

        while (loop) {
          if (signal.aborted) {
            throw new Error('Cancelled by user')
          }
          let hasToolCalls = false
          const toolCalls: any[] = []
          let content = ''

          for await (const chunk of streamChatWithUsage(currentMessages, TOOLS, { signal })) {
            if (signal.aborted) {
              throw new Error('Cancelled by user')
            }
            if (chunk.token) {
              content += chunk.token
              win.webContents.send('ai:token', chunk.token)
            }
            if (chunk.toolCalls) {
              hasToolCalls = true
              toolCalls.push(...chunk.toolCalls)
            }
            if (chunk.usage) {
              const model = getModel()
              const contextLimit = MODEL_CONTEXT_LIMITS[model] ?? DEFAULT_CONTEXT_LIMIT
              win.webContents.send('ai:usage', {
                promptTokens: chunk.usage.prompt_tokens,
                completionTokens: chunk.usage.completion_tokens,
                totalTokens: chunk.usage.total_tokens,
                contextLimit
              })
            }
          }

          if (signal.aborted) {
            throw new Error('Cancelled by user')
          }

          if (hasToolCalls && toolCalls.length > 0) {
            // Append assistant message requesting tool calls
            const assistantMsg = {
              role: 'assistant',
              content: content || null,
              tool_calls: toolCalls
            }
            currentMessages.push(assistantMsg)

            // Let user know tool action is running via status event
            win.webContents.send('ai:status', 'Executing action...')

            // Execute all tool calls
            for (const tc of toolCalls) {
              if (signal.aborted) {
                throw new Error('Cancelled by user')
              }
              const name = tc.function.name
              let args = {}
              try {
                args = JSON.parse(tc.function.arguments)
              } catch {
                args = {}
              }

              const handler = HANDLERS[name]
              const toolReason = handler ? handler.reason(args) : `Executing ${name}...`
              win.webContents.send('ai:status', toolReason)

              // Run the tool with permission gate
              const result = await executeTool(win, name, args)

              if (signal.aborted || (result && result.error === 'Permission denied by user')) {
                throw new Error('Cancelled by user')
              }

              currentMessages.push({
                role: 'tool',
                tool_call_id: tc.id,
                name: name,
                content: JSON.stringify(result)
              })
            }

            // Continue loop with updated messages history containing tool outputs
          } else {
            // No tool calls, we are done
            finalContent = content
            loop = false
          }
        }

        win.webContents.send('ai:status', null)
        win.webContents.send('ai:done', finalContent)
        return { ok: true, content: finalContent }
      } catch (err: unknown) {
        win.webContents.send('ai:status', null)
        const msg = err instanceof Error ? err.message : String(err)
        win.webContents.send('ai:error', msg)
        return { ok: false, error: msg }
      }
    }
  )

  ipcMain.handle('ai:models', async () => fetchModels())

  ipcMain.handle('ai:getModel', () => getModel())

  ipcMain.handle('ai:setModel', (_event, model: string) => {
    setModel(model)
    win.webContents.send('ai:modelChanged', model)
    return { ok: true }
  })

  ipcMain.handle('ai:getApiKey', () => {
    const key = getApiKey()
    if (!key) return { key: '', masked: '' }
    return { key, masked: '•'.repeat(Math.max(0, key.length - 4)) + key.slice(-4) }
  })

  ipcMain.handle('ai:setApiKey', async (_event, key: string) => {
    const valid = await validateApiKey(key)
    if (valid) {
      setApiKey(key)
      return { ok: true }
    }
    return { ok: false, error: 'Invalid API key. Check opencode.ai/auth' }
  })

  ipcMain.handle('ai:validateKey', async (_event, key: string) => validateApiKey(key))
}
