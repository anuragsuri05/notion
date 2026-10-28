import { useState } from 'react';
import { Settings2, Plus, Trash2, ListPlus, FilePlus, ExternalLink, Bell, MessageCircleQuestion } from 'lucide-react';
import type { Block, ButtonAction } from '../../store/types';
import { useEditor } from '../Editor';
import { useStore, pageTitle } from '../../store/store';
import { Popover, MenuPopover, useAnchor, ConfirmDialog } from '../../components/ui';
import { cloneBlocks, newBlock, htmlToText } from '../../lib/util';
import { goPage } from '../../lib/router';
import { markdownToBlocks, blocksToMarkdown } from '../../lib/markdown';
import { PagePicker } from './PageLinkBlock';
import { DataSourcePicker } from './DatabaseBlock';

const ACTION_META: Record<ButtonAction['kind'], { label: string; icon: typeof Plus }> = {
  insert_blocks: { label: 'Insert blocks', icon: ListPlus },
  add_page: { label: 'Add page to…', icon: FilePlus },
  open_page: { label: 'Open page', icon: ExternalLink },
  notify: { label: 'Send notification', icon: Bell },
  confirm: { label: 'Show confirmation', icon: MessageCircleQuestion },
};

export default function ButtonBlock({ block }: { block: Block }) {
  const api = useEditor();
  const [edit, setEdit] = useState<HTMLElement | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const actions = block.actions ?? [];

  const execute = () => {
    const st = useStore.getState();
    for (const a of actions) {
      if (a.kind === 'insert_blocks' && a.blocks?.length) api.ops.insertAfter(block.id, cloneBlocks(JSON.parse(JSON.stringify(a.blocks))));
      if (a.kind === 'add_page' && a.dbId && st.databases[a.dbId]) { const id = st.addRow(a.dbId, a.props ?? {}); if (actions.some((x) => x.kind === 'open_page' && !x.pageId)) st.setPeek({ pageId: id, mode: 'side' }); }
      if (a.kind === 'open_page' && a.pageId) goPage(a.pageId);
      if (a.kind === 'notify') st.notify({ kind: 'system', pageId: api.pageId, text: a.message || `Button “${htmlToText(block.html)}” was clicked` });
    }
    st.showToast(`Ran “${htmlToText(block.html) || 'Button'}”`);
  };

  const run = () => {
    if (!actions.length) { setEdit(document.querySelector(`[data-block="${block.id}"] .button-block`) as HTMLElement); return; }
    const c = actions.find((a) => a.kind === 'confirm');
    if (c) setConfirming(c.message || 'Are you sure?');
    else execute();
  };

  return (
    <div className="button-block-row" contentEditable={false}>
      <button className="button-block" onClick={run}>
        <span>✦</span> {htmlToText(block.html) || 'New button'}
      </button>
      {!api.readOnly && <button className="icon-btn sm button-settings" onClick={(e) => setEdit(e.currentTarget)} title="Edit button"><Settings2 size={14} /></button>}
      {edit && <ButtonEditor block={block} anchor={edit} onClose={() => setEdit(null)} />}
      {confirming && <ConfirmDialog title={confirming} confirm="Continue" onConfirm={execute} onClose={() => setConfirming(null)} />}
    </div>
  );
}

function ButtonEditor({ block, anchor, onClose }: { block: Block; anchor: HTMLElement; onClose: () => void }) {
  const api = useEditor();
  const add = useAnchor();
  const actions = block.actions ?? [];
  const [picker, setPicker] = useState<{ i: number; kind: 'page' | 'db'; el: HTMLElement } | null>(null);
  const dbs = useStore((s) => s.databases);
  const pages = useStore((s) => s.pages);
  const setActions = (fn: (a: ButtonAction[]) => void) => {
    const next = JSON.parse(JSON.stringify(actions)) as ButtonAction[];
    fn(next);
    api.ops.update(block.id, { actions: next });
  };
  return (
    <Popover anchor={anchor} onClose={onClose}>
      <div className="menu button-editor" style={{ width: 380, padding: 12 }}>
        <label className="field-label">Button name</label>
        <input className="input" autoFocus value={htmlToText(block.html)} placeholder="New button" onChange={(e) => api.ops.update(block.id, { html: e.target.value.replace(/</g, '&lt;') }, true)} />
        <label className="field-label" style={{ marginTop: 12 }}>When clicked</label>
        {actions.length === 0 && <div className="faint small" style={{ padding: '4px 0' }}>Add actions to run when this button is clicked.</div>}
        {actions.map((a, i) => {
          const M = ACTION_META[a.kind];
          return (
            <div key={i} className="action-card">
              <div className="row"><M.icon size={14} /><b className="grow">{M.label}</b><button className="icon-btn sm" onClick={() => setActions((x) => x.splice(i, 1))}><Trash2 size={13} /></button></div>
              {a.kind === 'insert_blocks' && (
                <textarea className="input" rows={4} placeholder={'Markdown to insert, e.g.\n## Meeting notes\n- [ ] Action item'} defaultValue={a.blocks ? blocksToMarkdown(a.blocks) : ''}
                  onBlur={(e) => setActions((x) => { x[i].blocks = markdownToBlocks(e.target.value); })} />
              )}
              {a.kind === 'add_page' && (
                <button className="btn btn-outline btn-sm" onClick={(e) => setPicker({ i, kind: 'db', el: e.currentTarget })}>{a.dbId ? (dbs[a.dbId]?.title || pageTitle(pages[dbs[a.dbId]?.pageId])) : 'Select database'}</button>
              )}
              {a.kind === 'open_page' && (
                <button className="btn btn-outline btn-sm" onClick={(e) => setPicker({ i, kind: 'page', el: e.currentTarget })}>{a.pageId ? pageTitle(pages[a.pageId]) : 'Select page (or the page created above)'}</button>
              )}
              {(a.kind === 'notify' || a.kind === 'confirm') && (
                <input className="input" placeholder={a.kind === 'notify' ? 'Notification message' : 'Are you sure?'} defaultValue={a.message} onBlur={(e) => setActions((x) => { x[i].message = e.target.value; })} />
              )}
            </div>
          );
        })}
        <button className="btn btn-sm" onClick={add.open}><Plus size={14} /> Add action</button>
        {add.anchor && <MenuPopover anchor={add.anchor} onClose={add.close} width={220} items={(Object.keys(ACTION_META) as ButtonAction['kind'][]).map((k) => {
          const M = ACTION_META[k];
          return { label: M.label, icon: <M.icon size={16} />, onClick: () => setActions((x) => x.push({ kind: k, blocks: k === 'insert_blocks' ? [newBlock('todo')] : undefined })) };
        })} />}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}><button className="btn btn-primary btn-sm" onClick={onClose}>Done</button></div>
        {picker?.kind === 'page' && <PagePicker anchor={picker.el} onClose={() => setPicker(null)} onPick={(id) => { setActions((x) => { x[picker.i].pageId = id; }); setPicker(null); }} />}
        {picker?.kind === 'db' && <DataSourcePicker anchor={picker.el} onClose={() => setPicker(null)} onPick={(id) => { setActions((x) => { x[picker.i].dbId = id; }); setPicker(null); }} />}
      </div>
    </Popover>
  );
}
