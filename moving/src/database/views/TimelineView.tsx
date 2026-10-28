import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Table2 } from 'lucide-react';
import type { DateValue, Page, View } from '../../store/types';
import { useStore } from '../../store/store';
import type { ViewProps } from '../viewTypes';
import { PageIcon } from '../../components/ui';
import { PropValueView } from '../PropValue';
import { addDays, cx, monthName, startOfDay, toISODate } from '../../lib/util';
import { DatePropPicker, isEmptyValue, visibleProps } from './RowCard';
import { dayDiff, rowRange, shiftISO } from './CalendarView';

type Zoom = NonNullable<View['timelineZoom']>;
const PPD: Record<Zoom, number> = { day: 60, week: 24, month: 8, quarter: 3, year: 1.2 };
const ZOOMS: { id: Zoom; label: string }[] = [
  { id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' },
  { id: 'quarter', label: 'Quarter' }, { id: 'year', label: 'Year' },
];
const TABLE_W = 280;
const ROW_H = 36;

interface Seg { key: string; label: string; left: number; width: number; weekend?: boolean }

function segments(start: Date, days: number, ppd: number, keyFn: (d: Date) => string, labelFn: (d: Date) => string, weekendFn?: (d: Date) => boolean): Seg[] {
  const out: Seg[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const k = keyFn(d);
    const last = out[out.length - 1];
    if (last && last.key === k) last.width += ppd;
    else out.push({ key: k, label: labelFn(d), left: i * ppd, width: ppd, weekend: weekendFn?.(d) });
  }
  return out;
}

export default function TimelineView({ db, view, rows, readOnly, openRow, addRow, updateView }: ViewProps) {
  useStore((s) => s.pages);
  const mondayFirst = useStore((s) => s.settings.startWeekMonday);
  const [showTable, setShowTable] = useState(true);
  const [preview, setPreview] = useState<{ id: string; start: Date; end: Date } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const zoom: Zoom = view.timelineZoom ?? 'week';
  const ppd = PPD[zoom];
  const prop = db.properties.find((p) => p.id === view.dateProp && (p.type === 'date' || p.type === 'created_time' || p.type === 'last_edited_time'));
  const endProp = db.properties.find((p) => p.id === view.endProp && p.type === 'date' && p.id !== prop?.id);
  const editable = !readOnly && prop?.type === 'date';
  const today = startOfDay(new Date());
  const tableW = showTable ? TABLE_W : 0;

  const rangeOf = (r: Page): { start: Date; end: Date } | null => {
    if (!prop) return null;
    const base = rowRange(r, prop);
    if (!base) return null;
    if (endProp) {
      const ev = r.props[endProp.id] as DateValue | null | undefined;
      const e = ev?.start ? rowRange(r, endProp) : null;
      return { start: base.start, end: e && e.start >= base.start ? e.start : base.start };
    }
    return base;
  };

  // Visible time range
  const { rangeStart, totalDays } = useMemo(() => {
    let min = today, max = today;
    for (const r of rows) {
      const rg = rangeOf(r);
      if (!rg) continue;
      if (rg.start < min) min = rg.start;
      if (rg.end > max) max = rg.end;
    }
    const pad = Math.max(14, Math.ceil(1400 / ppd));
    const s0 = addDays(min, -pad);
    const rs = new Date(s0.getFullYear(), s0.getMonth(), 1);
    const re = addDays(max, pad);
    return { rangeStart: rs, totalDays: dayDiff(re, rs) + 1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, ppd, prop?.id, endProp?.id]);

  const W = totalDays * ppd;
  const xOf = (d: Date) => dayDiff(d, rangeStart) * ppd;
  const todayX = xOf(today);

  const scrollToToday = (smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: Math.max(0, todayX - (el.clientWidth - tableW) / 3), behavior: smooth ? 'smooth' : 'auto' });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { scrollToToday(); }, [zoom, !!prop]);

  const header = useMemo(() => {
    const ym = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
    const weekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
    let top: Seg[];
    let bottom: Seg[];
    if (zoom === 'day' || zoom === 'week' || zoom === 'month') {
      top = segments(rangeStart, totalDays, ppd, ym, (d) => `${monthName(d.getMonth())} ${d.getFullYear()}`);
      if (zoom === 'month') {
        const ws = mondayFirst ? 1 : 0;
        bottom = segments(rangeStart, totalDays, ppd, (d) => toISODate(addDays(d, -((d.getDay() - ws + 7) % 7))), (d) => String(d.getDate()));
      } else {
        bottom = segments(rangeStart, totalDays, ppd, toISODate, (d) => String(d.getDate()), weekend);
      }
    } else {
      top = segments(rangeStart, totalDays, ppd, (d) => String(d.getFullYear()), (d) => String(d.getFullYear()));
      bottom = zoom === 'quarter'
        ? segments(rangeStart, totalDays, ppd, ym, (d) => monthName(d.getMonth()).slice(0, 3))
        : segments(rangeStart, totalDays, ppd, (d) => `${d.getFullYear()}-${Math.floor(d.getMonth() / 3)}`, (d) => `Q${Math.floor(d.getMonth() / 3) + 1}`);
    }
    return { top, bottom };
  }, [rangeStart, totalDays, ppd, zoom, mondayFirst]);

  if (!prop) {
    return <div className="tl-view"><DatePropPicker db={db} view={view} readOnly={readOnly} updateView={updateView} label="Choose a date property to show pages on the timeline" /></div>;
  }

  const props = visibleProps(db, view).filter((p) => p.id !== prop.id && p.id !== endProp?.id);

  const commit = (r: Page, ds: number, de: number) => {
    const st = useStore.getState();
    const page = st.pages[r.id];
    const v = page?.props[prop.id] as DateValue | null | undefined;
    if (!page || !v?.start) return;
    if (endProp) {
      const ev = page.props[endProp.id] as DateValue | null | undefined;
      if (ds) st.setProp(r.id, prop.id, { ...v, start: shiftISO(v.start, ds) });
      if (de || !ev?.start) {
        const endIso = ev?.start ?? v.end ?? v.start;
        st.setProp(r.id, endProp.id, { ...(ev ?? {}), start: shiftISO(endIso, de) });
      }
      return;
    }
    const start = shiftISO(v.start, ds);
    const end = shiftISO(v.end ?? v.start, de);
    const nv: DateValue = { ...v, start };
    if (end.slice(0, 10) !== start.slice(0, 10)) nv.end = end; else delete nv.end;
    st.setProp(r.id, prop.id, nv);
  };

  const startDrag = (e: React.MouseEvent, r: Page, kind: 'move' | 'l' | 'r', range: { start: Date; end: Date }) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX;
    let moved = false;
    let last = { ds: 0, de: 0 };
    const span = dayDiff(range.end, range.start);
    const mm = (ev: MouseEvent) => {
      if (!editable) return;
      if (Math.abs(ev.clientX - x0) > 3) moved = true;
      const dd = Math.round((ev.clientX - x0) / ppd);
      let ds = 0, de = 0;
      if (kind === 'move') { ds = dd; de = dd; }
      else if (kind === 'l') ds = Math.min(dd, span);
      else de = Math.max(dd, -span);
      last = { ds, de };
      setPreview({ id: r.id, start: addDays(range.start, ds), end: addDays(range.end, de) });
    };
    const mu = () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
      document.body.style.cursor = '';
      setPreview(null);
      if (!moved) { if (kind === 'move') openRow(r.id); return; }
      if (last.ds || last.de) commit(r, last.ds, last.de);
    };
    if (editable) document.body.style.cursor = kind === 'move' ? 'grabbing' : 'ew-resize';
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
  };

  const addDates = (r: Page) => {
    const st = useStore.getState();
    const s = toISODate(today), e = toISODate(addDays(today, 2));
    if (endProp) { st.setProp(r.id, prop.id, { start: s }); st.setProp(r.id, endProp.id, { start: e }); }
    else st.setProp(r.id, prop.id, { start: s, end: e });
  };

  const scrollBy = (dir: number) => scrollRef.current?.scrollBy({ left: dir * (scrollRef.current.clientWidth - tableW) / 2, behavior: 'smooth' });
  const dateProps = db.properties.filter((p) => p.type === 'date' && p.id !== prop.id);

  return (
    <div className="tl-view">
      <div className="tl-toolbar">
        <button className={cx('btn btn-sm', showTable && 'tl-active')} onClick={() => setShowTable((x) => !x)}><Table2 size={14} /> Table</button>
        <div className="grow" />
        {!readOnly && prop.type === 'date' && dateProps.length > 0 && (
          <select className="tl-select" value={view.endProp ?? ''} title="End date property" onChange={(e) => updateView((v) => { v.endProp = e.target.value || undefined; })}>
            <option value="">End: same property</option>
            {dateProps.map((p) => <option key={p.id} value={p.id}>End: {p.name}</option>)}
          </select>
        )}
        <select className="tl-select" value={zoom} disabled={readOnly} onChange={(e) => updateView((v) => { v.timelineZoom = e.target.value as Zoom; })}>
          {ZOOMS.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
        </select>
        <button className="icon-btn sm" onClick={() => scrollBy(-1)} aria-label="Earlier"><ChevronLeft size={16} /></button>
        <button className="btn btn-sm" onClick={() => scrollToToday(true)}>Today</button>
        <button className="icon-btn sm" onClick={() => scrollBy(1)} aria-label="Later"><ChevronRight size={16} /></button>
      </div>

      <div className="tl-scroll" ref={scrollRef}>
        <div className="tl-inner" style={{ width: tableW + W }}>
          <div className="tl-head">
            {showTable && (
              <div className="tl-head-left" style={{ width: TABLE_W }}>
                <div className="tl-cell-title">Name</div>
                {props.map((p) => <div key={p.id} className="tl-cell-prop ellipsis">{p.name}</div>)}
              </div>
            )}
            <div className="tl-head-grid" style={{ width: W }}>
              <div className="tl-head-top">
                {header.top.map((s) => <div key={s.key} className="tl-seg" style={{ left: s.left, width: s.width }}><span className="tl-seg-label">{s.label}</span></div>)}
              </div>
              <div className="tl-head-bottom">
                {header.bottom.map((s) => {
                  const isToday = zoom === 'day' || zoom === 'week' ? s.key === toISODate(today) : false;
                  return <div key={s.key} className={cx('tl-seg', isToday && 'tl-seg-today')} style={{ left: s.left, width: s.width }}><span className="tl-seg-label">{s.width >= 14 ? s.label : ''}</span></div>;
                })}
              </div>
            </div>
          </div>

          <div className="tl-body">
            <div className="tl-bg" style={{ left: tableW, width: W }}>
              {header.bottom.map((s) => <div key={s.key} className={cx('tl-bg-col', s.weekend && 'tl-bg-weekend')} style={{ left: s.left, width: s.width }} />)}
              <div className="tl-today-line" style={{ left: todayX + (zoom === 'day' || zoom === 'week' ? ppd / 2 : 0) }} />
            </div>

            {rows.map((r) => {
              const base = rangeOf(r);
              const range = preview?.id === r.id ? preview : base;
              return (
                <div key={r.id} className="tl-row" style={{ height: ROW_H }}>
                  {showTable && (
                    <div className="tl-left" style={{ width: TABLE_W }} onClick={() => openRow(r.id)}>
                      <div className="tl-cell-title">
                        <PageIcon page={r} size={16} />
                        <span className={cx('ellipsis', !r.title && 'faint')}>{r.title || 'Untitled'}</span>
                      </div>
                      {props.map((p) => (
                        <div key={p.id} className="tl-cell-prop">
                          {!isEmptyValue(useStore.getState(), r, p) && <PropValueView page={r} prop={p} compact />}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="tl-lane" style={{ width: W }}>
                    {range ? (
                      <div
                        className={cx('tl-bar', editable && 'tl-bar-editable', preview?.id === r.id && 'tl-bar-dragging')}
                        style={{ left: xOf(range.start), width: Math.max(6, (dayDiff(range.end, range.start) + 1) * ppd) }}
                        onMouseDown={(e) => startDrag(e, r, 'move', base ?? range)}
                      >
                        {editable && <span className="tl-handle tl-handle-l" onMouseDown={(e) => startDrag(e, r, 'l', base ?? range)} />}
                        <span className="tl-bar-label">
                          {r.icon && <PageIcon page={r} size={14} />}
                          <span>{r.title || 'Untitled'}</span>
                        </span>
                        {editable && <span className="tl-handle tl-handle-r" onMouseDown={(e) => startDrag(e, r, 'r', base ?? range)} />}
                      </div>
                    ) : editable ? (
                      <button className="tl-ghost" style={{ left: todayX, width: Math.max(90, 3 * ppd) }} onClick={() => addDates(r)}>
                        <Plus size={12} /> Add dates
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {!readOnly && (
              <div className="tl-row tl-new-row" style={{ height: ROW_H }}>
                <button className="tl-new" style={{ width: Math.max(tableW, 200) }} onClick={() => addRow({}, { open: true })}>
                  <Plus size={16} /> New page
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

