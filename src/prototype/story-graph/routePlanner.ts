// PROTOTYPE — bounded route planner: finds combinations of future/available decisions
// that satisfy a requirement clause, using the SAME engine primitives as the live
// timeline (applyConsequences / evaluateCondition) so recommendations never disagree
// with actual game behavior. Not a second rules engine — just search + real simulation.
import type { GameState, HistoryItem } from '../../types/game';
import { evaluateCondition } from '../../engine/evaluator';
import { applyConsequences } from '../../engine/consequences';
import { cloneState } from '../../engine/initialState';
import { getEffectsFor, getAllConsequencesForDecision, type Effect } from './dependencyIndex';
import { splitTopLevelAndClauses, splitTopLevelOr } from './formatters';

export interface RouteStep {
  eventIndex: number;
  eventId: string;
  decisionId: string;
  raw: string;
}

export interface Route {
  steps: RouteStep[];
  negativeEffects: string[]; // full raw consequences with negative deltas, across all steps
  score: number; // lower is better
}

function atomIdentifier(atom: string): string | null {
  const statMatch = atom.trim().match(/^([A-Za-z0-9_]+)\s*(>=|<=|>|<|==|!=)/);
  return statMatch ? statMatch[1] : null;
}

function effectKey(e: Effect): string {
  return `${e.eventIndex}:${e.decisionId}`;
}

/**
 * Finds up to `maxRoutes` combinations of decisions that satisfy `clauseRaw`.
 * Handles top-level OR by solving each branch independently and merging by score.
 * Handles top-level AND by searching combinations of decisions (bounded breadth/depth)
 * that jointly satisfy the whole clause when simulated through the real engine.
 */
export function findRoutesForClause(
  clauseRaw: string,
  gameState: GameState,
  timeline: HistoryItem[],
  maxRoutes = 3
): Route[] {
  const orBranches = splitTopLevelOr(clauseRaw);
  if (orBranches.length > 1) {
    const all: Route[] = [];
    for (const branch of orBranches) {
      all.push(...findRoutesForClause(branch, gameState, timeline, maxRoutes));
    }
    return dedupeAndRank(all, maxRoutes);
  }

  const andAtoms = splitTopLevelAndClauses(clauseRaw);

  // Gather candidate decisions per atom: sources that write to the atom's identifier,
  // excluding decisions already selected on the timeline (those are already "spent").
  const pool: Effect[] = [];
  const seen = new Set<string>();
  for (const atom of andAtoms) {
    const id = atomIdentifier(atom);
    if (!id) continue;
    const candidates = getEffectsFor(id).filter((e) => {
      const isSelected = timeline.some(
        (t) => t.eventIndex === e.eventIndex && t.selectedDecisionId === e.decisionId
      );
      return !isSelected;
    });
    for (const c of candidates.slice(0, 6)) {
      const key = effectKey(c);
      if (!seen.has(key)) {
        seen.add(key);
        pool.push(c);
      }
    }
  }

  function simulate(combo: Effect[]): { ok: boolean; negatives: string[] } {
    const state = cloneState(gameState);
    const negatives: string[] = [];
    const sorted = [...combo].sort((a, b) => a.eventIndex - b.eventIndex);
    for (const step of sorted) {
      const allConsequences = getAllConsequencesForDecision(step.eventIndex, step.decisionId);
      applyConsequences(allConsequences, state);
      for (const c of allConsequences) {
        if (/^[A-Za-z0-9_]+\.Add\(-\d+\)$/.test(c)) negatives.push(c);
      }
    }
    return { ok: evaluateCondition(clauseRaw, state), negatives };
  }

  const routes: Route[] = [];
  const toRoute = (combo: Effect[], negatives: string[]): Route => ({
    steps: combo.map((e) => ({ eventIndex: e.eventIndex, eventId: e.eventId, decisionId: e.decisionId, raw: e.raw })),
    negativeEffects: negatives,
    score: combo.length + negatives.length * 2,
  });

  // Depth 1
  for (const e of pool) {
    const { ok, negatives } = simulate([e]);
    if (ok) routes.push(toRoute([e], negatives));
  }

  // Depth 2 (bounded pool size to keep this cheap)
  if (routes.length < maxRoutes && pool.length <= 14) {
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const combo = [pool[i], pool[j]];
        const { ok, negatives } = simulate(combo);
        if (ok) routes.push(toRoute(combo, negatives));
      }
      if (routes.length >= maxRoutes * 4) break;
    }
  }

  // Depth 3 only if nothing found yet and the pool is small
  if (routes.length === 0 && pool.length <= 9) {
    outer: for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        for (let k = j + 1; k < pool.length; k++) {
          const combo = [pool[i], pool[j], pool[k]];
          const { ok, negatives } = simulate(combo);
          if (ok) routes.push(toRoute(combo, negatives));
          if (routes.length >= maxRoutes * 4) break outer;
        }
      }
    }
  }

  return dedupeAndRank(routes, maxRoutes);
}

function dedupeAndRank(routes: Route[], maxRoutes: number): Route[] {
  const byKey = new Map<string, Route>();
  for (const r of routes) {
    const key = r.steps.map((s) => `${s.eventIndex}:${s.decisionId}`).sort().join('|');
    const existing = byKey.get(key);
    if (!existing || r.score < existing.score) byKey.set(key, r);
  }
  return Array.from(byKey.values())
    .sort((a, b) => a.score - b.score)
    .slice(0, maxRoutes);
}
