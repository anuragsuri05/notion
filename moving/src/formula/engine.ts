/**
 * Moving — formula engine.
 *
 * A self-contained implementation of Notion's "Formulas 2.0" language:
 *   source --tokenize--> tokens --Pratt parser--> AST --evaluator--> FormulaValue
 *
 * No external dependencies. Evaluation never throws: errors are reported via
 * FormulaResult.error.
 */

// ============================================================================
// Public types
// ============================================================================

export type PageRef = { type: 'page'; id: string; title: string };
export type PersonRef = { type: 'person'; id: string; name: string; email: string };
export type DateRangeValue = { type: 'daterange'; start: Date; end: Date };
export type FormulaValue =
  | string
  | number
  | boolean
  | Date
  | null
  | PageRef
  | PersonRef
  | DateRangeValue
  | FormulaValue[];

export interface FormulaContext {
  /** value of a property of the current row by property NAME (case-sensitive). Return undefined if property doesn't exist. */
  getProp(name: string): FormulaValue | undefined;
  /** value of a property on another page (used for relation items: prop("Tasks").map(current.prop("Status"))) */
  getPageProp(pageId: string, name: string): FormulaValue | undefined;
  now?: () => Date;
  /** Optional id of the current page, returned by id(). */
  pageId?: string;
}

export type FormulaResultType = 'text' | 'number' | 'boolean' | 'date' | 'list' | 'page' | 'person' | 'empty';

export interface FormulaResult {
  value: FormulaValue;
  error?: string;
  type: FormulaResultType;
}

// ============================================================================
// Limits & errors
// ============================================================================

const MAX_LIST = 10_000;
const MAX_TEXT = 1_000_000;
const MAX_DEPTH = 200;
const MAX_STEPS = 2_000_000;

class FormulaError extends Error {}

/** Work budget shared by the evaluator and list/text builders; reset per evaluation. */
let work = 0;
function charge(units: number): void {
  work += units;
  if (work > MAX_STEPS) fail('Formula is too complex to evaluate');
}

function fail(message: string): never {
  throw new FormulaError(message);
}

// ============================================================================
// Value helpers
// ============================================================================

type RefValue = PageRef | PersonRef | DateRangeValue;

function isRef(v: FormulaValue): v is RefValue {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);
}
const isPage = (v: FormulaValue): v is PageRef => isRef(v) && v.type === 'page';
const isPerson = (v: FormulaValue): v is PersonRef => isRef(v) && v.type === 'person';
const isRange = (v: FormulaValue): v is DateRangeValue => isRef(v) && v.type === 'daterange';

function typeName(v: FormulaValue): FormulaResultType {
  if (v === null || v === undefined) return 'empty';
  if (typeof v === 'string') return 'text';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  if (v instanceof Date) return 'date';
  if (Array.isArray(v)) return 'list';
  return v.type === 'daterange' ? 'date' : v.type;
}

function isEmpty(v: FormulaValue): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.length === 0;
  if (typeof v === 'number') return v === 0 || Number.isNaN(v);
  if (typeof v === 'boolean') return !v;
  if (Array.isArray(v)) return v.length === 0;
  if (v instanceof Date) return Number.isNaN(v.getTime());
  return false;
}

const truthy = (v: FormulaValue): boolean => !isEmpty(v);

function equals(a: FormulaValue, b: FormulaValue): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => equals(x, b[i]));
  if (isRange(a) && isRange(b)) return equals(a.start, b.start) && equals(a.end, b.end);
  if ((isPage(a) && isPage(b)) || (isPerson(a) && isPerson(b))) return a.id === b.id;
  return false;
}

function capList<T>(list: T[]): T[] {
  if (list.length > MAX_LIST) fail(`List is too large (maximum ${MAX_LIST} items)`);
  charge(list.length);
  return list;
}

function capText(s: string): string {
  if (s.length > MAX_TEXT) fail(`Text is too long (maximum ${MAX_TEXT} characters)`);
  charge(s.length >> 6);
  return s;
}

function text(v: FormulaValue): string {
  return formatFormulaValue(v);
}

function toNum(v: FormulaValue, fn: string): number {
  if (v === null) return 0;
  if (typeof v === 'number') return v;
  return fail(`${fn}() expects a number but got ${typeName(v)}`);
}

function toList(v: FormulaValue, fn: string): FormulaValue[] {
  if (v === null) return [];
  if (Array.isArray(v)) return v;
  return fail(`${fn}() expects a list but got ${typeName(v)}`);
}

function toDate(v: FormulaValue, fn: string): Date | null {
  if (v === null) return null;
  if (v instanceof Date) return v;
  if (isRange(v)) return v.start;
  if (typeof v === 'string') return parseDateString(v);
  return fail(`${fn}() expects a date but got ${typeName(v)}`);
}

function cleanNumber(n: number): number | null {
  return Number.isNaN(n) ? null : n;
}

function flattenDeep(values: FormulaValue[]): FormulaValue[] {
  const out: FormulaValue[] = [];
  const walk = (v: FormulaValue) => {
    if (Array.isArray(v)) v.forEach(walk);
    else out.push(v);
  };
  values.forEach(walk);
  return capList(out);
}

function numbersOf(args: FormulaValue[], fn: string): number[] {
  return flattenDeep(args)
    .filter((v) => v !== null)
    .map((v) => toNum(v, fn));
}

/** Ordering used by comparison operators. */
function compare(a: FormulaValue, b: FormulaValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  const da = a instanceof Date ? a : isRange(a) ? a.start : null;
  const db = b instanceof Date ? b : isRange(b) ? b.start : null;
  if (da && db) return da.getTime() - db.getTime();
  return fail(`Cannot compare ${typeName(a)} with ${typeName(b)}`);
}

const SORT_ORDER: FormulaResultType[] = ['number', 'date', 'text', 'boolean', 'page', 'person', 'list', 'empty'];
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Natural ordering used by sort(): never throws, empties last. */
function naturalCompare(a: FormulaValue, b: FormulaValue): number {
  const ta = typeName(a);
  const tb = typeName(b);
  if (ta !== tb) return SORT_ORDER.indexOf(ta) - SORT_ORDER.indexOf(tb);
  if (ta === 'text' || ta === 'page' || ta === 'person' || ta === 'list') return collator.compare(text(a), text(b));
  if (ta === 'empty') return 0;
  return compare(a, b);
}

// ============================================================================
// Formatting
// ============================================================================

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pad2 = (n: number) => String(n).padStart(2, '0');

function formatNumber(n: number): string {
  if (Number.isInteger(n) || !Number.isFinite(n)) return String(n);
  return String(Number(n.toPrecision(12)));
}

function formatTime(d: Date): string {
  const h = d.getHours();
  return `${h % 12 || 12}:${pad2(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}

function formatDisplayDate(d: Date): string {
  if (Number.isNaN(d.getTime())) return '';
  const day = `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  const midnight = d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;
  return midnight ? day : `${day} ${formatTime(d)}`;
}

