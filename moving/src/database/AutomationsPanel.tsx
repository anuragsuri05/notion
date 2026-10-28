import { useState } from 'react';
import { Zap, Plus, Trash2, ChevronLeft, Bell, PenLine } from 'lucide-react';
import type { Automation, Database } from '../store/types';
import { useStore } from '../store/store';
import { Popover, Toggle } from '../components/ui';
import { timeAgo } from '../lib/util';

export default function AutomationsPanel({ db, anchor, onClose }: { db: Database; anchor: HTMLElement; onClose: () => void }) {
  const fresh = useStore((s) => s.databases[db.id]) ?? db;
  const st = useStore.getState();
  const [editing, setEditing] = useState<string | null>(null);
  const a = fresh.automations.find((x) => x.id === editing);
  return (
    <Popover anchor={anchor} onClose={onClose} placement="bottom-end" width={400}>
      <div className="menu automations">
        {!a ? (
          <>
            <div className="vs-head"><Zap size={16} /><b>Automations</b></div>
            {fresh.automations.length === 0 && <div className="faint small" style={{ padding: '6px 12px' }}>Automate repetitive work: when a page is added or a property changes, set properties or send notifications.</div>}
            {fresh.automations.map((x) => (
              <div key={x.id} className="menu-item" onClick={() => setEditing(x.id)}>
                <Zap size={14} className={x.enabled ? '' : 'faint'} />
                <div className="grow">
                  <div>{x.name}</div>
                  <div className="faint small">{describe(fresh, x)} · {x.runs} run{x.runs === 1 ? '' : 's'}{x.lastRun ? ` · last ${timeAgo(x.lastRun)}` : ''}</div>
                </div>
                <Toggle on={x.enabled} onChange={(v) => st.updateAutomation(db.id, x.id, (y) => { y.enabled = v; })} />
              </div>
            ))}
            <div className="sep" />
            <div className="menu-item" onClick={() => setEditing(st.addAutomation(db.id))}><Plus size={14} /><span className="menu-label">New automation</span></div>
          </>
        ) : (
          <AutomationEditor db={fresh} a={a} onBack={() => setEditing(null)} />
        )}
      </div>
    </Popover>
  );
}

function describe(db: Database, a: Automation) {
  const t = a.trigger.kind === 'page_added' ? 'When a page is added' : `When ${db.properties.find((p) => p.id === a.trigger.propId)?.name ?? 'any property'} is edited`;
  return `${t} → ${a.actions.length} action${a.actions.length === 1 ? '' : 's'}`;
}

function AutomationEditor({ db, a, onBack }: { db: Database; a: Automation; onBack: () => void }) {
  const st = useStore.getState();
  const upd = (fn: (x: Automation) => void) => st.updateAutomation(db.id, a.id, fn);
  const editable = db.properties.filter((p) => ['select', 'status', 'checkbox', 'text', 'number', 'date', 'person', 'url'].includes(p.type));
  return (
    <>
      <div className="vs-head"><button className="icon-btn sm" onClick={onBack}><ChevronLeft size={16} /></button><input className="input" value={a.name} onChange={(e) => upd((x) => { x.name = e.target.value; })} /><Toggle on={a.enabled} onChange={(v) => upd((x) => { x.enabled = v; })} /></div>
      <div className="field"><div className="field-label">Trigger</div>
        <select className="input" value={a.trigger.kind === 'page_added' ? 'page_added' : `prop:${a.trigger.propId ?? ''}`} onChange={(e) => {
          const v = e.target.value;
          upd((x) => { x.trigger = v === 'page_added' ? { kind: 'page_added' } : { kind: 'prop_edited', propId: v.slice(5) || undefined }; });
        }}>
          <option value="page_added">Page added</option>
          <option value="prop:">Any property edited</option>
          {db.properties.filter((p) => p.type !== 'title' && !['formula', 'rollup', 'created_time', 'created_by', 'last_edited_time', 'last_edited_by'].includes(p.type)).map((p) => <option key={p.id} value={`prop:${p.id}`}>{p.name} edited</option>)}
        </select>
      </div>
      <div className="field"><div className="field-label">Actions</div>
        {a.actions.map((act, i) => {
          const p = db.properties.find((x) => x.id === act.propId);
          return (
            <div key={i} className="action-card">
              <div className="row">{act.kind === 'set_prop' ? <PenLine size={14} /> : <Bell size={14} />}<b className="grow">{act.kind === 'set_prop' ? 'Edit property' : 'Send notification'}</b><button className="icon-btn sm" onClick={() => upd((x) => { x.actions.splice(i, 1); })}><Trash2 size={13} /></button></div>
              {act.kind === 'set_prop' ? (
                <div className="row">
                  <select className="input" value={act.propId ?? ''} onChange={(e) => upd((x) => { x.actions[i].propId = e.target.value; x.actions[i].value = null; })}>
                    {editable.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                  {p && (p.type === 'select' || p.type === 'status') && (
                    <select className="input" value={(act.value as string) ?? ''} onChange={(e) => upd((x) => { x.actions[i].value = e.target.value || null; })}><option value="">Empty</option>{p.options?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
                  )}
                  {p?.type === 'checkbox' && <select className="input" value={act.value ? '1' : '0'} onChange={(e) => upd((x) => { x.actions[i].value = e.target.value === '1'; })}><option value="1">Checked</option><option value="0">Unchecked</option></select>}
                  {p?.type === 'person' && <select className="input" value={(act.value as string[])?.[0] ?? ''} onChange={(e) => upd((x) => { x.actions[i].value = e.target.value ? [e.target.value] : []; })}><option value="">Nobody</option>{useStore.getState().workspaces[useStore.getState().wsId].members.map((m) => <option key={m.userId} value={m.userId}>{useStore.getState().users[m.userId]?.name}</option>)}</select>}
                  {p?.type === 'date' && <select className="input" value="today" onChange={() => {}}><option value="today">Today</option></select>}
                  {p && ['text', 'number', 'url'].includes(p.type) && <input className="input" value={String(act.value ?? '')} onChange={(e) => upd((x) => { x.actions[i].value = p.type === 'number' ? Number(e.target.value) : e.target.value; })} />}
                </div>
              ) : (
                <input className="input" placeholder="Message (optional)" value={act.message ?? ''} onChange={(e) => upd((x) => { x.actions[i].message = e.target.value; })} />
              )}
            </div>
          );
        })}
        <div className="row">
          <button className="btn btn-sm" disabled={!editable.length} onClick={() => upd((x) => { const p = editable[0]; x.actions.push({ kind: 'set_prop', propId: p.id, value: p.type === 'date' ? { start: new Date().toISOString().slice(0, 10) } : null }); })}><Plus size={13} /> Edit property</button>
          <button className="btn btn-sm" onClick={() => upd((x) => { x.actions.push({ kind: 'notify' }); })}><Plus size={13} /> Send notification</button>
        </div>
      </div>
      <div className="row" style={{ padding: 10, justifyContent: 'space-between' }}>
        <button className="btn btn-sm btn-danger" onClick={() => { st.deleteAutomation(db.id, a.id); onBack(); }}><Trash2 size={13} /> Delete</button>
        <button className="btn btn-sm btn-primary" onClick={onBack}>Done</button>
      </div>
    </>
  );
}
