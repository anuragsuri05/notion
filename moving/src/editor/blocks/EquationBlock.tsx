import { useEffect, useRef, useState } from 'react';
import katex from 'katex';
import type { Block } from '../../store/types';
import { useEditor } from '../Editor';
import { Popover } from '../../components/ui';
import { htmlToText, newBlock } from '../../lib/util';

export default function EquationBlock({ block }: { block: Block }) {
  const api = useEditor();
  const tex = htmlToText(block.html);
  const ref = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<HTMLElement | null>(null);
  const [draft, setDraft] = useState(tex);

  useEffect(() => {
    if (!ref.current) return;
    const src = editing ? draft : tex;
    if (!src.trim()) { ref.current.innerHTML = '<span class="eq-empty">√x  Add a TeX equation</span>'; return; }
    katex.render(src, ref.current, { displayMode: true, throwOnError: false });
  }, [tex, draft, editing]);

  // focus requests from the editor open the equation editor
  useEffect(() => {
    if (!tex && !api.readOnly && ref.current) { setDraft(''); setEditing(ref.current); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = () => {
    api.ops.update(block.id, { html: draft.replace(/</g, '&lt;') });
    setEditing(null);
  };

  return (
    <>
      <div className="equation-block" ref={ref} onClick={(e) => { if (!api.readOnly) { setDraft(tex); setEditing(e.currentTarget); } }} />
      {editing && (
        <Popover anchor={editing} onClose={done} placement="bottom-start">
          <div className="menu eq-popover" style={{ width: 420, padding: 10 }}>
            <textarea
              autoFocus data-rt={block.id} className="input mono" rows={3} value={draft} placeholder="|x| = \begin{cases} x, &\quad x \geq 0 \\ -x, &\quad x < 0 \end{cases}"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  done();
                  const n = newBlock();
                  if (!api.ops.nextText(block.id)) { api.ops.insertAfter(block.id, [n]); api.focus(n.id); }
                }
                if (e.key === 'Escape') { e.preventDefault(); done(); }
              }}
            />
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
              <span className="faint small">Shift+Enter for new line</span>
              <button className="btn btn-primary btn-sm" onClick={done}>Done ↵</button>
            </div>
          </div>
        </Popover>
      )}
    </>
  );
}
