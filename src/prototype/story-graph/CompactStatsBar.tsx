import { useState } from 'react';
import type { GameState } from '../../types/game';

export function CompactStatsBar({ state }: { state: GameState }) {
  const [isOpen, setIsOpen] = useState(false);

  const mainStats = [
    { name: 'Willpower', val: state.stats.Willpower ?? 0, highlight: 'gold' },
    { name: 'Deaths', val: `${state.stats.Deaths ?? 0}/4`, highlight: 'red' },
    { name: 'Reputation', val: state.stats.Reputation ?? 0 },
    { name: 'Unity', val: state.stats.Unity ?? 0 },
    { name: 'Wealth', val: state.stats.Wealth ?? 0 },
    { name: 'Order', val: state.stats.Order ?? 0 },
    { name: 'Perception', val: state.stats.Perception ?? 0 },
    { name: 'Determination', val: state.stats.Determination ?? 0 },
    { name: 'Ingenuity', val: state.stats.Ingenuity ?? 0 },
    { name: 'Spirituality', val: state.stats.Spirituality ?? 0 },
    { name: 'Nobility', val: state.stats.Nobility ?? 0 },
  ];

  return (
    <div className="sg-stats-bar">
      <div className="sg-stats-chips">
        <span className="sg-stats-kicker">CURRENT STATS:</span>
        {mainStats.map((s, i) => (
          <div key={i} className={`sg-stat-chip ${s.highlight || ''}`}>
            <span className="sg-stat-chip-name">{s.name}</span>
            <span className="sg-stat-chip-val">{s.val}</span>
          </div>
        ))}
      </div>

      <button className="sg-stats-toggle-btn" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? '✕ Close Ledger' : '📊 Full Character & Flag Ledger'}
      </button>

      {isOpen && (
        <div className="sg-stats-modal">
          <div className="sg-stats-modal-inner">
            <div className="sg-stats-modal-header">
              <h4>Character Attributes & Relationship Ledger</h4>
              <button className="sg-modal-close" onClick={() => setIsOpen(false)}>✕</button>
            </div>
            <div className="sg-stats-modal-grid">
              <div className="sg-modal-col">
                <h5>All Attributes</h5>
                <div className="sg-modal-stat-list">
                  {Object.entries(state.stats).map(([k, v]) => (
                    <div key={k} className="sg-modal-stat-row">
                      <span>{k}</span>
                      <strong>{v}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="sg-modal-col">
                <h5>Character Relations</h5>
                <div className="sg-modal-stat-list">
                  {Object.entries(state.characters).map(([k, c]) => (
                    <div key={k} className="sg-modal-stat-row">
                      <span>{k}</span>
                      <div className="sg-modal-char-info">
                        <strong>{c.relations}</strong>
                        {c.status && <span className="sg-modal-char-status">({c.status.replace(/.*STATUS_[A-Z]+_/, '')})</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="sg-modal-col">
                <h5>Active Flags</h5>
                <div className="sg-modal-stat-list">
                  {Object.entries(state.flags).filter(([_, v]) => v).length === 0 ? (
                    <div className="sg-empty-text">No active narrative flags yet.</div>
                  ) : (
                    Object.entries(state.flags)
                      .filter(([_, v]) => v)
                      .map(([k]) => (
                        <div key={k} className="sg-flag-badge">
                          ✓ {k}
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