export function formatFormulaValue(v: FormulaValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return formatNumber(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Date) return formatDisplayDate(v);
  if (Array.isArray(v)) return v.map(formatFormulaValue).join(', ');
  if (v.type === 'page') return v.title;
  if (v.type === 'person') return v.name;
  if (v.type === 'daterange') return `${formatDisplayDate(v.start)} → ${formatDisplayDate(v.end)}`;
  return '';
}

function ordinal(n: number): string {
  const r = n % 100;
  if (r >= 11 && r <= 13) return `${n}th`;
  return n + (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
}

const DATE_TOKENS = /\[([^\]]*)\]|YYYY|YY|MMMM|MMM|MM|M|Do|DD|D|dddd|ddd|HH|H|hh|h|mm|m|ss|A|a/g;

function formatDatePattern(d: Date, pattern: string): string {
  const h = d.getHours();
  return pattern.replace(DATE_TOKENS, (tok: string, literal?: string) => {
    if (literal !== undefined) return literal;
    switch (tok) {
      case 'YYYY': return String(d.getFullYear());
      case 'YY': return pad2(d.getFullYear() % 100);
      case 'MMMM': return MONTHS[d.getMonth()];
      case 'MMM': return MONTHS[d.getMonth()].slice(0, 3);
      case 'MM': return pad2(d.getMonth() + 1);
      case 'M': return String(d.getMonth() + 1);
      case 'Do': return ordinal(d.getDate());
      case 'DD': return pad2(d.getDate());
      case 'D': return String(d.getDate());
      case 'dddd': return WEEKDAYS[d.getDay()];
      case 'ddd': return WEEKDAYS[d.getDay()].slice(0, 3);
      case 'HH': return pad2(h);
      case 'H': return String(h);
      case 'hh': return pad2(h % 12 || 12);
      case 'h': return String(h % 12 || 12);
      case 'mm': return pad2(d.getMinutes());
      case 'm': return String(d.getMinutes());
      case 'ss': return pad2(d.getSeconds());
      case 'A': return h < 12 ? 'AM' : 'PM';
      case 'a': return h < 12 ? 'am' : 'pm';
      default: return tok;
    }
  });
}

// ============================================================================
// Date arithmetic
// ============================================================================

type DateUnit = 'year' | 'quarter' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond';
const DATE_UNITS: DateUnit[] = ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond'];
const DAY_MS = 86_400_000;

function normUnit(v: FormulaValue): DateUnit {
  const raw = text(v).trim().toLowerCase();
  const u = raw.endsWith('s') ? raw.slice(0, -1) : raw;
  if ((DATE_UNITS as string[]).includes(u)) return u as DateUnit;
  return fail(`Unknown date unit "${raw}". Use years, quarters, months, weeks, days, hours, minutes or seconds`);
}

function parseDateString(s: string): Date {
  const m = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?\s*$/.exec(s);
  const d = m
    ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0), +(m[7] ?? '0').slice(0, 3).padEnd(3, '0'))
    : new Date(s);
  if (Number.isNaN(d.getTime())) fail(`Cannot parse "${s}" as a date`);
  return d;
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  const day = r.getDate();
  r.setDate(1);
  r.setMonth(r.getMonth() + Math.trunc(n));
  const daysInMonth = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(day, daysInMonth));
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  r.setDate(r.getDate() + Math.trunc(n));
  return r;
}

function dateAdd(d: Date, n: number, unit: DateUnit): Date {
  switch (unit) {
    case 'year': return addMonths(d, n * 12);
    case 'quarter': return addMonths(d, n * 3);
    case 'month': return addMonths(d, n);
    case 'week': return addDays(d, n * 7);
    case 'day': return addDays(d, n);
    case 'hour': return new Date(d.getTime() + n * 3_600_000);
    case 'minute': return new Date(d.getTime() + n * 60_000);
    case 'second': return new Date(d.getTime() + n * 1000);
    case 'millisecond': return new Date(d.getTime() + n);
  }
}

function monthDiff(a: Date, b: Date): number {
  if (a.getTime() < b.getTime()) return -monthDiff(b, a);
  let m = (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());
  if (addMonths(b, m).getTime() > a.getTime()) m--;
  return m;
}

/** Wall-clock difference (ignores DST shifts) in ms. */
const wallMs = (d: Date) => d.getTime() - d.getTimezoneOffset() * 60_000;

function dateBetween(a: Date, b: Date, unit: DateUnit): number {
  const diff = a.getTime() - b.getTime();
  const wall = wallMs(a) - wallMs(b);
  const t = (n: number) => Math.trunc(n) || 0;
  switch (unit) {
    case 'year': return t(monthDiff(a, b) / 12);
    case 'quarter': return t(monthDiff(a, b) / 3);
    case 'month': return monthDiff(a, b);
    case 'week': return t(wall / (7 * DAY_MS));
    case 'day': return t(wall / DAY_MS);
    case 'hour': return t(diff / 3_600_000);
    case 'minute': return t(diff / 60_000);
    case 'second': return t(diff / 1000);
    case 'millisecond': return diff;
  }
}

function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - yearStart) / DAY_MS + 1) / 7);
}

// ============================================================================
// Tokenizer
// ============================================================================

type TokenType = 'num' | 'str' | 'ident' | 'op' | 'eof';
interface Token { t: TokenType; v: string; pos: number }

const OPERATORS = ['==', '!=', '>=', '<=', '&&', '||', '>', '<', '+', '-', '*', '/', '%', '^', '!', '?', ':', '(', ')', ',', '.', '[', ']'];
const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', '"': '"', "'": "'", '\\': '\\', '/': '/' };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end < 0) fail(`Unterminated comment at position ${i + 1}`);
      i = end + 2;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    const num = /^(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i, i + 64));
    if (num) {
      out.push({ t: 'num', v: num[0], pos: i });
      i += num[0].length;
      continue;
    }
    if (c === '"' || c === '“' || c === '”') {
      const start = i++;
      let s = '';
      for (;;) {
        if (i >= src.length) fail(`Unterminated text starting at position ${start + 1}`);
        const ch = src[i++];
        if (ch === '"' || ch === '”' || ch === '“') break;
        if (ch !== '\\') { s += ch; continue; }
        const esc = src[i++] ?? '';
        if (esc === 'u' && /^[0-9a-fA-F]{4}$/.test(src.slice(i, i + 4))) {
          s += String.fromCharCode(parseInt(src.slice(i, i + 4), 16));
          i += 4;
        } else s += ESCAPES[esc] ?? esc;
      }
      out.push({ t: 'str', v: s, pos: start });
      continue;
    }
    const ident = /^[\p{L}_$][\p{L}\p{N}_$]*/u.exec(src.slice(i, i + 256));
    if (ident) {
      out.push({ t: 'ident', v: ident[0], pos: i });
      i += ident[0].length;
      continue;
    }
    const op = OPERATORS.find((o) => src.startsWith(o, i));
    if (!op) fail(`Unexpected character "${c}" at position ${i + 1}`);
    out.push({ t: 'op', v: op, pos: i });
    i += op.length;
  }
  out.push({ t: 'eof', v: '', pos: src.length });
  return out;
}

