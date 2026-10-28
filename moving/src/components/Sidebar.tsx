import React, { useState } from 'react';
import {
  ChevronsLeft, SquarePen, Search, Home, Inbox, Sparkles, Settings, LayoutTemplate, Trash2, UserPlus, ChevronRight, Plus,
  MoreHorizontal, Star, StarOff, Link2, Copy, PenLine, CornerUpRight, ExternalLink, PanelRight, ChevronDown, Check, LogOut,
  FileText, Mic, Users, Lock, HelpCircle, Keyboard, Database as DbIcon, Download,
} from 'lucide-react';
import { useStore, childPages, pageTitle } from '../store/store';
import type { Page } from '../store/types';
import { useRoute, goPage, navigate, pageUrl } from '../lib/router';
import { PageIcon, MenuPopover, Tip, Popover, Avatar, ConfirmDialog } from './ui';
import { cx, MOD, SHIFT, timeAgo, isMac } from '../lib/util';
import { PageOps } from '../editor/ops';

export default function Sidebar() {
  const open = useStore((s) => s.settings.sidebarOpen);
  const width = useStore((s) => s.settings.sidebarWidth);
  const [peek, setPeek] = useState(false);
  const st = useStore.getState();

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const x0 = e.clientX, w0 = width;
    const move = (ev: MouseEvent) => useStore.getState().updateSettings({ sidebarWidth: Math.max(200, Math.min(480, w0 + ev.clientX - x0)) });
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); document.body.style.cursor = ''; };
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  if (!open) {
    return (
      <>
        <div className="sidebar-hover-zone" onMouseEnter={() => setPeek(true)} />
        {peek && (
          <div className="sidebar sidebar-floating" style={{ width }} onMouseLeave={() => setPeek(false)}>
            <SidebarContent floating />
          </div>
        )}
      </>
    );
  }
  void st;
  return (
    <aside className="sidebar" style={{ width }}>
      <SidebarContent />
      <div className="sidebar-resize" onMouseDown={startResize} onDoubleClick={() => useStore.getState().updateSettings({ sidebarWidth: 248 })} />
    </aside>
  );
}

