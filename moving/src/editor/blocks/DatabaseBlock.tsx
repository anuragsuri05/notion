import { useState } from 'react';
import { Database as DbIcon, Plus } from 'lucide-react';
import type { Block } from '../../store/types';
import { useEditor } from '../Editor';
import { useStore } from '../../store/store';
import { Popover, SearchInput, PageIcon } from '../../components/ui';
import DatabaseView from '../../database/DatabaseView';
import { fuzzy } from '../../lib/util';

export default function DatabaseBlock({ block }: { block: Block }) {
  const api = useEditor();
  const db = useStore((s) => (block.dbId ? s.databases[block.dbId] : undefined));
  const [picker, setPicker] = useState<HTMLElement | null>(null);

  if (!block.dbId || !db) {
    return (
      <>
        <div className="media-empty media" onClick={(e) => !api.readOnly && setPicker(e.currentTarget)}>
          <DbIcon size={18} /> {block.dbId ? 'This database was deleted' : 'Select a data source for this linked view'}
        </div>
        {picker && <DataSourcePicker anchor={picker} onClose={() => setPicker(null)} onPick={(id) => { api.ops.update(block.id, { dbId: id, viewIds: undefined }); setPicker(null); }}
          onNew={() => { const { dbId } = useStore.getState().createDatabase({ hostPageId: api.pageId, inline: true }); api.ops.update(block.id, { dbId, viewIds: undefined }); setPicker(null); }} />}
      </>
    );
  }
  const linked = db.pageId !== api.pageId || !db.inline;
  return (
    <div className="db-block" contentEditable={false}>
      <DatabaseView dbId={db.id} inline linked={linked} blockId={block.id} readOnly={api.readOnly} />
    </div>
  );
}

export function DataSourcePicker({ anchor, onClose, onPick, onNew }: { anchor: HTMLElement; onClose: () => void; onPick: (id: string) => void; onNew?: () => void }) {
  const [q, setQ] = useState('');
  const dbs = useStore((s) => Object.values(s.databases).filter((d) => d.wsId === s.wsId && s.pages[d.pageId] && !s.pages[d.pageId].trashedAt));
  const pages = useStore((s) => s.pages);
  const list = dbs.filter((d) => fuzzy(q, d.title || pages[d.pageId]?.title || 'Untitled'));
  return (
    <Popover anchor={anchor} onClose={onClose}>
      <div className="menu" style={{ width: 320 }}>
        <div className="menu-search"><SearchInput autoFocus value={q} onChange={setQ} placeholder="Link to a database…" /></div>
        <div className="menu-list" style={{ maxHeight: 300 }}>
          {list.map((d) => (
            <div key={d.id} className="menu-item" onClick={() => onPick(d.id)}>
              <span className="menu-icon">{d.icon ? <span className="emoji-icon">{d.icon}</span> : d.inline ? <DbIcon size={16} /> : <PageIcon page={pages[d.pageId]} size={18} />}</span>
              <span className="menu-label ellipsis">{d.title || (d.inline ? 'Untitled database' : pages[d.pageId]?.title) || 'Untitled'}</span>
              {d.inline && <span className="faint small ellipsis" style={{ maxWidth: 110 }}>in {pages[d.pageId]?.title || 'Untitled'}</span>}
            </div>
          ))}
          {list.length === 0 && <div className="menu-empty">No databases</div>}
          {onNew && <><div className="sep" /><div className="menu-item" onClick={onNew}><span className="menu-icon"><Plus size={16} /></span><span className="menu-label">New database</span></div></>}
        </div>
      </div>
    </Popover>
  );
}
