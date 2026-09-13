// Helper to format raw consequence expressions into user-friendly strings:
// e.g. "Determination.Add(1)" -> "Determination +1"
//      "Willpower.Add(-5)"    -> "Willpower -5"
//      "Robert.Add(1)"        -> "Robert +1"
//      "Octavia.Set(Status.REMEMBERS_YOU)" -> "Octavia: Remembers You"
//      "MattersOfTheHeart.Check()" -> "Flag: MattersOfTheHeart"

export function formatEffect(raw: string): string {
  if (!raw) return '';

  // Stat.Add(N) or Character.Add(N)
  const addMatch = raw.match(/^([A-Za-z0-9_]+)\.Add\(([-+]?\d+)\)$/);
  if (addMatch) {
    const stat = addMatch[1];
    const val = parseInt(addMatch[2], 10);
    const sign = val > 0 ? '+' : '';
    return `${stat} ${sign}${val}`;
  }

  // Character.Set(Status.XYZ)
  const setMatch = raw.match(/^([A-Za-z0-9_]+)\.Set\(Status\.([A-Za-z0-9_]+)\)$/);
  if (setMatch) {
    const char = setMatch[1];
    const statusName = setMatch[2].replace(/_/g, ' ').toLowerCase();
    const formattedStatus = statusName.charAt(0).toUpperCase() + statusName.slice(1);
    return `${char} is ${formattedStatus}`;
  }

  // Flag.Check()
  const flagMatch = raw.match(/^([A-Za-z0-9_]+)\.Check\(\)$/);
  if (flagMatch) {
    return `Flag: ${flagMatch[1]}`;
  }

  // Fallback for OccupationStats or complex calls
  if (raw.includes('OccupationStats.Add')) {
    return 'Unlock Occupation Stat';
  }
  if (raw.includes('OccupationStats.RemoveAt')) {
    return 'Remove Occupation Stat';
  }

  return raw;
}

export function formatEffectsList(effects: string[]): string {
  if (!effects || effects.length === 0) return '';
  return effects.map(formatEffect).join(', ');
}

// --- Requirement display formatting (separate from the evaluator; never touches raw logic) ---

export interface StatusRequirement {
  person: string;
  statusName: string; // e.g. GRATEFUL
  negated: boolean;
}

export function parseStatusRequirement(raw: string): StatusRequirement | null {
  const m = raw.trim().match(/^([A-Za-z0-9_]+)\s*(==|!=)\s*Status\.([A-Za-z0-9_]+)$/);
  if (!m) return null;
  return { person: m[1], statusName: m[3], negated: m[2] === '!=' };
}

export function humanizeStatusName(status: string): string {
  const cleaned = status.replace(/^CHARACTER_STATUS_[A-Z0-9]+_/, '').replace(/^STATUS_/, '');
  const words = cleaned.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Turns an event varName (e.g. "TheSacrament") or full event id
// (e.g. "EVENTS_YOUTH_THE_SACRAMENT") into a readable title, preferring the
// real localized event title when we can resolve it via translate().
function humanizeEventReference(varNameOrId: string, translateFn: (lang: any, key: string) => string): string {
  // If it looks like a full EVENTS_ id, translate it directly.
  if (/^EVENTS_/.test(varNameOrId)) {
    const tr = translateFn('English', varNameOrId);
    if (tr && tr !== varNameOrId) return tr;
    return varNameOrId.replace(/^EVENTS_[A-Z]+_/, '').replace(/_/g, ' ');
  }
  // Otherwise it's a camelCase varName (e.g. "TheSacrament") used in `.HasPassed` checks.
  // Split camelCase into words: "TheSacrament" -> "The Sacrament"
  return varNameOrId.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim();
}

// Splits a boolean expression into its top-level clauses for a given operator
// ('&&' or '||'), without descending into parenthesized sub-expressions.
function splitTopLevel(expr: string, operator: '&&' | '||'): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (depth === 0 && c === operator[0] && expr[i + 1] === operator[1]) {
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

export function splitTopLevelOr(expr: string): string[] {
  return splitTopLevel(expr, '||');
}

export function splitTopLevelAndClauses(expr: string): string[] {
  return splitTopLevel(expr, '&&');
}

// Strips one layer of fully-wrapping parentheses, e.g. "(A && B)" -> "A && B".
function stripWrappingParens(expr: string): string {
  const trimmed = expr.trim();
  if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) return trimmed;
  let depth = 0;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '(') depth++;
    if (trimmed[i] === ')') {
      depth--;
      // Closing paren before the very end means the outer parens don't wrap everything.
      if (depth === 0 && i !== trimmed.length - 1) return trimmed;
    }
  }
  return trimmed.slice(1, -1).trim();
}