function SidebarContent({ floating }: { floating?: boolean }) {
  const s = useStore();
  const route = useRoute();
  const ws = s.workspaces[s.wsId];
  const unread = Object.values(s.notifications).filter((n) => n.wsId === s.wsId && !n.read && !n.archived).length;
  const favorites = (s.favorites[s.wsId] ?? []).map((id) => s.pages[id]).filter((p) => p && !p.trashedAt);
  const teamspaces = Object.values(s.teamspaces).filter((t) => t.wsId === s.wsId && t.members.includes(s.meId)).sort((a, b) => a.order - b.order);
  const privatePages = childPages(s, null, 'private');
  const sharedPages = Object.values(s.pages).filter((p) => p.wsId === s.wsId && !p.trashedAt && !p.dbId && !p.isTemplate && p.section === 'private' && !p.parentId && (p.invites?.length ?? 0) > 0);
  const [wsMenu, setWsMenu] = useState<HTMLElement | null>(null);
  const [help, setHelp] = useState<HTMLElement | null>(null);
  const collapsed = (k: string) => s.collapsedSections.includes(k);
  const active = route.name === 'page' ? route.id : null;
  const recentAgentChats = Object.values(s.aiChats).length;

  const newPage = (section: Page['section'] = 'private', parentId: string | null = null) => {
    const id = s.createPage({ section, parentId });
    goPage(id);
  };

  return (
    <div className="sidebar-inner">
      <div className="sb-top">
        <button className="sb-ws" onClick={(e) => setWsMenu(e.currentTarget)}>
          <span className="sb-ws-icon">{ws?.icon && ws.icon.length <= 3 ? ws.icon : <img src={ws?.icon} alt="" />}</span>
          <span className="sb-ws-name ellipsis">{ws?.name}</span>
          <ChevronDown size={14} className="faint" />
        </button>
        {!floating && <Tip label="Close sidebar" kbd={`${MOD}\\`}><button className="icon-btn sm sb-collapse" onClick={() => s.updateSettings({ sidebarOpen: false })}><ChevronsLeft size={18} /></button></Tip>}
        {floating && <Tip label="Lock sidebar open" kbd={`${MOD}\\`}><button className="icon-btn sm" onClick={() => s.updateSettings({ sidebarOpen: true })}><ChevronsLeft size={18} style={{ transform: 'rotate(180deg)' }} /></button></Tip>}
        <Tip label="Create a new page" kbd={`${MOD}N`}><button className="icon-btn sm" onClick={() => newPage()}><SquarePen size={17} /></button></Tip>
      </div>

      <nav className="sb-nav">
        <SbItem icon={<Search size={17} />} label="Search" kbd={`${MOD}K`} onClick={() => s.openModal('search')} />
        <SbItem icon={<Home size={17} />} label="Home" active={route.name === 'home'} onClick={() => navigate('/home')} />
        <SbItem icon={<Mic size={17} />} label="Meetings" active={route.name === 'meetings'} onClick={() => navigate('/meetings')} />
        <SbItem icon={<Sparkles size={17} />} label="Moving AI" active={route.name === 'ai'} onClick={() => navigate('/ai')} right={recentAgentChats ? undefined : <span className="sb-badge-new">New</span>} />
        <SbItem icon={<Inbox size={17} />} label="Inbox" active={route.name === 'inbox'} onClick={() => navigate('/inbox')} right={unread ? <span className="sb-count">{unread}</span> : undefined} />
      </nav>

      <div className="sb-scroll"
        onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-moving-page')) e.preventDefault(); }}>
        {favorites.length > 0 && (
          <Section title="Favorites" k="favorites">
            {favorites.map((p) => <PageItem key={'f' + p.id} page={p} depth={0} active={active} favorite />)}
          </Section>
        )}
        <Section title="Teamspaces" k="teamspaces" onAdd={() => s.openModal('teamspace')} addLabel="Create a teamspace">
          {teamspaces.map((t) => (
            <TeamspaceItem key={t.id} id={t.id} active={active} onNew={() => newPage(t.id)} />
          ))}
        </Section>
        {sharedPages.length > 0 && (
          <Section title="Shared" k="shared">
            {sharedPages.map((p) => <PageItem key={'s' + p.id} page={p} depth={0} active={active} />)}
          </Section>
        )}
        <Section title="Private" k="private" onAdd={() => newPage('private')} addLabel="Add a page">
          <DropZone section="private" />
          {privatePages.map((p) => <PageItem key={p.id} page={p} depth={0} active={active} />)}
          {privatePages.length === 0 && <div className="sb-empty">No pages inside</div>}
        </Section>

        <nav className="sb-nav sb-bottom-nav">
          <SbItem icon={<Settings size={17} />} label="Settings" onClick={() => s.openModal('settings')} />
          <SbItem icon={<LayoutTemplate size={17} />} label="Templates" onClick={() => s.openModal('templates')} />
          <SbItem icon={<Trash2 size={17} />} label="Trash" onClick={() => s.openModal('trash')} />
        </nav>
      </div>

      <div className="sb-footer">
        <button className="sb-invite" onClick={() => s.openModal('settings', 'people')}><UserPlus size={16} /> Invite members</button>
        <Tip label="Help & support"><button className="icon-btn sm" onClick={(e) => setHelp(e.currentTarget)}><HelpCircle size={16} /></button></Tip>
      </div>

      {wsMenu && <WorkspaceMenu anchor={wsMenu} onClose={() => setWsMenu(null)} />}
      {help && <MenuPopover anchor={help} onClose={() => setHelp(null)} width={240} items={[
        { label: 'Keyboard shortcuts', icon: <Keyboard size={16} />, kbd: '?', onClick: () => s.openModal('shortcuts') },
        { label: 'What’s new', icon: <Sparkles size={16} />, onClick: () => s.showToast('Moving 1.0 — everything is new!') },
        { label: 'Export workspace', icon: <Download size={16} />, onClick: () => s.openModal('export', { all: true }) },
        { label: 'Import', icon: <FileText size={16} />, onClick: () => s.openModal('import') },
        { divider: true },
        { label: 'Moving 1.0.0 · Local-first', disabled: true },
      ]} />}
    </div>
  );
}

