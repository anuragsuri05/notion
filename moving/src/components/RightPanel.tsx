import { X } from 'lucide-react';
import { useStore } from '../store/store';
import type { Route } from '../lib/router';
import { CommentsPanel } from './Comments';
import AIChat from './ai/AIChat';
import { Avatar } from './ui';
import { fmtDate, timeAgo } from '../lib/util';

export default function RightPanel({ route }: { route: Route }) {
  const panel = useStore((s) => s.panel);
  const setPanel = useStore((s) => s.setPanel);
  const pageId = route.name === 'page' ? route.id : undefined;
  return (
    <aside className="right-panel">
      <button className="icon-btn sm panel-close" onClick={() => setPanel(null)}><X size={16} /></button>
      {panel === 'comments' && pageId && <CommentsPanel pageId={pageId} />}
      {panel === 'updates' && pageId && <UpdatesPanel pageId={pageId} />}
      {panel === 'ai' && <AIChat pageId={pageId} compact />}
      {(panel === 'comments' || panel === 'updates') && !pageId && <div className="empty-state">Open a page to see its {panel}.</div>}
    </aside>
  );
}

function UpdatesPanel({ pageId }: { pageId: string }) {
  const s = useStore();
  const page = s.pages[pageId];
  if (!page) return null;
  const events = [
    ...(page.versions ?? []).map((v) => ({ at: v.at, by: v.by, text: 'edited this page' })),
    ...Object.values(s.comments).filter((c) => c.pageId === pageId).map((c) => ({ at: c.at, by: c.authorId, text: c.threadId === c.id ? 'commented' : 'replied to a comment' })),
    { at: page.createdAt, by: page.createdBy, text: 'created this page' },
    { at: page.updatedAt, by: page.updatedBy, text: 'last edited' },
  ].sort((a, b) => b.at - a.at);
  return (
    <div className="comments-panel">
      <div className="panel-head"><b>Updates</b></div>
      <div className="panel-scroll">
        {events.map((e, i) => (
          <div key={i} className="update-item">
            <Avatar user={s.users[e.by]} size={22} />
            <div className="grow">
              <div><b>{s.users[e.by]?.name ?? 'Someone'}</b> {e.text}</div>
              <div className="faint small">{timeAgo(e.at)} · {fmtDate(e.at, true)}</div>
            </div>
          </div>
        ))}
        <button className="btn btn-sm btn-outline" style={{ marginTop: 8 }} onClick={() => s.openModal('history', pageId)}>View page history</button>
      </div>
    </div>
  );
}
