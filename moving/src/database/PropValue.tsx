import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, File as FileIcon, Plus, X, GripVertical, MoreHorizontal, Check, Upload, Link2 } from 'lucide-react';
import type { Database, DateValue, FileValue, Page, Property, SelectOption, Color } from '../store/types';
import { COLORS } from '../store/types';
import { useStore, pageTitle, dbRows } from '../store/store';
import { Avatar, Checkbox, PageIcon, Popover, Tag, SearchInput, Menu } from '../components/ui';
import DatePicker from '../components/DatePicker';
import { getValue, displayText, formatNumber, formatDateValue, formulaValue, optionName } from './logic';
import { formatFormulaValue } from '../formula/engine';
import { cx, fmtDate, fuzzy, pickFile, readFileAsDataURL, uid, htmlToText, timeAgo } from '../lib/util';
import { goPage } from '../lib/router';

const OPTION_COLORS: Color[] = ['default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];
export const nextColor = (n: number): Color => OPTION_COLORS[1 + (n % 9)];

// ---------- Read-only display ----------

export function PropValueView({ page, prop, wrap, compact }: { page: Page; prop: Property; wrap?: boolean; compact?: boolean }) {
  // No subscription here: parent views subscribe to the store and re-render us.
  const s = useStore.getState();
  const v = getValue(s, page, prop);
  switch (prop.type) {
    case 'title': return <span className="pv-title">{page.title || <span className="faint">Untitled</span>}</span>;
    case 'text': return <span className={cx('pv-text', wrap ? 'wrap' : 'ellipsis')} dangerouslySetInnerHTML={{ __html: String(v ?? '') }} />;
    case 'number': {
      const n = v as number | null;
      if (n == null) return null;
      if (prop.numberShow === 'bar' || prop.numberShow === 'ring') {
        const pct = Math.max(0, Math.min(1, prop.numberFormat === 'percent' ? n : n / 100));
        return prop.numberShow === 'bar'
          ? <span className="pv-bar"><span className="faint">{formatNumber(n, prop.numberFormat)}</span><span className="bar"><span style={{ width: `${pct * 100}%` }} /></span></span>
          : <span className="pv-ring"><svg width="18" height="18" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="none" stroke="var(--border-2)" strokeWidth="3" /><circle cx="10" cy="10" r="8" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray={`${pct * 50.3} 50.3`} transform="rotate(-90 10 10)" /></svg>{formatNumber(n, prop.numberFormat)}</span>;
      }
      return <span className="pv-number">{formatNumber(n, prop.numberFormat)}</span>;
    }
    case 'select': case 'status': {
      const o = prop.options?.find((x) => x.id === v);
      return o ? <Tag name={o.name} color={o.color} status={prop.type === 'status'} /> : null;
    }
    case 'multi_select': {
      const ids = (v as string[]) ?? [];
      return <span className={cx('pv-tags', wrap && 'wrap')}>{ids.map((id) => { const o = prop.options?.find((x) => x.id === id); return o ? <Tag key={id} name={o.name} color={o.color} /> : null; })}</span>;
    }
    case 'date': {
      const d = v as DateValue | null;
      if (!d?.start) return null;
      return <span className="pv-date">{formatDateValue(d, prop)}</span>;
    }
    case 'person': case 'created_by': case 'last_edited_by': {
      const ids = (v as string[]) ?? [];
      return <span className={cx('pv-people', wrap && 'wrap')}>{ids.map((id) => <span key={id} className="pv-person"><Avatar user={s.users[id]} size={20} />{!compact && <span className="ellipsis">{s.users[id]?.name ?? 'Unknown'}</span>}</span>)}</span>;
    }
    case 'files': {
      const files = (v as FileValue[]) ?? [];
      return <span className="pv-tags">{files.map((f, i) => /^data:image|\.(png|jpe?g|gif|webp|svg)/i.test(f.url) ? <img key={i} src={f.url} className="pv-thumb" alt={f.name} /> : <span key={i} className="pv-file"><FileIcon size={12} />{f.name}</span>)}</span>;
    }
    case 'checkbox': return <Checkbox checked={!!v} />;
    case 'url': return v ? <a className="pv-link ellipsis" href={String(v)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{String(v).replace(/^https?:\/\//, '')}</a> : null;
    case 'email': return v ? <a className="pv-link ellipsis" href={`mailto:${v}`} onClick={(e) => e.stopPropagation()}>{String(v)}</a> : null;
    case 'phone': return v ? <a className="pv-link ellipsis" href={`tel:${v}`} onClick={(e) => e.stopPropagation()}>{String(v)}</a> : null;
    case 'relation': {
      const ids = ((v as string[]) ?? []).filter((id) => s.pages[id] && !s.pages[id].trashedAt);
      return <span className={cx('pv-relations', wrap && 'wrap')}>{ids.map((id) => (
        <span key={id} className="pv-relation" onClick={(e) => { e.stopPropagation(); useStore.getState().setPeek({ pageId: id, mode: 'side' }); }}>
          <PageIcon page={s.pages[id]} size={16} /><span className="ellipsis">{pageTitle(s.pages[id])}</span>
        </span>
      ))}</span>;
    }
    case 'formula': {
      const { value, error } = formulaValue(s, page, prop);
      if (error) return <span className="pv-error" title={error}>⚠︎ Error</span>;
      if (typeof value === 'boolean') return <Checkbox checked={value} />;
      if (typeof value === 'number') return <span className="pv-number">{formatNumber(value, prop.numberFormat ?? 'number')}</span>;
      if (Array.isArray(value) && value.some((x: any) => x?.type === 'page')) {
        return <span className="pv-relations">{value.map((x: any, i) => x?.type === 'page' ? <span key={i} className="pv-relation"><PageIcon page={s.pages[x.id]} size={16} />{x.title}</span> : <span key={i}>{formatFormulaValue(x)}</span>)}</span>;
      }
      return <span className={cx('pv-text', wrap ? 'wrap' : 'ellipsis')}>{formatFormulaValue(value)}</span>;
    }
    case 'rollup': {
      const t = displayText(s, page, prop);
      return <span className={cx('pv-text', wrap ? 'wrap' : 'ellipsis')}>{t}</span>;
    }
    case 'created_time': case 'last_edited_time': return <span className="pv-date">{fmtDate(v as number, true, prop.timeFormat === '24')}</span>;
    case 'unique_id': return <span className="pv-number faint">{displayText(s, page, prop)}</span>;
    case 'button': return <ButtonPropView page={page} prop={prop} />;
  }
  return null;
}

function ButtonPropView({ page, prop }: { page: Page; prop: Property }) {
  return (
    <button className="btn btn-sm btn-outline pv-button" onClick={(e) => {
      e.stopPropagation();
      const st = useStore.getState();
      for (const a of prop.buttonActions ?? []) st.setProp(page.id, a.propId, a.value);
      if (!prop.buttonActions?.length) st.showToast('Configure this button in the property settings');
      else st.showToast(`${prop.buttonLabel || prop.name} ran on “${page.title || 'Untitled'}”`);
    }}>{prop.buttonLabel || prop.name}</button>
  );
}

export function isEditable(prop: Property) {
  return !['formula', 'rollup', 'created_time', 'created_by', 'last_edited_time', 'last_edited_by', 'unique_id', 'button'].includes(prop.type);
}

// ---------- Editors ----------

export function PropEditor({ page, prop, db, anchor, onClose, width }: { page: Page; prop: Property; db: Database; anchor: HTMLElement | DOMRect; onClose: () => void; width?: number }) {
  const st = useStore.getState();
  const set = (v: any) => st.setProp(page.id, prop.id, v);
  let body: React.ReactNode = null;
  switch (prop.type) {
    case 'title':
      body = <TextEditor initial={page.title} onCommit={(v) => st.updatePage(page.id, { title: v })} onClose={onClose} />;
      break;
    case 'text': case 'url': case 'email': case 'phone':
      body = <TextEditor initial={prop.type === 'text' ? htmlToText(String(page.props[prop.id] ?? '')) : String(page.props[prop.id] ?? '')} multiline={prop.type === 'text'} onCommit={(v) => set(prop.type === 'text' ? v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>') : v.trim() || null)} onClose={onClose} />;
      break;
    case 'number':
      body = <TextEditor initial={page.props[prop.id] == null ? '' : String(page.props[prop.id])} numeric onCommit={(v) => { const n = parseFloat(v.replace(/[^0-9.\-e]/gi, '')); set(v.trim() === '' || isNaN(n) ? null : prop.numberFormat === 'percent' && v.includes('%') ? n / 100 : n); }} onClose={onClose} />;
      break;
    case 'select': case 'status': case 'multi_select':
      body = <OptionsEditor page={page} prop={prop} db={db} onClose={onClose} />;
      break;
    case 'date':
      body = <DatePicker value={(page.props[prop.id] as DateValue) ?? null} onChange={set}
        format={prop.dateFormat} onFormat={(f) => st.updateProperty(db.id, prop.id, { dateFormat: f })}
        timeFormat={prop.timeFormat} onTimeFormat={(f) => st.updateProperty(db.id, prop.id, { timeFormat: f })}
        remind={!!(page.props[prop.id] as DateValue)?.remind}
        onRemind={(r) => {
          const d = page.props[prop.id] as DateValue;
          if (!d?.start) return;
          set({ ...d, remind: r ? 1 : undefined });
          if (r) st.addReminder({ pageId: page.id, at: new Date(d.start.length > 10 ? d.start : d.start + 'T09:00').getTime(), text: `${prop.name} for “${page.title || 'Untitled'}”` });
        }} />;
      break;
    case 'person':
      body = <PersonEditor page={page} prop={prop} />;
      break;
    case 'relation':
      body = <RelationEditor page={page} prop={prop} />;
      break;
    case 'files':
      body = <FilesEditor page={page} prop={prop} />;
      break;
    case 'checkbox':
      set(!page.props[prop.id]);
      onClose();
      return null;
    default:
      body = <div className="menu" style={{ padding: 12, width: 260 }}><span className="faint small">This property is computed automatically.</span><div style={{ marginTop: 6 }}><PropValueView page={page} prop={prop} wrap /></div></div>;
  }
  return <Popover anchor={anchor} onClose={onClose} width={width}>{body}</Popover>;
}

function TextEditor({ initial, onCommit, onClose, multiline, numeric }: { initial: string; onCommit: (v: string) => void; onClose: () => void; multiline?: boolean; numeric?: boolean }) {
  const [v, setV] = useState(initial);
  const latest = useRef(initial);
  latest.current = v;
  const committed = useRef(false);
  const commit = () => { if (committed.current) return; committed.current = true; if (latest.current !== initial) onCommit(latest.current); };
  // commit when the editor closes (click outside), not on every re-render
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => { committed.current = false; return () => commitRef.current(); }, []);
  const props = {
    autoFocus: true, className: 'input cell-input', value: v,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV(e.target.value),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !(multiline && e.shiftKey)) { e.preventDefault(); commit(); onClose(); }
      if (e.key === 'Escape') { e.preventDefault(); commit(); onClose(); }
    },
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => e.target.select(),
  };
  return <div className="menu cell-editor">{multiline ? <textarea {...props} rows={Math.min(8, Math.max(2, v.split('\n').length))} /> : <input {...props} inputMode={numeric ? 'decimal' : undefined} />}</div>;
}

function OptionsEditor({ page, prop, db, onClose }: { page: Page; prop: Property; db: Database; onClose: () => void }) {
  const st = useStore.getState();
  const fresh = useStore((s) => s.databases[db.id]?.properties.find((p) => p.id === prop.id) ?? prop);
  const val = useStore((s) => s.pages[page.id]?.props[prop.id]);
  const multi = fresh.type === 'multi_select';
  const selected: string[] = multi ? ((val as string[]) ?? []) : val ? [val as string] : [];
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [editOpt, setEditOpt] = useState<{ o: SelectOption; el: HTMLElement } | null>(null);
  const options = (fresh.options ?? []).filter((o) => fuzzy(q, o.name));
  const exact = fresh.options?.find((o) => o.name.toLowerCase() === q.trim().toLowerCase());
  const canCreate = q.trim() && !exact && fresh.type !== 'status';

  const toggle = (id: string) => {
    if (multi) st.setProp(page.id, prop.id, selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    else { st.setProp(page.id, prop.id, selected[0] === id ? null : id); onClose(); }
    setQ('');
  };
  const create = () => {
    const o: SelectOption = { id: uid(), name: q.trim(), color: nextColor(fresh.options?.length ?? 0) };
    st.updateProperty(db.id, prop.id, { options: [...(fresh.options ?? []), o] });
    toggle(o.id);
  };
  const groups = fresh.type === 'status' ? (['todo', 'in_progress', 'complete'] as const) : null;

  const row = (o: SelectOption, i: number) => (
    <div key={o.id} className={cx('menu-item option-row', i === active && 'active')} onMouseMove={() => setActive(i)} onClick={() => toggle(o.id)}>
      <GripVertical size={12} className="faint" />
      <span className="grow"><Tag name={o.name} color={o.color} status={fresh.type === 'status'} /></span>
      {selected.includes(o.id) && <Check size={14} />}
      <button className="icon-btn sm" onClick={(e) => { e.stopPropagation(); setEditOpt({ o, el: e.currentTarget }); }}><MoreHorizontal size={14} /></button>
    </div>
  );

  return (
    <div className="menu options-editor" style={{ width: 300 }}>
      <div className="options-input">
        {selected.map((id) => { const o = fresh.options?.find((x) => x.id === id); return o ? <Tag key={id} name={o.name} color={o.color} status={fresh.type === 'status'} onRemove={() => toggle(id)} /> : null; })}
        <input autoFocus value={q} placeholder={selected.length ? '' : fresh.type === 'status' ? 'Search for an option…' : 'Search for an option…'} onChange={(e) => { setQ(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(options.length - (canCreate ? 0 : 1), a + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
            if (e.key === 'Enter') { e.preventDefault(); if (canCreate && (active >= options.length || !options.length)) create(); else if (options[active]) toggle(options[active].id); else if (exact) toggle(exact.id); }
            if (e.key === 'Backspace' && !q && selected.length) toggle(selected[selected.length - 1]);
            if (e.key === 'Escape') onClose();
          }} />
      </div>
      <div className="menu-list" style={{ maxHeight: 320 }}>
        <div className="menu-header">{fresh.type === 'status' ? '' : 'Select an option or create one'}</div>
        {groups
          ? groups.map((g) => (
            <div key={g}>
              <div className="menu-header">{g === 'todo' ? 'To-do' : g === 'in_progress' ? 'In progress' : 'Complete'}</div>
              {options.filter((o) => o.group === g).map((o) => row(o, options.indexOf(o)))}
            </div>
          ))
          : options.map(row)}
        {canCreate && (
          <div className={cx('menu-item', active === options.length && 'active')} onMouseMove={() => setActive(options.length)} onClick={create}>
            <span className="faint">Create</span> <Tag name={q.trim()} color={nextColor(fresh.options?.length ?? 0)} />
          </div>
        )}
      </div>
      {editOpt && <OptionEditMenu db={db} prop={fresh} option={editOpt.o} anchor={editOpt.el} onClose={() => setEditOpt(null)} />}
    </div>
  );
}

export function OptionEditMenu({ db, prop, option, anchor, onClose }: { db: Database; prop: Property; option: SelectOption; anchor: HTMLElement; onClose: () => void }) {
  const st = useStore.getState();
  const [name, setName] = useState(option.name);
  const save = (patch: Partial<SelectOption>) => st.updateProperty(db.id, prop.id, { options: (prop.options ?? []).map((o) => (o.id === option.id ? { ...o, ...patch } : o)) });
  return (
    <Popover anchor={anchor} onClose={() => { if (name.trim() && name !== option.name) save({ name: name.trim() }); onClose(); }} placement="right-start">
      <Menu width={220} onClose={onClose} header={
        <div style={{ padding: 8 }}><input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { save({ name: name.trim() || option.name }); onClose(); } }} /></div>
      } items={[
        { label: 'Delete', danger: true, icon: <X size={16} />, disabled: prop.type === 'status' && (prop.options ?? []).filter((o) => o.group === option.group).length <= 1, onClick: () => {
          st.updateProperty(db.id, prop.id, { options: (prop.options ?? []).filter((o) => o.id !== option.id) });
        } },
        { header: 'Colors' },
        ...COLORS.map((c) => ({ label: c === 'default' ? 'Default' : c[0].toUpperCase() + c.slice(1), icon: <span className={cx('color-dot', `tag-${c}`)} />, checked: option.color === c, onClick: () => save({ color: c }) })),
      ]} />
    </Popover>
  );
}

function PersonEditor({ page, prop }: { page: Page; prop: Property }) {
  const s = useStore();
  const [q, setQ] = useState('');
  const val = ((s.pages[page.id]?.props[prop.id] as string[]) ?? []);
  const members = s.workspaces[s.wsId].members.map((m) => s.users[m.userId]).filter(Boolean);
  const list = members.filter((u) => fuzzy(q, u.name, u.email));
  const toggle = (id: string) => s.setProp(page.id, prop.id, val.includes(id) ? val.filter((x) => x !== id) : [...val, id]);
  return (
    <div className="menu" style={{ width: 300 }}>
      <div className="options-input">
        {val.map((id) => <span key={id} className="tag tag-default"><Avatar user={s.users[id]} size={16} />&nbsp;{s.users[id]?.name}<span className="x" onClick={() => toggle(id)}><X size={12} /></span></span>)}
        <input autoFocus value={q} placeholder="Search for a person…" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && list[0]) toggle(list[0].id); }} />
      </div>
      <div className="menu-list">
        <div className="menu-header">Select as many as you like</div>
        {list.map((u) => (
          <div key={u.id} className="menu-item" onClick={() => toggle(u.id)}>
            <Avatar user={u} size={20} /><span className="menu-label">{u.name}{u.id === s.meId && <span className="faint"> (you)</span>}</span>
            {val.includes(u.id) && <Check size={14} />}
          </div>
        ))}
        {q.includes('@') && !members.some((u) => u.email === q) && (
          <div className="menu-item" onClick={() => { const id = s.inviteMember(q, 'guest'); toggle(id); setQ(''); }}>
            <Plus size={14} /><span className="menu-label">Invite {q} as guest</span>
          </div>
        )}
      </div>
    </div>
  );
}

function RelationEditor({ page, prop }: { page: Page; prop: Property }) {
  const s = useStore();
  const [q, setQ] = useState('');
  const target = prop.relationDb ? s.databases[prop.relationDb] : null;
  const val = ((s.pages[page.id]?.props[prop.id] as string[]) ?? []);
  const rows = useMemo(() => (target ? dbRows(s, target.id) : []), [s, target]);
  if (!target) return <div className="menu" style={{ padding: 12, width: 260 }}><span className="faint small">Choose a related database in the property settings first.</span></div>;
  const list = rows.filter((r) => fuzzy(q, r.title || 'Untitled'));
  const toggle = (id: string) => s.setProp(page.id, prop.id, val.includes(id) ? val.filter((x) => x !== id) : [...val, id]);
  return (
    <div className="menu" style={{ width: 340 }}>
      <div className="menu-search"><SearchInput autoFocus value={q} onChange={setQ} placeholder={`Link or create a page in ${target.title || pageTitle(s.pages[target.pageId])}…`} /></div>
      <div className="menu-list" style={{ maxHeight: 340 }}>
        {val.length > 0 && <div className="menu-header">Linked</div>}
        {val.filter((id) => s.pages[id]).map((id) => (
          <div key={id} className="menu-item" onClick={() => toggle(id)}>
            <PageIcon page={s.pages[id]} size={18} /><span className="menu-label ellipsis">{pageTitle(s.pages[id])}</span>
            <button className="icon-btn sm" onClick={(e) => { e.stopPropagation(); goPage(id); }}><ArrowUpRight size={14} /></button>
            <X size={14} className="faint" />
          </div>
        ))}
        <div className="menu-header">{val.length ? 'Link another page' : 'Select a page'}</div>
        {list.filter((r) => !val.includes(r.id)).slice(0, 50).map((r) => (
          <div key={r.id} className="menu-item" onClick={() => toggle(r.id)}>
            <PageIcon page={r} size={18} /><span className="menu-label ellipsis">{pageTitle(r)}</span><Plus size={14} className="faint" />
          </div>
        ))}
        {q.trim() && (
          <div className="menu-item" onClick={() => { const id = s.addRow(target.id, {}, undefined, q.trim()); toggle(id); setQ(''); }}>
            <Plus size={14} /><span className="menu-label">New page “{q.trim()}”</span>
          </div>
        )}
      </div>
    </div>
  );
}

function FilesEditor({ page, prop }: { page: Page; prop: Property }) {
  const s = useStore();
  const files = ((s.pages[page.id]?.props[prop.id] as FileValue[]) ?? []);
  const [link, setLink] = useState('');
  const set = (f: FileValue[]) => s.setProp(page.id, prop.id, f);
  return (
    <div className="menu" style={{ width: 340, padding: 8 }}>
      {files.map((f, i) => (
        <div key={i} className="menu-item">
          {/^data:image|\.(png|jpe?g|gif|webp|svg)/i.test(f.url) ? <img src={f.url} className="pv-thumb" alt="" /> : <FileIcon size={14} />}
          <a className="menu-label ellipsis" href={f.url} download={f.name} target="_blank" rel="noreferrer">{f.name}</a>
          <button className="icon-btn sm" onClick={() => set(files.filter((_, j) => j !== i))}><X size={14} /></button>
        </div>
      ))}
      <div className="sep" />
      <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }} onClick={async () => {
        const picked = await pickFile('*/*', true);
        const added: FileValue[] = [];
        for (const f of picked) added.push({ name: f.name, url: await readFileAsDataURL(f) });
        set([...files, ...added]);
      }}><Upload size={14} /> Upload files</button>
      <form className="row" style={{ marginTop: 6 }} onSubmit={(e) => { e.preventDefault(); if (link.trim()) { set([...files, { name: link.split('/').pop() || link, url: link.trim() }]); setLink(''); } }}>
        <Link2 size={14} className="faint" /><input className="input" placeholder="Paste file link…" value={link} onChange={(e) => setLink(e.target.value)} />
      </form>
    </div>
  );
}

