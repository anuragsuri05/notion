import { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import type { Page } from '../../store/types';
import { useStore } from '../../store/store';
import type { ViewProps } from '../viewTypes';
import { groupRows, type Group } from '../logic';
import { Avatar, PageIcon, Tag } from '../../components/ui';
import { PropValueView } from '../PropValue';
import { cx } from '../../lib/util';
import { InlineTitleInput, groupInitialProps, isEmptyValue, visibleProps } from './RowCard';

export default function ListView({ db, view, rows, readOnly, openRow, addRow }: ViewProps) {
  useStore((s) => s.pages);
  const users = useStore((s) => s.users);
  const st = useStore.getState();
  const props = visibleProps(db, view);
  const groupProp = db.properties.find((p) => p.id === view.groupBy);
  const groups = groupRows(st, db, view, rows);
  const hidden = new Set(view.hiddenGroups ?? []);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);

  const add = (key?: string) => {
    const id = addRow(groupInitialProps(groupProp, key), { open: false });
    setEditing(id);
  };

  const renderRow = (r: Page) => (
    <div key={r.id} className="list-view-row" onClick={() => editing !== r.id && openRow(r.id)}>
      <div className="list-view-main">
        <PageIcon page={r} size={18} />
        {editing === r.id
          ? <InlineTitleInput page={r} onDone={() => setEditing(null)} className="list-view-title-input" />
          : <span className={cx('list-view-title ellipsis', !r.title && 'faint')}>{r.title || 'Untitled'}</span>}
      </div>
      <div className="list-view-props">
        {props.filter((p) => !isEmptyValue(st, r, p)).map((p) => (
          <span key={p.id} className={cx('list-view-prop', `prop-type-${p.type}`)} title={p.name}>
            <PropValueView page={r} prop={p} compact />
          </span>
        ))}
      </div>
    </div>
  );

  const newRow = (key?: string) => !readOnly && (
    <button className="list-view-new" onClick={() => add(key)}><Plus size={16} /> New page</button>
  );

  if (!groups) {
    return (
      <div className="list-view">
        {rows.map(renderRow)}
        {newRow()}
      </div>
    );
  }

  const label = (g: Group) => {
    if (g.option) return <Tag name={g.option.name} color={g.option.color} status={groupProp?.type === 'status'} />;
    if (groupProp?.type === 'person' && g.key !== '__none') return <span className="row" style={{ gap: 6 }}><Avatar user={users[g.key]} size={18} />{g.label}</span>;
    return <span className={cx(g.key === '__none' && 'faint')}>{g.label}</span>;
  };

  return (
    <div className="list-view">
      {groups.filter((g) => !hidden.has(g.key)).map((g) => {
        const isCollapsed = collapsed.has(g.key);
        return (
          <div key={g.key} className="list-view-group">
            <div className="list-view-group-header">
              <button className="list-view-group-toggle" onClick={() => setCollapsed((c) => { const n = new Set(c); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}>
                <ChevronRight size={14} className={cx('list-view-chevron', !isCollapsed && 'open')} />
                {label(g)}
                <span className="list-view-count">{g.rows.length}</span>
              </button>
              {!readOnly && <button className="icon-btn sm list-view-group-add" onClick={() => add(g.key)}><Plus size={14} /></button>}
            </div>
            {!isCollapsed && (
              <div className="list-view-group-body">
                {g.rows.map(renderRow)}
                {newRow(g.key)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
