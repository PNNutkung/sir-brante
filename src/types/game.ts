export type Language = 'English' | 'Русский' | '简体中文';

export interface CharacterState {
  locKey: string;
  nameOverrideKey: string | null;
  relations: number;
  status: string | null; // localization key of status, or null
}

export interface GameState {
  stats: Record<string, number>;
  characters: Record<string, CharacterState>;
  flags: Record<string, boolean>;
  activeOccupationStats: string[]; // varnames of stats currently shown in Occupation group
  passedEvents: Record<string, boolean>;
}

export interface DecisionDef {
  id: string;
  rawRequirements: string[];
  rawHiddenRequirements: string[];
  rawConsequences: string[];
  rawHiddenConsequences: string[];
  compiledReqs: string[];
  compiledHiddenReqs: string[];
  compiledConseqs: string[];
  compiledHiddenConseqs: string[];
}

export interface EventDef {
  index: number;
  id: string;
  varName: string | null;
  isVariableTime: boolean;
  rawRequirements: string[];
  rawHiddenRequirements: string[];
  compiledReqs: string[];
  compiledHiddenReqs: string[];
  decisions: DecisionDef[];
}

export interface StatDef {
  name: string;
  initial: number;
  min: number;
  max: number;
}

export interface StatGroupDef {
  id: string;
  locKey: string;
  stats: string[];
}

export interface CharacterDef {
  locKey: string;
  initialRelations: number;
}

export interface GameData {
  events: EventDef[];
  stats: StatDef[];
  statGroups: StatGroupDef[];
  childDeps: Record<string, string[]>;
  characters: Record<string, CharacterDef>;
  characterOrder: string[];
  flags: Record<string, string>;
  statuses: Record<string, string>;
  eventVars: string[];
}

export interface HistoryItem {
  eventIndex: number;
  eventVarName: string | null;
  selectedDecisionId: string | null;
}

export interface EngineState {
  gameState: GameState;
  timeline: HistoryItem[]; // events shown so far, in order, with the decision selected (or null)
}
