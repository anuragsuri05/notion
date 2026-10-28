import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import {
  Smile, Image as ImageIcon, MessageSquare, Trash2, RotateCcw, ArrowUpRight, Plus, ChevronDown, ChevronRight, Sparkles,
  Table2, Kanban, List, CalendarDays, LayoutGrid, GanttChart, ClipboardList, LayoutTemplate, Upload, FileText, Eye, EyeOff, Lock,
} from 'lucide-react';
import { useStore, backlinks, pageTitle } from '../store/store';
import type { Page } from '../store/types';
import Editor from '../editor/Editor';
import DatabaseView from '../database/DatabaseView';
import { PropertyCell } from '../database/PropValue';
import { PropertyHeaderMenu, PropertySettings, AddPropertyMenu, PropIcon } from '../database/PropertyMenu';
import IconPicker from './IconPicker';
import CoverPicker from './CoverPicker';
import { PageIcon, Popover, ConfirmDialog, Avatar } from './ui';
import { CommentThread, CommentComposer } from './Comments';
import { cx, newBlock, htmlToText } from '../lib/util';
import { goPage, navigate } from '../lib/router';
import { randomEmoji } from '../lib/emoji';
import { setCaret } from '../editor/caret';
import { displayText } from '../database/logic';

/** Shared bus for opening a comment composer from anywhere in the editor. */
export const useCommentBus = create<{ draft: { pageId: string; blockId?: string; threadId: string; quote?: string } | null; focusThread: string | null; set: (d: any) => void; setFocus: (t: string | null) => void }>((set) => ({
  draft: null, focusThread: null, set: (draft) => set({ draft }), setFocus: (focusThread) => set({ focusThread }),
}));

