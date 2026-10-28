import type { Database, DateValue, FilterGroup, FilterRule, ID, Page, Property, PropValue, SortRule, View, SelectOption } from '../store/types';
import type { PersistedState } from '../store/store';
import { dbRows } from '../store/store';
import { evaluateFormula, formatFormulaValue, type FormulaValue } from '../formula/engine';
import { fmtDateStyle, parseISO, startOfDay, fmtDate, htmlToText } from '../lib/util';

// ---------- Raw values ----------

/** Value of a property for a row, including computed props (formula/rollup/created…). */
export function getValue(s: PersistedState, page: Page, prop: Property, depth = 0): PropValue | FormulaValue {
  switch (prop.type) {
    case 'title': return page.title;
    case 'created_time': return page.createdAt;
    case 'last_edited_time': return page.updatedAt;
    case 'created_by': return [page.createdBy];
    case 'last_edited_by': return [page.updatedBy];
    case 'formula': return formulaValue(s, page, prop, depth).value;
    case 'rollup': return rollupValue(s, page, prop, depth);
    default: return page.props[prop.id] ?? null;
  }
}

// Cache per immutable `pages` record: any page edit produces a new record and invalidates it.
const formulaCache = new WeakMap<object, Map<string, { value: FormulaValue; error?: string }>>();

export function formulaValue(s: PersistedState, page: Page, prop: Property, depth = 0): { value: FormulaValue; error?: string } {
  if (depth > 6) return { value: null, error: 'Formula recursion too deep' };
  let cache = formulaCache.get(s.pages);
  const key = page.id + '|' + prop.id + '|' + (prop.formula ?? '');
  const hit = cache?.get(key);
  if (hit && depth === 0) return hit;
  const db = s.databases[page.dbId!];
  if (!db || !prop.formula?.trim()) return { value: null };
  const res = evaluateFormula(prop.formula, {
    pageId: page.id,
    getProp: (name: string) => {
      const p = db.properties.find((x) => x.name === name);
      if (!p) return undefined;
      return toFormula(s, db, page, p, depth + 1);
    },
    getPageProp: (pageId: string, name: string) => {
      const other = s.pages[pageId];
      if (!other?.dbId) return undefined;
      const odb = s.databases[other.dbId];
      const p = odb?.properties.find((x) => x.name === name);
      if (!p) return undefined;
      return toFormula(s, odb, other, p, depth + 1);
    },
  } as any);
  const out = { value: res.value, error: res.error };
  if (depth === 0) {
    if (!cache) { cache = new Map(); formulaCache.set(s.pages, cache); }
    cache.set(key, out);
  }
  return out;
}

/** Convert a stored property value into the formula engine's value space. */
function toFormula(s: PersistedState, db: Database, page: Page, p: Property, depth: number): FormulaValue {
  const v = getValue(s, page, p, depth);
  switch (p.type) {
    case 'select': case 'status': return optionName(p, v as string) ?? '';
    case 'multi_select': return ((v as string[]) ?? []).map((id) => optionName(p, id) ?? '').filter(Boolean);
    case 'date': {
      const d = v as DateValue | null;
      if (!d?.start) return null;
      const st = parseISO(d.start)!;
      if (d.end) return { type: 'daterange', start: st, end: parseISO(d.end)! } as any;
      return st;
    }
    case 'created_time': case 'last_edited_time': return new Date(v as number);
    case 'person': case 'created_by': case 'last_edited_by':
      return ((v as string[]) ?? []).map((id) => ({ type: 'person', id, name: s.users[id]?.name ?? '', email: s.users[id]?.email ?? '' }) as any);
    case 'relation':
      return ((v as string[]) ?? []).filter((id) => s.pages[id] && !s.pages[id].trashedAt).map((id) => ({ type: 'page', id, title: s.pages[id].title || 'Untitled' }) as any);
    case 'checkbox': return !!v;
    case 'number': case 'unique_id': return typeof v === 'number' ? v : null;
    case 'files': return ((v as any[]) ?? []).map((f) => f.name);
    case 'text': return htmlToText(String(v ?? ''));
    default: return (v as FormulaValue) ?? null;
  }
}

