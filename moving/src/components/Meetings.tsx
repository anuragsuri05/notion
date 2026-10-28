import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Pause, Play, Sparkles, FileText } from 'lucide-react';
import { useStore, pageTitle } from '../store/store';
import { PageIcon } from './ui';
import { goPage } from '../lib/router';
import { fmtDate, fmtTime, newBlock, escapeHtml, timeAgo } from '../lib/util';
import { streamText, AIKeyMissing } from '../lib/ai';
import { markdownToBlocks } from '../lib/markdown';

/** Browser speech recognition (Chrome/Edge/Safari). */
function getRecognition(): any {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return SR ? new SR() : null;
}

export default function Meetings() {
  const s = useStore();
  const meetings = Object.values(s.pages).filter((p) => p.wsId === s.wsId && p.meeting && !p.trashedAt).sort((a, b) => b.createdAt - a.createdAt);
  const [active, setActive] = useState<string | null>(null);
  const start = () => {
    const now = new Date();
    const id = s.createPage({
      title: `Meeting notes · ${fmtDate(now)}`,
      icon: '🎙️',
      content: [newBlock('h2', { html: 'Notes' }), newBlock()],
      meeting: { startedAt: Date.now(), transcript: [] },
    });
    setActive(id);
  };
  return (
    <div className="meetings">
      <div className="inbox-head"><h1>Meetings</h1><div className="grow" /><button className="btn btn-primary" onClick={start}><Mic size={15} /> Start transcribing</button></div>
      <p className="faint">AI Meeting Notes transcribe your meeting live, then Moving AI writes a summary and action items. Uses your browser’s speech recognition{getRecognition() ? '' : ' (not supported in this browser — you can still type notes)'}.</p>
      {active && <Recorder pageId={active} onDone={() => { const id = active; setActive(null); goPage(id); }} />}
      <div className="menu-header">Past meetings</div>
      {meetings.length === 0 && <div className="empty-state"><div style={{ fontSize: 30 }}>🎙️</div>No meetings yet.</div>}
      {meetings.map((m) => (
        <div key={m.id} className="inbox-item" onClick={() => goPage(m.id)}>
          <PageIcon page={m} size={22} />
          <div className="grow"><div>{pageTitle(m)}</div><div className="faint small">{fmtDate(m.createdAt, true)} · {m.meeting!.transcript.length} transcript lines {m.meeting!.summarized ? '· summarized' : ''}</div></div>
          <span className="faint small">{timeAgo(m.updatedAt)}</span>
        </div>
      ))}
    </div>
  );
}

export function Recorder({ pageId, onDone }: { pageId: string; onDone: () => void }) {
  const s = useStore.getState();
  const page = useStore((st) => st.pages[pageId]);
  const [state, setState] = useState<'recording' | 'paused' | 'summarizing'>('recording');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const rec = useRef<any>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const r = getRecognition();
    if (!r) { setError('Speech recognition isn’t available in this browser. Type notes manually, then click Stop to summarize.'); return; }
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || 'en-US';
    r.onresult = (e: any) => {
      let tmp = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          const text = res[0].transcript.trim();
          if (text) useStore.setState((st) => { st.pages[pageId].meeting!.transcript.push({ at: Date.now(), text }); });
        } else tmp += res[0].transcript;
      }
      setInterim(tmp);
    };
    r.onerror = (e: any) => setError(`Microphone error: ${e.error}`);
    r.onend = () => { if (stateRef.current === 'recording') { try { r.start(); } catch { /* ignore */ } } };
    try { r.start(); } catch { /* ignore */ }
    rec.current = r;
    return () => { stateRef.current = 'paused'; try { r.stop(); } catch { /* ignore */ } };
  }, [pageId]);

  const pause = () => { setState('paused'); try { rec.current?.stop(); } catch { /* ignore */ } };
  const resume = () => { setState('recording'); try { rec.current?.start(); } catch { /* ignore */ } };
  const stop = async () => {
    setState('summarizing');
    try { rec.current?.stop(); } catch { /* ignore */ }
    const p = useStore.getState().pages[pageId];
    const transcript = p.meeting!.transcript.map((t) => `[${fmtTime(new Date(t.at))}] ${t.text}`).join('\n');
    const blocks = [newBlock('h2', { html: 'Transcript' }), ...p.meeting!.transcript.map((t) => newBlock('text', { html: `<span class="c-gray">${fmtTime(new Date(t.at))}</span> ${escapeHtml(t.text)}` }))];
    useStore.setState((st) => { st.pages[pageId].meeting!.endedAt = Date.now(); });
    try {
      if (!transcript.trim() && !p.content.some((b) => b.html)) throw new Error('empty');
      let out = '';
      await streamText({ prompt: 'Summarize this meeting. Output: a "## Summary" paragraph, "## Key points" bullets, and "## Action items" as - [ ] to-dos with owners if known.', context: `Transcript:\n${transcript}\n\nNotes:\n${p.content.map((b) => b.html.replace(/<[^>]+>/g, '')).join('\n')}`, onText: (t) => { out = t; } });
      const summary = markdownToBlocks(out);
      s.mutateContent(pageId, (d) => { d.unshift(...summary); d.push(...blocks); });
      useStore.setState((st) => { st.pages[pageId].meeting!.summarized = true; });
    } catch (e) {
      s.mutateContent(pageId, (d) => { d.push(...blocks); });
      if (e instanceof AIKeyMissing) s.showToast('Transcript saved. Add an API key in Settings to get AI summaries.');
    }
    onDone();
  };

  return (
    <div className="recorder">
      <div className="row">
        <span className={state === 'recording' ? 'rec-dot live' : 'rec-dot'} />
        <b>{state === 'recording' ? 'Transcribing…' : state === 'paused' ? 'Paused' : 'Summarizing with AI…'}</b>
        <span className="faint small">{page?.meeting?.transcript.length ?? 0} lines</span>
        <div className="grow" />
        {state === 'recording' && <button className="btn btn-sm btn-outline" onClick={pause}><Pause size={13} /> Pause</button>}
        {state === 'paused' && <button className="btn btn-sm btn-outline" onClick={resume}><Play size={13} /> Resume</button>}
        {state !== 'summarizing' && <button className="btn btn-sm btn-danger-fill" onClick={stop}><Square size={12} /> Stop</button>}
        {state === 'summarizing' && <Sparkles size={16} className="spin" />}
      </div>
      {error && <div className="faint small" style={{ marginTop: 6 }}>{error}</div>}
      <div className="transcript">
        {(page?.meeting?.transcript ?? []).slice(-6).map((t, i) => <div key={i}><span className="faint small">{fmtTime(new Date(t.at))}</span> {t.text}</div>)}
        {interim && <div className="faint">{interim}</div>}
      </div>
      <button className="btn btn-sm faint-btn" onClick={() => goPage(pageId)}><FileText size={13} /> Open notes page</button>
    </div>
  );
}