export default function PageView({ pageId, blockAnchor, inPeek }: { pageId: string; blockAnchor?: string; inPeek?: boolean }) {
  const page = useStore((s) => s.pages[pageId]);
  const st = useStore.getState();
  const [hoverHeader, setHoverHeader] = useState(false);
  const [iconPicker, setIconPicker] = useState<HTMLElement | null>(null);
  const [coverPicker, setCoverPicker] = useState<HTMLElement | null>(null);
  const [repositioning, setRepositioning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);

  // open comment composer on request
  useEffect(() => {
    const onComment = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d.pageId !== pageId) return;
      useCommentBus.getState().set(d);
      useStore.setState((s) => { s.panel = 'comments'; });
    };
    const onThread = (e: Event) => {
      useCommentBus.getState().setFocus((e as CustomEvent).detail.threadId);
      useStore.setState((s) => { s.panel = 'comments'; });
    };
    window.addEventListener('moving:comment', onComment);
    window.addEventListener('moving:open-thread', onThread);
    return () => { window.removeEventListener('moving:comment', onComment); window.removeEventListener('moving:open-thread', onThread); };
  }, [pageId]);

  // scroll to block anchor
  useEffect(() => {
    if (!blockAnchor) return;
    setTimeout(() => {
      const el = document.getElementById(`block-${blockAnchor}`);
      if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 2000); }
    }, 100);
  }, [blockAnchor]);

  // keep title DOM in sync
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (el && document.activeElement !== el && el.textContent !== (page?.title ?? '')) el.textContent = page?.title ?? '';
  }, [page?.title]);

  // focus title for brand-new pages
  useEffect(() => {
    if (page && !page.title && Date.now() - page.createdAt < 3000 && !page.isTemplate) titleRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  // snapshot versions periodically while editing
  useEffect(() => {
    const t = setInterval(() => { const p = useStore.getState().pages[pageId]; if (p && Date.now() - p.updatedAt < 60000) useStore.getState().snapshot(pageId); }, 60000);
    return () => { clearInterval(t); useStore.getState().snapshot(pageId); };
  }, [pageId]);

  if (!page) {
    return (
      <div className="page-missing">
        <FileText size={48} strokeWidth={1} className="faint" />
        <h2>This page doesn’t exist</h2>
        <p className="faint">It may have been deleted permanently, or the link is wrong.</p>
        <button className="btn btn-primary" onClick={() => navigate('/home')}>Go home</button>
      </div>
    );
  }

  const readOnly = !!page.locked || !!page.trashedAt;
  const isEmpty = !page.isDb && page.content.length <= 1 && !htmlToText(page.content[0]?.html ?? '') && (page.content[0]?.type ?? 'text') === 'text' && !page.dbId && !page.isTemplate;
  const db = page.dbId ? st.databases[page.dbId] : page.isDb ? st.databases[page.isDb] : null;

  const focusFirstBlock = () => {
    const first = page.content[0];
    if (first && (first.type === 'text' || first.type.startsWith('h') || first.type === 'todo' || first.type === 'bullet') ) {
      const el = document.querySelector<HTMLElement>(`[data-rt="${first.id}"]`);
      if (el) { setCaret(el, 'start'); return; }
    }
    const nb = newBlock();
    st.mutateContent(pageId, (d) => { d.unshift(nb); });
    setTimeout(() => { const el = document.querySelector<HTMLElement>(`[data-rt="${nb.id}"]`); if (el) setCaret(el, 'start'); }, 30);
  };

  const fontCls = page.font === 'serif' ? 'font-serif' : page.font === 'mono' ? 'font-mono' : '';
  const coverPos = page.cover?.pos ?? 50;

  return (
    <div className={cx('page', fontCls, page.smallText && 'small-text', (page.fullWidth || page.isDb) && 'full-width', inPeek && 'in-peek')}>
      {page.trashedAt && (
        <div className="trash-banner">
          This page is in Trash.
          <button className="btn btn-sm btn-outline-light" onClick={() => st.restorePage(pageId)}><RotateCcw size={13} /> Restore page</button>
          <button className="btn btn-sm btn-outline-light" onClick={() => setConfirmDelete(true)}><Trash2 size={13} /> Delete from Trash</button>
        </div>
      )}
      {page.isTemplate && (
        <div className="template-banner">You’re editing a template in <b>{db?.title || pageTitle(st.pages[db?.pageId ?? ''])}</b>. Changes apply to new pages created from it.</div>
      )}
      {page.cover && (
        <div className={cx('cover', repositioning && 'repositioning')}
          style={page.cover.kind === 'color' ? { background: page.cover.value } : undefined}
          onMouseDown={(e) => {
            if (!repositioning) return;
            e.preventDefault();
            const el = e.currentTarget;
            const y0 = e.clientY, p0 = coverPos;
            const move = (ev: MouseEvent) => { const pos = Math.max(0, Math.min(100, p0 - ((ev.clientY - y0) / el.offsetHeight) * 100)); const img = el.querySelector('img'); if (img) img.style.objectPosition = `center ${pos}%`; (el as any)._pos = pos; };
            const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
          }}>
          {page.cover.kind === 'image' && <img src={page.cover.value} alt="" style={{ objectPosition: `center ${coverPos}%` }} draggable={false} />}
          {!readOnly && (
            <div className="cover-actions">
              {repositioning ? (
                <>
                  <button className="cover-btn" onClick={() => { const pos = (document.querySelector('.cover') as any)?._pos; if (pos !== undefined) st.updatePage(pageId, { cover: { ...page.cover!, pos } }); setRepositioning(false); }}>Save position</button>
                  <button className="cover-btn" onClick={() => setRepositioning(false)}>Cancel</button>
                </>
              ) : (
                <>
                  <button className="cover-btn" onClick={(e) => setCoverPicker(e.currentTarget)}>Change cover</button>
                  {page.cover.kind === 'image' && <button className="cover-btn" onClick={() => setRepositioning(true)}>Reposition</button>}
                </>
              )}
            </div>
          )}
          {repositioning && <div className="cover-hint">Drag image to reposition</div>}
        </div>
      )}
      <div className="page-content">
        <div className={cx('page-header', page.cover && 'has-cover', page.icon && 'has-icon')} onMouseEnter={() => setHoverHeader(true)} onMouseLeave={() => setHoverHeader(false)}>
          {page.icon && (
            <button className="page-icon-big" onClick={(e) => !readOnly && setIconPicker(e.currentTarget)}>
              <PageIcon page={page} size={78} />
            </button>
          )}
          {!readOnly && (
            <div className={cx('page-controls', hoverHeader && 'show')}>
              {!page.icon && <button className="btn btn-sm faint-btn" onClick={() => st.updatePage(pageId, { icon: randomEmoji() })}><Smile size={15} /> Add icon</button>}
              {!page.cover && <button className="btn btn-sm faint-btn" onClick={() => st.updatePage(pageId, { cover: { kind: 'color', value: RANDOM_COVERS[Math.floor(Math.random() * RANDOM_COVERS.length)], pos: 50 } })}><ImageIcon size={15} /> Add cover</button>}
              {(page.commentsMode ?? 'expanded') !== 'off' && <button className="btn btn-sm faint-btn" onClick={() => setShowDiscussion(true)}><MessageSquare size={15} /> Add comment</button>}
              {page.isDb && db && <button className="btn btn-sm faint-btn" onClick={() => st.updateDb(db.id, (d) => { d.showDescription = !d.showDescription; })}><FileText size={15} /> {db.showDescription ? 'Hide' : 'Add'} description</button>}
            </div>
          )}
          <div
            ref={titleRef}
            className="page-title"
            contentEditable={!readOnly}
            suppressContentEditableWarning
            data-placeholder={page.isDb ? 'Untitled' : page.isTemplate ? 'Template name' : 'New page'}
            spellCheck={false}
            onInput={(e) => {
              const t = (e.currentTarget.textContent ?? '').replace(/\n/g, '');
              st.updatePage(pageId, { title: t });
              if (page.isDb && db) st.updateDb(db.id, (d) => { d.title = t; });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); if (page.isDb) return; focusFirstBlock(); }
              if (e.key === 'ArrowDown') { e.preventDefault(); focusFirstBlock(); }
            }}
            onPaste={(e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\n/g, ' ')); }}
          />
          {page.locked && <div className="lock-note"><Lock size={12} /> This page is locked. <button className="link-btn" onClick={() => st.updatePage(pageId, { locked: false })}>Unlock</button></div>}
          {page.isDb && db?.showDescription && <input className="db-desc page-db-desc" placeholder="Add a description…" value={db.description ?? ''} onChange={(e) => st.updateDb(db.id, (d) => { d.description = e.target.value; })} />}
        </div>

        {page.dbId && db && <RowProperties page={page} readOnly={readOnly} />}
        <Backlinks pageId={pageId} mode={page.backlinksMode ?? 'popover'} />
        {(page.commentsMode ?? 'expanded') !== 'off' && <PageDiscussion pageId={pageId} forceOpen={showDiscussion} onDone={() => setShowDiscussion(false)} />}
        {page.dbId && <div className="row-divider" />}

        {page.isDb ? (
          <DatabaseView dbId={page.isDb} readOnly={readOnly} />
        ) : (
          <>
            <Editor pageId={pageId} readOnly={readOnly} exitTop={() => { if (titleRef.current) setCaret(titleRef.current, 'end'); }} />
            {isEmpty && !readOnly && <EmptyPageStarter pageId={pageId} />}
          </>
        )}
      </div>
      {iconPicker && (
        <Popover anchor={iconPicker} onClose={() => setIconPicker(null)}>
          <IconPicker onPick={(icon) => { st.updatePage(pageId, { icon: icon ?? undefined }); setIconPicker(null); }} />
        </Popover>
      )}
      {coverPicker && <CoverPicker anchor={coverPicker} onClose={() => setCoverPicker(null)} onPick={(cover) => { st.updatePage(pageId, { cover: cover ?? undefined }); setCoverPicker(null); }} />}
      {confirmDelete && <ConfirmDialog title="Delete this page permanently?" body="This can’t be undone." danger confirm="Delete permanently" onConfirm={() => { st.deleteForever(pageId); navigate('/home'); }} onClose={() => setConfirmDelete(false)} />}
    </div>
  );
}