// Turns raw requirement clauses into a human-readable string for display only.
// Never touches evaluation logic — display formatting only.
// e.g. "Lydia == Status.GRATEFUL"                      -> "Lydia is Grateful"
//      "Lydia != Status.GRATEFUL"                       -> "Lydia is not Grateful"
//      "Determination >= 2"                             -> "Determination >= 2" (numeric clauses stay as-is)
//      "Perception >= 4 || Robert == Status.GRATEFUL"   -> "Perception >= 4 or Robert is Grateful"
export function formatRequirementDisplay(raw: string, translateFn?: (lang: any, key: string) => string): string {
  const trimmed = stripWrappingParens(raw);

  const orParts = splitTopLevelOr(trimmed);
  if (orParts.length > 1) {
    return orParts.map((p) => formatRequirementDisplay(p, translateFn)).join(' or ');
  }

  const andParts = splitTopLevelAndClauses(trimmed);
  if (andParts.length > 1) {
    return andParts.map((p) => formatRequirementDisplay(p, translateFn)).join(' and ');
  }

  // !EventVar.HasPassed / EventVar.HasPassed
  const hasPassedMatch = trimmed.match(/^(!)?\s*([A-Za-z0-9_]+)\.HasPassed$/);
  if (hasPassedMatch) {
    const negated = !!hasPassedMatch[1];
    const eventRef = translateFn
      ? humanizeEventReference(hasPassedMatch[2], translateFn)
      : hasPassedMatch[2].replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim();
    return `${eventRef} has${negated ? ' not' : ''} been completed`;
  }

  const sr = parseStatusRequirement(trimmed);
  if (sr) {
    const pretty = humanizeStatusName(sr.statusName);
    return `${sr.person} is${sr.negated ? ' not' : ''} ${pretty}`;
  }

  // Readable numeric comparisons: "Perception >= 4" -> "Perception is at least 4"
  const cmpMatch = trimmed.match(/^([A-Za-z0-9_]+)\s*(>=|<=|>|<|==|!=)\s*([-+]?\d+)$/);
  if (cmpMatch) {
    const [, name, op, num] = cmpMatch;
    const opWords: Record<string, string> = {
      '>=': 'is at least',
      '<=': 'is at most',
      '>': 'is more than',
      '<': 'is less than',
      '==': 'is',
      '!=': 'is not',
    };
    return `${name} ${opWords[op] ?? op} ${num}`;
  }

  return trimmed;
}

// Formats a raw consequence expression AND projects the resulting stat/relations
// value against the given game state, e.g. "Perception.Add(1)" + {Perception: 3} -> "Perception +1 → 4"
export function formatEffectWithProjection(
  raw: string,
  gameState: { stats: Record<string, number>; characters: Record<string, { relations: number }> }
): string {
  const base = formatEffect(raw);
  const addMatch = raw.match(/^([A-Za-z0-9_]+)\.Add\(([-+]?\d+)\)$/);
  if (addMatch) {
    const name = addMatch[1];
    const delta = parseInt(addMatch[2], 10);
    let current: number | undefined;
    if (name in gameState.stats) current = gameState.stats[name];
    else if (name in gameState.characters) current = gameState.characters[name].relations;
    if (current !== undefined) {
      return `${base} → ${current + delta}`;
    }
  }
  return base;
}
