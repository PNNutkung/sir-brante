import { useState } from 'react';
import type { EngineState, Language } from '../types/game';
import { CharacterPanel } from './CharacterPanel';
import { FlagPanel } from './FlagPanel';
import { StatsPanel } from './StatsPanel';
import { EventTimeline } from './EventTimeline';
import { translate } from '../i18n/translate';

// Variant B: Grimoire / Tome Two-Page Layout
// Left "Page": Story timeline in large print with parchment aesthetics
// Right "Page": Ledger with tabs for Stats, Characters, and Flags
export function VariantB({
  engine,
  lang,
  onChoose,
}: {
  engine: EngineState;
  lang: Language;
  onChoose: (pos: number, decisionId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'stats' | 'characters' | 'flags'>('stats');

  return (
    <div className="layout-variant layout-variant-b">
      <div className="tome-book">
        <div className="tome-page tome-page-story">
          <div className="tome-header">
            <h2>{translate(lang, 'UI_EVENTS')}</h2>
            <span className="tome-sub">The Chronicles of Sir Brante</span>
          </div>
          <EventTimeline engine={engine} lang={lang} onChoose={onChoose} />
        </div>
        <div className="tome-spine" />
        <div className="tome-page tome-page-ledger">
          <div className="tome-tabs">
            <button
              className={`tome-tab ${activeTab === 'stats' ? 'active' : ''}`}
              onClick={() => setActiveTab('stats')}
            >
              {translate(lang, 'UI_STATS')}
            </button>
            <button
              className={`tome-tab ${activeTab === 'characters' ? 'active' : ''}`}
              onClick={() => setActiveTab('characters')}
            >
              {translate(lang, 'UI_CHARACTERS')}
            </button>
            <button
              className={`tome-tab ${activeTab === 'flags' ? 'active' : ''}`}
              onClick={() => setActiveTab('flags')}
            >
              {translate(lang, 'UI_FLAGS')}
            </button>
          </div>
          <div className="tome-tab-content">
            {activeTab === 'stats' && <StatsPanel state={engine.gameState} lang={lang} />}
            {activeTab === 'characters' && <CharacterPanel state={engine.gameState} lang={lang} />}
            {activeTab === 'flags' && <FlagPanel state={engine.gameState} lang={lang} />}
          </div>
        </div>
      </div>
    </div>
  );
}
