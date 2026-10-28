import React, { useRef, useState } from 'react';
import { MoreHorizontal, Plus, EyeOff, Eye } from 'lucide-react';
import type { Page, Property, SelectOption } from '../../store/types';
import { useStore } from '../../store/store';
import type { ViewProps } from '../viewTypes';
import { groupRows, type Group } from '../logic';
import { Avatar, MenuPopover, Tag, Tip, type Anchor } from '../../components/ui';
import { nextColor } from '../PropValue';
import { cx, uid } from '../../lib/util';
import { RowCard, canSetGroup, groupInitialProps, groupValue } from './RowCard';

const CARD_WIDTH = { small: 200, medium: 260, large: 320 } as const;

interface DragState { id: string; fromKey: string }
interface DropState { key: string; index: number }

export default function BoardView({ db, view, rows, readOnly, openRow, addRow, updateView }: ViewProps) {
  // Subscribe to pages/users so cards re-render on edits.
  useStore((s) => s.pages);
  const users = useStore((s) => s.users);
  const st = useStore.getState();
  const prop = db.properties.find((p) => p.id === view.groupBy);
  const groups: Group[] = groupRows(st, db, view, rows) ?? [{ key: '__all', label: 'All', rows }];
  const hidden = new Set(view.hiddenGroups ?? []);
  const shown = groups.filter((g) => !hidden.has(g.key));
  const hiddenList = groups.filter((g) => hidden.has(g.key));
  const width = CARD_WIDTH[view.cardSize ?? 'medium'];

  const [drag, setDrag] = useState<DragState | null>(null);
  const [drop, setDrop] = useState<DropState | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ anchor: Anchor; key: string } | null>(null);
  const [addingGroup, setAddingGroup] = useState(false);
  const dragRef = useRef<DragState | null>(null);

  const canMoveGroups = !readOnly && (!prop || canSetGroup(prop));
  const canReorder = !readOnly && view.sorts.length === 0;

  const newInGroup = (key: string, atTop = false) => {
    const props = groupInitialProps(prop, key);
    const id = addRow(props, { open: false });
    if (atTop) {
      const g = groups.find((x) => x.key === key);
      const first = g?.rows[0];
      if (first && canReorder) useStore.getState().updatePage(id, { order: first.order - 1 });
    }
    setEditing(id);
  };

  const hideGroup = (key: string) => updateView((v) => { v.hiddenGroups = Array.from(new Set([...(v.hiddenGroups ?? []), key])); });
  const showGroup = (key: string) => updateView((v) => { v.hiddenGroups = (v.hiddenGroups ?? []).filter((k) => k !== key); });

  const doDrop = (toKey: string, index: number) => {
    const d = dragRef.current;
    if (!d) return;
    const page = useStore.getState().pages[d.id];
    if (!page) return;
    const store = useStore.getState();
    if (prop && d.fromKey !== toKey) {
      const v = groupValue(prop, toKey, page.props[prop.id], d.fromKey);
      if (v !== undefined) store.setProp(page.id, prop.id, v);
    }
    if (canReorder) {
      const col = (groups.find((g) => g.key === toKey)?.rows ?? []).filter((r) => r.id !== page.id);
      // index is relative to the column including the dragged card; adjust
      const orig = groups.find((g) => g.key === toKey)?.rows ?? [];
      const origIdx = orig.findIndex((r) => r.id === page.id);
      let i = index;
      if (origIdx >= 0 && origIdx < index) i -= 1;
      i = Math.max(0, Math.min(i, col.length));
      const prev: Page | undefined = col[i - 1];
      const next: Page | undefined = col[i];
      let order = page.order;
      if (prev && next) order = (prev.order + next.order) / 2;
      else if (prev) order = prev.order + 1;
      else if (next) order = next.order - 1;
      if (order !== page.order) store.updatePage(page.id, { order });
    }
  };

  const endDrag = () => { dragRef.current = null; setDrag(null); setDrop(null); };

  const onCardDragOver = (e: React.DragEvent, key: string, index: number) => {
    if (!dragRef.current) return;
    if (dragRef.current.fromKey !== key && !canMoveGroups) return;
    e.preventDefault();
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const i = e.clientY < r.top + r.height / 2 ? index : index + 1;
    if (!drop || drop.key !== key || drop.index !== i) setDrop({ key, index: i });
  };

  const onColDragOver = (e: React.DragEvent, key: string, len: number) => {
    if (!dragRef.current) return;
    if (dragRef.current.fromKey !== key && !canMoveGroups) return;
    e.preventDefault();
    if (!drop || drop.key !== key) setDrop({ key, index: len });
  };

  const header = (g: Group) => {
    let label: React.ReactNode;
    if (g.option) label = <Tag name={g.option.name} color={g.option.color} status={prop?.type === 'status'} />;
    else if (prop?.type === 'person' && g.key !== '__none') label = <span className="row" style={{ gap: 6 }}><Avatar user={users[g.key]} size={18} /><span className="ellipsis">{g.label}</span></span>;
    else if (g.key === '__none' || g.key === '__all') label = <span className="board-col-label faint">{g.label}</span>;
    else label = <span className="board-col-label">{g.label}</span>;
    return label;
  };

  const colColor = (g: Group) => view.colorColumns && g.option && g.option.color !== 'default' ? `bg-${g.option.color}` : undefined;

  return (
    <div className="board-view">
      <div className="board-columns">
        {shown.map((g) => {
          const isDrop = drop?.key === g.key;
          return (
            <div
              key={g.key}
              className={cx('board-col', colColor(g), view.colorColumns && 'board-col-colored', isDrop && 'board-col-drop')}
              style={{ width }}
              onDragOver={(e) => onColDragOver(e, g.key, g.rows.length)}
              onDragLeave={(e) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDrop((d) => (d?.key === g.key ? null : d)); }}
              onDrop={(e) => { e.preventDefault(); if (drop) doDrop(g.key, drop.key === g.key ? drop.index : g.rows.length); endDrag(); }}
            >
              <div className="board-col-header">
                <div className="board-col-title">
                  {header(g)}
                  <span className="board-col-count">{g.rows.length}</span>
                </div>
                {!readOnly && (
                  <div className="board-col-actions">
                    {g.key !== '__all' && (
                      <Tip label="Hide, rename, and more"><button className="icon-btn sm" onClick={(e) => setMenu({ anchor: e.currentTarget, key: g.key })}><MoreHorizontal size={16} /></button></Tip>
                    )}
                    <Tip label="New page"><button className="icon-btn sm" onClick={() => newInGroup(g.key, true)}><Plus size={16} /></button></Tip>
                  </div>
                )}
              </div>
              <div className="board-cards">
                {g.rows.map((r, i) => (
                  <React.Fragment key={r.id}>
                    {isDrop && drop!.index === i && <div className="board-drop-line" />}
                    <RowCard
                      db={db}
                      view={view}
                      page={r}
                      onOpen={openRow}
                      layout="board"
                      editingTitle={editing === r.id}
                      onTitleDone={() => setEditing(null)}
                      className={cx(drag?.id === r.id && 'dragging')}
                      divProps={{
                        draggable: !readOnly && editing !== r.id,
                        onDragStart: (e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', r.id);
                          const d = { id: r.id, fromKey: g.key };
                          dragRef.current = d;
                          setTimeout(() => setDrag(d), 0);
                        },
                        onDragEnd: endDrag,
                        onDragOver: (e) => onCardDragOver(e, g.key, i),
                      }}
                    />
                  </React.Fragment>
                ))}
                {isDrop && drop!.index >= g.rows.length && <div className="board-drop-line" />}
                {!readOnly && (
                  <button className="board-new" onClick={() => newInGroup(g.key)}>
                    <Plus size={16} /> New page
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {!readOnly && prop && (prop.type === 'select' || prop.type === 'multi_select' || prop.type === 'status') && (
          <div className="board-add-group" style={{ width: Math.min(width, 240) }}>
            {addingGroup ? (
              <AddGroupInput
                onCancel={() => setAddingGroup(false)}
                onSubmit={(name) => {
                  const opts: SelectOption[] = prop.options ?? [];
                  if (!opts.some((o) => o.name.toLowerCase() === name.toLowerCase())) {
                    const opt: SelectOption = { id: uid(), name, color: nextColor(opts.length) };
                    if (prop.type === 'status') opt.group = 'todo';
                    useStore.getState().updateProperty(db.id, prop.id, { options: [...opts, opt] });
                  }
                  setAddingGroup(false);
                }}
              />
            ) : (
              <button className="board-add-group-btn" onClick={() => setAddingGroup(true)}><Plus size={16} /> Add group</button>
            )}
          </div>
        )}

        {hiddenList.length > 0 && (
          <div className="board-hidden">
            <div className="board-hidden-title">Hidden groups</div>
            {hiddenList.map((g) => (
              <button key={g.key} className="board-hidden-item" disabled={readOnly} onClick={() => !readOnly && showGroup(g.key)} title={readOnly ? undefined : 'Show group'}>
                <span className="grow row" style={{ gap: 6, minWidth: 0 }}>{header(g)}</span>
                <span className="board-col-count">{g.rows.length}</span>
                {!readOnly && <Eye size={14} className="board-hidden-eye" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {menu && (
        <MenuPopover
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          items={[
            { label: 'Hide group', icon: <EyeOff size={16} />, onClick: () => hideGroup(menu.key) },
            ...(prop && prop.options && menu.key !== '__none' && (prop.type === 'select' || prop.type === 'multi_select' || prop.type === 'status')
              ? [{ label: 'Delete option', danger: true, onClick: () => deleteOption(db.id, prop, menu.key) }]
              : []),
          ]}
        />
      )}
    </div>
  );
}

function deleteOption(dbId: string, prop: Property, id: string) {
  useStore.getState().updateProperty(dbId, prop.id, { options: (prop.options ?? []).filter((o) => o.id !== id) });
}

function AddGroupInput({ onSubmit, onCancel }: { onSubmit: (name: string) => void; onCancel: () => void }) {
  const [v, setV] = useState('');
  return (
    <input
      autoFocus
      className="input board-add-group-input"
      placeholder="Group name"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => (v.trim() ? onSubmit(v.trim()) : onCancel())}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && v.trim()) onSubmit(v.trim());
        if (e.key === 'Escape') onCancel();
      }}
    />
  );
}