export function optionName(p: Property, id?: string | null): string | null {
  if (!id) return null;
  return p.options?.find((o) => o.id === id)?.name ?? null;
}
export function option(p: Property, id?: string | null): SelectOption | undefined {
  return id ? p.options?.find((o) => o.id === id) : undefined;
}

export function rollupValue(s: PersistedState, page: Page, prop: Property, depth = 0): PropValue | FormulaValue {
  const db = s.databases[page.dbId!];
  const rel = db?.properties.find((p) => p.id === prop.rollupRelation);
  if (!rel || !rel.relationDb) return null;
  const target = s.databases[rel.relationDb];
  const tprop = target?.properties.find((p) => p.id === prop.rollupProp);
  const ids = ((page.props[rel.id] as string[]) ?? []).filter((id) => s.pages[id] && !s.pages[id].trashedAt);
  if (!tprop) return prop.rollupFn === 'count_all' ? ids.length : null;
  const vals = ids.map((id) => getValue(s, s.pages[id], tprop, depth + 1));
  const isEmpty = (v: any) => v == null || v === '' || (Array.isArray(v) && v.length === 0) || v === false;
  const nums = vals.map((v) => (typeof v === 'number' ? v : NaN)).filter((n) => !isNaN(n));
  const dates = vals.map((v) => (v && typeof v === 'object' && 'start' in (v as any) ? parseISO((v as DateValue).start)?.getTime() : typeof v === 'number' && (tprop.type.includes('time')) ? v : NaN)).filter((n): n is number => !!n && !isNaN(n));
  const fn = prop.rollupFn ?? 'show_original';
  switch (fn) {
    case 'show_original': return { __rollup: vals, prop: tprop } as any;
    case 'show_unique': {
      const seen = new Set<string>();
      return { __rollup: vals.filter((v) => { const k = JSON.stringify(v); if (seen.has(k)) return false; seen.add(k); return true; }), prop: tprop } as any;
    }
    case 'count_all': return vals.length;
    case 'count_values': return vals.reduce<number>((a, v) => a + (Array.isArray(v) ? v.length : isEmpty(v) ? 0 : 1), 0);
    case 'count_unique': return new Set(vals.flat().filter((v) => !isEmpty(v)).map((v) => JSON.stringify(v))).size;
    case 'count_empty': return vals.filter(isEmpty).length;
    case 'count_not_empty': return vals.filter((v) => !isEmpty(v)).length;
    case 'percent_empty': return vals.length ? vals.filter(isEmpty).length / vals.length : 0;
    case 'percent_not_empty': return vals.length ? vals.filter((v) => !isEmpty(v)).length / vals.length : 0;
    case 'sum': return nums.reduce((a, b) => a + b, 0);
    case 'average': return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    case 'median': { if (!nums.length) return null; const so = [...nums].sort((a, b) => a - b); const m = so.length >> 1; return so.length % 2 ? so[m] : (so[m - 1] + so[m]) / 2; }
    case 'min': return nums.length ? Math.min(...nums) : null;
    case 'max': return nums.length ? Math.max(...nums) : null;
    case 'range': return nums.length ? Math.max(...nums) - Math.min(...nums) : null;
    case 'earliest': return dates.length ? new Date(Math.min(...dates)) as any : null;
    case 'latest': return dates.length ? new Date(Math.max(...dates)) as any : null;
    case 'checked': return vals.filter((v) => v === true).length;
    case 'unchecked': return vals.filter((v) => v !== true).length;
    case 'percent_checked': return vals.length ? vals.filter((v) => v === true).length / vals.length : 0;
  }
  return null;
}

