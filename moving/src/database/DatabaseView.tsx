import React, { useEffect, useMemo, useState } from 'react';
import {
  Table2, Kanban, List as ListIcon, LayoutGrid, CalendarDays, GanttChart, BarChart3, ClipboardList, Rss, Plus, Filter, ArrowUpDown,
  Zap, Search, Maximize2, MoreHorizontal, ChevronDown, FileText, Lock, X,
} from 'lucide-react';
import type { View, ViewType, PropValue } from '../store/types';
import { useStore, VIEW_NAMES, pageTitle } from '../store/store';
import { Popover, Menu, MenuPopover, Tip, type MenuItemDef, PageIcon } from '../components/ui';
import { queryView, countRules } from './logic';
import type { ViewProps } from './viewTypes';
import { FilterBar, FilterBuilder, SortBuilder } from './FilterSort';
import ViewSettings from './ViewSettings';
import AutomationsPanel from './AutomationsPanel';
import TableView from './views/TableView';
import BoardView from './views/BoardView';
import GalleryView from './views/GalleryView';
import ListView from './views/ListView';
import CalendarView from './views/CalendarView';
import TimelineView from './views/TimelineView';
import ChartView from './views/ChartView';
import FormView from './views/FormView';
import FeedView from './views/FeedView';
import { goPage } from '../lib/router';
import { cx } from '../lib/util';

export const VIEW_ICONS: Record<ViewType, typeof Table2> = {
  table: Table2, board: Kanban, list: ListIcon, gallery: LayoutGrid, calendar: CalendarDays, timeline: GanttChart, chart: BarChart3, form: ClipboardList, feed: Rss,
};

const COMPONENTS: Record<ViewType, React.ComponentType<ViewProps>> = {
  table: TableView, board: BoardView, list: ListView, gallery: GalleryView, calendar: CalendarView,
  timeline: TimelineView, chart: ChartView, form: FormView, feed: FeedView,
};

