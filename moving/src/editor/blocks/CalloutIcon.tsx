import { useState } from 'react';
import type { Block } from '../../store/types';
import { useEditor } from '../Editor';
import { Popover, PageIcon } from '../../components/ui';
import IconPicker from '../../components/IconPicker';

export default function CalloutIcon({ block }: { block: Block }) {
  const api = useEditor();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <button className="callout-icon" contentEditable={false} onClick={(e) => !api.readOnly && setAnchor(e.currentTarget)}>
        {block.icon ? <PageIcon page={{ icon: block.icon }} size={20} /> : <span className="faint">·</span>}
      </button>
      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)}>
          <IconPicker onPick={(icon) => { api.ops.update(block.id, { icon: icon ?? '' }); setAnchor(null); }} />
        </Popover>
      )}
    </>
  );
}
