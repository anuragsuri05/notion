import React, { useEffect, useRef, useState } from 'react';
import type { Block, Database, Page, Property, PropValue, View } from '../../store/types';
import type { PersistedState } from '../../store/store';
import { useStore } from '../../store/store';
import { PageIcon } from '../../components/ui';
import { PropValueView } from '../PropValue';
import { displayText } from '../logic';
import { cx, escapeHtml, htmlToText, parseISO, toISODate } from '../../lib/util';

// ---------- Shared helpers for database layouts ----------

/** Visible, non-title properties of a view, in order. */
export function visibleProps(db: Database, view: View): Property[] {
  return view.visible
    .map((id) => db.properties.find((p) => p.id === id))
    .filter((p): p is Property => !!p && p.type !== 'title');
}

/** Whether a row's value for a property is empty (nothing worth rendering). */
export function isEmptyValue(s: PersistedState, page: Page, prop: Property): boolean {
  if (prop.type === 'checkbox' || prop.type === 'button') return false;
  if (prop.type === 'created_time' || prop.type === 'last_edited_time') return false;
  return displayText(s, page, prop).trim() === '';
}

/** Can a row be moved into a group of this property by setting its value? */
export function canSetGroup(prop?: Property): boolean {
  if (!prop) return false;
  return ['select', 'status', 'multi_select', 'person', 'checkbox', 'date', 'text', 'number', 'url', 'email', 'phone'].includes(prop.type);
}

/**
 * Value to store so that a row lands in group `toKey`. `fromKey` is the group the row
 * is moving from (used for multi-valued props where only that one entry is replaced).
 * Returns `undefined` when the property cannot be set this way.
 */
export function groupValue(prop: Property, toKey: string, current: PropValue | undefined, fromKey?: string): PropValue | undefined {
  const none = toKey === '__none';
  switch (prop.type) {
    case 'select': case 'status':
      return none ? null : toKey;
    case 'multi_select': case 'person': {
      let list = Array.isArray(current) ? (current as string[]).slice() : [];
      if (fromKey && fromKey !== '__none') list = list.filter((x) => x !== fromKey);
      if (none) return fromKey ? list : [];
      if (!list.includes(toKey)) list.push(toKey);
      return list;
    }
    case 'checkbox':
      return toKey === 'true';
    case 'date': {
      if (none) return null;
      // key is YYYY-MM: keep day (clamped) and time
      const cur = current as { start?: string; end?: string; time?: boolean } | null | undefined;
      const [y, m] = toKey.split('-').map(Number);
      if (!y || !m) return undefined;
      const old = parseISO(cur?.start ?? null);
      const day = Math.min(old ? old.getDate() : 1, new Date(y, m, 0).getDate());
      const d = new Date(y, m - 1, day);
      let start = toISODate(d);
      if (cur?.start?.includes('T')) start += cur.start.slice(10);
      let end: string | undefined;
      if (cur?.end && old) {
        const oe = parseISO(cur.end);
        if (oe) {
          const ne = new Date(d.getTime() + (oe.getTime() - old.getTime()));
          end = cur.end.includes('T') ? toISODate(ne) + cur.end.slice(10) : toISODate(ne);
        }
      }
      return { ...(cur ?? {}), start, ...(end ? { end } : {}) };
    }
    case 'number': {
      if (none) return null;
      const n = parseFloat(toKey.replace(/[^0-9.\-e]/gi, ''));
      return isNaN(n) ? undefined : n;
    }
    case 'text':
      return none ? null : escapeHtml(toKey);
    case 'url': case 'email': case 'phone':
      return none ? null : toKey;
  }
  return undefined;
}

/** Initial props for a new row created inside group `key`. */
export function groupInitialProps(prop: Property | undefined, key: string | undefined): Record<string, PropValue> {
  if (!prop || !key || key === '__all') return {};
  const v = groupValue(prop, key, undefined);
  if (v === undefined || v === null) return {};
  if (Array.isArray(v) && !v.length) return {};
  if (prop.type === 'title') return {};
  return { [prop.id]: v };
}

/** First text of a page's content, for card previews. */
export function contentPreview(content: Block[], max = 6): { lines: { type: Block['type']; text: string }[]; image?: string } {
  const lines: { type: Block['type']; text: string }[] = [];
  let image: string | undefined;
  const walk = (list: Block[]) => {
    for (const b of list) {
      if (lines.length >= max) return;
      if (b.type === 'image' && b.url && !image) image = b.url;
      const t = b.html ? htmlToText(b.html).trim() : '';
      if (t) lines.push({ type: b.type, text: t });
      if (b.children?.length) walk(b.children);
    }
  };
  walk(content ?? []);
  return { lines, image };
}

function firstImage(content: Block[]): string | undefined {
  for (const b of content ?? []) {
    if (b.type === 'image' && b.url) return b.url;
    if (b.children?.length) { const r = firstImage(b.children); if (r) return r; }
  }
  return undefined;
}

