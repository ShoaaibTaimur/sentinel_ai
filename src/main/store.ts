import Store from 'electron-store'
import { applyAutostartSetting } from './autostart'

interface StoreSchema {
  apiKey: string
  provider: string
  model: string
  alwaysAllow: string[]
  conversations: Conversation[]
  settings: AppSettings
}

export interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: Message[]
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface AppSettings {
  theme: string
  fontSize: number
  hotkey: string
  startOnLogin: boolean
  showInDock: boolean
}

const defaults: StoreSchema = {
  apiKey: '',
  provider: 'opencode-zen',
  model: 'gpt-4o',
  alwaysAllow: [],
  conversations: [],
  settings: {
    theme: 'tokyo-night',
    fontSize: 14,
    hotkey: 'Super+Space',
    startOnLogin: false,
    showInDock: true
  }
}

let store: Store<StoreSchema>

export function setupStore(): void {
  store = new Store<StoreSchema>({
    name: 'sentinel-ai',
    defaults,
    encryptionKey: 'sentinel-ai-v1-secure'
  })

  // Sync autostart setting on boot
  applyAutostartSetting(getStartOnLogin()).catch((err) => {
    console.error('Failed to sync autostart setting:', err)
  })
}

export function getStore(): Store<StoreSchema> {
  return store
}

export function getApiKey(): string {
  return store.get('apiKey', '')
}

export function setApiKey(key: string): void {
  store.set('apiKey', key)
}

export function getModel(): string {
  return store.get('model', 'gpt-4o')
}

export function setModel(model: string): void {
  store.set('model', model)
}

export function getTheme(): string {
  return store.get('settings.theme', 'tokyo-night')
}

export function setTheme(theme: string): void {
  store.set('settings.theme', theme)
}

export function getAlwaysAllow(): string[] {
  return store.get('alwaysAllow', [])
}

export function addAlwaysAllow(action: string): void {
  const list = getAlwaysAllow()
  if (!list.includes(action)) {
    store.set('alwaysAllow', [...list, action])
  }
}

export function removeAlwaysAllow(action: string): void {
  const list = getAlwaysAllow()
  store.set('alwaysAllow', list.filter(item => item !== action))
}

export function getConversations(): Conversation[] {
  return store.get('conversations', [])
}

export function saveConversation(conv: Conversation): void {
  const convos = getConversations()
  const idx = convos.findIndex((c) => c.id === conv.id)
  if (idx >= 0) {
    convos[idx] = conv
  } else {
    convos.unshift(conv)
  }
  store.set('conversations', convos)
}

export function deleteConversation(id: string): void {
  const convos = getConversations().filter((c) => c.id !== id)
  store.set('conversations', convos)
}

export function getStartOnLogin(): boolean {
  return store.get('settings.startOnLogin', false)
}

export function setStartOnLogin(enabled: boolean): void {
  store.set('settings.startOnLogin', enabled)
  applyAutostartSetting(enabled).catch((err) => {
    console.error('Failed to update autostart setting:', err)
  })
}
