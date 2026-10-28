import { useEffect, useRef, useState } from 'react';
import { Plus, MoreHorizontal, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Trash2, Copy, Database, Eraser } from 'lucide-react';
import type { Block } from '../../store/types';
import { useEditor } from '../Editor';
import { MenuPopover, Toggle, Popover } from '../../components/ui';
import { cx, htmlToText, newBlock, sanitizeInline, uid } from '../../lib/util';
import { useStore, makeProperty } from '../../store/store';

export default function TableBlock({ block }: { block: Block }) {
  const api = useEditor();
  const rows = block.rows ?? [['']];
  const cols = Math.max(...rows.map((r) => r.length));
  const [menu, setMenu] = useState<{ kind: 'row' | 'col'; index: number; anchor: HTMLElement } | null>(null);
  const [opts, setOpts] = useState<HTMLElement | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const setRows = (fn: (r: string[][]) => void, typing = false) => {
    const next = rows.map((r) => [...r]);
    fn(next);
    api.ops.update(block.id, { rows: next }, typing);
  };

  const focusCell = (r: number, c: number) => {
    const el = tableRef.current?.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`);
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const onKey = (e: React.KeyboardEvent, r: number, c: number) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      let nr = r, nc = c + (e.shiftKey ? -1 : 1);
      if (nc >= cols) { nc = 0; nr++; }
      if (nc < 0) { nc = cols - 1; nr--; }
      if (nr >= rows.length) { setRows((x) => x.push(Array(cols).fill(''))); setTimeout(() => focusCell(nr, nc), 20); return; }
      if (nr >= 0) focusCell(nr, nc);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (r + 1 < rows.length) focusCell(r + 1, c);
      else { const nb = newBlock(); api.ops.insertAfter(block.id, [nb]); api.focus(nb.id); }
    } else if (e.key === 'ArrowUp' && r > 0 && isAtEdge(e.currentTarget as HTMLElement, 'start')) { e.preventDefault(); focusCell(r - 1, c); }
    else if (e.key === 'ArrowDown' && r < rows.length - 1 && isAtEdge(e.currentTarget as HTMLElement, 'end')) { e.preventDefault(); focusCell(r + 1, c); }
    else if (e.key === 'Escape') { e.preventDefault(); api.select([block.id]); }
  };

  const toDatabase = () => {
    const st = useStore.getState();
    const header = block.headerRow ? rows[0].map((h, i) => htmlToText(h) || `Column ${i + 1}`) : rows[0].map((_, i) => (i === 0 ? 'Name' : `Column ${i + 1}`));
    const data = block.headerRow ? rows.slice(1) : rows;
    const { dbId } = st.createDatabase({ hostPageId: api.pageId, inline: true, view: 'table' });
    const db = useStore.getState().databases[dbId];
    // remove default rows/props, then create text props from columns
    useStore.getState().updateDb(dbId, (d) => { d.properties = d.properties.filter((p) => p.type === 'title'); d.views.forEach((v) => { v.visible = [d.properties[0].id]; }); d.properties[0].name = header[0]; });
    Object.values(useStore.getState().pages).filter((p) => p.dbId === dbId).forEach((p) => useStore.getState().deleteForever(p.id));
    const propIds = header.slice(1).map((name) => {
      const p = makeProperty('text', name);
      useStore.getState().updateDb(dbId, (d) => { d.properties.push(p); d.views.forEach((v) => v.visible.push(p.id)); });
      return p.id;
    });
    data.forEach((row) => {
      const props: Record<string, string> = {};
      propIds.forEach((pid, i) => { props[pid] = htmlToText(row[i + 1] ?? ''); });
      useStore.getState().addRow(dbId, props, undefined, htmlToText(row[0] ?? ''));
    });
    void db;
    api.ops.mutate((d) => {
      const f = (l: typeof d): boolean => { for (let i = 0; i < l.length; i++) { if (l[i].id === block.id) { l[i] = { id: block.id, type: 'database', html: '', dbId }; return true; } if (l[i].children && f(l[i].children!)) return true; } return false; };
      f(d);
    });
  };

  return (
    <div className="table-block" contentEditable={false}>
      <div className="table-scroll">
        <table ref={tableRef}>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {Array.from({ length: cols }, (_, c) => {
                  const header = (block.headerRow && r === 0) || (block.headerCol && c === 0);
                  return (
                    <td key={c} className={cx(header && 'th')}>
                      {r === 0 && !api.readOnly && <button className="col-handle" onClick={(e) => setMenu({ kind: 'col', index: c, anchor: e.currentTarget })}><MoreHorizontal size={12} /></button>}
                      {c === 0 && !api.readOnly && <button className="row-handle" onClick={(e) => setMenu({ kind: 'row', index: r, anchor: e.currentTarget })}><MoreHorizontal size={12} /></button>}
                      <Cell html={row[c] ?? ''} id={`${r}-${c}`} readOnly={api.readOnly}
                        onChange={(html) => setRows((x) => { while (x[r].length < cols) x[r].push(''); x[r][c] = html; }, true)}
                        onKeyDown={(e) => onKey(e, r, c)} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!api.readOnly && <button className="table-add-col" onClick={() => setRows((x) => x.forEach((row) => row.push('')))} title="Add column"><Plus size={14} /></button>}
      </div>
      {!api.readOnly && (
        <div className="row">
          <button className="table-add-row" onClick={() => setRows((x) => x.push(Array(cols).fill('')))}><Plus size={14} /> New row</button>
          <button className="icon-btn sm" onClick={(e) => setOpts(e.currentTarget)} title="Table options"><MoreHorizontal size={14} /></button>
        </div>
      )}
      {opts && (
        <Popover anchor={opts} onClose={() => setOpts(null)}>
          <div className="menu" style={{ width: 240 }}>
            <div className="menu-item" onClick={() => api.ops.update(block.id, { headerRow: !block.headerRow })}><span className="menu-label">Header row</span><Toggle on={!!block.headerRow} onChange={(v) => api.ops.update(block.id, { headerRow: v })} /></div>
            <div className="menu-item" onClick={() => api.ops.update(block.id, { headerCol: !block.headerCol })}><span className="menu-label">Header column</span><Toggle on={!!block.headerCol} onChange={(v) => api.ops.update(block.id, { headerCol: v })} /></div>
            <div className="sep" />
            <div className="menu-item" onClick={() => { setOpts(null); toDatabase(); }}><span className="menu-icon"><Database size={16} /></span><span className="menu-label">Turn into database</span></div>
            <div className="menu-item" onClick={() => { setOpts(null); const [id] = api.ops.duplicate([block.id]); void id; }}><span className="menu-icon"><Copy size={16} /></span><span className="menu-label">Duplicate</span></div>
            <div className="menu-item danger" onClick={() => { setOpts(null); api.ops.remove([block.id]); }}><span className="menu-icon"><Trash2 size={16} /></span><span className="menu-label">Delete table</span></div>
          </div>
        </Popover>
      )}
      {menu && (
        <MenuPopover anchor={menu.anchor} onClose={() => setMenu(null)} width={220} items={menu.kind === 'row' ? [
          { label: 'Insert above', icon: <ArrowUp size={16} />, onClick: () => setRows((x) => x.splice(menu.index, 0, Array(cols).fill(''))) },
          { label: 'Insert below', icon: <ArrowDown size={16} />, onClick: () => setRows((x) => x.splice(menu.index + 1, 0, Array(cols).fill(''))) },
          { label: 'Duplicate', icon: <Copy size={16} />, onClick: () => setRows((x) => x.splice(menu.index + 1, 0, [...x[menu.index]])) },
          { label: 'Clear contents', icon: <Eraser size={16} />, onClick: () => setRows((x) => { x[menu.index] = Array(cols).fill(''); }) },
          { label: 'Delete row', icon: <Trash2 size={16} />, danger: true, disabled: rows.length <= 1, onClick: () => setRows((x) => x.splice(menu.index, 1)) },
        ] : [
          { label: 'Insert left', icon: <ArrowLeft size={16} />, onClick: () => setRows((x) => x.forEach((row) => row.splice(menu.index, 0, ''))) },
          { label: 'Insert right', icon: <ArrowRight size={16} />, onClick: () => setRows((x) => x.forEach((row) => row.splice(menu.index + 1, 0, ''))) },
          { label: 'Duplicate', icon: <Copy size={16} />, onClick: () => setRows((x) => x.forEach((row) => row.splice(menu.index + 1, 0, row[menu.index] ?? ''))) },
          { label: 'Clear contents', icon: <Eraser size={16} />, onClick: () => setRows((x) => x.forEach((row) => { row[menu.index] = ''; })) },
          { label: 'Delete column', icon: <Trash2 size={16} />, danger: true, disabled: cols <= 1, onClick: () => setRows((x) => x.forEach((row) => row.splice(menu.index, 1))) },
        ]} />
      )}
    </div>
  );
}

function isAtEdge(el: HTMLElement, edge: 'start' | 'end') {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return true;
  const r = sel.getRangeAt(0);
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(r.startContainer, r.startOffset);
  const off = pre.toString().length;
  return edge === 'start' ? off === 0 : off === (el.textContent ?? '').length;
}

function Cell({ html, id, onChange, onKeyDown, readOnly }: { html: string; id: string; onChange: (h: string) => void; onKeyDown: (e: React.KeyboardEvent) => void; readOnly: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (ref.current && html !== last.current && ref.current.innerHTML !== html) ref.current.innerHTML = html;
    last.current = html;
  }, [html]);
  return (
    <div
      ref={ref}
      className="cell-edit"
      data-cell={id}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      onInput={() => { const h = ref.current!.innerHTML === '<br>' ? '' : ref.current!.innerHTML; last.current = h; onChange(h); }}
      onKeyDown={onKeyDown}
      onPaste={(e) => { e.preventDefault(); document.execCommand('insertHTML', false, sanitizeInline(e.clipboardData.getData('text/html') || e.clipboardData.getData('text/plain').replace(/</g, '&lt;'))); }}
    />
  );
}

export { uid };
