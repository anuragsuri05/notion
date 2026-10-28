import React, { useLayoutEffect, useRef, useState } from 'react';
import katex from 'katex';
import type { Block, BlockType } from '../store/types';
import { useStore } from '../store/store';
import { useEditor, SHORTCUT_TYPES, clipboardBlocks } from './Editor';
import {
  getCaretOffset, isCaretAtStart, isCaretAtEnd, isCaretOnFirstLine, isCaretOnLastLine, splitAtCaret, setCaret,
  caretRect, textBeforeCaret, getSel, cleanHtml, insertHtmlAtCaret,
} from './caret';
import { toggleMark, applyColor, lastColor, applyLink, selectionToEquation, wrapComment } from './formatting';
import { isToggleType, mod, newBlock, sanitizeInline, uid, cloneBlocks, htmlToText, escapeHtml, isEmptyHtml } from '../lib/util';
import { markdownToBlocks, htmlToBlocks, blocksToMarkdown } from '../lib/markdown';
import { goPage, navigate } from '../lib/router';
import { DateMentionPopover, EquationPopover, PastePopover } from './menus/InlinePopovers';

const PLACEHOLDERS: Partial<Record<BlockType, string>> = {
  h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3', h4: 'Heading 4', todo: 'To-do', bullet: 'List', numbered: 'List',
  toggle: 'Toggle', toggle_h1: 'Toggle heading 1', toggle_h2: 'Toggle heading 2', toggle_h3: 'Toggle heading 3', quote: 'Empty quote', callout: 'Type something…',
};

const LIST_TYPES: BlockType[] = ['bullet', 'numbered', 'todo', 'toggle'];

