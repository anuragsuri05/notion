import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/store';
import type { Block, BlockType } from '../store/types';
import { findLoc, isTextType, mod, newBlock, flattenVisible, cloneBlocks, htmlToText } from '../lib/util';
import { PageOps, type DropWhere, type FocusPos } from './ops';
import * as history from './history';
import { setCaret, caretRect, getCaretOffset } from './caret';
import BlockList from './BlockList';
import SlashMenu from './menus/SlashMenu';
import MentionMenu from './menus/MentionMenu';
import EmojiInlineMenu from './menus/EmojiInlineMenu';
import InlineToolbar from './menus/InlineToolbar';
import BlockMenu from './menus/BlockMenu';
import AIInline from './menus/AIInline';
import { blocksToMarkdown } from '../lib/markdown';

export type InlineMenuKind = 'slash' | 'mention' | 'link' | 'emoji' | 'date' | 'person';
/** start = offset of the first char to delete on select; trig = length of the trigger text ("/", "[["…). */
export interface InlineMenu { kind: InlineMenuKind; blockId: string; start: number; trig: number; query: string; rect: DOMRect; }

export interface EditorAPI {
  ops: PageOps;
  pageId: string;
  readOnly: boolean;
  rootId?: string;
  focus(id: string, pos?: FocusPos): void;
  selected: Set<string>;
  select(ids: string[]): void;
  clearSelection(): void;
  menu: InlineMenu | null;
  openMenu(m: InlineMenu | null): void;
  updateMenuQuery(q: string): void;
  menuKeyHandler: React.MutableRefObject<((e: React.KeyboardEvent | KeyboardEvent) => boolean) | null>;
  openBlockMenu(id: string, anchor: HTMLElement | DOMRect): void;
  openAI(blockId: string, mode?: string): void;
  drag: DragState | null;
  setDrag(d: DragState | null): void;
  undo(): void;
  redo(): void;
  exitTop?(): void;
  focusedId: React.MutableRefObject<string | null>;
}

export interface DragState { ids: string[]; overId?: string; where?: DropWhere; }

const Ctx = createContext<EditorAPI | null>(null);
export const useEditor = () => useContext(Ctx)!;

