import { useEffect, useRef, useState } from 'react'

interface Model { id: string; name: string; provider: string }

interface Props {
  currentModel: string
  onSelect: (id: string) => void
  onClose: () => void
}

export default function ModelSwitcher({ currentModel, onSelect, onClose }: Props) {
  const [models, setModels] = useState<Model[]>([])
  const [focused, setFocused] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.sentinel.getModels().then((ms: unknown) => {
      const list = ms as Model[]
      setModels(list)
      const idx = list.findIndex(m => m.id === currentModel)
      setFocused(idx >= 0 ? idx : 0)
    })
  }, [currentModel])

  // Scroll focused item into view
  useEffect(() => {
    const item = listRef.current?.children[focused] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [focused])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, models.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)) }
      if (e.key === 'Enter')     { e.preventDefault(); if (models[focused]) onSelect(models[focused].id) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focused, models, onSelect])

  return (
    <div className="overlay" onClick={onClose}>
      <div className="model-panel" onClick={e => e.stopPropagation()}>
        <div className="model-header">
          <h3>Switch Model</h3>
          <span className="model-hint">↑↓ navigate · Enter select · Esc close</span>
        </div>
        <div className="model-list" ref={listRef}>
          {models.map((m, i) => (
            <button
              key={m.id}
              className={`model-item ${m.id === currentModel ? 'active' : ''} ${focused === i ? 'focused' : ''}`}
              onClick={() => onSelect(m.id)}
              onMouseEnter={() => setFocused(i)}
            >
              <div>
                <div className="model-name">{m.name || m.id}</div>
                <div className="model-provider">{m.provider}</div>
              </div>
              {m.id === currentModel && <span className="model-check">✓</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
