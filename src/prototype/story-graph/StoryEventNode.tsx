// PROTOTYPE — custom React Flow node renderer for a story event.
import { Handle, Position } from '@xyflow/react';
import { translate } from '../../i18n/translate';

export interface StoryNodeData extends Record<string, unknown> {
  eventIndex: number;
  eventId: string;
  chapter: string;
  isUnlocked: boolean; // event requirements are satisfied
  hasPlayableChoice: boolean; // at least 1 decision is available
  playableCount: number;
  decisionCount: number;
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
  selectedDecisionText?: string | null;
  plannedDecisionText?: string | null;
  onPlannedBadgeClick?: (eventIndex: number) => void;
}

export function StoryEventNode({ data }: { data: StoryNodeData }) {
  const {
    eventId,
    chapter,
    isUnlocked,
    hasPlayableChoice,
    playableCount,
    decisionCount,
    isPast,
    isCurrent,
    isFuture,
    selectedDecisionText,
    plannedDecisionText,
    onPlannedBadgeClick,
  } = data;

  // Localized clean title (e.g. "GLORIA'S RHYMES" instead of "CHILDHOOD GLORIAS RHYMES")
  const title = translate('English', eventId) || eventId.replace(/^EVENTS_[A-Z]+_/, '').replace(/_/g, ' ');

  let statusBadge = { label: 'AVAILABLE', cls: 'available', tooltip: 'Event conditions met and choices playable' };
  if (!isUnlocked) {
    statusBadge = { label: 'LOCKED', cls: 'locked', tooltip: 'Event prerequisites not met in current timeline' };
  } else if (isPast) {
    statusBadge = { label: 'PASSED', cls: 'passed', tooltip: 'Already decided earlier on this path' };
  } else if (!hasPlayableChoice) {
    statusBadge = { label: 'NO CHOICES', cls: 'locked', tooltip: 'Event unlocked, but all options are locked' };
  } else if (isCurrent) {
    statusBadge = { label: 'NOW', cls: 'now', tooltip: 'Currently awaiting your decision' };
  }

  let cardCls = 'sgn';
  if (isCurrent) cardCls += ' sgn-current';
  else if (isPast) cardCls += ' sgn-past';
  else if (isFuture) cardCls += ' sgn-future';
  if (!isUnlocked || !hasPlayableChoice) cardCls += ' sgn-blocked';

  return (
    <div className={cardCls}>
      <Handle type="target" position={Position.Top} />
      {chapter && <div className="sgn-chapter">{chapter}</div>}
      <div className="sgn-title" title={title}>{title}</div>
      <div className="sgn-meta">
        <span className={`sgn-badge ${statusBadge.cls}`} title={statusBadge.tooltip}>
          {statusBadge.label}
        </span>
        <span className="sgn-decisions" title={`${playableCount} of ${decisionCount} choices currently meet requirements`}>
          {playableCount}/{decisionCount} choices
        </span>
      </div>
      {selectedDecisionText && (
        <div className="sgn-selected-choice" title={selectedDecisionText}>
          ↳ {selectedDecisionText}
        </div>
      )}
      {!selectedDecisionText && plannedDecisionText && (
        <div
          className="sgn-planned-choice"
          title={`Planned: ${plannedDecisionText} — click to inspect this event`}
          onClick={(e) => {
            e.stopPropagation();
            onPlannedBadgeClick?.(data.eventIndex);
          }}
        >
          ⏳ Planned: {plannedDecisionText}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