const BLOCK_MD: [RegExp, BlockType, Partial<Block>?][] = [
  [/^#\s$/, 'h1'], [/^##\s$/, 'h2'], [/^###\s$/, 'h3'], [/^####\s$/, 'h4'],
  [/^[-*+]\s$/, 'bullet'], [/^(1|a|i)\.\s$/, 'numbered'], [/^\[\]\s$/, 'todo'], [/^\[x\]\s$/i, 'todo', { checked: true }],
  [/^>\s$/, 'toggle'], [/^"\s$/, 'quote'], [/^```$/, 'code'], [/^\|\s$/, 'quote'],
];

const INLINE_MD: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/\*\*([^*]+)\*\*$/, (m) => `<b>${escapeHtml(m[1])}</b>`],
  [/__([^_]+)__$/, (m) => `<b>${escapeHtml(m[1])}</b>`],
  [/(?:^|[^*])\*([^*\s][^*]*)\*$/, (m) => `<i>${escapeHtml(m[1])}</i>`],
  [/(?:^|[^_\w])_([^_\s][^_]*)_$/, (m) => `<i>${escapeHtml(m[1])}</i>`],
  [/`([^`]+)`$/, (m) => `<code>${escapeHtml(m[1])}</code>`],
  [/~~([^~]+)~~$/, (m) => `<s>${escapeHtml(m[1])}</s>`],
  [/(?:^|[^~])~([^~\s][^~]*)~$/, (m) => `<s>${escapeHtml(m[1])}</s>`],
  [/\$\$([^$]+)\$\$$/, (m) => `<span class="inline-eq" contenteditable="false" data-tex="${escapeHtml(m[1])}">${escapeHtml(m[1])}</span>`],
];

const ARROWS: [RegExp, string][] = [[/->$/, '→'], [/<-$/, '←'], [/=>$/, '⇒'], [/--$/, '—'], [/\(c\)$/i, '©'], [/!=$/, '≠'], [/>=$/, '≥'], [/<=$/, '≤']];

export default function RichText({ block, className, placeholder, tag }: { block: Block; className?: string; placeholder?: string; tag?: 'div' | 'span' }) {
  const api = useEditor();
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [popover, setPopover] = useState<null | { kind: 'date' | 'eq'; el: HTMLElement } | { kind: 'paste'; url: string; rect: DOMRect }>(null);
  const users = useStore((s) => s.users);
  const pages = useStore((s) => s.pages);
  const readOnly = api.readOnly;

  // keep DOM in sync with store without clobbering the caret while typing
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (block.html !== lastEmitted.current && el.innerHTML !== block.html) {
      const hadFocus = document.activeElement === el;
      const off = hadFocus ? getCaretOffset(el) : 0;
      el.innerHTML = block.html;
      if (hadFocus) setCaret(el, Math.min(off, el.textContent?.length ?? 0));
    }
    lastEmitted.current = block.html;
    hydrateAtoms(el, pages, users);
  }, [block.html, pages, users]);

  const emit = () => {
    const el = ref.current!;
    let html = el.innerHTML;
    if (html === '<br>' || html === '<div><br></div>') { el.innerHTML = ''; html = ''; }
    html = cleanHtml(html);
    lastEmitted.current = html;
    api.ops.update(block.id, { html }, true);
  };

  const closeMenu = () => api.openMenu(null);

  const onInput = (e: React.FormEvent<HTMLDivElement>) => {
    const el = ref.current!;
    const ne = e.nativeEvent as InputEvent;
    const text = el.textContent ?? '';
    const caret = getCaretOffset(el);

    // block-level markdown shortcuts at the start of a plain block
    if (block.type === 'text' || (LIST_TYPES.includes(block.type) && caret <= 4)) {
      const head = text.slice(0, caret);
      for (const [re, type, extra] of BLOCK_MD) {
        if (re.test(head) && (block.type === 'text' || type !== block.type)) {
          if (block.type !== 'text' && !(type === 'todo' || type === 'bullet' || type === 'numbered')) continue;
          stripPrefix(el, head.length);
          const html = cleanHtml(el.innerHTML);
          lastEmitted.current = html;
          api.ops.update(block.id, { html, ...(extra ?? {}) });
          if (type === 'code') api.ops.update(block.id, { html: escapeHtml(htmlToText(html)) });
          api.ops.turnInto(block.id, type);
          api.focus(block.id, 'start');
          return;
        }
      }
      if (block.type === 'text' && text === '---') {
        api.ops.turnInto(block.id, 'divider');
        api.ops.update(block.id, { html: '' });
        const nb = newBlock();
        api.ops.insertAfter(block.id, [nb]);
        api.focus(nb.id, 'start');
        return;
      }
    }

    // inline markdown + typographic replacements
    if (ne.inputType === 'insertText' && ne.data) {
      const t = textBeforeCaret();
      if (t) {
        for (const [re, make] of INLINE_MD) {
          const m = t.text.match(re);
          if (m) {
            const full = m[0].startsWith('*') || m[0].startsWith('_') || m[0].startsWith('`') || m[0].startsWith('~') || m[0].startsWith('$') ? m[0] : m[0].slice(1);
            replaceBeforeCaret(full.length, make(m));
            insertHtmlAtCaret('​');
            break;
          }
        }
        for (const [re, rep] of ARROWS) {
          const m = t.text.match(re);
          if (m && ne.data === m[0].slice(-1)) { replaceBeforeCaret(m[0].length, rep); break; }
        }
      }
    }

    // inline menus
    if (ne.inputType === 'insertText' && ne.data === '/' && !api.menu) {
      api.openMenu({ kind: 'slash', blockId: block.id, start: caret - 1, trig: 1, query: '', rect: caretRect() ?? el.getBoundingClientRect() });
    } else if (ne.inputType === 'insertText' && ne.data === '@' && !api.menu) {
      api.openMenu({ kind: 'mention', blockId: block.id, start: caret - 1, trig: 1, query: '', rect: caretRect() ?? el.getBoundingClientRect() });
    } else if (ne.inputType === 'insertText' && ne.data === '[' && text.slice(caret - 2, caret) === '[[' && !api.menu) {
      api.openMenu({ kind: 'link', blockId: block.id, start: caret - 2, trig: 2, query: '', rect: caretRect() ?? el.getBoundingClientRect() });
    } else if (ne.inputType === 'insertText' && ne.data === '+' && (caret === 1 || /\s/.test(text[caret - 2] ?? '')) && !api.menu && block.type === 'text' && text.length === 1) {
      api.openMenu({ kind: 'link', blockId: block.id, start: caret - 1, trig: 1, query: '', rect: caretRect() ?? el.getBoundingClientRect() });
    } else if (api.menu && api.menu.blockId === block.id) {
      const m = api.menu;
      const q = text.slice(m.start + m.trig, caret);
      if (caret < m.start + m.trig || q.includes('\n') || q.length > 40 || (m.kind === 'slash' && /\s{2}/.test(q))) closeMenu();
      else api.updateMenuQuery(q);
    } else if (!api.menu && ne.inputType === 'insertText') {
      const m = text.slice(0, caret).match(/(?:^|\s):([a-z0-9_+-]{2,})$/i);
      if (m) api.openMenu({ kind: 'emoji', blockId: block.id, start: caret - m[1].length - 1, trig: 1, query: m[1], rect: caretRect() ?? el.getBoundingClientRect() });
    }
    emit();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current!;
    const ops = api.ops;
    if (api.menu && api.menu.blockId === block.id && api.menuKeyHandler.current?.(e)) return;
    if (e.nativeEvent.isComposing) return;
    const k = e.key;

    // formatting shortcuts
    if (mod(e) && !e.altKey) {
      const lk = k.toLowerCase();
      if (lk === 'b' && !e.shiftKey) { e.preventDefault(); toggleMark('bold'); return; }
      if (lk === 'i' && !e.shiftKey) { e.preventDefault(); toggleMark('italic'); return; }
      if (lk === 'u' && !e.shiftKey) { e.preventDefault(); toggleMark('underline'); return; }
      if (lk === 's' && e.shiftKey) { e.preventDefault(); toggleMark('strike'); return; }
      if (lk === 'e' && !e.shiftKey) { e.preventDefault(); toggleMark('code'); return; }
      if (lk === 'e' && e.shiftKey) { e.preventDefault(); selectionToEquation(); return; }
      if (lk === 'h' && e.shiftKey) { e.preventDefault(); if (lastColor) applyColor(lastColor.color, lastColor.kind); return; }
      if (lk === 'k' && !e.shiftKey) {
        e.preventDefault();
        if (!getSel()?.isCollapsed) window.dispatchEvent(new CustomEvent('moving:link'));
        return;
      }
      if (lk === 'm' && e.shiftKey) {
        e.preventDefault();
        const thread = uid();
        const quote = getSel()?.isCollapsed ? '' : wrapComment(thread);
        window.dispatchEvent(new CustomEvent('moving:comment', { detail: { pageId: api.pageId, blockId: block.id, threadId: thread, quote } }));
        return;
      }
      if (lk === 'z') { e.preventDefault(); emit(); if (e.shiftKey) api.redo(); else api.undo(); return; }
      if (lk === 'y') { e.preventDefault(); api.redo(); return; }
      if (lk === 'd' && !e.shiftKey) { e.preventDefault(); const [id] = ops.duplicate([block.id]); api.focus(id, 'end'); return; }
      if (k === '/') { e.preventDefault(); api.openBlockMenu(block.id, el.getBoundingClientRect()); return; }
      if (k === 'Enter') {
        e.preventDefault();
        if (block.type === 'todo') ops.update(block.id, { checked: !block.checked });
        else if (isToggleType(block.type)) ops.update(block.id, { open: !block.open });
        return;
      }
      if (e.shiftKey && (k === 'ArrowUp' || k === 'ArrowDown')) {
        e.preventDefault();
        const off = getCaretOffset(el);
        const { prev, next } = siblingsOf(ops.content(), block.id);
        if (k === 'ArrowUp' && prev) ops.move([block.id], prev.id, 'before');
        if (k === 'ArrowDown' && next) ops.move([block.id], next.id, 'after');
        api.focus(block.id, off);
        return;
      }
      if (lk === 'a' && !e.shiftKey) {
        const len = el.textContent?.length ?? 0;
        const sel = getSel();
        if (len === 0 || (sel && sel.toString().length >= len)) { e.preventDefault(); api.select(allIds(api)); }
        return;
      }
    }
    if (mod(e) && e.altKey && /^Digit[0-9]$/.test(e.nativeEvent.code)) {
      e.preventDefault();
      const t = SHORTCUT_TYPES[+e.nativeEvent.code.slice(5)];
      if (t === 'page') { const pid = ops.turnIntoPage(block.id); if (pid) goPage(pid); }
      else { ops.turnInto(block.id, t); api.focus(block.id, getCaretOffset(el)); }
      return;
    }
    if (mod(e) && e.altKey && e.nativeEvent.code === 'KeyT') {
      e.preventDefault();
      let anyClosed = false;
      const walk = (l: Block[]) => l.forEach((b) => { if (isToggleType(b.type) && !b.open) anyClosed = true; if (b.children) walk(b.children); });
      walk(ops.content());
      ops.setAllToggles(anyClosed);
      return;
    }

    if (k === 'Escape') {
      e.preventDefault();
      if (api.menu) { closeMenu(); return; }
      api.select([block.id]);
      return;
    }

    if (k === ' ' && block.type === 'text' && (el.textContent ?? '') === '' && !readOnly) {
      e.preventDefault();
      api.openAI(block.id);
      return;
    }

    if (k === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = el.textContent ?? '';
      // empty list item → outdent or convert to text
      if (LIST_TYPES.includes(block.type) && !text && !block.children?.length) {
        if (!ops.outdent(block.id)) ops.turnInto(block.id, 'text');
        api.focus(block.id, 'start');
        return;
      }
      if (block.type === 'quote' || block.type === 'callout') {
        if (isCaretAtEnd(el) && text.endsWith('\n')) { /* fallthrough to new block */ }
      }
      const atStart = isCaretAtStart(el) && text.length > 0;
      if (atStart) {
        const nb = newBlock(LIST_TYPES.includes(block.type) ? block.type : 'text');
        ops.insertBefore(block.id, [nb]);
        api.focus(block.id, 'start');
        return;
      }
      const [before, after] = splitAtCaret(el);
      el.innerHTML = before;
      lastEmitted.current = before;
      const nextType: BlockType = LIST_TYPES.includes(block.type) ? block.type : 'text';
      const nb = newBlock(nextType, { html: after, ...(block.type === 'toggle' ? { open: false } : {}) });
      ops.mutate((d) => {
        const l = findIn(d, block.id);
        if (!l) return;
        const cur = l.list[l.index];
        cur.html = before;
        const childFirst = (isToggleType(cur.type) && cur.open) || (cur.children?.length && !isToggleType(cur.type) && cur.type !== 'callout');
        if (childFirst) (cur.children ??= []).unshift(nb);
        else l.list.splice(l.index + 1, 0, nb);
      });
      api.focus(nb.id, 'start');
      return;
    }

    if (k === 'Enter' && e.shiftKey && block.type !== 'code') {
      e.preventDefault();
      insertHtmlAtCaret('<br>');
      // ensure caret can sit after a trailing <br>
      if (isCaretAtEnd(el)) insertHtmlAtCaret('​');
      emit();
      return;
    }

    if (k === 'Backspace' && getSel()?.isCollapsed && isCaretAtStart(el)) {
      e.preventDefault();
      if (block.type !== 'text') {
        if (LIST_TYPES.includes(block.type) && api.ops.outdent(block.id)) { api.focus(block.id, 'start'); return; }
        ops.turnInto(block.id, 'text');
        api.focus(block.id, 'start');
        return;
      }
      if (ops.outdent(block.id)) { api.focus(block.id, 'start'); return; }
      const prev = ops.prevText(block.id, api.rootId);
      const { prev: visualPrev } = ops.neighbors(block.id, api.rootId);
      if (visualPrev && visualPrev.id !== prev?.id && visualPrev.type !== 'column' && visualPrev.type !== 'columns' && !(visualPrev.children?.some((c) => c.id === block.id))) {
        // previous block is a non-text block (image, divider…)
        if (!el.textContent) { ops.remove([block.id]); }
        api.select([visualPrev.id]);
        return;
      }
      if (!prev) return;
      if (prev.type === 'code' || prev.type === 'equation') { api.focus(prev.id, 'end'); return; }
      const prevLen = htmlToText(prev.html).length;
      const html = el.innerHTML;
      ops.mutate((d) => {
        const pl = findIn(d, prev.id);
        const cl = findIn(d, block.id);
        if (!pl || !cl) return;
        const p = pl.list[pl.index];
        const c = cl.list[cl.index];
        p.html = cleanHtml((p.html || '') + html);
        cl.list.splice(cl.index, 1);
        if (c.children?.length) (p.children ??= []).push(...c.children);
      });
      api.focus(prev.id, prevLen);
      return;
    }

    if (k === 'Delete' && getSel()?.isCollapsed && isCaretAtEnd(el)) {
      const next = ops.nextText(block.id, api.rootId);
      if (next && next.type !== 'code' && next.type !== 'equation') {
        e.preventDefault();
        const len = el.textContent?.length ?? 0;
        ops.mutate((d) => {
          const cl = findIn(d, block.id);
          const nl = findIn(d, next.id);
          if (!cl || !nl) return;
          cl.list[cl.index].html = cleanHtml(cl.list[cl.index].html + nl.list[nl.index].html);
          const n = nl.list.splice(nl.index, 1)[0];
          if (n.children?.length) (cl.list[cl.index].children ??= []).push(...n.children);
        });
        api.focus(block.id, len);
      }
      return;
    }

    if (k === 'Tab') {
      e.preventDefault();
      const off = getCaretOffset(el);
      emit();
      if (e.shiftKey) ops.outdent(block.id); else ops.indent(block.id);
      api.focus(block.id, off);
      return;
    }

    if (k === 'ArrowUp' && !e.shiftKey && isCaretOnFirstLine(el)) {
      const prev = ops.prevText(block.id, api.rootId);
      if (prev) { e.preventDefault(); api.focus(prev.id, 'end'); }
      else if (api.exitTop) { e.preventDefault(); api.exitTop(); }
      return;
    }
    if (k === 'ArrowDown' && !e.shiftKey && isCaretOnLastLine(el)) {
      const next = ops.nextText(block.id, api.rootId);
      if (next) { e.preventDefault(); api.focus(next.id, 'start'); }
      return;
    }
    if (k === 'ArrowLeft' && !e.shiftKey && isCaretAtStart(el)) {
      const prev = ops.prevText(block.id, api.rootId);
      if (prev) { e.preventDefault(); api.focus(prev.id, 'end'); }
      return;
    }
    if (k === 'ArrowRight' && !e.shiftKey && isCaretAtEnd(el)) {
      const next = ops.nextText(block.id, api.rootId);
      if (next) { e.preventDefault(); api.focus(next.id, 'start'); }
      return;
    }
    if ((k === 'ArrowUp' || k === 'ArrowDown') && e.shiftKey) {
      // extend into block selection when selection already spans the whole block
      const len = el.textContent?.length ?? 0;
      const sel = getSel();
      if (sel && (len === 0 || sel.toString().length >= len || (k === 'ArrowUp' ? isCaretOnFirstLine(el) && isCaretAtStart(el) : isCaretOnLastLine(el) && isCaretAtEnd(el)))) {
        e.preventDefault();
        const nb = k === 'ArrowUp' ? ops.neighbors(block.id, api.rootId).prev : ops.neighbors(block.id, api.rootId).next;
        api.select(nb && nb.type !== 'column' && nb.type !== 'columns' ? [block.id, nb.id] : [block.id]);
      }
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (readOnly) return;
    const cd = e.clipboardData;
    const text = cd.getData('text/plain');
    const html = cd.getData('text/html');
    const files = Array.from(cd.files ?? []);
    const ops = api.ops;
    if (files.length && files[0].type.startsWith('image/')) {
      e.preventDefault();
      const r = new FileReader();
      r.onload = () => {
        const b = newBlock('image', { url: r.result as string, name: files[0].name });
        if (!ref.current?.textContent) { ops.mutate((d) => { const l = findIn(d, block.id); if (l) l.list[l.index] = { ...b, id: block.id }; }); }
        else ops.insertAfter(block.id, [b]);
      };
      r.readAsDataURL(files[0]);
      return;
    }
    // our own copied blocks
    if (clipboardBlocks && text && blocksToMarkdown(clipboardBlocks, (id) => useStore.getState().pages[id]?.title || 'Untitled') === text) {
      e.preventDefault();
      const copies = cloneBlocks(JSON.parse(JSON.stringify(clipboardBlocks)));
      insertBlocks(copies);
      return;
    }
    const sel = getSel();
    const url = text.trim();
    if (/^https?:\/\/\S+$/.test(url)) {
      e.preventDefault();
      if (sel && !sel.isCollapsed) { applyLink(url); return; }
      insertHtmlAtCaret(`<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`);
      emit();
      setPopover({ kind: 'paste', url, rect: caretRect() ?? ref.current!.getBoundingClientRect() });
      return;
    }
    if (block.type === 'code') return;
    // multi-line → blocks
    let blocks: ReturnType<typeof markdownToBlocks> | null = null;
    if (html && /<(p|h[1-6]|li|ul|ol|blockquote|pre|table|div)\b/i.test(html) && !html.includes('data-moving')) {
      blocks = htmlToBlocks(html);
      if (blocks.length === 1 && blocks[0].type === 'text') {
        e.preventDefault();
        insertHtmlAtCaret(sanitizeInline(blocks[0].html));
        emit();
        return;
      }
    } else if (text.includes('\n')) blocks = markdownToBlocks(text);
    if (blocks && blocks.length) {
      e.preventDefault();
      insertBlocks(blocks);
      return;
    }
    e.preventDefault();
    if (html && !text.includes('\n')) insertHtmlAtCaret(sanitizeInline(html.replace(/<!--[\s\S]*?-->/g, '').replace(/<\/?(meta|html|body|head)[^>]*>/gi, '')));
    else insertHtmlAtCaret(escapeHtml(text));
    emit();
  };

  const insertBlocks = (blocks: Block[]) => {
    const ops = api.ops;
    const el = ref.current!;
    const empty = isEmptyHtml(el.innerHTML);
    if (empty && block.type === 'text') {
      const [first, ...rest] = blocks;
      ops.mutate((d) => {
        const l = findIn(d, block.id);
        if (!l) return;
        l.list.splice(l.index, 1, { ...first, id: block.id }, ...rest);
      });
    } else ops.insertAfter(block.id, blocks);
    const last = blocks[blocks.length - 1];
    api.focus(blocks.length === 1 && empty ? block.id : last.id, 'end');
  };

  const onClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const pageEl = t.closest('[data-page]') as HTMLElement | null;
    if (pageEl) { e.preventDefault(); goPage(pageEl.dataset.page!); return; }
    const a = t.closest('a') as HTMLAnchorElement | null;
    if (a) {
      const href = a.getAttribute('href') ?? '';
      e.preventDefault();
      if (href.startsWith('#/')) navigate(href.slice(1));
      else if (href) window.open(href, '_blank', 'noopener');
      return;
    }
    const dateEl = t.closest('[data-date]') as HTMLElement | null;
    if (dateEl && !readOnly) { setPopover({ kind: 'date', el: dateEl }); return; }
    const eqEl = t.closest('[data-tex]') as HTMLElement | null;
    if (eqEl && !readOnly) { setPopover({ kind: 'eq', el: eqEl }); return; }
    const userEl = t.closest('[data-user]') as HTMLElement | null;
    if (userEl) return;
    const cm = t.closest('[data-comment]') as HTMLElement | null;
    if (cm) window.dispatchEvent(new CustomEvent('moving:open-thread', { detail: { threadId: cm.dataset.comment } }));
  };

  const Tag = (tag ?? 'div') as 'div';
  const ph = placeholder ?? (block.type === 'text' ? (focused ? "Write, press 'space' for AI, '/' for commands…" : '') : PLACEHOLDERS[block.type] ?? '');

  return (
    <>
      <Tag
        ref={ref}
        className={'rt ' + (className ?? '')}
        data-rt={block.id}
        data-placeholder={ph}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        spellCheck={useStore.getState().settings.spellcheck}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onClick={onClick}
        onFocus={() => { setFocused(true); api.focusedId.current = block.id; if (api.selected.size) api.clearSelection(); }}
        onBlur={() => { setFocused(false); if (api.menu?.blockId === block.id) setTimeout(() => { if (!document.querySelector('.popover')) closeMenu(); }, 150); }}
      />
      {popover?.kind === 'date' && <DateMentionPopover el={popover.el} onClose={() => { setPopover(null); emit(); }} pageId={api.pageId} />}
      {popover?.kind === 'eq' && <EquationPopover el={popover.el} onClose={() => { setPopover(null); emit(); }} />}
      {popover?.kind === 'paste' && <PastePopover url={popover.url} rect={popover.rect} blockId={block.id} onClose={() => setPopover(null)} />}
    </>
  );
}

