import React, { useRef, useState } from 'react';
import { Plus, GripVertical, ChevronDown, ChevronRight, Maximize2, Trash2, Copy, MoreHorizontal, PanelRight } from 'lucide-react';
import type { Page, Property } from '../../store/types';
import type { ViewProps } from '../viewTypes';
import { useStore } from '../../store/store';
import { Popover, Checkbox, PageIcon, Menu, Tag, MenuPopover, type MenuItemDef } from '../../components/ui';
import { PropertyCell, PropEditor, isEditable } from '../PropValue';
import { PropertyHeaderMenu, PropertySettings, AddPropertyMenu, PropIcon } from '../PropertyMenu';
import { groupRows, calculate, CALCS, calcLabel } from '../logic';
import { cx } from '../../lib/util';

const DEFAULT_W: Partial<Record<Property['type'], number>> = { title: 280, checkbox: 90, number: 120, date: 180, created_time: 190, last_edited_time: 190, unique_id: 110 };

export default function TableView({ db, view, rows, readOnly, openRow, addRow, updateView }: ViewProps) {
  const s = useStore();
  const props = view.visible.map((id) => db.properties.find((p) => p.id === id)).filter(Boolean) as Property[];
  const title = db.properties.find((p) => p.type === 'title')!;
  if (!props.some((p) => p.type === 'title')) props.unshift(title);
  const [menu, setMenu] = useState<{ prop: Property; el: HTMLElement } | null>(null);
  const [settings, setSettings] = useState<{ prop: Property; el: HTMLElement } | null>(null);
  const [addProp, setAddProp] = useState<HTMLElement | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [dragRow, setDragRow] = useState<string | null>(null);
  const [overRow, setOverRow] = useState<{ id: string; after: boolean } | null>(null);
  const locked = db.locked || readOnly;

  const width = (p: Property) => view.widths[p.id] ?? DEFAULT_W[p.type] ?? 200;

  const startResize = (p: Property, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = width(p);
    const th = (e.currentTarget as HTMLElement).parentElement!;
    const move = (ev: MouseEvent) => {
      const w = Math.max(60, w0 + ev.clientX - x0);
      th.style.width = `${w}px`;
      document.querySelectorAll<HTMLElement>(`[data-col="${view.id}-${p.id}"]`).forEach((c) => { c.style.width = `${w}px`; });
    };
    const up = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
      updateView((v) => { v.widths[p.id] = Math.max(60, w0 + ev.clientX - x0); });
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const groups = view.groupBy ? groupRows(s, db, view, rows) : null;
  const allSelected = rows.length > 0 && rows.every((r) => sel.has(r.id));

  const dropRow = (targetId: string, after: boolean) => {
    if (!dragRow || dragRow === targetId || view.sorts.length) return;
    const list = rows.filter((r) => r.id !== dragRow);
    const i = list.findIndex((r) => r.id === targetId);
    const prev = after ? list[i] : list[i - 1];
    const next = after ? list[i + 1] : list[i];
    const order = prev && next ? (prev.order + next.order) / 2 : prev ? prev.order + 1 : next.order - 1;
    useStore.getState().updatePage(dragRow, { order });
  };

  const header = (
    <div className="tv-head">
      <div className="tv-row tv-header-row">
        {!readOnly && <div className="tv-check head"><Checkbox checked={allSelected} onChange={(v) => setSel(v ? new Set(rows.map((r) => r.id)) : new Set())} size={14} /></div>}
        {props.map((p) => (
          <div key={p.id} className={cx('tv-th', dragCol === p.id && 'dragging')} style={{ width: width(p) }} data-col={`${view.id}-${p.id}`}
            draggable={!locked} onDragStart={() => setDragCol(p.id)} onDragEnd={() => setDragCol(null)}
            onDragOver={(e) => { if (dragCol) e.preventDefault(); }}
            onDrop={() => {
              if (!dragCol || dragCol === p.id) return;
              updateView((v) => { const from = v.visible.indexOf(dragCol); if (from < 0) return; v.visible.splice(from, 1); v.visible.splice(v.visible.indexOf(p.id) + (from <= v.visible.indexOf(p.id) ? 1 : 0), 0, dragCol); });
              setDragCol(null);
            }}
            onClick={(e) => !readOnly && setMenu({ prop: p, el: e.currentTarget })} title={p.description}>
            <PropIcon type={p.type} /> <span className="ellipsis">{p.name}</span>
            {!locked && <div className="col-resize" onMouseDown={(e) => startResize(p, e)} onClick={(e) => e.stopPropagation()} />}
          </div>
        ))}
        {!locked && <div className="tv-th add" onClick={(e) => setAddProp(e.currentTarget)}><Plus size={14} /></div>}
        <div className="tv-th filler" />
      </div>
    </div>
  );

  const rowEl = (r: Page) => (
    <div key={r.id} className={cx('tv-row', sel.has(r.id) && 'selected', overRow?.id === r.id && (overRow.after ? 'drop-after' : 'drop-before'))}
      onDragOver={(e) => { if (!dragRow) return; e.preventDefault(); const rect = e.currentTarget.getBoundingClientRect(); setOverRow({ id: r.id, after: e.clientY > rect.top + rect.height / 2 }); }}
      onDrop={() => { if (overRow) dropRow(overRow.id, overRow.after); setOverRow(null); setDragRow(null); }}
      onDragLeave={() => setOverRow(null)}>
      {!readOnly && (
        <div className="tv-check">
          <span className="tv-row-handle" draggable onDragStart={() => setDragRow(r.id)} onDragEnd={() => { setDragRow(null); setOverRow(null); }} title={view.sorts.length ? 'Remove sorts to reorder' : 'Drag to move'}><GripVertical size={14} /></span>
          <Checkbox size={14} checked={sel.has(r.id)} onChange={(v) => setSel((x) => { const n = new Set(x); if (v) n.add(r.id); else n.delete(r.id); return n; })} />
        </div>
      )}
      {props.map((p) => (
        <div key={p.id} className={cx('tv-td', view.wrap && 'wrap', p.type === 'title' && 'title-cell')} style={{ width: width(p) }} data-col={`${view.id}-${p.id}`}>
          {p.type === 'title' ? <TitleCell page={r} db={db} readOnly={readOnly} onOpen={() => openRow(r.id)} wrap={view.wrap} /> : <PropertyCell page={r} prop={p} db={db} readOnly={readOnly} wrap={view.wrap} />}
        </div>
      ))}
      <div className="tv-td filler" />
    </div>
  );

  const footer = (list: Page[]) => (
    <div className="tv-row tv-calc-row">
      {!readOnly && <div className="tv-check" />}
      {props.map((p) => <CalcCell key={p.id} prop={p} rows={list} fn={view.calc[p.id]} width={width(p)} readOnly={readOnly} onSet={(fn) => updateView((v) => { v.calc[p.id] = fn; })} colKey={`${view.id}-${p.id}`} />)}
      <div className="tv-td filler" />
    </div>
  );

  const newRow = (groupValue?: Record<string, any>) => !readOnly && (
    <div className="tv-new" onClick={() => addRow(groupValue ?? {}, { open: false })}><Plus size={14} /> New page</div>
  );

  return (
    <div className="table-view">
      <div className="tv-scroll">
        <div className="tv-inner">
          {header}
          {groups ? groups.filter((g) => !view.hiddenGroups?.includes(g.key)).map((g) => (
            <div key={g.key} className="tv-group">
              <div className="tv-group-head" onClick={() => setCollapsed((c) => { const n = new Set(c); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}>
                {collapsed.has(g.key) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                {g.option ? <Tag name={g.option.name} color={g.option.color} status={db.properties.find((p) => p.id === view.groupBy)?.type === 'status'} /> : <b>{g.label}</b>}
                <span className="faint">{g.rows.length}</span>
              </div>
              {!collapsed.has(g.key) && <>{g.rows.map(rowEl)}{newRow(groupValue(db.properties.find((p) => p.id === view.groupBy)!, g.key))}{footer(g.rows)}</>}
            </div>
          )) : (
            <>
              {rows.map(rowEl)}
              {newRow()}
              {footer(rows)}
            </>
          )}
        </div>
      </div>
      {sel.size > 0 && <BulkBar ids={Array.from(sel)} db={db} onDone={() => setSel(new Set())} openRow={openRow} />}
      {menu && (
        <Popover anchor={menu.el} onClose={() => setMenu(null)}>
          <PropertyHeaderMenu db={db} view={view} prop={menu.prop} onClose={() => setMenu(null)} onEdit={() => { setSettings({ prop: menu.prop, el: menu.el }); setMenu(null); }} />
        </Popover>
      )}
      {settings && <PropertySettings db={db} prop={settings.prop} anchor={settings.el} onClose={() => setSettings(null)} />}
      {addProp && (
        <Popover anchor={addProp} onClose={() => setAddProp(null)} placement="bottom-end">
          <AddPropertyMenu db={db} onClose={() => setAddProp(null)} onAdded={(id) => {
            const p = useStore.getState().databases[db.id].properties.find((x) => x.id === id)!;
            const el = addProp;
            setAddProp(null);
            setTimeout(() => setSettings({ prop: p, el }), 0);
          }} />
        </Popover>
      )}
    </div>
  );
}

export function groupValue(prop: Property, key: string): Record<string, any> {
  if (!prop || key === '__none') return {};
  switch (prop.type) {
    case 'select': case 'status': return { [prop.id]: key };
    case 'multi_select': case 'person': case 'relation': return { [prop.id]: [key] };
    case 'checkbox': return { [prop.id]: key === 'true' };
    default: return {};
  }
}

function TitleCell({ page, db, readOnly, onOpen, wrap }: { page: Page; db: any; readOnly: boolean; onOpen: () => void; wrap?: boolean }) {
  const [edit, setEdit] = useState<HTMLElement | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const title = db.properties.find((p: Property) => p.type === 'title');
  const comments = useStore((s) => Object.values(s.comments).filter((c) => c.pageId === page.id && !c.resolved).length);
  return (
    <div ref={ref} className="title-cell-inner" onClick={() => !readOnly && setEdit(ref.current)}>
      <PageIcon page={page} size={18} fallback={!!page.content.some((b) => b.html || b.type !== 'text')} />
      <span className={cx('pv-title', !wrap && 'ellipsis')}>{page.title || <span className="faint">{readOnly ? 'Untitled' : ''}</span>}</span>
      {comments > 0 && <span className="faint small">💬 {comments}</span>}
      <button className="open-btn" onClick={(e) => { e.stopPropagation(); onOpen(); }}><PanelRight size={12} /> OPEN</button>
      {edit && <PropEditor page={page} prop={title} db={db} anchor={new DOMRect(edit.getBoundingClientRect().left, edit.getBoundingClientRect().top - 4, edit.getBoundingClientRect().width, 0)} width={Math.max(edit.offsetWidth, 260)} onClose={() => setEdit(null)} />}
    </div>
  );
}

function CalcCell({ prop, rows, fn, width, readOnly, onSet, colKey }: { prop: Property; rows: Page[]; fn?: string; width: number; readOnly: boolean; onSet: (fn: string) => void; colKey: string }) {
  const s = useStore.getState();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const value = fn ? calculate(s, prop, rows, fn) : '';
  const items: MenuItemDef[] = CALCS.filter((c) => !c.types || c.types.includes(prop.type) || (prop.type === 'formula' && c.types.includes('number'))).map((c) => ({ label: c.label, checked: (fn ?? 'none') === c.id, onClick: () => onSet(c.id) }));
  return (
    <div className={cx('tv-td calc-cell', !fn && 'empty')} style={{ width }} data-col={colKey} onClick={(e) => !readOnly && setAnchor(e.currentTarget)}>
      {fn && fn !== 'none' ? <><span className="faint small">{calcLabel(fn)}</span> {value}</> : <span className="calc-hint">Calculate <ChevronDown size={11} /></span>}
      {anchor && <Popover anchor={anchor} onClose={() => setAnchor(null)}><Menu items={items} onClose={() => setAnchor(null)} width={200} /></Popover>}
    </div>
  );
}

function BulkBar({ ids, db, onDone, openRow }: { ids: string[]; db: any; onDone: () => void; openRow: (id: string) => void }) {
  const st = useStore.getState();
  const [edit, setEdit] = useState<HTMLElement | null>(null);
  const [editProp, setEditProp] = useState<{ prop: Property; el: HTMLElement } | null>(null);
  return (
    <div className="bulk-bar">
      <span className="bulk-count">{ids.length} selected</span>
      <button className="btn btn-sm" onClick={(e) => setEdit(e.currentTarget)}><MoreHorizontal size={14} /> Edit property</button>
      {ids.length === 1 && <button className="btn btn-sm" onClick={() => openRow(ids[0])}><Maximize2 size={14} /> Open</button>}
      <button className="btn btn-sm" onClick={() => { ids.forEach((id) => { const p = st.pages[id]; st.addRow(db.id, JSON.parse(JSON.stringify(p.props)), undefined, `${p.title}`); }); onDone(); }}><Copy size={14} /> Duplicate</button>
      <button className="btn btn-sm danger-text" onClick={() => { ids.forEach((id) => st.trashPage(id)); st.showToast(`Moved ${ids.length} page${ids.length > 1 ? 's' : ''} to trash`, { label: 'Undo', run: () => ids.forEach((id) => useStore.getState().restorePage(id)) }); onDone(); }}><Trash2 size={14} /> Delete</button>
      <button className="btn btn-sm" onClick={onDone}>Clear</button>
      {edit && <MenuPopover anchor={edit} onClose={() => setEdit(null)} width={220} searchable items={db.properties.filter((p: Property) => isEditable(p) && p.type !== 'title').map((p: Property) => ({
        label: p.name, icon: <PropIcon type={p.type} size={16} />, onClick: () => setEditProp({ prop: p, el: edit }),
      }))} />}
      {editProp && <BulkEditor ids={ids} db={db} prop={editProp.prop} anchor={editProp.el} onClose={() => setEditProp(null)} />}
    </div>
  );
}

/** Edit one property across many rows by editing the first, then copying the value. */
function BulkEditor({ ids, db, prop, anchor, onClose }: { ids: string[]; db: any; prop: Property; anchor: HTMLElement; onClose: () => void }) {
  const first = useStore((s) => s.pages[ids[0]]);
  return (
    <PropEditor page={first} prop={prop} db={db} anchor={anchor} onClose={() => {
      const st = useStore.getState();
      const v = st.pages[ids[0]].props[prop.id];
      ids.slice(1).forEach((id) => st.setProp(id, prop.id, JSON.parse(JSON.stringify(v ?? null))));
      onClose();
    }} />
  );
}
