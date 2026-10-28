import type { EditorAPI } from './Editor';
import type { SlashItem } from './blockTypes';
import { useStore } from '../store/store';
import { newBlock, isTextType, htmlToText, uid } from '../lib/util';
import { goPage } from '../lib/router';
import { getSel, setCaret } from './caret';

/** Remove the "/query" text typed to open a menu. */
export function removeTrigger(api: EditorAPI, blockId: string, start: number) {
  const el = document.querySelector<HTMLElement>(`[data-rt="${blockId}"]`);
  if (!el || start < 0) return el;
  const sel = getSel();
  if (!sel || !sel.rangeCount) return el;
  const caretEnd = (() => {
    const r = sel.getRangeAt(0);
    const pre = document.createRange();
    pre.selectNodeContents(el);
    pre.setEnd(r.startContainer, r.startOffset);
    return pre.toString().length;
  })();
  setCaret(el, start, caretEnd);
  getSel()?.getRangeAt(0).deleteContents();
  el.dispatchEvent(new Event('input', { bubbles: true }));
  void api;
  return el;
}

const EMBED_HINTS: Record<string, string> = {
  embed_figma: 'https://www.figma.com/file/…',
  embed_maps: 'https://www.google.com/maps/embed?pb=…',
  embed_codepen: 'https://codepen.io/…/pen/…',
  embed_loom: 'https://www.loom.com/share/…',
  embed_tweet: 'https://x.com/…/status/…',
  embed_youtube: 'https://www.youtube.com/watch?v=…',
};

export function runSlash(api: EditorAPI, item: SlashItem, blockId: string, start: number) {
  const ops = api.ops;
  const el = removeTrigger(api, blockId, start);
  const block = ops.block(blockId);
  if (!block) return;
  const empty = !htmlToText(el?.innerHTML ?? block.html).trim() && isTextType(block.type);
  const st = useStore.getState();

  // place a new block: replace the current empty text block, or insert after it
  const place = (nb = newBlock(item.type ?? 'text')) => {
    if (empty && block.type === 'text' && !block.children?.length) {
      ops.mutate((d) => {
        const find = (l: typeof d): boolean => {
          for (let i = 0; i < l.length; i++) {
            if (l[i].id === blockId) { l[i] = { ...nb, id: blockId }; return true; }
            if (l[i].children && find(l[i].children!)) return true;
            if (l[i].tabs) for (const t of l[i].tabs!) if (find(t.children)) return true;
          }
          return false;
        };
        find(d);
      });
      return blockId;
    }
    ops.insertAfter(blockId, [nb]);
    return nb.id;
  };

  const focusAfter = (id: string) => {
    const b = ops.block(id);
    if (b && (isTextType(b.type) || b.type === 'code')) api.focus(id, 'end');
    else {
      const nb = newBlock();
      ops.insertAfter(id, [nb]);
      api.focus(nb.id, 'start');
    }
  };

  switch (item.id) {
    case 'ai': case 'ai_continue': case 'ai_summary': case 'ai_actions':
      api.openAI(blockId, item.id);
      return;
    case 'duplicate': { const [id] = ops.duplicate([blockId]); api.focus(id); return; }
    case 'delete': { const prev = ops.prevText(blockId); ops.remove([blockId]); if (prev) api.focus(prev.id); return; }
    case 'moveto': st.openModal('moveTo', { kind: 'blocks', pageId: api.pageId, ids: [blockId] }); return;
    case 'comment': window.dispatchEvent(new CustomEvent('moving:comment', { detail: { pageId: api.pageId, blockId, threadId: uid(), quote: '' } })); return;
    case 'mention_page': case 'mention_person': case 'date': case 'emoji': {
      const rect = el?.getBoundingClientRect() ?? new DOMRect();
      const caretStart = start >= 0 ? start : (el?.textContent ?? '').length;
      setTimeout(() => {
        if (el) setCaret(el, caretStart);
        api.openMenu({ kind: item.id === 'mention_page' ? 'link' : item.id === 'mention_person' ? 'person' : item.id === 'date' ? 'date' : 'emoji', blockId, start: caretStart, trig: 0, query: '', rect });
      }, 10);
      return;
    }
    case 'inline_equation': {
      if (el) {
        el.focus();
        const span = `<span class="inline-eq" contenteditable="false" data-tex="">x</span>`;
        document.execCommand('insertHTML', false, span);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        setTimeout(() => {
          const atom = el.querySelector<HTMLElement>('span[data-tex=""]');
          atom?.click();
        }, 30);
      }
      return;
    }
    case 'page': {
      const pid = st.createPage({ parentId: api.pageId });
      place(newBlock('page', { pageId: pid }));
      goPage(pid);
      return;
    }
    case 'link_page': {
      const id = place(newBlock('link_page'));
      void id;
      return;
    }
    case 'db_full': {
      const { pageId } = st.createDatabase({ inline: false, parentId: api.pageId, section: st.pages[api.pageId]?.section });
      place(newBlock('page', { pageId }));
      goPage(pageId);
      return;
    }
    case 'db_linked': {
      const id = place(newBlock('database', { viewIds: [] }));
      focusAfter(id);
      return;
    }
    case 'columns2': case 'columns3': case 'columns4': case 'columns5': {
      const n = +item.id.slice(-1);
      const cols = Array.from({ length: n }, () => newBlock('column', { children: [newBlock()] }));
      const id = place(newBlock('columns', { children: cols }));
      const first = ops.block(id)?.children?.[0]?.children?.[0];
      if (first) api.focus(first.id, 'start');
      return;
    }
  }

  if (item.view) {
    const { dbId } = st.createDatabase({ hostPageId: api.pageId, inline: true, view: item.view });
    const id = place(newBlock('database', { dbId }));
    focusAfter(id);
    return;
  }

  if (!item.type) return;

  if (isTextType(item.type)) {
    if (empty || isTextType(block.type) && !htmlToText(block.html).trim()) {
      ops.turnInto(blockId, item.type);
      api.focus(blockId, 'start');
    } else {
      const nb = newBlock(item.type);
      ops.insertAfter(blockId, [nb]);
      api.focus(nb.id, 'start');
    }
    return;
  }

  const patch: Partial<ReturnType<typeof newBlock>> = {};
  if (EMBED_HINTS[item.id]) patch.meta = { title: EMBED_HINTS[item.id] };
  if (item.type === 'synced') patch.children = [newBlock()];
  if (item.type === 'button') patch.html = 'New button';
  const id = place(newBlock(item.type, patch));
  if (item.type === 'code' || item.type === 'equation') { setTimeout(() => api.focus(id, 'start'), 30); return; }
  if (item.type === 'synced') { const first = ops.block(id)?.children?.[0]; if (first) api.focus(first.id); return; }
  if (item.type === 'divider' || item.type === 'toc' || item.type === 'breadcrumb') focusAfter(id);
}
