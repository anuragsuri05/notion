import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, type InlineMenu } from '../Editor';
import { SLASH_ITEMS, type SlashItem } from '../blockTypes';
import { Popover } from '../../components/ui';
import { runSlash } from '../runSlash';
import { cx } from '../../lib/util';
import { COLORS } from '../../store/types';

function score(item: SlashItem, q: string): number {
  const s = q.toLowerCase().trim();
  if (!s) return 1;
  const label = item.label.toLowerCase();
  if (label.startsWith(s)) return 3;
  if (label.split(' ').some((w) => w.startsWith(s))) return 2.5;
  if (label.includes(s)) return 2;
  if ((item.keywords ?? '').toLowerCase().split(' ').some((k) => k.startsWith(s))) return 1.5;
  if ((item.keywords ?? '').toLowerCase().includes(s)) return 1;
  return 0;
}

// color entries are generated so `/red`, `/blue background` etc work like Notion
const COLOR_ITEMS: SlashItem[] = COLORS.flatMap((c) => [
  { id: `color:text:${c}`, label: c === 'default' ? 'Default' : `${c[0].toUpperCase()}${c.slice(1)}`, desc: 'Text color', group: 'Colors' as const, icon: 'A', keywords: `${c} color text default` },
  ...(c === 'default' ? [] : [{ id: `color:bg:${c}`, label: `${c[0].toUpperCase()}${c.slice(1)} background`, desc: 'Background color', group: 'Colors' as const, icon: 'A', keywords: `${c} background highlight` }]),
]);

export default function SlashMenu({ menu }: { menu: InlineMenu }) {
  const api = useEditor();
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const misses = useRef(0);

  const items = useMemo(() => {
    const all = menu.query ? [...SLASH_ITEMS, ...COLOR_ITEMS] : SLASH_ITEMS.filter((i) => i.group !== 'Actions');
    return all.map((i) => ({ i, s: score(i, menu.query) })).filter((x) => x.s > 0).sort((a, b) => (menu.query ? b.s - a.s : 0)).map((x) => x.i);
  }, [menu.query]);

  useEffect(() => { setActive(0); }, [menu.query]);
  useEffect(() => {
    if (!items.length) { misses.current++; if (misses.current > 2 || menu.query.endsWith(' ')) api.openMenu(null); }
    else misses.current = 0;
  }, [items.length, menu.query, api]);

  const choose = (item: SlashItem) => {
    api.openMenu(null);
    if (item.id.startsWith('color:')) {
      const [, kind, color] = item.id.split(':');
      import('../runSlash').then(({ removeTrigger }) => {
        removeTrigger(api, menu.blockId, menu.start);
        api.ops.update(menu.blockId, kind === 'text' ? { color: color as any } : { bg: color as any });
      });
      return;
    }
    runSlash(api, item, menu.blockId, menu.start);
  };

  api.menuKeyHandler.current = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % Math.max(items.length, 1)); return true; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + items.length) % Math.max(items.length, 1)); return true; }
    if (e.key === 'Enter' || e.key === 'Tab') { if (!items[active]) return false; e.preventDefault(); choose(items[active]); return true; }
    if (e.key === 'Escape') { e.preventDefault(); api.openMenu(null); return true; }
    return false;
  };

  useEffect(() => {
    listRef.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!items.length) return null;
  let lastGroup = '';
  return (
    <Popover anchor={menu.rect} onClose={() => api.openMenu(null)} offset={6}>
      <div className="menu slash-menu" ref={listRef}>
        <div className="menu-list">
          {items.map((it, idx) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <div key={it.id}>
                {header && <div className="menu-header">{header}</div>}
                <div className={cx('slash-item', idx === active && 'active')} onMouseMove={() => setActive(idx)} onMouseDown={(e) => { e.preventDefault(); choose(it); }}>
                  <div className={cx('slash-icon', it.id.startsWith('color:') && it.id.split(':')[1] === 'bg' && `bg-${it.id.split(':')[2]}`)} style={it.id.startsWith('color:text:') ? { color: `var(--c-${it.id.split(':')[2]})` } : undefined}>{it.icon}</div>
                  <div className="grow">
                    <div className="slash-label">{it.label}</div>
                    <div className="slash-desc">{it.desc}</div>
                  </div>
                  {it.shortcut && <span className="kbd">{it.shortcut}</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="menu-footer">Type <b>/</b> on the page · <span className="kbd">esc</span> to close</div>
      </div>
    </Popover>
  );
}