export const ROLLUP_FNS: { id: Property['rollupFn']; label: string; group: string }[] = [
  { id: 'show_original', label: 'Show original', group: 'Show' },
  { id: 'show_unique', label: 'Show unique values', group: 'Show' },
  { id: 'count_all', label: 'Count all', group: 'Count' },
  { id: 'count_values', label: 'Count values', group: 'Count' },
  { id: 'count_unique', label: 'Count unique values', group: 'Count' },
  { id: 'count_empty', label: 'Count empty', group: 'Count' },
  { id: 'count_not_empty', label: 'Count not empty', group: 'Count' },
  { id: 'percent_empty', label: 'Percent empty', group: 'Percent' },
  { id: 'percent_not_empty', label: 'Percent not empty', group: 'Percent' },
  { id: 'sum', label: 'Sum', group: 'More options' },
  { id: 'average', label: 'Average', group: 'More options' },
  { id: 'median', label: 'Median', group: 'More options' },
  { id: 'min', label: 'Min', group: 'More options' },
  { id: 'max', label: 'Max', group: 'More options' },
  { id: 'range', label: 'Range', group: 'More options' },
  { id: 'earliest', label: 'Earliest date', group: 'Date' },
  { id: 'latest', label: 'Latest date', group: 'Date' },
  { id: 'checked', label: 'Checked', group: 'Checkbox' },
  { id: 'unchecked', label: 'Unchecked', group: 'Checkbox' },
  { id: 'percent_checked', label: 'Percent checked', group: 'Checkbox' },
];

// ---------- Display text ----------

const CURRENCY: Record<string, [string, string]> = {
  usd: ['USD', 'en-US'], eur: ['EUR', 'de-DE'], gbp: ['GBP', 'en-GB'], inr: ['INR', 'en-IN'], jpy: ['JPY', 'ja-JP'],
  cny: ['CNY', 'zh-CN'], krw: ['KRW', 'ko-KR'], rub: ['RUB', 'ru-RU'], brl: ['BRL', 'pt-BR'], cad: ['CAD', 'en-CA'], aud: ['AUD', 'en-AU'],
};

export function formatNumber(n: number | null | undefined, fmt: Property['numberFormat'] = 'number'): string {
  if (n == null || isNaN(n as number)) return '';
  if (fmt === 'commas') return n.toLocaleString('en-US', { maximumFractionDigits: 8 });
  if (fmt === 'percent') return `${+(n * 100).toFixed(4)}%`;
  if (fmt && CURRENCY[fmt]) return new Intl.NumberFormat(CURRENCY[fmt][1], { style: 'currency', currency: CURRENCY[fmt][0] }).format(n);
  return String(+n.toFixed(8));
}

export const NUMBER_FORMATS: { id: NonNullable<Property['numberFormat']>; label: string }[] = [
  { id: 'number', label: 'Number' }, { id: 'commas', label: 'Number with commas' }, { id: 'percent', label: 'Percent' },
  { id: 'usd', label: 'US dollar' }, { id: 'eur', label: 'Euro' }, { id: 'gbp', label: 'Pound' }, { id: 'inr', label: 'Rupee' },
  { id: 'jpy', label: 'Yen' }, { id: 'cny', label: 'Yuan' }, { id: 'krw', label: 'Won' }, { id: 'rub', label: 'Ruble' },
  { id: 'brl', label: 'Real' }, { id: 'cad', label: 'Canadian dollar' }, { id: 'aud', label: 'Australian dollar' },
];

export function formatDateValue(d: DateValue | null | undefined, prop?: Property): string {
  if (!d?.start) return '';
  const style = prop?.dateFormat ?? 'full';
  const h24 = prop?.timeFormat === '24';
  const a = fmtDateStyle(d.start, style, !!d.time && d.start.includes('T'), h24);
  if (!d.end) return a;
  return `${a} → ${fmtDateStyle(d.end, style, !!d.time && d.end.includes('T'), h24)}`;
}

