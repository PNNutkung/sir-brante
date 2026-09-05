import type { GameState } from '../types/game';
import gameData from '../data/game-data.json';

const statNames = new Set(gameData.stats.map((s: any) => s.name));
const charNames = new Set(Object.keys(gameData.characters));
const flagNames = new Set(Object.keys(gameData.flags));
const statusMap: Record<string, string> = gameData.statuses;
const childDeps: Record<string, string[]> = gameData.childDeps as any;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const statBounds: Record<string, { min: number; max: number }> = {};
for (const s of gameData.stats as any[]) {
  statBounds[s.name] = { min: s.min, max: s.max };
}

function addStat(state: GameState, name: string, delta: number) {
  const bounds = statBounds[name] || { min: -999, max: 999 };
  state.stats[name] = clamp((state.stats[name] ?? 0) + delta, bounds.min, bounds.max);
  // childhood/adolescence stats also add to their dependent adult stats
  const deps = childDeps[name];
  if (deps) {
    for (const dep of deps) {
      const db = statBounds[dep] || { min: -999, max: 999 };
      state.stats[dep] = clamp((state.stats[dep] ?? 0) + delta, db.min, db.max);
    }
  }
}

function addRelations(state: GameState, charName: string, delta: number) {
  const c = state.characters[charName];
  if (!c) return;
  c.relations = c.relations + delta;
}

function setStatus(state: GameState, charName: string, statusKey: string | null) {
  const c = state.characters[charName];
  if (!c) return;
  c.status = statusKey;
}

function setName(state: GameState, charName: string, nameKey: string) {
  const c = state.characters[charName];
  if (!c) return;
  c.nameOverrideKey = nameKey;
}

function checkFlag(state: GameState, flagName: string) {
  state.flags[flagName] = true;
}

function addActiveOccupation(state: GameState, statName: string) {
  if (!state.activeOccupationStats.includes(statName)) {
    state.activeOccupationStats.push(statName);
  }
}

function removeOccupationAt(state: GameState, index: number) {
  if (index >= 0 && index < state.activeOccupationStats.length) {
    state.activeOccupationStats.splice(index, 1);
  }
}

// Apply a single raw consequence expression (C#-derived) against state, mutating it.
export function applyConsequence(raw: string, state: GameState): void {
  const s = raw.trim();

  let m = s.match(/^MainWindow\.ViewModel\.OccupationStats\.Add\((\w+)\)$/);
  if (m) {
    addActiveOccupation(state, m[1]);
    return;
  }
  m = s.match(/^MainWindow\.ViewModel\.OccupationStats\.RemoveAt\((\d+)\)$/);
  if (m) {
    removeOccupationAt(state, parseInt(m[1], 10));
    return;
  }
  m = s.match(/^([A-Za-z0-9_]+)\.Add\((-?\d+)\)$/);
  if (m && statNames.has(m[1])) {
    addStat(state, m[1], parseInt(m[2], 10));
    return;
  }
  if (m && charNames.has(m[1])) {
    addRelations(state, m[1], parseInt(m[2], 10));
    return;
  }
  m = s.match(/^([A-Za-z0-9_]+)\.Set\((Status\.[A-Za-z0-9_]+|null)\)$/);
  if (m && charNames.has(m[1])) {
    const raw2 = m[2];
    if (raw2 === 'null') {
      setStatus(state, m[1], null);
    } else {
      const sid = raw2.replace('Status.', '');
      setStatus(state, m[1], statusMap[sid] ?? sid);
    }
    return;
  }
  m = s.match(/^([A-Za-z0-9_]+)\.SetName\("([^"]+)"\)$/);
  if (m && charNames.has(m[1])) {
    setName(state, m[1], m[2]);
    return;
  }
  m = s.match(/^([A-Za-z0-9_]+)\.Check\(\)$/);
  if (m && flagNames.has(m[1])) {
    checkFlag(state, m[1]);
    return;
  }
  // eslint-disable-next-line no-console
  console.warn('Unhandled consequence:', raw);
}

export function applyConsequences(list: string[], state: GameState): void {
  for (const c of list) applyConsequence(c, state);
}
