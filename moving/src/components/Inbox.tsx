import { useState } from 'react';
import { Archive, Check, CheckCheck, Bell, AtSign, MessageSquare, UserPlus, Zap, Info, ArchiveRestore, Sparkles } from 'lucide-react';
import { useStore, pageTitle } from '../store/store';
import { Avatar, PageIcon } from './ui';
import { goPage } from '../lib/router';
import { cx, timeAgo } from '../lib/util';
import type { Notification } from '../store/types';

const ICON: Record<Notification['kind'], typeof Bell> = { mention: AtSign, comment: MessageSquare, reminder: Bell, invite: UserPlus, assign: UserPlus, automation: Zap, system: Info };

export default function Inbox() {
  const s = useStore();
  const [filter, setFilter] = useState<'all' | 'unread' | 'mentions' | 'archived'>('all');
  const all = Object.values(s.notifications).filter((n) => n.wsId === s.wsId).sort((a, b) => b.at - a.at);
  const list = all.filter((n) => filter === 'archived' ? n.archived : !n.archived && (filter === 'all' || (filter === 'unread' ? !n.read : n.kind === 'mention')));
  const unread = all.filter((n) => !n.read && !n.archived).length;
  const today = list.filter((n) => Date.now() - n.at < 864e5);
  const older = list.filter((n) => Date.now() - n.at >= 864e5);

  const item = (n: Notification) => {
    const I = ICON[n.kind];
    const page = n.pageId ? s.pages[n.pageId] : null;
    return (
      <div key={n.id} className={cx('inbox-item', !n.read && 'unread')} onClick={() => { s.markRead(n.id); if (n.pageId && page && !page.trashedAt) goPage(n.pageId); }}>
        {!n.read && <span className="unread-dot" />}
        <div className="inbox-avatar">{n.actorId ? <Avatar user={s.users[n.actorId]} size={28} /> : <span className="inbox-kind"><I size={16} /></span>}</div>
        <div className="grow">
          <div className="inbox-text">{n.text}</div>
          {page && <div className="inbox-page"><PageIcon page={page} size={14} /> {pageTitle(page)}</div>}
          <div className="faint small">{timeAgo(n.at)}</div>
        </div>
        <div className="inbox-actions" onClick={(e) => e.stopPropagation()}>
          <button className="icon-btn sm" title={n.read ? 'Mark as unread' : 'Mark as read'} onClick={() => s.markRead(n.id, !n.read)}><Check size={14} /></button>
          <button className="icon-btn sm" title={n.archived ? 'Unarchive' : 'Archive'} onClick={() => s.archiveNotification(n.id, !n.archived)}>{n.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}</button>
        </div>
      </div>
    );
  };

  return (
    <div className="inbox">
      <div className="inbox-head">
        <h1>Inbox</h1>
        <div className="grow" />
        <button className="btn btn-sm" disabled={!unread} onClick={() => s.markAllRead()}><CheckCheck size={14} /> Mark all as read</button>
        <button className="btn btn-sm" onClick={() => list.filter((n) => !n.archived).forEach((n) => s.archiveNotification(n.id))}><Archive size={14} /> Archive all</button>
      </div>
      <div className="seg inbox-tabs">
        {(['all', 'unread', 'mentions', 'archived'] as const).map((f) => (
          <button key={f} className={cx('seg-btn', filter === f && 'on')} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}{f === 'unread' && unread ? ` (${unread})` : ''}</button>
        ))}
      </div>
      {unread >= 3 && filter !== 'archived' && (
        <div className="catchup"><Sparkles size={14} /> <b>Catch up:</b> {unread} unread — {Object.entries(all.filter((n) => !n.read).reduce<Record<string, number>>((a, n) => { a[n.kind] = (a[n.kind] ?? 0) + 1; return a; }, {})).map(([k, v]) => `${v} ${k}${v > 1 ? 's' : ''}`).join(', ')}.</div>
      )}
      {list.length === 0 && <div className="empty-state"><div style={{ fontSize: 34 }}>📭</div><div>You’re all caught up</div><div className="faint small">Mentions, comments, reminders and invites show up here.</div></div>}
      {today.length > 0 && <><div className="menu-header">Today</div>{today.map(item)}</>}
      {older.length > 0 && <><div className="menu-header">Earlier</div>{older.map(item)}</>}
    </div>
  );
}