/** Plain-text representation used for sorting, search, CSV export and grouping. */
export function displayText(s: PersistedState, page: Page, prop: Property): string {
  const v = getValue(s, page, prop);
  switch (prop.type) {
    case 'title': return page.title;
    case 'text': return htmlToText(String(v ?? ''));
    case 'number': return formatNumber(v as number, prop.numberFormat);
    case 'select': case 'status': return optionName(prop, v as string) ?? '';
    case 'multi_select': return ((v as string[]) ?? []).map((id) => optionName(prop, id)).filter(Boolean).join(', ');
    case 'date': return formatDateValue(v as DateValue, prop);
    case 'person': case 'created_by': case 'last_edited_by': return ((v as string[]) ?? []).map((id) => s.users[id]?.name ?? '').join(', ');
    case 'checkbox': return v ? 'Yes' : 'No';
    case 'files': return ((v as any[]) ?? []).map((f) => f.name).join(', ');
    case 'relation': return ((v as string[]) ?? []).map((id) => s.pages[id]?.title || 'Untitled').join(', ');
    case 'created_time': case 'last_edited_time': return fmtDate(v as number, true);
    case 'unique_id': return v == null ? '' : `${prop.prefix ? prop.prefix + '-' : ''}${v}`;
    case 'formula': return formatFormulaValue(v as FormulaValue);
    case 'rollup': {
      if (v && typeof v === 'object' && '__rollup' in (v as any)) {
        const { __rollup, prop: tp } = v as any;
        return (__rollup as any[]).map((x) => displayRaw(s, x, tp)).filter(Boolean).join(', ');
      }
      if (v instanceof Date) return fmtDate(v);
      if (typeof v === 'number') {
        if (['percent_empty', 'percent_not_empty', 'percent_checked'].includes(prop.rollupFn ?? '')) return `${Math.round(v * 100)}%`;
        return formatNumber(v, prop.numberFormat ?? 'number');
      }
      return '';
    }
    default: return v == null ? '' : String(v);
  }
}

function displayRaw(s: PersistedState, v: any, prop: Property): string {
  const fake = { id: '', props: { [prop.id]: v }, title: typeof v === 'string' ? v : '', createdAt: v, updatedAt: v, createdBy: v?.[0], updatedBy: v?.[0] } as unknown as Page;
  if (prop.type === 'title') return String(v ?? '');
  if (prop.type === 'formula') return formatFormulaValue(v);
  return displayText(s, { ...fake, dbId: undefined } as Page, { ...prop, type: prop.type === 'rollup' ? 'text' : prop.type });
}

// ---------- Sort keys ----------

function sortKey(s: PersistedState, page: Page, prop: Property): string | number | null {
  const v = getValue(s, page, prop);
  switch (prop.type) {
    case 'number': case 'unique_id': return typeof v === 'number' ? v : null;
    case 'created_time': case 'last_edited_time': return v as number;
    case 'date': { const d = v as DateValue; return d?.start ? parseISO(d.start)!.getTime() : null; }
    case 'checkbox': return v ? 1 : 0;
    case 'select': case 'status': { const i = prop.options?.findIndex((o) => o.id === v) ?? -1; return i < 0 ? null : i; }
    case 'formula': {
      if (typeof v === 'number') return v;
      if (v instanceof Date) return v.getTime();
      if (typeof v === 'boolean') return v ? 1 : 0;
      const t = formatFormulaValue(v as FormulaValue);
      return t === '' ? null : t.toLowerCase();
    }
    default: { const t = displayText(s, page, prop); return t === '' ? null : t.toLowerCase(); }
  }
}

export function sortRows(s: PersistedState, db: Database, rows: Page[], sorts: SortRule[]): Page[] {
  if (!sorts.length) return rows;
  const props = sorts.map((r) => ({ r, p: db.properties.find((x) => x.id === r.propId) })).filter((x) => x.p) as { r: SortRule; p: Property }[];
  const keyed = rows.map((row) => ({ row, keys: props.map(({ p }) => sortKey(s, row, p)) }));
  keyed.sort((a, b) => {
    for (let i = 0; i < props.length; i++) {
      const x = a.keys[i], y = b.keys[i];
      if (x === y) continue;
      if (x == null) return 1;            // empties last regardless of direction
      if (y == null) return -1;
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
      if (c !== 0) return props[i].r.dir === 'asc' ? c : -c;
    }
    return 0;
  });
  return keyed.map((k) => k.row);
}

