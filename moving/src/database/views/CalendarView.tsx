import { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { DateValue, Page, Property } from '../../store/types';
import { useStore } from '../../store/store';
import type { ViewProps } from '../viewTypes';
import { PageIcon, Popover, type Anchor } from '../../components/ui';
import { PropValueView } from '../PropValue';
import { addDays, cx, monthName, parseISO, sameDay, startOfDay, toISODate, toISODateTime } from '../../lib/util';
import { DatePropPicker, isEmptyValue, visibleProps } from './RowCard';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_MS = 86400000;

/** Start/end (local, start of day) of a row for a date-ish property. */
export function rowRange(page: Page, prop: Property): { start: Date; end: Date } | null {
  if (prop.type === 'created_time') { const d = startOfDay(new Date(page.createdAt)); return { start: d, end: d }; }
  if (prop.type === 'last_edited_time') { const d = startOfDay(new Date(page.updatedAt)); return { start: d, end: d }; }
  const v = page.props[prop.id] as DateValue | null | undefined;
  const s = parseISO(v?.start ?? null);
  if (!s) return null;
  const e = parseISO(v?.end ?? null);
  const start = startOfDay(s);
  const end = e ? startOfDay(e) : start;
  return { start, end: end < start ? start : end };
}

export function dayDiff(a: Date, b: Date) {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY_MS);
}

/** Shift an ISO date or date-time string by n days, preserving its format. */
export function shiftISO(iso: string, n: number): string {
  const d = parseISO(iso);
  if (!d) return iso;
  const r = addDays(d, n);
  return iso.includes('T') ? toISODateTime(r) : toISODate(r);
}

