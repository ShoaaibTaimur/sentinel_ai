import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// Track wrapped handlers so off() removes exact same ref
const listenerMap = new WeakMap<(...args: unknown[]) => void, (e: IpcRendererEvent, ...a: unknown[]) => void>()

const api = {
  // AI
  chat: (messages: Array<{ role: string; content: string }>) =>
    ipcRenderer.invoke('ai:chat', messages),
  getModels: () => ipcRenderer.invoke('ai:models'),
  getModel: () => ipcRenderer.invoke('ai:getModel'),
  setModel: (model: string) => ipcRenderer.invoke('ai:setModel', model),
  getApiKey: () => ipcRenderer.invoke('ai:getApiKey'),
  setApiKey: (key: string) => ipcRenderer.invoke('ai:setApiKey', key),
  validateKey: (key: string) => ipcRenderer.invoke('ai:validateKey', key),
  cancel: () => ipcRenderer.invoke('ai:cancel'),

  // Commands
  runCommand: (cmd: string) => ipcRenderer.invoke('command:run', cmd),

  // Context
  getContext: () => ipcRenderer.invoke('context:get'),

  // Permissions
  respondPermission: (id: string, result: 'allow' | 'always' | 'deny') =>
    ipcRenderer.invoke('permission:respond', id, result),
  getAlwaysAllow: () => ipcRenderer.invoke('permission:getAlwaysAllow'),
  removeAlwaysAllow: (action: string) => ipcRenderer.invoke('permission:removeAlwaysAllow', action),

  // Store
  getConversations: () => ipcRenderer.invoke('store:getConversations'),
  saveConversation: (conv: unknown) => ipcRenderer.invoke('store:saveConversation', conv),
  deleteConversation: (id: string) => ipcRenderer.invoke('store:deleteConversation', id),
  exportConversation: (conv: unknown) => ipcRenderer.invoke('store:exportConversation', conv),
  hasApiKey: () => ipcRenderer.invoke('store:hasApiKey'),

  // Window
  hideWindow: () => ipcRenderer.invoke('window:hide'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
  isFullscreen: () => ipcRenderer.invoke('window:isFullscreen'),


  // Event listeners — returns cleanup fn, use in useEffect return
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    const wrapped = (_event: IpcRendererEvent, ...args: unknown[]) => callback(...args)
    listenerMap.set(callback, wrapped)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  },
  off: (channel: string, callback: (...args: unknown[]) => void) => {
    const wrapped = listenerMap.get(callback)
    if (wrapped) {
      ipcRenderer.removeListener(channel, wrapped)
      listenerMap.delete(callback)
    }
  }
}

contextBridge.exposeInMainWorld('sentinel', api)

export type SentinelAPI = typeof api
