import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bold, Italic, Underline, Strikethrough, Code, Link2, MessageSquare, Sigma, ChevronDown, Sparkles, AtSign, MoreHorizontal, Trash2, ArrowUpRight } from 'lucide-react';
import { getSel } from '../caret';
import { toggleMark, isMarkActive, applyColor, applyLink, currentLink, selectionToEquation, wrapComment, type Mark } from '../formatting';
import { useEditor } from '../Editor';
import { Popover, Tip, PageIcon, Menu } from '../../components/ui';
import { TURN_INTO } from '../blockTypes';
import { COLORS, type Color } from '../../store/types';
import { cx, MOD, SHIFT, uid, fuzzy } from '../../lib/util';
import { useStore, pageTitle } from '../../store/store';
import { goPage } from '../../lib/router';

export default function InlineToolbar({ rootRef }: { rootRef: React.RefObject<HTMLDivElement> }) {
  const api = useEditor();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [sub, setSub] = useState<null | 'turn' | 'color' | 'link' | 'more'>(null);
  const [, force] = useState(0);
  const saved = useRef<Range | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const mouseDown = useRef(false);

  useEffect(() => {
    const update = () => {
      if (sub === 'link') return;
      const sel = getSel();
      if (!sel || sel.isCollapsed || !sel.rangeCount || mouseDown.current) { if (!sub) setRect(null); return; }
      const range = sel.getRangeAt(0);
      const rt = (range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer as HTMLElement : range.commonAncestorContainer.parentElement)?.closest('[data-rt]') as HTMLElement | null;
      if (!rt || !rootRef.current?.contains(rt) || rt.closest('.code-editor')) { if (!sub) setRect(null); return; }
      if (!range.toString().trim()) { setRect(null); return; }
      saved.current = range.cloneRange();
      setBlockId(rt.dataset.rt!);
      setRect(range.getBoundingClientRect());
      force((x) => x + 1);
    };
    const down = (e: MouseEvent) => { if (!barRef.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest('.popover')) { mouseDown.current = true; setRect(null); setSub(null); } };
    const up = () => { mouseDown.current = false; setTimeout(update, 0); };
    const onLink = () => { update(); setSub('link'); };
    document.addEventListener('selectionchange', update);
    document.addEventListener('mousedown', down);
    document.addEventListener('mouseup', up);
    window.addEventListener('moving:link', onLink);
    return () => {
      document.removeEventListener('selectionchange', update);
      document.removeEventListener('mousedown', down);
      document.removeEventListener('mouseup', up);
      window.removeEventListener('moving:link', onLink);
    };
  }, [rootRef, sub]);

  const restore = () => {
    const r = saved.current;
    if (!r) return;
    const el = (r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer as HTMLElement : r.commonAncestorContainer.parentElement)?.closest('[data-rt]') as HTMLElement | null;
    el?.focus({ preventScroll: true });
    const sel = getSel()!;
    sel.removeAllRanges();
    sel.addRange(r);
  };

  if (!rect || !blockId) return null;
  const block = api.ops.block(blockId);
  if (!block) return null;
  const top = rect.top - 44 < 60 ? rect.bottom + 8 : rect.top - 44;
  const left = Math.max(8, Math.min(rect.left + rect.width / 2 - 230, window.innerWidth - 480));

  const mark = (m: Mark, label: string, kbd: string, Icon: typeof Bold) => (
    <Tip label={label} kbd={kbd} side="top">
      <button className={cx('tb-btn', isMarkActive(m) && 'on')} onMouseDown={(e) => { e.preventDefault(); toggleMark(m); force((x) => x + 1); }}><Icon size={16} /></button>
    </Tip>
  );
  const typeLabel = TURN_INTO.find((t) => t.type === block.type)?.label ?? 'Text';

  return createPortal(
    <>
      <div ref={barRef} className="inline-toolbar" style={{ top, left }} onMouseDown={(e) => e.preventDefault()}>
        <button className="tb-btn tb-ai" onMouseDown={(e) => { e.preventDefault(); api.openAI(blockId, 'edit'); setRect(null); }}><Sparkles size={15} /> Ask AI</button>
        <div className="tb-sep" />
        <button className="tb-btn tb-text" onMouseDown={(e) => { e.preventDefault(); setSub(sub === 'turn' ? null : 'turn'); }}>{typeLabel}<ChevronDown size={12} /></button>
        <div className="tb-sep" />
        <Tip label="Add link" kbd={`${MOD}K`} side="top"><button className={cx('tb-btn', currentLink() && 'on')} onMouseDown={(e) => { e.preventDefault(); setSub('link'); }}><Link2 size={16} /> </button></Tip>
        <Tip label="Comment" kbd={`${MOD}${SHIFT}M`} side="top">
          <button className="tb-btn" onMouseDown={(e) => {
            e.preventDefault();
            const thread = uid();
            const quote = wrapComment(thread);
            window.dispatchEvent(new CustomEvent('moving:comment', { detail: { pageId: api.pageId, blockId, threadId: thread, quote } }));
            setRect(null);
          }}><MessageSquare size={16} /></button>
        </Tip>
        <div className="tb-sep" />
        {mark('bold', 'Bold', `${MOD}B`, Bold)}
        {mark('italic', 'Italicize', `${MOD}I`, Italic)}
        {mark('underline', 'Underline', `${MOD}U`, Underline)}
        {mark('strike', 'Strike-through', `${MOD}${SHIFT}S`, Strikethrough)}
        {mark('code', 'Mark as code', `${MOD}E`, Code)}
        <Tip label="Create equation" kbd={`${MOD}${SHIFT}E`} side="top"><button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); selectionToEquation(); setRect(null); }}><Sigma size={16} /></button></Tip>
        <Tip label="Text color" kbd={`${MOD}${SHIFT}H`} side="top"><button className="tb-btn tb-color" onMouseDown={(e) => { e.preventDefault(); setSub(sub === 'color' ? null : 'color'); }}>A<ChevronDown size={12} /></button></Tip>
        <Tip label="Mention" side="top"><button className="tb-btn" onMouseDown={(e) => {
          e.preventDefault();
          const sel = getSel();
          sel?.collapseToEnd();
          const rt = document.querySelector<HTMLElement>(`[data-rt="${blockId}"]`);
          if (rt) { const len = rt.textContent?.length ?? 0; api.openMenu({ kind: 'mention', blockId, start: len, trig: 0, query: '', rect }); }
          setRect(null);
        }}><AtSign size={16} /></button></Tip>
        <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); setSub(sub === 'more' ? null : 'more'); }}><MoreHorizontal size={16} /></button>
      </div>
      {sub === 'turn' && (
        <Popover anchor={new DOMRect(left + 90, top + 34, 0, 0)} onClose={() => setSub(null)}>
          <Menu width={220} onClose={() => setSub(null)} items={[{ header: 'Turn into' }, ...TURN_INTO.map((t) => ({
            label: t.label, icon: <span className="turn-icon">{t.icon}</span>, checked: t.type === block.type,
            onClick: () => {
              if (t.type === 'page') { const pid = api.ops.turnIntoPage(blockId); if (pid) goPage(pid); return; }
              api.ops.turnInto(blockId, t.type); setRect(null);
            },
          }))]} />
        </Popover>
      )}
      {sub === 'color' && (
        <Popover anchor={new DOMRect(left + 330, top + 34, 0, 0)} onClose={() => setSub(null)}>
          <ColorMenu onPick={(c, kind) => { restore(); applyColor(c, kind); setSub(null); }} />
        </Popover>
      )}
      {sub === 'more' && (
        <Popover anchor={new DOMRect(left + 440, top + 34, 0, 0)} onClose={() => setSub(null)}>
          <Menu width={220} onClose={() => setSub(null)} items={[
            { label: 'Copy link to block', onClick: () => { navigator.clipboard.writeText(`${location.origin}${location.pathname}#/page/${api.pageId}#${blockId}`); useStore.getState().showToast('Copied link to block'); } },
            { label: 'Copy as plain text', onClick: () => { navigator.clipboard.writeText(getSel()?.toString() ?? ''); } },
            { label: 'Clear formatting', onClick: () => { restore(); document.execCommand('removeFormat'); applyColor('default', 'text'); applyColor('default', 'bg'); applyLink(null); } },
          ]} />
        </Popover>
      )}
      {sub === 'link' && <LinkPopover rect={rect} onClose={() => { setSub(null); }} restore={restore} />}
    </>,
    document.body,
  );
}

