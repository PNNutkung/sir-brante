// PROTOTYPE — in-memory branch model (immutable-ish snapshots).
// A Branch is a full timeline of {eventIndex, decisionId} pairs. Branches are
// never mutated in place after being forked; "editing" a branch's latest
// decision replaces that branch's timeline (still doesn't touch siblings).
import type { HistoryItem, EngineState } from '../../types/game';
import { getEventByIndex, isDecisionAvailable, initEngine, getAllEvents } from '../../engine/calculator';
import { createInitialState } from '../../engine/initialState';
import { applyConsequences } from '../../engine/consequences';
import { evaluateCondition } from '../../engine/evaluator';

export interface Branch {
  id: string;
  label: string;
  timeline: HistoryItem[];
  parentBranchId: string | null;
  forkPosition: number | null; // position within parent's timeline this branch diverged from
  createdAt: number;
}

function eventKey(varName: string | null, index: number): string {
  return varName ?? `#${index}`;
}

// Same replay logic as engine/calculator.ts's `replay`, duplicated here (prototype
// scope) so we can replay an arbitrary branch's timeline independent of the
// single-timeline production engine.
export function replayBranch(timeline: HistoryItem[]): EngineState {
  const state = createInitialState();
  const out: HistoryItem[] = [];

  for (let i = 0; i < timeline.length; i++) {
    const item = timeline[i];
    const ev = getEventByIndex(item.eventIndex);
    out.push(item);
    if (item.selectedDecisionId) {
      const dec = ev.decisions.find((d) => d.id === item.selectedDecisionId);
      if (dec && isDecisionAvailable(ev, dec.id, state)) {
        applyConsequences(dec.rawConsequences, state);
        applyConsequences(dec.rawHiddenConsequences, state);
        state.passedEvents[eventKey(ev.varName, ev.index)] = true;
      } else {
        out[out.length - 1] = { ...item, selectedDecisionId: null };
        break;
      }
    } else {
      break;
    }
  }

  // If the last timeline entry has a chosen decision, auto-advance to the NEXT reachable event!
  const last = out[out.length - 1];
  if (last && last.selectedDecisionId) {
    const nextEngine = finalizeWithNextEvent(state);
    if (nextEngine) {
      out.push(nextEngine);
    }
  }

  return { gameState: state, timeline: out };
}

function finalizeWithNextEvent(state: any): HistoryItem | null {
  const events = getAllEvents();
  // variable time first
  for (const ev of events) {
    if (ev.isVariableTime && !state.passedEvents[eventKey(ev.varName, ev.index)]) {
      let ok = true;
      for (const r of ev.rawRequirements) {
        if (!evaluateCondition(r, state)) { ok = false; break; }
      }
      if (ok) {
        for (const r of ev.rawHiddenRequirements) {
          if (!evaluateCondition(r, state)) { ok = false; break; }
        }
      }
      if (ok) {
        return { eventIndex: ev.index, eventVarName: ev.varName, selectedDecisionId: null };
      }
    }
  }
  // linear events in declaration order
  for (const ev of events) {
    if (ev.isVariableTime) continue;
    if (state.passedEvents[eventKey(ev.varName, ev.index)]) continue;
    let ok = true;
    for (const r of ev.rawRequirements) {
      if (!evaluateCondition(r, state)) { ok = false; break; }
    }
    if (ok) {
      for (const r of ev.rawHiddenRequirements) {
        if (!evaluateCondition(r, state)) { ok = false; break; }
      }
    }
    if (!ok) {
      state.passedEvents[eventKey(ev.varName, ev.index)] = true;
      continue;
    }
    return { eventIndex: ev.index, eventVarName: ev.varName, selectedDecisionId: null };
  }
  return null;
}

let branchCounter = 0;
export function createRootBranch(): Branch {
  const engine = initEngine();
  const first = engine.timeline[0];
  return {
    id: 'root',
    label: 'Main Path',
    timeline: [{ eventIndex: first.eventIndex, eventVarName: first.eventVarName, selectedDecisionId: null }],
    parentBranchId: null,
    forkPosition: null,
    createdAt: Date.now(),
  };
}

// Fork a branch at `position`: copy the prefix [0..position], apply a NEW decision
// at that position, and let the caller re-derive what comes next via replayBranch.
export function forkBranch(source: Branch, position: number, newDecisionId: string): Branch {
  branchCounter++;
  const prefix = source.timeline.slice(0, position + 1);
  prefix[position] = { ...prefix[position], selectedDecisionId: newDecisionId };
  const ev = getEventByIndex(prefix[position].eventIndex);
  const dec = ev.decisions.find((d) => d.id === newDecisionId);
  return {
    id: `branch-${branchCounter}-${Date.now()}`,
    label: dec ? shortLabel(dec.id) : `Fork @${position}`,
    timeline: prefix,
    parentBranchId: source.id,
    forkPosition: position,
    createdAt: Date.now(),
  };
}

function shortLabel(id: string): string {
  const parts = id.split('_DECISION_');
  return parts[1] ? parts[1].replace(/_/g, ' ').slice(0, 28) : id.slice(0, 28);
}

// Continue a branch's timeline forward (append the next reachable event after replay).
export function extendBranch(branch: Branch): Branch {
  const engine = replayBranch(branch.timeline);
  return { ...branch, timeline: engine.timeline };
}