// ---------- Filters ----------

export function isGroup(r: FilterRule | FilterGroup): r is FilterGroup {
  return (r as FilterGroup).rules !== undefined;
}

export function opsFor(type: Property['type']): { op: FilterRule['op']; label: string; noValue?: boolean }[] {
  const empty = [{ op: 'empty' as const, label: 'Is empty', noValue: true }, { op: 'not_empty' as const, label: 'Is not empty', noValue: true }];
  switch (type) {
    case 'number': case 'unique_id': return [
      { op: 'eq', label: '=' }, { op: 'neq', label: '≠' }, { op: 'gt', label: '>' }, { op: 'lt', label: '<' },
      { op: 'gte', label: '≥' }, { op: 'lte', label: '≤' }, ...empty];
    case 'select': case 'status': return [{ op: 'is', label: 'Is' }, { op: 'is_not', label: 'Is not' }, ...empty];
    case 'multi_select': case 'relation': return [{ op: 'contains', label: 'Contains' }, { op: 'not_contains', label: 'Does not contain' }, ...empty];
    case 'person': case 'created_by': case 'last_edited_by': return [{ op: 'contains', label: 'Contains' }, { op: 'not_contains', label: 'Does not contain' }, { op: 'me', label: 'Is me', noValue: true }, ...empty];
    case 'date': case 'created_time': case 'last_edited_time': return [
      { op: 'is', label: 'Is' }, { op: 'before', label: 'Is before' }, { op: 'after', label: 'Is after' },
      { op: 'on_or_before', label: 'Is on or before' }, { op: 'on_or_after', label: 'Is on or after' }, ...empty];
    case 'checkbox': return [{ op: 'checked', label: 'Is checked', noValue: true }, { op: 'unchecked', label: 'Is not checked', noValue: true }];
    case 'files': return empty;
    default: return [
      { op: 'is', label: 'Is' }, { op: 'is_not', label: 'Is not' }, { op: 'contains', label: 'Contains' },
      { op: 'not_contains', label: 'Does not contain' }, { op: 'starts_with', label: 'Starts with' }, { op: 'ends_with', label: 'Ends with' }, ...empty];
  }
}

/** Relative date presets for date filters. */
export function resolveDateFilter(value: unknown): number | null {
  if (typeof value !== 'string' || !value) return null;
  const today = startOfDay(new Date());
  const map: Record<string, number> = {
    today: 0, tomorrow: 1, yesterday: -1, one_week_ago: -7, one_week_from_now: 7, one_month_ago: -30, one_month_from_now: 30,
  };
  if (value in map) return today.getTime() + map[value] * 864e5;
  const d = parseISO(value);
  return d ? startOfDay(d).getTime() : null;
}

export const DATE_PRESETS = [
  ['today', 'Today'], ['tomorrow', 'Tomorrow'], ['yesterday', 'Yesterday'], ['one_week_ago', 'One week ago'],
  ['one_week_from_now', 'One week from now'], ['one_month_ago', 'One month ago'], ['one_month_from_now', 'One month from now'],
] as const;

