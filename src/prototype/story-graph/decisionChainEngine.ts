// Domain Engine: Non-destructive downstream replay and decision chain solver
import type { HistoryItem, EngineState, GameState, EventDef } from '../../types/game';
import { getEventByIndex, isDecisionAvailable, getAllEvents } from '../../engine/calculator';
import { createInitialState } from '../../engine/initialState';
import { applyConsequences } from '../../engine/consequences';
import { evaluateCondition } from '../../engine/evaluator';
import { getEffectsFor, getStatusEffectsFor } from './dependencyIndex';

function eventKey(varName: string | null, index: number): string {
  return varName ?? `#${index}`;
}

// Map of eventIndex -> decisionId staged by the user for an event not yet reached
// on the live timeline. Auto-applied the moment the story naturally advances to it
// (if the decision is still valid at that point), so choosing a future decision
// updates the whole downstream trace instead of just panning the camera there.
export type PlannedDecisions = Record<number, string>;

const PLANNED_DECISIONS_KEY = 'sir_brante_story_planned_decisions_v1';

export function loadPlannedDecisions(): PlannedDecisions {
  try {
    const raw = localStorage.getItem(PLANNED_DECISIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const out: PlannedDecisions = {};
        for (const [k, v] of Object.entries(parsed)) {
          const idx = Number(k);
          if (Number.isFinite(idx) && typeof v === 'string') out[idx] = v;
        }
        return out;
      }
    }
  } catch (err) {
    console.error('Failed to parse persisted planned decisions:', err);
  }
  return {};
}

export function savePlannedDecisions(planned: PlannedDecisions): void {
  try {
    localStorage.setItem(PLANNED_DECISIONS_KEY, JSON.stringify(planned));
  } catch (err) {
    console.error('Failed to persist planned decisions:', err);
  }
}

function eventIsFullyAvailable(ev: EventDef, state: GameState): boolean {
  for (const r of ev.rawRequirements) {
    if (!evaluateCondition(r, state)) return false;
  }
  for (const r of ev.rawHiddenRequirements) {
    if (!evaluateCondition(r, state)) return false;
  }
  return true;
}

// Finds the next interactive event to show, auto-skipping (and marking passed) any
// linear event whose requirements fail. Mutates `state.passedEvents` for skipped events.
function findNextEvent(events: EventDef[], state: GameState): EventDef | null {
  for (const ev of events) {
    if (ev.isVariableTime && !state.passedEvents[eventKey(ev.varName, ev.index)] && eventIsFullyAvailable(ev, state)) {
      return ev;
    }
  }
  for (const ev of events) {
    if (ev.isVariableTime) continue;
    if (state.passedEvents[eventKey(ev.varName, ev.index)]) continue;
    if (!eventIsFullyAvailable(ev, state)) {
      state.passedEvents[eventKey(ev.varName, ev.index)] = true;
      continue;
    }
    return ev;
  }
  return null;
}

// Applies a planned decision to `ev` if one is staged and still valid; mutates state.
// Returns the decisionId applied, or null if none was applied.
function tryApplyPlanned(ev: EventDef, state: GameState, planned: PlannedDecisions): string | null {
  const decisionId = planned[ev.index];
  if (!decisionId) return null;
  const dec = ev.decisions.find((d) => d.id === decisionId);
  if (!dec || !isDecisionAvailable(ev, dec.id, state)) return null;
  applyConsequences(dec.rawConsequences, state);
  applyConsequences(dec.rawHiddenConsequences, state);
  state.passedEvents[eventKey(ev.varName, ev.index)] = true;
  return decisionId;
}

/**
 * Replays a timeline non-destructively:
 * Preserves all downstream items in the timeline. If an earlier choice was modified,
 * downstream choices that remain valid stay selected. If a downstream choice's requirements
 * are no longer met, it is unselected (set to null) so the user can re-choose, but
 * the sequence of steps and subsequent events are NOT discarded.
 *
 * `plannedDecisions` lets the caller stage a decision for an event that hasn't been
 * reached yet; the moment replay naturally advances to that event, the staged decision
 * is auto-applied (if still valid) instead of leaving the step awaiting choice.
 */
