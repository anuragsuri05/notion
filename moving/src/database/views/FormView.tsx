import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, Eye, Link2, Plus, Trash2, Pencil, CheckCircle2 } from 'lucide-react';
import type { Database, FileValue, PropType, Property, PropValue, View } from '../../store/types';
import { useStore, PROP_NAMES } from '../../store/store';
import type { ViewProps } from '../viewTypes';
import { Avatar, MenuPopover, Tag, Toggle, type Anchor, type MenuItemDef } from '../../components/ui';
import { cx, escapeHtml, readFileAsDataURL } from '../../lib/util';

type Form = NonNullable<View['form']>;
type Question = Form['questions'][number];

const UNSUPPORTED: PropType[] = ['formula', 'rollup', 'created_time', 'created_by', 'last_edited_time', 'last_edited_by', 'unique_id', 'button', 'relation'];
const NEW_TYPES: PropType[] = ['text', 'number', 'select', 'multi_select', 'status', 'date', 'person', 'files', 'checkbox', 'url', 'email', 'phone'];

function defaultForm(db: Database): Form {
  const title = db.properties.find((p) => p.type === 'title');
  return { questions: title ? [{ propId: title.id, required: true }] : [] };
}

export default function FormView(props: ViewProps) {
  const { db, view, readOnly, updateView } = props;
  const [preview, setPreview] = useState(false);
  const form = view.form ?? defaultForm(db);

  if (readOnly || preview) {
    return (
      <div className="form-view">
        {preview && !readOnly && (
          <div className="form-preview-bar">
            <Eye size={14} /> Previewing form — responses submitted here are saved
            <div className="grow" />
            <button className="btn btn-sm btn-outline" onClick={() => setPreview(false)}><Pencil size={13} /> Back to editing</button>
          </div>
        )}
        <FormFill {...props} form={form} />
      </div>
    );
  }

  const patch = (fn: (f: Form) => void) => updateView((v) => {
    if (!v.form) v.form = defaultForm(db);
    fn(v.form);
  });

  return <FormBuilder db={db} view={view} form={form} patch={patch} onPreview={() => setPreview(true)} />;
}

// ---------- Builder ----------

function FormBuilder({ db, view, form, patch, onPreview }: { db: Database; view: View; form: Form; patch: (fn: (f: Form) => void) => void; onPreview: () => void }) {
  const [addAnchor, setAddAnchor] = useState<Anchor>(null);
  const questions = form.questions.filter((q) => db.properties.some((p) => p.id === q.propId));
  const used = new Set(questions.map((q) => q.propId));
  const available = db.properties.filter((p) => !used.has(p.id) && !UNSUPPORTED.includes(p.type));

  const copyLink = () => {
    const link = `${location.origin}${location.pathname}#/form/${db.id}/${view.id}`;
    const done = () => useStore.getState().showToast('Copied form link to clipboard');
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(done, () => useStore.getState().showToast(link));
    else useStore.getState().showToast(link);
  };

  const addQuestion = (propId: string) => patch((f) => { f.questions.push({ propId }); });
  const move = (i: number, d: number) => patch((f) => {
    const list = f.questions.filter((q) => db.properties.some((p) => p.id === q.propId));
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    f.questions = list;
  });
  const edit = (propId: string, fn: (q: Question) => void) => patch((f) => { const q = f.questions.find((x) => x.propId === propId); if (q) fn(q); });

  const menuItems: MenuItemDef[] = [
    ...(available.length ? [{ header: 'Existing properties' } as MenuItemDef] : []),
    ...available.map((p) => ({ label: p.name, hint: PROP_NAMES[p.type], keywords: p.type, onClick: () => addQuestion(p.id) })),
    { header: 'New property' },
    ...NEW_TYPES.map((t) => ({
      label: PROP_NAMES[t],
      keywords: t,
      onClick: () => {
        const id = useStore.getState().addProperty(db.id, t, PROP_NAMES[t]);
        addQuestion(id);
      },
    })),
  ];

  return (
    <div className="form-view form-builder">
      <div className="form-canvas">
        <div className="form-card form-head-card">
          <input
            className="form-title-input"
            placeholder="Form title"
            value={form.title ?? ''}
            onChange={(e) => { const v = e.target.value; patch((f) => { f.title = v; }); }}
          />
          <textarea
            className="form-desc-input"
            placeholder="Add a description…"
            rows={2}
            value={form.description ?? ''}
            onChange={(e) => { const v = e.target.value; patch((f) => { f.description = v; }); }}
          />
        </div>

        {questions.map((q, i) => {
          const prop = db.properties.find((p) => p.id === q.propId)!;
          return (
            <div key={q.propId} className="form-card form-question">
              <div className="form-q-head">
                <input
                  className="form-q-label"
                  value={q.label ?? prop.name}
                  placeholder={prop.name}
                  onChange={(e) => { const v = e.target.value; edit(q.propId, (x) => { x.label = v; }); }}
                />
                {q.required && <span className="form-required">*</span>}
                <div className="form-q-actions">
                  <button className="icon-btn sm" disabled={i === 0} onClick={() => move(i, -1)} title="Move up"><ArrowUp size={14} /></button>
                  <button className="icon-btn sm" disabled={i === questions.length - 1} onClick={() => move(i, 1)} title="Move down"><ArrowDown size={14} /></button>
                  {prop.type !== 'title' && (
                    <button className="icon-btn sm" onClick={() => patch((f) => { f.questions = f.questions.filter((x) => x.propId !== q.propId); })} title="Delete question"><Trash2 size={14} /></button>
                  )}
                </div>
              </div>
              <div className="form-q-meta faint">
                <span>{PROP_NAMES[prop.type]} · maps to “{prop.name}”</span>
                <div className="grow" />
                <span className="row" style={{ gap: 6 }}>Required <Toggle on={!!q.required} onChange={(v) => edit(q.propId, (x) => { x.required = v; })} /></span>
              </div>
              <div className="form-q-preview">
                <FieldInput prop={prop} value={undefined} onChange={() => {}} disabled />
              </div>
            </div>
          );
        })}

        <button className="form-add-q" onClick={(e) => setAddAnchor(e.currentTarget)}><Plus size={16} /> Add question</button>
      </div>

      <aside className="form-settings">
        <button className="btn btn-primary form-settings-btn" onClick={onPreview}><Eye size={14} /> Preview form</button>
        <button className="btn btn-outline form-settings-btn" onClick={copyLink}><Link2 size={14} /> Copy form link</button>
        <div className="form-settings-section">
          <div className="form-setting">
            <span className="grow">Accepting responses</span>
            <Toggle on={!form.closed} onChange={(v) => patch((f) => { f.closed = !v; })} />
          </div>
          <div className="form-setting">
            <span className="grow">Anonymous submissions</span>
            <Toggle on={!!form.anonymous} onChange={(v) => patch((f) => { f.anonymous = v; })} />
          </div>
        </div>
        <div className="form-settings-section">
          <div className="form-setting-label">Thank-you message</div>
          <textarea
            className="input"
            rows={3}
            placeholder="Thanks for your response!"
            value={form.thanks ?? ''}
            onChange={(e) => { const v = e.target.value; patch((f) => { f.thanks = v; }); }}
          />
        </div>
        <div className="form-settings-section faint">
          {form.submitted ?? 0} response{(form.submitted ?? 0) === 1 ? '' : 's'}
        </div>
      </aside>

      {addAnchor && <MenuPopover anchor={addAnchor} onClose={() => setAddAnchor(null)} items={menuItems} searchable placeholder="Search properties…" />}
    </div>
  );
}

