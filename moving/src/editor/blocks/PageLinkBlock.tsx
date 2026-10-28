import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { Block } from '../../store/types';
import { useEditor } from '../Editor';
import { useStore, pageTitle } from '../../store/store';
import { PageIcon, Popover, SearchInput } from '../../components/ui';
import { goPage } from '../../lib/router';
import { cx, fuzzy } from '../../lib/util';

export default function PageLinkBlock({ block }: { block: Block }) {
  const api = useEditor();
  const page = useStore((s) => (block.pageId ? s.pages[block.pageId] : undefined));
  const [picker, setPicker] = useState<HTMLElement | null>(null);

  if (!block.pageId) {
    return (
      <>
        <div className="media-empty media" ref={(el) => { if (el && !picker && !api.readOnly && !(el as any)._opened) { (el as any)._opened = true; setTimeout(() => setPicker(el), 0); } }} onClick={(e) => setPicker(e.currentTarget)}>
          <ArrowUpRight size={18} /> Link to page
        </div>
        {picker && <PagePicker anchor={picker} onClose={() => setPicker(null)} onPick={(id) => { api.ops.update(block.id, { pageId: id }); setPicker(null); }} exclude={api.pageId} />}
      </>
    );
  }

  const deleted = !page || !!page.trashedAt;
  return (
    <div
      className={cx('page-link', deleted && 'deleted')}
      contentEditable={false}
      onClick={(e) => {
        if (deleted) return;
        if (e.metaKey || e.ctrlKey) window.open(`#/page/${block.pageId}`, '_blank');
        else if (e.shiftKey || e.altKey) useStore.getState().setPeek({ pageId: block.pageId!, mode: 'side' });
        else goPage(block.pageId!);
      }}
    >
      <span className="page-link-icon">
        <PageIcon page={page} size={19} />
        {block.type === 'link_page' && <ArrowUpRight size={11} className="link-arrow" />}
      </span>
      <span className="page-link-title">{deleted ? 'Deleted page' : pageTitle(page)}</span>
    </div>
  );
}

export function PagePicker({ anchor, onClose, onPick, exclude, filter }: { anchor: HTMLElement | DOMRect; onClose: () => void; onPick: (id: string) => void; exclude?: string; filter?: (p: any) => boolean }) {
  const [q, setQ] = useState('');
  const pages = useStore((s) => s.pages);
  const wsId = useStore((s) => s.wsId);
  const list = Object.values(pages)
    .filter((p) => p.wsId === wsId && !p.trashedAt && !p.isTemplate && p.id !== exclude && fuzzy(q, p.title || 'Untitled') && (!filter || filter(p)))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 50);
  const [active, setActive] = useState(0);
  return (
    <Popover anchor={anchor} onClose={onClose}>
      <div className="menu" style={{ width: 340 }}>
        <div className="menu-search">
          <SearchInput autoFocus value={q} onChange={(v) => { setQ(v); setActive(0); }} placeholder="Search for a page…"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(list.length - 1, a + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              if (e.key === 'Enter' && list[active]) onPick(list[active].id);
            }} />
        </div>
        <div className="menu-list" style={{ maxHeight: 320 }}>
          {list.length === 0 && <div className="menu-empty">No pages found</div>}
          {list.map((p, i) => (
            <div key={p.id} className={cx('menu-item', i === active && 'active')} onMouseMove={() => setActive(i)} onClick={() => onPick(p.id)}>
              <span className="menu-icon"><PageIcon page={p} size={18} /></span>
              <span className="menu-label ellipsis">{pageTitle(p)}</span>
              {p.parentId && <span className="faint small ellipsis" style={{ maxWidth: 120 }}>{pageTitle(pages[p.parentId])}</span>}
            </div>
          ))}
        </div>
      </div>
    </Popover>
  );
}
