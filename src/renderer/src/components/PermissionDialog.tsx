import { useState } from 'react'
import type { PermReq } from '../App'

interface Props {
  req: PermReq
  onRespond: (r: 'allow' | 'always' | 'deny') => void
}

export default function PermissionDialog({ req, onRespond }: Props) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="overlay">
      <div className="perm-panel">
        <div className="perm-header">
          <h3>⚠️ Permission Required</h3>
        </div>
        <div className="perm-body">
          <div className="perm-row">
            <span className="perm-label">Action</span>
            <span className="perm-value" style={{ fontWeight: '600' }}>{req.action}</span>
          </div>
          <div className="perm-row">
            <span className="perm-label">What it will do</span>
            <span className="perm-value" style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-bright)' }}>{req.reason}</span>
          </div>
          <div className="perm-row">
            <span className="perm-label">Risk Level</span>
            <span className={`risk-badge risk-${req.risk}`}>{req.risk.toUpperCase()}</span>
          </div>

          <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              type="button" 
              className="details-toggle-btn" 
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 'Hide technical details' : 'Show technical details'}
            </button>
            
            {showDetails && (
              <div className="perm-row" style={{ animation: 'fadeIn var(--fast) var(--ease)' }}>
                <span className="perm-label">Technical Parameters</span>
                <pre className="perm-value-pre">{req.command}</pre>
              </div>
            )}
          </div>
        </div>
        <div className="perm-actions">
          <button className="perm-btn allow"  onClick={() => onRespond('allow')}>Allow Once</button>
          <button className="perm-btn always" onClick={() => onRespond('always')}>Always Allow</button>
          <button className="perm-btn deny"   onClick={() => onRespond('deny')}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