function SbItem({ icon, label, onClick, active, kbd, right }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean; kbd?: string; right?: React.ReactNode }) {
  return (
    <button className={cx('sb-item', active && 'active')} onClick={onClick}>
      <span className="sb-icon">{icon}</span>
      <span className="sb-label">{label}</span>
      {right}
      {kbd && <span className="kbd sb-kbd">{kbd}</span>}
    </button>
  );
}

function Section({ title, k, children, onAdd, addLabel }: { title: string; k: string; children: React.ReactNode; onAdd?: () => void; addLabel?: string }) {
  const collapsed = useStore((s) => s.collapsedSections.includes(k));
  const toggle = useStore((s) => s.toggleSection);
  return (
    <div className="sb-section">
      <div className="sb-section-head" onClick={() => toggle(k)}>
        <span>{title}</span>
        <ChevronDown size={12} className={cx('sb-section-chev', collapsed && 'collapsed')} />
        <div className="grow" />
        {onAdd && <Tip label={addLabel ?? 'Add'}><button className="icon-btn sm sb-hover" onClick={(e) => { e.stopPropagation(); onAdd(); }}><Plus size={14} /></button></Tip>}
      </div>
      {!collapsed && <div>{children}</div>}
    </div>
  );
}

function DropZone({ section, parentId }: { section?: string; parentId?: string }) {
  const [over, setOver] = useState(false);
  return (
    <div className={cx('sb-dropzone', over && 'over')}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-moving-page')) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { setOver(false); const id = e.dataTransfer.getData('application/x-moving-page'); if (id) useStore.getState().movePage(id, { parentId: parentId ?? null, section: section as any, beforeId: undefined }); }} />
  );
}

function TeamspaceItem({ id, active, onNew }: { id: string; active: string | null; onNew: () => void }) {
  const s = useStore();
  const t = s.teamspaces[id];
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [leave, setLeave] = useState(false);
  const open = !s.collapsedSections.includes('ts-' + id);
  const pages = childPages(s, null, id);
  return (
    <div>
      <div className="sb-page sb-teamspace" onClick={() => s.toggleSection('ts-' + id)}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-moving-page')) e.preventDefault(); }}
        onDrop={(e) => { const pid = e.dataTransfer.getData('application/x-moving-page'); if (pid) s.movePage(pid, { parentId: null, section: id }); }}>
        <span className="sb-page-icon ts-icon">{t.icon}</span>
        <span className="sb-label ellipsis">{t.name}</span>
        {t.access === 'private' && <Lock size={11} className="faint" />}
        <div className="sb-page-actions">
          <button className="icon-btn sm" onClick={(e) => { e.stopPropagation(); setMenu(e.currentTarget); }}><MoreHorizontal size={14} /></button>
          <button className="icon-btn sm" onClick={(e) => { e.stopPropagation(); onNew(); }}><Plus size={14} /></button>
        </div>
      </div>
      {open && (
        <div>
          {pages.map((p) => <PageItem key={p.id} page={p} depth={1} active={active} />)}
          {pages.length === 0 && <div className="sb-empty" style={{ paddingLeft: 30 }}>No pages inside</div>}
        </div>
      )}
      {menu && <MenuPopover anchor={menu} onClose={() => setMenu(null)} width={240} items={[
        { label: 'Teamspace settings', icon: <Settings size={16} />, onClick: () => s.openModal('teamspace', id) },
        { label: 'Members', icon: <Users size={16} />, right: <span className="faint small">{t.members.length}</span>, onClick: () => s.openModal('teamspace', id) },
        { label: 'Add page', icon: <Plus size={16} />, onClick: onNew },
        { label: 'Copy link', icon: <Link2 size={16} />, onClick: () => navigator.clipboard.writeText(location.href) },
        { divider: true },
        { label: 'Leave teamspace', icon: <LogOut size={16} />, danger: true, disabled: t.access === 'default', onClick: () => setLeave(true) },
      ]} />}
      {leave && <ConfirmDialog title={`Leave ${t.name}?`} body="You'll lose access to its pages unless they're shared with you." danger confirm="Leave" onConfirm={() => s.updateTeamspace(id, { members: t.members.filter((m) => m !== s.meId) })} onClose={() => setLeave(false)} />}
    </div>
  );
}

