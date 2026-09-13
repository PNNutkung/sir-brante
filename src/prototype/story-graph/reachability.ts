// PROTOTYPE — reachability sweep over the full event graph.
// Unlike calculator.ts (which finds ONE next event deterministically), this
// computes, for a given GameState, which of the 232 events are currently
// satisfied/blocked, and WHY — used to draw the graph & requirement inspector.
import gameData from '../../data/game-data.json';
import type { EventDef, GameState, DecisionDef } from '../../types/game';
import { evaluateCondition } from '../../engine/evaluator';
import { getEffectsFor, extractRequirementIdentifiers, type Effect } from './dependencyIndex';

export const allEvents: EventDef[] = gameData.events as any;

export type ClauseStatus = {
  raw: string;
  satisfied: boolean;
  identifiers: string[];
  sources: Effect[]; // decisions elsewhere in the game that write to these identifiers
};

export type RequirementReport = {
  clauses: ClauseStatus[];
  allSatisfied: boolean;
};

// Split a boolean expression into its top-level `&&` clauses (best-effort; does not
// split inside parens). Good enough for the flat "A && B && C" shape most requirements use.
function splitTopLevelAnd(expr: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (depth === 0 && c === '&' && expr[i + 1] === '&') {
      parts.push(cur.trim());
      cur = '';
      i++;
      continue;
    }
    cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

export function analyzeRequirement(raw: string, state: GameState): RequirementReport {
  const clauseStrings = splitTopLevelAnd(raw);
  const clauses: ClauseStatus[] = clauseStrings.map((c) => {
    const identifiers = extractRequirementIdentifiers(c);
    const sources = identifiers.flatMap((id) => getEffectsFor(id));
    return {
      raw: c,
      satisfied: evaluateCondition(c, state),
      identifiers,
      sources,
    };
  });
  return { clauses, allSatisfied: clauses.every((c) => c.satisfied) };
}

export type EventReachability = {
  event: EventDef;
  eventSatisfied: boolean;
  eventReport: RequirementReport[]; // one per raw requirement string
  decisions: {
    decision: DecisionDef;
    satisfied: boolean;
    report: RequirementReport[];
  }[];
};

export function computeReachability(state: GameState): EventReachability[] {
  return allEvents.map((ev) => {
    const eventReport = [...ev.rawRequirements, ...ev.rawHiddenRequirements].map((r) =>
      analyzeRequirement(r, state)
    );
    const eventSatisfied = eventReport.every((r) => r.allSatisfied);
    const decisions = ev.decisions.map((dec) => {
      const report = [...dec.rawRequirements, ...dec.rawHiddenRequirements].map((r) =>
        analyzeRequirement(r, state)
      );
      return { decision: dec, satisfied: report.every((r) => r.allSatisfied), report };
    });
    return { event: ev, eventSatisfied, eventReport, decisions };
  });
}
