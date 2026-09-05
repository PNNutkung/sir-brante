import type { DecisionDef } from '../types/game';
import type { Language } from '../types/game';
import { translate, getLogicalOp } from '../i18n/translate';

// Render a raw C# requirement/consequence expression as localized human text,
// mirroring ExpressionTool.ConvertExpressionToText / ConvertActionExpressionToText.

function tokenizeSimple(expr: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (c === ' ') { i++; continue; }
    if (c === '(' || c === ')') { out.push(c); i++; continue; }
    if (expr.slice(i, i + 2) === '&&' || expr.slice(i, i + 2) === '||') { out.push(expr.slice(i, i + 2)); i += 2; continue; }
    if (expr.slice(i, i + 2) === '==' || expr.slice(i, i + 2) === '!=' || expr.slice(i, i + 2) === '>=' || expr.slice(i, i + 2) === '<=') { out.push(expr.slice(i, i + 2)); i += 2; continue; }
    if (c === '>' || c === '<' || c === '!') { out.push(c); i++; continue; }
    if (c === '"') {
      let j = i + 1;
      while (j < expr.length && expr[j] !== '"') j++;
      out.push(expr.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    let j = i;
    while (j < expr.length && !' ()'.includes(expr[j]) && expr.slice(j, j + 2) !== '&&' && expr.slice(j, j + 2) !== '||') j++;
    out.push(expr.slice(i, j));
    i = j;
  }
  return out;
}

const statLoc: Record<string, string> = {
  Willpower: 'STAT_LIFETIME_WILLPOWER', Deaths: 'STAT_LIFETIME_DEATHS',
  Reputation: 'STAT_FAMILY_REPUTATION', Wealth: 'STAT_FAMILY_WEALTH', Unity: 'STAT_FAMILY_UNITY',
  Order: 'STAT_PROVINCE_ORDER', WealthOfMagra: 'STAT_PROVINCE_WEALTH_OF_MAGRA', Power: 'STAT_PROVINCE_POWER', Church: 'STAT_PROVINCE_CHURCH',
  Diplomacy: 'STAT_YOUTH_DIPLOMACY', Valor: 'STAT_YOUTH_VALOR', Theology: 'STAT_YOUTH_THEOLOGY',
  Eloquence: 'STAT_YOUTH_ELOQUENCE', Manipulation: 'STAT_YOUTH_MANIPULATION', Scheming: 'STAT_YOUTH_SCHEMING',
  Determination: 'STAT_CHILDHOOD_DETERMINATION', Perception: 'STAT_CHILDHOOD_PERCEPTION',
  Nobility: 'STAT_ADOLESCENCE_NOBILITY', Ingenuity: 'STAT_ADOLESCENCE_INGENUITY', Spirituality: 'STAT_ADOLESCENCE_SPIRITUALITY',
  Career: 'STAT_OCCUPATION_JUDGE_CAREER', Justice: 'STAT_OCCUPATION_JUDGE_JUSTICE',
  Inquisition: 'STAT_OCCUPATION_INQUISITOR_INQUISITION_POWER', Tolerance: 'STAT_OCCUPATION_INQUISITOR_TOLERANCE_OF_FAITHS',
  Unrest: 'STAT_OCCUPATION_CONSPIRATOR_UNREST', Network: 'STAT_OCCUPATION_CONSPIRATOR_SPY_NETWORK',
  Revolt: 'STAT_REVOLT_REVOLT', Troops: 'STAT_REVOLT_TROOPS', Nobles: 'STAT_REVOLT_NOBLES', Clergy: 'STAT_REVOLT_CLERGY', CommonFolk: 'STAT_REVOLT_COMMON_FOLK',
};

import gameData from '../data/game-data.json';
const charLoc: Record<string, string> = Object.fromEntries(
  Object.entries(gameData.characters as any).map(([k, v]: any) => [k, v.locKey])
);
const flagLoc: Record<string, string> = gameData.flags as any;
const statusLoc: Record<string, string> = gameData.statuses as any;

function resolveIdentText(id: string, lang: Language): string {
  if (id in statLoc) return translate(lang, statLoc[id]);
  if (id in charLoc) return translate(lang, charLoc[id]);
  if (id in flagLoc) return translate(lang, flagLoc[id]);
  return id;
}

export function formatRequirement(expr: string, lang: Language): string {
  if (!expr) return '';
  // Handle Character.HasPassed style already excluded from visible text (those are hidden usually)
  // Simplify status literal
  let s = expr;
  s = s.replace(/Status\.([A-Za-z0-9_]+)/g, (_m, sid) => {
    const key = statusLoc[sid] ?? sid;
    return `"${translate(lang, key)}"`;
  });

  const toks = tokenizeSimple(s);
  const AND = getLogicalOp(lang, 'LOGICAL_OPERATION_AND');
  const OR = getLogicalOp(lang, 'LOGICAL_OPERATION_OR');
  const NOT = getLogicalOp(lang, 'LOGICAL_OPERATION_NOT');

  const parts: string[] = [];
  let i = 0;
  while (i < toks.length) {
    const t = toks[i];
    if (t === '&&') { parts.push(AND); i++; continue; }
    if (t === '||') { parts.push(OR); i++; continue; }
    if (t === '(' || t === ')') { parts.push(t); i++; continue; }
    if (['==', '!=', '>', '>=', '<', '<='].includes(t)) { parts.push(t === '==' ? '=' : t === '!=' ? '\u2260' : t === '>=' ? '\u2265' : t === '<=' ? '\u2264' : t); i++; continue; }
    if (t.startsWith('"')) { parts.push(t.replace(/"/g, '')); i++; continue; }
    if (t.includes('.HasPassed')) {
      const evVar = t.split('.')[0];
      parts.push(`${evVar} happened`);
      i++;
      continue;
    }
    if (/^-?\d+$/.test(t)) { parts.push(t); i++; continue; }
    if (t === 'true' || t === 'false' || t === 'null') { parts.push(t); i++; continue; }
    parts.push(resolveIdentText(t, lang));
    i++;
  }

  // simplify "X = true" -> "X", "X = false" -> "NOT X" style, best-effort
  let out = parts.join(' ');
  out = out.replace(/(\S+) = true/g, '$1');
  out = out.replace(/(\S+) = false/g, `${NOT} $1`);
  return out;
}

export function formatConsequence(expr: string, lang: Language): string {
  const s = expr.trim();
  let m = s.match(/^([A-Za-z0-9_]+)\.Add\((-?\d+)\)$/);
  if (m) {
    const name = resolveIdentText(m[1], lang);
    const val = parseInt(m[2], 10);
    return `${name} ${val > 0 ? '+' : ''}${val}`;
  }
  m = s.match(/^([A-Za-z0-9_]+)\.Set\((Status\.[A-Za-z0-9_]+|null)\)$/);
  if (m) {
    const name = resolveIdentText(m[1], lang);
    if (m[2] === 'null') return `${name} = —`;
    const sid = m[2].replace('Status.', '');
    const key = statusLoc[sid] ?? sid;
    return `${name} = ${translate(lang, key)}`;
  }
  m = s.match(/^([A-Za-z0-9_]+)\.Check\(\)$/);
  if (m) {
    return resolveIdentText(m[1], lang);
  }
  m = s.match(/^([A-Za-z0-9_]+)\.SetName\("([^"]+)"\)$/);
  if (m) {
    return `${resolveIdentText(m[1], lang)} \u2192 ${translate(lang, m[2])}`;
  }
  if (s.includes('OccupationStats')) return '';
  return s;
}

export function DecisionOption({
  decision,
  lang,
  isAvailable,
  isSelected,
  onSelect,
}: {
  decision: DecisionDef;
  lang: Language;
  isAvailable: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const reqTexts = decision.rawRequirements.map((r) => formatRequirement(r, lang)).filter(Boolean);
  const conseqTexts = decision.rawConsequences.map((c) => formatConsequence(c, lang)).filter(Boolean);

  return (
    <div className={`decision-option ${isAvailable ? '' : 'decision-disabled'} ${isSelected ? 'decision-selected' : ''}`}>
      <label className="decision-label">
        <input
          type="radio"
          checked={isSelected}
          disabled={!isAvailable}
          onChange={onSelect}
        />
        <span className="decision-text">{translate(lang, decision.id)}</span>
      </label>
      {reqTexts.length > 0 && (
        <div className="decision-requirements">({reqTexts.join(', ')})</div>
      )}
      {conseqTexts.length > 0 && (
        <div className="decision-consequences">{conseqTexts.join(', ')}</div>
      )}
    </div>
  );
}
