import gameData from '../data/game-data.json';
import type { EngineState, EventDef, GameState, HistoryItem } from '../types/game';
import { createInitialState } from './initialState';
import { evaluateCondition } from './evaluator';
import { applyConsequences } from './consequences';

const events: EventDef[] = gameData.events as any;

function eventIsAvailable(ev: EventDef, state: GameState): boolean {
  for (const r of ev.rawRequirements) {
    if (!evaluateCondition(r, state)) return false;
  }
  for (const r of ev.rawHiddenRequirements) {
    if (!evaluateCondition(r, state)) return false;
  }
  return true;
}

function decisionIsAvailable(dec: EventDef['decisions'][number], state: GameState): boolean {
  for (const r of dec.rawRequirements) {
    if (!evaluateCondition(r, state)) return false;
  }
  for (const r of dec.rawHiddenRequirements) {
    if (!evaluateCondition(r, state)) return false;
  }
  return true;
}

// Determine the next event to show, given passedEvents state.
// Mirrors MainWindow.GetNextEvent(): variable-time events (that are available & not passed)
// take priority; otherwise the next linear event in declaration order that hasn't passed
// (auto-skipping ones whose requirements fail, marking them passed).
function getNextEvent(state: GameState): EventDef | null {
  // variable time events first
  for (const ev of events) {
    if (ev.isVariableTime && !state.passedEvents[eventKey(ev)] && eventIsAvailable(ev, state)) {
      return ev;
    }
  }
  // linear events in order
  for (const ev of events) {
    if (ev.isVariableTime) continue;
    if (state.passedEvents[eventKey(ev)]) continue;
    if (!eventIsAvailable(ev, state)) {
      // auto pass unavailable linear events (mirrors HasPassed = true skip)
      state.passedEvents[eventKey(ev)] = true;
      continue;
    }
    return ev;
  }
  return null;
}

function eventKey(ev: EventDef): string {
  return ev.varName ?? `#${ev.index}`;
}

export function initEngine(): EngineState {
  const gameState = createInitialState();
  const timeline: HistoryItem[] = [];
  const first = getNextEvent(gameState);
  if (first) {
    timeline.push({ eventIndex: first.index, eventVarName: first.varName, selectedDecisionId: null });
  }
  return { gameState, timeline };
}

export function getEventByIndex(index: number): EventDef {
  return events[index];
}

export function isEventAvailable(ev: EventDef, state: GameState): boolean {
  return eventIsAvailable(ev, state);
}

export function isDecisionAvailable(ev: EventDef, decisionId: string, state: GameState): boolean {
  const dec = ev.decisions.find((d) => d.id === decisionId);
  if (!dec) return false;
  return decisionIsAvailable(dec, state);
}

// Selecting a decision for the event at `eventIndexInTimeline` (position in timeline array).
// Replays from the beginning: applies all decisions before/including this one, drops any
// timeline entries after events whose decisions become unavailable, then figures out what to
// show next.
export function selectDecision(engine: EngineState, timelinePos: number, decisionId: string): EngineState {
  const newTimeline = engine.timeline.slice(0, timelinePos + 1);
  newTimeline[timelinePos] = { ...newTimeline[timelinePos], selectedDecisionId: decisionId };
  return replay(newTimeline);
}

// Re-select at an earlier point (user clicked an earlier event to change its decision):
// truncate timeline there, keep or clear that event's decision as requested by caller.
export function selectAtPosition(engine: EngineState, timelinePos: number, decisionId: string | null): EngineState {
  const newTimeline = engine.timeline.slice(0, timelinePos + 1);
  newTimeline[timelinePos] = { ...newTimeline[timelinePos], selectedDecisionId: decisionId };
  return replay(newTimeline);
}

function replay(timeline: HistoryItem[]): EngineState {
  const state = createInitialState();

  for (let i = 0; i < timeline.length; i++) {
    const item = timeline[i];
    const ev = events[item.eventIndex];

    if (item.selectedDecisionId) {
      const dec = ev.decisions.find((d) => d.id === item.selectedDecisionId);
      if (dec && decisionIsAvailable(dec, state)) {
        applyConsequences(dec.rawConsequences, state);
        applyConsequences(dec.rawHiddenConsequences, state);
        state.passedEvents[eventKey(ev)] = true;
      } else {
        // decision no longer valid; truncate here
        const truncated = timeline.slice(0, i);
        truncated.push({ ...item, selectedDecisionId: null });
        return finalizeWithNext(truncated, state);
      }
    } else {
      // no decision selected yet at this position — this should be the last item
      return finalizeWithNext(timeline.slice(0, i + 1), state);
    }
  }

  return finalizeWithNext(timeline, state);
}

function finalizeWithNext(timeline: HistoryItem[], state: GameState): EngineState {
  // if last item has a decision selected, we need to find the next event
  const last = timeline[timeline.length - 1];
  if (last && last.selectedDecisionId) {
    const next = getNextEvent(state);
    if (next) {
      timeline.push({ eventIndex: next.index, eventVarName: next.varName, selectedDecisionId: null });
    }
  } else if (!last) {
    const next = getNextEvent(state);
    if (next) {
      timeline.push({ eventIndex: next.index, eventVarName: next.varName, selectedDecisionId: null });
    }
  }
  return { gameState: state, timeline };
}

export function resetEngine(): EngineState {
  return initEngine();
}

export function getAllEvents(): EventDef[] {
  return events;
}
