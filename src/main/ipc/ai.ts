import { BrowserWindow, ipcMain } from 'electron'
import { streamChatWithUsage, fetchModels, validateApiKey, MODEL_CONTEXT_LIMITS, DEFAULT_CONTEXT_LIMIT } from '../providers/opencode-zen'
import { getModel, setModel, getApiKey, setApiKey } from '../store'
import { TOOLS, executeTool } from '../plugins'
import { terminalPlugin } from '../plugins/terminal'
import activeWin from 'active-win'

export function setupAIHandlers(win: BrowserWindow): void {
  let isCancelled = false
  let activeAbortController: AbortController | null = null

  ipcMain.handle('ai:cancel', () => {
    isCancelled = true
    if (activeAbortController) {
      activeAbortController.abort()
      activeAbortController = null
    }
    terminalPlugin.killActiveCommand()
    return { ok: true }
  })

  ipcMain.handle(
    'ai:chat',
    async (
      _event,
      messages: Array<any>
    ) => {
      isCancelled = false
      activeAbortController = new AbortController()
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
          content: `You are Sentinel AI, a keyboard-first desktop AI assistant.
Current Platform: ${process.platform}
${activeContextStr}

Capabilities & Guidelines:
1. Active Window Interaction: You can write, insert text, or edit the user's active window/screen context by calling the \`gui_simulate_input\` tool. Do NOT tell the user about any interaction limitations. Simply call the tool.
2. Local Files: If the active window is an editor/file, the tool will update it directly.
3. Web Applications & Browsers:
   - For native, hands-free browser automation (navigating, clicking, typing, creating items like Google Keep notes): Use the MCP Browser tools (\`mcp_browser_open\`, \`mcp_browser_close\`, \`mcp_browser_click\`, \`mcp_browser_type\`, \`mcp_browser_exec\`, \`mcp_browser_get_content\`). This opens a dedicated child window inside the app context and works 100% reliably on Linux Wayland/X11, macOS, and Windows.
   - For Google Keep note creation:
     1. Open keep: Call \`mcp_browser_open\` with URL "https://keep.google.com".
     2. Wait/fetch: Use \`mcp_browser_get_content\` to inspect DOM/page text.
     3. Click new note: Use \`mcp_browser_click\` on selector \`div[role="button"][aria-label="Take a note..."]\` (or other text area).
     4. Type text: Use \`mcp_browser_type\` to write note contents into Keep input fields.
     5. Close/Save: Use \`mcp_browser_click\` on the "Close" button (e.g. selector \`div[role="button"][aria-label="Close"]\`) or execute Escape.
4. CRITICAL BROWSER WEB REQUIREMENT: For ANY action, change, analysis, editing, or reading of any website (including Google Keep, search engines, or any active tab):
   - You MUST require the user to provide the link/URL of the site if it is not already in the active context. Do NOT proceed without the link.
   - Once provided, you MUST fetch the website contents using either the \`web_fetch\` tool or the \`mcp_browser_get_content\` tool to verify the DOM structure or contents before analyzing, summarizing, or interacting.
   - You MUST launch or focus the site using \`mcp_browser_open\` or \`apps_launch\` with the URL.
   - You MUST execute all browser interactions (clicking buttons, filling inputs, creating notes, or making edits) using the \`mcp_browser_\` tools, OR fallback to \`gui_simulate_input\` with \`actionType: "exec-js"\` when running in standard X11 session.
   - NEVER hallucinate web page state. Always use these browser tools to perform MCP-style browser automation.`
        }

        const currentMessages = [systemPrompt, ...messages]
        let loop = true
        let finalContent = ''

        while (loop) {
          if (isCancelled) {
            throw new Error('Cancelled by user')
          }
          let hasToolCalls = false
          const toolCalls: any[] = []
          let content = ''

          for await (const chunk of streamChatWithUsage(currentMessages, TOOLS, { signal: activeAbortController?.signal })) {
            if (isCancelled) {
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

          if (isCancelled) {
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

            // Let user know we are preparing to run tools
            win.webContents.send('ai:token', '\n\n*Sentinel is performing action...*\n')

            // Execute all tool calls
            for (const tc of toolCalls) {
              if (isCancelled) {
                throw new Error('Cancelled by user')
              }
              const name = tc.function.name
              let args = {}
              try {
                args = JSON.parse(tc.function.arguments)
              } catch {
                args = {}
              }

              // Run the tool with permission gate
              const result = await executeTool(win, name, args)

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

        win.webContents.send('ai:done', finalContent)
        return { ok: true, content: finalContent }
      } catch (err: unknown) {
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
