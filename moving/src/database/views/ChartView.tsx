import React, { useLayoutEffect, useRef, useState } from 'react';
import { BarChart3, BarChartHorizontal, LineChart, PieChart, Hash } from 'lucide-react';
import type { Page, Property, View } from '../../store/types';
import { useStore } from '../../store/store';
import type { ViewProps } from '../viewTypes';
import { getValue, groupRows, formatNumber } from '../logic';
import { cx } from '../../lib/util';

type Chart = NonNullable<View['chart']>;
type Kind = Chart['kind'];
type Agg = Chart['agg'];

const PALETTE = ['blue', 'green', 'orange', 'purple', 'pink', 'red', 'yellow', 'brown', 'gray'];
const KINDS: { id: Kind; label: string; icon: React.ReactNode }[] = [
  { id: 'bar', label: 'Vertical bar', icon: <BarChart3 size={15} /> },
  { id: 'hbar', label: 'Horizontal bar', icon: <BarChartHorizontal size={15} /> },
  { id: 'line', label: 'Line', icon: <LineChart size={15} /> },
  { id: 'donut', label: 'Donut', icon: <PieChart size={15} /> },
  { id: 'number', label: 'Number', icon: <Hash size={15} /> },
];
const AGGS: { id: Agg; label: string }[] = [
  { id: 'sum', label: 'Sum' }, { id: 'avg', label: 'Average' }, { id: 'min', label: 'Min' }, { id: 'max', label: 'Max' },
];
const GROUPABLE: Property['type'][] = ['select', 'multi_select', 'status', 'person', 'checkbox', 'date', 'created_time', 'last_edited_time', 'text', 'number', 'url', 'email', 'phone', 'created_by', 'last_edited_by', 'formula'];
const NUMERIC: Property['type'][] = ['number', 'formula', 'rollup', 'unique_id'];

interface Datum { key: string; label: string; value: number; color: string; count: number }

