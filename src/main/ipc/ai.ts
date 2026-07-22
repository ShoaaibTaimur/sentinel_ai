import { BrowserWindow, ipcMain } from 'electron'
import { streamChatWithUsage, fetchModels, validateApiKey, MODEL_CONTEXT_LIMITS, DEFAULT_CONTEXT_LIMIT } from '../providers/opencode-zen'
import { getModel, setModel, getApiKey, setApiKey } from '../store'
import { TOOLS, HANDLERS, executeTool } from '../plugins'
import { terminalPlugin } from '../plugins/terminal'
import { clearPendingPermissions } from './permissions'
import activeWin from 'active-win'


export function setupAIHandlers(win: BrowserWindow): void {
  let activeAbortController: AbortController | null = null
  let activeRequestId: string | null = null

  ipcMain.handle('ai:cancel', () => {
    activeRequestId = null
    if (activeAbortController) {
      activeAbortController.abort()
      activeAbortController = null
    }
    clearPendingPermissions()
    terminalPlugin.killActiveCommand()
    win.webContents.send('ai:status', null)
    return { ok: true }
  })

  ipcMain.handle(
    'ai:chat',
    async (
      _event,
      messages: Array<any>
    ) => {
      const currentRequestId = crypto.randomUUID()
      activeRequestId = currentRequestId

      if (activeAbortController) {
        activeAbortController.abort()
      }
      activeAbortController = new AbortController()
      const signal = activeAbortController.signal

      const isCurrent = () => activeRequestId === currentRequestId && !signal.aborted

      const sendToken = (tok: string) => {
        if (isCurrent()) win.webContents.send('ai:token', tok)
      }
      const sendStatus = (st: string | null) => {
        if (isCurrent()) win.webContents.send('ai:status', st)
      }
      const sendUsage = (u: any) => {
        if (isCurrent()) win.webContents.send('ai:usage', u)
      }
      const sendDone = (content: string) => {
        if (isCurrent()) win.webContents.send('ai:done', content)
      }
      const sendError = (errMsg: string) => {
        if (isCurrent()) win.webContents.send('ai:error', errMsg)
      }

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
          content: `You are Sentinel AI, a keyboard-first, system-wide desktop AI assistant created and developed by Md Shoaaib Taimur (Website: https://sentinel.taimur.dev | Portfolio: https://taimur.dev).
Platform: ${process.platform} (${process.arch})
Home: ${require('os').homedir()}
Developer: Md Shoaaib Taimur (https://taimur.dev)
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

11. **File Opening vs Creation**: If a requested file, folder, or application is not found when the user asks to open, read, or view it, report that it was not found. Do NOT call \`fs_create_file\` or \`fs_write_file\` to create a new file unless the user explicitly requested creating a file.

12. **System-Wide Deep File Search**: You have full system access to find files anywhere on the OS, including deeply nested directories. Search from home (\`~\`) or root (\`/\`) using \`fs_search\`. If no matches are found, report explicitly to the user that the file was not found on the system after a deep search.

13. **Official Dedicated Website**: When asked for your dedicated website, official web page, or download link, specify your official dedicated website: https://sentinel.taimur.dev alongside the creator's portfolio: https://taimur.dev.`
        }

        const currentMessages = [systemPrompt, ...messages]
        let loop = true
        let finalContent = ''
        let accumulatedContent = ''
        let loopCount = 0
        const MAX_LOOPS = 30

        while (loop && loopCount < MAX_LOOPS) {
          loopCount++
          if (!isCurrent()) {
            throw new Error('Cancelled by user')
          }
          let hasToolCalls = false
          const toolCalls: any[] = []
          let content = ''

          for await (const chunk of streamChatWithUsage(currentMessages, TOOLS, { signal })) {
            if (!isCurrent()) {
              throw new Error('Cancelled by user')
            }
            if (chunk.token) {
              content += chunk.token
              sendToken(chunk.token)
            }
            if (chunk.toolCalls) {
              hasToolCalls = true
              toolCalls.push(...chunk.toolCalls)
            }
            if (chunk.usage) {
              const model = getModel()
              const contextLimit = MODEL_CONTEXT_LIMITS[model] ?? DEFAULT_CONTEXT_LIMIT
              sendUsage({
                promptTokens: chunk.usage.prompt_tokens,
                completionTokens: chunk.usage.completion_tokens,
                totalTokens: chunk.usage.total_tokens,
                contextLimit
              })
            }
          }

          if (content) {
            accumulatedContent += (accumulatedContent && !accumulatedContent.endsWith('\n') ? '\n\n' : '') + content
          }

          if (!isCurrent()) {
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
            sendStatus('Executing action...')

            // Execute all tool calls
            for (const tc of toolCalls) {
              if (!isCurrent()) {
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
              sendStatus(toolReason)

              // Run the tool with permission gate
              const result = await executeTool(win, name, args)

              if (!isCurrent() || (result && result.error === 'Permission denied by user')) {
                throw new Error('Cancelled by user')
              }

              currentMessages.push({
                role: 'tool',
                tool_call_id: tc.id,
                name: name,
                content: JSON.stringify(result)
              })
            }

            // Status update: tool execution finished, processing output
            sendStatus('Processing response...')
            // Continue loop with updated messages history containing tool outputs
          } else {
            // No tool calls, we are done
            finalContent = accumulatedContent || content
            loop = false
          }
        }

        if (loopCount >= MAX_LOOPS && loop) {
          finalContent = (accumulatedContent ? accumulatedContent + '\n\n' : '') + '⚠️ Maximum task step limit (30 iterations) reached. Type "continue" to proceed further.'
        } else if (!finalContent || !finalContent.trim()) {
          finalContent = accumulatedContent.trim() || 'Task completed successfully.'
        }

        if (isCurrent()) {
          sendStatus(null)
          sendDone(finalContent)
        }
        return { ok: true, content: finalContent }
      } catch (err: unknown) {
        if (!isCurrent()) {
          return { ok: false, error: 'Cancelled by user' }
        }

        sendStatus(null)
        let msg = err instanceof Error ? err.message : String(err)

        if (msg === 'Cancelled by user' || signal.aborted) {
          return { ok: false, error: 'Cancelled by user' }
        }

        // Format user-friendly error messages for 500 / network / authorization errors
        if (msg.includes('500') || msg.includes('Internal Server Error')) {
          msg = 'OpenCode Zen API server error (500). Please try again in a moment or select a different AI model in Settings.'
        } else if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('invalid api key')) {
          msg = 'Invalid API key. Please check your OpenCode Zen API key in Settings.'
        } else if (msg.includes('429') || msg.includes('Rate limit')) {
          msg = 'Rate limit exceeded. Please wait a few seconds before trying again.'
        }

        sendError(msg)
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