// ---------- Inline title editing ----------

export function InlineTitleInput({ page, onDone, className }: { page: Page; onDone: () => void; className?: string }) {
  const [v, setV] = useState(page.title);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => { ref.current?.focus(); }, []);
  const commit = () => {
    if (done.current) return;
    done.current = true;
    if (v !== page.title) useStore.getState().updatePage(page.id, { title: v });
    onDone();
  };
  return (
    <input
      ref={ref}
      className={cx('card-title-input', className)}
      value={v}
      placeholder="Type a name…"
      onChange={(e) => setV(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); commit(); }
      }}
    />
  );
}

// ---------- Row card (board + gallery) ----------

export interface RowCardProps {
  db: Database;
  view: View;
  page: Page;
  onOpen: (id: string) => void;
  /** 'board' | 'gallery' — only affects default preview and classes. */
  layout?: 'board' | 'gallery';
  editingTitle?: boolean;
  onTitleDone?: () => void;
  className?: string;
  style?: React.CSSProperties;
  divProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function RowCard({ db, view, page, onOpen, layout = 'board', editingTitle, onTitleDone, className, style, divProps }: RowCardProps) {
  const s = useStore.getState();
  const preview = view.cardPreview ?? (layout === 'gallery' ? 'content' : 'none');
  const props = visibleProps(db, view).filter((p) => !isEmptyValue(s, page, p));
  const showTitle = true; // Notion always shows the title on cards

  let previewEl: React.ReactNode = null;
  if (preview === 'cover') {
    const cover = page.cover;
    const img = cover?.kind === 'image' ? cover.value : !cover ? firstImage(page.content) : undefined;
    if (cover?.kind === 'color') {
      previewEl = <div className="card-cover" style={{ background: cover.value }} />;
    } else if (img) {
      previewEl = <div className="card-cover"><img src={img} alt="" style={{ objectPosition: `center ${cover?.pos ?? 50}%` }} draggable={false} /></div>;
    } else if (layout === 'gallery') {
      previewEl = <div className="card-cover card-cover-empty" />;
    }
  } else if (preview === 'content') {
    const { lines, image } = contentPreview(page.content);
    if (lines.length || image || layout === 'gallery') {
      previewEl = (
        <div className="card-content-preview">
          {image && !lines.length ? <img src={image} alt="" draggable={false} /> : lines.map((l, i) => (
            <div key={i} className={cx('ccp-line', /^h\d|toggle_h/.test(l.type) && 'ccp-heading', l.type === 'bullet' && 'ccp-bullet')}>{l.text}</div>
          ))}
        </div>
      );
    }
  }

  return (
    <div
      {...divProps}
      className={cx('row-card', `row-card-${layout}`, className)}
      style={style}
      data-id={page.id}
      onClick={(e) => { divProps?.onClick?.(e); if (!e.defaultPrevented && !editingTitle) onOpen(page.id); }}
    >
      {previewEl}
      <div className="row-card-body">
        {showTitle && (
          <div className="row-card-title">
            {page.icon && <span className="row-card-icon"><PageIcon page={page} size={16} /></span>}
            {editingTitle
              ? <InlineTitleInput page={page} onDone={() => onTitleDone?.()} />
              : <span className={cx('row-card-title-text', !page.title && 'faint')}>{page.title || 'Untitled'}</span>}
          </div>
        )}
        {props.map((p) => (
          <div key={p.id} className={cx('row-card-prop', `prop-type-${p.type}`)} title={p.name}>
            <PropValueView page={page} prop={p} wrap={view.wrap} compact />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Date property picker (calendar / timeline empty state) ----------

export function DatePropPicker({ db, view, readOnly, updateView, label, field = 'dateProp' }: {
  db: Database; view: View; readOnly: boolean; updateView: (fn: (v: View) => void) => void; label: string; field?: 'dateProp' | 'endProp';
}) {
  const dateProps = db.properties.filter((p) => p.type === 'date' || p.type === 'created_time' || p.type === 'last_edited_time');
  return (
    <div className="view-empty">
      <div className="view-empty-title">{label}</div>
      {readOnly ? (
        <div className="faint">Ask someone with edit access to choose a date property for this view.</div>
      ) : (
        <div className="row" style={{ justifyContent: 'center' }}>
          <select className="input" style={{ width: 220 }} value={view[field] ?? ''} onChange={(e) => updateView((v) => { v[field] = e.target.value || undefined; })}>
            <option value="">Select a date property…</option>
            {dateProps.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {!dateProps.some((p) => p.type === 'date') && (
            <button className="btn btn-outline" onClick={() => {
              const id = useStore.getState().addProperty(db.id, 'date', 'Date');
              updateView((v) => { v[field] = id; });
            }}>Create “Date” property</button>
          )}
        </div>
      )}
    </div>
  );
}