export default function DatabaseView({ dbId, inline, linked, blockId, readOnly = false }: { dbId: string; inline?: boolean; linked?: boolean; blockId?: string; readOnly?: boolean }) {
  const db = useStore((s) => s.databases[dbId]);
  const pages = useStore((s) => s.pages);
  const st = useStore.getState();
  const storeKey = `moving-view-${blockId ?? dbId}`;
  const [viewId, setViewId] = useState<string>(() => { try { return localStorage.getItem(storeKey) ?? ''; } catch { return ''; } });
  const [search, setSearch] = useState<string | null>(null);
  const [pop, setPop] = useState<null | { kind: 'filter' | 'sort' | 'settings' | 'automations' | 'addView' | 'tab' | 'new'; el: HTMLElement; view?: View }>(null);

  const view = db?.views.find((v) => v.id === viewId) ?? db?.views[0];
  useEffect(() => { if (view) { try { localStorage.setItem(storeKey, view.id); } catch { /* ignore */ } } }, [view, storeKey]);
  useEffect(() => {
    const open = (e: Event) => { const d = (e as CustomEvent).detail; if (d.viewId === view?.id) { const el = document.querySelector(`[data-dbtool="filter-${view.id}"]`) as HTMLElement; if (el) setPop({ kind: 'filter', el }); } };
    window.addEventListener('moving:open-filter', open);
    return () => window.removeEventListener('moving:open-filter', open);
  }, [view?.id]);

  const rows = useMemo(() => (db && view ? queryView(useStore.getState(), db, view, search ?? '') : []), [db, view, search, pages]);

  if (!db || !view) return <div className="faint">Database not found</div>;
  const ro = readOnly;
  const locked = db.locked || ro;
  const host = pages[db.pageId];
  const title = inline ? db.title : (host?.title ?? db.title);

  const openRow = (id: string) => {
    const mode = view.openIn ?? 'side';
    if (mode === 'full') goPage(id);
    else st.setPeek({ pageId: id, mode: mode === 'center' ? 'center' : 'side' });
  };
  const addRow = (props: Record<string, PropValue> = {}, opts: { open?: boolean; title?: string } = {}) => {
    // pre-fill values that satisfy simple filters so the new row stays visible
    const pre: Record<string, PropValue> = {};
    for (const r of view.filter.conj === 'and' ? view.filter.rules : []) {
      const rule = r as any;
      if (rule.rules) continue;
      const p = db.properties.find((x) => x.id === rule.propId);
      if (!p || rule.value == null || rule.value === '') continue;
      if ((p.type === 'select' || p.type === 'status') && rule.op === 'is') pre[p.id] = Array.isArray(rule.value) ? rule.value[0] : rule.value;
      if ((p.type === 'multi_select' || p.type === 'person') && rule.op === 'contains') pre[p.id] = Array.isArray(rule.value) ? rule.value : [rule.value];
      if (p.type === 'checkbox' && rule.op === 'checked') pre[p.id] = true;
    }
    if (view.filter.rules.some((r: any) => r.op === 'me')) { const p = db.properties.find((x) => x.id === (view.filter.rules.find((r: any) => r.op === 'me') as any).propId); if (p?.type === 'person') pre[p.id] = [st.meId]; }
    const id = st.addRow(db.id, { ...pre, ...props }, view.defaultTemplate, opts.title);
    if (opts.open !== false) openRow(id);
    return id;
  };
  const updateView = (fn: (v: View) => void) => st.updateView(db.id, view.id, fn);
  const Comp = COMPONENTS[view.type];
  const filterCount = countRules(view.filter);

  const addViewItems: MenuItemDef[] = (Object.keys(VIEW_NAMES) as ViewType[]).map((t) => {
    const I = VIEW_ICONS[t];
    return { label: VIEW_NAMES[t], icon: <I size={16} />, onClick: () => setViewId(st.addView(db.id, t)) };
  });

  const templates = db.templates.map((id) => pages[id]).filter((p) => p && !p.trashedAt);

  return (
    <div className={cx('db', inline ? 'db-inline' : 'db-full')}>
      {(inline || linked) && view.showTitle !== false && (
        <div className="db-title-row">
          {linked && <span className="db-linked-arrow" title="Linked view">↗</span>}
          {linked && !inline ? null : (
            <input className="db-title" value={title} placeholder={linked ? pageTitle(host) : 'Untitled'} readOnly={locked || linked}
              onChange={(e) => st.updateDb(db.id, (d) => { d.title = e.target.value; })}
              onClick={() => { if (linked) goPage(db.inline ? db.pageId : db.pageId); }} />
          )}
          {linked && <span className="db-title linked" onClick={() => goPage(db.pageId)}>{db.title || pageTitle(host)}</span>}
          {db.locked && <Lock size={13} className="faint" />}
        </div>
      )}
      {db.showDescription && (
        <input className="db-desc" placeholder="Add a description…" value={db.description ?? ''} readOnly={locked} onChange={(e) => st.updateDb(db.id, (d) => { d.description = e.target.value; })} />
      )}
      <div className="db-toolbar">
        <div className="db-tabs">
          {db.views.map((v) => {
            const I = VIEW_ICONS[v.type];
            return (
              <button key={v.id} className={cx('db-tab', v.id === view.id && 'active')}
                onClick={(e) => { if (v.id === view.id && !locked) setPop({ kind: 'tab', el: e.currentTarget, view: v }); else setViewId(v.id); }}
                onContextMenu={(e) => { e.preventDefault(); if (!locked) setPop({ kind: 'tab', el: e.currentTarget, view: v }); }}>
                <I size={14} /> <span>{v.name}</span>
              </button>
            );
          })}
          {!locked && <Tip label="Add a view"><button className="icon-btn sm" onClick={(e) => setPop({ kind: 'addView', el: e.currentTarget })}><Plus size={14} /></button></Tip>}
        </div>
        <div className="grow" />
        <div className="db-actions">
          {!ro && <Tip label="Filter"><button data-dbtool={`filter-${view.id}`} className={cx('icon-btn sm', filterCount > 0 && 'active')} onClick={(e) => setPop({ kind: 'filter', el: e.currentTarget })}><Filter size={15} /></button></Tip>}
          {!ro && <Tip label="Sort"><button className={cx('icon-btn sm', view.sorts.length > 0 && 'active')} onClick={(e) => setPop({ kind: 'sort', el: e.currentTarget })}><ArrowUpDown size={15} /></button></Tip>}
          {!locked && <Tip label="Automations"><button className={cx('icon-btn sm', db.automations.some((a) => a.enabled) && 'active')} onClick={(e) => setPop({ kind: 'automations', el: e.currentTarget })}><Zap size={15} /></button></Tip>}
          {search === null
            ? <Tip label="Search"><button className="icon-btn sm" onClick={() => setSearch('')}><Search size={15} /></button></Tip>
            : <div className="db-search"><Search size={13} /><input autoFocus placeholder="Type to search…" value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => { if (!search) setSearch(null); }} onKeyDown={(e) => { if (e.key === 'Escape') setSearch(null); }} /><button className="icon-btn sm" onClick={() => setSearch(null)}><X size={12} /></button></div>}
          {inline && <Tip label="Open as full page"><button className="icon-btn sm" onClick={() => goPage(db.inline ? db.pageId : db.pageId)}><Maximize2 size={15} /></button></Tip>}
          {!ro && <Tip label="Settings"><button className="icon-btn sm" onClick={(e) => setPop({ kind: 'settings', el: e.currentTarget })}><MoreHorizontal size={15} /></button></Tip>}
          {!ro && view.type !== 'form' && (
            <div className="new-split">
              <button className="new-main" onClick={() => addRow({}, { open: true })}>New</button>
              <button className="new-caret" onClick={(e) => setPop({ kind: 'new', el: e.currentTarget })}><ChevronDown size={14} /></button>
            </div>
          )}
        </div>
      </div>
      <FilterBar db={db} view={view} readOnly={ro} />
      <div className="db-body">
        <Comp db={db} view={view} rows={rows} readOnly={ro} openRow={openRow} addRow={addRow} updateView={updateView} />
      </div>

      {pop?.kind === 'filter' && <Popover anchor={pop.el} onClose={() => setPop(null)} placement="bottom-end"><FilterBuilder db={db} view={view} /></Popover>}
      {pop?.kind === 'sort' && <Popover anchor={pop.el} onClose={() => setPop(null)} placement="bottom-end"><SortBuilder db={db} view={view} /></Popover>}
      {pop?.kind === 'settings' && <ViewSettings db={db} view={view} anchor={pop.el} onClose={() => setPop(null)} onSwitchView={setViewId} inline={!!inline} />}
      {pop?.kind === 'automations' && <AutomationsPanel db={db} anchor={pop.el} onClose={() => setPop(null)} />}
      {pop?.kind === 'addView' && <MenuPopover anchor={pop.el} onClose={() => setPop(null)} width={220} items={[{ header: 'Add a view' }, ...addViewItems]} />}
      {pop?.kind === 'tab' && pop.view && <TabMenu db={db} view={pop.view} anchor={pop.el} onClose={() => setPop(null)} onSwitch={setViewId} onEdit={(el) => setTimeout(() => setPop({ kind: 'settings', el }), 0)} />}
      {pop?.kind === 'new' && (
        <Popover anchor={pop.el} onClose={() => setPop(null)} placement="bottom-end">
          <Menu width={280} onClose={() => setPop(null)} items={[
            { header: `Templates for ${title || 'this database'}` },
            ...templates.map((t) => ({
              label: <span className="row" style={{ gap: 6 }}><PageIcon page={t} size={16} fallback /> {t.title || 'Untitled'}{view.defaultTemplate === t.id && <span className="badge">Default</span>}</span>,
              onClick: () => { const id = st.addRow(db.id, {}, t.id); openRow(id); },
              submenu: undefined,
              right: <TemplateMore db={db.id} viewId={view.id} templateId={t.id} isDefault={view.defaultTemplate === t.id} />,
            })),
            { label: <span className="row" style={{ gap: 6 }}><FileText size={16} /> Empty page</span>, onClick: () => { const id = st.addRow(db.id, {}, undefined); useStore.getState().mutateContent(id, () => {}); openRow(id); } },
            { divider: true },
            { label: '+ New template', onClick: () => { const id = st.addTemplate(db.id); st.setPeek({ pageId: id, mode: 'center' }); } },
          ]} />
        </Popover>
      )}
    </div>
  );
}

