import type { GameState } from '../types/game';
import gameData from '../data/game-data.json';

const statusMap: Record<string, string> = gameData.statuses;

// Safe evaluator for the limited C#-derived expression grammar.
// Supports: && || ! == != > >= < <= , stat/char/flag identifiers,
// Character.status comparisons, Event.HasPassed, string/null/number/bool literals.

type Token =
  | { t: 'id'; v: string }
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'null' }
  | { t: 'op'; v: string }
  | { t: 'lparen' }
  | { t: 'rparen' }
  | { t: 'dot' };

function tokenize(src: string): Token[] {
  const toks: Token[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (c === '(') { toks.push({ t: 'lparen' }); i++; continue; }
    if (c === ')') { toks.push({ t: 'rparen' }); i++; continue; }
    if (c === '.') { toks.push({ t: 'dot' }); i++; continue; }
    if (c === '"') {
      let j = i + 1;
      let s = '';
      while (j < n && src[j] !== '"') { s += src[j]; j++; }
      toks.push({ t: 'str', v: s });
      i = j + 1;
      continue;
    }
    if (c === '&' && src[i + 1] === '&') { toks.push({ t: 'op', v: '&&' }); i += 2; continue; }
    if (c === '|' && src[i + 1] === '|') { toks.push({ t: 'op', v: '||' }); i += 2; continue; }
    if (c === '=' && src[i + 1] === '=' && src[i+2] === '=') { toks.push({ t: 'op', v: '===' }); i += 3; continue; }
    if (c === '!' && src[i + 1] === '=' && src[i+2] === '=') { toks.push({ t: 'op', v: '!==' }); i += 3; continue; }
    if (c === '=' && src[i + 1] === '=') { toks.push({ t: 'op', v: '==' }); i += 2; continue; }
    if (c === '!' && src[i + 1] === '=') { toks.push({ t: 'op', v: '!=' }); i += 2; continue; }
    if (c === '>' && src[i + 1] === '=') { toks.push({ t: 'op', v: '>=' }); i += 2; continue; }
    if (c === '<' && src[i + 1] === '=') { toks.push({ t: 'op', v: '<=' }); i += 2; continue; }
    if (c === '>') { toks.push({ t: 'op', v: '>' }); i++; continue; }
    if (c === '<') { toks.push({ t: 'op', v: '<' }); i++; continue; }
    if (c === '!') { toks.push({ t: 'op', v: '!' }); i++; continue; }
    if (/[0-9]/.test(c) || (c === '-' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i + 1;
      while (j < n && /[0-9]/.test(src[j])) j++;
      toks.push({ t: 'num', v: parseInt(src.slice(i, j), 10) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j);
      if (word === 'true') toks.push({ t: 'bool', v: true });
      else if (word === 'false') toks.push({ t: 'bool', v: false });
      else if (word === 'null') toks.push({ t: 'null' });
      else toks.push({ t: 'id', v: word });
      i = j;
      continue;
    }
    // unknown char, skip
    i++;
  }
  return toks;
}

// Grammar (precedence low->high): Or -> And -> Not -> Cmp -> Primary
class Parser {
  toks: Token[];
  pos = 0;
  constructor(toks: Token[]) { this.toks = toks; }
  peek(): Token | undefined { return this.toks[this.pos]; }
  next(): Token | undefined { return this.toks[this.pos++]; }

  parseOr(): any {
    let left = this.parseAnd();
    while (this.peek()?.t === 'op' && (this.peek() as any).v === '||') {
      this.next();
      const right = this.parseAnd();
      left = { op: '||', left, right };
    }
    return left;
  }
  parseAnd(): any {
    let left = this.parseNot();
    while (this.peek()?.t === 'op' && (this.peek() as any).v === '&&') {
      this.next();
      const right = this.parseNot();
      left = { op: '&&', left, right };
    }
    return left;
  }
  parseNot(): any {
    if (this.peek()?.t === 'op' && (this.peek() as any).v === '!') {
      this.next();
      const operand = this.parseNot();
      return { op: '!', operand };
    }
    return this.parseCmp();
  }
  parseCmp(): any {
    const left = this.parsePrimary();
    const p = this.peek();
    if (p?.t === 'op' && ['==', '!=', '>', '>=', '<', '<='].includes((p as any).v)) {
      this.next();
      const right = this.parsePrimary();
      return { op: (p as any).v, left, right };
    }
    return left;
  }
  parsePrimary(): any {
    const tok = this.peek();
    if (!tok) return { op: 'lit', value: null };
    if (tok.t === 'lparen') {
      this.next();
      const inner = this.parseOr();
      if (this.peek()?.t === 'rparen') this.next();
      return inner;
    }
    if (tok.t === 'num') { this.next(); return { op: 'lit', value: tok.v }; }
    if (tok.t === 'str') { this.next(); return { op: 'lit', value: tok.v }; }
    if (tok.t === 'bool') { this.next(); return { op: 'lit', value: tok.v }; }
    if (tok.t === 'null') { this.next(); return { op: 'lit', value: null }; }
    if (tok.t === 'id') {
      // parse dotted path: id (.id)*  optionally (.method())
      const parts: string[] = [tok.v];
      this.next();
      while (this.peek()?.t === 'dot') {
        this.next();
        const idTok = this.next();
        if (idTok?.t === 'id') parts.push(idTok.v);
      }
      return { op: 'path', parts };
    }
    this.next();
    return { op: 'lit', value: null };
  }
}

function resolvePath(parts: string[], state: GameState): any {
  // Recognized shapes:
  // state -> our own compiled paths won't appear here (we evaluate RAW C# now, not compiled JS)
  // Willpower / Deaths / ... -> state.stats[name]
  // CharacterName -> path continues: CharacterName.status / CharacterName.relations (rare) — but comparisons handled at Cmp level
  // FlagName -> state.flags[name]
  // EventVarName.HasPassed -> state.passedEvents[name]
  // Status.XYZ -> symbolic status constant; resolves to the same raw status key
  //   that applyConsequence() stores via statusMap[sid] ?? sid, so comparisons
  //   against character.status agree with how statuses are actually written.
  if (parts.length === 2 && parts[1] === 'HasPassed') {
    return !!state.passedEvents[parts[0]];
  }
  if (parts.length === 2 && parts[0] === 'Status') {
    return statusMap[parts[1]] ?? parts[1];
  }
  if (parts[0] in state.stats) {
    return state.stats[parts[0]];
  }
  if (parts[0] in state.characters) {
    // bare character reference used in equality against status or relations comparisons
    // Cmp will decide; here we return the character object itself
    return state.characters[parts[0]];
  }
  if (parts[0] in state.flags) {
    return state.flags[parts[0]];
  }
  return undefined;
}

function evalNode(node: any, state: GameState): any {
  if (node.op === 'lit') return node.value;
  if (node.op === 'path') return resolvePath(node.parts, state);
  if (node.op === '!') return !evalNode(node.operand, state);
  if (node.op === '&&') return !!evalNode(node.left, state) && !!evalNode(node.right, state);
  if (node.op === '||') return !!evalNode(node.left, state) || !!evalNode(node.right, state);

  if (['==', '!=', '>', '>=', '<', '<='].includes(node.op)) {
    let l = evalNode(node.left, state);
    let r = evalNode(node.right, state);

    // Character object comparisons: Character == Status ("string"/null) OR Character == number (relations)
    const lIsChar = l && typeof l === 'object' && 'relations' in l;
    const rIsChar = r && typeof r === 'object' && 'relations' in r;
    if (lIsChar && !rIsChar) {
      l = typeof r === 'number' ? l.relations : l.status;
    } else if (rIsChar && !lIsChar) {
      r = typeof l === 'number' ? r.relations : r.status;
    } else if (lIsChar && rIsChar) {
      l = l.status; r = r.status;
    }

    switch (node.op) {
      case '==': return l === r;
      case '!=': return l !== r;
      case '>': return l > r;
      case '>=': return l >= r;
      case '<': return l < r;
      case '<=': return l <= r;
    }
  }
  return false;
}

const cache = new Map<string, any>();

export function evaluateCondition(expr: string, state: GameState): boolean {
  if (!expr || expr.trim() === '') return true;
  let ast = cache.get(expr);
  if (!ast) {
    const toks = tokenize(expr);
    ast = new Parser(toks).parseOr();
    cache.set(expr, ast);
  }
  try {
    return !!evalNode(ast, state);
  } catch {
    return false;
  }
}