export function ColorMenu({ onPick }: { onPick: (c: Color, kind: 'text' | 'bg') => void }) {
  return (
    <div className="menu" style={{ width: 220 }}>
      <div className="menu-list">
        <div className="menu-header">Text color</div>
        {COLORS.map((c) => (
          <div key={'t' + c} className="menu-item" onMouseDown={(e) => { e.preventDefault(); onPick(c, 'text'); }}>
            <span className="swatch" style={{ color: c === 'default' ? 'var(--text)' : `var(--c-${c})` }}>A</span>
            <span className="menu-label">{c === 'default' ? 'Default text' : c[0].toUpperCase() + c.slice(1) + ' text'}</span>
          </div>
        ))}
        <div className="menu-header">Background color</div>
        {COLORS.map((c) => (
          <div key={'b' + c} className="menu-item" onMouseDown={(e) => { e.preventDefault(); onPick(c, 'bg'); }}>
            <span className={cx('swatch', c !== 'default' && `bg-${c}`)}>A</span>
            <span className="menu-label">{c === 'default' ? 'Default background' : c[0].toUpperCase() + c.slice(1) + ' background'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LinkPopover({ rect, onClose, restore }: { rect: DOMRect; onClose: () => void; restore: () => void }) {
  const [value, setValue] = useState(() => { const l = currentLink(); return l ?? ''; });
  const pages = useStore((s) => s.pages);
  const wsId = useStore((s) => s.wsId);
  const results = value && !/^https?:|^www\.|^mailto:/.test(value)
    ? Object.values(pages).filter((p) => p.wsId === wsId && !p.trashedAt && fuzzy(value, p.title)).slice(0, 6) : [];
  const apply = (href: string | null) => {
    restore();
    applyLink(href);
    onClose();
  };
  return (
    <Popover anchor={new DOMRect(rect.left, rect.bottom, rect.width, 0)} onClose={onClose}>
      <div className="menu" style={{ width: 340, padding: 8 }}>
        <input
          autoFocus className="input" placeholder="Paste link or search pages" value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (results[0] && !/^https?:/.test(value)) apply(`#/page/${results[0].id}`);
              else if (value.trim()) apply(/^(https?:|mailto:|#)/.test(value) ? value.trim() : `https://${value.trim()}`);
            }
          }}
        />
        {results.length > 0 && <div className="menu-header">Link to page</div>}
        {results.map((p) => (
          <div key={p.id} className="menu-item" onClick={() => apply(`#/page/${p.id}`)}>
            <span className="menu-icon"><PageIcon page={p} size={18} /></span><span className="menu-label">{pageTitle(p)}</span>
          </div>
        ))}
        {value && /^(https?:|www\.)/.test(value) && (
          <div className="menu-item" onClick={() => apply(value.startsWith('www.') ? `https://${value}` : value)}><span className="menu-icon"><ArrowUpRight size={16} /></span><span className="menu-label ellipsis">{value}</span><span className="faint small">Link to web page</span></div>
        )}
        {currentLink() && <div className="menu-item danger" onClick={() => apply(null)}><span className="menu-icon"><Trash2 size={16} /></span><span className="menu-label">Remove link</span></div>}
      </div>
    </Popover>
  );
}