function TemplateMore({ db, viewId, templateId, isDefault }: { db: string; viewId: string; templateId: string; isDefault: boolean }) {
  const [a, setA] = useState<HTMLElement | null>(null);
  const st = useStore.getState();
  return (
    <>
      <button className="icon-btn sm" onClick={(e) => { e.stopPropagation(); setA(e.currentTarget); }}><MoreHorizontal size={14} /></button>
      {a && <MenuPopover anchor={a} onClose={() => setA(null)} width={200} items={[
        { label: isDefault ? 'Remove as default' : 'Set as default', onClick: () => st.updateView(db, viewId, (v) => { v.defaultTemplate = isDefault ? undefined : templateId; }) },
        { label: 'Edit', onClick: () => st.setPeek({ pageId: templateId, mode: 'center' }) },
        { label: 'Duplicate', onClick: () => { const id = st.duplicatePage(templateId); st.updatePage(id, { isTemplate: true, templateOf: db, dbId: db }); st.updateDb(db, (d) => { d.templates.push(id); }); } },
        { label: 'Delete', danger: true, onClick: () => { st.updateDb(db, (d) => { d.templates = d.templates.filter((x) => x !== templateId); }); st.deleteForever(templateId); } },
      ]} />}
    </>
  );
}

function TabMenu({ db, view, anchor, onClose, onSwitch, onEdit }: { db: any; view: View; anchor: HTMLElement; onClose: () => void; onSwitch: (id: string) => void; onEdit: (el: HTMLElement) => void }) {
  const st = useStore.getState();
  const [name, setName] = useState(view.name);
  const save = () => { if (name.trim() && name !== view.name) st.updateView(db.id, view.id, (v) => { v.name = name.trim(); }); };
  return (
    <Popover anchor={anchor} onClose={() => { save(); onClose(); }}>
      <Menu width={240} onClose={onClose} header={<div style={{ padding: 8 }}><input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { save(); onClose(); } }} /></div>} items={[
        { label: 'Edit view', icon: <MoreHorizontal size={16} />, onClick: () => onEdit(anchor) },
        { label: 'Copy link to view', onClick: () => { navigator.clipboard.writeText(`${location.origin}${location.pathname}#/page/${db.pageId}?v=${view.id}`); st.showToast('Copied link to view'); } },
        { label: 'Duplicate view', onClick: () => onSwitch(st.duplicateView(db.id, view.id)) },
        { label: 'Delete view', danger: true, disabled: db.views.length <= 1, onClick: () => st.deleteView(db.id, view.id) },
        { divider: true },
        { label: 'Move left', disabled: db.views[0].id === view.id, onClick: () => st.updateDb(db.id, (d) => { const i = d.views.findIndex((v) => v.id === view.id); const [m] = d.views.splice(i, 1); d.views.splice(i - 1, 0, m); }) },
        { label: 'Move right', disabled: db.views[db.views.length - 1].id === view.id, onClick: () => st.updateDb(db.id, (d) => { const i = d.views.findIndex((v) => v.id === view.id); const [m] = d.views.splice(i, 1); d.views.splice(i + 1, 0, m); }) },
      ]} />
    </Popover>
  );
}
