import { useState } from 'react';
import type { EngineState, Language } from '../types/game';
import { CharacterPanel } from './CharacterPanel';
import { FlagPanel } from './FlagPanel';
import { StatsPanel } from './StatsPanel';
import { EventCard } from './EventCard';
import { getEventByIndex } from '../engine/calculator';
import { translate } from '../i18n/translate';

// Variant C: Focused Stepper / Decision Deck
// Shows only the ACTIVE event front and center as an immersive narrative card,
// with a top summary bar for vital stats (Willpower, Deaths, Order, Unrest),
// a collapsible history drawer on the left, and character dossier on the right.
export function VariantC({
  engine,
  lang,
  onChoose,
}: {
  engine: EngineState;
  lang: Language;
  onChoose: (pos: number, decisionId: string) => void;
}) {
  const { timeline, gameState } = engine;
  const [showDrawer, setShowDrawer] = useState(false);
  const currentPos = timeline.length - 1;
  const currentItem = timeline[currentPos];
  const currentEvent = currentItem ? getEventByIndex(currentItem.eventIndex) : null;

  return (
    <div className="layout-variant layout-variant-c">
      {/* Vitals summary bar */}
      <div className="vitals-bar">
        <div className="vital-item">
          <span className="vital-label">{translate(lang, 'STAT_LIFETIME_WILLPOWER')}:</span>
          <span className="vital-val gold">{gameState.stats.Willpower ?? 0}</span>
        </div>
        <div className="vital-item">
          <span className="vital-label">{translate(lang, 'STAT_LIFETIME_DEATHS')}:</span>
          <span className="vital-val red">{gameState.stats.Deaths ?? 0} / 4</span>
        </div>
        <div className="vital-item">
          <span className="vital-label">{translate(lang, 'STAT_FAMILY_REPUTATION')}:</span>
          <span className="vital-val">{gameState.stats.Reputation ?? 0}</span>
        </div>
        <div className="vital-item">
          <span className="vital-label">{translate(lang, 'STAT_FAMILY_UNITY')}:</span>
          <span className="vital-val">{gameState.stats.Unity ?? 0}</span>
        </div>
        <div className="vital-item">
          <span className="vital-label">{translate(lang, 'STAT_PROVINCE_ORDER')}:</span>
          <span className="vital-val">{gameState.stats.Order ?? 0}</span>
        </div>
        <button className="drawer-toggle-btn" onClick={() => setShowDrawer((v) => !v)}>
          {showDrawer ? '✕ Hide History' : `📜 History (${timeline.length - 1})`}
        </button>
      </div>

      <div className="stepper-body">
        {showDrawer && (
          <aside className="stepper-drawer">
            <h4>Passed Events</h4>
            <div className="drawer-list">
              {timeline.slice(0, -1).map((item, pos) => {
                const ev = getEventByIndex(item.eventIndex);
                const dec = ev.decisions.find((d) => d.id === item.selectedDecisionId);
                return (
                  <div key={pos} className="drawer-history-item" onClick={() => onChoose(pos, item.selectedDecisionId ?? '')}>
                    <div className="drawer-ev-title">{translate(lang, ev.id)}</div>
                    {dec && <div className="drawer-ev-choice">↳ {translate(lang, dec.id)}</div>}
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        <main className="stepper-stage">
          {currentEvent ? (
            <div className="stepper-card-wrapper">
              <div className="stepper-step-indicator">
                Event #{timeline.length} of the Journey
              </div>
              <EventCard
                event={currentEvent}
                state={gameState}
                lang={lang}
                selectedDecisionId={currentItem.selectedDecisionId}
                isCurrent={true}
                onSelectDecision={(id) => onChoose(currentPos, id)}
              />
            </div>
          ) : (
            <div className="event-empty">{translate(lang, 'UI_END_OF_STORY')}</div>
          )}
        </main>

        <aside className="stepper-sidebar">
          <StatsPanel state={gameState} lang={lang} />
          <CharacterPanel state={gameState} lang={lang} />
          <FlagPanel state={gameState} lang={lang} />
        </aside>
      </div>
    </div>
  );
}
