// Inline formatting on the current DOM selection inside a contenteditable block.
import type { Color } from '../store/types';
import { getSel } from './caret';

export type Mark = 'bold' | 'italic' | 'underline' | 'strike' | 'code';

const TAGS: Record<Mark, string[]> = {
  bold: ['B', 'STRONG'],
  italic: ['I', 'EM'],
  underline: ['U'],
  strike: ['S', 'STRIKE', 'DEL'],
  code: ['CODE'],
};

function editableRoot(node: Node | null): HTMLElement | null {
  let n: Node | null = node;
  while (n) {
    if (n instanceof HTMLElement && n.isContentEditable && n.getAttribute('contenteditable') === 'true') return n;
    n = n.parentNode;
  }
  return null;
}

function emitInput(root: HTMLElement | null) {
  root?.dispatchEvent(new Event('input', { bubbles: true }));
}

function ancestorWith(node: Node, root: HTMLElement, test: (el: HTMLElement) => boolean): HTMLElement | null {
  let n: Node | null = node;
  while (n && n !== root) {
    if (n instanceof HTMLElement && test(n)) return n;
    n = n.parentNode;
  }
  return null;
}

/** Whether every text node of the selection is inside the given mark. */
export function isMarkActive(mark: Mark): boolean {
  const sel = getSel();
  if (!sel || !sel.rangeCount) return false;
  const range = sel.getRangeAt(0);
  const root = editableRoot(range.commonAncestorContainer);
  if (!root) return false;
  const texts = textNodesInRange(range);
  if (!texts.length) return !!ancestorWith(range.startContainer, root, (el) => TAGS[mark].includes(el.tagName));
  return texts.every((t) => !!ancestorWith(t, root, (el) => TAGS[mark].includes(el.tagName)));
}

function textNodesInRange(range: Range): Text[] {
  const root = range.commonAncestorContainer;
  if (root.nodeType === Node.TEXT_NODE) return (root as Text).data.length ? [root as Text] : [];
  const out: Text[] = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const t = w.currentNode as Text;
    if (range.intersectsNode(t) && t.data.length) out.push(t);
  }
  return out;
}

function unwrap(el: HTMLElement) {
  const parent = el.parentNode!;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

/** Toggle a mark on the selection. */
export function toggleMark(mark: Mark) {
  const sel = getSel();
  if (!sel || !sel.rangeCount || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const root = editableRoot(range.commonAncestorContainer);
  if (!root) return;
  const active = isMarkActive(mark);
  if (mark !== 'code') {
    const cmd = { bold: 'bold', italic: 'italic', underline: 'underline', strike: 'strikeThrough' }[mark];
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand(cmd);
    emitInput(root);
    return;
  }
  if (active) {
    const codes = new Set<HTMLElement>();
    for (const t of textNodesInRange(range)) {
      const c = ancestorWith(t, root, (el) => el.tagName === 'CODE');
      if (c) codes.add(c);
    }
    const sc = ancestorWith(range.startContainer, root, (el) => el.tagName === 'CODE');
    if (sc) codes.add(sc);
    codes.forEach(unwrap);
  } else {
    wrapRange(range, document.createElement('code'), (el) => el.tagName === 'CODE');
  }
  emitInput(root);
}

function wrapRange(range: Range, wrapper: HTMLElement, strip?: (el: HTMLElement) => boolean) {
  const frag = range.extractContents();
  if (strip) frag.querySelectorAll('*').forEach((el) => { if (strip(el as HTMLElement)) unwrap(el as HTMLElement); });
  wrapper.appendChild(frag);
  range.insertNode(wrapper);
  const sel = getSel()!;
  const r = document.createRange();
  r.selectNodeContents(wrapper);
  sel.removeAllRanges();
  sel.addRange(r);
}

const isColorSpan = (kind: 'text' | 'bg') => (el: HTMLElement) =>
  el.tagName === 'SPAN' && Array.from(el.classList).some((c) => c.startsWith(kind === 'text' ? 'c-' : 'bg-'));

export function applyColor(color: Color, kind: 'text' | 'bg') {
  const sel = getSel();
  if (!sel || !sel.rangeCount || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const root = editableRoot(range.commonAncestorContainer);
  if (!root) return;
  const span = document.createElement('span');
  if (color !== 'default') span.className = `${kind === 'text' ? 'c' : 'bg'}-${color}`;
  wrapRange(range, span, isColorSpan(kind));
  if (color === 'default') unwrap(span);
  lastColor = { color, kind };
  emitInput(root);
}

export let lastColor: { color: Color; kind: 'text' | 'bg' } | null = null;

export function applyLink(href: string | null) {
  const sel = getSel();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const root = editableRoot(range.commonAncestorContainer);
  if (!root) return;
  if (!href) {
    for (const t of textNodesInRange(range)) {
      const a = ancestorWith(t, root, (el) => el.tagName === 'A');
      if (a) unwrap(a);
    }
    const a = ancestorWith(range.startContainer, root, (el) => el.tagName === 'A');
    if (a) unwrap(a);
  } else {
    const a = document.createElement('a');
    a.href = href;
    if (href.startsWith('#/page/')) a.setAttribute('data-page', href.slice(7));
    wrapRange(range, a, (el) => el.tagName === 'A');
  }
  emitInput(root);
}

export function currentLink(): string | null {
  const sel = getSel();
  if (!sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const root = editableRoot(range.commonAncestorContainer);
  if (!root) return null;
  return ancestorWith(range.startContainer, root, (el) => el.tagName === 'A')?.getAttribute('href') ?? null;
}

/** Wrap the selection in a comment-highlight span. */
export function wrapComment(threadId: string): string {
  const sel = getSel();
  if (!sel || !sel.rangeCount || sel.isCollapsed) return '';
  const range = sel.getRangeAt(0);
  const root = editableRoot(range.commonAncestorContainer);
  const text = range.toString();
  const span = document.createElement('span');
  span.className = 'commented';
  span.setAttribute('data-comment', threadId);
  wrapRange(range, span);
  emitInput(root);
  return text;
}

export function removeCommentMarks(root: HTMLElement, threadId: string) {
  root.querySelectorAll(`[data-comment="${threadId}"]`).forEach((el) => unwrap(el as HTMLElement));
}

/** Convert the selection into an inline equation atom. */
export function selectionToEquation() {
  const sel = getSel();
  if (!sel || !sel.rangeCount || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const root = editableRoot(range.commonAncestorContainer);
  const tex = range.toString();
  range.deleteContents();
  const span = document.createElement('span');
  span.className = 'inline-eq';
  span.setAttribute('contenteditable', 'false');
  span.setAttribute('data-tex', tex);
  span.textContent = tex;
  range.insertNode(span);
  const r = document.createRange();
  r.setStartAfter(span);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
  emitInput(root);
}

export function selectedText(): string {
  return getSel()?.toString() ?? '';
}