// ============================================================================
// AST & Pratt parser
// ============================================================================

type Node =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'ident'; name: string; pos: number }
  | { k: 'list'; items: Node[] }
  | { k: 'call'; name: string; args: Node[]; pos: number }
  | { k: 'unary'; op: '-' | '+' | '!'; arg: Node }
  | { k: 'binary'; op: string; left: Node; right: Node }
  | { k: 'cond'; test: Node; then: Node; else: Node };

/** [left binding power, right binding power]; right-assoc ops have r < l. */
const INFIX_BP: Record<string, [number, number]> = {
  '?': [2, 1],
  or: [3, 4],
  and: [5, 6],
  '==': [9, 10], '!=': [9, 10], '>': [9, 10], '<': [9, 10], '>=': [9, 10], '<=': [9, 10],
  '+': [11, 12], '-': [11, 12],
  '*': [13, 14], '/': [13, 14], '%': [13, 14],
  '^': [18, 17],
  '.': [20, 21],
};
const NOT_BP = 7;
const NEG_BP = 15;

function describe(t: Token): string {
  if (t.t === 'eof') return 'end of formula';
  if (t.t === 'str') return `text "${t.v}"`;
  return `"${t.v}"`;
}

class Parser {
  private i = 0;
  private depth = 0;
  constructor(private readonly toks: Token[]) {}

  private peek(): Token { return this.toks[this.i]; }
  private next(): Token { return this.toks[this.i++]; }
  private isOp(v: string): boolean { const t = this.peek(); return t.t === 'op' && t.v === v; }

  private expect(v: string): void {
    const t = this.next();
    if (t.t !== 'op' || t.v !== v) fail(`Expected "${v}" but found ${describe(t)} at position ${t.pos + 1}`);
  }

  parseProgram(): Node {
    if (this.peek().t === 'eof') fail('Formula is empty');
    const node = this.expr(0);
    const t = this.peek();
    if (t.t !== 'eof') fail(`Unexpected ${describe(t)} at position ${t.pos + 1}`);
    return node;
  }

  private infixOp(t: Token): string | null {
    if (t.t === 'ident' && (t.v === 'and' || t.v === 'or')) return t.v;
    if (t.t !== 'op') return null;
    if (t.v === '&&') return 'and';
    if (t.v === '||') return 'or';
    return t.v in INFIX_BP ? t.v : null;
  }

  private expr(minBp: number): Node {
    if (++this.depth > MAX_DEPTH) fail('Formula is nested too deeply');
    let left = this.prefix();
    for (;;) {
      const op = this.infixOp(this.peek());
      if (!op) break;
      const [lbp, rbp] = INFIX_BP[op];
      if (lbp < minBp) break;
      this.next();
      if (op === '.') {
        const id = this.next();
        if (id.t !== 'ident') fail(`Expected a function name after "." at position ${id.pos + 1}`);
        const args = this.isOp('(') ? this.args() : [];
        left = { k: 'call', name: id.v, args: [left, ...args], pos: id.pos };
      } else if (op === '?') {
        const then = this.expr(0);
        this.expect(':');
        left = { k: 'cond', test: left, then, else: this.expr(rbp) };
      } else {
        left = { k: 'binary', op, left, right: this.expr(rbp) };
      }
    }
    this.depth--;
    return left;
  }

  private prefix(): Node {
    const t = this.next();
    switch (t.t) {
      case 'num': return { k: 'num', v: Number(t.v) };
      case 'str': return { k: 'str', v: t.v };
      case 'ident':
        if (t.v === 'true' || t.v === 'false') return { k: 'bool', v: t.v === 'true' };
        if (t.v === 'not') return { k: 'unary', op: '!', arg: this.expr(NOT_BP) };
        if (this.isOp('(')) return { k: 'call', name: t.v, args: this.args(), pos: t.pos };
        return { k: 'ident', name: t.v, pos: t.pos };
      case 'op':
        if (t.v === '-' || t.v === '+') return { k: 'unary', op: t.v, arg: this.expr(NEG_BP) };
        if (t.v === '!') return { k: 'unary', op: '!', arg: this.expr(NOT_BP) };
        if (t.v === '(') {
          const inner = this.expr(0);
          this.expect(')');
          return inner;
        }
        if (t.v === '[') return { k: 'list', items: this.list(']') };
        break;
    }
    return fail(`Unexpected ${describe(t)} at position ${t.pos + 1}`);
  }

  private args(): Node[] {
    this.expect('(');
    return this.list(')');
  }

  private list(close: string): Node[] {
    const items: Node[] = [];
    if (this.isOp(close)) { this.next(); return items; }
    for (;;) {
      items.push(this.expr(0));
      if (this.isOp(',')) { this.next(); continue; }
      this.expect(close);
      return items;
    }
  }
}

// ============================================================================
// Evaluator
// ============================================================================

class Scope {
  constructor(private readonly vars: Map<string, FormulaValue>, private readonly parent?: Scope) {}
  lookup(name: string): FormulaValue | undefined {
    return this.vars.has(name) ? this.vars.get(name) : this.parent?.lookup(name);
  }
}

class Evaluator {
  constructor(readonly ctx: FormulaContext) {}

  eval(n: Node, s: Scope | undefined): FormulaValue {
    charge(1);
    switch (n.k) {
      case 'num': return n.v;
      case 'str': return n.v;
      case 'bool': return n.v;
      case 'list': return n.items.map((x) => this.eval(x, s));
      case 'ident': return this.ident(n.name, s);
      case 'cond': return truthy(this.eval(n.test, s)) ? this.eval(n.then, s) : this.eval(n.else, s);
      case 'unary': {
        const v = this.eval(n.arg, s);
        if (n.op === '!') return !truthy(v);
        if (v === null) return null;
        if (typeof v !== 'number') fail(`Cannot apply "${n.op}" to ${typeName(v)}`);
        return n.op === '-' ? -v : v;
      }
      case 'binary': {
        if (n.op === 'and') return truthy(this.eval(n.left, s)) && truthy(this.eval(n.right, s));
        if (n.op === 'or') return truthy(this.eval(n.left, s)) || truthy(this.eval(n.right, s));
        return binaryOp(n.op, this.eval(n.left, s), this.eval(n.right, s));
      }
      case 'call': {
        const fn = lookupFn(n.name);
        if (!fn) fail(`Unknown function "${n.name}"`);
        checkArity(n.name, fn, n.args.length);
        if (fn.lazy) return fn.lazy(n.args, s, this);
        return fn.call!(n.args.map((a) => this.eval(a, s)), this);
      }
    }
  }

