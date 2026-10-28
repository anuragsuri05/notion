import { useEffect, useRef, useState } from 'react';
import katex from 'katex';
import { Link2, Bookmark, Square, X, AtSign } from 'lucide-react';
import { Popover, Menu } from '../../components/ui';
import DatePicker from '../../components/DatePicker';
import { useEditor } from '../Editor';
import { useStore } from '../../store/store';
import { newBlock } from '../../lib/util';
import { prettyDate } from '../RichText';

export function DateMentionPopover({ el, onClose, pageId }: { el: HTMLElement; onClose: () => void; pageId: string }) {
  const iso = el.dataset.date ?? '';
  const time = el.dataset.time === '1';
  const remind = el.classList.contains('remind');
  return (
    <Popover anchor={el} onClose={onClose}>
      <DatePicker
        value={{ start: iso, time }}
        allowRange={false}
        remind={remind}
        onRemind={(v) => {
          el.classList.toggle('remind', v);
          if (v) {
            const at = new Date(iso.length > 10 ? iso : iso + 'T09:00').getTime();
            useStore.getState().addReminder({ pageId, at, text: el.closest('[data-rt]')?.textContent?.trim() || 'Reminder' });
          }
        }}
        onChange={(v) => {
          if (!v?.start) { el.remove(); onClose(); return; }
          el.dataset.date = v.start;
          el.dataset.time = v.time ? '1' : '0';
          el.textContent = '@' + prettyDate(v.start, !!v.time);
        }}
      />
    </Popover>
  );
}

export function EquationPopover({ el, onClose }: { el: HTMLElement; onClose: () => void }) {
  const [tex, setTex] = useState(el.dataset.tex ?? '');
  const prev = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (prev.current) katex.render(tex || '\\text{…}', prev.current, { throwOnError: false });
  }, [tex]);
  const done = () => {
    if (!tex.trim()) el.remove();
    else { el.dataset.tex = tex; delete el.dataset.rendered; katex.render(tex, el, { throwOnError: false }); el.dataset.rendered = tex; }
    onClose();
  };
  return (
    <Popover anchor={el} onClose={done}>
      <div className="menu eq-popover" style={{ width: 360, padding: 10 }}>
        <textarea autoFocus className="input mono" rows={2} value={tex} placeholder="E = mc^2" onChange={(e) => setTex(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); done(); } }} />
        <div ref={prev} className="eq-preview" />
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <a className="faint small" href="https://katex.org/docs/supported.html" target="_blank" rel="noreferrer">KaTeX syntax help</a>
          <button className="btn btn-primary btn-sm" onClick={done}>Done ↵</button>
        </div>
      </div>
    </Popover>
  );
}

export function PastePopover({ url, rect, blockId, onClose }: { url: string; rect: DOMRect; blockId: string; onClose: () => void }) {
  const api = useEditor();
  const asBlock = (type: 'bookmark' | 'embed' | 'video' | 'image') => {
    // remove the pasted link text from the block, then insert a media block
    const el = document.querySelector<HTMLElement>(`[data-rt="${blockId}"]`);
    if (el) {
      el.querySelectorAll(`a[href="${CSS.escape(url)}"]`).forEach((a) => a.remove());
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const b = newBlock(type, { url });
    const cur = api.ops.block(blockId);
    if (cur && cur.type === 'text' && !(el?.textContent ?? '').trim()) {
      api.ops.mutate((d) => {
        const f = (l: typeof d): boolean => { for (let i = 0; i < l.length; i++) { if (l[i].id === blockId) { l[i] = { ...b, id: blockId }; return true; } if (l[i].children && f(l[i].children!)) return true; } return false; };
        f(d);
      });
    } else api.ops.insertAfter(blockId, [b]);
    onClose();
  };
  const isVideo = /youtube\.com|youtu\.be|vimeo\.com|loom\.com/.test(url);
  const isImage = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url);
  return (
    <Popover anchor={rect} onClose={onClose}>
      <Menu width={220} onClose={onClose} items={[
        { label: 'Dismiss', icon: <X size={16} />, onClick: () => {} },
        { label: 'Mention', icon: <AtSign size={16} />, onClick: () => {} },
        { label: 'URL', icon: <Link2 size={16} />, onClick: () => {} },
        { label: 'Bookmark', icon: <Bookmark size={16} />, onClick: () => asBlock('bookmark') },
        { label: isImage ? 'Image' : isVideo ? 'Video embed' : 'Embed', icon: <Square size={16} />, onClick: () => asBlock(isImage ? 'image' : isVideo ? 'video' : 'embed') },
      ]} />
    </Popover>
  );
}