function matchRule(s: PersistedState, db: Database, page: Page, rule: FilterRule): boolean {
  const prop = db.properties.find((p) => p.id === rule.propId);
  if (!prop) return true;
  const v = getValue(s, page, prop);
  const val = rule.value;
  const text = () => displayText(s, page, prop).toLowerCase();
  const isEmpty = v == null || v === '' || (Array.isArray(v) && v.length === 0) || (prop.type === 'date' && !(v as DateValue)?.start);
  if (rule.op === 'empty') return prop.type === 'formula' || prop.type === 'rollup' ? text() === '' : isEmpty;
  if (rule.op === 'not_empty') return prop.type === 'formula' || prop.type === 'rollup' ? text() !== '' : !isEmpty;
  if (rule.op === 'checked') return (v as unknown) === true;
  if (rule.op === 'unchecked') return (v as unknown) !== true;
  if (rule.op === 'me') return Array.isArray(v) && (v as unknown[]).includes(s.meId);
  // ignore incomplete rules
  if (val === undefined || val === '' || val === null || (Array.isArray(val) && !val.length)) return true;

  switch (prop.type) {
    case 'number': case 'unique_id': {
      const n = v as number, x = Number(val);
      if (v == null) return rule.op === 'neq';
      return rule.op === 'eq' ? n === x : rule.op === 'neq' ? n !== x : rule.op === 'gt' ? n > x : rule.op === 'lt' ? n < x : rule.op === 'gte' ? n >= x : n <= x;
    }
    case 'select': case 'status': {
      const ids = Array.isArray(val) ? val as string[] : [val as string];
      return rule.op === 'is' ? ids.includes(v as string) : !ids.includes(v as string);
    }
    case 'multi_select': case 'relation': case 'person': case 'created_by': case 'last_edited_by': {
      const list = (v as string[]) ?? [];
      const ids = Array.isArray(val) ? val as string[] : [val as string];
      const has = ids.some((id) => list.includes(id));
      return rule.op === 'contains' ? has : !has;
    }
    case 'date': case 'created_time': case 'last_edited_time': {
      const t = prop.type === 'date' ? ((v as DateValue)?.start ? startOfDay(parseISO((v as DateValue).start)!).getTime() : null) : startOfDay(new Date(v as number)).getTime();
      const x = resolveDateFilter(val);
      if (t == null || x == null) return false;
      return rule.op === 'is' ? t === x : rule.op === 'before' ? t < x : rule.op === 'after' ? t > x : rule.op === 'on_or_before' ? t <= x : t >= x;
    }
    default: {
      const t = text(), x = String(val).toLowerCase();
      switch (rule.op) {
        case 'is': return t === x;
        case 'is_not': return t !== x;
        case 'contains': return t.includes(x);
        case 'not_contains': return !t.includes(x);
        case 'starts_with': return t.startsWith(x);
        case 'ends_with': return t.endsWith(x);
      }
    }
  }
  return true;
}

export function matchGroup(s: PersistedState, db: Database, page: Page, g: FilterGroup): boolean {
  if (!g.rules.length) return true;
  const results = g.rules.map((r) => (isGroup(r) ? matchGroup(s, db, page, r) : matchRule(s, db, page, r)));
  return g.conj === 'and' ? results.every(Boolean) : results.some(Boolean);
}

export function countRules(g: FilterGroup): number {
  return g.rules.reduce((a, r) => a + (isGroup(r) ? countRules(r) : 1), 0);
}

// ---------- View query ----------

export function queryView(s: PersistedState, db: Database, view: View, search = ''): Page[] {
  let rows = dbRows(s, db.id);
  rows = rows.filter((r) => matchGroup(s, db, r, view.filter));
  if (search.trim()) {
    const q = search.toLowerCase();
    rows = rows.filter((r) => db.properties.some((p) => displayText(s, r, p).toLowerCase().includes(q)));
  }
  return sortRows(s, db, rows, view.sorts);
}

export interface Group { key: string; label: string; option?: SelectOption; rows: Page[]; }

