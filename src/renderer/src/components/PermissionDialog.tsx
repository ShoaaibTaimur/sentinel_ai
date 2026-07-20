import type { PermReq } from '../App'

interface Props {
  req: PermReq
  onRespond: (r: 'allow' | 'always' | 'deny') => void
}

export default function PermissionDialog({ req, onRespond }: Props) {
  return (
    <div className="overlay">
      <div className="perm-panel">
        <div className="perm-header">
          <h3>⚠️ Permission Required</h3>
        </div>
        <div className="perm-body">
          <div className="perm-row">
            <span className="perm-label">Action</span>
            <span className="perm-value">{req.action}</span>
          </div>
          <div className="perm-row">
            <span className="perm-label">Command</span>
            <span className="perm-value">{req.command}</span>
          </div>
          <div className="perm-row">
            <span className="perm-label">Reason</span>
            <span className="perm-value" style={{ fontFamily: 'var(--font-sans)' }}>{req.reason}</span>
          </div>
          <div className="perm-row">
            <span className="perm-label">Risk</span>
            <span className={`risk-badge risk-${req.risk}`}>{req.risk.toUpperCase()}</span>
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
