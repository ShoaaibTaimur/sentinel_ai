import type { ToastMsg } from '../App'

interface Props { msg: ToastMsg }

const ICONS = { success: '✓', error: '✕', info: 'ℹ' }

export default function Notification({ msg }: Props) {
  return (
    <div className={`toast ${msg.type}`}>
      <span>{ICONS[msg.type]}</span>
      <span>{msg.text}</span>
    </div>
  )
}
