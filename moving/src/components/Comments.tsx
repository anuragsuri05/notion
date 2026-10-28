import { useEffect, useRef, useState } from 'react';
import { Check, MoreHorizontal, SmilePlus, ArrowUp, Paperclip, AtSign, RotateCcw, Trash2, PenLine, Link2 } from 'lucide-react';
import { useStore } from '../store/store';
import { Avatar, MenuPopover, Popover } from './ui';
import { timeAgo, cx, escapeHtml, htmlToText, uid } from '../lib/util';
import { useCommentBus } from './PageView';
import { removeCommentMarks } from '../editor/formatting';
import { pageUrl } from '../lib/router';

const QUICK = ['👍', '❤️', '🎉', '😄', '👀', '🙏', '✅', '🔥'];

export function CommentComposer({ pageId, blockId, threadId, quote, autoFocus, placeholder = 'Add a comment…', onDone }: { pageId: string; blockId?: string; threadId?: string; quote?: string; autoFocus?: boolean; placeholder?: string; onDone?: () => void }) {
  const s = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(true);
  const [mention, setMention] = useState<{ el: HTMLElement; q: string } | null>(null);
  const [newThread] = useState(() => threadId ?? null);

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  const submit = () => {
    const el = ref.current!;
    const html = el.innerHTML.trim();
    if (!htmlToText(html).trim() && !html.includes('<img')) return;
    const exists = newThread && s.comments[newThread];
    if (newThread && !exists) {
      // first comment of a brand-new thread uses the pre-allocated thread id
      useStore.setState((st) => {
        st.comments[newThread] = { id: newThread, threadId: newThread, pageId, blockId, quote, authorId: st.meId, html, at: Date.now() };
      });
    } else {
      s.addComment({ pageId, blockId, html, threadId: newThread ?? undefined, quote });
    }
    el.innerHTML = '';
    setEmpty(true);
    onDone?.();
  };

  return (
    <div className="comment-composer">
      <div
        ref={ref}
        className="composer-input"
        contentEditable
        data-placeholder={placeholder}
        onInput={(e) => {
          const t = e.currentTarget.textContent ?? '';
          setEmpty(!t.trim());
          const m = /@(\w*)$/.exec(t);
          setMention(m ? { el: e.currentTarget, q: m[1] } : null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !mention) { e.preventDefault(); submit(); }
          if (e.key === 'Escape') { onDone?.(); }
        }}
        onPaste={(e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); }}
      />
      <div className="composer-actions">
        <button className="icon-btn sm" title="Mention" onClick={() => { ref.current?.focus(); document.execCommand('insertText', false, '@'); setMention({ el: ref.current!, q: '' }); }}><AtSign size={14} /></button>
        <button className="icon-btn sm" title="Attach file" onClick={async () => {
          const { pickFile, readFileAsDataURL } = await import('../lib/util');
          const [f] = await pickFile('image/*');
          if (!f) return;
          ref.current?.focus();
          document.execCommand('insertHTML', false, `<img src="${await readFileAsDataURL(f)}" style="max-width:200px;border-radius:4px">`);
          setEmpty(false);
        }}><Paperclip size={14} /></button>
        <button className={cx('send-btn', !empty && 'on')} disabled={empty} onClick={submit}><ArrowUp size={14} /></button>
      </div>
      {mention && (
        <MenuPopover anchor={mention.el} onClose={() => setMention(null)} width={240} items={s.workspaces[s.wsId].members.map((m) => s.users[m.userId]).filter((u) => u && u.name.toLowerCase().includes(mention.q.toLowerCase())).map((u) => ({
          label: u.name, icon: <Avatar user={u} size={18} />,
          onClick: () => {
            const el = ref.current!;
            el.focus();
            for (let i = 0; i <= mention.q.length; i++) document.execCommand('delete');
            document.execCommand('insertHTML', false, `<span class="mention mention-user" contenteditable="false" data-user="${u.id}">@${escapeHtml(u.name)}</span>&nbsp;`);
            setEmpty(false);
          },
        }))} />
      )}
    </div>
  );
}

export function CommentThread({ threadId, compact }: { threadId: string; compact?: boolean }) {
  const s = useStore();
  const comments = Object.values(s.comments).filter((c) => c.threadId === threadId).sort((a, b) => a.at - b.at);
  const root = comments[0];
  const focus = useCommentBus((b) => b.focusThread);
  const [reply, setReply] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (focus === threadId) { ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); setReply(true); } }, [focus, threadId]);
  if (!root) return null;
  return (
    <div ref={ref} className={cx('comment-thread', root.resolved && 'resolved', focus === threadId && 'focused', compact && 'compact')}>
      {root.quote && <div className="comment-quote">{root.quote}</div>}
      {comments.map((c, i) => <CommentItem key={c.id} id={c.id} isRoot={i === 0} />)}
      {!root.resolved && (reply
        ? <div className="row reply-row"><Avatar user={s.users[s.meId]} size={22} /><div className="grow"><CommentComposer pageId={root.pageId} blockId={root.blockId} threadId={threadId} autoFocus placeholder="Reply…" onDone={() => {}} /></div></div>
        : <button className="reply-btn" onClick={() => setReply(true)}>Reply…</button>)}
    </div>
  );
}