export function groupRows(s: PersistedState, db: Database, view: View, rows: Page[], propId = view.groupBy): Group[] | null {
  const prop = db.properties.find((p) => p.id === propId);
  if (!prop) return null;
  const groups = new Map<string, Group>();
  const ensure = (key: string, label: string, opt?: SelectOption) => {
    if (!groups.has(key)) groups.set(key, { key, label, option: opt, rows: [] });
    return groups.get(key)!;
  };
  if (prop.type === 'select' || prop.type === 'status' || prop.type === 'multi_select') {
    ensure('__none', `No ${prop.name}`);
    for (const o of prop.options ?? []) ensure(o.id, o.name, o);
  }
  if (prop.type === 'checkbox') { ensure('true', 'Checked'); ensure('false', 'Unchecked'); }
  for (const r of rows) {
    const v = getValue(s, r, prop);
    if (prop.type === 'multi_select' || prop.type === 'person' || prop.type === 'relation') {
      const list = (v as string[]) ?? [];
      if (!list.length) ensure('__none', `No ${prop.name}`).rows.push(r);
      for (const id of list) {
        const label = prop.type === 'person' ? s.users[id]?.name ?? 'Unknown' : prop.type === 'relation' ? s.pages[id]?.title || 'Untitled' : optionName(prop, id) ?? '';
        ensure(id, label, option(prop, id)).rows.push(r);
      }
    } else if (prop.type === 'select' || prop.type === 'status') {
      const key = (v as string) && option(prop, v as string) ? (v as string) : '__none';
      ensure(key, key === '__none' ? `No ${prop.name}` : optionName(prop, key)!, option(prop, key)).rows.push(r);
    } else if (prop.type === 'checkbox') {
      ensure(v ? 'true' : 'false', v ? 'Checked' : 'Unchecked').rows.push(r);
    } else if (prop.type === 'date' || prop.type === 'created_time' || prop.type === 'last_edited_time') {
      const t = prop.type === 'date' ? (v as DateValue)?.start : v ? new Date(v as number).toISOString() : null;
      if (!t) { ensure('__none', `No ${prop.name}`).rows.push(r); continue; }
      const d = parseISO(t.slice(0, 10))!;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      ensure(key, d.toLocaleString('en-US', { month: 'long', year: 'numeric' })).rows.push(r);
    } else {
      const t = displayText(s, r, prop);
      ensure(t || '__none', t || `No ${prop.name}`).rows.push(r);
    }
  }
  let list = Array.from(groups.values());
  if (prop.type === 'date' || prop.type === 'created_time' || prop.type === 'last_edited_time' || prop.type === 'text' || prop.type === 'number') {
    list.sort((a, b) => (a.key === '__none' ? 1 : b.key === '__none' ? -1 : a.key.localeCompare(b.key, undefined, { numeric: true })));
  }
  if (view.hideEmptyGroups) list = list.filter((g) => g.rows.length);
  return list;
}

// ---------- Calculations ----------

export const CALCS: { id: string; label: string; types?: Property['type'][]; group: string }[] = [
  { id: 'none', label: 'None', group: '' },
  { id: 'count_all', label: 'Count all', group: 'Count' },
  { id: 'count_values', label: 'Count values', group: 'Count' },
  { id: 'count_unique', label: 'Count unique values', group: 'Count' },
  { id: 'count_empty', label: 'Count empty', group: 'Count' },
  { id: 'count_not_empty', label: 'Count not empty', group: 'Count' },
  { id: 'percent_empty', label: 'Percent empty', group: 'Percent' },
  { id: 'percent_not_empty', label: 'Percent not empty', group: 'Percent' },
  { id: 'sum', label: 'Sum', types: ['number', 'formula', 'rollup'], group: 'More options' },
  { id: 'average', label: 'Average', types: ['number', 'formula', 'rollup'], group: 'More options' },
  { id: 'median', label: 'Median', types: ['number', 'formula', 'rollup'], group: 'More options' },
  { id: 'min', label: 'Min', types: ['number', 'formula', 'rollup'], group: 'More options' },
  { id: 'max', label: 'Max', types: ['number', 'formula', 'rollup'], group: 'More options' },
  { id: 'range', label: 'Range', types: ['number', 'formula', 'rollup'], group: 'More options' },
  { id: 'checked', label: 'Checked', types: ['checkbox'], group: 'Checkbox' },
  { id: 'unchecked', label: 'Unchecked', types: ['checkbox'], group: 'Checkbox' },
  { id: 'percent_checked', label: 'Percent checked', types: ['checkbox'], group: 'Checkbox' },
  { id: 'earliest', label: 'Earliest date', types: ['date', 'created_time', 'last_edited_time'], group: 'Date' },
  { id: 'latest', label: 'Latest date', types: ['date', 'created_time', 'last_edited_time'], group: 'Date' },
];

