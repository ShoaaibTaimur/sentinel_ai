import { exec, ChildProcess } from 'child_process'

let activeProcess: ChildProcess | null = null

export const terminalPlugin = {
  async runCommand(args: { command: string; cwd?: string }): Promise<{ success: boolean; stdout: string; stderr: string; error?: string }> {
    if (activeProcess) {
      try {
        activeProcess.kill('SIGINT')
      } catch {}
    }

    return new Promise((resolve) => {
      const options = {
        cwd: args.cwd || process.cwd(),
        maxBuffer: 10 * 1024 * 1024
      }

      const child = exec(args.command, options, (error: any, stdout, stderr) => {
        if (activeProcess === child) {
          activeProcess = null
        }
        if (error) {
          resolve({
            success: false,
            error: error.message || String(error),
            stdout: stdout.trim(),
            stderr: stderr.trim()
          })
        } else {
          resolve({
            success: true,
            stdout: stdout.trim(),
            stderr: stderr.trim()
          })
        }
      })

      activeProcess = child
    })
  },

  killActiveCommand(): boolean {
    if (activeProcess) {
      try {
        activeProcess.kill('SIGINT')
        activeProcess = null
        return true
      } catch {
        return false
      }
    }
    return false
  }
}
