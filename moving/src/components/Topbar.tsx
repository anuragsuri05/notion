import { Fragment, useState } from 'react';
import {
  ChevronsRight, MessageSquare, Clock, Star, MoreHorizontal, Sparkles, Lock, Unlock, Link2, Copy, CornerUpRight, Trash2,
  Undo2, History, Download, Upload, Maximize, Type, Languages, BarChart2, Bell, ChevronLeft, ChevronRight, Home, Inbox, Mic, LayoutTemplate,
} from 'lucide-react';
import { useStore, breadcrumbs, pageTitle } from '../store/store';
import type { Route } from '../lib/router';
import { goPage, pageUrl } from '../lib/router';
import { PageIcon, Tip, Popover, Toggle, Menu, MenuPopover } from './ui';
import { cx, timeAgo, MOD, SHIFT, blocksText, fmtDate } from '../lib/util';
import ShareMenu from './ShareMenu';
import * as history from '../editor/history';

export default function Topbar({ route }: { route: Route }) {
  const sidebarOpen = useStore((s) => s.settings.sidebarOpen);
  const s = useStore.getState();
  return (
    <header className="topbar">
      {!sidebarOpen && <Tip label="Open sidebar" kbd={`${MOD}\\`}><button className="icon-btn sm" onClick={() => s.updateSettings({ sidebarOpen: true })}><ChevronsRight size={18} /></button></Tip>}
      <div className="tb-nav">
        <Tip label="Go back" kbd={`${MOD}[`}><button className="icon-btn sm" onClick={() => window.history.back()}><ChevronLeft size={16} /></button></Tip>
        <Tip label="Go forward" kbd={`${MOD}]`}><button className="icon-btn sm" onClick={() => window.history.forward()}><ChevronRight size={16} /></button></Tip>
      </div>
      {route.name === 'page' ? <PageTopbar id={route.id} /> : (
        <div className="crumbs">
          <span className="crumb static">
            {route.name === 'home' && <><Home size={15} /> Home</>}
            {route.name === 'inbox' && <><Inbox size={15} /> Inbox</>}
            {route.name === 'meetings' && <><Mic size={15} /> Meetings</>}
            {route.name === 'ai' && <><Sparkles size={15} /> Moving AI</>}
          </span>
        </div>
      )}
    </header>
  );
}

function PageTopbar({ id }: { id: string }) {
  const s = useStore();
  const page = s.pages[id];
  const [share, setShare] = useState<HTMLElement | null>(null);
  const [more, setMore] = useState<HTMLElement | null>(null);
  const [crumbMenu, setCrumbMenu] = useState<{ el: HTMLElement; id: string } | null>(null);
  if (!page) return <div className="crumbs" />;
  const crumbs = breadcrumbs(s, id);
  const shown = crumbs.length > 4 ? [crumbs[0], null, ...crumbs.slice(-2)] : crumbs;
  const isFav = (s.favorites[s.wsId] ?? []).includes(id);
  const commentCount = Object.values(s.comments).filter((c) => c.pageId === id && !c.resolved).length;
  const section = page.section !== 'private' && !page.dbId ? s.teamspaces[page.section] : null;

  return (
    <>
      <div className="crumbs">
        {section && <span className="crumb static faint">{section.icon} {section.name} <span className="faint">/</span></span>}
        {shown.map((p, i) => (
          <Fragment key={p ? p.id : 'ellipsis'}>
            {i > 0 && <span className="crumb-sep">/</span>}
            {p ? (
              <button className="crumb" onClick={() => goPage(p.id)}
                onMouseEnter={(e) => { const el = e.currentTarget; (el as any)._t = setTimeout(() => setCrumbMenu({ el, id: p.id }), 700); }}
                onMouseLeave={(e) => clearTimeout((e.currentTarget as any)._t)}>
                <PageIcon page={p} size={16} /><span className="ellipsis">{pageTitle(p)}</span>
              </button>
            ) : <span className="crumb static">…</span>}
          </Fragment>
        ))}
        {page.locked && <Tip label="Page is locked"><Lock size={13} className="faint" style={{ marginLeft: 6 }} /></Tip>}
        {page.trashedAt && <span className="badge red">In trash</span>}
      </div>
      <div className="tb-actions">
        <Tip label={`Edited by ${s.users[page.updatedBy]?.name ?? 'You'}`}><span className="tb-edited" onClick={() => s.setPanel('updates')}>Edited {timeAgo(page.updatedAt)}</span></Tip>
        <button className="btn btn-sm tb-share" onClick={(e) => setShare(e.currentTarget)}>Share</button>
        <Tip label="View all comments" kbd={`${MOD}${SHIFT}M`}><button className={cx('icon-btn', s.panel === 'comments' && 'active')} onClick={() => s.setPanel('comments')}><MessageSquare size={17} />{commentCount > 0 && <span className="dot-count">{commentCount}</span>}</button></Tip>
        <Tip label="View all updates"><button className={cx('icon-btn', s.panel === 'updates' && 'active')} onClick={() => s.setPanel('updates')}><Clock size={17} /></button></Tip>
        <Tip label={isFav ? 'Remove from Favorites' : 'Add to Favorites'}><button className={cx('icon-btn', isFav && 'fav')} onClick={() => s.toggleFavorite(id)}><Star size={17} fill={isFav ? 'currentColor' : 'none'} /></button></Tip>
        <Tip label="Ask Moving AI" kbd={`${MOD}J`}><button className={cx('icon-btn', s.panel === 'ai' && 'active')} onClick={() => s.setPanel('ai')}><Sparkles size={17} /></button></Tip>
        <Tip label="Style, export, and more…"><button className="icon-btn" onClick={(e) => setMore(e.currentTarget)}><MoreHorizontal size={18} /></button></Tip>
      </div>
      {share && <ShareMenu pageId={id} anchor={share} onClose={() => setShare(null)} />}
      {more && <PageMenu pageId={id} anchor={more} onClose={() => setMore(null)} />}
      {crumbMenu && <CrumbSiblings id={crumbMenu.id} anchor={crumbMenu.el} onClose={() => setCrumbMenu(null)} />}
    </>
  );
}

