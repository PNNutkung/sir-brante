import type { EventDef, GameState } from '../types/game';
import type { Language } from '../types/game';
import { translate } from '../i18n/translate';
import { formatRequirement, DecisionOption } from './DecisionOption';
import { isDecisionAvailable } from '../engine/calculator';

export function EventCard({
  event,
  state,
  lang,
  selectedDecisionId,
  isCurrent,
  onSelectDecision,
}: {
  event: EventDef;
  state: GameState;
  lang: Language;
  selectedDecisionId: string | null;
  isCurrent: boolean;
  onSelectDecision: (decisionId: string) => void;
}) {
  const reqTexts = [...event.rawRequirements]
    .map((r) => formatRequirement(r, lang))
    .filter(Boolean);

  return (
    <div className={`event-card ${isCurrent ? 'event-current' : 'event-past'}`}>
      <h3 className="event-title">{translate(lang, event.id)}</h3>
      {reqTexts.length > 0 && (
        <div className="event-requirements">({reqTexts.join(', ')})</div>
      )}
      <div className="event-decisions">
        {event.decisions.map((dec) => (
          <DecisionOption
            key={dec.id}
            decision={dec}
            lang={lang}
            isAvailable={isDecisionAvailable(event, dec.id, state)}
            isSelected={selectedDecisionId === dec.id}
            onSelect={() => onSelectDecision(dec.id)}
          />
        ))}
      </div>
    </div>
  );
}