export function PageItem({ page, depth, active, favorite }: { page: Page; depth: number; active: string | null; favorite?: boolean }) {
  const s = useStore();
  const expanded = s.expanded.includes(page.id + (favorite ? ':f' : ''));
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [rename, setRename] = useState<HTMLElement | null>(null);
  const [drop, setDrop] = useState<'before' | 'inside' | 'after' | null>(null);
  const children = page.isDb ? [] : childPages(s, page.id);
  const dbRows = page.isDb ? Object.values(s.pages).filter((p) => p.dbId === page.isDb && !p.trashedAt && !p.isTemplate).sort((a, b) => a.order - b.order).slice(0, 30) : [];
  const kids = page.isDb ? dbRows : children;
  const isFav = (s.favorites[s.wsId] ?? []).includes(page.id);
  const key = page.id + (favorite ? ':f' : '');

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const where = drop;
    setDrop(null);
    const pid = e.dataTransfer.getData('application/x-moving-page');
    const blocks = e.dataTransfer.getData('application/x-moving-blocks');
    if (blocks) {
      const { pageId, ids } = JSON.parse(blocks);
      new PageOps(pageId).moveToPage(ids, page.id);
      s.showToast(`Moved ${ids.length} block${ids.length > 1 ? 's' : ''} to “${pageTitle(page)}”`);
      return;
    }
    if (!pid || pid === page.id) return;
    if (where === 'inside') s.movePage(pid, { parentId: page.id });
    else {
      const siblings = page.parentId ? childPages(s, page.parentId) : childPages(s, null, page.section);
      const i = siblings.findIndex((x) => x.id === page.id);
      const before = where === 'before' ? page.id : siblings[i + 1]?.id ?? null;
      s.movePage(pid, { parentId: page.parentId, section: page.section, beforeId: before });
    }
  };

  return (
    <div>
      <div
        className={cx('sb-page', active === page.id && 'active', drop && `drop-${drop}`)}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={(e) => { if (e.metaKey || e.ctrlKey) window.open(pageUrl(page.id), '_blank'); else goPage(page.id); }}
        draggable={!page.dbId}
        onDragStart={(e) => { e.dataTransfer.setData('application/x-moving-page', page.id); e.dataTransfer.effectAllowed = 'move'; }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('application/x-moving-page') && !e.dataTransfer.types.includes('application/x-moving-blocks')) return;
          e.preventDefault();
          e.stopPropagation();
          const r = e.currentTarget.getBoundingClientRect();
          const y = e.clientY - r.top;
          setDrop(e.dataTransfer.types.includes('application/x-moving-blocks') ? 'inside' : y < r.height * 0.25 ? 'before' : y > r.height * 0.75 ? 'after' : 'inside');
        }}
        onDragLeave={() => setDrop(null)}
        onDrop={onDrop}
        onContextMenu={(e) => { e.preventDefault(); setMenu(e.currentTarget); }}
      >
        <button className="sb-toggle" onClick={(e) => { e.stopPropagation(); s.setExpanded(key, !expanded); }}>
          <span className="sb-page-icon-wrap">
            <span className="sb-page-icon"><PageIcon page={page} size={18} /></span>
            <ChevronRight size={14} className={cx('sb-chev', expanded && 'open')} />
          </span>
        </button>
        <span className="sb-label ellipsis">{pageTitle(page)}</span>
        <div className="sb-page-actions">
          <Tip label="Delete, duplicate, and more…"><button className="icon-btn sm" onClick={(e) => { e.stopPropagation(); setMenu(e.currentTarget); }}><MoreHorizontal size={14} /></button></Tip>
          {!page.dbId && <Tip label={page.isDb ? 'Add a page to this database' : 'Add a page inside'}><button className="icon-btn sm" onClick={(e) => {
            e.stopPropagation();
            if (page.isDb) { const id = s.addRow(page.isDb); s.setExpanded(key, true); goPage(id); return; }
            const id = s.createPage({ parentId: page.id });
            s.mutateContent(page.id, (d) => { d.push({ id: Math.random().toString(36).slice(2), type: 'page', html: '', pageId: id }); });
            s.setExpanded(key, true);
            goPage(id);
          }}><Plus size={14} /></button></Tip>}
        </div>
      </div>
      {expanded && (
        <div>
          {kids.map((c) => <PageItem key={c.id} page={c} depth={depth + 1} active={active} favorite={favorite} />)}
          {kids.length === 0 && <div className="sb-empty" style={{ paddingLeft: 8 + (depth + 1) * 14 + 22 }}>{page.isDb ? 'No pages inside' : 'No pages inside'}</div>}
        </div>
      )}
      {menu && (
        <MenuPopover anchor={menu} onClose={() => setMenu(null)} width={260} searchable placeholder="Search actions…" items={[
          { label: isFav ? 'Remove from Favorites' : 'Add to Favorites', icon: isFav ? <StarOff size={16} /> : <Star size={16} />, onClick: () => s.toggleFavorite(page.id) },
          { divider: true },
          { label: 'Copy link', icon: <Link2 size={16} />, kbd: `${MOD}L`, onClick: () => { navigator.clipboard.writeText(pageUrl(page.id)); s.showToast('Copied link to clipboard'); } },
          { label: 'Duplicate', icon: <Copy size={16} />, kbd: `${MOD}D`, onClick: () => { const id = s.duplicatePage(page.id); goPage(id); } },
          { label: 'Rename', icon: <PenLine size={16} />, kbd: `${MOD}${SHIFT}R`, onClick: () => setTimeout(() => setRename(menu), 0) },
          { label: 'Move to', icon: <CornerUpRight size={16} />, kbd: `${MOD}${SHIFT}P`, onClick: () => s.openModal('moveTo', { kind: 'page', ids: [page.id] }) },
          { label: 'Move to Trash', icon: <Trash2 size={16} />, kbd: 'Del', danger: true, onClick: () => { s.trashPage(page.id); s.showToast(`Moved “${pageTitle(page)}” to Trash`, { label: 'Undo', run: () => useStore.getState().restorePage(page.id) }); } },
          { divider: true },
          { label: 'Open in new tab', icon: <ExternalLink size={16} />, kbd: `${MOD}${isMac ? '' : '+'}Click`, onClick: () => window.open(pageUrl(page.id), '_blank') },
          { label: 'Open in side peek', icon: <PanelRight size={16} />, onClick: () => s.setPeek({ pageId: page.id, mode: 'side' }) },
          ...(page.isDb ? [{ label: 'Open as database', icon: <DbIcon size={16} />, onClick: () => goPage(page.id) }] : []),
          { divider: true },
          { label: `Last edited by ${s.users[page.updatedBy]?.name ?? 'You'}`, disabled: true },
          { label: timeAgo(page.updatedAt), disabled: true },
        ]} />
      )}
      {rename && <RenamePopover page={page} anchor={rename} onClose={() => setRename(null)} />}
    </div>
  );
}