function CrumbSiblings({ id, anchor, onClose }: { id: string; anchor: HTMLElement; onClose: () => void }) {
  const s = useStore.getState();
  const p = s.pages[id];
  const siblings = Object.values(s.pages).filter((x) => !x.trashedAt && !x.isTemplate && x.wsId === s.wsId && (p.dbId ? x.dbId === p.dbId : x.parentId === p.parentId && !x.dbId && (p.parentId || x.section === p.section))).sort((a, b) => a.order - b.order).slice(0, 20);
  return (
    <div onMouseLeave={onClose}>
      <MenuPopover anchor={anchor} onClose={onClose} width={240} items={siblings.map((x) => ({ label: pageTitle(x), icon: <PageIcon page={x} size={16} />, checked: x.id === id, onClick: () => goPage(x.id) }))} />
    </div>
  );
}

export function PageMenu({ pageId, anchor, onClose }: { pageId: string; anchor: HTMLElement; onClose: () => void }) {
  const s = useStore();
  const page = s.pages[pageId];
  if (!page) return null;
  const isFav = (s.favorites[s.wsId] ?? []).includes(pageId);
  const words = blocksText(page.content).trim().split(/\s+/).filter(Boolean).length;
  const font = page.font ?? 'default';
  const set = (patch: Partial<typeof page>) => s.updatePage(pageId, patch);
  const fontTile = (f: typeof font, label: string, cls: string) => (
    <button className={cx('font-tile', font === f && 'on')} onClick={() => set({ font: f })}><span className={cls}>Ag</span><span>{label}</span></button>
  );
  return (
    <Popover anchor={anchor} onClose={onClose} placement="bottom-end">
      <div className="menu page-menu" style={{ width: 280 }}>
        <div className="menu-header">Style</div>
        <div className="font-tiles">{fontTile('default', 'Default', 'f-default')}{fontTile('serif', 'Serif', 'f-serif')}{fontTile('mono', 'Mono', 'f-mono')}</div>
        <Menu width={280} onClose={onClose} items={[
          { label: <span className="row grow" style={{ justifyContent: 'space-between' }}>Small text <Toggle on={!!page.smallText} onChange={(v) => set({ smallText: v })} /></span>, icon: <Type size={16} />, keepOpen: true, onClick: () => set({ smallText: !page.smallText }) },
          { label: <span className="row grow" style={{ justifyContent: 'space-between' }}>Full width <Toggle on={!!page.fullWidth} onChange={(v) => set({ fullWidth: v })} /></span>, icon: <Maximize size={16} />, keepOpen: true, onClick: () => set({ fullWidth: !page.fullWidth }) },
          { label: 'Customize page', icon: <LayoutTemplate size={16} />, submenu: [
            { header: 'Backlinks' },
            { label: 'Show expanded', checked: page.backlinksMode === 'expanded', onClick: () => set({ backlinksMode: 'expanded' }) },
            { label: 'Show in popover', checked: (page.backlinksMode ?? 'popover') === 'popover', onClick: () => set({ backlinksMode: 'popover' }) },
            { label: 'Off', checked: page.backlinksMode === 'off', onClick: () => set({ backlinksMode: 'off' }) },
            { header: 'Page discussions' },
            { label: 'Show expanded', checked: (page.commentsMode ?? 'expanded') === 'expanded', onClick: () => set({ commentsMode: 'expanded' }) },
            { label: 'Off', checked: page.commentsMode === 'off', onClick: () => set({ commentsMode: 'off' }) },
          ] },
          { divider: true },
          { label: <span className="row grow" style={{ justifyContent: 'space-between' }}>Lock page <Toggle on={!!page.locked} onChange={(v) => set({ locked: v })} /></span>, icon: page.locked ? <Lock size={16} /> : <Unlock size={16} />, keepOpen: true, onClick: () => set({ locked: !page.locked }) },
          { divider: true },
          { label: isFav ? 'Remove from Favorites' : 'Add to Favorites', icon: <Star size={16} />, onClick: () => s.toggleFavorite(pageId) },
          { label: 'Copy link', icon: <Link2 size={16} />, kbd: `${MOD}L`, onClick: () => { navigator.clipboard.writeText(pageUrl(pageId)); s.showToast('Copied link to clipboard'); } },
          { label: 'Duplicate', icon: <Copy size={16} />, kbd: `${MOD}D`, onClick: () => goPage(s.duplicatePage(pageId)) },
          { label: 'Move to', icon: <CornerUpRight size={16} />, kbd: `${MOD}${SHIFT}P`, onClick: () => s.openModal('moveTo', { kind: 'page', ids: [pageId] }) },
          { label: 'Move to Trash', icon: <Trash2 size={16} />, danger: true, onClick: () => { s.trashPage(pageId); s.showToast('Moved to Trash', { label: 'Undo', run: () => useStore.getState().restorePage(pageId) }); } },
          { divider: true },
          { label: 'Undo', icon: <Undo2 size={16} />, kbd: `${MOD}Z`, onClick: () => { const prev = history.undo(pageId, page.content); if (prev) s.setContent(pageId, prev); } },
          { label: 'Page history', icon: <History size={16} />, onClick: () => s.openModal('history', pageId) },
          { label: 'Show deleted pages', icon: <Trash2 size={16} />, onClick: () => s.openModal('trash', pageId) },
          { label: 'Notifications', icon: <Bell size={16} />, submenu: [
            { label: 'All comments', checked: true, onClick: () => s.showToast('You’ll be notified about all comments') },
            { label: 'Replies & mentions', onClick: () => s.showToast('You’ll be notified about replies and @mentions') },
            { label: 'Off', onClick: () => s.showToast('Notifications for this page turned off') },
          ] },
          { divider: true },
          { label: 'Translate', icon: <Languages size={16} />, submenu: ['English', 'Hindi', 'Spanish', 'French', 'German', 'Japanese', 'Chinese (Simplified)', 'Portuguese'].map((l) => ({ label: l, onClick: () => { s.setPanel('ai'); window.dispatchEvent(new CustomEvent('moving:ai-prompt', { detail: `Translate this page into ${l} and create it as a new sub-page.` })); } })) },
          { label: 'Import', icon: <Upload size={16} />, onClick: () => s.openModal('import', { into: pageId }) },
          { label: 'Export', icon: <Download size={16} />, onClick: () => s.openModal('export', { pageId }) },
          { label: 'Page analytics', icon: <BarChart2 size={16} />, onClick: () => s.showToast(`Created ${fmtDate(page.createdAt)} · ${page.versions?.length ?? 0} saved versions · ${words} words`) },
        ]} />
        <div className="menu-footer col" style={{ gap: 2, alignItems: 'flex-start' }}>
          <span>Word count: {words}</span>
          <span>Last edited by {s.users[page.updatedBy]?.name ?? 'You'}</span>
          <span>{fmtDate(page.updatedAt, true)}</span>
        </div>
      </div>
    </Popover>
  );
}

