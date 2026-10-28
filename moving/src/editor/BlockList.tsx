import React, { memo, useRef, useState } from 'react';
import { GripVertical, Plus } from 'lucide-react';
import type { Block } from '../store/types';
import { useEditor } from './Editor';
import RichText from './RichText';
import { Checkbox, Tip } from '../components/ui';
import { cx, isToggleType, newBlock, MOD, ALT } from '../lib/util';
import type { DropWhere } from './ops';
import CodeBlock from './blocks/CodeBlock';
import EquationBlock from './blocks/EquationBlock';
import MediaBlock from './blocks/MediaBlock';
import TableBlock from './blocks/TableBlock';
import PageLinkBlock from './blocks/PageLinkBlock';
import DatabaseBlock from './blocks/DatabaseBlock';
import { TocBlock, BreadcrumbBlock } from './blocks/NavBlocks';
import ButtonBlock from './blocks/ButtonBlock';
import SyncedBlock from './blocks/SyncedBlock';
import TabsBlock from './blocks/TabsBlock';
import CalloutIcon from './blocks/CalloutIcon';

export default function BlockList({ blocks, depth }: { blocks: Block[]; depth: number }) {
  let num = 0;
  return (
    <>
      {blocks.map((b, i) => {
        num = b.type === 'numbered' ? (blocks[i - 1]?.type === 'numbered' ? num + 1 : 1) : 0;
        return <BlockView key={b.id} block={b} depth={depth} index={num} />;
      })}
    </>
  );
}

function numberLabel(n: number, depth: number, style?: Block['numberStyle']) {
  const mode = style ?? (['numbers', 'letters', 'roman'] as const)[depth % 3];
  if (mode === 'letters') {
    let s = '', x = n;
    while (x > 0) { x--; s = String.fromCharCode(97 + (x % 26)) + s; x = Math.floor(x / 26); }
    return s;
  }
  if (mode === 'roman') {
    const map: [number, string][] = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
    let s = '', x = n;
    for (const [v, r] of map) while (x >= v) { s += r; x -= v; }
    return s;
  }
  return String(n);
}

const BULLETS = ['•', '◦', '▪'];