export function RenamePopover({ page, anchor, onClose }: { page: Page; anchor: HTMLElement; onClose: () => void }) {
  const s = useStore.getState();
  const [title, setTitle] = useState(page.title);
  const [iconOpen, setIconOpen] = useState<HTMLElement | null>(null);
  return (
    <Popover anchor={anchor} onClose={() => { s.updatePage(page.id, { title }); onClose(); }}>
      <div className="menu row" style={{ padding: 6, width: 340 }}>
        <button className="icon-btn" onClick={(e) => setIconOpen(e.currentTarget)}><PageIcon page={page} size={20} /></button>
        <input autoFocus className="input" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { s.updatePage(page.id, { title }); onClose(); } }} onFocus={(e) => e.target.select()} />
      </div>
      {iconOpen && <IconPickerPopover anchor={iconOpen} onClose={() => setIconOpen(null)} onPick={(icon) => { s.updatePage(page.id, { icon: icon ?? undefined }); setIconOpen(null); }} />}
    </Popover>
  );
}

import IconPicker from './IconPicker';
export function IconPickerPopover({ anchor, onClose, onPick }: { anchor: HTMLElement; onClose: () => void; onPick: (icon: string | null) => void }) {
  return <Popover anchor={anchor} onClose={onClose}><IconPicker onPick={onPick} /></Popover>;
}

