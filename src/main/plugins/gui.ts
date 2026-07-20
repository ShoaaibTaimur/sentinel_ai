import { clipboard } from 'electron'
import { execSync } from 'child_process'
import activeWin from 'active-win'
import fs from 'fs'
import path from 'path'
import os from 'os'

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

interface GuiInputArgs {
  text: string
  actionType?: 'type' | 'clipboard' | 'edit-file' | 'exec-js'
}

export const guiPlugin = {
  async simulateInput(args: GuiInputArgs): Promise<{ success: boolean; method: string; message: string }> {
    const active = await activeWin()
    const isMac = process.platform === 'darwin'
    const isLinux = process.platform === 'linux'
    const isWayland = isLinux && (process.env.XDG_SESSION_TYPE === 'wayland' || !!process.env.WAYLAND_DISPLAY)

    // Method 1: Try direct file editing if target is a local text file
    if (active && args.actionType !== 'clipboard' && args.actionType !== 'exec-js') {
      const windowTitle = active.title
      const fileRegex = /(?:\/|[A-Za-z]:\\)[\w\-. \\\/\(\)]+\.\w+/g
      const matches = windowTitle.match(fileRegex)
      
      let filePath = matches ? matches[0] : null
      if (!filePath) {
        const nameRegex = /([\w\-]+\.\w+)\b/
        const nameMatch = windowTitle.match(nameRegex)
        if (nameMatch) {
          const filename = nameMatch[1]
          const workspaceRoot = process.cwd()
          if (isSafeToSearch(workspaceRoot) && workspaceRoot !== os.homedir()) {
            const searchInDir = (dir: string, depth = 0): string | null => {
              if (depth > 5) return null
              const files = fs.readdirSync(dir)
              for (const file of files) {
                const full = path.join(dir, file)
                if (file === '.git' || file === 'node_modules' || file === 'out') continue
                const stat = fs.statSync(full)
                if (stat.isDirectory()) {
                  const found = searchInDir(full, depth + 1)
                  if (found) return found
                } else if (file === filename) {
                  return full
                }
              }
              return null
            }
            try {
              filePath = searchInDir(workspaceRoot)
            } catch {
              // Ignore
            }
          }
        }
      }

      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.writeFileSync(filePath, args.text, 'utf8')
          return {
            success: true,
            method: 'edit-file',
            message: `Successfully edited local file directly at: ${filePath}`
          }
        } catch (err: any) {
          // Fall through
        }
      }
    }

    // Method 2: JS Execution mode (open console, paste, run, close)
    if (args.actionType === 'exec-js') {
      // Put JS snippet in clipboard so python script can paste it
      clipboard.writeText(args.text)
      
      try {
        const tempScriptPath = path.join('/tmp', 'sentinel_gui_simulate.py')
        const pythonScriptContent = `import sys
import time
import argparse

try:
    from pynput.keyboard import Key, Controller
except ImportError:
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--text', type=str, default="")
    parser.add_argument('--action', type=str, default="type")
    args = parser.parse_args()

    keyboard = Controller()
    time.sleep(1.2)
    is_mac = sys.platform == "darwin"

    if args.action == "exec-js":
        if is_mac:
            with keyboard.pressed(Key.cmd, Key.alt):
                keyboard.tap('j')
        else:
            with keyboard.pressed(Key.ctrl, Key.shift):
                keyboard.tap('j')
        time.sleep(1.0)
        if is_mac:
            with keyboard.pressed(Key.cmd):
                keyboard.tap('v')
        else:
            with keyboard.pressed(Key.ctrl):
                keyboard.tap('v')
        time.sleep(0.3)
        keyboard.tap(Key.enter)
        time.sleep(0.5)
        if is_mac:
            with keyboard.pressed(Key.cmd, Key.alt):
                keyboard.tap('j')
        else:
            with keyboard.pressed(Key.ctrl, Key.shift):
                keyboard.tap('j')
    print("Success")

if __name__ == "__main__":
    main()
`
        fs.writeFileSync(tempScriptPath, pythonScriptContent, 'utf8')
        execSync(`python3 ${tempScriptPath} --action exec-js`)
        return {
          success: true,
          method: 'python-js-exec',
          message: 'Executed JavaScript snippet in active window console.'
        }
      } catch (err: any) {
        return {
          success: false,
          method: 'python-js-exec',
          message: `Failed to execute JS in console: ${err.message}`
        }
      }
    }

    // Method 3: Standard typing simulation
    if (isMac && args.actionType !== 'clipboard') {
      try {
        const escaped = args.text.replace(/["\\]/g, '\\$&')
        const script = `tell application "System Events" to keystroke "${escaped}"`
        execSync(`osascript -e '${script}'`)
        return {
          success: true,
          method: 'applescript',
          message: 'Typed input using AppleScript.'
        }
      } catch {
        // Fall through
      }
    }

    if (isLinux && args.actionType !== 'clipboard' && !isWayland) {
      try {
        const tempScriptPath = path.join('/tmp', 'sentinel_gui_simulate.py')
        const pythonScriptContent = `import sys
import time
import argparse

try:
    from pynput.keyboard import Key, Controller
except ImportError:
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--text', type=str, default="")
    parser.add_argument('--action', type=str, default="type")
    args = parser.parse_args()

    keyboard = Controller()
    time.sleep(1.2)

    if args.action == "keep-note":
        keyboard.tap(Key.esc)
        time.sleep(0.4)
        keyboard.tap('c')
        time.sleep(0.6)
        
        lines = args.text.split('\\n', 1)
        if len(lines) > 1 and lines[0].strip():
            title = lines[0].strip()
            body = lines[1].strip()
        else:
            title = "Sentinel Note"
            body = args.text.strip()
            
        for char in title:
            keyboard.type(char)
            time.sleep(0.01)
            
        time.sleep(0.3)
        keyboard.tap(Key.tab)
        time.sleep(0.3)
        
        for char in body:
            keyboard.type(char)
            time.sleep(0.01)
            
        time.sleep(0.4)
        keyboard.tap(Key.esc)
    else:
        for char in args.text:
            keyboard.type(char)
            time.sleep(0.01)

    print("Success")

if __name__ == "__main__":
    main()
`
        fs.writeFileSync(tempScriptPath, pythonScriptContent, 'utf8')
        
        const isKeep = active && (active.title.toLowerCase().includes('keep') || (active.url && active.url.includes('keep.google.com')))
        const actionType = isKeep ? 'keep-note' : 'type'
        const escapedText = args.text.replace(/["\\]/g, '\\$&')
        
        execSync(`python3 ${tempScriptPath} --action ${actionType} --text "${escapedText}"`)
        return {
          success: true,
          method: 'python-pynput',
          message: isKeep 
            ? 'Opened a new Google Keep note and typed the content successfully.'
            : 'Typed input directly into the active window.'
        }
      } catch {
        // Fall through
      }

      // Check for xdotool
      try {
        execSync('which xdotool')
        const escaped = args.text.replace(/["\\]/g, '\\$&')
        execSync(`xdotool type --delay 10 "${escaped}"`)
        return {
          success: true,
          method: 'xdotool',
          message: 'Typed input using xdotool.'
        }
      } catch {
        // Fall through
      }
    }

    // Method 4: Clipboard Fallback
    clipboard.writeText(args.text)
    const targetDesc = active ? `${active.owner.name} (${active.title})` : 'your active window'
    return {
      success: true,
      method: 'clipboard',
      message: isWayland
        ? 'Wayland detected. Keyboard simulation is blocked by security policies. Copied content to clipboard. Please focus your target window and press Ctrl+V to paste.'
        : `Copied content to clipboard. Focus ${targetDesc} and paste (Ctrl+V / Cmd+V).`
    }
  },

  async readActiveFile(): Promise<{ success: boolean; content?: string; filePath?: string; error?: string }> {
    try {
      const active = await activeWin()
      if (!active) {
        return { success: false, error: 'No active window detected.' }
      }

      const windowTitle = active.title

      // Extract file path from window title (editors usually show it)
      const absoluteRegex = /(?:\/[\w\-. \/()]+\.\w+)|(?:[A-Za-z]:\\[\w\-. \\()]+\.\w+)/g
      const absoluteMatches = windowTitle.match(absoluteRegex)
      if (absoluteMatches) {
        for (const match of absoluteMatches) {
          if (fs.existsSync(match)) {
            const content = fs.readFileSync(match, 'utf8')
            return { success: true, content, filePath: match }
          }
        }
      }

      // Try to find by filename extracted from title
      const nameRegex = /([\w\-]+\.\w+)\b/
      const nameMatch = windowTitle.match(nameRegex)
      if (nameMatch) {
        const filename = nameMatch[1]
        const workspaceRoot = process.cwd()
        let found: string | null = null

        if (isSafeToSearch(workspaceRoot) && workspaceRoot !== os.homedir()) {
          const searchInDir = (dir: string, depth = 0): string | null => {
            if (depth > 5) return null
            try {
              const files = fs.readdirSync(dir)
              for (const file of files) {
                if (file === '.git' || file === 'node_modules' || file === 'out' || file === 'dist') continue
                const full = path.join(dir, file)
                const stat = fs.statSync(full)
                if (stat.isDirectory()) {
                  const found = searchInDir(full, depth + 1)
                  if (found) return found
                } else if (file === filename) {
                  return full
                }
              }
            } catch {}
            return null
          }
          found = searchInDir(workspaceRoot)
        }
        if (found) {
          const content = fs.readFileSync(found, 'utf8')
          return { success: true, content, filePath: found }
        }
      }

      return { success: false, error: `Could not locate active file from window title: "${windowTitle}". Please provide a file path.` }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  },

  async editFile(args: { path: string; content: string }): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const resolved = path.resolve(args.path)

      if (!fs.existsSync(resolved)) {
        return { success: false, error: `File not found: ${resolved}` }
      }

      fs.writeFileSync(resolved, args.content, 'utf8')
      return { success: true, filePath: resolved }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}
