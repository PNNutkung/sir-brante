import type { GameState, CharacterDef } from '../types/game';
import type { Language } from '../types/game';
import { translate } from '../i18n/translate';
import gameData from '../data/game-data.json';

export function CharacterPanel({ state, lang }: { state: GameState; lang: Language }) {
  const order = gameData.characterOrder as string[];
  const defs = gameData.characters as Record<string, CharacterDef>;

  return (
    <div className="panel character-panel">
      <h3 className="panel-title">{translate(lang, 'UI_CHARACTERS')}</h3>
      <ul className="character-list">
        {order.map((varName) => {
          const c = state.characters[varName];
          const def = defs[varName];
          const nameKey = c.nameOverrideKey ?? def.locKey;
          const statusText = c.status ? translate(lang, c.status) : translate(lang, 'UI_NO_STATUS');
          return (
            <li key={varName} className="character-row">
              <span className="character-name">{translate(lang, nameKey)}</span>
              <span className="character-relations">{c.relations}</span>
              <span className="character-status">({statusText})</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
