// Per-page undo/redo stacks. Content arrays coming out of the immer store are
// immutable, so we can keep references instead of deep copies.
import type { Block } from '../store/types';

interface Stack { past: Block[][]; future: Block[][]; typing?: { id: string; at: number } }
const stacks = new Map<string, Stack>();

function stack(pageId: string): Stack {
  let s = stacks.get(pageId);
  if (!s) { s = { past: [], future: [] }; stacks.set(pageId, s); }
  return s;
}

/** Record the state *before* a change. Consecutive typing in one block is coalesced. */
export function record(pageId: string, before: Block[], typingBlockId?: string) {
  const s = stack(pageId);
  const t = Date.now();
  if (typingBlockId) {
    if (s.typing && s.typing.id === typingBlockId && t - s.typing.at < 1200) { s.typing.at = t; return; }
    s.typing = { id: typingBlockId, at: t };
  } else s.typing = undefined;
  if (s.past[s.past.length - 1] === before) return;
  s.past.push(before);
  if (s.past.length > 200) s.past.shift();
  s.future = [];
}

export function undo(pageId: string, current: Block[]): Block[] | null {
  const s = stack(pageId);
  const prev = s.past.pop();
  if (!prev) return null;
  s.future.push(current);
  s.typing = undefined;
  return prev;
}

export function redo(pageId: string, current: Block[]): Block[] | null {
  const s = stack(pageId);
  const next = s.future.pop();
  if (!next) return null;
  s.past.push(current);
  s.typing = undefined;
  return next;
}
