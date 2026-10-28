import { useState } from 'react';
import {
  ChevronLeft, ChevronRight, LayoutGrid, Eye, EyeOff, Filter, ArrowUpDown, Group, Lock, Link2, Copy, Trash2, Download, Upload,
  PanelRight, Maximize2, Square, FileStack, GripVertical, Plus, Type, Palette, ListTree,
} from 'lucide-react';
import type { Database, View, ViewType } from '../store/types';
import { useStore, VIEW_NAMES, PROP_NAMES } from '../store/store';
import { Popover, Toggle, ConfirmDialog } from '../components/ui';
import { VIEW_ICONS } from './DatabaseView';
import { PropIcon, AddPropertyMenu } from './PropertyMenu';
import { FilterBuilder, SortBuilder } from './FilterSort';
import { toCSV, parseCSV, queryView, countRules } from './logic';
import { cx, download, pickFile } from '../lib/util';
import { COLORS } from '../store/types';

type Panel = 'root' | 'layout' | 'properties' | 'filter' | 'sort' | 'group' | 'templates' | 'addProp';

export default function ViewSettings({ db, view, anchor, onClose, onSwitchView, inline }: { db: Database; view: View; anchor: HTMLElement; onClose: () => void; onSwitchView: (id: string) => void; inline: boolean }) {
  const [panel, setPanel] = useState<Panel>('root');
  const [confirmDel, setConfirmDel] = useState(false);
  const st = useStore.getState();
  const fresh = useStore((s) => s.databases[db.id]?.views.find((v) => v.id === view.id)) ?? view;
  const freshDb = useStore((s) => s.databases[db.id]) ?? db;
  const upd = (fn: (v: View) => void) => st.updateView(db.id, view.id, fn);
  const back = (title: string) => (
    <div className="vs-head"><button className="icon-btn sm" onClick={() => setPanel('root')}><ChevronLeft size={16} /></button><b>{title}</b></div>
  );
  const Row = ({ icon, label, value, onClick, danger }: { icon: React.ReactNode; label: string; value?: React.ReactNode; onClick: () => void; danger?: boolean }) => (
    <div className={cx('menu-item', danger && 'danger')} onClick={onClick}><span className="menu-icon">{icon}</span><span className="menu-label">{label}</span>{value !== undefined && <span className="faint small">{value}</span>}<ChevronRight size={14} className="faint" /></div>
  );

  let body: React.ReactNode;
  switch (panel) {
    case 'layout':
      body = (
        <>
          {back('Layout')}
          <div className="layout-grid">
            {(Object.keys(VIEW_NAMES) as ViewType[]).map((t) => {
              const I = VIEW_ICONS[t];
              return <button key={t} className={cx('layout-tile', fresh.type === t && 'on')} onClick={() => {
                upd((v) => {
                  v.type = t;
                  const sel = freshDb.properties.find((p) => p.type === 'status' || p.type === 'select');
                  const date = freshDb.properties.find((p) => p.type === 'date');
                  if (t === 'board' && !v.groupBy) v.groupBy = sel?.id;
                  if ((t === 'calendar' || t === 'timeline') && !v.dateProp) v.dateProp = date?.id;
                  if (t === 'timeline' && !v.timelineZoom) v.timelineZoom = 'week';
                  if (t === 'chart' && !v.chart) v.chart = { kind: 'bar', x: sel?.id, agg: 'count', showLabels: true };
                  if (t === 'form' && !v.form) v.form = { questions: freshDb.properties.filter((p) => !['created_time', 'created_by', 'last_edited_time', 'last_edited_by', 'formula', 'rollup', 'unique_id', 'button'].includes(p.type)).map((p) => ({ propId: p.id, required: p.type === 'title' })) };
                });
              }}><I size={20} /><span>{VIEW_NAMES[t]}</span></button>;
            })}
          </div>
          <div className="sep" />
          <div className="menu-item"><span className="menu-label">Show database title</span><Toggle on={fresh.showTitle !== false} onChange={(v) => upd((x) => { x.showTitle = v; })} /></div>
          {['table', 'list', 'board', 'gallery'].includes(fresh.type) && <div className="menu-item"><span className="menu-label">Wrap all content</span><Toggle on={!!fresh.wrap} onChange={(v) => upd((x) => { x.wrap = v; })} /></div>}
          {(fresh.type === 'board' || fresh.type === 'gallery') && (
            <>
              <div className="menu-item"><span className="menu-label">Card preview</span>
                <select className="input" style={{ width: 120, height: 26 }} value={fresh.cardPreview ?? 'none'} onChange={(e) => upd((x) => { x.cardPreview = e.target.value as any; })}><option value="none">None</option><option value="cover">Page cover</option><option value="content">Page content</option></select></div>
              <div className="menu-item"><span className="menu-label">Card size</span>
                <select className="input" style={{ width: 120, height: 26 }} value={fresh.cardSize ?? 'medium'} onChange={(e) => upd((x) => { x.cardSize = e.target.value as any; })}><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></div>
            </>
          )}
          {fresh.type === 'board' && <div className="menu-item"><span className="menu-label">Color columns</span><Toggle on={!!fresh.colorColumns} onChange={(v) => upd((x) => { x.colorColumns = v; })} /></div>}
          {(fresh.type === 'calendar' || fresh.type === 'timeline') && (
            <div className="menu-item"><span className="menu-label">Show {fresh.type} by</span>
              <select className="input" style={{ width: 140, height: 26 }} value={fresh.dateProp ?? ''} onChange={(e) => upd((x) => { x.dateProp = e.target.value; })}>
                {freshDb.properties.filter((p) => ['date', 'created_time', 'last_edited_time'].includes(p.type)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></div>
          )}
          {fresh.type === 'timeline' && (
            <div className="menu-item"><span className="menu-label">End date property</span>
              <select className="input" style={{ width: 140, height: 26 }} value={fresh.endProp ?? ''} onChange={(e) => upd((x) => { x.endProp = e.target.value || undefined; })}>
                <option value="">Use date range</option>
                {freshDb.properties.filter((p) => p.type === 'date' && p.id !== fresh.dateProp).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></div>
          )}
          <div className="sep" />
          <div className="menu-header">Open pages in</div>
          {([['side', 'Side peek', PanelRight], ['center', 'Center peek', Square], ['full', 'Full page', Maximize2]] as const).map(([k, l, I]) => (
            <div key={k} className="menu-item" onClick={() => upd((x) => { x.openIn = k; })}><span className="menu-icon"><I size={16} /></span><span className="menu-label">{l}</span>{(fresh.openIn ?? 'side') === k && <span>✓</span>}</div>
          ))}
        </>
      );
      break;
    case 'properties': {
      const shown = fresh.visible.map((id) => freshDb.properties.find((p) => p.id === id)).filter(Boolean) as Database['properties'];
      const hidden = freshDb.properties.filter((p) => !fresh.visible.includes(p.id));
      body = (
        <>
          {back('Properties')}
          <div className="row" style={{ justifyContent: 'space-between', padding: '4px 10px' }}>
            <span className="field-label">Shown in {fresh.type}</span>
            <button className="btn btn-sm" onClick={() => upd((v) => { v.visible = v.visible.filter((id) => freshDb.properties.find((p) => p.id === id)?.type === 'title' && v.type === 'table'); })}>Hide all</button>
          </div>
          {shown.map((p, i) => (
            <div key={p.id} className="menu-item" draggable onDragStart={(e) => e.dataTransfer.setData('text/prop', String(i))} onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { const from = +e.dataTransfer.getData('text/prop'); upd((v) => { const [m] = v.visible.splice(from, 1); v.visible.splice(i, 0, m); }); }}>
              <GripVertical size={12} className="faint" /><PropIcon type={p.type} size={16} /><span className="menu-label">{p.name}</span>
              {!(p.type === 'title' && fresh.type === 'table') && <button className="icon-btn sm" onClick={() => upd((v) => { v.visible = v.visible.filter((x) => x !== p.id); })}><Eye size={14} /></button>}
            </div>
          ))}
          {hidden.length > 0 && <div className="row" style={{ justifyContent: 'space-between', padding: '4px 10px' }}><span className="field-label">Hidden</span><button className="btn btn-sm" onClick={() => upd((v) => { v.visible = [...v.visible, ...hidden.map((p) => p.id)]; })}>Show all</button></div>}
          {hidden.map((p) => (
            <div key={p.id} className="menu-item faint" onClick={() => upd((v) => { v.visible.push(p.id); })}>
              <PropIcon type={p.type} size={16} /><span className="menu-label">{p.name}</span><EyeOff size={14} />
            </div>
          ))}
          {!freshDb.locked && <div className="menu-item" onClick={() => setPanel('addProp')}><span className="menu-icon"><Plus size={16} /></span><span className="menu-label">New property</span></div>}
        </>
      );
      break;
    }
    case 'addProp':
      body = <>{back('New property')}<AddPropertyMenu db={freshDb} onClose={() => setPanel('properties')} onAdded={() => setPanel('properties')} /></>;
      break;
    case 'filter': body = <>{back('Filter')}<FilterBuilder db={freshDb} view={fresh} /></>; break;
    case 'sort': body = <>{back('Sort')}<SortBuilder db={freshDb} view={fresh} /></>; break;
    case 'group': {
      const groupable = freshDb.properties.filter((p) => ['select', 'multi_select', 'status', 'person', 'checkbox', 'date', 'relation', 'text', 'number', 'created_by', 'created_time', 'last_edited_time', 'last_edited_by'].includes(p.type));
      body = (
        <>
          {back('Group')}
          <div className="menu-item"><span className="menu-label">Group by</span>
            <select className="input" style={{ width: 150, height: 26 }} value={fresh.groupBy ?? ''} onChange={(e) => upd((v) => { v.groupBy = e.target.value || undefined; })}>
              <option value="">None</option>{groupable.map((p) => <option key={p.id} value={p.id}>{p.name} · {PROP_NAMES[p.type]}</option>)}
            </select></div>
          {fresh.groupBy && <div className="menu-item"><span className="menu-label">Hide empty groups</span><Toggle on={!!fresh.hideEmptyGroups} onChange={(v) => upd((x) => { x.hideEmptyGroups = v; })} /></div>}
          {fresh.groupBy && (fresh.hiddenGroups?.length ?? 0) > 0 && <div className="menu-item" onClick={() => upd((x) => { x.hiddenGroups = []; })}><span className="menu-label">Show {fresh.hiddenGroups!.length} hidden group(s)</span></div>}
          {fresh.groupBy && <div className="menu-item danger" onClick={() => upd((v) => { v.groupBy = undefined; })}><span className="menu-label">Remove grouping</span></div>}
        </>
      );
      break;
    }
    default: {
      const groupProp = freshDb.properties.find((p) => p.id === fresh.groupBy);
      body = (
        <>
          <div className="vs-head"><b>View options</b></div>
          <div className="vs-name">
            <input className="input" value={fresh.name} onChange={(e) => upd((v) => { v.name = e.target.value; })} />
          </div>
          <Row icon={<LayoutGrid size={16} />} label="Layout" value={VIEW_NAMES[fresh.type]} onClick={() => setPanel('layout')} />
          <Row icon={<ListTree size={16} />} label="Properties" value={`${fresh.visible.length} shown`} onClick={() => setPanel('properties')} />
          <Row icon={<Filter size={16} />} label="Filter" value={countRules(fresh.filter) ? `${countRules(fresh.filter)} rules` : ''} onClick={() => setPanel('filter')} />
          <Row icon={<ArrowUpDown size={16} />} label="Sort" value={fresh.sorts.length ? `${fresh.sorts.length} sorts` : ''} onClick={() => setPanel('sort')} />
          {fresh.type !== 'calendar' && fresh.type !== 'form' && fresh.type !== 'chart' && <Row icon={<Group size={16} />} label="Group" value={groupProp?.name ?? ''} onClick={() => setPanel('group')} />}
          {fresh.type === 'table' && (
            <div className="menu-item"><span className="menu-icon"><Palette size={16} /></span><span className="menu-label">Conditional color</span>
              <select className="input" style={{ width: 110, height: 26 }} value={fresh.conditionalColors?.[0]?.color ?? ''} onChange={(e) => {
                const c = e.target.value as any;
                const cb = freshDb.properties.find((p) => p.type === 'checkbox' || p.type === 'status');
                upd((v) => { v.conditionalColors = c && cb ? [{ color: c, rule: { id: 'cc', propId: cb.id, op: cb.type === 'checkbox' ? 'checked' : 'is', value: cb.options?.find((o) => o.group === 'complete')?.id } }] : []; });
              }}><option value="">Off</option>{COLORS.filter((c) => c !== 'default').map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          )}
          <div className="sep" />
          <div className="menu-item" onClick={() => st.updateDb(db.id, (d) => { d.showDescription = !d.showDescription; })}><span className="menu-icon"><Type size={16} /></span><span className="menu-label">Show description</span><Toggle on={!!freshDb.showDescription} onChange={(v) => st.updateDb(db.id, (d) => { d.showDescription = v; })} /></div>
          <div className="menu-item" onClick={() => st.updateDb(db.id, (d) => { d.locked = !d.locked; })}><span className="menu-icon"><Lock size={16} /></span><span className="menu-label">Lock database</span><Toggle on={!!freshDb.locked} onChange={(v) => st.updateDb(db.id, (d) => { d.locked = v; })} /></div>
          <div className="menu-item" onClick={() => st.updateDb(db.id, (d) => { d.isTasks = !d.isTasks; })}><span className="menu-icon"><FileStack size={16} /></span><span className="menu-label">Show in “My tasks” on Home</span><Toggle on={!!freshDb.isTasks} onChange={(v) => st.updateDb(db.id, (d) => { d.isTasks = v; })} /></div>
          <div className="sep" />
          <div className="menu-item" onClick={() => { navigator.clipboard.writeText(`${location.origin}${location.pathname}#/page/${db.pageId}`); st.showToast('Copied link to view'); onClose(); }}><span className="menu-icon"><Link2 size={16} /></span><span className="menu-label">Copy link to view</span></div>
          <div className="menu-item" onClick={() => { onSwitchView(st.duplicateView(db.id, view.id)); onClose(); }}><span className="menu-icon"><Copy size={16} /></span><span className="menu-label">Duplicate view</span></div>
          <div className="menu-item" onClick={() => {
            const rows = queryView(useStore.getState(), freshDb, fresh);
            download(`${freshDb.title || 'database'}.csv`, toCSV(useStore.getState(), freshDb, rows), 'text/csv');
            onClose();
          }}><span className="menu-icon"><Download size={16} /></span><span className="menu-label">Export view as CSV</span></div>
          {!freshDb.locked && <div className="menu-item" onClick={async () => { await importCSV(freshDb); onClose(); }}><span className="menu-icon"><Upload size={16} /></span><span className="menu-label">Merge with CSV</span></div>}
          {freshDb.views.length > 1 && <div className="menu-item danger" onClick={() => setConfirmDel(true)}><span className="menu-icon"><Trash2 size={16} /></span><span className="menu-label">Delete view</span></div>}
          {inline && <div className="faint small" style={{ padding: '6px 10px' }}>Inline database</div>}
        </>
      );
    }
  }

  return (
    <>
      <Popover anchor={anchor} onClose={onClose} placement="bottom-end" width={panel === 'filter' ? 660 : 290}>
        <div className="menu view-settings">{body}</div>
      </Popover>
      {confirmDel && <ConfirmDialog title={`Delete view “${fresh.name}”?`} danger confirm="Delete" onConfirm={() => { st.deleteView(db.id, view.id); onClose(); }} onClose={() => setConfirmDel(false)} />}
    </>
  );
}

export async function importCSV(db: Database) {
  const [f] = await pickFile('.csv,text/csv');
  if (!f) return;
  const rows = parseCSV(await f.text());
  if (rows.length < 1) return;
  const st = useStore.getState();
  const header = rows[0];
  const title = db.properties.find((p) => p.type === 'title')!;
  const map: (string | null)[] = header.map((h, i) => {
    const existing = db.properties.find((p) => p.name.toLowerCase() === h.trim().toLowerCase());
    if (existing) return existing.id;
    if (i === 0) return title.id;
    return st.addProperty(db.id, 'text', h.trim() || `Column ${i + 1}`);
  });
  for (const r of rows.slice(1)) {
    const fresh = useStore.getState().databases[db.id];
    const props: Record<string, any> = {};
    let name = '';
    r.forEach((cell, i) => {
      const pid = map[i];
      if (!pid) return;
      const p = fresh.properties.find((x) => x.id === pid)!;
      if (p.type === 'title') { name = cell; return; }
      if (p.type === 'number') props[pid] = cell === '' ? null : Number(cell);
      else if (p.type === 'checkbox') props[pid] = /^(yes|true|1|x)$/i.test(cell);
      else if (p.type === 'date') props[pid] = cell ? { start: new Date(cell).toISOString().slice(0, 10) } : null;
      else if (p.type === 'select' || p.type === 'status' || p.type === 'multi_select') {
        const names = p.type === 'multi_select' ? cell.split(',').map((x) => x.trim()).filter(Boolean) : cell ? [cell.trim()] : [];
        const opts = [...(p.options ?? [])];
        const ids = names.map((n) => { let o = opts.find((x) => x.name === n); if (!o && p.type !== 'status') { o = { id: Math.random().toString(36).slice(2), name: n, color: 'gray' }; opts.push(o); } return o?.id; }).filter(Boolean) as string[];
        if (opts.length !== (p.options?.length ?? 0)) st.updateProperty(db.id, p.id, { options: opts });
        props[pid] = p.type === 'multi_select' ? ids : ids[0] ?? null;
      } else props[pid] = cell;
    });
    st.addRow(db.id, props, undefined, name);
  }
  st.showToast(`Imported ${rows.length - 1} rows`);
}
