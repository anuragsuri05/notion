// Structural block operations for one page. All mutations go through the store
// (immer drafts) and record undo history.
import { useStore } from '../store/store';
import type { Block, BlockType } from '../store/types';
import { cloneBlocks, findLoc, flattenVisible, isTextType, isToggleType, newBlock, uid, walkBlocks, htmlToText } from '../lib/util';
import * as history from './history';

export type FocusPos = 'start' | 'end' | number;
export type DropWhere = 'before' | 'after' | 'inside' | 'left' | 'right';

export class PageOps {
  constructor(public pageId: string) {}

  content(): Block[] {
    return useStore.getState().pages[this.pageId]?.content ?? [];
  }

  block(id: string): Block | null {
    const l = findLoc(this.content(), id);
    return l ? l.list[l.index] : null;
  }

  /** Apply a structural change with an undo point. */
  mutate(fn: (draft: Block[]) => void, typingBlockId?: string) {
    const before = this.content();
    history.record(this.pageId, before, typingBlockId);
    useStore.getState().mutateContent(this.pageId, (draft) => {
      fn(draft);
      if (!typingBlockId) normalize(draft);
    });
  }

  update(id: string, patch: Partial<Block>, typing = false) {
    this.mutate((d) => {
      const l = findLoc(d, id);
      if (l) Object.assign(l.list[l.index], patch);
    }, typing ? id : undefined);
  }

  /** Insert blocks after `afterId` (or at the start of `parentId`'s children / page root when afterId null). */
  insertAfter(afterId: string | null, blocks: Block[], parentId?: string) {
    this.mutate((d) => {
      if (afterId) {
        const l = findLoc(d, afterId);
        if (l) { l.list.splice(l.index + 1, 0, ...blocks); return; }
      }
      if (parentId) {
        const p = findLoc(d, parentId);
        if (p) { const pb = p.list[p.index]; (pb.children ??= []).unshift(...blocks); return; }
      }
      d.unshift(...blocks);
    });
  }

  insertBefore(beforeId: string, blocks: Block[]) {
    this.mutate((d) => {
      const l = findLoc(d, beforeId);
      if (l) l.list.splice(l.index, 0, ...blocks);
    });
  }

  append(blocks: Block[], rootId?: string) {
    this.mutate((d) => {
      if (rootId) {
        const l = findLoc(d, rootId);
        if (l) { (l.list[l.index].children ??= []).push(...blocks); return; }
      }
      d.push(...blocks);
    });
  }

  remove(ids: string[]) {
    this.mutate((d) => {
      for (const id of ids) {
        const l = findLoc(d, id);
        if (l) l.list.splice(l.index, 1);
      }
      if (!d.length) d.push(newBlock());
    });
  }

