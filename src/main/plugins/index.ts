import { BrowserWindow } from 'electron'
import { requestPermission } from '../ipc/permissions'
import { filesystemPlugin } from './filesystem'
import { terminalPlugin } from './terminal'
import { gitPlugin } from './git'
import { applicationsPlugin } from './applications'
import { guiPlugin } from './gui'
import { webPlugin } from './web'
import { mcpBrowserPlugin } from './mcp-browser'

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, any>
      required?: string[]
    }
  }
}

// Maps tool name to its risk rating, execution permission text, and implementation
export interface ToolHandler {
  risk: 'low' | 'medium' | 'high'
  action: string // Permission key (e.g. fs:delete)
  reason: (args: any) => string // Reason shown in permission dialog
  execute: (args: any) => Promise<any>
}

export const TOOLS: ToolDefinition[] = [
  // Filesystem
  {
    type: 'function',
    function: {
      name: 'fs_list_dir',
      description: 'List contents of a directory',
      parameters: {
        type: 'object',
        properties: {
          directory: { type: 'string', description: 'Absolute directory path' }
        },
        required: ['directory']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'fs_read_file',
      description: 'Read the contents of a text file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path of the file to read' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'fs_create_file',
      description: 'Create a new file with specified content',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path of the new file' },
          content: { type: 'string', description: 'Text content to write' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'fs_write_file',
      description: 'Overwrite an existing file or write content to a file path',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path of the file' },
          content: { type: 'string', description: 'Text content to write' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'fs_delete_file',
      description: 'Delete a file or recursively delete a directory',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path of file or directory' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'fs_rename_file',
      description: 'Rename a file or folder',
      parameters: {
        type: 'object',
        properties: {
          oldPath: { type: 'string', description: 'Current absolute path' },
          newPath: { type: 'string', description: 'New absolute path' }
        },
        required: ['oldPath', 'newPath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'fs_copy_file',
      description: 'Copy file or folder to a destination',
      parameters: {
        type: 'object',
        properties: {
          src: { type: 'string', description: 'Source path' },
          dest: { type: 'string', description: 'Destination path' }
        },
        required: ['src', 'dest']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'fs_move_file',
      description: 'Move file or folder to a destination',
      parameters: {
        type: 'object',
        properties: {
          src: { type: 'string', description: 'Source path' },
          dest: { type: 'string', description: 'Destination path' }
        },
        required: ['src', 'dest']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'fs_search',
      description: 'Search for files matching a glob or wildcard pattern in a directory',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Search term or wildcard (e.g. *.js)' },
          directory: { type: 'string', description: 'Directory to search within' }
        },
        required: ['pattern', 'directory']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'fs_find_duplicates',
      description: 'Find duplicate files in a folder based on file sizes',
      parameters: {
        type: 'object',
        properties: {
          directory: { type: 'string', description: 'Directory to inspect' }
        },
        required: ['directory']
      }
    }
  },

  // Terminal
  {
    type: 'function',
    function: {
      name: 'terminal_run_command',
      description: 'Execute a terminal command',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The CLI shell command to run' },
          cwd: { type: 'string', description: 'Optional working directory path' }
        },
        required: ['command']
      }
    }
  },

  // Git
  {
    type: 'function',
    function: {
      name: 'git_status',
      description: 'Check git repository status',
      parameters: {
        type: 'object',
        properties: {
          cwd: { type: 'string', description: 'Path to git repository' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_add',
      description: 'Add files to git staging index',
      parameters: {
        type: 'object',
        properties: {
          cwd: { type: 'string', description: 'Path to git repository' },
          files: { type: 'array', items: { type: 'string' }, description: 'List of file paths or patterns' }
        },
        required: ['files']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_commit',
      description: 'Commit staged changes to local git history',
      parameters: {
        type: 'object',
        properties: {
          cwd: { type: 'string', description: 'Path to git repository' },
          message: { type: 'string', description: 'Git commit message description' }
        },
        required: ['message']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_push',
      description: 'Push commits to remote git repository',
      parameters: {
        type: 'object',
        properties: {
          cwd: { type: 'string', description: 'Path to git repository' },
          remote: { type: 'string', description: 'Remote target name (e.g. origin)' },
          branch: { type: 'string', description: 'Branch to push' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_pull',
      description: 'Pull commits from remote git repository',
      parameters: {
        type: 'object',
        properties: {
          cwd: { type: 'string', description: 'Path to git repository' },
          remote: { type: 'string', description: 'Remote target name' },
          branch: { type: 'string', description: 'Branch to pull' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_checkout',
      description: 'Switch branch or checkout files',
      parameters: {
        type: 'object',
        properties: {
          cwd: { type: 'string', description: 'Path to git repository' },
          branch: { type: 'string', description: 'Branch name or commit hash' }
        },
        required: ['branch']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_branch',
      description: 'List branches or create a new branch',
      parameters: {
        type: 'object',
        properties: {
          cwd: { type: 'string', description: 'Path to git repository' },
          name: { type: 'string', description: 'Optional new branch name' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_merge',
      description: 'Merge branch into active branch',
      parameters: {
        type: 'object',
        properties: {
          cwd: { type: 'string', description: 'Path to git repository' },
          branch: { type: 'string', description: 'Branch name to merge' }
        },
        required: ['branch']
      }
    }
  },

  // Applications
  {
    type: 'function',
    function: {
      name: 'apps_launch',
      description: 'Launch a desktop application or open a file/URL',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Application name, file path, or URL' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'apps_close',
      description: 'Close an open application',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Application process or window name' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'apps_focus',
      description: 'Focus window of an application',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Application name' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'apps_list',
      description: 'List currently open/running window titles',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'gui_simulate_input',
      description: 'Interact with the user\'s active window. For text files/code editors: edits the active file directly. For browsers: can simulate keyboard input or execute custom JavaScript in the tab\'s developer console.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The text content, note, code, or JS script snippet to type or execute.' },
          actionType: { 
            type: 'string', 
            enum: ['type', 'clipboard', 'edit-file', 'exec-js'], 
            description: 'Optionally force the input method. Use "exec-js" to execute a JavaScript block in the browser DevTools Console.' 
          }
        },
        required: ['text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: 'Fetch and parse the readable text content of a web page URL for analysis.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The absolute URL or domain to fetch and analyze.' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'mcp_browser_open',
      description: 'Open a URL in the automated Sentinel MCP Browser child window.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The absolute website URL to open' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'mcp_browser_close',
      description: 'Close the automated Sentinel MCP Browser child window.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'mcp_browser_click',
      description: 'Click on a web element using a CSS selector in the automated browser.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector of the element to click (e.g. "button.submit")' }
        },
        required: ['selector']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'mcp_browser_type',
      description: 'Type text into a input, textarea, or contenteditable element in the automated browser.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector of the input field' },
          text: { type: 'string', description: 'Text to type/insert' }
        },
        required: ['selector', 'text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'mcp_browser_exec',
      description: 'Evaluate a custom JavaScript snippet in the page context of the automated browser.',
      parameters: {
        type: 'object',
        properties: {
          js: { type: 'string', description: 'JavaScript code snippet to execute' }
        },
        required: ['js']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'mcp_browser_get_content',
      description: 'Retrieve the text and simplified HTML DOM structure of the current page in the automated browser.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  }
]

export const HANDLERS: Record<string, ToolHandler> = {
  // Filesystem
  fs_list_dir: {
    risk: 'low',
    action: 'fs:list',
    reason: (args) => `List contents of directory: ${args.directory}`,
    execute: (args) => filesystemPlugin.listDir(args)
  },
  fs_read_file: {
    risk: 'low',
    action: 'fs:read',
    reason: (args) => `Read text file: ${args.path}`,
    execute: (args) => filesystemPlugin.readFile(args)
  },
  fs_create_file: {
    risk: 'medium',
    action: 'fs:create',
    reason: (args) => `Create new file at: ${args.path}`,
    execute: (args) => filesystemPlugin.createFile(args)
  },
  fs_write_file: {
    risk: 'medium',
    action: 'fs:write',
    reason: (args) => `Write content to file: ${args.path}`,
    execute: (args) => filesystemPlugin.writeFile(args)
  },
  fs_delete_file: {
    risk: 'high',
    action: 'fs:delete',
    reason: (args) => `Delete file or folder: ${args.path}`,
    execute: (args) => filesystemPlugin.deleteFile(args)
  },
  fs_rename_file: {
    risk: 'medium',
    action: 'fs:rename',
    reason: (args) => `Rename file: ${args.oldPath} to ${args.newPath}`,
    execute: (args) => filesystemPlugin.renameFile(args)
  },
  fs_copy_file: {
    risk: 'medium',
    action: 'fs:copy',
    reason: (args) => `Copy file: ${args.src} to ${args.dest}`,
    execute: (args) => filesystemPlugin.copyFile(args)
  },
  fs_move_file: {
    risk: 'medium',
    action: 'fs:move',
    reason: (args) => `Move file: ${args.src} to ${args.dest}`,
    execute: (args) => filesystemPlugin.moveFile(args)
  },
  fs_search: {
    risk: 'low',
    action: 'fs:search',
    reason: (args) => `Search directory ${args.directory} for pattern: ${args.pattern}`,
    execute: (args) => filesystemPlugin.searchFiles(args)
  },
  fs_find_duplicates: {
    risk: 'low',
    action: 'fs:duplicates',
    reason: (args) => `Inspect directory for duplicate files: ${args.directory}`,
    execute: (args) => filesystemPlugin.findDuplicates(args)
  },

  // Terminal
  terminal_run_command: {
    risk: 'high',
    action: 'terminal:run',
    reason: (args) => `Execute terminal command: "${args.command}"${args.cwd ? ` in ${args.cwd}` : ''}`,
    execute: (args) => terminalPlugin.runCommand(args)
  },

  // Git
  git_status: {
    risk: 'low',
    action: 'git:status',
    reason: () => `Check git repository status`,
    execute: (args) => gitPlugin.status(args)
  },
  git_add: {
    risk: 'medium',
    action: 'git:add',
    reason: (args) => `Git add files: ${Array.isArray(args.files) ? args.files.join(', ') : args.files}`,
    execute: (args) => gitPlugin.add(args)
  },
  git_commit: {
    risk: 'medium',
    action: 'git:commit',
    reason: (args) => `Git commit with message: "${args.message}"`,
    execute: (args) => gitPlugin.commit(args)
  },
  git_push: {
    risk: 'high',
    action: 'git:push',
    reason: (args) => `Git push commits to ${args.remote || 'default'} branch ${args.branch || 'default'}`,
    execute: (args) => gitPlugin.push(args)
  },
  git_pull: {
    risk: 'medium',
    action: 'git:pull',
    reason: (args) => `Git pull commits from ${args.remote || 'default'} branch ${args.branch || 'default'}`,
    execute: (args) => gitPlugin.pull(args)
  },
  git_checkout: {
    risk: 'medium',
    action: 'git:checkout',
    reason: (args) => `Git checkout branch/commit: ${args.branch}`,
    execute: (args) => gitPlugin.checkout(args)
  },
  git_branch: {
    risk: 'low',
    action: 'git:branch',
    reason: (args) => args.name ? `Git create branch: ${args.name}` : `Git list local branches`,
    execute: (args) => gitPlugin.branch(args)
  },
  git_merge: {
    risk: 'high',
    action: 'git:merge',
    reason: (args) => `Git merge branch: ${args.branch}`,
    execute: (args) => gitPlugin.merge(args)
  },

  // Applications
  apps_launch: {
    risk: 'medium',
    action: 'apps:launch',
    reason: (args) => `Launch app or resource: ${args.name}`,
    execute: (args) => applicationsPlugin.launch(args)
  },
  apps_close: {
    risk: 'medium',
    action: 'apps:close',
    reason: (args) => `Close application: ${args.name}`,
    execute: (args) => applicationsPlugin.close(args)
  },
  apps_focus: {
    risk: 'low',
    action: 'apps:focus',
    reason: (args) => `Focus window: ${args.name}`,
    execute: (args) => applicationsPlugin.focus(args)
  },
  apps_list: {
    risk: 'low',
    action: 'apps:list',
    reason: () => `List active windows`,
    execute: () => applicationsPlugin.list()
  },
  gui_simulate_input: {
    risk: 'medium',
    action: 'gui:input',
    reason: (args) => `Insert text or edit active window: "${args.text.substring(0, 60)}..."`,
    execute: (args) => guiPlugin.simulateInput(args)
  },
  web_fetch: {
    risk: 'low',
    action: 'web:fetch',
    reason: (args) => `Fetch and analyze website content: ${args.url}`,
    execute: (args) => webPlugin.fetchUrl(args)
  },
  mcp_browser_open: {
    risk: 'low',
    action: 'browser:open',
    reason: (args) => `Open automated browser to URL: ${args.url}`,
    execute: (args) => mcpBrowserPlugin.open(args)
  },
  mcp_browser_close: {
    risk: 'low',
    action: 'browser:close',
    reason: () => `Close automated browser window`,
    execute: () => mcpBrowserPlugin.close()
  },
  mcp_browser_click: {
    risk: 'medium',
    action: 'browser:click',
    reason: (args) => `Click element with selector: "${args.selector}"`,
    execute: (args) => mcpBrowserPlugin.click(args)
  },
  mcp_browser_type: {
    risk: 'medium',
    action: 'browser:type',
    reason: (args) => `Type text into element "${args.selector}": "${args.text.substring(0, 40)}..."`,
    execute: (args) => mcpBrowserPlugin.type(args)
  },
  mcp_browser_exec: {
    risk: 'high',
    action: 'browser:exec',
    reason: (args) => `Execute JavaScript inside automated browser: "${args.js.substring(0, 60)}..."`,
    execute: (args) => mcpBrowserPlugin.exec(args)
  },
  mcp_browser_get_content: {
    risk: 'low',
    action: 'browser:get_content',
    reason: () => `Read content and DOM structure of active browser tab`,
    execute: () => mcpBrowserPlugin.getContent()
  }
}

export async function executeTool(
  win: BrowserWindow,
  name: string,
  args: any
): Promise<any> {
  const handler = HANDLERS[name]
  if (!handler) {
    throw new Error(`Tool not found: ${name}`)
  }

  // Permission check
  const req = {
    id: crypto.randomUUID(),
    action: handler.action,
    command: JSON.stringify(args, null, 2),
    reason: handler.reason(args),
    risk: handler.risk
  }

  // Ask user permission
  const allowed = await requestPermission(win, req)
  if (!allowed) {
    return { error: 'Permission denied by user' }
  }

  // Execute
  try {
    return await handler.execute(args)
  } catch (err: any) {
    return { error: err.message || String(err) }
  }
}