function numericValue(page: Page, prop: Property): number | null {
  const v = getValue(useStore.getState(), page, prop) as unknown;
  if (typeof v === 'number' && !isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  return null;
}

function aggregate(rows: Page[], agg: Agg, y?: Property): number {
  if (agg === 'count' || !y) return rows.length;
  const nums = rows.map((r) => numericValue(r, y)).filter((n): n is number => n != null);
  if (!nums.length) return 0;
  switch (agg) {
    case 'sum': return nums.reduce((a, b) => a + b, 0);
    case 'avg': return nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'min': return Math.min(...nums);
    case 'max': return Math.max(...nums);
  }
  return 0;
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return n * exp;
}

function niceMin(v: number): number {
  return v >= 0 ? 0 : -niceMax(-v);
}

export default function ChartView({ db, view, rows, readOnly, updateView }: ViewProps) {
  useStore((s) => s.pages);
  const chart: Chart = view.chart ?? { kind: 'bar', agg: 'count' };
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [tip, setTip] = useState<{ x: number; y: number; title: string; text: string } | null>(null);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(240, el.clientWidth)));
    ro.observe(el);
    setWidth(Math.max(240, el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const setChart = (patch: Partial<Chart>) => updateView((v) => { v.chart = { ...(v.chart ?? { kind: 'bar', agg: 'count' }), ...patch }; });

  const groupable = db.properties.filter((p) => GROUPABLE.includes(p.type));
  const numeric = db.properties.filter((p) => NUMERIC.includes(p.type));
  const xProp = db.properties.find((p) => p.id === chart.x);
  const yProp = chart.agg !== 'count' ? db.properties.find((p) => p.id === chart.y) : undefined;
  const fmt = (n: number) => {
    if (yProp?.type === 'number') return formatNumber(+n.toFixed(2), yProp.numberFormat);
    return String(+n.toFixed(2));
  };

  // ---- data ----
  const groups = xProp ? groupRows(useStore.getState(), db, { ...view, hideEmptyGroups: true }, rows, xProp.id) : null;
  const hidden = new Set(view.hiddenGroups ?? []);
  let data: Datum[] = (groups ?? [{ key: '__all', label: 'All', rows }])
    .filter((g) => g.rows.length > 0 && !hidden.has(g.key))
    .map((g, i) => ({
      key: g.key,
      label: g.label,
      count: g.rows.length,
      value: aggregate(g.rows, chart.agg, yProp),
      color: g.option && g.option.color !== 'default' ? `var(--c-${g.option.color})` : `var(--c-${PALETTE[i % PALETTE.length]})`,
    }));
  if (chart.kind === 'line' && chart.cumulative) {
    let acc = 0;
    data = data.map((d) => ({ ...d, value: (acc += d.value) }));
  }
  const total = chart.kind === 'line' && chart.cumulative ? (data[data.length - 1]?.value ?? 0) : data.reduce((a, d) => a + d.value, 0);
  const yLabel = chart.agg === 'count' || !yProp ? 'Count' : `${AGGS.find((a) => a.id === chart.agg)?.label} of ${yProp.name}`;

  const showTip = (e: React.MouseEvent, d: Datum) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    setTip({ x: e.clientX - box.left + 12, y: e.clientY - box.top + 12, title: d.label, text: `${yLabel}: ${fmt(d.value)}` });
  };
  const hideTip = () => setTip(null);

  // ---- settings bar ----
  const settings = !readOnly && (
    <div className="chart-settings">
      <div className="chart-seg">
        {KINDS.map((k) => (
          <button key={k.id} className={cx('chart-seg-btn', chart.kind === k.id && 'active')} title={k.label} onClick={() => setChart({ kind: k.id })}>{k.icon}</button>
        ))}
      </div>
      {chart.kind !== 'number' && (
        <label className="chart-field">
          <span className="faint">{chart.kind === 'donut' ? 'Slices' : 'X axis'}</span>
          <select className="chart-select" value={chart.x ?? ''} onChange={(e) => setChart({ x: e.target.value || undefined })}>
            <option value="">None</option>
            {groupable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      )}
      <label className="chart-field">
        <span className="faint">{chart.kind === 'number' ? 'Value' : 'Y axis'}</span>
        <select className="chart-select" value={chart.agg} onChange={(e) => {
          const agg = e.target.value as Agg;
          setChart({ agg, y: agg === 'count' ? chart.y : chart.y ?? numeric[0]?.id });
        }}>
          <option value="count">Count</option>
          {numeric.length > 0 && AGGS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        {chart.agg !== 'count' && (
          <select className="chart-select" value={chart.y ?? ''} onChange={(e) => setChart({ y: e.target.value || undefined })}>
            <option value="">Select property</option>
            {numeric.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </label>
      {chart.kind !== 'number' && (
        <label className="chart-toggle">
          <input type="checkbox" checked={!!chart.showLabels} onChange={(e) => setChart({ showLabels: e.target.checked })} /> Data labels
        </label>
      )}
      {chart.kind === 'line' && (
        <label className="chart-toggle">
          <input type="checkbox" checked={!!chart.cumulative} onChange={(e) => setChart({ cumulative: e.target.checked })} /> Cumulative
        </label>
      )}
    </div>
  );

  let body: React.ReactNode;
  const H = 340;

  if (!rows.length) {
    body = <div className="chart-empty">No data to display. Add pages to this database to see a chart.</div>;
  } else if (chart.kind === 'number') {
    const value = aggregate(rows, chart.agg, yProp);
    body = (
      <div className="chart-number">
        <div className="chart-number-value">{fmt(value)}</div>
        <div className="chart-number-label">{yLabel}</div>
      </div>
    );
  } else if (chart.kind === 'donut') {
    const size = Math.min(260, width - 40);
    const R = size / 2, r = R * 0.62, cx0 = R, cy0 = R;
    let a0 = -Math.PI / 2;
    const sum = data.reduce((a, d) => a + Math.max(0, d.value), 0) || 1;
    const arcs = data.map((d) => {
      const frac = Math.max(0, d.value) / sum;
      const a1 = a0 + frac * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad: number, ang: number) => `${cx0 + rad * Math.cos(ang)} ${cy0 + rad * Math.sin(ang)}`;
      const path = frac >= 0.9999
        ? `M ${p(R, 0)} A ${R} ${R} 0 1 1 ${p(R, Math.PI)} A ${R} ${R} 0 1 1 ${p(R, 0)} M ${p(r, 0)} A ${r} ${r} 0 1 0 ${p(r, Math.PI)} A ${r} ${r} 0 1 0 ${p(r, 0)} Z`
        : `M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z`;
      const mid = (a0 + a1) / 2;
      const lp = { x: cx0 + ((R + r) / 2) * Math.cos(mid), y: cy0 + ((R + r) / 2) * Math.sin(mid) };
      a0 = a1;
      return { d, path, frac, lp };
    });
    body = (
      <div className="chart-donut-wrap">
        <svg width={size} height={size} className="chart-svg" style={{ overflow: 'visible' }}>
          {arcs.map(({ d, path }) => (
            <path key={d.key} d={path} fill={d.color} fillRule="evenodd" className="chart-arc" onMouseMove={(e) => showTip(e, d)} onMouseLeave={hideTip} />
          ))}
          {chart.showLabels && arcs.filter((a) => a.frac > 0.04).map(({ d, lp, frac }) => (
            <text key={d.key} x={lp.x} y={lp.y} className="chart-arc-label" textAnchor="middle" dominantBaseline="middle">{Math.round(frac * 100)}%</text>
          ))}
          <text x={cx0} y={cy0 - 6} textAnchor="middle" className="chart-donut-total">{fmt(total)}</text>
          <text x={cx0} y={cy0 + 16} textAnchor="middle" className="chart-donut-sub">{chart.agg === 'count' ? 'Total' : yLabel}</text>
        </svg>
        <div className="chart-legend">
          {data.map((d) => (
            <div key={d.key} className="chart-legend-item">
              <span className="chart-legend-dot" style={{ background: d.color }} />
              <span className="ellipsis grow">{d.label}</span>
              <span className="faint">{fmt(d.value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (chart.kind === 'hbar') {
    const labelW = Math.min(160, Math.max(60, width * 0.25));
    const barH = 24, gap = 10;
    const h = data.length * (barH + gap) + 40;
    const minV = niceMin(Math.min(0, ...data.map((d) => d.value)));
    const maxV = niceMax(Math.max(0, ...data.map((d) => d.value)));
    const plotW = width - labelW - 40;
    const sx = (v: number) => labelW + ((v - minV) / (maxV - minV || 1)) * plotW;
    const ticks = Array.from({ length: 5 }, (_, i) => minV + ((maxV - minV) * i) / 4);
    body = (
      <svg width={width} height={h} className="chart-svg">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={sx(t)} x2={sx(t)} y1={0} y2={h - 24} className="chart-grid" />
            <text x={sx(t)} y={h - 8} textAnchor="middle" className="chart-tick">{fmt(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const y = i * (barH + gap) + 6;
          const x0 = sx(Math.min(0, d.value)), x1 = sx(Math.max(0, d.value));
          return (
            <g key={d.key}>
              <text x={labelW - 8} y={y + barH / 2} textAnchor="end" dominantBaseline="middle" className="chart-tick chart-cat">{trunc(d.label, 20)}</text>
              <rect x={x0} y={y} width={Math.max(1, x1 - x0)} height={barH} rx={3} fill={d.color} className="chart-bar" onMouseMove={(e) => showTip(e, d)} onMouseLeave={hideTip} />
              {chart.showLabels && <text x={x1 + 6} y={y + barH / 2} dominantBaseline="middle" className="chart-data-label">{fmt(d.value)}</text>}
            </g>
          );
        })}
      </svg>
    );
  } else {
    // bar + line share axes
    const left = 52, right = 16, top = 16;
    const rotate = data.length > 0 && (width - left - right) / data.length < 70;
    const bottom = rotate ? 70 : 36;
    const plotW = width - left - right, plotH = H - top - bottom;
    const minV = niceMin(Math.min(0, ...data.map((d) => d.value)));
    const maxV = niceMax(Math.max(0, ...data.map((d) => d.value)));
    const sy = (v: number) => top + plotH - ((v - minV) / (maxV - minV || 1)) * plotH;
    const band = plotW / Math.max(1, data.length);
    const ticks = Array.from({ length: 5 }, (_, i) => minV + ((maxV - minV) * i) / 4);
    const cxOf = (i: number) => left + band * i + band / 2;
    const linePath = data.map((d, i) => `${i ? 'L' : 'M'} ${cxOf(i)} ${sy(d.value)}`).join(' ');
    const areaPath = data.length ? `${linePath} L ${cxOf(data.length - 1)} ${sy(Math.max(0, minV))} L ${cxOf(0)} ${sy(Math.max(0, minV))} Z` : '';
    body = (
      <svg width={width} height={H} className="chart-svg">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={left} x2={width - right} y1={sy(t)} y2={sy(t)} className={cx('chart-grid', t === 0 && 'chart-axis')} />
            <text x={left - 8} y={sy(t)} textAnchor="end" dominantBaseline="middle" className="chart-tick">{fmt(t)}</text>
          </g>
        ))}
        {data.map((d, i) => (
          <text
            key={d.key}
            x={cxOf(i)}
            y={top + plotH + 16}
            textAnchor={rotate ? 'end' : 'middle'}
            transform={rotate ? `rotate(-40 ${cxOf(i)} ${top + plotH + 16})` : undefined}
            className="chart-tick chart-cat"
          >{trunc(d.label, rotate ? 14 : Math.max(4, Math.floor(band / 7)))}</text>
        ))}
        {chart.kind === 'bar' && data.map((d, i) => {
          const bw = Math.min(56, band * 0.62);
          const y0 = sy(Math.max(0, d.value)), y1 = sy(Math.min(0, d.value));
          return (
            <g key={d.key}>
              <rect x={cxOf(i) - bw / 2} y={y0} width={bw} height={Math.max(1, y1 - y0)} rx={3} fill={d.color} className="chart-bar" onMouseMove={(e) => showTip(e, d)} onMouseLeave={hideTip} />
              {chart.showLabels && <text x={cxOf(i)} y={y0 - 6} textAnchor="middle" className="chart-data-label">{fmt(d.value)}</text>}
            </g>
          );
        })}
        {chart.kind === 'line' && (
          <g>
            <path d={areaPath} fill="var(--accent)" opacity={0.08} />
            <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
            {data.map((d, i) => (
              <g key={d.key}>
                <circle cx={cxOf(i)} cy={sy(d.value)} r={4} fill="var(--bg)" stroke="var(--accent)" strokeWidth={2} className="chart-point" onMouseMove={(e) => showTip(e, d)} onMouseLeave={hideTip} />
                {chart.showLabels && <text x={cxOf(i)} y={sy(d.value) - 10} textAnchor="middle" className="chart-data-label">{fmt(d.value)}</text>}
              </g>
            ))}
          </g>
        )}
        <text x={14} y={top + plotH / 2} transform={`rotate(-90 14 ${top + plotH / 2})`} textAnchor="middle" className="chart-axis-title">{yLabel}</text>
      </svg>
    );
  }

  return (
    <div className="chart-view">
      {settings}
      <div className="chart-box" ref={boxRef}>
        {body}
        {xProp && chart.kind !== 'number' && chart.kind !== 'donut' && rows.length > 0 && <div className="chart-x-title">{xProp.name}</div>}
        {tip && (
          <div className="chart-tooltip" style={{ left: tip.x, top: tip.y }}>
            <div className="chart-tooltip-title">{tip.title}</div>
            <div>{tip.text}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s;
}
