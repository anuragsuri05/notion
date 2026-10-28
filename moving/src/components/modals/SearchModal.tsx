import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Sparkles, CornerDownLeft, ArrowUpDown, FileText, Calendar, User, X, Clock, Moon, Plus, Settings, Keyboard } from 'lucide-react';
import { useStore, pageTitle, breadcrumbs } from '../../store/store';
import { Modal, PageIcon, MenuPopover, useAnchor } from '../ui';
import { goPage, navigate } from '../../lib/router';
import { blocksText, cx, timeAgo, escapeHtml, isMac } from '../../lib/util';

type Sort = 'best' | 'edited_new' | 'edited_old' | 'created_new' | 'created_old';

export default function SearchModal({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [titleOnly, setTitleOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('best');
  const [by, setBy] = useState<string | null>(null);
  const [inTs, setInTs] = useState<string | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const sortA = useAnchor(), byA = useAnchor(), inA = useAnchor(), dateA = useAnchor();
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo(() => [
    { id: 'cmd:new', label: 'New page', icon: <Plus size={16} />, run: () => goPage(useStore.getState().createPage({})) },
    { id: 'cmd:dark', label: 'Toggle dark mode', icon: <Moon size={16} />, run: () => s.updateSettings({ theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark' }) },
    { id: 'cmd:settings', label: 'Open settings', icon: <Settings size={16} />, run: () => s.openModal('settings') },
    { id: 'cmd:keys', label: 'Keyboard shortcuts', icon: <Keyboard size={16} />, run: () => s.openModal('shortcuts') },
    { id: 'cmd:ai', label: 'Ask Moving AI', icon: <Sparkles size={16} />, run: () => navigate('/ai') },
    { id: 'cmd:home', label: 'Go to Home', icon: <FileText size={16} />, run: () => navigate('/home') },
  ], [s]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    let pages = Object.values(s.pages).filter((p) => p.wsId === s.wsId && !p.trashedAt && !p.isTemplate);
    if (by) pages = pages.filter((p) => p.createdBy === by);
    if (inTs) pages = pages.filter((p) => breadcrumbs(s, p.id)[0]?.section === inTs);
    if (days) pages = pages.filter((p) => Date.now() - p.updatedAt < days * 864e5);
    if (!term) {
      const recent = (s.recent[s.wsId] ?? []).map((id) => s.pages[id]).filter((p) => p && pages.includes(p));
      return recent.slice(0, 12).map((p) => ({ page: p, snippet: '', score: 1 }));
    }
    const scored = pages.map((p) => {
      const title = (p.title || 'Untitled').toLowerCase();
      let score = 0;
      if (title === term) score += 100;
      if (title.startsWith(term)) score += 50;
      if (title.includes(term)) score += 30;
      let snippet = '';
      if (!titleOnly) {
        const text = blocksText(p.content);
        const i = text.toLowerCase().indexOf(term);
        if (i >= 0) { score += 10; snippet = text.slice(Math.max(0, i - 40), i + 80).replace(/\n/g, ' '); }
        const props = Object.values(p.props).map((v) => (typeof v === 'string' ? v : '')).join(' ').toLowerCase();
        if (props.includes(term)) score += 5;
      }
      return { page: p, snippet, score };
    }).filter((x) => x.score > 0);
    const cmp: Record<Sort, (a: typeof scored[0], b: typeof scored[0]) => number> = {
      best: (a, b) => b.score - a.score || b.page.updatedAt - a.page.updatedAt,
      edited_new: (a, b) => b.page.updatedAt - a.page.updatedAt,
      edited_old: (a, b) => a.page.updatedAt - b.page.updatedAt,
      created_new: (a, b) => b.page.createdAt - a.page.createdAt,
      created_old: (a, b) => a.page.createdAt - b.page.createdAt,
    };
    return scored.sort(cmp[sort]).slice(0, 40);
  }, [q, s, titleOnly, sort, by, inTs, days]);

  const cmdMatches = q.trim() ? commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase())) : [];
  const total = results.length + cmdMatches.length + (q.trim() ? 1 : 0);
  useEffect(() => setActive(0), [q]);
  useEffect(() => { listRef.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const choose = (i: number, newTab = false) => {
    if (i < results.length) {
      const id = results[i].page.id;
      onClose();
      if (newTab) window.open(`#/page/${id}`, '_blank'); else goPage(id);
      return;
    }
    const ci = i - results.length;
    if (ci < cmdMatches.length) { onClose(); cmdMatches[ci].run(); return; }
    onClose();
    navigate('/ai');
    setTimeout(() => window.dispatchEvent(new CustomEvent('moving:ai-prompt', { detail: q })), 300);
  };

  const hl = (text: string) => {
    const t = escapeHtml(text);
    const term = q.trim();
    if (!term) return t;
    return t.replace(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>');
  };

  const SORT_LABEL: Record<Sort, string> = { best: 'Best matches', edited_new: 'Last edited: Newest', edited_old: 'Last edited: Oldest', created_new: 'Created: Newest', created_old: 'Created: Oldest' };
  const members = s.workspaces[s.wsId].members.map((m) => s.users[m.userId]).filter(Boolean);

  return (
    <Modal onClose={onClose} width={720} top="10vh" className="search-modal">
      <div className="search-top">
        <Search size={18} className="faint" />
        <input autoFocus placeholder={`Search or ask a question in ${s.workspaces[s.wsId].name}…`} value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(total - 1, a + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
            if (e.key === 'Enter') { e.preventDefault(); if (total) choose(active, e.metaKey || e.ctrlKey); }
          }} />
        {q && <button className="icon-btn sm" onClick={() => setQ('')}><X size={14} /></button>}
      </div>
      <div className="search-filters">
        <button className={cx('chip', sort !== 'best' && 'active')} onClick={sortA.open}><ArrowUpDown size={12} /> {SORT_LABEL[sort]}</button>
        <button className={cx('chip', titleOnly && 'active')} onClick={() => setTitleOnly((x) => !x)}>Title only</button>
        <button className={cx('chip', by && 'active')} onClick={byA.open}><User size={12} /> {by ? s.users[by]?.name : 'Created by'}</button>
        <button className={cx('chip', inTs && 'active')} onClick={inA.open}><FileText size={12} /> {inTs ? (inTs === 'private' ? 'Private' : s.teamspaces[inTs]?.name) : 'In'}</button>
        <button className={cx('chip', !!days && 'active')} onClick={dateA.open}><Calendar size={12} /> {days ? `Last ${days} days` : 'Date'}</button>
      </div>
      <div className="search-results" ref={listRef}>
        {!q.trim() && <div className="menu-header"><Clock size={11} /> Recent</div>}
        {q.trim() && results.length > 0 && <div className="menu-header">Pages</div>}
        {results.map((r, i) => {
          const crumbs = breadcrumbs(s, r.page.id).slice(0, -1);
          return (
            <div key={r.page.id} className={cx('search-item', i === active && 'active')} onMouseMove={() => setActive(i)} onClick={(e) => choose(i, e.metaKey || e.ctrlKey)}>
              <PageIcon page={r.page} size={20} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="ellipsis"><span dangerouslySetInnerHTML={{ __html: hl(pageTitle(r.page)) }} />{crumbs.length > 0 && <span className="faint small"> — {crumbs.map((c) => pageTitle(c)).join(' / ')}</span>}</div>
                {r.snippet && <div className="faint small ellipsis" dangerouslySetInnerHTML={{ __html: hl(r.snippet) }} />}
              </div>
              <span className="faint small">{timeAgo(r.page.updatedAt)}</span>
              {i === active && <CornerDownLeft size={14} className="faint" />}
            </div>
          );
        })}
        {cmdMatches.length > 0 && <div className="menu-header">Commands</div>}
        {cmdMatches.map((c, j) => {
          const i = results.length + j;
          return <div key={c.id} className={cx('search-item', i === active && 'active')} onMouseMove={() => setActive(i)} onClick={() => choose(i)}>{c.icon}<span className="grow">{c.label}</span></div>;
        })}
        {q.trim() && (
          <>
            <div className="menu-header">Moving AI</div>
            <div className={cx('search-item', active === total - 1 && 'active')} onMouseMove={() => setActive(total - 1)} onClick={() => choose(total - 1)}>
              <Sparkles size={18} className="ai-spark" /><span className="grow">Ask AI: “{q}”</span>
            </div>
          </>
        )}
        {q.trim() && !results.length && !cmdMatches.length && <div className="faint" style={{ padding: '8px 14px' }}>No pages match “{q}”.</div>}
      </div>
      <div className="search-foot faint small">
        <span>↑↓ Select</span><span>↵ Open</span><span>{isMac ? '⌘' : 'Ctrl'}↵ Open in new tab</span><span>esc Close</span>
      </div>
      {sortA.anchor && <MenuPopover anchor={sortA.anchor} onClose={sortA.close} width={220} items={(Object.keys(SORT_LABEL) as Sort[]).map((k) => ({ label: SORT_LABEL[k], checked: sort === k, onClick: () => setSort(k) }))} />}
      {byA.anchor && <MenuPopover anchor={byA.anchor} onClose={byA.close} width={220} items={[{ label: 'Anyone', checked: !by, onClick: () => setBy(null) }, ...members.map((u) => ({ label: u.name, checked: by === u.id, onClick: () => setBy(u.id) }))]} />}
      {inA.anchor && <MenuPopover anchor={inA.anchor} onClose={inA.close} width={220} items={[{ label: 'Everywhere', checked: !inTs, onClick: () => setInTs(null) }, { label: 'Private', checked: inTs === 'private', onClick: () => setInTs('private') }, ...Object.values(s.teamspaces).filter((t) => t.wsId === s.wsId).map((t) => ({ label: `${t.icon} ${t.name}`, checked: inTs === t.id, onClick: () => setInTs(t.id) }))]} />}
      {dateA.anchor && <MenuPopover anchor={dateA.anchor} onClose={dateA.close} width={200} items={[{ label: 'Any time', checked: !days, onClick: () => setDays(null) }, { label: 'Today', checked: days === 1, onClick: () => setDays(1) }, { label: 'Last 7 days', checked: days === 7, onClick: () => setDays(7) }, { label: 'Last 30 days', checked: days === 30, onClick: () => setDays(30) }]} />}
    </Modal>
  );
}