function CommentItem({ id, isRoot }: { id: string; isRoot: boolean }) {
  const s = useStore();
  const c = s.comments[id];
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [react, setReact] = useState<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);
  if (!c) return null;
  const author = s.users[c.authorId];
  const resolve = (v: boolean) => {
    s.resolveThread(c.threadId, v);
    if (v) {
      const root = document.querySelector('.editor');
      if (root) { removeCommentMarks(root as HTMLElement, c.threadId); root.querySelectorAll('[data-rt]').forEach((el) => el.dispatchEvent(new Event('input', { bubbles: true }))); }
    }
  };
  return (
    <div className="comment">
      <div className="comment-head">
        <Avatar user={author} size={22} />
        <b>{author?.name ?? 'Unknown'}</b>
        <span className="faint small">{timeAgo(c.at)}{c.editedAt ? ' (edited)' : ''}</span>
        <div className="grow" />
        <div className="comment-actions">
          <button className="icon-btn sm" title="Add reaction" onClick={(e) => setReact(e.currentTarget)}><SmilePlus size={14} /></button>
          {isRoot && <button className="icon-btn sm" title={c.resolved ? 'Re-open' : 'Resolve'} onClick={() => resolve(!c.resolved)}>{c.resolved ? <RotateCcw size={14} /> : <Check size={14} />}</button>}
          <button className="icon-btn sm" onClick={(e) => setMenu(e.currentTarget)}><MoreHorizontal size={14} /></button>
        </div>
      </div>
      {editing ? (
        <div className="col" style={{ gap: 4 }}>
          <div ref={editRef} className="composer-input" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: c.html }} />
          <div className="row"><button className="btn btn-sm btn-primary" onClick={() => { s.editComment(id, editRef.current!.innerHTML); setEditing(false); }}>Save</button><button className="btn btn-sm" onClick={() => setEditing(false)}>Cancel</button></div>
        </div>
      ) : <div className="comment-body" dangerouslySetInnerHTML={{ __html: c.html }} />}
      {c.reactions && Object.keys(c.reactions).length > 0 && (
        <div className="reactions">
          {Object.entries(c.reactions).map(([e, users]) => (
            <button key={e} className={cx('reaction', users.includes(s.meId) && 'mine')} title={users.map((u) => s.users[u]?.name).join(', ')} onClick={() => s.react(id, e)}>{e} {users.length}</button>
          ))}
        </div>
      )}
      {react && (
        <Popover anchor={react} onClose={() => setReact(null)}>
          <div className="menu reaction-picker">{QUICK.map((e) => <button key={e} className="emoji-cell" onClick={() => { s.react(id, e); setReact(null); }}>{e}</button>)}</div>
        </Popover>
      )}
      {menu && <MenuPopover anchor={menu} onClose={() => setMenu(null)} width={200} items={[
        ...(c.authorId === s.meId ? [{ label: 'Edit comment', icon: <PenLine size={16} />, onClick: () => setEditing(true) }] : []),
        { label: 'Copy link to comment', icon: <Link2 size={16} />, onClick: () => navigator.clipboard.writeText(pageUrl(c.pageId, c.blockId)) },
        ...(isRoot ? [{ label: c.resolved ? 'Re-open thread' : 'Resolve thread', icon: <Check size={16} />, onClick: () => resolve(!c.resolved) }] : []),
        { label: isRoot ? 'Delete thread' : 'Delete comment', icon: <Trash2 size={16} />, danger: true, onClick: () => { if (isRoot) resolve(true); s.deleteComment(id); } },
      ]} />}
    </div>
  );
}

export function CommentsPanel({ pageId }: { pageId: string }) {
  const s = useStore();
  const draft = useCommentBus((b) => b.draft);
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open');
  const threads = Object.values(s.comments).filter((c) => c.pageId === pageId && c.threadId === c.id && (filter === 'all' || (filter === 'open' ? !c.resolved : c.resolved))).sort((a, b) => b.at - a.at);
  const showDraft = draft && draft.pageId === pageId && !s.comments[draft.threadId];
  return (
    <div className="comments-panel">
      <div className="panel-head">
        <b>Comments</b>
        <div className="grow" />
        <select className="op-select" value={filter} onChange={(e) => setFilter(e.target.value as any)}>
          <option value="open">Open</option><option value="resolved">Resolved</option><option value="all">All</option>
        </select>
      </div>
      <div className="panel-scroll">
        {showDraft && (
          <div className="comment-thread focused">
            {draft!.quote && <div className="comment-quote">{draft!.quote}</div>}
            <div className="row"><Avatar user={s.users[s.meId]} size={22} /><div className="grow">
              <CommentComposer pageId={pageId} blockId={draft!.blockId} threadId={draft!.threadId} quote={draft!.quote} autoFocus onDone={() => useCommentBus.getState().set(null)} />
            </div></div>
          </div>
        )}
        {threads.map((t) => <CommentThread key={t.id} threadId={t.id} />)}
        {!threads.length && !showDraft && (
          <div className="empty-state">
            <div style={{ fontSize: 28 }}>💬</div>
            <div>No {filter === 'all' ? '' : filter} comments yet</div>
            <div className="faint small">Select text and click Comment, or press {navigator.platform.includes('Mac') ? '⌘⇧M' : 'Ctrl+Shift+M'}.</div>
          </div>
        )}
        {!showDraft && (
          <div className="row" style={{ marginTop: 8 }}><Avatar user={s.users[s.meId]} size={22} /><div className="grow"><CommentComposer key={threads.length} pageId={pageId} threadId={uid()} placeholder="Comment on this page…" /></div></div>
        )}
      </div>
    </div>
  );
}
