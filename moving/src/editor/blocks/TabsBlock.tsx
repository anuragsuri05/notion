import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Block } from '../../store/types';
import { useEditor } from '../Editor';
import BlockList from '../BlockList';
import { MenuPopover } from '../../components/ui';
import { cx, newBlock, uid } from '../../lib/util';

export default function TabsBlock({ block, depth }: { block: Block; depth: number }) {
  const api = useEditor();
  const tabs = block.tabs ?? [];
  const active = Math.min(block.activeTab ?? 0, tabs.length - 1);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ i: number; el: HTMLElement } | null>(null);

  const mutate = (fn: (b: Block) => void) => api.ops.mutate((d) => {
    const f = (l: typeof d): boolean => { for (const b of l) { if (b.id === block.id) { fn(b); return true; } if (b.children && f(b.children)) return true; if (b.tabs) for (const t of b.tabs) if (f(t.children)) return true; } return false; };
    f(d);
  });

  return (
    <div className="tabs-block">
      <div className="tabs-bar" contentEditable={false}>
        {tabs.map((t, i) => (
          renaming === i ? (
            <input key={t.id} autoFocus className="tab-rename" defaultValue={t.name}
              onBlur={(e) => { const v = e.target.value.trim() || t.name; mutate((b) => { b.tabs![i].name = v; }); setRenaming(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur(); }} />
          ) : (
            <button key={t.id} className={cx('tab', i === active && 'active')}
              onClick={() => api.ops.update(block.id, { activeTab: i })}
              onDoubleClick={() => !api.readOnly && setRenaming(i)}
              onContextMenu={(e) => { e.preventDefault(); if (!api.readOnly) setMenu({ i, el: e.currentTarget }); }}>
              {t.name}
            </button>
          )
        ))}
        {!api.readOnly && <button className="icon-btn sm" title="Add tab" onClick={() => mutate((b) => { b.tabs!.push({ id: uid(), name: `Tab ${b.tabs!.length + 1}`, children: [newBlock()] }); b.activeTab = b.tabs!.length - 1; })}><Plus size={14} /></button>}
      </div>
      <div className="tabs-body">
        {tabs[active] && <BlockList blocks={tabs[active].children} depth={depth + 1} />}
      </div>
      {menu && <MenuPopover anchor={menu.el} onClose={() => setMenu(null)} width={200} items={[
        { label: 'Rename', onClick: () => setRenaming(menu.i) },
        { label: 'Duplicate', onClick: () => mutate((b) => { const t = JSON.parse(JSON.stringify(b.tabs![menu.i])); t.id = uid(); t.name += ' (1)'; b.tabs!.splice(menu.i + 1, 0, t); }) },
        { label: 'Move left', disabled: menu.i === 0, onClick: () => mutate((b) => { const [t] = b.tabs!.splice(menu.i, 1); b.tabs!.splice(menu.i - 1, 0, t); b.activeTab = menu.i - 1; }) },
        { label: 'Move right', disabled: menu.i >= tabs.length - 1, onClick: () => mutate((b) => { const [t] = b.tabs!.splice(menu.i, 1); b.tabs!.splice(menu.i + 1, 0, t); b.activeTab = menu.i + 1; }) },
        { label: 'Delete tab', danger: true, disabled: tabs.length <= 1, onClick: () => mutate((b) => { b.tabs!.splice(menu.i, 1); b.activeTab = 0; }) },
      ]} />}
    </div>
  );
}