export function calculate(s: PersistedState, prop: Property, rows: Page[], fn: string): string {
  if (!fn || fn === 'none') return '';
  const vals = rows.map((r) => getValue(s, r, prop));
  const texts = rows.map((r) => displayText(s, r, prop));
  const empty = (i: number) => {
    const v = vals[i];
    return prop.type === 'checkbox' ? !v : texts[i] === '' || v == null || (Array.isArray(v) && !v.length);
  };
  const nums = vals.map((v) => (typeof v === 'number' ? v : NaN)).filter((n) => !isNaN(n));
  const fmt = (n: number) => formatNumber(n, prop.type === 'number' ? prop.numberFormat : 'number');
  const pct = (n: number) => `${rows.length ? Math.round((n / rows.length) * 100) : 0}%`;
  switch (fn) {
    case 'count_all': return String(rows.length);
    case 'count_values': return String(vals.reduce<number>((a, v, i) => a + (Array.isArray(v) ? v.length : empty(i) ? 0 : 1), 0));
    case 'count_unique': return String(new Set(texts.filter(Boolean)).size);
    case 'count_empty': return String(rows.filter((_, i) => empty(i)).length);
    case 'count_not_empty': return String(rows.filter((_, i) => !empty(i)).length);
    case 'percent_empty': return pct(rows.filter((_, i) => empty(i)).length);
    case 'percent_not_empty': return pct(rows.filter((_, i) => !empty(i)).length);
    case 'sum': return fmt(nums.reduce((a, b) => a + b, 0));
    case 'average': return nums.length ? fmt(+(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)) : '';
    case 'median': { if (!nums.length) return ''; const so = [...nums].sort((a, b) => a - b); const m = so.length >> 1; return fmt(so.length % 2 ? so[m] : (so[m - 1] + so[m]) / 2); }
    case 'min': return nums.length ? fmt(Math.min(...nums)) : '';
    case 'max': return nums.length ? fmt(Math.max(...nums)) : '';
    case 'range': return nums.length ? fmt(Math.max(...nums) - Math.min(...nums)) : '';
    case 'checked': return String(vals.filter((v) => v === true).length);
    case 'unchecked': return String(vals.filter((v) => v !== true).length);
    case 'percent_checked': return pct(vals.filter((v) => v === true).length);
    case 'earliest': case 'latest': {
      const ts = vals.map((v) => (prop.type === 'date' ? ((v as DateValue)?.start ? parseISO((v as DateValue).start)!.getTime() : NaN) : (v as number))).filter((n) => !isNaN(n));
      if (!ts.length) return '';
      return fmtDate(fn === 'earliest' ? Math.min(...ts) : Math.max(...ts));
    }
  }
  return '';
}

export function calcLabel(fn: string) {
  const c = CALCS.find((x) => x.id === fn);
  if (!c) return '';
  return ({ count_all: 'Count', count_values: 'Values', count_unique: 'Unique', count_empty: 'Empty', count_not_empty: 'Not empty', percent_empty: 'Empty', percent_not_empty: 'Not empty', checked: 'Checked', unchecked: 'Unchecked', percent_checked: 'Checked', earliest: 'Earliest', latest: 'Latest' } as Record<string, string>)[fn] ?? c.label;
}

// ---------- CSV ----------

export function toCSV(s: PersistedState, db: Database, rows: Page[], propIds?: ID[]): string {
  const props = propIds ? propIds.map((id) => db.properties.find((p) => p.id === id)!).filter(Boolean) : db.properties;
  const esc = (t: string) => (/[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
  const lines = [props.map((p) => esc(p.name)).join(',')];
  for (const r of rows) lines.push(props.map((p) => esc(displayText(s, r, p))).join(','));
  return lines.join('\n');
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}
