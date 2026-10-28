import { useEffect, useRef, useState } from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-diff';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-graphql';
import 'prismjs/components/prism-latex';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-toml';
import { ChevronDown, Copy, Check, WrapText, MessageSquare } from 'lucide-react';
import type { Block } from '../../store/types';
import { useEditor } from '../Editor';
import { CODE_LANGUAGES } from '../blockTypes';
import { MenuPopover, useAnchor, Tip } from '../../components/ui';
import { escapeHtml, htmlToText, cx, mod, newBlock, uid } from '../../lib/util';

const PRISM_ALIAS: Record<string, string> = {
  'plain text': 'plain', shell: 'bash', 'c#': 'csharp', 'c++': 'cpp', html: 'markup', xml: 'markup', docker: 'docker', 'objective-c': 'c', 'vb.net': 'plain',
};

export default function CodeBlock({ block }: { block: Block }) {
  const api = useEditor();
  const code = htmlToText(block.html);
  const [value, setValue] = useState(code);
  const [copied, setCopied] = useState(false);
  const lang = useAnchor();
  const typing = useRef(false);
  const lastSent = useRef(code);

  useEffect(() => { if (code !== lastSent.current) { setValue(code); lastSent.current = code; } }, [code]);

  const change = (v: string) => {
    setValue(v);
    lastSent.current = v;
    typing.current = true;
    api.ops.update(block.id, { html: escapeHtml(v) }, true);
  };

  const langKey = PRISM_ALIAS[block.language ?? ''] ?? block.language ?? 'plain';
  const highlight = (src: string) => {
    const g = Prism.languages[langKey];
    return g ? Prism.highlight(src, g, langKey) : escapeHtml(src);
  };

  const onKeyDown = (e: React.KeyboardEvent<any>) => {
    const ta = e.target as HTMLTextAreaElement;
    if (e.key === 'Escape') { e.preventDefault(); api.select([block.id]); return; }
    if (e.key === 'ArrowUp' && ta.selectionStart === 0) { const p = api.ops.prevText(block.id, api.rootId); if (p) { e.preventDefault(); api.focus(p.id, 'end'); } return; }
    if (e.key === 'ArrowDown' && ta.selectionEnd === ta.value.length) {
      e.preventDefault();
      const n = api.ops.nextText(block.id, api.rootId);
      if (n) api.focus(n.id, 'start');
      else { const nb = newBlock(); api.ops.insertAfter(block.id, [nb]); api.focus(nb.id); }
      return;
    }
    if (e.key === 'Backspace' && !ta.value) { e.preventDefault(); api.ops.turnInto(block.id, 'text'); api.focus(block.id, 'start'); return; }
    if (mod(e) && e.key === 'Enter') { e.preventDefault(); const nb = newBlock(); api.ops.insertAfter(block.id, [nb]); api.focus(nb.id); return; }
    if (mod(e) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? api.redo() : api.undo(); }
  };

  return (
    <div className={cx('code-block', block.wrap && 'wrap')}>
      <div className="code-toolbar" contentEditable={false}>
        <button className="btn btn-sm code-lang" onClick={lang.open} disabled={api.readOnly}>{block.language ?? 'plain text'}<ChevronDown size={12} /></button>
        <div className="grow" />
        <Tip label="Wrap code"><button className={cx('icon-btn sm', block.wrap && 'active')} onClick={() => api.ops.update(block.id, { wrap: !block.wrap })}><WrapText size={14} /></button></Tip>
        <Tip label="Comment"><button className="icon-btn sm" onClick={() => window.dispatchEvent(new CustomEvent('moving:comment', { detail: { pageId: api.pageId, blockId: block.id, threadId: uid(), quote: '' } }))}><MessageSquare size={14} /></button></Tip>
        <button className="btn btn-sm" onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copied' : 'Copy'}</button>
      </div>
      {block.language === 'mermaid' && <MermaidPreview code={value} />}
      <Editor
        value={value}
        onValueChange={change}
        highlight={highlight}
        padding={0}
        className="code-editor"
        textareaClassName="code-textarea"
        readOnly={api.readOnly}
        onKeyDown={onKeyDown}
        textareaId={`code-${block.id}`}
        placeholder=""
        style={{ fontFamily: 'var(--code-font)', fontSize: 13.6, lineHeight: 1.6, whiteSpace: block.wrap ? 'pre-wrap' : 'pre' }}
      />
      <CodeTextareaTag id={block.id} />
      {block.caption !== undefined && (
        <input className="caption-input" value={block.caption} placeholder="Write a caption…" onChange={(e) => api.ops.update(block.id, { caption: e.target.value }, true)} />
      )}
      {lang.anchor && (
        <MenuPopover anchor={lang.anchor} onClose={lang.close} searchable placeholder="Search for a language…" width={220}
          items={CODE_LANGUAGES.map((l) => ({ label: l, checked: l === block.language, onClick: () => api.ops.update(block.id, { language: l }) }))} />
      )}
    </div>
  );
}

/** Tag the inner textarea with data-rt so the editor's focus system can find it. */
function CodeTextareaTag({ id }: { id: string }) {
  useEffect(() => {
    const ta = document.getElementById(`code-${id}`);
    ta?.setAttribute('data-rt', id);
  });
  return null;
}

function MermaidPreview({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default' });
        const { svg } = await mermaid.render(`m${Math.random().toString(36).slice(2)}`, code || 'graph TD; A-->B');
        if (!cancelled && ref.current) { ref.current.innerHTML = svg; setErr(''); }
      } catch (e) { if (!cancelled) setErr(String((e as Error).message ?? e).slice(0, 200)); }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [code]);
  return (
    <div className="mermaid-preview" contentEditable={false}>
      <div ref={ref} />
      {err && <div className="faint small">{err}</div>}
    </div>
  );
}