export const BlockView = memo(function BlockView({ block, depth, index }: { block: Block; depth: number; index: number }) {
  const api = useEditor();
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const selected = api.selected.has(block.id);
  const drag = api.drag;
  const dropWhere = drag?.overId === block.id ? drag.where : undefined;
  const ro = api.readOnly;

  const onDragOver = (e: React.DragEvent) => {
    if (!drag || drag.ids.includes(block.id) || block.type === 'column') return;
    e.preventDefault();
    e.stopPropagation();
    const content = ref.current?.querySelector(':scope > .block-row') as HTMLElement ?? ref.current!;
    const r = content.getBoundingClientRect();
    let where: DropWhere = e.clientY < r.top + r.height / 2 ? 'before' : 'after';
    const isNested = !!ref.current?.parentElement?.closest('.block-children');
    if (!isNested && block.type !== 'columns') {
      if (e.clientX > r.right - 50) where = 'right';
      else if (e.clientX < r.left + 30 && depth === 0) where = 'left';
    }
    if (drag.overId !== block.id || drag.where !== where) api.setDrag({ ...drag, overId: block.id, where });
  };

  const onDrop = (e: React.DragEvent) => {
    if (!drag?.overId || !drag.where) return;
    e.preventDefault();
    e.stopPropagation();
    api.ops.move(drag.ids, drag.overId, drag.where);
    api.setDrag(null);
  };

  const startDrag = (e: React.DragEvent) => {
    const ids = api.selected.has(block.id) ? Array.from(api.selected) : [block.id];
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-moving-blocks', JSON.stringify({ pageId: api.pageId, ids }));
    const ghost = ref.current?.querySelector('.block-content') as HTMLElement | null;
    if (ghost) e.dataTransfer.setDragImage(ghost, 10, 10);
    setTimeout(() => api.setDrag({ ids }), 0);
  };

  const addBelow = (e: React.MouseEvent) => {
    const nb = newBlock();
    if (e.altKey) api.ops.insertBefore(block.id, [nb]); else api.ops.insertAfter(block.id, [nb]);
    api.focus(nb.id, 'start');
    setTimeout(() => api.openMenu({ kind: 'slash', blockId: nb.id, start: 0, trig: 0, query: '', rect: (document.querySelector(`[data-rt="${nb.id}"]`) as HTMLElement)?.getBoundingClientRect() ?? new DOMRect() }), 30);
  };

  const colorCls = cx(block.color && block.color !== 'default' && `c-${block.color}`, block.bg && block.bg !== 'default' && block.type !== 'callout' && `bg-${block.bg} has-bg`);

  if (block.type === 'columns') {
    return (
      <div ref={ref} className={cx('block block-columns', selected && 'selected', dropWhere && `drop-${dropWhere}`)} data-block={block.id} data-blocktype="columns" onDragOver={onDragOver} onDrop={onDrop}>
        <Columns block={block} depth={depth} />
      </div>
    );
  }

  const gutter = !ro && (
    <div className={cx('block-gutter', hover && 'show', gutterOffset(block))} contentEditable={false}>
      <Tip label="Click to add below" kbd={`${ALT}-click to add above`}>
        <button className="icon-btn sm gutter-btn" onClick={addBelow}><Plus size={16} /></button>
      </Tip>
      <Tip label="Drag to move" kbd="Click to open menu">
        <button
          className="icon-btn sm gutter-btn block-handle"
          draggable
          onDragStart={startDrag}
          onDragEnd={() => api.setDrag(null)}
          onClick={(e) => { api.select([block.id]); api.openBlockMenu(block.id, e.currentTarget); }}
        >
          <GripVertical size={16} />
        </button>
      </Tip>
    </div>
  );

  let body: React.ReactNode;
  let childrenInside = false;
  switch (block.type) {
    case 'text': body = <RichText block={block} />; break;
    case 'h1': case 'h2': case 'h3': case 'h4': body = <RichText block={block} className={block.type} />; break;
    case 'todo':
      body = (
        <div className="todo">
          <span className="todo-check" contentEditable={false}><Checkbox checked={!!block.checked} onChange={(v) => !ro && api.ops.update(block.id, { checked: v })} /></span>
          <RichText block={block} className={cx(block.checked && 'checked')} />
        </div>
      );
      break;
    case 'bullet':
      body = <div className="list-item"><span className="marker bullet" contentEditable={false}>{BULLETS[depth % 3]}</span><RichText block={block} /></div>;
      break;
    case 'numbered':
      body = <div className="list-item"><span className="marker number" contentEditable={false}>{numberLabel(index, depth, block.numberStyle)}.</span><RichText block={block} /></div>;
      break;
    case 'toggle': case 'toggle_h1': case 'toggle_h2': case 'toggle_h3':
      body = (
        <div className="list-item toggle-row">
          <button className={cx('toggle-arrow', block.open && 'open', block.type !== 'toggle' && block.type.replace('toggle_', 'arrow-'))} contentEditable={false} onClick={() => api.ops.update(block.id, { open: !block.open })}>
            <svg viewBox="0 0 100 100" width="12" height="12"><polygon points="5.9,88.2 50,11.8 94.1,88.2" fill="currentColor" /></svg>
          </button>
          <RichText block={block} className={block.type === 'toggle' ? '' : block.type.replace('toggle_', '')} />
        </div>
      );
      break;
    case 'quote': body = <div className={cx('quote', block.quoteSize === 'large' && 'large')}><RichText block={block} /></div>; break;
    case 'callout':
      childrenInside = true;
      body = (
        <div className={cx('callout', block.bg && block.bg !== 'default' ? `bg-${block.bg}` : 'callout-border')}>
          <CalloutIcon block={block} />
          <div className="callout-body">
            <RichText block={block} />
            {block.children?.length ? <div className="callout-children"><BlockList blocks={block.children} depth={depth + 1} /></div> : null}
          </div>
        </div>
      );
      break;
    case 'divider': body = <div className="divider" contentEditable={false}><hr /></div>; break;
    case 'code': body = <CodeBlock block={block} />; break;
    case 'equation': body = <EquationBlock block={block} />; break;
    case 'image': case 'video': case 'audio': case 'file': case 'bookmark': case 'embed': case 'pdf': body = <MediaBlock block={block} />; break;
    case 'table': body = <TableBlock block={block} />; break;
    case 'page': case 'link_page': body = <PageLinkBlock block={block} />; break;
    case 'database': body = <DatabaseBlock block={block} />; break;
    case 'toc': body = <TocBlock block={block} />; break;
    case 'breadcrumb': body = <BreadcrumbBlock />; break;
    case 'button': body = <ButtonBlock block={block} />; break;
    case 'synced': childrenInside = true; body = <SyncedBlock block={block} depth={depth} />; break;
    case 'tabs': childrenInside = true; body = <TabsBlock block={block} depth={depth} />; break;
    default: body = <RichText block={block} />;
  }

  const showChildren = !childrenInside && (block.children?.length || (isToggleType(block.type) && block.open)) && (!isToggleType(block.type) || block.open);

  return (
    <div
      ref={ref}
      className={cx('block', `block-${block.type}`, selected && 'selected', dropWhere && `drop-${dropWhere}`, api.drag?.ids.includes(block.id) && 'dragging')}
      data-block={block.id}
      data-blocktype={block.type}
      id={`block-${block.id}`}
      onMouseEnter={(e) => { e.stopPropagation(); setHover(true); }}
      onMouseLeave={() => setHover(false)}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className={cx('block-row', colorCls)}>
        {gutter}
        <div className="block-content">{body}</div>
      </div>
      {showChildren ? (
        <div className={cx('block-children', isToggleType(block.type) && 'toggle-children')}>
          {block.children?.length ? <BlockList blocks={block.children} depth={depth + 1} /> : (
            <div className="toggle-empty" onClick={() => { if (ro) return; const nb = newBlock(); api.ops.insertAfter(null, [nb], block.id); api.focus(nb.id); }}>
              Empty toggle. Click or drop blocks inside.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
});

function gutterOffset(b: Block) {
  if (b.type === 'h1' || b.type === 'toggle_h1') return 'g-h1';
  if (b.type === 'h2' || b.type === 'toggle_h2') return 'g-h2';
  if (b.type === 'h3' || b.type === 'toggle_h3') return 'g-h3';
  if (b.type === 'callout') return 'g-callout';
  return '';
}

function Columns({ block, depth }: { block: Block; depth: number }) {
  const api = useEditor();
  const cols = block.children ?? [];
  const rowRef = useRef<HTMLDivElement>(null);
  const startResize = (i: number, e: React.MouseEvent) => {
    e.preventDefault();
    const row = rowRef.current!;
    const total = row.getBoundingClientRect().width;
    const widths = cols.map((c) => c.width ?? 1 / cols.length);
    const x0 = e.clientX;
    const move = (ev: MouseEvent) => {
      const dx = (ev.clientX - x0) / total;
      const a = Math.max(0.1, widths[i] + dx), b = Math.max(0.1, widths[i + 1] - dx);
      const next = [...widths];
      next[i] = a; next[i + 1] = b;
      row.querySelectorAll<HTMLElement>(':scope > .column').forEach((el, j) => { el.style.flexGrow = String(next[j]); });
      (row as any)._widths = next;
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      const next = (row as any)._widths as number[] | undefined;
      if (next) api.ops.mutate((d) => {
        const find = (l: Block[]): Block | null => { for (const b of l) { if (b.id === block.id) return b; const r = b.children && find(b.children); if (r) return r; } return null; };
        const cb = find(d);
        cb?.children?.forEach((c, j) => { c.width = next[j]; });
      });
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };
  return (
    <div className="columns" ref={rowRef}>
      {cols.map((c, i) => (
        <React.Fragment key={c.id}>
          <div className="column" style={{ flexGrow: c.width ?? 1 }} data-block={c.id} data-blocktype="column">
            <BlockList blocks={c.children ?? []} depth={depth} />
          </div>
          {i < cols.length - 1 && <div className="column-gap" onMouseDown={(e) => !api.readOnly && startResize(i, e)}><div className="column-gap-line" /></div>}
        </React.Fragment>
      ))}
    </div>
  );
}

export { MOD };
