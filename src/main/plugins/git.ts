import simpleGit from 'simple-git'

function getGit(dir?: string) {
  const target = dir || process.cwd()
  return simpleGit(target)
}

export const gitPlugin = {
  async status(args: { cwd?: string }) {
    const git = getGit(args.cwd)
    const status = await git.status()
    return status
  },

  async add(args: { cwd?: string; files: string | string[] }) {
    const git = getGit(args.cwd)
    await git.add(args.files)
    return { success: true }
  },

  async commit(args: { cwd?: string; message: string }) {
    const git = getGit(args.cwd)
    const result = await git.commit(args.message)
    return { success: true, commit: result.commit, summary: result.summary }
  },

  async push(args: { cwd?: string; remote?: string; branch?: string }) {
    const git = getGit(args.cwd)
    await git.push(args.remote, args.branch)
    return { success: true }
  },

  async pull(args: { cwd?: string; remote?: string; branch?: string }) {
    const git = getGit(args.cwd)
    await git.pull(args.remote, args.branch)
    return { success: true }
  },

  async checkout(args: { cwd?: string; branch: string }) {
    const git = getGit(args.cwd)
    await git.checkout(args.branch)
    return { success: true }
  },

  async branch(args: { cwd?: string; name?: string }) {
    const git = getGit(args.cwd)
    if (args.name) {
      await git.branch([args.name])
      return { success: true, branchCreated: args.name }
    }
    const branches = await git.branch()
    return branches
  },

  async merge(args: { cwd?: string; branch: string }) {
    const git = getGit(args.cwd)
    const result = await git.merge([args.branch])
    return { success: true, result }
  }
}
