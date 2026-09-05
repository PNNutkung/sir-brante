import type { EngineState, Language } from '../types/game';
import { CharacterPanel } from './CharacterPanel';
import { FlagPanel } from './FlagPanel';
import { StatsPanel } from './StatsPanel';
import { EventTimeline } from './EventTimeline';

// Variant A: Classic 3-Column WPF Faithful
// Left: Characters & Flags stacked vertically
// Center: Scrollable Event Timeline
// Right: Grouped Stats
export function VariantA({
  engine,
  lang,
  onChoose,
}: {
  engine: EngineState;
  lang: Language;
  onChoose: (pos: number, decisionId: string) => void;
}) {
  return (
    <div className="layout-variant layout-variant-a">
      <div className="left-column">
        <CharacterPanel state={engine.gameState} lang={lang} />
        <FlagPanel state={engine.gameState} lang={lang} />
      </div>
      <div className="center-column">
        <EventTimeline engine={engine} lang={lang} onChoose={onChoose} />
      </div>
      <div className="right-column">
        <StatsPanel state={engine.gameState} lang={lang} />
      </div>
    </div>
  );
}