  private ident(name: string, s: Scope | undefined): FormulaValue {
    const v = s?.lookup(name);
    if (v !== undefined) return v;
    if (name === 'pi') return Math.PI;
    if (name === 'e') return Math.E;
    if (name === 'current' || name === 'index') {
      fail(`"${name}" can only be used inside list functions like map() or filter()`);
    }
    if (lookupFn(name)) fail(`"${name}" is a function; call it like ${name}(...)`);
    return fail(`Unknown variable "${name}"`);
  }

  /** Evaluate a callback expression with `current` and `index` bound. */
  each(node: Node, s: Scope | undefined, item: FormulaValue, index: number): FormulaValue {
    return this.eval(node, new Scope(new Map<string, FormulaValue>([['current', item], ['index', index]]), s));
  }

  now(): Date {
    return new Date((this.ctx.now?.() ?? new Date()).getTime());
  }
}

function arith(op: string, a: FormulaValue, b: FormulaValue): FormulaValue {
  if (a === null && b === null) return null;
  if ((a !== null && typeof a !== 'number') || (b !== null && typeof b !== 'number')) {
    fail(`Operator "${op}" expects numbers but got ${typeName(a)} and ${typeName(b)}`);
  }
  const x = a ?? 0;
  const y = b ?? 0;
  switch (op) {
    case '+': return x + y;
    case '-': return x - y;
    case '*': return x * y;
    case '/': return cleanNumber(x / y);
    case '%': return cleanNumber(x % y);
    case '^': return cleanNumber(x ** y);
  }
  return fail(`Unknown operator "${op}"`);
}

function binaryOp(op: string, a: FormulaValue, b: FormulaValue): FormulaValue {
  switch (op) {
    case '+':
      if (typeof a === 'string' || typeof b === 'string') return capText(text(a) + text(b));
      if (Array.isArray(a) && Array.isArray(b)) return capList([...a, ...b]);
      return arith(op, a, b);
    case '==': return equals(a, b);
    case '!=': return !equals(a, b);
    case '>': case '<': case '>=': case '<=': {
      if (a === null || b === null) return false;
      const c = compare(a, b);
      return op === '>' ? c > 0 : op === '<' ? c < 0 : op === '>=' ? c >= 0 : c <= 0;
    }
    default: return arith(op, a, b);
  }
}

// ============================================================================
// Function registry
// ============================================================================

type EagerFn = (args: FormulaValue[], ev: Evaluator) => FormulaValue;
type LazyFn = (args: Node[], s: Scope | undefined, ev: Evaluator) => FormulaValue;
interface FnDef { min: number; max: number; call?: EagerFn; lazy?: LazyFn }

const FUNCS = new Map<string, FnDef>();
const FUNCS_LOWER = new Map<string, FnDef>();

function def(name: string, min: number, max: number, call: EagerFn): void {
  FUNCS.set(name, { min, max, call });
}
function defLazy(name: string, min: number, max: number, lazy: LazyFn): void {
  FUNCS.set(name, { min, max, lazy });
}
function lookupFn(name: string): FnDef | undefined {
  return FUNCS.get(name) ?? FUNCS_LOWER.get(name.toLowerCase());
}

function checkArity(name: string, fn: FnDef, n: number): void {
  if (n >= fn.min && n <= fn.max && !(name === 'lets' && n % 2 === 0)) return;
  const range =
    fn.max === Infinity ? `at least ${fn.min}` : fn.min === fn.max ? `${fn.min}` : `${fn.min} to ${fn.max}`;
  if (name === 'lets') fail(`lets() expects name/value pairs followed by an expression`);
  fail(`${name}() expects ${range} argument${fn.max === 1 && fn.min === 1 ? '' : 's'} but got ${n}`);
}

function regex(pattern: FormulaValue, flags = ''): RegExp {
  const p = text(pattern);
  try {
    return new RegExp(p, flags);
  } catch {
    return new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
  }
}

const math1 = (name: string, f: (x: number) => number): void =>
  def(name, 1, 1, ([x]) => (x === null ? null : cleanNumber(f(toNum(x, name)))));

const dateGetter = (name: string, f: (d: Date) => number): void =>
  def(name, 1, 1, ([v]) => {
    const d = toDate(v, name);
    return d ? f(d) : null;
  });

const listOrText = (v: FormulaValue): FormulaValue[] | string => (Array.isArray(v) ? v : text(v));

// ---------------------------------------------------------------- Logic
defLazy('if', 3, 3, ([c, a, b], s, ev) => (truthy(ev.eval(c, s)) ? ev.eval(a, s) : ev.eval(b, s)));
defLazy('ifs', 2, Infinity, (args, s, ev) => {
  for (let i = 0; i + 1 < args.length; i += 2) if (truthy(ev.eval(args[i], s))) return ev.eval(args[i + 1], s);
  return args.length % 2 === 1 ? ev.eval(args[args.length - 1], s) : null;
});
defLazy('and', 1, Infinity, (args, s, ev) => args.every((a) => truthy(ev.eval(a, s))));
defLazy('or', 1, Infinity, (args, s, ev) => args.some((a) => truthy(ev.eval(a, s))));
def('not', 1, 1, ([v]) => !truthy(v));
def('empty', 1, 1, ([v]) => isEmpty(v));
def('equal', 2, 2, ([a, b]) => equals(a, b));
def('unequal', 2, 2, ([a, b]) => !equals(a, b));

// ---------------------------------------------------------------- Variables
defLazy('let', 3, 3, ([name, value, body], s, ev) => {
  if (name.k !== 'ident') fail('let() expects a variable name as its first argument');
  return ev.eval(body, new Scope(new Map([[name.name, ev.eval(value, s)]]), s));
});
defLazy('lets', 3, Infinity, (args, s, ev) => {
  let scope = s;
  for (let i = 0; i + 1 < args.length; i += 2) {
    const name = args[i];
    if (name.k !== 'ident') fail(`lets() expects a variable name as argument ${i + 1}`);
    scope = new Scope(new Map([[name.name, ev.eval(args[i + 1], scope)]]), scope);
  }
  return ev.eval(args[args.length - 1], scope);
});

// ---------------------------------------------------------------- Properties
def('prop', 1, 2, (args, ev) => {
  if (args.length === 1) {
    const name = text(args[0]);
    const v = ev.ctx.getProp(name);
    if (v === undefined) fail(`Property "${name}" not found`);
    return v;
  }
  const name = text(args[1]);
  const read = (target: FormulaValue): FormulaValue => {
    if (target === null) return null;
    if (Array.isArray(target)) return target.map(read);
    if (!isPage(target)) fail(`prop() can only read properties of a page, not ${typeName(target)}`);
    const v = ev.ctx.getPageProp(target.id, name);
    if (v === undefined) fail(`Property "${name}" not found`);
    return v;
  };
  return read(args[0]);
});