export default function CalendarView({ db, view, rows, readOnly, openRow, addRow, updateView }: ViewProps) {
  useStore((s) => s.pages);
  const mondayFirst = useStore((s) => s.settings.startWeekMonday);
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [noDate, setNoDate] = useState<Anchor>(null);
  const [more, setMore] = useState<{ anchor: Anchor; day: Date } | null>(null);
  const drag = useRef<{ id: string; from: Date | null } | null>(null);

  const prop = db.properties.find((p) => p.id === view.dateProp && (p.type === 'date' || p.type === 'created_time' || p.type === 'last_edited_time'));
  const mode = view.calendarMode ?? 'month';
  const editable = !readOnly && prop?.type === 'date';
  const props = visibleProps(db, view).filter((p) => p.id !== prop?.id);
  const today = startOfDay(new Date());
  const weekStart = mondayFirst ? 1 : 0;

  const days = useMemo(() => {
    let first: Date;
    let count: number;
    if (mode === 'week') {
      first = addDays(cursor, -((cursor.getDay() - weekStart + 7) % 7));
      count = 7;
    } else {
      const m1 = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      first = addDays(m1, -((m1.getDay() - weekStart + 7) % 7));
      count = 42;
    }
    return Array.from({ length: count }, (_, i) => addDays(first, i));
  }, [cursor, mode, weekStart]);

  if (!prop) {
    return <div className="cal-view"><DatePropPicker db={db} view={view} readOnly={readOnly} updateView={updateView} label="Choose a date property to show pages on the calendar" /></div>;
  }

  // Bucket rows per day
  const byDay = new Map<string, Page[]>();
  const undated: Page[] = [];
  const gridStart = days[0], gridEnd = days[days.length - 1];
  for (const r of rows) {
    const range = rowRange(r, prop);
    if (!range) { undated.push(r); continue; }
    let d = range.start < gridStart ? gridStart : range.start;
    const last = range.end > gridEnd ? gridEnd : range.end;
    let guard = 0;
    while (d <= last && guard++ < 60) {
      const k = toISODate(d);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push(r);
      d = addDays(d, 1);
    }
  }

  const step = (dir: number) => setCursor((c) => mode === 'week' ? addDays(c, 7 * dir) : new Date(c.getFullYear(), c.getMonth() + dir, 1));

  const moveTo = (id: string, from: Date | null, to: Date) => {
    const st = useStore.getState();
    const page = st.pages[id];
    if (!page || !prop) return;
    const v = page.props[prop.id] as DateValue | null | undefined;
    if (!v?.start || !from) {
      st.setProp(id, prop.id, { start: toISODate(to) });
      return;
    }
    const n = dayDiff(to, from);
    if (!n) return;
    const next: DateValue = { ...v, start: shiftISO(v.start, n) };
    if (v.end) next.end = shiftISO(v.end, n);
    st.setProp(id, prop.id, next);
  };

  const chip = (r: Page, day: Date | null) => {
    const range = rowRange(r, prop);
    const isStart = !range || !day || sameDay(range.start, day);
    const isEnd = !range || !day || sameDay(range.end, day);
    const extra = props.find((p) => !isEmptyValue(useStore.getState(), r, p));
    return (
      <div
        key={r.id}
        className={cx('cal-chip', !isStart && 'cal-chip-cont', !isEnd && 'cal-chip-more')}
        draggable={editable}
        onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', r.id); drag.current = { id: r.id, from: day }; }}
        onDragEnd={() => { drag.current = null; setDragOver(null); }}
        onClick={(e) => { e.stopPropagation(); setMore(null); openRow(r.id); }}
      >
        <div className="cal-chip-title">
          {r.icon && <PageIcon page={r} size={14} />}
          <span className={cx('ellipsis', !r.title && 'faint')}>{r.title || 'Untitled'}</span>
        </div>
        {extra && <div className="cal-chip-prop"><PropValueView page={r} prop={extra} compact /></div>}
      </div>
    );
  };

  const MAX = mode === 'week' ? Infinity : 3;
  const dowLabels = Array.from({ length: 7 }, (_, i) => DOW[(i + weekStart) % 7]);
  const headerDate = mode === 'week' ? days[3] : cursor;

  return (
    <div className="cal-view">
      <div className="cal-header">
        <div className="cal-title">{monthName(headerDate.getMonth())} {headerDate.getFullYear()}</div>
        <div className="grow" />
        {undated.length > 0 && prop.type === 'date' && (
          <button className="btn btn-sm cal-nodate" onClick={(e) => setNoDate(e.currentTarget)}>No date ({undated.length})</button>
        )}
        <div className="cal-mode">
          <button className={cx('cal-mode-btn', mode === 'month' && 'active')} disabled={readOnly} onClick={() => updateView((v) => { v.calendarMode = 'month'; })}>Month</button>
          <button className={cx('cal-mode-btn', mode === 'week' && 'active')} disabled={readOnly} onClick={() => updateView((v) => { v.calendarMode = 'week'; })}>Week</button>
        </div>
        <button className="icon-btn sm" onClick={() => step(-1)} aria-label="Previous"><ChevronLeft size={16} /></button>
        <button className="btn btn-sm" onClick={() => setCursor(startOfDay(new Date()))}>Today</button>
        <button className="icon-btn sm" onClick={() => step(1)} aria-label="Next"><ChevronRight size={16} /></button>
      </div>

      <div className="cal-dow">
        {dowLabels.map((d, i) => <div key={i} className="cal-dow-cell">{d}</div>)}
      </div>

      <div className={cx('cal-grid', mode === 'week' ? 'cal-grid-week' : 'cal-grid-month')}>
        {days.map((d) => {
          const k = toISODate(d);
          const list = byDay.get(k) ?? [];
          const outside = mode === 'month' && d.getMonth() !== cursor.getMonth();
          const isToday = sameDay(d, today);
          const weekend = d.getDay() === 0 || d.getDay() === 6;
          const showDay = d.getDate() === 1 ? `${monthName(d.getMonth()).slice(0, 3)} 1` : String(d.getDate());
          return (
            <div
              key={k}
              className={cx('cal-day', outside && 'cal-day-outside', weekend && 'cal-day-weekend', dragOver === k && 'cal-day-drop')}
              onDragOver={(e) => { if (!drag.current || !editable) return; e.preventDefault(); if (dragOver !== k) setDragOver(k); }}
              onDragLeave={(e) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDragOver((x) => (x === k ? null : x)); }}
              onDrop={(e) => {
                e.preventDefault();
                const dr = drag.current;
                drag.current = null; setDragOver(null);
                if (dr) { moveTo(dr.id, dr.from, d); if (!dr.from) setNoDate(null); }
              }}
            >
              <div className="cal-day-head">
                {editable && (
                  <button className="cal-day-add icon-btn sm" onClick={() => addRow({ [prop.id]: { start: k } }, { open: true })} aria-label="New page"><Plus size={14} /></button>
                )}
                <span className={cx('cal-day-num', isToday && 'cal-today')}>{showDay}</span>
              </div>
              <div className="cal-day-events">
                {list.slice(0, MAX).map((r) => chip(r, d))}
                {list.length > MAX && (
                  <button className="cal-more" onClick={(e) => setMore({ anchor: e.currentTarget, day: d })}>{list.length - MAX} more</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {noDate && (
        <Popover anchor={noDate} onClose={() => setNoDate(null)} placement="bottom-end" width={280}>
          <div className="cal-pop">
            <div className="cal-pop-head">No date</div>
            {editable && <div className="cal-pop-hint faint">Drag pages onto the calendar to set a date</div>}
            <div className="cal-pop-list">
              {undated.map((r) => chip(r, null))}
            </div>
          </div>
        </Popover>
      )}
      {more && (
        <Popover anchor={more.anchor} onClose={() => setMore(null)} width={260}>
          <div className="cal-pop">
            <div className="cal-pop-head">{monthName(more.day.getMonth())} {more.day.getDate()}</div>
            <div className="cal-pop-list">{(byDay.get(toISODate(more.day)) ?? []).map((r) => chip(r, more.day))}</div>
          </div>
        </Popover>
      )}
    </div>
  );
}