  turnInto(id: string, type: BlockType) {
    this.mutate((d) => {
      const l = findLoc(d, id);
      if (!l) return;
      const b = l.list[l.index];
      const prevType = b.type;
      b.type = type;
      if (type === 'callout' && !b.icon) { b.icon = '💡'; b.bg = b.bg ?? 'gray'; }
      if (type === 'code') { b.language ??= 'plain text'; b.html = htmlToText(b.html).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
      if (isToggleType(type) && b.open === undefined) b.open = true;
      if (prevType === 'todo' && type !== 'todo') delete b.checked;
      if (type === 'equation') b.html = htmlToText(b.html);
    });
  }

  duplicate(ids: string[]): string[] {
    const newIds: string[] = [];
    this.mutate((d) => {
      // duplicate in reverse document order so indexes stay valid
      for (const id of [...ids].reverse()) {
        const l = findLoc(d, id);
        if (!l) continue;
        const [copy] = cloneBlocks([JSON.parse(JSON.stringify(l.list[l.index]))]);
        l.list.splice(l.index + 1, 0, copy);
        newIds.unshift(copy.id);
      }
    });
    return newIds;
  }

  indent(id: string): boolean {
    let ok = false;
    this.mutate((d) => {
      const l = findLoc(d, id);
      if (!l || l.index === 0) return;
      const prev = l.list[l.index - 1];
      if (!canHaveChildren(prev)) return;
      const [b] = l.list.splice(l.index, 1);
      (prev.children ??= []).push(b);
      if (isToggleType(prev.type)) prev.open = true;
      ok = true;
    });
    return ok;
  }

  outdent(id: string): boolean {
    let ok = false;
    this.mutate((d) => {
      const l = findLoc(d, id);
      if (!l || !l.parent || l.parent.type === 'column' || l.parent.type === 'tabs' || l.parent.type === 'synced' || l.parent.type === 'callout') return;
      const parentLoc = findLoc(d, l.parent.id);
      if (!parentLoc) return;
      const [b] = l.list.splice(l.index, 1);
      // following siblings become children of the outdented block (Notion behaviour)
      const rest = l.list.splice(l.index);
      if (rest.length) (b.children ??= []).push(...rest);
      parentLoc.list.splice(parentLoc.index + 1, 0, b);
      ok = true;
    });
    return ok;
  }

  move(ids: string[], targetId: string, where: DropWhere) {
    if (ids.includes(targetId)) return;
    this.mutate((d) => {
      // don't move a block into its own subtree
      for (const id of ids) {
        const l = findLoc(d, id);
        if (l && findLoc(l.list[l.index].children ?? [], targetId)) return;
      }
      const moving: Block[] = [];
      for (const id of ids) {
        const l = findLoc(d, id);
        if (l) moving.push(...l.list.splice(l.index, 1));
      }
      insertAt(d, targetId, where, moving);
    });
  }

  /** Move blocks out of this page and into another page (append). */
  moveToPage(ids: string[], targetPageId: string) {
    if (targetPageId === this.pageId) return;
    const moving: Block[] = [];
    this.mutate((d) => {
      for (const id of ids) {
        const l = findLoc(d, id);
        if (l) moving.push(...l.list.splice(l.index, 1).map((b) => JSON.parse(JSON.stringify(b))));
      }
      if (!d.length) d.push(newBlock());
    });
    const target = new PageOps(targetPageId);
    const tc = target.content();
    const onlyEmpty = tc.length === 1 && tc[0].type === 'text' && !tc[0].html && !tc[0].children?.length;
    target.mutate((d) => { if (onlyEmpty) d.splice(0, 1); d.push(...moving); });
  }

  /** Previous / next blocks in visual order (for caret navigation). */
  neighbors(id: string, rootId?: string) {
    let list = this.content();
    if (rootId) list = this.block(rootId)?.children ?? [];
    const flat = flattenVisible(list);
    const i = flat.findIndex((b) => b.id === id);
    return { prev: i > 0 ? flat[i - 1] : null, next: i >= 0 && i < flat.length - 1 ? flat[i + 1] : null, flat, index: i };
  }

  prevText(id: string, rootId?: string) {
    const { flat, index } = this.neighbors(id, rootId);
    for (let i = index - 1; i >= 0; i--) if (isTextType(flat[i].type) || flat[i].type === 'code' || flat[i].type === 'equation') return flat[i];
    return null;
  }

  nextText(id: string, rootId?: string) {
    const { flat, index } = this.neighbors(id, rootId);
    for (let i = index + 1; i < flat.length; i++) if (isTextType(flat[i].type) || flat[i].type === 'code' || flat[i].type === 'equation') return flat[i];
    return null;
  }

  /** Turn a block into a sub-page holding its text as title and children as content. */
  turnIntoPage(id: string): string | null {
    const b = this.block(id);
    if (!b) return null;
    const st = useStore.getState();
    const pid = st.createPage({
      parentId: this.pageId,
      title: htmlToText(b.html),
      content: b.children?.length ? JSON.parse(JSON.stringify(b.children)) : [newBlock()],
    });
    this.mutate((d) => {
      const l = findLoc(d, id);
      if (l) l.list[l.index] = { id: b.id, type: 'page', html: '', pageId: pid };
    });
    return pid;
  }

  setAllToggles(open: boolean) {
    this.mutate((d) => walkBlocks(d, (b) => { if (isToggleType(b.type)) b.open = open; }));
  }
}

export function canHaveChildren(b: Block) {
  return isTextType(b.type) && b.type !== 'h1' && b.type !== 'h2' && b.type !== 'h3' && b.type !== 'h4' || b.type === 'synced';
}

function insertAt(d: Block[], targetId: string, where: DropWhere, moving: Block[]) {
  const t = findLoc(d, targetId);
  if (!t) { d.push(...moving); return; }
  const target = t.list[t.index];
  if (where === 'before') t.list.splice(t.index, 0, ...moving);
  else if (where === 'after') t.list.splice(t.index + 1, 0, ...moving);
  else if (where === 'inside') { (target.children ??= []).push(...moving); if (isToggleType(target.type)) target.open = true; }
  else {
    // left/right: create or extend columns
    if (t.parent?.type === 'column') {
      const colsLoc = findLoc(d, t.parent.id)!;
      const newCol: Block = { id: uid(), type: 'column', html: '', children: moving };
      colsLoc.list.splice(where === 'left' ? colsLoc.index : colsLoc.index + 1, 0, newCol);
      colsLoc.list.forEach((c) => delete c.width);
    } else if (target.type === 'columns') {
      const newCol: Block = { id: uid(), type: 'column', html: '', children: moving };
      if (where === 'left') target.children!.unshift(newCol); else target.children!.push(newCol);
      target.children!.forEach((c) => delete c.width);
    } else {
      const a: Block = { id: uid(), type: 'column', html: '', children: [target] };
      const bcol: Block = { id: uid(), type: 'column', html: '', children: moving };
      t.list[t.index] = { id: uid(), type: 'columns', html: '', children: where === 'left' ? [bcol, a] : [a, bcol] };
    }
  }
}

/** Clean up empty columns, single-column layouts and empty pages. */
export function normalize(list: Block[]) {
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    if (b.type === 'columns') {
      b.children = (b.children ?? []).filter((c) => c.type === 'column' && (c.children?.length ?? 0) > 0);
      b.children.forEach((c) => normalize(c.children!));
      if (b.children.length === 0) { list.splice(i, 1); continue; }
      if (b.children.length === 1) { list.splice(i, 1, ...b.children[0].children!); continue; }
    } else if (b.children) normalize(b.children);
    if (b.tabs) b.tabs.forEach((t) => { normalize(t.children); if (!t.children.length) t.children.push(newBlock()); });
  }
}
