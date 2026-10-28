import { useState } from 'react';
import { RefreshCw, Copy, Unlink, ExternalLink } from 'lucide-react';
import type { Block } from '../../store/types';
import { useEditor, setClipboardBlocks } from '../Editor';
import BlockList from '../BlockList';
import Editor from '../Editor';
import { useStore, pageTitle } from '../../store/store';
import { MenuPopover } from '../../components/ui';
import { findBlock, walkBlocks, cloneBlocks, newBlock } from '../../lib/util';
import { goPage } from '../../lib/router';

export default function SyncedBlock({ block, depth }: { block: Block; depth: number }) {
  const api = useEditor();
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const isCopy = !!block.syncId && !!block.pageId;
  const source = useStore((s) => (isCopy ? s.pages[block.pageId!] : undefined));
  const sourceBlock = isCopy && source ? findBlock(source.content, block.syncId!) : null;
  const copies = useStore((s) => {
    if (isCopy) return 0;
    let n = 0;
    for (const p of Object.values(s.pages)) walkBlocks(p.content, (b) => { if (b.type === 'synced' && b.syncId === block.id) n++; });
    return n;
  });

  const copyAndSync = () => {
    const ref: Block = { id: 'x', type: 'synced', html: '', syncId: isCopy ? block.syncId : block.id, pageId: isCopy ? block.pageId : api.pageId };
    setClipboardBlocks([ref]);
    navigator.clipboard.writeText('[Synced block]');
    useStore.getState().showToast('Copied synced block. Paste it anywhere to keep it in sync.');
  };

  const unsync = () => {
    const content = isCopy ? (sourceBlock?.children ?? []) : (block.children ?? []);
    const plain = cloneBlocks(JSON.parse(JSON.stringify(content)));
    api.ops.mutate((d) => {
      const f = (l: typeof d): boolean => { for (let i = 0; i < l.length; i++) { if (l[i].id === block.id) { l.splice(i, 1, ...(plain.length ? plain : [newBlock()])); return true; } if (l[i].children && f(l[i].children!)) return true; } return false; };
      f(d);
    });
  };

  return (
    <div className="synced-block">
      <div className="synced-bar" contentEditable={false}>
        <button className="synced-label" onClick={(e) => setMenu(e.currentTarget)}>
          <RefreshCw size={12} /> {isCopy ? <>Editing original in <b>{pageTitle(source)}</b></> : <>Synced block{copies ? ` · ${copies} cop${copies === 1 ? 'y' : 'ies'}` : ''}</>}
        </button>
        <button className="synced-copy" onClick={copyAndSync}><Copy size={12} /> Copy and sync</button>
      </div>
      <div className="synced-body">
        {isCopy
          ? (sourceBlock ? <Editor pageId={block.pageId!} rootId={block.syncId} readOnly={api.readOnly} compact /> : <div className="faint" style={{ padding: 8 }}>The original synced block was deleted.</div>)
          : <BlockList blocks={block.children ?? []} depth={depth + 1} />}
      </div>
      {menu && <MenuPopover anchor={menu} onClose={() => setMenu(null)} width={240} items={[
        ...(isCopy ? [{ label: `Go to original`, icon: <ExternalLink size={16} />, onClick: () => goPage(block.pageId!, block.syncId) }] : []),
        { label: 'Copy and sync', icon: <Copy size={16} />, onClick: copyAndSync },
        { label: isCopy ? 'Unsync' : 'Unsync all', icon: <Unlink size={16} />, onClick: unsync },
      ]} />}
    </div>
  );
}
