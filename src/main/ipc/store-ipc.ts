import { ipcMain, dialog } from 'electron'
import { getMainWindow } from '../index'
import * as fs from 'fs/promises'
import {
  getConversations,
  saveConversation,
  deleteConversation,
  getModel,
  getApiKey
} from '../store'

export function setupStoreHandlers(): void {
  ipcMain.handle('store:getConversations', () => getConversations())
  ipcMain.handle('store:saveConversation', (_e, conv) => saveConversation(conv))
  ipcMain.handle('store:deleteConversation', (_e, id: string) => deleteConversation(id))
  ipcMain.handle('store:getModel', () => getModel())
  ipcMain.handle('store:hasApiKey', () => !!getApiKey())

  ipcMain.handle('store:exportConversation', async (_e, conv: any) => {
    const win = getMainWindow()
    if (!win) return { success: false, error: 'No parent window' }

    const { filePath } = await dialog.showSaveDialog(win, {
      title: 'Export Conversation',
      defaultPath: `sentinel-chat-${conv.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`,
      filters: [
        { name: 'Markdown Files', extensions: ['md'] },
        { name: 'JSON Files', extensions: ['json'] }
      ]
    })

    if (!filePath) return { success: false, cancelled: true }

    try {
      let content = ''
      if (filePath.endsWith('.json')) {
        content = JSON.stringify(conv, null, 2)
      } else {
        content = `# ${conv.title}\n\nExported from Sentinel AI on ${new Date().toLocaleString()}\n\n---\n\n`
        for (const msg of conv.messages) {
          const sender = msg.role === 'user' ? '**You**' : msg.role === 'system' ? '*System*' : '**Sentinel**'
          content += `### ${sender}\n${msg.content}\n\n`
        }
      }

      await fs.writeFile(filePath, content, 'utf-8')
      return { success: true, filePath }
    } catch (err: any) {
      return { success: false, error: err.message || String(err) }
    }
  })
}
