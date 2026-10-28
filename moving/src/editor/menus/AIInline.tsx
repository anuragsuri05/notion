import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, ArrowUp, Check, RotateCcw, X, CornerDownLeft, Copy, ListPlus } from 'lucide-react';
import { useEditor } from '../Editor';
import { Popover, Menu, type MenuItemDef } from '../../components/ui';
import { streamText, AI_PROMPTS, AIKeyMissing } from '../../lib/ai';
import { blocksToMarkdown, markdownToBlocks } from '../../lib/markdown';
import { useStore, pageTitle } from '../../store/store';
import { htmlToText } from '../../lib/util';
import { getSel } from '../caret';

const LANGS = ['English', 'Hindi', 'Spanish', 'French', 'German', 'Portuguese', 'Japanese', 'Korean', 'Chinese (Simplified)', 'Italian', 'Russian', 'Arabic'];

export default function AIInline({ blockId, mode, onClose }: { blockId: string; mode?: string; onClose: () => void }) {
  const api = useEditor();
  const [q, setQ] = useState('');
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const lastRun = useRef<{ prompt: string; input?: string } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const anchor = useMemo(() => {
    const el = document.querySelector(`[data-block="${blockId}"]`) as HTMLElement | null;
    const r = el?.getBoundingClientRect();
    return r ? new DOMRect(r.left, r.bottom, Math.max(r.width, 560), 0) : new DOMRect(300, 300, 0, 0);
  }, [blockId]);
  const selectionText = useMemo(() => getSel()?.toString() ?? '', []);
  const block = api.ops.block(blockId);
  const editing = mode === 'edit';
  const inputText = selectionText || (block ? htmlToText(block.html) : '');

  const pageMarkdown = () => {
    const s = useStore.getState();
    const p = s.pages[api.pageId];
    return `# ${pageTitle(p)}\n\n${blocksToMarkdown(api.ops.content(), (id) => pageTitle(s.pages[id]))}`;
  };

  const run = async (prompt: string, input?: string) => {
    lastRun.current = { prompt, input };
    abort.current?.abort();
    abort.current = new AbortController();
    setStatus('running');
    setOutput('');
    setError('');
    try {
      const context = input !== undefined ? undefined : pageMarkdown();
      const full = input !== undefined ? `${prompt}\n\n<text>\n${input}\n</text>` : prompt;
      await streamText({ prompt: full, context, onText: setOutput, signal: abort.current.signal });
      setStatus('done');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError(e instanceof AIKeyMissing ? e.message : `AI error: ${(e as Error).message}`);
      setStatus('error');
    }
  };

  useEffect(() => {
    if (mode && AI_PROMPTS[mode]) run(AI_PROMPTS[mode]);
    return () => abort.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const insertBelow = () => {
    const blocks = markdownToBlocks(output);
    const cur = api.ops.block(blockId);
    if (cur && cur.type === 'text' && !htmlToText(cur.html).trim()) {
      api.ops.mutate((d) => {
        const f = (l: typeof d): boolean => { for (let i = 0; i < l.length; i++) { if (l[i].id === blockId) { l.splice(i, 1, ...blocks); return true; } if (l[i].children && f(l[i].children!)) return true; } return false; };
        f(d);
      });
    } else api.ops.insertAfter(blockId, blocks);
    api.focus(blocks[blocks.length - 1].id, 'end');
    onClose();
  };

  const replace = () => {
    const blocks = markdownToBlocks(output);
    if (blocks.length === 1 && (blocks[0].type === 'text')) api.ops.update(blockId, { html: blocks[0].html });
    else api.ops.mutate((d) => {
      const f = (l: typeof d): boolean => { for (let i = 0; i < l.length; i++) { if (l[i].id === blockId) { l.splice(i, 1, ...blocks); return true; } if (l[i].children && f(l[i].children!)) return true; } return false; };
      f(d);
    });
    onClose();
  };

  const suggestions: MenuItemDef[] = editing ? [
    { header: 'Edit or review selection' },
    { label: 'Improve writing', icon: <Sparkles size={16} />, onClick: () => run(AI_PROMPTS.improve, inputText), keepOpen: true },
    { label: 'Fix spelling & grammar', icon: <Check size={16} />, onClick: () => run(AI_PROMPTS.fix, inputText), keepOpen: true },
    { label: 'Make shorter', icon: <Sparkles size={16} />, onClick: () => run(AI_PROMPTS.shorter, inputText), keepOpen: true },
    { label: 'Make longer', icon: <Sparkles size={16} />, onClick: () => run(AI_PROMPTS.longer, inputText), keepOpen: true },
    { label: 'Simplify language', icon: <Sparkles size={16} />, onClick: () => run(AI_PROMPTS.simplify, inputText), keepOpen: true },
    { label: 'Change tone', icon: <Sparkles size={16} />, submenu: [
      { label: 'Professional', onClick: () => run(AI_PROMPTS.professional, inputText) },
      { label: 'Casual', onClick: () => run(AI_PROMPTS.casual, inputText) },
      { label: 'Straightforward', onClick: () => run('Rewrite the text to be direct and straightforward. Output only the result.', inputText) },
      { label: 'Confident', onClick: () => run('Rewrite the text in a confident tone. Output only the result.', inputText) },
      { label: 'Friendly', onClick: () => run('Rewrite the text in a warm, friendly tone. Output only the result.', inputText) },
    ] },
    { label: 'Translate', icon: <Sparkles size={16} />, submenu: LANGS.map((l) => ({ label: l, onClick: () => run(AI_PROMPTS.translate.replace('{lang}', l), inputText) })) },
    { label: 'Explain this', icon: <Sparkles size={16} />, onClick: () => run(AI_PROMPTS.explain, inputText), keepOpen: true },
  ] : [
    { header: 'Write with AI' },
    { label: 'Continue writing', icon: <Sparkles size={16} />, onClick: () => run(AI_PROMPTS.ai_continue), keepOpen: true },
    { label: 'Summarize page', icon: <Sparkles size={16} />, onClick: () => run(AI_PROMPTS.ai_summary), keepOpen: true },
    { label: 'Find action items', icon: <Sparkles size={16} />, onClick: () => run(AI_PROMPTS.ai_actions), keepOpen: true },
    { header: 'Draft' },
    { label: 'Brainstorm ideas…', icon: <Sparkles size={16} />, onClick: () => setQ('Brainstorm ideas on '), keepOpen: true },
    { label: 'Outline…', icon: <Sparkles size={16} />, onClick: () => setQ('Write an outline about '), keepOpen: true },
    { label: 'Meeting agenda…', icon: <Sparkles size={16} />, onClick: () => setQ('Write a meeting agenda for '), keepOpen: true },
    { label: 'Blog post…', icon: <Sparkles size={16} />, onClick: () => setQ('Write a blog post about '), keepOpen: true },
    { label: 'Pros and cons list…', icon: <Sparkles size={16} />, onClick: () => setQ('Write a pros and cons list for '), keepOpen: true },
    { label: 'Translate page', icon: <Sparkles size={16} />, submenu: LANGS.map((l) => ({ label: l, onClick: () => run(`Translate the whole page to ${l}. Output only the translation in Markdown.`) })) },
  ];

  return (
    <Popover anchor={anchor} onClose={() => { if (status !== 'running') onClose(); }} width={Math.min(anchor.width, 680)}>
      <div className="ai-inline">
        {(output || status === 'running') && (
          <div className="ai-output">
            {output ? <div className="ai-output-text">{output}</div> : <div className="faint">Moving AI is writing…</div>}
          </div>
        )}
        {error && <div className="ai-error">{error} {error.includes('Settings') && <button className="btn btn-sm btn-outline" onClick={() => { onClose(); useStore.getState().openModal('settings', 'ai'); }}>Open settings</button>}</div>}
        <div className="ai-input-row">
          <Sparkles size={18} className="ai-spark" />
          <input
            autoFocus
            className="ai-input"
            placeholder={status === 'done' ? 'Tell AI what to do next…' : editing ? 'Ask AI to edit or generate…' : 'Ask AI anything…'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && q.trim()) {
                e.preventDefault();
                const prompt = status === 'done' && output ? `${q}\n\nPrevious draft:\n${output}` : q;
                run(prompt, editing ? inputText : undefined);
                setQ('');
              }
              if (e.key === 'Escape') { abort.current?.abort(); onClose(); }
            }}
          />
          {status === 'running'
            ? <button className="btn btn-sm btn-outline" onClick={() => { abort.current?.abort(); setStatus('done'); }}>Stop</button>
            : <button className="icon-btn ai-send" disabled={!q.trim()} onClick={() => { if (q.trim()) { run(q, editing ? inputText : undefined); setQ(''); } }}><ArrowUp size={16} /></button>}
        </div>
        {status === 'idle' && !q && <div className="ai-menu"><Menu items={suggestions} onClose={() => {}} width={260} /></div>}
        {status === 'done' && output && (
          <div className="ai-menu">
            <Menu width={260} onClose={() => {}} items={[
              ...(editing ? [{ label: 'Replace selection', icon: <Check size={16} />, onClick: replace }] : []),
              { label: 'Insert below', icon: <ListPlus size={16} />, onClick: insertBelow },
              { label: 'Copy', icon: <Copy size={16} />, onClick: () => { navigator.clipboard.writeText(output); useStore.getState().showToast('Copied'); }, keepOpen: true },
              { label: 'Try again', icon: <RotateCcw size={16} />, onClick: () => lastRun.current && run(lastRun.current.prompt, lastRun.current.input), keepOpen: true },
              { label: 'Discard', icon: <X size={16} />, onClick: onClose },
            ]} />
          </div>
        )}
        <div className="ai-foot faint small"><CornerDownLeft size={11} /> AI responses can be inaccurate. Uses your Anthropic key · {useStore.getState().settings.aiModel}</div>
      </div>
    </Popover>
  );
}
