import { useState } from 'react';
import { Plus, Trash2, X, ChevronDown, GripVertical, ArrowUpDown } from 'lucide-react';
import type { Database, FilterGroup, FilterRule, View, Property } from '../store/types';
import { useStore, dbRows, pageTitle } from '../store/store';
import { Popover, Tag, Avatar, MenuPopover, useAnchor } from '../components/ui';
import { opsFor, isGroup, DATE_PRESETS, countRules } from './logic';
import { PropIcon, defaultOp } from './PropertyMenu';
import { uid, cx } from '../lib/util';

// ---------- Filter chips bar ----------

export function FilterBar({ db, view, readOnly }: { db: Database; view: View; readOnly: boolean }) {
  const [open, setOpen] = useState<{ el: HTMLElement; ruleId?: string } | null>(null);
  const [sortOpen, setSortOpen] = useState<HTMLElement | null>(null);
  const top = view.filter;
  const simple = top.conj === 'and' && top.rules.every((r) => !isGroup(r));
  const upd = (fn: (v: View) => void) => useStore.getState().updateView(db.id, view.id, fn);
  if (!view.sorts.length && !top.rules.length) return null;
  return (
    <div className="filter-bar">
      {view.sorts.length > 0 && (
        <button className="chip" onClick={(e) => setSortOpen(e.currentTarget)}>
          <ArrowUpDown size={12} />
          {view.sorts.length === 1 ? db.properties.find((p) => p.id === view.sorts[0].propId)?.name : `${view.sorts.length} sorts`}
          <ChevronDown size={12} />
        </button>
      )}
      {view.sorts.length > 0 && top.rules.length > 0 && <div className="chip-sep" />}
      {simple
        ? top.rules.map((r) => <RuleChip key={(r as FilterRule).id} db={db} rule={r as FilterRule} onClick={(el) => setOpen({ el, ruleId: (r as FilterRule).id })} />)
        : top.rules.length > 0 && <button className="chip active" onClick={(e) => setOpen({ el: e.currentTarget })}>{countRules(top)} rules <ChevronDown size={12} /></button>}
      {!readOnly && simple && (
        <AddFilterButton db={db} onAdd={(propId) => { const id = uid(); upd((v) => { v.filter.rules.push({ id, propId, op: defaultOp(db.properties.find((p) => p.id === propId)!.type) }); }); setTimeout(() => { const el = document.querySelector(`[data-chip="${id}"]`) as HTMLElement; if (el) setOpen({ el, ruleId: id }); }, 30); }} label="Add filter" />
      )}
      {!readOnly && <button className="chip ghost" onClick={(e) => setOpen({ el: e.currentTarget })}>Advanced</button>}
      {open && (
        <Popover anchor={open.el} onClose={() => setOpen(null)}>
          {open.ruleId && simple
            ? <SingleRuleEditor db={db} view={view} ruleId={open.ruleId} onClose={() => setOpen(null)} />
            : <FilterBuilder db={db} view={view} />}
        </Popover>
      )}
      {sortOpen && <Popover anchor={sortOpen} onClose={() => setSortOpen(null)}><SortBuilder db={db} view={view} /></Popover>}
    </div>
  );
}

function RuleChip({ db, rule, onClick }: { db: Database; rule: FilterRule; onClick: (el: HTMLElement) => void }) {
  const prop = db.properties.find((p) => p.id === rule.propId);
  const s = useStore.getState();
  if (!prop) return null;
  const ops = opsFor(prop.type);
  const op = ops.find((o) => o.op === rule.op);
  let val = '';
  if (rule.value !== undefined && rule.value !== '' && !(Array.isArray(rule.value) && !rule.value.length)) {
    if (prop.options && (Array.isArray(rule.value) || typeof rule.value === 'string')) {
      const ids = Array.isArray(rule.value) ? rule.value as string[] : [rule.value as string];
      val = ids.map((id) => prop.options!.find((o) => o.id === id)?.name ?? id).join(', ');
    } else if (prop.type === 'person') val = (rule.value as string[]).map((id) => s.users[id]?.name).join(', ');
    else if (prop.type === 'relation') val = (rule.value as string[]).map((id) => pageTitle(s.pages[id])).join(', ');
    else val = DATE_PRESETS.find((d) => d[0] === rule.value)?.[1] ?? String(rule.value);
  }
  const active = !!val || op?.noValue;
  return (
    <button className={cx('chip', active && 'active')} data-chip={rule.id} onClick={(e) => onClick(e.currentTarget)}>
      <PropIcon type={prop.type} size={12} />
      <span>{prop.name}{active ? `: ${op?.noValue ? op.label.toLowerCase() : val}` : ''}</span>
      <ChevronDown size={12} />
    </button>
  );
}

