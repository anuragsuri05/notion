import React, { useMemo, useState } from 'react';
import {
  Type, AlignLeft, Hash, ChevronDownCircle, List, Loader, Calendar, User, Paperclip, CheckSquare, Link, AtSign, Phone,
  Sigma, ArrowUpRight, Search, Clock, UserCircle, MousePointerClick, Fingerprint, ArrowUp, ArrowDown, Filter, EyeOff,
  ArrowLeftToLine, ArrowRightToLine, Copy, Trash2, Settings2, Repeat, WrapText, Group, Plus, GripVertical, MoreHorizontal, Info,
} from 'lucide-react';
import type { Database, Property, PropType, View } from '../store/types';
import { useStore, PROP_NAMES, pageTitle, dbRows } from '../store/store';
import { Menu, Popover, Toggle, type MenuItemDef, Tag, ConfirmDialog } from '../components/ui';
import { NUMBER_FORMATS, ROLLUP_FNS, formulaValue } from './logic';
import { FORMULA_FUNCTIONS, validateFormula, formatFormulaValue } from '../formula/engine';
import { OptionEditMenu, nextColor } from './PropValue';
import { cx, uid } from '../lib/util';

export const PROP_ICONS: Record<PropType, typeof Type> = {
  title: Type, text: AlignLeft, number: Hash, select: ChevronDownCircle, multi_select: List, status: Loader, date: Calendar,
  person: User, files: Paperclip, checkbox: CheckSquare, url: Link, email: AtSign, phone: Phone, formula: Sigma,
  relation: ArrowUpRight, rollup: Search, created_time: Clock, created_by: UserCircle, last_edited_time: Clock,
  last_edited_by: UserCircle, button: MousePointerClick, unique_id: Fingerprint,
};

export function PropIcon({ type, size = 14 }: { type: PropType; size?: number }) {
  const I = PROP_ICONS[type] ?? Type;
  return <I size={size} strokeWidth={1.8} className="prop-icon" />;
}

export const ADDABLE_TYPES: PropType[] = ['text', 'number', 'select', 'multi_select', 'status', 'date', 'person', 'files', 'checkbox', 'url', 'email', 'phone', 'formula', 'relation', 'rollup', 'button', 'unique_id', 'created_time', 'created_by', 'last_edited_time', 'last_edited_by'];

export function AddPropertyMenu({ db, onAdded, onClose, afterId }: { db: Database; onAdded?: (id: string) => void; onClose: () => void; afterId?: string }) {
  const items: MenuItemDef[] = [
    { header: 'Type' },
    ...ADDABLE_TYPES.map((t) => ({
      label: PROP_NAMES[t], icon: <PropIcon type={t} size={16} />, keywords: t,
      onClick: () => { const id = useStore.getState().addProperty(db.id, t, undefined, afterId); onAdded?.(id); },
    })),
  ];
  return <Menu items={items} onClose={onClose} searchable placeholder="Search for a property type…" width={240} />;
}