function stripPrefix(el: HTMLElement, n: number) {
  setCaret(el, 0, n);
  const sel = getSel();
  sel?.getRangeAt(0).deleteContents();
}

function replaceBeforeCaret(count: number, html: string) {
  const t = textBeforeCaret();
  if (!t) return;
  const r = document.createRange();
  r.setStart(t.node, Math.max(0, t.offset - count));
  r.setEnd(t.node, t.offset);
  const sel = getSel()!;
  sel.removeAllRanges();
  sel.addRange(r);
  insertHtmlAtCaret(html);
}

function findIn(d: Block[], id: string): { list: Block[]; index: number } | null {
  for (let i = 0; i < d.length; i++) {
    if (d[i].id === id) return { list: d, index: i };
    if (d[i].children) { const r = findIn(d[i].children!, id); if (r) return r; }
    if (d[i].tabs) for (const t of d[i].tabs!) { const r = findIn(t.children, id); if (r) return r; }
  }
  return null;
}

function siblingsOf(d: Block[], id: string) {
  const l = findIn(d, id);
  if (!l) return { prev: null, next: null };
  return { prev: l.list[l.index - 1] ?? null, next: l.list[l.index + 1] ?? null };
}

function allIds(api: ReturnType<typeof useEditor>) {
  const list = api.rootId ? api.ops.block(api.rootId)?.children ?? [] : api.ops.content();
  return list.map((b) => b.id);
}

