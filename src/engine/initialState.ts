import type { GameState } from '../types/game';
import gameData from '../data/game-data.json';

export function createInitialState(): GameState {
  const stats: Record<string, number> = {};
  for (const s of gameData.stats as any[]) {
    stats[s.name] = s.initial;
  }

  const characters: GameState['characters'] = {};
  for (const varName of gameData.characterOrder as string[]) {
    const def = (gameData.characters as any)[varName];
    characters[varName] = {
      locKey: def.locKey,
      nameOverrideKey: null,
      relations: def.initialRelations,
      status: null,
    };
  }

  const flags: Record<string, boolean> = {};
  for (const f of Object.keys(gameData.flags)) {
    flags[f] = false;
  }

  return {
    stats,
    characters,
    flags,
    activeOccupationStats: ['Network', 'Unrest'],
    passedEvents: {},
  };
}

export function cloneState(state: GameState): GameState {
  return {
    stats: { ...state.stats },
    characters: Object.fromEntries(
      Object.entries(state.characters).map(([k, v]) => [k, { ...v }])
    ),
    flags: { ...state.flags },
    activeOccupationStats: [...state.activeOccupationStats],
    passedEvents: { ...state.passedEvents },
  };
}