// ---------- Inline cell used by table & property list ----------

export function PropertyCell({ page, prop, db, readOnly, wrap, className, placeholder }: { page: Page; prop: Property; db: Database; readOnly?: boolean; wrap?: boolean; className?: string; placeholder?: string }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const empty = displayText(useStore.getState(), page, prop) === '' && prop.type !== 'checkbox' && prop.type !== 'button';
  const open = () => {
    if (readOnly || !isEditable(prop)) return;
    if (prop.type === 'checkbox') { useStore.getState().setProp(page.id, prop.id, !page.props[prop.id]); return; }
    setAnchor(ref.current);
  };
  const wide = ['text', 'title', 'url', 'email', 'phone', 'number'].includes(prop.type);
  return (
    <>
      <div ref={ref} className={cx('prop-cell', className, !readOnly && isEditable(prop) && 'editable', `pt-${prop.type}`)} onClick={open}
        tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); open(); } }}>
        {empty && placeholder ? <span className="faint">{placeholder}</span> : <PropValueView page={page} prop={prop} wrap={wrap} />}
      </div>
      {anchor && (
        <PropEditor page={page} prop={prop} db={db} anchor={wide ? overlayRect(anchor) : anchor}
          width={wide ? Math.max(anchor.offsetWidth, 240) : undefined} onClose={() => setAnchor(null)} />
      )}
    </>
  );
}

/** A zero-height rect just above the cell so the popover editor overlays it. */
function overlayRect(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return new DOMRect(r.left, r.top - 4, r.width, 0);
}

export { optionName, timeAgo };
