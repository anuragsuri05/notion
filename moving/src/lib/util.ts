import type { Block, BlockType } from '../store/types';

export const uid = (): string =>
  (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '').slice(0, 20);

export const now = () => Date.now();

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// ---------- Time ----------

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return 'Just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return fmtDate(ts);
}

export function fmtDate(ts: number | Date, withTime = false, h24 = false): string {
  const d = new Date(ts);
  let s = `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  if (withTime) s += ` ${fmtTime(d, h24)}`;
  return s;
}

export function fmtTime(d: Date, h24 = false) {
  if (h24) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const h = d.getHours() % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

export function fmtDateStyle(iso: string, style: string = 'full', time = false, h24 = false): string {
  const d = parseISO(iso);
  if (!d) return '';
  let s: string;
  const pad = (n: number) => String(n).padStart(2, '0');
  switch (style) {
    case 'relative': {
      const diff = Math.round((startOfDay(d).getTime() - startOfDay(new Date()).getTime()) / 864e5);
      s = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday'
        : Math.abs(diff) < 7 ? (diff > 0 ? WEEKDAYS[d.getDay()] : `Last ${WEEKDAYS[d.getDay()]}`) : fmtDate(d);
      break;
    }
    case 'mdy': s = `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`; break;
    case 'dmy': s = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; break;
    case 'ymd': s = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`; break;
    default: s = `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }
  if (time) s += ` ${fmtTime(d, h24)}`;
  return s;
}

export function parseISO(iso?: string | null): Date | null {
  if (!iso) return null;
  // Date-only strings should be local, not UTC.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export function toISODate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toISODateTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${toISODate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
export function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
export function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
export const monthName = (m: number) => MONTHS[m];

/** Parse natural-language dates used by @-mentions: today, tomorrow, yesterday, next friday, in 3 days, oct 12, 2026-10-12, 3pm */
export function parseNaturalDate(q: string): { date: Date; time: boolean } | null {
  const s = q.trim().toLowerCase();
  if (!s) return null;
  const base = startOfDay(new Date());
  let date: Date | null = null;
  let time = false;
  let rest = s;
  const timeMatch = /(?:\s|^)(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(s);
  let hh = 0, mm = 0;
  if (timeMatch && (timeMatch[3] || timeMatch[2])) {
    hh = +timeMatch[1] % 12 + (timeMatch[3] === 'pm' ? 12 : 0);
    if (!timeMatch[3]) hh = +timeMatch[1];
    mm = +(timeMatch[2] ?? 0);
    time = true;
    rest = s.slice(0, timeMatch.index).trim();
  }
  if (!rest || rest === 'today' || rest === 'now') date = base;
  else if (rest === 'tomorrow') date = addDays(base, 1);
  else if (rest === 'yesterday') date = addDays(base, -1);
  else if (/^in (\d+) (day|days|week|weeks)$/.test(rest)) {
    const [, n, u] = /^in (\d+) (\w+)$/.exec(rest)!;
    date = addDays(base, +n * (u.startsWith('week') ? 7 : 1));
  } else if (/^(next |this )?(sun|mon|tue|wed|thu|fri|sat)/.test(rest)) {
    const next = rest.startsWith('next ');
    const name = rest.replace(/^(next |this )/, '').slice(0, 3);
    const idx = WEEKDAYS.findIndex((w) => w.toLowerCase().startsWith(name));
    let diff = (idx - base.getDay() + 7) % 7 || 7;
    if (next && diff < 7) diff += 0;
    date = addDays(base, diff);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(rest)) date = parseISO(rest);
  else {
    const mi = MONTHS.findIndex((m) => rest.startsWith(m.slice(0, 3).toLowerCase()));
    const dm = /(\d{1,2})(?:,?\s*(\d{4}))?$/.exec(rest);
    if (mi >= 0 && dm) date = new Date(dm[2] ? +dm[2] : base.getFullYear(), mi, +dm[1]);
  }
  if (!date) return null;
  if (time) date.setHours(hh, mm);
  return { date, time };
}

// ---------- HTML / text ----------

export function htmlToText(html: string): string {
  if (!html) return '';
  const d = document.createElement('div');
  d.innerHTML = html;
  d.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  return d.textContent ?? '';
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'CODE', 'A', 'SPAN', 'BR']);
const ALLOWED_ATTRS = new Set(['href', 'class', 'data-page', 'data-user', 'data-date', 'data-comment', 'data-tex', 'contenteditable', 'data-time']);

/** Keep only inline formatting markup we understand. */
export function sanitizeInline(html: string): string {
  const d = document.createElement('div');
  d.innerHTML = html;
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      walk(child);
      if (!ALLOWED_TAGS.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }
      for (const attr of Array.from(child.attributes)) {
        if (!ALLOWED_ATTRS.has(attr.name)) child.removeAttribute(attr.name);
      }
      if (child.tagName === 'A') {
        const href = child.getAttribute('href') ?? '';
        if (/^\s*javascript:/i.test(href)) child.removeAttribute('href');
      }
    }
  };
  walk(d);
  return d.innerHTML;
}

export function isEmptyHtml(html: string) {
  return !html || html === '<br>' || htmlToText(html).length === 0 && !/data-(page|user|date|tex)/.test(html);
}

// ---------- Block tree helpers ----------

export const TEXT_TYPES: BlockType[] = ['text', 'h1', 'h2', 'h3', 'h4', 'todo', 'bullet', 'numbered', 'toggle', 'toggle_h1', 'toggle_h2', 'toggle_h3', 'quote', 'callout'];
export const isTextType = (t: BlockType) => TEXT_TYPES.includes(t);
export const isToggleType = (t: BlockType) => t === 'toggle' || t === 'toggle_h1' || t === 'toggle_h2' || t === 'toggle_h3';

export function newBlock(type: BlockType = 'text', patch: Partial<Block> = {}): Block {
  const b: Block = { id: uid(), type, html: '', ...patch };
  if (type === 'columns' && !b.children) b.children = [newBlock('column', { children: [newBlock()] }), newBlock('column', { children: [newBlock()] })];
  if (type === 'table' && !b.rows) { b.rows = [['', '', ''], ['', '', ''], ['', '', '']]; b.headerRow = true; }
  if (type === 'callout' && !b.icon) { b.icon = '💡'; b.bg = b.bg ?? 'gray'; }
  if (type === 'code' && !b.language) b.language = 'javascript';
  if (isToggleType(type) && b.open === undefined) b.open = true;
  if (type === 'tabs' && !b.tabs) b.tabs = [{ id: uid(), name: 'Tab 1', children: [newBlock()] }, { id: uid(), name: 'Tab 2', children: [newBlock()] }];
  return b;
}

export type Loc = { list: Block[]; index: number; parent: Block | null };

/** Find a block anywhere in a tree, returning the array that holds it. */
export function findLoc(list: Block[], id: string, parent: Block | null = null): Loc | null {
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (b.id === id) return { list, index: i, parent };
    if (b.children) {
      const r = findLoc(b.children, id, b);
      if (r) return r;
    }
    if (b.tabs) {
      for (const t of b.tabs) {
        const r = findLoc(t.children, id, b);
        if (r) return r;
      }
    }
  }
  return null;
}

export function findBlock(list: Block[], id: string): Block | null {
  const l = findLoc(list, id);
  return l ? l.list[l.index] : null;
}

export function walkBlocks(list: Block[], fn: (b: Block, depth: number) => void, depth = 0) {
  for (const b of list) {
    fn(b, depth);
    if (b.children) walkBlocks(b.children, fn, depth + 1);
    if (b.tabs) b.tabs.forEach((t) => walkBlocks(t.children, fn, depth + 1));
  }
}

/** Ordered list of blocks the caret can visit (skipping collapsed toggle bodies). */
export function flattenVisible(list: Block[], out: Block[] = []): Block[] {
  for (const b of list) {
    out.push(b);
    if (b.children && (!isToggleType(b.type) || b.open)) flattenVisible(b.children, out);
    if (b.tabs) flattenVisible(b.tabs[b.activeTab ?? 0]?.children ?? [], out);
  }
  return out;
}

export function cloneBlocks(list: Block[]): Block[] {
  return list.map((b) => ({
    ...structuredClone(b),
    id: uid(),
    children: b.children ? cloneBlocks(b.children) : undefined,
    tabs: b.tabs?.map((t) => ({ ...t, id: uid(), children: cloneBlocks(t.children) })),
  }));
}

export function blocksText(list: Block[]): string {
  const parts: string[] = [];
  walkBlocks(list, (b) => { if (b.html) parts.push(htmlToText(b.html)); if (b.rows) b.rows.forEach((r) => parts.push(r.map(htmlToText).join(' '))); });
  return parts.join('\n');
}

export function download(filename: string, content: string | Blob, type = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export function pickFile(accept = '*/*', multiple = false): Promise<File[]> {
  return new Promise((res) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => res(Array.from(input.files ?? []));
    input.click();
  });
}

export function fmtBytes(n?: number) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export function fuzzy(q: string, ...texts: (string | undefined)[]) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return texts.some((t) => t && t.toLowerCase().includes(s));
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const mod = (e: { metaKey: boolean; ctrlKey: boolean }) => (isMac ? e.metaKey : e.ctrlKey);
export const MOD = isMac ? '⌘' : 'Ctrl+';
export const ALT = isMac ? '⌥' : 'Alt+';
export const SHIFT = isMac ? '⇧' : 'Shift+';
