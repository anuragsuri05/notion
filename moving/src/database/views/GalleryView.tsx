import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../../store/store';
import type { ViewProps } from '../viewTypes';
import { RowCard } from './RowCard';

const MIN_WIDTH = { small: 180, medium: 260, large: 340 } as const;

export default function GalleryView({ db, view, rows, readOnly, openRow, addRow }: ViewProps) {
  useStore((s) => s.pages);
  const [editing, setEditing] = useState<string | null>(null);
  const min = MIN_WIDTH[view.cardSize ?? 'medium'];
  const preview = view.cardPreview ?? 'content';
  return (
    <div className="gallery-view">
      <div className="gallery-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` }}>
        {rows.map((r) => (
          <RowCard
            key={r.id}
            db={db}
            view={view}
            page={r}
            onOpen={openRow}
            layout="gallery"
            editingTitle={editing === r.id}
            onTitleDone={() => setEditing(null)}
          />
        ))}
        {!readOnly && (
          <button
            className={`gallery-new ${preview === 'none' ? 'gallery-new-compact' : ''}`}
            onClick={() => { const id = addRow({}, { open: false }); setEditing(id); }}
          >
            <Plus size={16} /> New page
          </button>
        )}
      </div>
      {rows.length === 0 && readOnly && <div className="view-empty faint">No pages</div>}
    </div>
  );
}
