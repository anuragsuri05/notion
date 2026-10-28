import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronsRight, Maximize2, ChevronUp, ChevronDown, Link2, MessageSquare, MoreHorizontal, PanelRight, Square } from 'lucide-react';
import { useStore, dbRows } from '../store/store';
import PageView from './PageView';
import { Tip } from './ui';
import { goPage, pageUrl } from '../lib/router';
import { PageMenu } from './Topbar';
import { cx, mod } from '../lib/util';

export default function Peek() {
  const peek = useStore((s) => s.peek);
  const page = useStore((s) => (peek ? s.pages[peek.pageId] : null));
  const setPeek = useStore((s) => s.setPeek);
  const [more, setMore] = useState<HTMLElement | null>(null);

  const siblings = useStore((s) => (page?.dbId ? dbRows(s, page.dbId).map((p) => p.id) : []));
  const idx = page ? siblings.indexOf(page.id) : -1;

  useEffect(() => {
    if (!peek) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.popover, .modal-overlay') && !(document.activeElement as HTMLElement)?.isContentEditable) setPeek(null);
      if (e.ctrlKey && e.shiftKey && (e.key === 'K' || e.key === 'J')) {
        e.preventDefault();
        const next = siblings[idx + (e.key === 'K' ? -1 : 1)];
        if (next) setPeek({ ...peek, pageId: next });
      }
      if (mod(e) && e.key === 'Enter' && e.shiftKey) { goPage(peek.pageId); setPeek(null); }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [peek, siblings, idx, setPeek]);

  if (!peek || !page) return null;
  const header = (
    <div className="peek-head">
      <Tip label="Close" kbd="Esc"><button className="icon-btn sm" onClick={() => setPeek(null)}><ChevronsRight size={18} /></button></Tip>
      <Tip label="Open as full page"><button className="icon-btn sm" onClick={() => { goPage(page.id); setPeek(null); }}><Maximize2 size={15} /></button></Tip>
      {siblings.length > 0 && <>
        <Tip label="Previous page" kbd="Ctrl+Shift+K"><button className="icon-btn sm" disabled={idx <= 0} onClick={() => setPeek({ ...peek, pageId: siblings[idx - 1] })}><ChevronUp size={16} /></button></Tip>
        <Tip label="Next page" kbd="Ctrl+Shift+J"><button className="icon-btn sm" disabled={idx < 0 || idx >= siblings.length - 1} onClick={() => setPeek({ ...peek, pageId: siblings[idx + 1] })}><ChevronDown size={16} /></button></Tip>
      </>}
      <div className="grow" />
      <Tip label={peek.mode === 'side' ? 'Center peek' : 'Side peek'}><button className="icon-btn sm" onClick={() => setPeek({ ...peek, mode: peek.mode === 'side' ? 'center' : 'side' })}>{peek.mode === 'side' ? <Square size={15} /> : <PanelRight size={15} />}</button></Tip>
      <Tip label="Copy link"><button className="icon-btn sm" onClick={() => { navigator.clipboard.writeText(pageUrl(page.id)); useStore.getState().showToast('Copied link'); }}><Link2 size={15} /></button></Tip>
      <Tip label="Comments"><button className="icon-btn sm" onClick={() => { goPage(page.id); setPeek(null); useStore.getState().setPanel('comments'); }}><MessageSquare size={15} /></button></Tip>
      <button className="icon-btn sm" onClick={(e) => setMore(e.currentTarget)}><MoreHorizontal size={16} /></button>
      {more && <PageMenu pageId={page.id} anchor={more} onClose={() => setMore(null)} />}
    </div>
  );
  const body = <div className="peek-scroll"><PageView key={page.id} pageId={page.id} inPeek /></div>;
  if (peek.mode === 'center') {
    return createPortal(
      <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setPeek(null); }}>
        <div className="center-peek">{header}{body}</div>
      </div>, document.body);
  }
  return <div className={cx('side-peek')}>{header}{body}</div>;
}
