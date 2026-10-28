import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DateValue } from '../store/types';
import { Toggle } from './ui';
import { addDays, cx, monthName, parseISO, parseNaturalDate, sameDay, startOfDay, toISODate, toISODateTime, fmtDateStyle } from '../lib/util';
import { useStore } from '../store/store';

export default function DatePicker({
  value, onChange, allowRange = true, remind, onRemind, format, onFormat, timeFormat, onTimeFormat,
}: {
  value: DateValue | null; onChange: (v: DateValue | null) => void; allowRange?: boolean;
  remind?: boolean; onRemind?: (v: boolean) => void;
  format?: string; onFormat?: (f: any) => void; timeFormat?: '12' | '24'; onTimeFormat?: (f: '12' | '24') => void;
}) {
  const mondayFirst = useStore((s) => s.settings.startWeekMonday);
  const start = parseISO(value?.start) ?? null;
  const end = parseISO(value?.end) ?? null;
  const [month, setMonth] = useState(() => { const d = start ?? new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [editingEnd, setEditingEnd] = useState(false);
  const [text, setText] = useState(value?.start ? fmtDateStyle(value.start, 'full', !!value.time) : '');
  const hasTime = !!value?.time;
  const isRange = value?.end !== undefined;

  const firstDow = mondayFirst ? 1 : 0;
  const gridStart = addDays(month, -((month.getDay() - firstDow + 7) % 7));
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const wk = mondayFirst ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const iso = (d: Date, keepTimeOf?: Date | null) => {
    if (!hasTime) return toISODate(d);
    const t = new Date(d);
    t.setHours(keepTimeOf?.getHours() ?? 9, keepTimeOf?.getMinutes() ?? 0);
    return toISODateTime(t);
  };

  const pickDay = (d: Date) => {
    if (isRange && editingEnd) {
      let s = start ?? d;
      let e = d;
      if (e < startOfDay(s)) [s, e] = [e, s];
      onChange({ ...value!, start: iso(s, start), end: iso(e, end) });
      setEditingEnd(false);
    } else if (isRange) {
      onChange({ ...value!, start: iso(d, start), end: value!.end && parseISO(value!.end)! >= d ? value!.end : iso(d, end) });
      setEditingEnd(true);
    } else {
      onChange({ ...(value ?? {}), start: iso(d, start) } as DateValue);
    }
    setText(fmtDateStyle(iso(d, start), 'full', hasTime));
  };

  const setTime = (which: 'start' | 'end', hhmm: string) => {
    const base = which === 'start' ? start : end;
    if (!base) return;
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(base); d.setHours(h || 0, m || 0);
    onChange({ ...value!, [which]: toISODateTime(d) });
  };

  const timeStr = (d: Date | null) => (d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '');

  return (
    <div className="date-picker menu">
      <div className="dp-inputs">
        <input className={cx('input', !editingEnd && 'focus-ring')} value={text} placeholder="Type a date, like “next friday”"
          onFocus={() => setEditingEnd(false)}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const p = parseNaturalDate(text);
              if (p) { onChange({ ...(value ?? {}), start: p.time ? toISODateTime(p.date) : toISODate(p.date), time: p.time || hasTime } as DateValue); setMonth(new Date(p.date.getFullYear(), p.date.getMonth(), 1)); }
            }
          }} />
        {hasTime && start && <input type="time" className="input dp-time" value={timeStr(start)} onChange={(e) => setTime('start', e.target.value)} />}
        {isRange && (
          <>
            <input className={cx('input', editingEnd && 'focus-ring')} readOnly value={value?.end ? fmtDateStyle(value.end, 'full', false) : ''} placeholder="End date" onFocus={() => setEditingEnd(true)} />
            {hasTime && end && <input type="time" className="input dp-time" value={timeStr(end)} onChange={(e) => setTime('end', e.target.value)} />}
          </>
        )}
      </div>
      <div className="dp-head">
        <b>{monthName(month.getMonth())} {month.getFullYear()}</b>
        <div className="grow" />
        <button className="btn btn-sm" onClick={() => { const t = new Date(); setMonth(new Date(t.getFullYear(), t.getMonth(), 1)); pickDay(startOfDay(t)); }}>Today</button>
        <button className="icon-btn sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
        <button className="icon-btn sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
      </div>
      <div className="dp-grid">
        {wk.map((w) => <div key={w} className="dp-wk">{w}</div>)}
        {days.map((d) => {
          const inRange = start && end && d >= startOfDay(start) && d <= startOfDay(end);
          return (
            <button key={d.toISOString()} onClick={() => pickDay(d)}
              className={cx('dp-day', d.getMonth() !== month.getMonth() && 'out', sameDay(d, new Date()) && 'today', ((start && sameDay(d, start)) || (end && sameDay(d, end))) && 'sel', inRange && 'range')}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <div className="sep" />
      {allowRange && (
        <div className="menu-item" onClick={() => onChange(isRange ? { ...value!, end: undefined } : { ...(value ?? { start: toISODate(new Date()) }), end: value?.start ?? toISODate(new Date()) })}>
          <span className="menu-label">End date</span><Toggle on={isRange} onChange={() => onChange(isRange ? { ...value!, end: undefined } : { ...(value ?? { start: toISODate(new Date()) }), end: value?.start ?? toISODate(new Date()) })} />
        </div>
      )}
      <div className="menu-item" onClick={() => toggleTime()}>
        <span className="menu-label">Include time</span><Toggle on={hasTime} onChange={() => toggleTime()} />
      </div>
      {onRemind && (
        <div className="menu-item" onClick={() => onRemind(!remind)}>
          <span className="menu-label">Remind</span><Toggle on={!!remind} onChange={(v) => onRemind(v)} />
        </div>
      )}
      {onFormat && (
        <div className="menu-item">
          <span className="menu-label">Date format</span>
          <select className="input" style={{ width: 130, height: 26 }} value={format ?? 'full'} onChange={(e) => onFormat(e.target.value)}>
            <option value="full">Full date</option><option value="relative">Relative</option><option value="mdy">Month/Day/Year</option><option value="dmy">Day/Month/Year</option><option value="ymd">Year/Month/Day</option>
          </select>
        </div>
      )}
      {onTimeFormat && hasTime && (
        <div className="menu-item">
          <span className="menu-label">Time format</span>
          <select className="input" style={{ width: 130, height: 26 }} value={timeFormat ?? '12'} onChange={(e) => onTimeFormat(e.target.value as '12' | '24')}>
            <option value="12">12 hour</option><option value="24">24 hour</option>
          </select>
        </div>
      )}
      <div className="sep" />
      <div className="menu-item" onClick={() => { onChange(null); setText(''); }}><span className="menu-label">Clear</span></div>
    </div>
  );

  function toggleTime() {
    if (!value?.start) { onChange({ start: toISODateTime(new Date()), time: true }); return; }
    if (hasTime) onChange({ ...value, time: false, start: value.start.slice(0, 10), end: value.end?.slice(0, 10) });
    else {
      const s = parseISO(value.start)!; s.setHours(9, 0);
      const e = value.end ? parseISO(value.end)! : null; e?.setHours(10, 0);
      onChange({ ...value, time: true, start: toISODateTime(s), end: e ? toISODateTime(e) : undefined });
    }
  }
}