export default function Editor({ pageId, readOnly = false, rootId, exitTop, compact }: { pageId: string; readOnly?: boolean; rootId?: string; exitTop?: () => void; compact?: boolean }) {
  const content = useStore((s) => s.pages[pageId]?.content);
  const list = useMemo(() => {
    if (!content) return [];
    if (rootId) return findLoc(content, rootId)?.list[findLoc(content, rootId)!.index].children ?? [];
    return content;
  }, [content, rootId]);
  const ops = useMemo(() => new PageOps(pageId), [pageId]);
  const rootRef = useRef<HTMLDivElement>(null);
  const focusReq = useRef<{ id: string; pos: FocusPos } | null>(null);
  const focusedId = useRef<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<InlineMenu | null>(null);
  const [blockMenu, setBlockMenu] = useState<{ id: string; anchor: HTMLElement | DOMRect } | null>(null);
  const [ai, setAI] = useState<{ blockId: string; mode?: string } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const menuKeyHandler = useRef<((e: React.KeyboardEvent | KeyboardEvent) => boolean) | null>(null);

  const focus = useCallback((id: string, pos: FocusPos = 'end') => {
    focusReq.current = { id, pos };
    setSelected((s) => (s.size ? new Set() : s));
    // apply immediately if element already exists (no re-render pending)
    requestAnimationFrame(() => applyFocus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFocus = () => {
    const req = focusReq.current;
    if (!req || !rootRef.current) return;
    const el = rootRef.current.querySelector<HTMLElement>(`[data-rt="${req.id}"]`);
    if (!el) return;
    focusReq.current = null;
    setCaret(el, req.pos);
  };

  useLayoutEffect(() => { applyFocus(); });

  const api: EditorAPI = useMemo(() => ({
    ops, pageId, readOnly, rootId, focus, selected,
    select: (ids) => { setSelected(new Set(ids)); (document.activeElement as HTMLElement)?.blur?.(); window.getSelection()?.removeAllRanges(); rootRef.current?.focus({ preventScroll: true }); },
    clearSelection: () => setSelected(new Set()),
    menu,
    openMenu: setMenu,
    updateMenuQuery: (q) => setMenu((m) => (m ? { ...m, query: q } : m)),
    menuKeyHandler,
    openBlockMenu: (id, anchor) => setBlockMenu({ id, anchor }),
    openAI: (blockId, mode) => setAI({ blockId, mode }),
    drag, setDrag,
    undo: () => {
      const prev = history.undo(pageId, ops.content());
      if (prev) { useStore.getState().setContent(pageId, prev); }
    },
    redo: () => {
      const next = history.redo(pageId, ops.content());
      if (next) useStore.getState().setContent(pageId, next);
    },
    exitTop,
    focusedId,
  }), [ops, pageId, readOnly, rootId, focus, selected, menu, drag, exitTop]);

  // keyboard handling while blocks are selected
  useEffect(() => {
    if (!selected.size || readOnly) return;
    const key = (e: KeyboardEvent) => {
      if (document.querySelector('.popover, .modal-overlay')) return;
      const ids = orderedSelection(ops, selected);
      const k = e.key;
      if (k === 'Escape') { e.preventDefault(); setSelected(new Set()); return; }
      if (k === 'Backspace' || k === 'Delete') {
        e.preventDefault();
        const prev = ops.prevText(ids[0], rootId);
        ops.remove(ids);
        setSelected(new Set());
        if (prev) focus(prev.id, 'end');
        return;
      }
      if (k === 'Enter' && !mod(e)) {
        e.preventDefault();
        const b = ops.block(ids[ids.length - 1]);
        if (b && (isTextType(b.type))) focus(b.id, 'end');
        setSelected(new Set());
        return;
      }
      if (mod(e) && k.toLowerCase() === 'd') { e.preventDefault(); setSelected(new Set(ops.duplicate(ids))); return; }
      if (mod(e) && k === '/') { e.preventDefault(); const el = rootRef.current?.querySelector(`[data-block="${ids[0]}"]`); if (el) setBlockMenu({ id: ids[0], anchor: el.getBoundingClientRect() }); return; }
      if (mod(e) && e.shiftKey && (k === 'ArrowUp' || k === 'ArrowDown')) {
        e.preventDefault();
        moveSelection(ops, ids, k === 'ArrowUp' ? -1 : 1, rootId);
        return;
      }
      if (k === 'ArrowUp' || k === 'ArrowDown') {
        e.preventDefault();
        const flat = flattenVisible(rootId ? ops.block(rootId)?.children ?? [] : ops.content()).filter((b) => b.type !== 'column' && b.type !== 'columns');
        const idx = flat.findIndex((b) => b.id === (k === 'ArrowUp' ? ids[0] : ids[ids.length - 1]));
        const nb = flat[idx + (k === 'ArrowUp' ? -1 : 1)];
        if (nb) setSelected(e.shiftKey ? new Set([...ids, nb.id]) : new Set([nb.id]));
        return;
      }
      if (mod(e) && k.toLowerCase() === 'a') { e.preventDefault(); setSelected(new Set(list.map((b) => b.id))); return; }
      if (mod(e) && (k.toLowerCase() === 'c' || k.toLowerCase() === 'x')) {
        const blocks = ids.map((id) => ops.block(id)).filter(Boolean) as Block[];
        const md = blocksToMarkdown(blocks, (id) => useStore.getState().pages[id]?.title || 'Untitled');
        clipboardBlocks = blocks;
        navigator.clipboard.writeText(md).catch(() => {});
        if (k.toLowerCase() === 'x') { ops.remove(ids); setSelected(new Set()); }
        e.preventDefault();
        return;
      }
      if (mod(e) && k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? api.redo() : api.undo(); return; }
      if (mod(e) && e.altKey && /^Digit[0-9]$/.test(e.code)) {
        e.preventDefault();
        const t = SHORTCUT_TYPES[+e.code.slice(5)];
        ids.forEach((id) => ops.turnInto(id, t));
        return;
      }
      if (k === 'Tab') { e.preventDefault(); ids.forEach((id) => (e.shiftKey ? ops.outdent(id) : ops.indent(id))); }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [selected, ops, readOnly, rootId, list, focus, api]);

  // clear selection on outside click
  useEffect(() => {
    if (!selected.size) return;
    const down = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('.popover') || t.closest('.block-handle')) return;
      setSelected(new Set());
    };
    document.addEventListener('mousedown', down);
    return () => document.removeEventListener('mousedown', down);
  }, [selected]);

  // marquee selection
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const onMouseDown = (e: React.MouseEvent) => {
    if (readOnly || e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest('[contenteditable="true"], input, textarea, button, a, .block-handle, .db, .popover, .media, .code-editor, iframe, video, audio, .table-block, .resize-handle')) return;
    // allow marquee starting from page margins
    const x0 = e.clientX, y0 = e.clientY;
    let started = false;
    const move = (ev: MouseEvent) => {
      if (!started && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
      if (!started) { started = true; window.getSelection()?.removeAllRanges(); (document.activeElement as HTMLElement)?.blur?.(); }
      ev.preventDefault();
      const box = { x0: Math.min(x0, ev.clientX), y0: Math.min(y0, ev.clientY), x1: Math.max(x0, ev.clientX), y1: Math.max(y0, ev.clientY) };
      setMarquee(box);
      const hits: string[] = [];
      rootRef.current?.querySelectorAll<HTMLElement>('[data-block]').forEach((el) => {
        if (el.dataset.blocktype === 'column' || el.dataset.blocktype === 'columns') return;
        const r = el.querySelector(':scope > .block-content')?.getBoundingClientRect() ?? el.getBoundingClientRect();
        if (r.bottom > box.y0 && r.top < box.y1 && r.right > box.x0 && r.left < box.x1) {
          // avoid selecting children when parent selected
          const parent = el.parentElement?.closest('[data-block]') as HTMLElement | null;
          if (!parent || !hits.includes(parent.dataset.block!)) hits.push(el.dataset.block!);
        }
      });
      setSelected(new Set(hits));
    };
    const up = () => { setMarquee(null); document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  // clicking the empty area under the content focuses or creates the last block
  const onClickBottom = () => {
    if (readOnly) return;
    const last = list[list.length - 1];
    if (last && last.type === 'text' && !last.html && !last.children?.length) focus(last.id, 'end');
    else {
      const b = newBlock();
      if (rootId) ops.append([b], rootId); else ops.append([b]);
      focus(b.id, 'start');
    }
  };

  // paste of copied blocks while blocks are selected / onto page
  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      if (!selected.size || readOnly) return;
      const text = e.clipboardData?.getData('text/plain') ?? '';
      if (clipboardBlocks && blocksToMarkdown(clipboardBlocks, (id) => useStore.getState().pages[id]?.title || 'Untitled') === text) {
        e.preventDefault();
        const ids = orderedSelection(ops, selected);
        ops.insertAfter(ids[ids.length - 1], cloneBlocks(JSON.parse(JSON.stringify(clipboardBlocks))));
      }
    };
    document.addEventListener('paste', paste);
    return () => document.removeEventListener('paste', paste);
  }, [selected, ops, readOnly]);

  return (
    <Ctx.Provider value={api}>
      <div ref={rootRef} className={'editor' + (compact ? ' compact' : '') + (readOnly ? ' readonly' : '')} tabIndex={-1} onMouseDown={onMouseDown} style={{ outline: 'none' }}>
        <BlockList blocks={list} depth={0} />
        {!rootId && !readOnly && <div className="editor-bottom" onClick={onClickBottom} />}
      </div>
      {marquee && <div className="marquee" style={{ left: marquee.x0, top: marquee.y0, width: marquee.x1 - marquee.x0, height: marquee.y1 - marquee.y0 }} />}
      {menu?.kind === 'slash' && <SlashMenu menu={menu} />}
      {(menu?.kind === 'mention' || menu?.kind === 'link' || menu?.kind === 'date' || menu?.kind === 'person') && <MentionMenu menu={menu} />}
      {menu?.kind === 'emoji' && <EmojiInlineMenu menu={menu} />}
      {!readOnly && <InlineToolbar rootRef={rootRef} />}
      {blockMenu && <BlockMenu id={blockMenu.id} anchor={blockMenu.anchor} onClose={() => setBlockMenu(null)} />}
      {ai && <AIInline blockId={ai.blockId} mode={ai.mode} onClose={() => setAI(null)} />}
    </Ctx.Provider>
  );
}

export let clipboardBlocks: Block[] | null = null;
export function setClipboardBlocks(b: Block[] | null) { clipboardBlocks = b; }

export const SHORTCUT_TYPES: BlockType[] = ['text', 'h1', 'h2', 'h3', 'todo', 'bullet', 'numbered', 'toggle', 'code', 'page'];

export function orderedSelection(ops: PageOps, selected: Set<string>): string[] {
  const flat = flattenVisible(ops.content());
  return flat.filter((b) => selected.has(b.id)).map((b) => b.id);
}

function moveSelection(ops: PageOps, ids: string[], dir: -1 | 1, rootId?: string) {
  const first = ops.block(ids[0]);
  if (!first) return;
  const loc = findLoc(ops.content(), dir < 0 ? ids[0] : ids[ids.length - 1]);
  if (!loc) return;
  const sibling = loc.list[loc.index + dir];
  if (sibling) ops.move(ids, sibling.id, dir < 0 ? 'before' : 'after');
  void rootId;
}

/** Utility for menus: caret rect fallback. */
export function currentCaretRect(): DOMRect {
  return caretRect() ?? new DOMRect(window.innerWidth / 2, 200, 0, 20);
}

export function caretOffsetIn(el: HTMLElement) { return getCaretOffset(el); }
export { htmlToText };