function WorkspaceMenu({ anchor, onClose }: { anchor: HTMLElement; onClose: () => void }) {
  const s = useStore();
  const me = s.users[s.meId];
  const ws = s.workspaces[s.wsId];
  return (
    <Popover anchor={anchor} onClose={onClose} width={300}>
      <div className="menu ws-menu">
        <div className="ws-menu-head">
          <span className="sb-ws-icon big">{ws.icon.length <= 3 ? ws.icon : <img src={ws.icon} alt="" />}</span>
          <div className="grow">
            <div className="ellipsis"><b>{ws.name}</b></div>
            <div className="faint small">{ws.plan[0].toUpperCase() + ws.plan.slice(1)} Plan · {ws.members.length} member{ws.members.length === 1 ? '' : 's'}</div>
          </div>
        </div>
        <div className="row" style={{ padding: '0 10px 8px', gap: 6 }}>
          <button className="btn btn-sm btn-outline" onClick={() => { s.openModal('settings'); onClose(); }}><Settings size={13} /> Settings</button>
          <button className="btn btn-sm btn-outline" onClick={() => { s.openModal('settings', 'people'); onClose(); }}><UserPlus size={13} /> Invite members</button>
        </div>
        <div className="sep" />
        <div className="menu-header row" style={{ justifyContent: 'space-between' }}>{me.email}</div>
        {Object.values(s.workspaces).map((w) => (
          <div key={w.id} className="menu-item" onClick={() => { s.switchWorkspace(w.id); const last = s.lastPage[w.id]; navigate(last ? `/page/${last}` : '/home'); onClose(); }}>
            <span className="sb-ws-icon">{w.icon.length <= 3 ? w.icon : <img src={w.icon} alt="" />}</span>
            <span className="menu-label ellipsis">{w.name}</span>
            {w.id === s.wsId && <Check size={14} />}
          </div>
        ))}
        <div className="menu-item" onClick={() => { s.openModal('createWorkspace'); onClose(); }}><span className="menu-icon"><Plus size={16} /></span><span className="menu-label">New workspace</span></div>
        <div className="sep" />
        <div className="menu-item" onClick={() => { s.openModal('settings', 'account'); onClose(); }}><Avatar user={me} size={20} /><span className="menu-label">{me.name}</span><span className="faint small">Account</span></div>
        <div className="menu-item" onClick={() => { s.openModal('export', { all: true }); onClose(); }}><span className="menu-icon"><Download size={16} /></span><span className="menu-label">Back up all data</span></div>
      </div>
    </Popover>
  );
}
