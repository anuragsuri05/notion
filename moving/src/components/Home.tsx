import { useState } from 'react';
import { Clock, CheckSquare, CalendarDays, LayoutTemplate, Sparkles, Plus, MoreHorizontal, BookOpen, Mic } from 'lucide-react';
import { useStore, pageTitle, dbRows } from '../store/store';
import { PageIcon, MenuPopover, Checkbox, Tag } from './ui';
import { goPage, navigate } from '../lib/router';
import { timeAgo, parseISO, sameDay, fmtDateStyle, cx } from '../lib/util';
import type { DateValue } from '../store/types';

export default function Home() {
  const s = useStore();
  const me = s.users[s.meId];
  const hour = new Date().getHours();
  const greet = hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const recent = (s.recent[s.wsId] ?? []).map((id) => s.pages[id]).filter((p) => p && !p.trashedAt).slice(0, 12);
  const [hidden, setHidden] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('moving-home-hidden') ?? '[]'); } catch { return []; } });
  const hide = (k: string) => { const n = [...hidden, k]; setHidden(n); try { localStorage.setItem('moving-home-hidden', JSON.stringify(n)); } catch { /* ignore */ } };
  const [menu, setMenu] = useState<{ el: HTMLElement; k: string } | null>(null);

  // My tasks: rows in task databases assigned to me, not complete
  const taskDbs = Object.values(s.databases).filter((d) => d.wsId === s.wsId && d.isTasks && s.pages[d.pageId] && !s.pages[d.pageId].trashedAt);
  const tasks = taskDbs.flatMap((db) => {
    const person = db.properties.find((p) => p.type === 'person');
    const status = db.properties.find((p) => p.type === 'status');
    const due = db.properties.find((p) => p.type === 'date');
    return dbRows(s, db.id)
      .filter((r) => !person || ((r.props[person.id] as string[]) ?? []).includes(s.meId))
      .filter((r) => !status || status.options?.find((o) => o.id === r.props[status.id])?.group !== 'complete')
      .map((r) => ({ r, db, status, due }));
  }).slice(0, 10);

  // upcoming: dated rows & reminders in the next 7 days
  const now = new Date();
  const upcoming = Object.values(s.databases).filter((d) => d.wsId === s.wsId).flatMap((db) => {
    const date = db.properties.find((p) => p.type === 'date');
    if (!date) return [];
    return dbRows(s, db.id).map((r) => ({ r, d: parseISO((r.props[date.id] as DateValue)?.start) })).filter((x) => x.d && x.d >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && x.d.getTime() - now.getTime() < 7 * 864e5);
  }).sort((a, b) => a.d!.getTime() - b.d!.getTime()).slice(0, 8);

  const widgetHead = (k: string, icon: React.ReactNode, label: string) => (
    <div className="widget-head"><span className="row" style={{ gap: 6 }}>{icon} {label}</span><button className="icon-btn sm" onClick={(e) => setMenu({ el: e.currentTarget, k })}><MoreHorizontal size={14} /></button></div>
  );

  return (
    <div className="home">
      <h1 className="home-greet">{greet}, <em>{me.name}</em></h1>
      <p className="home-date">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>

      {!hidden.includes('recent') && (
        <section className="widget">
          {widgetHead('recent', <Clock size={14} />, 'Recently visited')}
          <div className="recent-row">
            {recent.map((p) => (
              <button key={p.id} className="recent-card" onClick={() => goPage(p.id)}>
                <div className="recent-cover" style={p.cover?.kind === 'color' ? { background: p.cover.value } : p.cover?.kind === 'image' ? { backgroundImage: `url(${p.cover.value})` } : undefined} />
                <div className="recent-icon"><PageIcon page={p} size={26} /></div>
                <div className="recent-title">{pageTitle(p)}</div>
                <div className="recent-meta faint small">{timeAgo(p.updatedAt)}</div>
              </button>
            ))}
            <button className="recent-card new" onClick={() => goPage(s.createPage({}))}><Plus size={22} /><div className="recent-title">New page</div></button>
          </div>
        </section>
      )}

      <div className="home-grid">
        {!hidden.includes('upcoming') && (
          <section className="widget">
            {widgetHead('upcoming', <CalendarDays size={14} />, 'Upcoming events')}
            {upcoming.length === 0 && <div className="widget-empty">No upcoming dates in the next 7 days. Add dates to database pages to see them here.</div>}
            {upcoming.map(({ r, d }) => (
              <div key={r.id} className="event-row" onClick={() => s.setPeek({ pageId: r.id, mode: 'side' })}>
                <div className={cx('event-date', sameDay(d!, now) && 'today')}><b>{d!.getDate()}</b><span>{d!.toLocaleString('en-US', { weekday: 'short' })}</span></div>
                <div className="grow"><div className="ellipsis">{pageTitle(r)}</div><div className="faint small">{fmtDateStyle(((r.props[Object.keys(r.props).find((k) => (r.props[k] as DateValue)?.start) ?? ''] as DateValue)?.start) ?? '', 'relative')}</div></div>
              </div>
            ))}
          </section>
        )}
        {!hidden.includes('tasks') && (
          <section className="widget">
            {widgetHead('tasks', <CheckSquare size={14} />, 'My tasks')}
            {taskDbs.length === 0 && <div className="widget-empty">Turn on “Show in My tasks” in a database’s settings to see your assigned tasks here.</div>}
            {taskDbs.length > 0 && tasks.length === 0 && <div className="widget-empty">🎉 You’re all caught up.</div>}
            {tasks.map(({ r, db, status, due }) => {
              const o = status?.options?.find((x) => x.id === r.props[status.id]);
              return (
                <div key={r.id} className="task-row" onClick={() => s.setPeek({ pageId: r.id, mode: 'side' })}>
                  <Checkbox checked={false} onChange={() => { if (status) { const done = status.options?.find((x) => x.group === 'complete'); if (done) s.setProp(r.id, status.id, done.id); } }} />
                  <span className="grow ellipsis">{pageTitle(r)}</span>
                  {o && <Tag name={o.name} color={o.color} status />}
                  {due && (r.props[due.id] as DateValue)?.start && <span className="faint small">{fmtDateStyle((r.props[due.id] as DateValue).start, 'relative')}</span>}
                  <span className="faint small">{db.title}</span>
                </div>
              );
            })}
          </section>
        )}
        {!hidden.includes('learn') && (
          <section className="widget">
            {widgetHead('learn', <BookOpen size={14} />, 'Get started')}
            <div className="learn-grid">
              <button className="learn-card" onClick={() => s.openModal('templates')}><LayoutTemplate size={20} /><b>Browse templates</b><span className="faint small">Start from a ready-made page</span></button>
              <button className="learn-card" onClick={() => navigate('/ai')}><Sparkles size={20} /><b>Ask Moving AI</b><span className="faint small">Write, summarize and search</span></button>
              <button className="learn-card" onClick={() => navigate('/meetings')}><Mic size={20} /><b>AI meeting notes</b><span className="faint small">Transcribe and summarize</span></button>
              <button className="learn-card" onClick={() => s.openModal('shortcuts')}><span style={{ fontSize: 18 }}>⌨️</span><b>Keyboard shortcuts</b><span className="faint small">Work faster</span></button>
            </div>
          </section>
        )}
      </div>
      {hidden.length > 0 && <button className="btn btn-sm faint-btn" onClick={() => { setHidden([]); localStorage.removeItem('moving-home-hidden'); }}>Show {hidden.length} hidden widget{hidden.length > 1 ? 's' : ''}</button>}
      {menu && <MenuPopover anchor={menu.el} onClose={() => setMenu(null)} width={180} items={[{ label: 'Hide widget', onClick: () => hide(menu.k) }]} />}
    </div>
  );
}
