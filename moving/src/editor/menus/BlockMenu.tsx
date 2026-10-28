import { Copy, Trash2, ArrowRightLeft, Link2, MessageSquare, Palette, Repeat, Sparkles, CornerUpRight, FileText, Maximize2, ListOrdered, Quote, Code2, WrapText } from 'lucide-react';
import { useEditor, orderedSelection } from '../Editor';
import { Menu, Popover, type MenuItemDef } from '../../components/ui';
import { TURN_INTO, CODE_LANGUAGES } from '../blockTypes';
import { COLORS, type Color } from '../../store/types';
import { useStore } from '../../store/store';
import { cx, isTextType, timeAgo, MOD, ALT, SHIFT, uid } from '../../lib/util';
import { goPage, pageUrl } from '../../lib/router';

export default function BlockMenu({ id, anchor, onClose }: { id: string; anchor: HTMLElement | DOMRect; onClose: () => void }) {
  const api = useEditor();
  const ops = api.ops;
  const block = ops.block(id);
  const st = useStore.getState();
  const page = useStore((s) => s.pages[api.pageId]);
  if (!block) return null;
  const ids = api.selected.has(id) && api.selected.size > 1 ? orderedSelection(ops, api.selected) : [id];
  const multi = ids.length > 1;

  const colorItems = (): MenuItemDef[] => [
    { header: 'Text color' },
    ...COLORS.map((c: Color) => ({
      label: c === 'default' ? 'Default text' : `${c[0].toUpperCase()}${c.slice(1)} text`,
      icon: <span className="swatch" style={{ color: c === 'default' ? 'var(--text)' : `var(--c-${c})` }}>A</span>,
      checked: (block.color ?? 'default') === c,
      onClick: () => ids.forEach((x) => ops.update(x, { color: c })),
    })),
    { header: 'Background color' },
    ...COLORS.map((c: Color) => ({
      label: c === 'default' ? 'Default background' : `${c[0].toUpperCase()}${c.slice(1)} background`,
      icon: <span className={cx('swatch', c !== 'default' && `bg-${c}`)}>A</span>,
      checked: (block.bg ?? 'default') === c,
      onClick: () => ids.forEach((x) => ops.update(x, { bg: c })),
    })),
  ];

  const items: MenuItemDef[] = [
    { header: multi ? `${ids.length} blocks` : (TURN_INTO.find((t) => t.type === block.type)?.label ?? block.type[0].toUpperCase() + block.type.slice(1)) },
    { label: 'Ask AI', icon: <Sparkles size={16} />, kbd: `${MOD}J`, onClick: () => api.openAI(id, 'edit'), keywords: 'ai' },
    { divider: true },
    { label: 'Delete', icon: <Trash2 size={16} />, kbd: 'Del', onClick: () => { const prev = ops.prevText(ids[0]); ops.remove(ids); api.clearSelection(); if (prev) api.focus(prev.id); } },
    { label: 'Duplicate', icon: <Copy size={16} />, kbd: `${MOD}D`, onClick: () => api.select(ops.duplicate(ids)) },
  ];
  if (isTextType(block.type) || block.type === 'code' || block.type === 'equation' || block.type === 'page') {
    items.push({
      label: 'Turn into', icon: <Repeat size={16} />, submenu: TURN_INTO.map((t) => ({
        label: t.label, icon: <span className="turn-icon">{t.icon}</span>, checked: t.type === block.type,
        onClick: () => {
          if (t.type === 'page') { const pid = ops.turnIntoPage(id); if (pid) goPage(pid); return; }
          ids.forEach((x) => ops.turnInto(x, t.type));
        },
      })),
    });
    if (!multi && isTextType(block.type)) items.push({ label: 'Turn into page in…', icon: <CornerUpRight size={16} />, onClick: () => { const pid = ops.turnIntoPage(id); if (pid) st.openModal('moveTo', { kind: 'page', ids: [pid] }); } });
  }
  items.push(
    { label: 'Copy link to block', icon: <Link2 size={16} />, kbd: `${ALT}${SHIFT}L`, onClick: () => { navigator.clipboard.writeText(pageUrl(api.pageId, id)); st.showToast('Copied link to block'); } },
    { label: 'Move to', icon: <ArrowRightLeft size={16} />, kbd: `${MOD}${SHIFT}P`, onClick: () => st.openModal('moveTo', { kind: 'blocks', pageId: api.pageId, ids }) },
    { label: 'Comment', icon: <MessageSquare size={16} />, kbd: `${MOD}${SHIFT}M`, onClick: () => window.dispatchEvent(new CustomEvent('moving:comment', { detail: { pageId: api.pageId, blockId: id, threadId: uid(), quote: '' } })) },
  );
  if (block.type === 'numbered') items.push({ label: 'List format', icon: <ListOrdered size={16} />, submenu: (['numbers', 'letters', 'roman'] as const).map((f) => ({ label: f === 'numbers' ? '1, 2, 3' : f === 'letters' ? 'a, b, c' : 'i, ii, iii', checked: block.numberStyle === f, onClick: () => ops.update(id, { numberStyle: f }) })) });
  if (block.type === 'quote') items.push({ label: 'Quote size', icon: <Quote size={16} />, submenu: [{ label: 'Default', checked: block.quoteSize !== 'large', onClick: () => ops.update(id, { quoteSize: 'default' }) }, { label: 'Large', checked: block.quoteSize === 'large', onClick: () => ops.update(id, { quoteSize: 'large' }) }] });
  if (block.type === 'code') {
    items.push({ label: 'Language', icon: <Code2 size={16} />, right: <span className="faint small">{block.language}</span>, submenu: CODE_LANGUAGES.map((l) => ({ label: l, checked: block.language === l, onClick: () => ops.update(id, { language: l }) })) });
    items.push({ label: 'Wrap code', icon: <WrapText size={16} />, checked: !!block.wrap, onClick: () => ops.update(id, { wrap: !block.wrap }) });
  }
  if (block.type === 'image' || block.type === 'video' || block.type === 'embed' || block.type === 'pdf') {
    items.push({ label: 'Full width', icon: <Maximize2 size={16} />, onClick: () => ops.update(id, { width: 100 }) });
  }
  if (block.type === 'page' && block.pageId) {
    items.push({ label: 'Open in side peek', icon: <FileText size={16} />, onClick: () => st.setPeek({ pageId: block.pageId!, mode: 'side' }) });
  }
  items.push({ divider: true }, { label: 'Color', icon: <Palette size={16} />, submenu: colorItems() });

  return (
    <Popover anchor={anchor} onClose={onClose} placement="left-start">
      <Menu
        items={items}
        onClose={onClose}
        searchable
        placeholder="Search actions…"
        width={265}
        footer={<div className="menu-footer col" style={{ gap: 0, alignItems: 'flex-start' }}>
          <span>Last edited by {st.users[page?.updatedBy ?? '']?.name ?? 'You'}</span>
          <span>{page ? timeAgo(page.updatedAt) : ''}</span>
        </div>}
      />
    </Popover>
  );
}