// ---------------------------------------------------------------- Text
def('length', 1, 1, ([v]) => (v === null ? 0 : listOrText(v).length));
def('substring', 2, 3, ([v, a, b]) => {
  const s = text(v);
  return s.substring(toNum(a, 'substring'), b === undefined || b === null ? s.length : toNum(b, 'substring'));
});
def('contains', 2, 2, ([v, search]) =>
  Array.isArray(v) ? v.some((x) => equals(x, search) || text(x) === text(search)) : text(v).includes(text(search)));
def('test', 2, 2, ([v, p]) => regex(p).test(text(v)));
def('match', 2, 2, ([v, p]) => capList(text(v).match(regex(p, 'g')) ?? []));
def('replace', 3, 3, ([v, p, r]) => capText(text(v).replace(regex(p), text(r))));
def('replaceAll', 3, 3, ([v, p, r]) => capText(text(v).replace(regex(p, 'g'), text(r))));
def('lower', 1, 1, ([v]) => text(v).toLowerCase());
def('upper', 1, 1, ([v]) => text(v).toUpperCase());
def('trim', 1, 1, ([v]) => text(v).trim());
def('repeat', 2, 2, ([v, n]) => {
  const s = text(v);
  const count = Math.max(0, Math.floor(toNum(n, 'repeat')));
  if (s.length * count > MAX_TEXT) fail('repeat() would produce text that is too long');
  return capText(s.repeat(count));
});
def('padStart', 2, 3, ([v, n, p]) => capText(text(v).padStart(toNum(n, 'padStart'), p == null ? ' ' : text(p))));
def('padEnd', 2, 3, ([v, n, p]) => capText(text(v).padEnd(toNum(n, 'padEnd'), p == null ? ' ' : text(p))));
def('split', 1, 2, ([v, sep]) => {
  const s = text(v);
  const parts = s.split(sep == null ? '' : text(sep), MAX_LIST + 1);
  return capList(parts);
});
def('startsWith', 2, 2, ([v, p]) => text(v).startsWith(text(p)));
def('endsWith', 2, 2, ([v, p]) => text(v).endsWith(text(p)));
def('join', 1, Infinity, (args) => {
  const [first, ...rest] = args;
  if (Array.isArray(first)) return capText(first.map(text).join(rest[0] == null ? '' : text(rest[0])));
  return capText(rest.map(text).join(text(first))); // legacy join(separator, ...values)
});
def('concat', 1, Infinity, (args) => {
  if (Array.isArray(args[0])) return capList(args.flatMap((a) => (Array.isArray(a) ? a : [a])));
  return capText(args.map(text).join(''));
});
def('format', 1, 1, ([v]) => text(v));
def('link', 1, 2, ([label]) => text(label));
def('style', 1, Infinity, ([v]) => text(v));
def('unstyle', 1, 2, ([v]) => text(v));
def('toNumber', 1, 1, ([v]) => {
  if (v === null || typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.getTime();
  if (isRange(v)) return v.start.getTime();
  const n = parseFloat(text(v).replace(/,/g, '').trim());
  return Number.isNaN(n) ? null : n;
});

// ---------------------------------------------------------------- Math
def('add', 2, 2, ([a, b]) => binaryOp('+', a, b));
def('subtract', 2, 2, ([a, b]) => arith('-', a, b));
def('multiply', 2, 2, ([a, b]) => arith('*', a, b));
def('divide', 2, 2, ([a, b]) => arith('/', a, b));
def('pow', 2, 2, ([a, b]) => arith('^', a, b));
def('mod', 2, 2, ([a, b]) => arith('%', a, b));
math1('abs', Math.abs);
math1('ceil', Math.ceil);
math1('floor', Math.floor);
math1('sqrt', Math.sqrt);
math1('cbrt', Math.cbrt);
math1('exp', Math.exp);
math1('ln', Math.log);
math1('log10', Math.log10);
math1('log2', Math.log2);
math1('sign', Math.sign);
def('round', 1, 2, ([v, places]) => {
  if (v === null) return null;
  const n = toNum(v, 'round');
  const p = places == null ? 0 : Math.trunc(toNum(places, 'round'));
  return cleanNumber(Number(`${Math.round(Number(`${n}e${p}`))}e${-p}`));
});
def('min', 1, Infinity, (args) => { const ns = numbersOf(args, 'min'); return ns.length ? Math.min(...ns) : null; });
def('max', 1, Infinity, (args) => { const ns = numbersOf(args, 'max'); return ns.length ? Math.max(...ns) : null; });
def('sum', 1, Infinity, (args) => numbersOf(args, 'sum').reduce((a, b) => a + b, 0));
def('mean', 1, Infinity, (args) => {
  const ns = numbersOf(args, 'mean');
  return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
});
def('median', 1, Infinity, (args) => {
  const ns = numbersOf(args, 'median').sort((a, b) => a - b);
  if (!ns.length) return null;
  const mid = ns.length >> 1;
  return ns.length % 2 ? ns[mid] : (ns[mid - 1] + ns[mid]) / 2;
});

// ---------------------------------------------------------------- Date
def('now', 0, 0, (_a, ev) => ev.now());
def('today', 0, 0, (_a, ev) => { const d = ev.now(); d.setHours(0, 0, 0, 0); return d; });
dateGetter('minute', (d) => d.getMinutes());
dateGetter('hour', (d) => d.getHours());
dateGetter('day', (d) => d.getDay());
dateGetter('date', (d) => d.getDate());
dateGetter('week', isoWeek);
dateGetter('month', (d) => d.getMonth() + 1);
dateGetter('year', (d) => d.getFullYear());
dateGetter('timestamp', (d) => d.getTime());
const shift = (sign: number): EagerFn => ([v, n, unit]) => {
  if (v === null) return null;
  const u = normUnit(unit);
  const amount = sign * toNum(n, sign > 0 ? 'dateAdd' : 'dateSubtract');
  if (isRange(v)) return { type: 'daterange', start: dateAdd(v.start, amount, u), end: dateAdd(v.end, amount, u) };
  return dateAdd(toDate(v, 'dateAdd')!, amount, u);
};
def('dateAdd', 3, 3, shift(1));
def('dateSubtract', 3, 3, shift(-1));
def('dateBetween', 3, 3, ([a, b, unit]) => {
  const da = toDate(a, 'dateBetween');
  const db = toDate(b, 'dateBetween');
  return da && db ? dateBetween(da, db, normUnit(unit)) : null;
});
def('dateRange', 2, 2, ([a, b]) => {
  const start = toDate(a, 'dateRange');
  const end = toDate(b, 'dateRange');
  if (!start || !end) return null;
  return { type: 'daterange', start, end };
});
def('dateStart', 1, 1, ([v]) => (isRange(v) ? v.start : toDate(v, 'dateStart')));
def('dateEnd', 1, 1, ([v]) => (isRange(v) ? v.end : toDate(v, 'dateEnd')));
def('fromTimestamp', 1, 1, ([v]) => {
  if (v === null) return null;
  const d = new Date(toNum(v, 'fromTimestamp'));
  return Number.isNaN(d.getTime()) ? null : d;
});
def('formatDate', 1, 2, ([v, p]) => {
  const d = toDate(v, 'formatDate');
  if (!d) return '';
  if (isRange(v) && p == null) return text(v);
  return p == null ? formatDisplayDate(d) : formatDatePattern(d, text(p));
});
def('parseDate', 1, 1, ([v]) => (v === null || text(v).trim() === '' ? null : toDate(text(v), 'parseDate')));

// ---------------------------------------------------------------- List
def('at', 2, 2, ([v, i]) => {
  const l = listOrText(v);
  let idx = Math.trunc(toNum(i, 'at'));
  if (idx < 0) idx += l.length;
  return idx >= 0 && idx < l.length ? l[idx] : null;
});
def('first', 1, 1, ([v]) => { const l = listOrText(v); return l.length ? l[0] : null; });
def('last', 1, 1, ([v]) => { const l = listOrText(v); return l.length ? l[l.length - 1] : null; });
def('slice', 2, 3, ([v, a, b]) => {
  const l = listOrText(v);
  return l.slice(toNum(a, 'slice'), b == null ? undefined : toNum(b, 'slice'));
});
def('reverse', 1, 1, ([v]) => (Array.isArray(v) ? [...v].reverse() : [...text(v)].reverse().join('')));
def('includes', 2, 2, ([v, x]) => (Array.isArray(v) ? v.some((y) => equals(y, x)) : text(v).includes(text(x))));
def('flat', 1, 1, ([v]) => flattenDeep(toList(v, 'flat')));
def('unique', 1, 1, ([v]) => {
  const out: FormulaValue[] = [];
  for (const x of toList(v, 'unique')) if (!out.some((y) => equals(x, y))) out.push(x);
  return out;
});
const listArg = (node: Node, s: Scope | undefined, ev: Evaluator, fn: string): FormulaValue[] =>
  toList(ev.eval(node, s), fn);
defLazy('map', 2, 2, ([l, f], s, ev) => capList(listArg(l, s, ev, 'map').map((x, i) => ev.each(f, s, x, i))));
defLazy('filter', 2, 2, ([l, f], s, ev) => listArg(l, s, ev, 'filter').filter((x, i) => truthy(ev.each(f, s, x, i))));
defLazy('find', 2, 2, ([l, f], s, ev) => listArg(l, s, ev, 'find').find((x, i) => truthy(ev.each(f, s, x, i))) ?? null);
defLazy('findIndex', 2, 2, ([l, f], s, ev) => listArg(l, s, ev, 'findIndex').findIndex((x, i) => truthy(ev.each(f, s, x, i))));
defLazy('some', 2, 2, ([l, f], s, ev) => listArg(l, s, ev, 'some').some((x, i) => truthy(ev.each(f, s, x, i))));
defLazy('every', 2, 2, ([l, f], s, ev) => listArg(l, s, ev, 'every').every((x, i) => truthy(ev.each(f, s, x, i))));
defLazy('count', 1, 2, ([l, f], s, ev) => {
  const v = ev.eval(l, s);
  const list = Array.isArray(v) ? v : v === null ? [] : [v];
  return f ? list.filter((x, i) => truthy(ev.each(f, s, x, i))).length : list.length;
});
defLazy('sort', 1, 2, ([l, f], s, ev) => {
  const list = listArg(l, s, ev, 'sort');
  const keyed = list.map((x, i) => ({ x, key: f ? ev.each(f, s, x, i) : x }));
  return keyed.sort((a, b) => naturalCompare(a.key, b.key)).map((k) => k.x);
});

// ---------------------------------------------------------------- People & other
const personField = (field: 'name' | 'email'): EagerFn => ([v]) => {
  const get = (p: FormulaValue): FormulaValue => {
    if (Array.isArray(p)) return p.map(get);
    if (isPerson(p)) return p[field];
    if (isPage(p) && field === 'name') return p.title;
    if (p === null) return '';
    return fail(`${field}() expects a person but got ${typeName(p)}`);
  };
  return get(v);
};
def('name', 1, 1, personField('name'));
def('email', 1, 1, personField('email'));
def('id', 0, 1, ([v], ev) => {
  if (v === undefined) return ev.ctx.pageId ?? '';
  if (isPage(v) || isPerson(v)) return v.id;
  if (Array.isArray(v)) return v.map((x) => (isPage(x) || isPerson(x) ? x.id : ''));
  return v === null ? '' : fail(`id() expects a page but got ${typeName(v)}`);
});

for (const [name, fn] of FUNCS) FUNCS_LOWER.set(name.toLowerCase(), fn);

// ============================================================================
// Function catalogue (for autocomplete / docs UI)
// ============================================================================

type Category = 'Logic' | 'Text' | 'Math' | 'Date' | 'List' | 'People' | 'Other';
type FnInfo = { name: string; category: Category; signature: string; description: string; example: string };

const CATALOGUE: [string, Category, string, string, string][] = [
  ['if', 'Logic', 'if(condition, then, else)', 'Returns the second argument if the condition is true, otherwise the third.', 'if(prop("Done"), "✓", "…")'],
  ['ifs', 'Logic', 'ifs(cond1, value1, cond2, value2, ..., else)', 'Returns the value of the first true condition, or the final fallback.', 'ifs(prop("Score") > 90, "A", prop("Score") > 80, "B", "C")'],
  ['and', 'Logic', 'and(a, b, ...)', 'True if all arguments are true. Also available as the "and" / "&&" operator.', 'and(true, prop("Done"))'],
  ['or', 'Logic', 'or(a, b, ...)', 'True if any argument is true. Also available as "or" / "||".', 'or(false, prop("Done"))'],
  ['not', 'Logic', 'not(value)', 'Inverts a boolean. Also available as "not" / "!".', 'not prop("Done")'],
  ['empty', 'Logic', 'empty(value)', 'True if the value is empty: blank text, 0, false, an empty list, or no value.', 'empty(prop("Notes"))'],
  ['equal', 'Logic', 'equal(a, b)', 'True if both values are equal. Same as "==".', 'equal(1, 1)'],
  ['unequal', 'Logic', 'unequal(a, b)', 'True if the values differ. Same as "!=".', 'unequal("a", "b")'],
  ['length', 'Text', 'length(text | list)', 'Number of characters in text or items in a list.', '"Moving".length()'],
  ['substring', 'Text', 'substring(text, start, end?)', 'Part of the text from start (inclusive) to end (exclusive).', 'substring("Moving", 0, 4)'],
  ['contains', 'Text', 'contains(text, search)', 'True if the text contains the search text.', 'contains("Moving", "vin")'],
  ['test', 'Text', 'test(text, regex)', 'True if the text matches the regular expression.', 'test("Order 66", "\\\\d+")'],
  ['match', 'Text', 'match(text, regex)', 'A list of all matches of the regular expression.', 'match("a1b22", "\\\\d+")'],
  ['replace', 'Text', 'replace(text, regex, replacement)', 'Replaces the first match of the regular expression.', 'replace("a-b-c", "-", "+")'],
  ['replaceAll', 'Text', 'replaceAll(text, regex, replacement)', 'Replaces every match of the regular expression.', 'replaceAll("a-b-c", "-", "+")'],
  ['lower', 'Text', 'lower(text)', 'Converts text to lowercase.', 'lower("MOVING")'],
  ['upper', 'Text', 'upper(text)', 'Converts text to uppercase.', 'upper("moving")'],
  ['repeat', 'Text', 'repeat(text, times)', 'Repeats the text a number of times.', 'repeat("★", 3)'],
  ['padStart', 'Text', 'padStart(text, length, pad?)', 'Pads the start of the text to the given length.', 'padStart("7", 3, "0")'],
  ['padEnd', 'Text', 'padEnd(text, length, pad?)', 'Pads the end of the text to the given length.', 'padEnd("7", 3, "0")'],
  ['trim', 'Text', 'trim(text)', 'Removes leading and trailing whitespace.', 'trim("  hi  ")'],
  ['split', 'Text', 'split(text, separator)', 'Splits text into a list.', '"a,b,c".split(",")'],
  ['join', 'Text', 'join(list, separator)', 'Joins list items into text with a separator.', 'join(["a", "b"], ", ")'],
  ['concat', 'Text', 'concat(a, b, ...)', 'Combines lists into one list, or texts into one text.', 'concat([1, 2], [3])'],
  ['format', 'Text', 'format(value)', 'Converts any value to text.', 'format(42)'],
  ['link', 'Text', 'link(label, url)', 'Creates a link (rendered as its label text).', 'link("Moving", "https://moving.app")'],
  ['style', 'Text', 'style(text, styles...)', 'Applies styles such as "b" or "red" (styling is ignored; returns the text).', 'style("Hi", "b", "red")'],
  ['unstyle', 'Text', 'unstyle(text, style?)', 'Removes styling from text.', 'unstyle("Hi")'],
  ['startsWith', 'Text', 'startsWith(text, prefix)', 'True if the text starts with the prefix.', 'startsWith("Moving", "Mo")'],
  ['endsWith', 'Text', 'endsWith(text, suffix)', 'True if the text ends with the suffix.', 'endsWith("Moving", "ing")'],
  ['add', 'Math', 'add(a, b)', 'Adds two numbers (or joins text). Same as "+".', 'add(2, 3)'],
  ['subtract', 'Math', 'subtract(a, b)', 'Subtracts b from a. Same as "-".', 'subtract(5, 3)'],
  ['multiply', 'Math', 'multiply(a, b)', 'Multiplies two numbers. Same as "*".', 'multiply(4, 2)'],
  ['divide', 'Math', 'divide(a, b)', 'Divides a by b. Same as "/".', 'divide(10, 4)'],
  ['pow', 'Math', 'pow(base, exponent)', 'Raises base to a power. Same as "^".', 'pow(2, 10)'],
  ['mod', 'Math', 'mod(a, b)', 'Remainder of a divided by b. Same as "%".', 'mod(7, 3)'],
  ['abs', 'Math', 'abs(number)', 'Absolute value.', 'abs(-4)'],
  ['round', 'Math', 'round(number, places?)', 'Rounds to the nearest integer or number of decimal places.', 'round(3.14159, 2)'],
  ['ceil', 'Math', 'ceil(number)', 'Rounds up to the next integer.', 'ceil(4.1)'],
  ['floor', 'Math', 'floor(number)', 'Rounds down to the previous integer.', 'floor(4.9)'],
  ['sqrt', 'Math', 'sqrt(number)', 'Square root.', 'sqrt(16)'],
  ['cbrt', 'Math', 'cbrt(number)', 'Cube root.', 'cbrt(27)'],
  ['exp', 'Math', 'exp(number)', 'e raised to the power of the number.', 'exp(1)'],
  ['ln', 'Math', 'ln(number)', 'Natural logarithm.', 'ln(e)'],
  ['log10', 'Math', 'log10(number)', 'Base-10 logarithm.', 'log10(1000)'],
  ['log2', 'Math', 'log2(number)', 'Base-2 logarithm.', 'log2(8)'],
  ['sign', 'Math', 'sign(number)', '1 for positive, -1 for negative, 0 for zero.', 'sign(-7)'],
  ['min', 'Math', 'min(numbers... | list)', 'Smallest number.', 'min(4, 1, 9)'],
  ['max', 'Math', 'max(numbers... | list)', 'Largest number.', 'max([4, 1, 9])'],
  ['sum', 'Math', 'sum(numbers... | list)', 'Total of all numbers.', 'sum(1, 2, 3)'],
  ['mean', 'Math', 'mean(numbers... | list)', 'Average of all numbers.', 'mean([1, 2, 3])'],
  ['median', 'Math', 'median(numbers... | list)', 'Middle value of all numbers.', 'median(1, 5, 2)'],
  ['now', 'Date', 'now()', 'The current date and time.', 'now()'],
  ['today', 'Date', 'today()', "Today's date (midnight).", 'today()'],
  ['minute', 'Date', 'minute(date)', 'Minute of the date (0-59).', 'minute(now())'],
  ['hour', 'Date', 'hour(date)', 'Hour of the date (0-23).', 'hour(now())'],
  ['day', 'Date', 'day(date)', 'Day of the week (0 = Sunday … 6 = Saturday).', 'day(now())'],
  ['date', 'Date', 'date(date)', 'Day of the month (1-31).', 'date(now())'],
  ['week', 'Date', 'week(date)', 'ISO week number of the year.', 'week(now())'],
  ['month', 'Date', 'month(date)', 'Month of the year (1-12).', 'month(now())'],
  ['year', 'Date', 'year(date)', 'Year of the date.', 'year(now())'],
  ['dateAdd', 'Date', 'dateAdd(date, amount, unit)', 'Adds time. Units: years, quarters, months, weeks, days, hours, minutes.', 'dateAdd(now(), 3, "days")'],
  ['dateSubtract', 'Date', 'dateSubtract(date, amount, unit)', 'Subtracts time from a date.', 'dateSubtract(now(), 1, "months")'],
  ['dateBetween', 'Date', 'dateBetween(a, b, unit)', 'Time between two dates (a − b) in whole units.', 'dateBetween(prop("Due"), now(), "days")'],
  ['dateRange', 'Date', 'dateRange(start, end)', 'Creates a date range.', 'dateRange(today(), dateAdd(today(), 7, "days"))'],
  ['dateStart', 'Date', 'dateStart(range)', 'Start of a date range.', 'dateStart(prop("Sprint"))'],
  ['dateEnd', 'Date', 'dateEnd(range)', 'End of a date range.', 'dateEnd(prop("Sprint"))'],
  ['timestamp', 'Date', 'timestamp(date)', 'Milliseconds since the Unix epoch.', 'timestamp(now())'],
  ['fromTimestamp', 'Date', 'fromTimestamp(ms)', 'Creates a date from a Unix timestamp in milliseconds.', 'fromTimestamp(0)'],
  ['formatDate', 'Date', 'formatDate(date, pattern)', 'Formats a date, e.g. "YYYY-MM-DD", "MMMM D, YYYY", "ddd h:mm A".', 'formatDate(now(), "MMMM D, YYYY")'],
  ['parseDate', 'Date', 'parseDate(text)', 'Parses an ISO 8601 date such as "2026-10-09".', 'parseDate("2026-10-09")'],
  ['at', 'List', 'at(list, index)', 'Item at an index (negative counts from the end).', '[1, 2, 3].at(-1)'],
  ['first', 'List', 'first(list)', 'First item of a list.', 'first([1, 2, 3])'],
  ['last', 'List', 'last(list)', 'Last item of a list.', 'last([1, 2, 3])'],
  ['slice', 'List', 'slice(list, start, end?)', 'Part of a list from start to end (exclusive).', 'slice([1, 2, 3, 4], 1, 3)'],
  ['sort', 'List', 'sort(list, key?)', 'Sorts numbers, dates and text in natural order.', 'sort([3, 1, 2])'],
  ['reverse', 'List', 'reverse(list)', 'Reverses the order of a list.', 'reverse([1, 2, 3])'],
  ['includes', 'List', 'includes(list, value)', 'True if the list contains the value.', 'includes(["a", "b"], "b")'],
  ['find', 'List', 'find(list, condition)', 'First item matching the condition (use "current").', '[1, 5, 9].find(current > 3)'],
  ['findIndex', 'List', 'findIndex(list, condition)', 'Index of the first matching item, or -1.', '[1, 5, 9].findIndex(current > 3)'],
  ['filter', 'List', 'filter(list, condition)', 'Items matching the condition.', 'prop("Tasks").filter(current.prop("Done"))'],
  ['some', 'List', 'some(list, condition)', 'True if any item matches.', '[1, 5].some(current > 3)'],
  ['every', 'List', 'every(list, condition)', 'True if every item matches.', '[1, 5].every(current > 0)'],
  ['map', 'List', 'map(list, expression)', 'Transforms each item ("current" is the item, "index" its position).', '[1, 2, 3].map(current * 2)'],
  ['flat', 'List', 'flat(list)', 'Flattens nested lists into one list.', 'flat([[1, 2], [3]])'],
  ['unique', 'List', 'unique(list)', 'Removes duplicate items.', 'unique([1, 1, 2])'],
  ['count', 'List', 'count(list, condition?)', 'Number of items, optionally only those matching a condition.', 'count(prop("Tasks"), current.prop("Done"))'],
  ['name', 'People', 'name(person)', "A person's name.", 'name(prop("Owner"))'],
  ['email', 'People', 'email(person)', "A person's email address.", 'email(prop("Owner"))'],
  ['prop', 'Other', 'prop("Property")', 'Value of a property of this page (or of a related page via current.prop()).', 'prop("Status")'],
  ['let', 'Other', 'let(name, value, expression)', 'Assigns a variable for use in an expression.', 'let(x, 2, x * x)'],
  ['lets', 'Other', 'lets(a, 1, b, 2, expression)', 'Assigns several variables.', 'lets(a, 1, b, 2, a + b)'],
  ['id', 'Other', 'id(page?)', 'The id of this page or of the given page.', 'id()'],
  ['toNumber', 'Other', 'toNumber(value)', 'Converts text, booleans and dates to a number.', 'toNumber("42")'],
];

export const FORMULA_FUNCTIONS: FnInfo[] = CATALOGUE.map(([name, category, signature, description, example]) => ({
  name, category, signature, description, example,
}));

// ============================================================================
// Public API
// ============================================================================

interface Compiled { ast?: Node; error?: string }
const cache = new Map<string, Compiled>();

function walk(n: Node, visit: (n: Node) => void): void {
  visit(n);
  switch (n.k) {
    case 'list': n.items.forEach((x) => walk(x, visit)); break;
    case 'call': n.args.forEach((x) => walk(x, visit)); break;
    case 'unary': walk(n.arg, visit); break;
    case 'binary': walk(n.left, visit); walk(n.right, visit); break;
    case 'cond': walk(n.test, visit); walk(n.then, visit); walk(n.else, visit); break;
  }
}

function compile(source: string): Compiled {
  const hit = cache.get(source);
  if (hit) return hit;
  let result: Compiled;
  try {
    const ast = new Parser(tokenize(source)).parseProgram();
    walk(ast, (n) => {
      if (n.k !== 'call') return;
      const fn = lookupFn(n.name);
      if (!fn) fail(`Unknown function "${n.name}" at position ${n.pos + 1}`);
      checkArity(n.name, fn, n.args.length);
    });
    result = { ast };
  } catch (e) {
    result = { error: errorMessage(e) };
  }
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  cache.set(source, result);
  return result;
}

function errorMessage(e: unknown): string {
  if (e instanceof FormulaError) return e.message;
  if (e instanceof RangeError) return 'Formula is too complex to evaluate';
  return e instanceof Error ? e.message : String(e);
}

function normalize(v: FormulaValue | undefined): FormulaValue {
  if (v === undefined || (typeof v === 'number' && Number.isNaN(v))) return null;
  if (v instanceof Date && Number.isNaN(v.getTime())) return null;
  return v;
}

export function evaluateFormula(source: string, ctx: FormulaContext): FormulaResult {
  try {
    const { ast, error } = compile(source);
    if (!ast) return { value: null, error, type: 'empty' };
    work = 0;
    const value = normalize(new Evaluator(ctx).eval(ast, undefined));
    return { value, type: typeName(value) };
  } catch (e) {
    return { value: null, error: errorMessage(e), type: 'empty' };
  }
}

export function validateFormula(source: string): string | null {
  try {
    return compile(source).error ?? null;
  } catch (e) {
    return errorMessage(e);
  }
}

export function getReferencedProps(source: string): string[] {
  const names = new Set<string>();
  const { ast } = compile(source);
  if (ast) {
    walk(ast, (n) => {
      if (n.k === 'call' && n.name.toLowerCase() === 'prop' && n.args.length === 1 && n.args[0].k === 'str') {
        names.add(n.args[0].v);
      }
    });
  } else {
    const re = /(^|[^.\w])prop\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g;
    for (let m = re.exec(source); m; m = re.exec(source)) names.add(m[2].replace(/\\(.)/g, '$1'));
  }
  return [...names];
}