function AddFilterButton({ db, onAdd, label }: { db: Database; onAdd: (propId: string) => void; label: string }) {
  const a = useAnchor();
  return (
    <>
      <button className="chip ghost" onClick={a.open}><Plus size={12} /> {label}</button>
      {a.anchor && <MenuPopover anchor={a.anchor} onClose={a.close} searchable placeholder="Filter by…" width={240}
        items={db.properties.filter((p) => p.type !== 'button').map((p) => ({ label: p.name, icon: <PropIcon type={p.type} size={16} />, onClick: () => onAdd(p.id) }))} />}
    </>
  );
}

function SingleRuleEditor({ db, view, ruleId, onClose }: { db: Database; view: View; ruleId: string; onClose: () => void }) {
  const fresh = useStore((s) => s.databases[db.id]?.views.find((v) => v.id === view.id));
  const rule = fresh?.filter.rules.find((r) => (r as FilterRule).id === ruleId) as FilterRule | undefined;
  const upd = (fn: (v: View) => void) => useStore.getState().updateView(db.id, view.id, fn);
  if (!rule) return null;
  const prop = db.properties.find((p) => p.id === rule.propId);
  if (!prop) return null;
  const set = (patch: Partial<FilterRule>) => upd((v) => { const r = v.filter.rules.find((x) => (x as FilterRule).id === ruleId) as FilterRule; Object.assign(r, patch); });
  const ops = opsFor(prop.type);
  return (
    <div className="menu filter-editor" style={{ width: 300 }}>
      <div className="row" style={{ padding: '6px 8px' }}>
        <span className="faint small">{prop.name}</span>
        <select className="op-select" value={rule.op} onChange={(e) => set({ op: e.target.value as any })}>
          {ops.map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
        </select>
        <div className="grow" />
        <button className="icon-btn sm" title="Delete filter" onClick={() => { upd((v) => { v.filter.rules = v.filter.rules.filter((x) => (x as FilterRule).id !== ruleId); }); onClose(); }}><Trash2 size={14} /></button>
      </div>
      {!ops.find((o) => o.op === rule.op)?.noValue && <ValueInput prop={prop} db={db} value={rule.value} onChange={(value) => set({ value })} />}
    </div>
  );
}

function ValueInput({ prop, db, value, onChange }: { prop: Property; db: Database; value: unknown; onChange: (v: unknown) => void }) {
  const s = useStore();
  if (prop.type === 'select' || prop.type === 'status' || prop.type === 'multi_select') {
    const sel = Array.isArray(value) ? value as string[] : value ? [value as string] : [];
    return (
      <div className="menu-list" style={{ maxHeight: 240 }}>
        {(prop.options ?? []).map((o) => (
          <div key={o.id} className="menu-item" onClick={() => onChange(sel.includes(o.id) ? sel.filter((x) => x !== o.id) : [...sel, o.id])}>
            <input type="checkbox" readOnly checked={sel.includes(o.id)} /><Tag name={o.name} color={o.color} status={prop.type === 'status'} />
          </div>
        ))}
        {!prop.options?.length && <div className="menu-empty">No options</div>}
      </div>
    );
  }
  if (prop.type === 'person' || prop.type === 'created_by' || prop.type === 'last_edited_by') {
    const sel = (value as string[]) ?? [];
    const members = s.workspaces[s.wsId].members.map((m) => s.users[m.userId]).filter(Boolean);
    return (
      <div className="menu-list">
        {members.map((u) => (
          <div key={u.id} className="menu-item" onClick={() => onChange(sel.includes(u.id) ? sel.filter((x) => x !== u.id) : [...sel, u.id])}>
            <input type="checkbox" readOnly checked={sel.includes(u.id)} /><Avatar user={u} size={18} /><span className="menu-label">{u.name}</span>
          </div>
        ))}
      </div>
    );
  }
  if (prop.type === 'relation') {
    const sel = (value as string[]) ?? [];
    const rows = prop.relationDb ? dbRows(s, prop.relationDb) : [];
    return (
      <div className="menu-list" style={{ maxHeight: 240 }}>
        {rows.map((r) => (
          <div key={r.id} className="menu-item" onClick={() => onChange(sel.includes(r.id) ? sel.filter((x) => x !== r.id) : [...sel, r.id])}>
            <input type="checkbox" readOnly checked={sel.includes(r.id)} /><span className="menu-label">{pageTitle(r)}</span>
          </div>
        ))}
      </div>
    );
  }
  if (prop.type === 'date' || prop.type === 'created_time' || prop.type === 'last_edited_time') {
    const isPreset = DATE_PRESETS.some((d) => d[0] === value);
    return (
      <div className="col" style={{ padding: 8 }}>
        <select className="input" value={isPreset ? String(value) : 'exact'} onChange={(e) => onChange(e.target.value === 'exact' ? new Date().toISOString().slice(0, 10) : e.target.value)}>
          {DATE_PRESETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          <option value="exact">Exact date</option>
        </select>
        {!isPreset && <input type="date" className="input" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />}
      </div>
    );
  }
  void db;
  return <div style={{ padding: 8 }}><input autoFocus className="input" type={prop.type === 'number' ? 'number' : 'text'} placeholder="Type a value…" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} /></div>;
}

/** Full advanced filter builder with AND/OR and nested groups. */
export function FilterBuilder({ db, view }: { db: Database; view: View }) {
  const fresh = useStore((s) => s.databases[db.id]?.views.find((v) => v.id === view.id)) ?? view;
  const upd = (fn: (g: FilterGroup) => void) => useStore.getState().updateView(db.id, view.id, (v) => fn(v.filter));
  return (
    <div className="menu filter-builder" style={{ width: 640, padding: 8 }}>
      <GroupEditor db={db} group={fresh.filter} path={[]} upd={upd} depth={0} />
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn btn-sm" onClick={() => upd((g) => { g.rules.push({ id: uid(), propId: db.properties[0].id, op: defaultOp(db.properties[0].type) }); })}><Plus size={13} /> Add filter rule</button>
        <button className="btn btn-sm" onClick={() => upd((g) => { g.rules.push({ id: uid(), conj: 'and', rules: [{ id: uid(), propId: db.properties[0].id, op: defaultOp(db.properties[0].type) }] }); })}><Plus size={13} /> Add filter group</button>
        <div className="grow" />
        {fresh.filter.rules.length > 0 && <button className="btn btn-sm btn-danger" onClick={() => upd((g) => { g.rules = []; })}><Trash2 size={13} /> Delete filters</button>}
      </div>
    </div>
  );
}

function GroupEditor({ db, group, path, upd, depth }: { db: Database; group: FilterGroup; path: number[]; upd: (fn: (g: FilterGroup) => void) => void; depth: number }) {
  const at = (g: FilterGroup) => path.reduce<FilterGroup>((cur, i) => cur.rules[i] as FilterGroup, g);
  if (!group.rules.length && depth === 0) return <div className="faint small" style={{ padding: 8 }}>No filters applied to this view</div>;
  return (
    <div className={cx('filter-group', depth > 0 && 'nested')}>
      {group.rules.map((r, i) => (
        <div key={(r as any).id} className="filter-row">
          <div className="filter-conj">
            {i === 0 ? 'Where' : i === 1 ? (
              <select className="op-select" value={group.conj} onChange={(e) => upd((g) => { at(g).conj = e.target.value as any; })}><option value="and">And</option><option value="or">Or</option></select>
            ) : <span className="faint">{group.conj === 'and' ? 'And' : 'Or'}</span>}
          </div>
          {isGroup(r)
            ? <div className="grow"><GroupEditor db={db} group={r} path={[...path, i]} upd={upd} depth={depth + 1} />
                <button className="btn btn-sm" onClick={() => upd((g) => { (at(g).rules[i] as FilterGroup).rules.push({ id: uid(), propId: db.properties[0].id, op: defaultOp(db.properties[0].type) }); })}><Plus size={12} /> Add rule</button></div>
            : <RuleRow db={db} rule={r} onChange={(patch) => upd((g) => { Object.assign(at(g).rules[i], patch); })} />}
          <button className="icon-btn sm" onClick={() => upd((g) => { at(g).rules.splice(i, 1); })}><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

function RuleRow({ db, rule, onChange }: { db: Database; rule: FilterRule; onChange: (p: Partial<FilterRule>) => void }) {
  const prop = db.properties.find((p) => p.id === rule.propId) ?? db.properties[0];
  const ops = opsFor(prop.type);
  const [valAnchor, setValAnchor] = useState<HTMLElement | null>(null);
  const noValue = ops.find((o) => o.op === rule.op)?.noValue;
  const simpleInput = ['text', 'title', 'url', 'email', 'phone', 'number', 'formula', 'rollup', 'unique_id', 'files'].includes(prop.type);
  return (
    <div className="row grow">
      <select className="input" style={{ width: 150 }} value={prop.id} onChange={(e) => { const p = db.properties.find((x) => x.id === e.target.value)!; onChange({ propId: p.id, op: defaultOp(p.type), value: undefined }); }}>
        {db.properties.filter((p) => p.type !== 'button').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <select className="input" style={{ width: 150 }} value={rule.op} onChange={(e) => onChange({ op: e.target.value as any })}>
        {ops.map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
      </select>
      {!noValue && (simpleInput
        ? <input className="input grow" type={prop.type === 'number' ? 'number' : 'text'} placeholder="Value" value={String(rule.value ?? '')} onChange={(e) => onChange({ value: e.target.value })} />
        : <button className="input grow value-btn" onClick={(e) => setValAnchor(e.currentTarget)}>{valueSummary(prop, rule.value) || <span className="faint">Select…</span>}<ChevronDown size={12} /></button>)}
      {valAnchor && <Popover anchor={valAnchor} onClose={() => setValAnchor(null)}><div className="menu" style={{ width: 260 }}><ValueInput prop={prop} db={db} value={rule.value} onChange={(v) => onChange({ value: v })} /></div></Popover>}
    </div>
  );
}

function valueSummary(prop: Property, v: unknown) {
  const s = useStore.getState();
  if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) return '';
  if (prop.options) return (Array.isArray(v) ? v : [v]).map((id) => prop.options!.find((o) => o.id === id)?.name).filter(Boolean).join(', ');
  if (prop.type === 'person') return (v as string[]).map((id) => s.users[id]?.name).join(', ');
  if (prop.type === 'relation') return (v as string[]).map((id) => pageTitle(s.pages[id])).join(', ');
  return DATE_PRESETS.find((d) => d[0] === v)?.[1] ?? String(v);
}

// ---------- Sort builder ----------

export function SortBuilder({ db, view }: { db: Database; view: View }) {
  const fresh = useStore((s) => s.databases[db.id]?.views.find((v) => v.id === view.id)) ?? view;
  const upd = (fn: (v: View) => void) => useStore.getState().updateView(db.id, view.id, fn);
  const [drag, setDrag] = useState<number | null>(null);
  const add = useAnchor();
  return (
    <div className="menu sort-builder" style={{ width: 380, padding: 8 }}>
      {fresh.sorts.length === 0 && <div className="faint small" style={{ padding: 6 }}>No sorts applied to this view</div>}
      {fresh.sorts.map((r, i) => (
        <div key={i} className="row sort-row" draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()}
          onDrop={() => { if (drag === null || drag === i) return; upd((v) => { const [m] = v.sorts.splice(drag, 1); v.sorts.splice(i, 0, m); }); setDrag(null); }}>
          <GripVertical size={14} className="faint" />
          <select className="input" value={r.propId} onChange={(e) => upd((v) => { v.sorts[i].propId = e.target.value; })}>
            {db.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="input" style={{ width: 130 }} value={r.dir} onChange={(e) => upd((v) => { v.sorts[i].dir = e.target.value as any; })}>
            <option value="asc">Ascending</option><option value="desc">Descending</option>
          </select>
          <button className="icon-btn sm" onClick={() => upd((v) => { v.sorts.splice(i, 1); })}><X size={14} /></button>
        </div>
      ))}
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn btn-sm" onClick={add.open}><Plus size={13} /> Add sort</button>
        <div className="grow" />
        {fresh.sorts.length > 0 && <button className="btn btn-sm btn-danger" onClick={() => upd((v) => { v.sorts = []; })}><Trash2 size={13} /> Delete sort</button>}
      </div>
      {add.anchor && <MenuPopover anchor={add.anchor} onClose={add.close} searchable width={240}
        items={db.properties.filter((p) => !fresh.sorts.some((x) => x.propId === p.id)).map((p) => ({ label: p.name, icon: <PropIcon type={p.type} size={16} />, onClick: () => upd((v) => { v.sorts.push({ propId: p.id, dir: 'asc' }); }) }))} />}
    </div>
  );
}