export const RANDOM_COVERS = [
  'linear-gradient(120deg, #f6d365 0%, #fda085 100%)', 'linear-gradient(120deg, #a1c4fd 0%, #c2e9fb 100%)', 'linear-gradient(120deg, #d4fc79 0%, #96e6a1 100%)',
  'linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)', 'linear-gradient(120deg, #e0c3fc 0%, #8ec5fc 100%)', 'linear-gradient(120deg, #fccb90 0%, #d57eeb 100%)',
  'linear-gradient(120deg, #ff9a9e 0%, #fad0c4 100%)', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)',
];

function RowProperties({ page, readOnly }: { page: Page; readOnly: boolean }) {
  const db = useStore((s) => s.databases[page.dbId!]);
  const fresh = useStore((s) => s.pages[page.id]) ?? page;
  const [hideEmpty, setHideEmpty] = useState(false);
  const [menu, setMenu] = useState<{ propId: string; el: HTMLElement } | null>(null);
  const [settings, setSettings] = useState<{ propId: string; el: HTMLElement } | null>(null);
  const [add, setAdd] = useState<HTMLElement | null>(null);
  if (!db) return null;
  const s = useStore.getState();
  const props = db.properties.filter((p) => p.type !== 'title');
  const visible = hideEmpty ? props.filter((p) => displayText(s, fresh, p) !== '' || p.type === 'checkbox') : props;
  const view = db.views[0];
  return (
    <div className="row-props">
      {visible.map((p) => (
        <div key={p.id} className="row-prop">
          <button className="row-prop-name" title={p.description} onClick={(e) => !readOnly && !db.locked && setMenu({ propId: p.id, el: e.currentTarget })}>
            <PropIcon type={p.type} size={15} /> <span className="ellipsis">{p.name}</span>
          </button>
          <div className="row-prop-value"><PropertyCell page={fresh} prop={p} db={db} readOnly={readOnly} wrap placeholder="Empty" /></div>
        </div>
      ))}
      <div className="row">
        {!readOnly && !db.locked && <button className="btn btn-sm faint-btn" onClick={(e) => setAdd(e.currentTarget)}><Plus size={14} /> Add a property</button>}
        {props.length > 0 && <button className="btn btn-sm faint-btn" onClick={() => setHideEmpty((x) => !x)}>{hideEmpty ? <Eye size={14} /> : <EyeOff size={14} />} {hideEmpty ? 'Show all properties' : 'Hide empty properties'}</button>}
      </div>
      {menu && (
        <Popover anchor={menu.el} onClose={() => setMenu(null)}>
          <PropertyHeaderMenu db={db} view={view} prop={db.properties.find((p) => p.id === menu.propId)!} onClose={() => setMenu(null)} onEdit={() => { setSettings(menu); setMenu(null); }} />
        </Popover>
      )}
      {settings && <PropertySettings db={db} prop={db.properties.find((p) => p.id === settings.propId)!} anchor={settings.el} onClose={() => setSettings(null)} />}
      {add && (
        <Popover anchor={add} onClose={() => setAdd(null)}>
          <AddPropertyMenu db={db} onClose={() => setAdd(null)} onAdded={(id) => { const el = add; setAdd(null); setTimeout(() => setSettings({ propId: id, el }), 0); }} />
        </Popover>
      )}
    </div>
  );
}

