import type { GameState } from '../types/game';
import type { Language } from '../types/game';
import { translate } from '../i18n/translate';
import gameData from '../data/game-data.json';

export function FlagPanel({ state, lang }: { state: GameState; lang: Language }) {
  const flagEntries = Object.entries(gameData.flags as Record<string, string>);
  const active = flagEntries.filter(([varName]) => state.flags[varName]);

  return (
    <div className="panel flag-panel">
      <h3 className="panel-title">{translate(lang, 'UI_FLAGS')}</h3>
      <ul className="flag-list">
        {active.map(([varName, locKey]) => (
          <li key={varName} className="flag-row">✓ {translate(lang, locKey)}</li>
        ))}
        {active.length === 0 && <li className="flag-row flag-empty">—</li>}
      </ul>
    </div>
  );
}