/** Header menu for a property in a view. */
export function PropertyHeaderMenu({ db, view, prop, onClose, onEdit }: { db: Database; view: View; prop: Property; onClose: () => void; onEdit: () => void }) {
  const st = useStore.getState();
  const [name, setName] = useState(prop.name);
  const [confirmDel, setConfirmDel] = useState(false);
  const locked = db.locked;
  const upd = (fn: (v: View) => void) => st.updateView(db.id, view.id, fn);
  const groupable = ['select', 'multi_select', 'status', 'person', 'checkbox', 'date', 'relation', 'text', 'number', 'created_by', 'created_time', 'last_edited_time', 'last_edited_by', 'formula'].includes(prop.type);
  const commitName = () => { if (name.trim() && name !== prop.name) st.updateProperty(db.id, prop.id, { name: name.trim() }); };
  const items: MenuItemDef[] = [
    ...(!locked ? [{ label: 'Edit property', icon: <Settings2 size={16} />, onClick: onEdit }] : []),
    ...(!locked && prop.type !== 'title' ? [{ label: 'Change type', icon: <Repeat size={16} />, right: <span className="faint small">{PROP_NAMES[prop.type]}</span>, submenu: ADDABLE_TYPES.map((t) => ({ label: PROP_NAMES[t], icon: <PropIcon type={t} size={16} />, checked: t === prop.type, onClick: () => st.changePropertyType(db.id, prop.id, t) })) }] : []),
    { divider: true },
    { label: 'Filter', icon: <Filter size={16} />, onClick: () => { upd((v) => { v.filter.rules.push({ id: uid(), propId: prop.id, op: defaultOp(prop.type) }); }); window.dispatchEvent(new CustomEvent('moving:open-filter', { detail: { viewId: view.id } })); } },
    { label: 'Sort ascending', icon: <ArrowUp size={16} />, onClick: () => upd((v) => { v.sorts = [{ propId: prop.id, dir: 'asc' }]; }) },
    { label: 'Sort descending', icon: <ArrowDown size={16} />, onClick: () => upd((v) => { v.sorts = [{ propId: prop.id, dir: 'desc' }]; }) },
    ...(groupable ? [{ label: view.groupBy === prop.id ? 'Ungroup' : 'Group', icon: <Group size={16} />, onClick: () => upd((v) => { v.groupBy = v.groupBy === prop.id ? undefined : prop.id; }) }] : []),
    { divider: true },
    ...(prop.type !== 'title' ? [{ label: 'Hide in view', icon: <EyeOff size={16} />, onClick: () => upd((v) => { v.visible = v.visible.filter((x) => x !== prop.id); }) }] : []),
    { label: view.wrap ? 'Unwrap text' : 'Wrap text', icon: <WrapText size={16} />, onClick: () => upd((v) => { v.wrap = !v.wrap; }) },
    ...(!locked ? [
      { label: 'Insert left', icon: <ArrowLeftToLine size={16} />, submenu: () => <InsertMenu db={db} view={view} at={prop.id} side="left" onClose={onClose} /> },
      { label: 'Insert right', icon: <ArrowRightToLine size={16} />, submenu: () => <InsertMenu db={db} view={view} at={prop.id} side="right" onClose={onClose} /> },
      ...(prop.type !== 'title' ? [
        { label: 'Duplicate property', icon: <Copy size={16} />, onClick: () => st.duplicateProperty(db.id, prop.id) },
        { label: 'Delete property', icon: <Trash2 size={16} />, danger: true, keepOpen: true, onClick: () => setConfirmDel(true) },
      ] : []),
    ] : []),
  ];
  return (
    <>
      <Menu width={250} items={items} onClose={() => { commitName(); onClose(); }} header={
        <div className="prop-menu-head">
          <span className="prop-menu-icon"><PropIcon type={prop.type} size={16} /></span>
          <input className="input" value={name} disabled={locked} autoFocus onChange={(e) => setName(e.target.value)} onBlur={commitName} onKeyDown={(e) => { if (e.key === 'Enter') { commitName(); onClose(); } }} />
        </div>
      } />
      {confirmDel && <ConfirmDialog title={`Delete property “${prop.name}”?`} body="All values in this property will be deleted." danger confirm="Delete" onConfirm={() => { st.deleteProperty(db.id, prop.id); onClose(); }} onClose={() => setConfirmDel(false)} />}
    </>
  );
}

function InsertMenu({ db, view, at, side, onClose }: { db: Database; view: View; at: string; side: 'left' | 'right'; onClose: () => void }) {
  return (
    <AddPropertyMenu db={db} onClose={onClose} afterId={side === 'right' ? at : undefined} onAdded={(id) => {
      if (side === 'left') {
        useStore.getState().updateDb(db.id, (d) => {
          const p = d.properties.find((x) => x.id === id)!;
          d.properties = d.properties.filter((x) => x.id !== id);
          d.properties.splice(d.properties.findIndex((x) => x.id === at), 0, p);
          for (const v of d.views) { v.visible = v.visible.filter((x) => x !== id); const i = v.visible.indexOf(at); v.visible.splice(i < 0 ? v.visible.length : i, 0, id); }
        });
      }
      void view;
    }} />
  );
}

export function defaultOp(type: PropType) {
  switch (type) {
    case 'select': case 'status': return 'is' as const;
    case 'multi_select': case 'person': case 'relation': case 'created_by': case 'last_edited_by': return 'contains' as const;
    case 'number': return 'eq' as const;
    case 'checkbox': return 'checked' as const;
    case 'date': case 'created_time': case 'last_edited_time': return 'is' as const;
    default: return 'contains' as const;
  }
}

