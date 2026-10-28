// Caret & selection helpers for per-block contenteditable elements.

export function getSel(): Selection | null {
  return window.getSelection();
}

/** Character offset of the caret (selection start) within el's text. */
export function getCaretOffset(el: HTMLElement): number {
  const sel = getSel();
  if (!sel || !sel.rangeCount) return 0;
  const r = sel.getRangeAt(0);
  if (!el.contains(r.startContainer)) return 0;
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(r.startContainer, r.startOffset);
  return pre.toString().length;
}

export function getSelectionOffsets(el: HTMLElement): [number, number] {
  const sel = getSel();
  if (!sel || !sel.rangeCount) return [0, 0];
  const r = sel.getRangeAt(0);
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(r.startContainer, r.startOffset);
  const start = pre.toString().length;
  return [start, start + r.toString().length];
}

/** Find text node + offset for a character offset. */
function locate(el: HTMLElement, offset: number): { node: Node; offset: number } {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let last: Node | null = null;
  while (walker.nextNode()) {
    const n = walker.currentNode as Text;
    // skip text inside non-editable atoms (mentions) – place caret after them
    const atom = (n.parentElement as HTMLElement | null)?.closest('[contenteditable="false"]');
    if (atom && el.contains(atom) && atom !== el) {
      const len = n.length;
      if (remaining <= len) {
        const parent = atom.parentNode!;
        const idx = Array.prototype.indexOf.call(parent.childNodes, atom);
        return { node: parent, offset: remaining === 0 ? idx : idx + 1 };
      }
      remaining -= len;
      last = n;
      continue;
    }
    if (remaining <= n.length) return { node: n, offset: remaining };
    remaining -= n.length;
    last = n;
  }
  if (last) {
    const atom = (last.parentElement as HTMLElement | null)?.closest('[contenteditable="false"]');
    if (atom && atom !== el) {
      const parent = atom.parentNode!;
      return { node: parent, offset: Array.prototype.indexOf.call(parent.childNodes, atom) + 1 };
    }
    return { node: last, offset: (last as Text).length };
  }
  return { node: el, offset: 0 };
}

export function setCaret(el: HTMLElement, pos: number | 'start' | 'end', end?: number) {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    el.focus({ preventScroll: true });
    const len = el.value.length;
    const p = pos === 'start' ? 0 : pos === 'end' ? len : Math.min(pos, len);
    el.setSelectionRange(p, end ?? p);
    return;
  }
  el.focus({ preventScroll: true });
  const sel = getSel();
  if (!sel) return;
  const r = document.createRange();
  if (pos === 'start') { r.selectNodeContents(el); r.collapse(true); }
  else if (pos === 'end') { r.selectNodeContents(el); r.collapse(false); }
  else {
    const a = locate(el, pos);
    r.setStart(a.node, a.offset);
    if (end !== undefined && end !== pos) { const b = locate(el, end); r.setEnd(b.node, b.offset); }
    else r.collapse(true);
  }
  sel.removeAllRanges();
  sel.addRange(r);
  scrollCaretIntoView();
}

export function scrollCaretIntoView() {
  const rect = caretRect();
  const sc = document.getElementById('main-scroll');
  if (!rect || !sc) return;
  const box = sc.getBoundingClientRect();
  if (rect.bottom > box.bottom - 40) sc.scrollTop += rect.bottom - box.bottom + 80;
  else if (rect.top < box.top + 40 && rect.top > 0) sc.scrollTop -= box.top - rect.top + 80;
}

export function caretRect(): DOMRect | null {
  const sel = getSel();
  if (!sel || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0).cloneRange();
  r.collapse(true);
  let rect = r.getClientRects()[0];
  if (!rect) {
    const node = r.startContainer as HTMLElement;
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (!el) return null;
    const b = el.getBoundingClientRect();
    rect = new DOMRect(b.left, b.top, 0, parseFloat(getComputedStyle(el).lineHeight) || b.height);
  }
  return rect;
}

export function isCaretAtStart(el: HTMLElement) {
  const sel = getSel();
  return !!sel && sel.isCollapsed && getCaretOffset(el) === 0;
}

export function isCaretAtEnd(el: HTMLElement) {
  const sel = getSel();
  return !!sel && sel.isCollapsed && getCaretOffset(el) === (el.textContent ?? '').length;
}

export function isCaretOnFirstLine(el: HTMLElement) {
  if (!(el.textContent ?? '').length) return true;
  const c = caretRect();
  if (!c) return true;
  const b = el.getBoundingClientRect();
  const lh = parseFloat(getComputedStyle(el).lineHeight) || 24;
  return c.top - b.top < lh * 0.9;
}

export function isCaretOnLastLine(el: HTMLElement) {
  if (!(el.textContent ?? '').length) return true;
  const c = caretRect();
  if (!c) return true;
  const b = el.getBoundingClientRect();
  const lh = parseFloat(getComputedStyle(el).lineHeight) || 24;
  return b.bottom - c.bottom < lh * 0.9;
}

/** Split an element's HTML at the caret into [before, after] HTML strings. */
export function splitAtCaret(el: HTMLElement): [string, string] {
  const sel = getSel();
  if (!sel || !sel.rangeCount) return [el.innerHTML, ''];
  const r = sel.getRangeAt(0);
  if (!r.collapsed) r.deleteContents();
  const before = document.createRange();
  before.selectNodeContents(el);
  before.setEnd(r.startContainer, r.startOffset);
  const after = document.createRange();
  after.selectNodeContents(el);
  after.setStart(r.startContainer, r.startOffset);
  const toHtml = (range: Range) => {
    const d = document.createElement('div');
    d.appendChild(range.cloneContents());
    return cleanHtml(d.innerHTML);
  };
  return [toHtml(before), toHtml(after)];
}

export function cleanHtml(html: string) {
  // remove empty formatting wrappers & trailing <br>
  let out = html.replace(/<(b|i|u|s|strike|code|span|a|em|strong)(\s[^>]*)?><\/\1>/g, '');
  if (out === '<br>') out = '';
  return out;
}

/** Text immediately before caret within the current text node. */
export function textBeforeCaret(): { node: Text; offset: number; text: string } | null {
  const sel = getSel();
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return null;
  const r = sel.getRangeAt(0);
  if (r.startContainer.nodeType !== Node.TEXT_NODE) return null;
  const node = r.startContainer as Text;
  return { node, offset: r.startOffset, text: node.data.slice(0, r.startOffset) };
}

/** Delete `count` chars before the caret in the current text node. */
export function deleteBeforeCaret(count: number) {
  const t = textBeforeCaret();
  if (!t) return;
  const start = Math.max(0, t.offset - count);
  t.node.deleteData(start, t.offset - start);
  const sel = getSel()!;
  const r = document.createRange();
  r.setStart(t.node, start);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}

/** Insert an HTML string (or node) at the caret and place caret after it. */
export function insertHtmlAtCaret(html: string | Node) {
  const sel = getSel();
  if (!sel || !sel.rangeCount) return;
  const r = sel.getRangeAt(0);
  r.deleteContents();
  let frag: DocumentFragment;
  if (typeof html === 'string') {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    frag = tpl.content;
  } else {
    frag = document.createDocumentFragment();
    frag.appendChild(html);
  }
  const last = frag.lastChild;
  r.insertNode(frag);
  if (last) {
    const after = document.createRange();
    after.setStartAfter(last);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
  }
}

export function selectionInside(el: HTMLElement) {
  const sel = getSel();
  return !!sel && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer);
}
