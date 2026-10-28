import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Sparkles, Plus, History, Wrench, Square, Copy, FilePlus, Trash2, Settings } from 'lucide-react';
import { useStore, pageTitle } from '../../store/store';
import type { AIChat as Chat } from '../../store/types';
import { runAgent, AIKeyMissing, AI_MODELS } from '../../lib/ai';
import { blocksToMarkdown, markdownToBlocks, inlineMdToHtml } from '../../lib/markdown';
import { MenuPopover, PageIcon } from '../ui';
import { uid, timeAgo, cx, escapeHtml } from '../../lib/util';
import { goPage, navigate } from '../../lib/router';

const SUGGESTIONS = [
  'Summarize this page',
  'What are my open tasks?',
  'Draft a project kickoff doc',
  'Find pages about onboarding',
  'Write a weekly update from my recent pages',
];

export default function AIChat({ pageId, chatId, compact }: { pageId?: string; chatId?: string; compact?: boolean }) {
  const s = useStore();
  const [id, setId] = useState<string>(chatId ?? '');
  const chat: Chat | undefined = id ? s.aiChats[id] : undefined;
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<{ text: string; tools: string[] } | null>(null);
  const [error, setError] = useState('');
  const [hist, setHist] = useState<HTMLElement | null>(null);
  const [modelMenu, setModelMenu] = useState<HTMLElement | null>(null);
  const abort = useRef<AbortController | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const page = pageId ? s.pages[pageId] : undefined;

  useEffect(() => { if (chatId) setId(chatId); }, [chatId]);
  useEffect(() => { scroll.current?.scrollTo({ top: 1e9 }); }, [chat?.messages.length, live?.text]);
  useEffect(() => {
    const onPrompt = (e: Event) => send((e as CustomEvent).detail);
    window.addEventListener('moving:ai-prompt', onPrompt);
    return () => window.removeEventListener('moving:ai-prompt', onPrompt);
  });

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setError('');
    const now = Date.now();
    const base: Chat = chat ? JSON.parse(JSON.stringify(chat)) : { id: uid(), title: text.slice(0, 60), at: now, messages: [] };
    base.messages.push({ role: 'user', content: text, at: now });
    base.at = now;
    s.saveChat(base);
    setId(base.id);
    setInput('');
    setBusy(true);
    setLive({ text: '', tools: [] });
    abort.current = new AbortController();
    const tools: string[] = [];
    let acc = '';
    try {
      const ctx = page && !page.isDb ? `# ${pageTitle(page)}\n\n${blocksToMarkdown(page.content, (pid) => pageTitle(s.pages[pid]))}` : undefined;
      const out = await runAgent(base.messages.map((m) => ({ role: m.role, content: m.content })), {
        pageContext: ctx,
        signal: abort.current.signal,
        onEvent: (e) => { if (e.kind === 'tool') tools.push(e.text); else acc = e.text; setLive({ text: acc, tools: [...tools] }); },
      });
      const fresh = JSON.parse(JSON.stringify(useStore.getState().aiChats[base.id])) as Chat;
      fresh.messages.push({ role: 'assistant', content: (tools.length ? tools.map((t) => `> 🔧 ${t}`).join('\n') + '\n\n' : '') + out, at: Date.now() });
      s.saveChat(fresh);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(e instanceof AIKeyMissing ? e.message : `AI error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      setLive(null);
    }
  };

  const insertIntoPage = (md: string) => {
    if (!pageId || !page || page.isDb) { const nid = s.createPage({ title: 'AI draft', icon: '✨', content: markdownToBlocks(md) }); goPage(nid); return; }
    s.mutateContent(pageId, (d) => { d.push(...markdownToBlocks(md)); });
    s.showToast('Added to page');
  };

  const chats = Object.values(s.aiChats).sort((a, b) => b.at - a.at);
  const modelLabel = AI_MODELS.find((m) => m.id === s.settings.aiModel)?.label ?? s.settings.aiModel;

  return (
    <div className={cx('ai-chat', compact && 'compact')}>
      <div className="panel-head">
        <Sparkles size={16} className="ai-spark" /><b>Moving AI</b>
        <div className="grow" />
        <button className="icon-btn sm" title="New chat" onClick={() => { setId(''); setError(''); }}><Plus size={15} /></button>
        <button className="icon-btn sm" title="Chat history" onClick={(e) => setHist(e.currentTarget)}><History size={15} /></button>
        {compact && <button className="icon-btn sm" title="Open full page" onClick={() => navigate(`/ai${id ? '/' + id : ''}`)}><Sparkles size={15} /></button>}
      </div>
      <div className="ai-scroll" ref={scroll}>
        {!chat && !live && (
          <div className="ai-welcome">
            <div className="ai-orb"><Sparkles size={26} /></div>
            <h2>How can I help you today?</h2>
            {page && <div className="ai-context"><PageIcon page={page} size={14} /> Using “{pageTitle(page)}” as context</div>}
            <div className="ai-suggestions">
              {SUGGESTIONS.map((x) => <button key={x} className="ai-suggestion" onClick={() => send(x)}>{x}</button>)}
            </div>
          </div>
        )}
        {chat?.messages.map((m, i) => (
          <div key={i} className={cx('ai-msg', m.role)}>
            {m.role === 'assistant' ? (
              <>
                <div className="ai-md" dangerouslySetInnerHTML={{ __html: renderMd(m.content) }} />
                <div className="ai-msg-actions">
                  <button className="btn btn-sm" onClick={() => { navigator.clipboard.writeText(m.content); s.showToast('Copied'); }}><Copy size={12} /> Copy</button>
                  <button className="btn btn-sm" onClick={() => insertIntoPage(m.content.replace(/^> 🔧.*\n/gm, ''))}><FilePlus size={12} /> {pageId && page && !page.isDb ? 'Add to page' : 'Save as page'}</button>
                </div>
              </>
            ) : <div className="ai-user-bubble">{m.content}</div>}
          </div>
        ))}
        {live && (
          <div className="ai-msg assistant">
            {live.tools.map((t, i) => <div key={i} className="ai-tool"><Wrench size={12} /> {t}</div>)}
            {live.text ? <div className="ai-md" dangerouslySetInnerHTML={{ __html: renderMd(live.text) }} /> : <div className="ai-thinking"><span /><span /><span /></div>}
          </div>
        )}
        {error && (
          <div className="ai-error">{error}{error.includes('Settings') && <button className="btn btn-sm btn-outline" onClick={() => s.openModal('settings', 'ai')}><Settings size={12} /> Open settings</button>}</div>
        )}
      </div>
      <div className="ai-composer">
        <textarea
          rows={compact ? 2 : 3}
          placeholder={page ? 'Ask about this page, or anything…' : 'Ask, search, or make anything…'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
        />
        <div className="row">
          <button className="btn btn-sm" onClick={(e) => setModelMenu(e.currentTarget)}>{modelLabel}</button>
          {page && <span className="ai-context small"><PageIcon page={page} size={12} /> {pageTitle(page)}</span>}
          <div className="grow" />
          {busy
            ? <button className="send-btn on" onClick={() => abort.current?.abort()}><Square size={12} /></button>
            : <button className={cx('send-btn', input.trim() && 'on')} disabled={!input.trim()} onClick={() => send(input)}><ArrowUp size={14} /></button>}
        </div>
      </div>
      {hist && <MenuPopover anchor={hist} onClose={() => setHist(null)} width={300} searchable items={chats.length ? chats.map((c) => ({
        label: c.title, right: <span className="faint small">{timeAgo(c.at)}</span>, onClick: () => setId(c.id),
      })).concat([{ label: 'Delete current chat', right: <Trash2 size={13} />, onClick: () => { if (id) { s.deleteChat(id); setId(''); } } } as any]) : [{ label: 'No chats yet', disabled: true }]} />}
      {modelMenu && <MenuPopover anchor={modelMenu} onClose={() => setModelMenu(null)} width={280} items={AI_MODELS.map((m) => ({
        label: <div><div>{m.label}</div><div className="faint small">{m.desc}</div></div>, checked: s.settings.aiModel === m.id, onClick: () => s.updateSettings({ aiModel: m.id }),
      }))} />}
    </div>
  );
}

/** Minimal markdown → HTML for chat bubbles. */
export function renderMd(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inCode = false;
  let code: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) { out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`); code = []; inCode = false; }
      else { close(); inCode = true; }
      continue;
    }
    if (inCode) { code.push(line); continue; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,4})\s+(.*)/))) { close(); out.push(`<h${m[1].length + 2}>${inlineMdToHtml(m[2])}</h${m[1].length + 2}>`); }
    else if ((m = line.match(/^\s*[-*]\s+\[( |x)\]\s+(.*)/i))) { if (list !== 'ul') { close(); out.push('<ul class="todo">'); list = 'ul'; } out.push(`<li>${m[1] === ' ' ? '☐' : '☑'} ${inlineMdToHtml(m[2])}</li>`); }
    else if ((m = line.match(/^\s*[-*]\s+(.*)/))) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inlineMdToHtml(m[1])}</li>`); }
    else if ((m = line.match(/^\s*\d+\.\s+(.*)/))) { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inlineMdToHtml(m[1])}</li>`); }
    else if ((m = line.match(/^>\s?(.*)/))) { close(); out.push(`<blockquote>${inlineMdToHtml(m[1])}</blockquote>`); }
    else if (!line.trim()) { close(); }
    else { close(); out.push(`<p>${inlineMdToHtml(line)}</p>`); }
  }
  if (inCode) out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  close();
  return out.join('').replace(/href="#\/page\/([^"]+)"/g, 'href="#/page/$1"');
}