/** Render live titles / math / dates inside non-editable inline atoms. */
function hydrateAtoms(el: HTMLElement, pages: Record<string, any>, users: Record<string, any>) {
  el.querySelectorAll<HTMLElement>('span[data-page], a[data-page].mention').forEach((s) => {
    if (s.tagName === 'A' && !s.classList.contains('mention')) return;
    const p = pages[s.dataset.page!];
    const title = p ? (p.title || 'Untitled') : 'Deleted page';
    const icon = p?.icon && !p.icon.startsWith('data:') && !p.icon.startsWith('http') ? p.icon : '📄';
    const html = `<span class="mention-icon">${icon}</span><span class="mention-title">${escapeHtml(title)}</span>`;
    if (s.innerHTML !== html) s.innerHTML = html;
    s.classList.toggle('deleted', !p || !!p.trashedAt);
  });
  el.querySelectorAll<HTMLElement>('span[data-user]').forEach((s) => {
    const u = users[s.dataset.user!];
    const t = `@${u?.name ?? 'Unknown'}`;
    if (s.textContent !== t) s.textContent = t;
  });
  el.querySelectorAll<HTMLElement>('span[data-date]').forEach((s) => {
    const pretty = '@' + prettyDate(s.dataset.date!, s.dataset.time === '1');
    if (s.textContent !== pretty) s.textContent = pretty;
  });
  el.querySelectorAll<HTMLElement>('span[data-tex]').forEach((s) => {
    const tex = s.dataset.tex ?? '';
    if (s.dataset.rendered === tex) return;
    try { katex.render(tex || '\\text{New equation}', s, { throwOnError: false }); } catch { s.textContent = tex; }
    s.dataset.rendered = tex;
  });
}

export function prettyDate(iso: string, time: boolean) {
  const d = iso.length > 10 ? new Date(iso) : (() => { const [y, m, dd] = iso.split('-').map(Number); return new Date(y, m - 1, dd); })();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 864e5);
  let s = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  if (time) s += ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return s;
}

