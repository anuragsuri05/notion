import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Bell, Plus, ArrowUpRight, FileText } from 'lucide-react';
import { useEditor, type InlineMenu } from '../Editor';
import { useStore, pageTitle } from '../../store/store';
import { Avatar, PageIcon, Popover } from '../../components/ui';
import { removeTrigger } from '../runSlash';
import { insertHtmlAtCaret } from '../caret';
import { cx, escapeHtml, parseNaturalDate, toISODate, toISODateTime, fuzzy } from '../../lib/util';
import { prettyDate } from '../RichText';
import { newBlock } from '../../lib/util';

type Item =
  | { kind: 'person'; id: string; label: string }
  | { kind: 'page'; id: string; label: string }
  | { kind: 'date'; iso: string; time: boolean; label: string; remind?: boolean }
  | { kind: 'new'; label: string; where: 'sub' | 'elsewhere' };

export default function MentionMenu({ menu }: { menu: InlineMenu }) {
  const api = useEditor();
  const s = useStore();
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const q = menu.query;

  const items = useMemo<{ header: string; items: Item[] }[]>(() => {
    const out: { header: string; items: Item[] }[] = [];
    const wantPeople = menu.kind === 'mention' || menu.kind === 'person';
    const wantDates = menu.kind === 'mention' || menu.kind === 'date';
    const wantPages = menu.kind === 'mention' || menu.kind === 'link';
    if (wantPeople) {
      const ws = s.workspaces[s.wsId];
      const people = ws.members.map((m) => s.users[m.userId]).filter((u) => u && fuzzy(q, u.name, u.email));
      if (people.length) out.push({ header: 'People', items: people.slice(0, 6).map((u) => ({ kind: 'person', id: u.id, label: u.name })) });
    }
    if (wantDates) {
      const isRemind = /^remind\s*/i.test(q);
      const dq = q.replace(/^remind\s*/i, '');
      const dates: Item[] = [];
      const parsed = dq ? parseNaturalDate(dq) : null;
      if (parsed) dates.push({ kind: 'date', iso: parsed.time ? toISODateTime(parsed.date) : toISODate(parsed.date), time: parsed.time, label: prettyDate(parsed.time ? toISODateTime(parsed.date) : toISODate(parsed.date), parsed.time), remind: isRemind });
      else if (!dq || fuzzy(dq, 'today now tomorrow')) {
        const now = new Date();
        if (!dq || 'today'.startsWith(dq)) dates.push({ kind: 'date', iso: toISODate(now), time: false, label: 'Today', remind: isRemind });
        if (!dq || 'now'.startsWith(dq)) dates.push({ kind: 'date', iso: toISODateTime(now), time: true, label: 'Now', remind: isRemind });
        if (!dq || 'tomorrow'.startsWith(dq)) { const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(9, 0, 0, 0); dates.push({ kind: 'date', iso: toISODateTime(t), time: true, label: 'Remind me tomorrow 9 AM', remind: true }); }
      }
      if (dates.length && (menu.kind === 'date' || !q || dq || isRemind)) out.push({ header: 'Date', items: dates.slice(0, 3) });
    }
    if (wantPages) {
      const pages = Object.values(s.pages)
        .filter((p) => p.wsId === s.wsId && !p.trashedAt && !p.isTemplate && p.id !== api.pageId && fuzzy(q, p.title || 'Untitled'))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 8);
      if (pages.length) out.push({ header: menu.kind === 'link' ? 'Link to page' : 'Link to page', items: pages.map((p) => ({ kind: 'page', id: p.id, label: pageTitle(p) })) });
      if (q && menu.kind === 'link') out.push({ header: 'New', items: [{ kind: 'new', label: `Add new sub-page "${q}"`, where: 'sub' }, { kind: 'new', label: `Add new page in Private "${q}"`, where: 'elsewhere' }] });
      if (q && menu.kind === 'mention') out.push({ header: 'New', items: [{ kind: 'new', label: `New page "${q}"`, where: 'sub' }] });
    }
    return out;
  }, [q, menu.kind, s.pages, s.users, s.workspaces, s.wsId, api.pageId]);

  const flat = items.flatMap((g) => g.items);
  useEffect(() => setActive(0), [q]);
  useEffect(() => { listRef.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' }); }, [active]);
  useEffect(() => {
    if (!flat.length && q.length > 2) api.openMenu(null);
  }, [flat.length, q, api]);

  const choose = (it: Item) => {
    api.openMenu(null);
    const el = removeTrigger(api, menu.blockId, menu.start);
    if (!el) return;
    el.focus();
    let html = '';
    if (it.kind === 'person') {
      html = `<span class="mention mention-user" contenteditable="false" data-user="${it.id}">@${escapeHtml(it.label)}</span>&nbsp;`;
      if (it.id !== s.meId) s.notify({ kind: 'mention', pageId: api.pageId, actorId: s.meId, text: `${s.users[s.meId].name} mentioned ${it.label} in “${pageTitle(s.pages[api.pageId])}”` });
    } else if (it.kind === 'page') {
      html = `<span class="mention mention-page" contenteditable="false" data-page="${it.id}">${escapeHtml(it.label)}</span>&nbsp;`;
    } else if (it.kind === 'date') {
      html = `<span class="mention mention-date${it.remind ? ' remind' : ''}" contenteditable="false" data-date="${it.iso}" data-time="${it.time ? 1 : 0}">@${escapeHtml(it.label)}</span>&nbsp;`;
      if (it.remind) {
        const at = new Date(it.iso.length > 10 ? it.iso : it.iso + 'T09:00').getTime();
        s.addReminder({ pageId: api.pageId, at, text: el.textContent?.trim() || 'Reminder' });
        s.showToast(`Reminder set for ${it.label}`);
      }
    } else if (it.kind === 'new') {
      const pid = s.createPage({ title: q, parentId: it.where === 'sub' ? api.pageId : null, section: 'private' });
      if (it.where === 'sub' && menu.kind === 'link' && !el.textContent?.trim()) {
        api.ops.mutate((d) => {
          const f = (l: typeof d): boolean => { for (let i = 0; i < l.length; i++) { if (l[i].id === menu.blockId) { l[i] = { ...newBlock('page', { pageId: pid }), id: menu.blockId }; return true; } if (l[i].children && f(l[i].children!)) return true; } return false; };
          f(d);
        });
        return;
      }
      html = `<span class="mention mention-page" contenteditable="false" data-page="${pid}">${escapeHtml(q)}</span>&nbsp;`;
    }
    insertHtmlAtCaret(html);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  api.menuKeyHandler.current = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % Math.max(flat.length, 1)); return true; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + flat.length) % Math.max(flat.length, 1)); return true; }
    if ((e.key === 'Enter' || e.key === 'Tab') && flat[active]) { e.preventDefault(); choose(flat[active]); return true; }
    if (e.key === 'Escape') { e.preventDefault(); api.openMenu(null); return true; }
    return false;
  };

  if (!flat.length) return null;
  let idx = -1;
  return (
    <Popover anchor={menu.rect} onClose={() => api.openMenu(null)} offset={6}>
      <div className="menu" style={{ width: 320 }} ref={listRef}>
        <div className="menu-list">
          {items.map((g) => (
            <div key={g.header}>
              <div className="menu-header">{g.header}</div>
              {g.items.map((it) => {
                idx++;
                const i = idx;
                return (
                  <div key={i} className={cx('menu-item', active === i && 'active')} onMouseMove={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); choose(it); }}>
                    <span className="menu-icon">
                      {it.kind === 'person' && <Avatar user={s.users[it.id]} size={20} />}
                      {it.kind === 'page' && <PageIcon page={s.pages[it.id]} size={18} />}
                      {it.kind === 'date' && (it.remind ? <Bell size={16} /> : <CalendarDays size={16} />)}
                      {it.kind === 'new' && (it.where === 'sub' ? <Plus size={16} /> : <ArrowUpRight size={16} />)}
                    </span>
                    <span className="menu-label ellipsis">{it.label}</span>
                    {it.kind === 'page' && s.pages[it.id]?.parentId && <span className="faint small ellipsis" style={{ maxWidth: 110 }}>{pageTitle(s.pages[s.pages[it.id].parentId!])}</span>}
                    {it.kind === 'person' && <span className="faint small">{s.users[it.id]?.email}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="menu-footer"><FileText size={12} /> Type to search · ↑↓ to navigate</div>
      </div>
    </Popover>
  );
}
