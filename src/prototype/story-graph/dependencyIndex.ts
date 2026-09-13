// PROTOTYPE — throwaway dependency indexer.
// Scans every decision's raw consequences and builds identifier -> effect index,
// so the requirement inspector can suggest "which past decision sets this".
import gameData from '../../data/game-data.json';
import type { EventDef } from '../../types/game';

const events: EventDef[] = gameData.events as any;

export interface Effect {
  eventIndex: number;
  eventId: string;
  decisionId: string;
  raw: string;
}

const index = new Map<string, Effect[]>();

function extractTarget(expr: string): string | null {
  // Matches the leading identifier before the first "." in a consequence, e.g.
  // "Willpower.Add(-5)" -> Willpower, "Octavia.Set(Status.X)" -> Octavia,
  // "MattersOfTheHeart.Check()" -> MattersOfTheHeart
  const m = expr.match(/^([A-Za-z_][A-Za-z0-9_]*)\./);
  return m ? m[1] : null;
}

function build() {
  for (const ev of events) {
    for (const dec of ev.decisions) {
      const all = [...dec.rawConsequences, ...dec.rawHiddenConsequences];
      for (const raw of all) {
        const target = extractTarget(raw);
        if (!target) continue;
        const arr = index.get(target) ?? [];
        arr.push({ eventIndex: ev.index, eventId: ev.id, decisionId: dec.id, raw });
        index.set(target, arr);
      }
    }
  }
}
build();

export function getEffectsFor(identifier: string): Effect[] {
  return index.get(identifier) ?? [];
}

// Filters effects for `person` down to only Set(Status.X) writes matching statusName.
export function getStatusEffectsFor(person: string, statusName: string): Effect[] {
  const re = new RegExp(`^${person}\\.Set\\(Status\\.${statusName}\\)$`);
  return getEffectsFor(person).filter((e) => re.test(e.raw));
}

// Returns ALL raw consequences (not just the matched one) for a given decision,
// so the UI can show full trade-offs when surfacing a decision-chain option.
export function getAllConsequencesForDecision(eventIndex: number, decisionId: string): string[] {
  const ev = events.find((e) => e.index === eventIndex);
  const dec = ev?.decisions.find((d) => d.id === decisionId);
  return dec ? [...dec.rawConsequences, ...dec.rawHiddenConsequences] : [];
}

// Extract candidate identifiers referenced inside a REQUIREMENT expression
// (bare names, or the left side of a ".HasPassed" reference).
export function extractRequirementIdentifiers(expr: string): string[] {
  const ids = new Set<string>();
  const re = /([A-Za-z_][A-Za-z0-9_]*)/g;
  let mt: RegExpExecArray | null;
  while ((mt = re.exec(expr))) {
    const word = mt[1];
    if (word === 'true' || word === 'false' || word === 'null' || word === 'HasPassed') continue;
    ids.add(word);
  }
  return Array.from(ids);
}