// ---------- Property settings panel ----------

export function PropertySettings({ db, prop, anchor, onClose }: { db: Database; prop: Property; anchor: HTMLElement | DOMRect; onClose: () => void }) {
  const st = useStore.getState();
  const fresh = useStore((s) => s.databases[db.id]?.properties.find((p) => p.id === prop.id)) ?? prop;
  const dbs = useStore((s) => s.databases);
  const pages = useStore((s) => s.pages);
  const [name, setName] = useState(fresh.name);
  const upd = (patch: Partial<Property>) => st.updateProperty(db.id, prop.id, patch);
  const [optEdit, setOptEdit] = useState<{ id: string; el: HTMLElement } | null>(null);
  const [newOpt, setNewOpt] = useState('');

  const dbName = (id?: string) => (id && dbs[id] ? (dbs[id].title || pageTitle(pages[dbs[id].pageId]) || 'Untitled') : 'Select a database');

  let body: React.ReactNode = null;
  switch (fresh.type) {
    case 'select': case 'multi_select': case 'status': {
      const opts = fresh.options ?? [];
      const row = (o: typeof opts[number]) => (
        <div key={o.id} className="menu-item option-row" draggable
          onDragStart={(e) => e.dataTransfer.setData('text/opt', o.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const from = e.dataTransfer.getData('text/opt');
            if (!from || from === o.id) return;
            const list = [...opts];
            const f = list.findIndex((x) => x.id === from);
            const [m] = list.splice(f, 1);
            list.splice(list.findIndex((x) => x.id === o.id), 0, { ...m, group: o.group ?? m.group });
            upd({ options: list });
          }}
          onClick={(e) => setOptEdit({ id: o.id, el: e.currentTarget })}>
          <GripVertical size={12} className="faint" /><span className="grow"><Tag name={o.name} color={o.color} status={fresh.type === 'status'} /></span><MoreHorizontal size={14} className="faint" />
        </div>
      );
      body = (
        <>
          <div className="row" style={{ justifyContent: 'space-between', padding: '4px 10px' }}>
            <span className="field-label">Options</span>
            {fresh.type !== 'status' && <button className="btn btn-sm" onClick={() => upd({ options: [...opts].sort((a, b) => a.name.localeCompare(b.name)) })}>Sort A→Z</button>}
          </div>
          {fresh.type === 'status'
            ? (['todo', 'in_progress', 'complete'] as const).map((g) => (
              <div key={g}>
                <div className="row menu-header" style={{ justifyContent: 'space-between' }}>{g === 'todo' ? 'To-do' : g === 'in_progress' ? 'In progress' : 'Complete'}
                  <button className="icon-btn sm" onClick={() => upd({ options: [...opts, { id: uid(), name: `Option ${opts.length + 1}`, color: nextColor(opts.length), group: g }] })}><Plus size={13} /></button>
                </div>
                {opts.filter((o) => o.group === g).map(row)}
              </div>
            ))
            : opts.map(row)}
          {fresh.type !== 'status' && (
            <form style={{ padding: '4px 8px' }} onSubmit={(e) => { e.preventDefault(); if (newOpt.trim() && !opts.some((o) => o.name === newOpt.trim())) { upd({ options: [...opts, { id: uid(), name: newOpt.trim(), color: nextColor(opts.length) }] }); setNewOpt(''); } }}>
              <input className="input" placeholder="+ Add an option" value={newOpt} onChange={(e) => setNewOpt(e.target.value)} />
            </form>
          )}
          {optEdit && opts.find((o) => o.id === optEdit.id) && <OptionEditMenu db={db} prop={fresh} option={opts.find((o) => o.id === optEdit.id)!} anchor={optEdit.el} onClose={() => setOptEdit(null)} />}
        </>
      );
      break;
    }
    case 'number':
      body = (
        <>
          <Field label="Number format"><select className="input" value={fresh.numberFormat ?? 'number'} onChange={(e) => upd({ numberFormat: e.target.value as any })}>{NUMBER_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select></Field>
          <Field label="Show as">
            <div className="seg">{(['number', 'bar', 'ring'] as const).map((k) => <button key={k} className={cx('seg-btn', (fresh.numberShow ?? 'number') === k && 'on')} onClick={() => upd({ numberShow: k })}>{k[0].toUpperCase() + k.slice(1)}</button>)}</div>
          </Field>
        </>
      );
      break;
    case 'date': case 'created_time': case 'last_edited_time':
      body = (
        <>
          <Field label="Date format"><select className="input" value={fresh.dateFormat ?? 'full'} onChange={(e) => upd({ dateFormat: e.target.value as any })}>
            <option value="full">Full date</option><option value="relative">Relative</option><option value="mdy">Month/Day/Year</option><option value="dmy">Day/Month/Year</option><option value="ymd">Year/Month/Day</option>
          </select></Field>
          <Field label="Time format"><select className="input" value={fresh.timeFormat ?? '12'} onChange={(e) => upd({ timeFormat: e.target.value as any })}><option value="12">12 hour</option><option value="24">24 hour</option></select></Field>
        </>
      );
      break;
    case 'formula':
      body = <FormulaEditor db={db} prop={fresh} />;
      break;
    case 'relation': {
      const target = fresh.relationDb ? dbs[fresh.relationDb] : null;
      const twoWay = !!fresh.relationReverse;
      body = (
        <>
          <Field label="Related to">
            <select className="input" value={fresh.relationDb ?? ''} onChange={(e) => upd({ relationDb: e.target.value || undefined })}>
              <option value="">Select a database…</option>
              {Object.values(dbs).filter((d) => d.wsId === db.wsId && pages[d.pageId] && !pages[d.pageId].trashedAt).map((d) => <option key={d.id} value={d.id}>{dbName(d.id)}{d.id === db.id ? ' (this database)' : ''}</option>)}
            </select>
          </Field>
          {target && target.id !== db.id && (
            <div className="menu-item" onClick={() => toggleTwoWay(db, fresh, !twoWay)}>
              <span className="menu-label">Show on {dbName(target.id)}</span><Toggle on={twoWay} onChange={(v) => toggleTwoWay(db, fresh, v)} />
            </div>
          )}
          {twoWay && target && <div className="faint small" style={{ padding: '0 10px 6px' }}>Synced with “{target.properties.find((p) => p.id === fresh.relationReverse)?.name}” on {dbName(target.id)}</div>}
        </>
      );
      break;
    }
    case 'rollup': {
      const rels = db.properties.filter((p) => p.type === 'relation');
      const rel = rels.find((p) => p.id === fresh.rollupRelation);
      const target = rel?.relationDb ? dbs[rel.relationDb] : null;
      body = (
        <>
          <Field label="Relation"><select className="input" value={fresh.rollupRelation ?? ''} onChange={(e) => upd({ rollupRelation: e.target.value || undefined, rollupProp: undefined })}>
            <option value="">Select a relation…</option>{rels.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select></Field>
          {rels.length === 0 && <div className="faint small" style={{ padding: '0 10px' }}>Add a Relation property first.</div>}
          <Field label="Property"><select className="input" disabled={!target} value={fresh.rollupProp ?? ''} onChange={(e) => upd({ rollupProp: e.target.value || undefined })}>
            <option value="">Select a property…</option>{target?.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></Field>
          <Field label="Calculate"><select className="input" value={fresh.rollupFn ?? 'show_original'} onChange={(e) => upd({ rollupFn: e.target.value as any })}>
            {ROLLUP_FNS.map((f) => <option key={f.id} value={f.id}>{f.group} · {f.label}</option>)}
          </select></Field>
          {['sum', 'average', 'median', 'min', 'max', 'range'].includes(fresh.rollupFn ?? '') && (
            <Field label="Number format"><select className="input" value={fresh.numberFormat ?? 'number'} onChange={(e) => upd({ numberFormat: e.target.value as any })}>{NUMBER_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select></Field>
          )}
        </>
      );
      break;
    }
    case 'unique_id':
      body = <Field label="Prefix"><input className="input" placeholder="e.g. TASK" value={fresh.prefix ?? ''} onChange={(e) => upd({ prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} /></Field>;
      break;
    case 'button':
      body = <ButtonPropSettings db={db} prop={fresh} />;
      break;
    case 'person':
      body = <div className="faint small" style={{ padding: '4px 10px' }}>People added to this property are notified in their inbox.</div>;
      break;
  }

  return (
    <Popover anchor={anchor} onClose={() => { if (name.trim() && name !== fresh.name) upd({ name: name.trim() }); onClose(); }} width={fresh.type === 'formula' ? 560 : 300}>
      <div className="menu prop-settings">
        <div className="prop-menu-head">
          <span className="prop-menu-icon"><PropIcon type={fresh.type} size={16} /></span>
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && upd({ name: name.trim() })} />
        </div>
        <Field label="Type">
          <select className="input" value={fresh.type} disabled={fresh.type === 'title'} onChange={(e) => st.changePropertyType(db.id, prop.id, e.target.value as PropType)}>
            {fresh.type === 'title' && <option value="title">Title</option>}
            {ADDABLE_TYPES.map((t) => <option key={t} value={t}>{PROP_NAMES[t]}</option>)}
          </select>
        </Field>
        {body}
        <Field label={<span className="row" style={{ gap: 4 }}>Description <Info size={11} /></span>}>
          <input className="input" placeholder="Add a description…" value={fresh.description ?? ''} onChange={(e) => upd({ description: e.target.value })} />
        </Field>
      </div>
    </Popover>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <div className="field"><div className="field-label">{label}</div>{children}</div>;
}

function toggleTwoWay(db: Database, prop: Property, on: boolean) {
  const st = useStore.getState();
  if (!prop.relationDb) return;
  if (on) {
    const target = st.databases[prop.relationDb];
    const revId = st.addProperty(target.id, 'relation', `Related to ${db.title || pageTitle(st.pages[db.pageId]) || 'Untitled'}`);
    st.updateProperty(target.id, revId, { relationDb: db.id, relationReverse: prop.id });
    st.updateProperty(db.id, prop.id, { relationReverse: revId });
    // backfill reverse links for existing values
    useStore.setState((s) => {
      for (const r of dbRows(s, db.id)) {
        for (const tid of ((r.props[prop.id] as string[]) ?? [])) {
          const t = s.pages[tid];
          if (!t) continue;
          const list = ((t.props[revId] as string[]) ?? []).slice();
          if (!list.includes(r.id)) list.push(r.id);
          t.props[revId] = list;
        }
      }
    });
  } else if (prop.relationReverse) {
    st.updateDb(prop.relationDb, (d) => { d.properties = d.properties.filter((p) => p.id !== prop.relationReverse); d.views.forEach((v) => { v.visible = v.visible.filter((x) => x !== prop.relationReverse); }); });
    st.updateProperty(db.id, prop.id, { relationReverse: undefined });
  }
}

function ButtonPropSettings({ db, prop }: { db: Database; prop: Property }) {
  const st = useStore.getState();
  const actions = prop.buttonActions ?? [];
  const editable = db.properties.filter((p) => ['text', 'number', 'select', 'status', 'checkbox', 'date', 'url'].includes(p.type));
  const set = (a: typeof actions) => st.updateProperty(db.id, prop.id, { buttonActions: a });
  return (
    <>
      <Field label="Button label"><input className="input" value={prop.buttonLabel ?? ''} onChange={(e) => st.updateProperty(db.id, prop.id, { buttonLabel: e.target.value })} /></Field>
      <div className="field-label" style={{ padding: '0 10px' }}>When clicked, edit this page</div>
      {actions.map((a, i) => {
        const p = db.properties.find((x) => x.id === a.propId);
        return (
          <div key={i} className="row" style={{ padding: '2px 10px' }}>
            <select className="input" value={a.propId} onChange={(e) => set(actions.map((x, j) => (j === i ? { propId: e.target.value, value: null } : x)))}>
              {editable.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            {p && (p.type === 'select' || p.type === 'status') ? (
              <select className="input" value={(a.value as string) ?? ''} onChange={(e) => set(actions.map((x, j) => (j === i ? { ...x, value: e.target.value || null } : x)))}>
                <option value="">Empty</option>{p.options?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            ) : p?.type === 'checkbox' ? (
              <select className="input" value={a.value ? '1' : '0'} onChange={(e) => set(actions.map((x, j) => (j === i ? { ...x, value: e.target.value === '1' } : x)))}><option value="1">Checked</option><option value="0">Unchecked</option></select>
            ) : p?.type === 'date' ? (
              <select className="input" value="today" onChange={() => {}}><option value="today">Today</option></select>
            ) : (
              <input className="input" value={String(a.value ?? '')} onChange={(e) => set(actions.map((x, j) => (j === i ? { ...x, value: p?.type === 'number' ? Number(e.target.value) : e.target.value } : x)))} />
            )}
            <button className="icon-btn sm" onClick={() => set(actions.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
          </div>
        );
      })}
      <div style={{ padding: '4px 10px' }}><button className="btn btn-sm" disabled={!editable.length} onClick={() => {
        const p = editable[0];
        set([...actions, { propId: p.id, value: p.type === 'date' ? { start: new Date().toISOString().slice(0, 10) } : null }]);
      }}><Plus size={13} /> Add action</button></div>
    </>
  );
}

// ---------- Formula editor ----------

export function FormulaEditor({ db, prop }: { db: Database; prop: Property }) {
  const st = useStore.getState();
  const [src, setSrc] = useState(prop.formula ?? '');
  const [cat, setCat] = useState<string>('Properties');
  const [hover, setHover] = useState<{ name: string; desc: string; sig: string; example?: string } | null>(null);
  const err = useMemo(() => (src.trim() ? validateFormula(src) : null), [src]);
  const sample = useStore((s) => dbRows(s, db.id)[0]);
  const preview = useMemo(() => {
    if (!sample || err || !src.trim()) return null;
    const res = formulaValue(useStore.getState(), sample, { ...prop, formula: src });
    return res.error ? `Error: ${res.error}` : formatFormulaValue(res.value);
  }, [sample, src, err, prop]);
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const insert = (text: string) => {
    const ta = taRef.current;
    if (!ta) { setSrc((x) => x + text); return; }
    const s0 = ta.selectionStart, e0 = ta.selectionEnd;
    const next = src.slice(0, s0) + text + src.slice(e0);
    setSrc(next);
    requestAnimationFrame(() => { ta.focus(); const pos = s0 + text.length - (text.endsWith(')') ? 1 : 0); ta.setSelectionRange(pos, pos); });
  };
  const cats = ['Properties', 'Logic', 'Text', 'Math', 'Date', 'List', 'People', 'Other'];
  const funcs = FORMULA_FUNCTIONS.filter((f) => f.category === cat);
  const save = () => { if (!err) st.updateProperty(db.id, prop.id, { formula: src }); };
  return (
    <div className="formula-editor">
      <textarea ref={taRef} className="input mono formula-input" rows={4} value={src} placeholder='if(prop("Status") == "Done", "✅", "⏳")' spellCheck={false}
        onChange={(e) => setSrc(e.target.value)} onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } }} />
      <div className={cx('formula-status', err && 'error')}>
        {err ? `⚠︎ ${err}` : preview !== null ? <>Preview for “{sample?.title || 'Untitled'}”: <b>{preview || '(empty)'}</b></> : 'Write a formula. Press Enter to save, Shift+Enter for a new line.'}
      </div>
      <div className="formula-browser">
        <div className="formula-cats">{cats.map((c) => <button key={c} className={cx('formula-cat', c === cat && 'on')} onClick={() => setCat(c)}>{c}</button>)}</div>
        <div className="formula-list">
          {cat === 'Properties'
            ? db.properties.filter((p) => p.id !== prop.id).map((p) => (
              <button key={p.id} className="formula-fn" onMouseEnter={() => setHover({ name: p.name, desc: `${PROP_NAMES[p.type]} property`, sig: `prop("${p.name}")` })} onClick={() => insert(`prop("${p.name}")`)}>
                <PropIcon type={p.type} /> {p.name}
              </button>
            ))
            : funcs.map((f) => (
              <button key={f.name} className="formula-fn" onMouseEnter={() => setHover({ name: f.name, desc: f.description, sig: f.signature, example: f.example })} onClick={() => insert(`${f.name}()`)}>
                <span className="mono">{f.name}</span>
              </button>
            ))}
        </div>
        <div className="formula-help">
          {hover ? <><b className="mono">{hover.sig}</b><p>{hover.desc}</p>{hover.example && <code className="formula-example">{hover.example}</code>}</> : <span className="faint">Hover a function or property to see how it works.</span>}
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', padding: 8 }}>
        <button className="btn btn-primary btn-sm" disabled={!!err} onClick={save}>Save formula</button>
      </div>
    </div>
  );
}
