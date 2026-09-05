import type { EngineState, Language } from '../types/game';
import { EventCard } from './EventCard';
import { getEventByIndex } from '../engine/calculator';
import { translate } from '../i18n/translate';

export function EventTimeline({
  engine,
  lang,
  onChoose,
}: {
  engine: EngineState;
  lang: Language;
  onChoose: (timelinePos: number, decisionId: string) => void;
}) {
  const { timeline, gameState } = engine;

  return (
    <div className="panel event-panel">
      <h3 className="panel-title">{translate(lang, 'UI_EVENTS')}</h3>
      <div className="event-scroll">
        {timeline.map((item, pos) => {
          const ev = getEventByIndex(item.eventIndex);
          const isCurrent = pos === timeline.length - 1;
          return (
            <EventCard
              key={`${item.eventIndex}-${pos}`}
              event={ev}
              state={gameState}
              lang={lang}
              selectedDecisionId={item.selectedDecisionId}
              isCurrent={isCurrent}
              onSelectDecision={(decisionId) => onChoose(pos, decisionId)}
            />
          );
        })}
        {timeline.length === 0 && (
          <div className="event-empty">{translate(lang, 'UI_END_OF_STORY')}</div>
        )}
      </div>
    </div>
  );
}