// ---------- Fill-in ----------

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'boolean') return v === false;
  return false;
}

function FormFill({ db, view, addRow, updateView, form }: ViewProps & { form: Form }) {
  const me = useStore((s) => s.users[s.meId]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const questions = form.questions.filter((q) => db.properties.some((p) => p.id === q.propId));

  if (form.closed) {
    return (
      <div className="form-fill">
        <div className="form-card form-closed">
          <div className="form-fill-title">{form.title || db.title || 'Form'}</div>
          <div className="muted">This form is no longer accepting responses.</div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="form-fill">
        <div className="form-card form-thanks">
          <CheckCircle2 size={36} className="form-thanks-icon" />
          <div className="form-fill-title">{form.thanks?.trim() || 'Thanks for your response!'}</div>
          <button className="btn btn-outline" onClick={() => { setValues({}); setErrors(new Set()); setDone(false); }}>Submit another response</button>
        </div>
      </div>
    );
  }

  const submit = () => {
    const missing = new Set(questions.filter((q) => q.required && isEmpty(values[q.propId])).map((q) => q.propId));
    setErrors(missing);
    if (missing.size) return;
    setBusy(true);
    const out: Record<string, PropValue> = {};
    let title = '';
    for (const q of questions) {
      const prop = db.properties.find((p) => p.id === q.propId)!;
      const v = values[q.propId];
      if (isEmpty(v) && prop.type !== 'checkbox') continue;
      switch (prop.type) {
        case 'title': title = String(v).trim(); break;
        case 'text': out[prop.id] = escapeHtml(String(v)).replace(/\n/g, '<br>'); break;
        case 'number': { const n = parseFloat(String(v)); if (!isNaN(n)) out[prop.id] = n; break; }
        case 'date': out[prop.id] = { start: String(v) }; break;
        case 'checkbox': out[prop.id] = !!v; break;
        case 'multi_select': case 'person': out[prop.id] = v as string[]; break;
        case 'files': out[prop.id] = v as FileValue[]; break;
        default: out[prop.id] = String(v).trim();
      }
    }
    addRow(out, { title, open: false });
    updateView((vw) => {
      if (!vw.form) vw.form = { ...form, questions: form.questions.slice() };
      vw.form.submitted = (vw.form.submitted ?? 0) + 1;
    });
    setBusy(false);
    setDone(true);
  };

  return (
    <div className="form-fill">
      <div className="form-card form-head-card">
        <div className="form-fill-title">{form.title || db.title || 'Untitled form'}</div>
        {form.description && <div className="form-fill-desc">{form.description}</div>}
        {!form.anonymous && me && (
          <div className="form-responder faint"><Avatar user={me} size={18} /> Responding as {me.name}</div>
        )}
      </div>
      {questions.map((q) => {
        const prop = db.properties.find((p) => p.id === q.propId)!;
        const err = errors.has(q.propId);
        return (
          <div key={q.propId} className={cx('form-card form-question', err && 'form-error')}>
            <div className="form-q-title">{q.label || prop.name}{q.required && <span className="form-required">*</span>}</div>
            <FieldInput prop={prop} value={values[q.propId]} onChange={(v) => { setValues((x) => ({ ...x, [q.propId]: v })); if (err) setErrors((e) => { const n = new Set(e); n.delete(q.propId); return n; }); }} />
            {err && <div className="form-error-text">This question is required</div>}
          </div>
        );
      })}
      <div className="form-submit-row">
        <button className="btn btn-primary form-submit" disabled={busy || questions.length === 0} onClick={submit}>Submit</button>
      </div>
    </div>
  );
}

// ---------- Field inputs ----------

function FieldInput({ prop, value, onChange, disabled }: { prop: Property; value: unknown; onChange: (v: unknown) => void; disabled?: boolean }) {
  const users = useStore((s) => s.users);
  const members = useStore((s) => s.workspaces[s.wsId]?.members ?? []);
  switch (prop.type) {
    case 'title': case 'url': case 'email': case 'phone':
      return <input className="input form-input" disabled={disabled} type={prop.type === 'email' ? 'email' : prop.type === 'url' ? 'url' : prop.type === 'phone' ? 'tel' : 'text'} placeholder={prop.type === 'title' ? 'Your answer' : prop.type === 'url' ? 'https://' : prop.type === 'email' ? 'name@example.com' : 'Your answer'} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
    case 'text':
      return <textarea className="input form-input" disabled={disabled} rows={3} placeholder="Your answer" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
      return <input className="input form-input" disabled={disabled} type="number" placeholder="0" value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} />;
    case 'date':
      return <input className="input form-input form-date" disabled={disabled} type="date" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
    case 'checkbox':
      return (
        <label className="form-check">
          <input type="checkbox" disabled={disabled} checked={!!value} onChange={(e) => onChange(e.target.checked)} /> Yes
        </label>
      );
    case 'select': case 'status':
      return (
        <div className="form-options">
          {(prop.options ?? []).map((o) => (
            <button key={o.id} type="button" disabled={disabled} className={cx('form-option', value === o.id && 'selected')} onClick={() => onChange(value === o.id ? null : o.id)}>
              <span className={cx('form-radio', value === o.id && 'on')} />
              <Tag name={o.name} color={o.color} status={prop.type === 'status'} />
            </button>
          ))}
          {!prop.options?.length && <span className="faint">No options yet</span>}
        </div>
      );
    case 'multi_select': {
      const list = (value as string[]) ?? [];
      return (
        <div className="form-options">
          {(prop.options ?? []).map((o) => {
            const on = list.includes(o.id);
            return (
              <button key={o.id} type="button" disabled={disabled} className={cx('form-option', on && 'selected')} onClick={() => onChange(on ? list.filter((x) => x !== o.id) : [...list, o.id])}>
                <span className={cx('form-checkbox', on && 'on')}>{on && <Check size={11} strokeWidth={3} />}</span>
                <Tag name={o.name} color={o.color} />
              </button>
            );
          })}
          {!prop.options?.length && <span className="faint">No options yet</span>}
        </div>
      );
    }
    case 'person': {
      const list = (value as string[]) ?? [];
      return (
        <div className="col" style={{ gap: 6 }}>
          {list.length > 0 && (
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              {list.map((id) => (
                <span key={id} className="tag tag-default form-person">
                  <Avatar user={users[id]} size={16} />&nbsp;{users[id]?.name}
                  <span className="x" onClick={() => onChange(list.filter((x) => x !== id))}>×</span>
                </span>
              ))}
            </div>
          )}
          <select className="input form-input" disabled={disabled} value="" onChange={(e) => { const id = e.target.value; if (id && !list.includes(id)) onChange([...list, id]); }}>
            <option value="">Select a person…</option>
            {members.map((m) => users[m.userId]).filter(Boolean).filter((u) => !list.includes(u.id)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      );
    }
    case 'files': {
      const files = (value as FileValue[]) ?? [];
      return (
        <div className="col" style={{ gap: 6 }}>
          {files.map((f, i) => (
            <div key={i} className="form-file row">
              <span className="ellipsis grow">{f.name}</span>
              <button className="icon-btn sm" onClick={() => onChange(files.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
            </div>
          ))}
          <input
            type="file"
            multiple
            disabled={disabled}
            className="form-file-input"
            onChange={async (e) => {
              const picked = Array.from(e.target.files ?? []);
              e.target.value = '';
              const added = await Promise.all(picked.map(async (f) => ({ name: f.name, url: await readFileAsDataURL(f) })));
              onChange([...files, ...added]);
            }}
          />
        </div>
      );
    }
  }
  return <span className="faint">This property type can’t be filled in a form.</span>;
}
