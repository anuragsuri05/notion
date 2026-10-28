import { useEffect, useMemo, useState } from 'react';
import { useEditor, type InlineMenu } from '../Editor';
import { Popover } from '../../components/ui';
import { searchEmoji } from '../../lib/emoji';
import { removeTrigger } from '../runSlash';
import { insertHtmlAtCaret } from '../caret';
import { cx } from '../../lib/util';
import { useStore } from '../../store/store';

export default function EmojiInlineMenu({ menu }: { menu: InlineMenu }) {
  const api = useEditor();
  const custom = useStore((s) => s.emojis);
  const [active, setActive] = useState(0);
  const results = useMemo(() => {
    const c = custom.filter((e) => e.name.includes(menu.query.toLowerCase())).map((e) => ({ e: `<img class="custom-emoji" src="${e.url}" alt=":${e.name}:">`, n: e.name, custom: true }));
    return [...c, ...searchEmoji(menu.query, 24).map((e) => ({ e: e.e, n: e.n, custom: false }))].slice(0, 24);
  }, [menu.query, custom]);
  useEffect(() => setActive(0), [menu.query]);
  useEffect(() => { if (!results.length && menu.query.length > 2) api.openMenu(null); }, [results.length, menu.query, api]);

  const choose = (e: { e: string; custom: boolean }) => {
    api.openMenu(null);
    const el = removeTrigger(api, menu.blockId, menu.start);
    el?.focus();
    insertHtmlAtCaret(e.custom ? e.e : e.e);
    el?.dispatchEvent(new Event('input', { bubbles: true }));
  };

  api.menuKeyHandler.current = (e) => {
    const cols = 8;
    if (e.key === 'ArrowRight') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); return true; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); return true; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + cols)); return true; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - cols)); return true; }
    if ((e.key === 'Enter' || e.key === 'Tab') && results[active]) { e.preventDefault(); choose(results[active]); return true; }
    if (e.key === 'Escape') { e.preventDefault(); api.openMenu(null); return true; }
    return false;
  };

  if (!results.length) return null;
  return (
    <Popover anchor={menu.rect} onClose={() => api.openMenu(null)} offset={6}>
      <div className="menu" style={{ width: 300, padding: 6 }}>
        <div className="emoji-grid">
          {results.map((r, i) => (
            <button key={r.n + i} className={cx('emoji-cell', active === i && 'active')} title={`:${r.n.replace(/ /g, '_')}:`} onMouseMove={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); choose(r); }}>
              {r.custom ? <span dangerouslySetInnerHTML={{ __html: r.e }} /> : r.e}
            </button>
          ))}
        </div>
        <div className="menu-footer">:{menu.query} — {results[active]?.n}</div>
      </div>
    </Popover>
  );
}