function Backlinks({ pageId, mode }: { pageId: string; mode: 'expanded' | 'popover' | 'off' }) {
  const links = useStore((s) => backlinks(s, pageId));
  const [open, setOpen] = useState<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState(mode === 'expanded');
  if (mode === 'off' || !links.length) return null;
  const list = links.map((p) => (
    <button key={p.id} className="backlink" onClick={() => goPage(p.id)}><ArrowUpRight size={13} className="faint" /><PageIcon page={p} size={16} /> {pageTitle(p)}</button>
  ));
  if (mode === 'expanded') {
    return (
      <div className="backlinks">
        <button className="btn btn-sm faint-btn" onClick={() => setExpanded((x) => !x)}>{expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {links.length} backlink{links.length > 1 ? 's' : ''}</button>
        {expanded && <div className="backlink-list">{list}</div>}
      </div>
    );
  }
  return (
    <div className="backlinks">
      <button className="btn btn-sm faint-btn" onClick={(e) => setOpen(e.currentTarget)}><ArrowUpRight size={13} /> {links.length} backlink{links.length > 1 ? 's' : ''}</button>
      {open && <Popover anchor={open} onClose={() => setOpen(null)}><div className="menu" style={{ width: 300, padding: 4 }}>{list}</div></Popover>}
    </div>
  );
}

function PageDiscussion({ pageId, forceOpen, onDone }: { pageId: string; forceOpen: boolean; onDone: () => void }) {
  const threads = useStore((s) => Object.values(s.comments).filter((c) => c.pageId === pageId && !c.blockId && c.threadId === c.id && !c.resolved).sort((a, b) => a.at - b.at));
  const me = useStore((s) => s.users[s.meId]);
  if (!threads.length && !forceOpen) return null;
  return (
    <div className="page-discussion">
      {threads.map((t) => <CommentThread key={t.id} threadId={t.id} compact />)}
      {forceOpen && (
        <div className="row discussion-new">
          <Avatar user={me} size={24} />
          <div className="grow"><CommentComposer pageId={pageId} autoFocus placeholder="Add a comment…" onDone={onDone} /></div>
        </div>
      )}
    </div>
  );
}

function EmptyPageStarter({ pageId }: { pageId: string }) {
  const st = useStore.getState();
  const page = useStore((s) => s.pages[pageId]);
  const toDb = (view: 'table' | 'board' | 'list' | 'calendar' | 'gallery' | 'timeline' | 'form') => {
    const p = useStore.getState().pages[pageId];
    const { dbId } = st.createDatabase({ inline: true, hostPageId: pageId, view, title: p.title });
    // convert the page into a full-page database
    useStore.setState((s) => {
      const pg = s.pages[pageId];
      pg.isDb = dbId;
      pg.content = [];
      s.databases[dbId].inline = false;
    });
  };
  if (!page) return null;
  const items: [React.ReactNode, string, () => void][] = [
    [<Sparkles size={16} />, 'Ask AI', () => { const first = page.content[0]; if (first) window.dispatchEvent(new CustomEvent('moving:ai-block', { detail: { blockId: first.id } })); else st.setPanel('ai'); }],
    [<Table2 size={16} />, 'Table', () => toDb('table')],
    [<Kanban size={16} />, 'Board', () => toDb('board')],
    [<List size={16} />, 'List', () => toDb('list')],
    [<CalendarDays size={16} />, 'Calendar', () => toDb('calendar')],
    [<LayoutGrid size={16} />, 'Gallery', () => toDb('gallery')],
    [<GanttChart size={16} />, 'Timeline', () => toDb('timeline')],
    [<ClipboardList size={16} />, 'Form', () => toDb('form')],
    [<LayoutTemplate size={16} />, 'Templates', () => st.openModal('templates', { into: pageId })],
    [<Upload size={16} />, 'Import', () => st.openModal('import', { into: pageId })],
  ];
  return (
    <div className="empty-starter">
      <div className="faint small">Press Enter to continue with an empty page, or get started with</div>
      <div className="starter-grid">
        {items.map(([icon, label, run]) => <button key={label} className="starter-btn" onClick={run}>{icon} {label}</button>)}
      </div>
    </div>
  );
}

export { useEffect };
