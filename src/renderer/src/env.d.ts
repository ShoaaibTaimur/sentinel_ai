import type { SentinelAPI } from '../../preload/index'

declare global {
  interface Window {
    sentinel: SentinelAPI
  }
}