export function replayTimelinePreservingDownstream(
  timeline: HistoryItem[],
  plannedDecisions: PlannedDecisions = {}
): EngineState {
  const state = createInitialState();
  const out: HistoryItem[] = [];

  for (let i = 0; i < timeline.length; i++) {
    const item = timeline[i];
    const ev = getEventByIndex(item.eventIndex);

    if (item.selectedDecisionId) {
      const dec = ev.decisions.find((d) => d.id === item.selectedDecisionId);
      // Check if decision is still available with the newly replayed state
      if (dec && isDecisionAvailable(ev, dec.id, state)) {
        applyConsequences(dec.rawConsequences, state);
        applyConsequences(dec.rawHiddenConsequences, state);
        state.passedEvents[eventKey(ev.varName, ev.index)] = true;
        out.push({ ...item });
      } else {
        // Choice is no longer valid due to earlier stat changes;
        // Keep the step in place, but reset selectedDecisionId to null!
        out.push({ ...item, selectedDecisionId: null });
      }
    } else {
      // No decision chosen yet at this step — check for a staged planned decision first.
      const appliedId = tryApplyPlanned(ev, state, plannedDecisions);
      out.push({ ...item, selectedDecisionId: appliedId });
    }
  }

  // If the last entry has a selected decision (possibly via a planned auto-apply),
  // keep auto-appending + auto-applying planned decisions until we hit a step that's
  // genuinely awaiting a fresh choice.
  const events = getAllEvents();
  let last = out[out.length - 1];
  while (last && last.selectedDecisionId) {
    const nextEv = findNextEvent(events, state);
    if (!nextEv) break;
    const appliedId = tryApplyPlanned(nextEv, state, plannedDecisions);
    const nextItem: HistoryItem = { eventIndex: nextEv.index, eventVarName: nextEv.varName, selectedDecisionId: appliedId };
    out.push(nextItem);
    last = nextItem;
  }

  return { gameState: state, timeline: out };
}

export interface DecisionChainItem {
  eventIndex: number;
  eventId: string;
  decisionId: string;
  rawEffect: string;
  stepNumber: number | null; // 1-indexed step in current timeline if present
  isSelected: boolean; // currently chosen in the active timeline
  isPlanned: boolean; // staged to auto-apply once this event is naturally reached
  isInvalidated: boolean; // was planned, but no longer valid given current state
}

/**
 * Builds the full chain of decisions that can contribute to a specific required stat.
 * Annotates each option with whether it is currently selected in the timeline,
 * which step position it occupies, or whether it's staged as a planned future choice.
 */
export function buildDecisionChainForStat(
  statName: string,
  currentTimeline: HistoryItem[],
  plannedDecisions: PlannedDecisions = {}
): DecisionChainItem[] {
  const sources = getEffectsFor(statName);
  return chainFromSources(sources, currentTimeline, plannedDecisions);
}

/**
 * Same as buildDecisionChainForStat but for Character.Set(Status.X) requirements,
 * e.g. "Lydia == Status.GRATEFUL" -> chain of decisions that set Lydia to GRATEFUL.
 */
export function buildDecisionChainForStatus(
  person: string,
  statusName: string,
  currentTimeline: HistoryItem[],
  plannedDecisions: PlannedDecisions = {}
): DecisionChainItem[] {
  const sources = getStatusEffectsFor(person, statusName);
  return chainFromSources(sources, currentTimeline, plannedDecisions);
}

function chainFromSources(
  sources: ReturnType<typeof getEffectsFor>,
  currentTimeline: HistoryItem[],
  plannedDecisions: PlannedDecisions
): DecisionChainItem[] {
  const chain: DecisionChainItem[] = [];

  for (const src of sources) {
    const timelineStepIdx = currentTimeline.findIndex((t) => t.eventIndex === src.eventIndex);
    const isOnTimeline = timelineStepIdx >= 0;
    const isSelected = isOnTimeline && currentTimeline[timelineStepIdx].selectedDecisionId === src.decisionId;
    // A planned decision is "invalidated" if the event it targets already exists on the
    // timeline (naturally reached) but ended up with a DIFFERENT (or no) decision selected —
    // meaning the plan was orphaned by an upstream change instead of auto-applying.
    const stillPlanned = plannedDecisions[src.eventIndex] === src.decisionId;
    const isInvalidated = stillPlanned && isOnTimeline && !isSelected;
    const isPlanned = stillPlanned && !isSelected && !isInvalidated;

    chain.push({
      eventIndex: src.eventIndex,
      eventId: src.eventId,
      decisionId: src.decisionId,
      rawEffect: src.raw,
      stepNumber: isOnTimeline ? timelineStepIdx + 1 : null,
      isSelected,
      isPlanned,
      isInvalidated,
    });
  }

  // Sort: decisions on the active timeline first (by step number), then planned, then future/alternate
  return chain.sort((a, b) => {
    if (a.stepNumber !== null && b.stepNumber !== null) return a.stepNumber - b.stepNumber;
    if (a.stepNumber !== null) return -1;
    if (b.stepNumber !== null) return 1;
    if (a.isPlanned !== b.isPlanned) return a.isPlanned ? -1 : 1;
    return a.eventIndex - b.eventIndex;
  });
}
