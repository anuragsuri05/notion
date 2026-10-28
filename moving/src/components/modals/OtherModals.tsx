import { useEffect, useState } from 'react';
import { RotateCcw, Trash2, FileText, Upload, Download, FileCode, Table2, FileJson, Lock, Globe, Users } from 'lucide-react';
import { useStore, pageTitle, breadcrumbs, childPages, persistedSnapshot, type PersistedState } from '../../store/store';
import type { Page } from '../../store/types';
import { Modal, PageIcon, SearchInput, ConfirmDialog, Avatar, Toggle } from '../ui';
import Editor from '../../editor/Editor';
import { PageOps } from '../../editor/ops';
import { goPage, navigate } from '../../lib/router';
import { cx, fuzzy, timeAgo, fmtDate, pickFile, download, MOD, ALT, SHIFT, isMac } from '../../lib/util';
import { blocksToMarkdown, blocksToHTML, htmlDocument, markdownToBlocks, htmlToBlocks } from '../../lib/markdown';
import { parseCSV, toCSV } from '../../database/logic';
import { dbRows } from '../../store/store';
import { importCSV } from '../../database/ViewSettings';

export function TrashModal({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [q, setQ] = useState('');
  const [confirm, setConfirm] = useState<string | 'all' | null>(null);
  const trashed = Object.values(s.pages)
    .filter((p) => p.wsId === s.wsId && p.trashedAt && !p.isTemplate && !(p.parentId && s.pages[p.parentId]?.trashedAt) && !(p.dbId && s.pages[s.databases[p.dbId]?.pageId]?.trashedAt) && fuzzy(q, p.title || 'Untitled'))
    .sort((a, b) => b.trashedAt! - a.trashedAt!);
  return (
    <Modal onClose={onClose} width={520} top="12vh" className="trash-modal">
      <div className="modal-pad">
        <SearchInput autoFocus value={q} onChange={setQ} placeholder="Search pages in Trash" />
      </div>
      <div className="trash-list">
        {trashed.length === 0 && <div className="empty-state"><Trash2 size={28} className="faint" /><div>No pages in Trash</div></div>}
        {trashed.map((p) => {
          const parent = p.parentId ? s.pages[p.parentId] : p.dbId ? s.pages[s.databases[p.dbId]?.pageId] : null;
          return (
            <div key={p.id} className="trash-item" onClick={() => { goPage(p.id); onClose(); }}>
              <PageIcon page={p} size={18} />
              <div className="grow"><div className="ellipsis">{pageTitle(p)}</div><div className="faint small">{parent ? pageTitle(parent) + ' · ' : ''}Deleted {timeAgo(p.trashedAt!)}</div></div>
              <button className="icon-btn sm" title="Restore" onClick={(e) => { e.stopPropagation(); s.restorePage(p.id); s.showToast(`Restored “${pageTitle(p)}”`); }}><RotateCcw size={15} /></button>
              <button className="icon-btn sm" title="Delete permanently" onClick={(e) => { e.stopPropagation(); setConfirm(p.id); }}><Trash2 size={15} /></button>
            </div>
          );
        })}
      </div>
      <div className="modal-foot faint small">
        <span>Pages in Trash for over 30 days will be automatically deleted.</span>
        {trashed.length > 0 && <button className="btn btn-sm btn-danger" onClick={() => setConfirm('all')}>Empty trash</button>}
      </div>
      {confirm && <ConfirmDialog title={confirm === 'all' ? 'Permanently delete all pages in Trash?' : 'Permanently delete this page?'} body="You can’t undo this action." danger confirm="Delete" onConfirm={() => { if (confirm === 'all') s.emptyTrash(); else s.deleteForever(confirm); }} onClose={() => setConfirm(null)} />}
    </Modal>
  );
}

export function HistoryModal({ onClose, pageId }: { onClose: () => void; pageId: string }) {
  const s = useStore();
  const page = s.pages[pageId];
  const versions = [...(page?.versions ?? [])].reverse();
  const [sel, setSel] = useState<number | null>(versions[0]?.at ?? null);
  const v = versions.find((x) => x.at === sel);
  // preview: render version content through a temporary detached page id
  const previewId = '__preview__';
  useEffect(() => {
    if (!v) return;
    useStore.setState((st) => { st.pages[previewId] = { ...JSON.parse(JSON.stringify(page)), id: previewId, content: JSON.parse(JSON.stringify(v.content)), wsId: '__none__' }; });
  }, [v, page]);
  if (!page) return null;
  const close = () => { useStore.setState((st) => { delete st.pages[previewId]; }); onClose(); };
  return (
    <Modal onClose={close} width={1000} top="6vh" height="84vh" className="history-modal">
      <div className="history">
        <div className="history-preview">
          {v ? <div className="page"><div className="page-content"><h1 className="page-title">{v.title || 'Untitled'}</h1><Editor pageId={previewId} readOnly /></div></div>
            : <div className="empty-state">No saved versions yet. Versions are captured automatically while you edit.</div>}
        </div>
        <aside className="history-side">
          <div className="menu-header">Page history · keeps up to 60 versions</div>
          {versions.map((x) => (
            <button key={x.at} className={cx('history-item', sel === x.at && 'on')} onClick={() => setSel(x.at)}>
              <div>{fmtDate(x.at, true)}</div>
              <div className="row faint small"><Avatar user={s.users[x.by]} size={14} /> {s.users[x.by]?.name ?? 'You'}</div>
            </button>
          ))}
          <div className="grow" />
          <button className="btn btn-primary" disabled={!v} onClick={() => { if (v) { s.restoreVersion(pageId, v.at); s.showToast('Version restored'); close(); } }}>Restore version</button>
        </aside>
      </div>
    </Modal>
  );
}

export function MoveToModal({ onClose, arg }: { onClose: () => void; arg: { kind: 'page' | 'blocks'; ids: string[]; pageId?: string } }) {
  const s = useStore();
  const [q, setQ] = useState('');
  const moving = arg.kind === 'page' ? arg.ids : [];
  const excluded = new Set<string>();
  for (const id of moving) { const stack = [id]; while (stack.length) { const c = stack.pop()!; excluded.add(c); childPages(s, c).forEach((x) => stack.push(x.id)); } }
  const pages = Object.values(s.pages).filter((p) => p.wsId === s.wsId && !p.trashedAt && !p.isTemplate && !excluded.has(p.id) && !p.isDb && fuzzy(q, p.title || 'Untitled')).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 40);
  const teamspaces = Object.values(s.teamspaces).filter((t) => t.wsId === s.wsId && t.members.includes(s.meId));
  const go = (target: { parentId: string | null; section?: string }) => {
    if (arg.kind === 'page') {
      for (const id of arg.ids) {
        const old = s.pages[id]?.parentId;
        s.movePage(id, { parentId: target.parentId, section: target.section as any });
        void old;
      }
      s.showToast(`Moved to ${target.parentId ? pageTitle(s.pages[target.parentId]) : target.section === 'private' ? 'Private' : s.teamspaces[target.section!]?.name}`);
    } else if (target.parentId) {
      new PageOps(arg.pageId!).moveToPage(arg.ids, target.parentId);
      s.showToast(`Moved ${arg.ids.length} block${arg.ids.length > 1 ? 's' : ''} to “${pageTitle(s.pages[target.parentId])}”`);
    }
    onClose();
  };
  return (
    <Modal onClose={onClose} width={460} top="14vh">
      <div className="modal-pad"><SearchInput autoFocus value={q} onChange={setQ} placeholder={arg.kind === 'page' ? 'Move page to…' : 'Move blocks to…'} /></div>
      <div className="trash-list">
        {arg.kind === 'page' && !q && (
          <>
            <div className="menu-header">Workspace</div>
            <div className="trash-item" onClick={() => go({ parentId: null, section: 'private' })}><Lock size={16} /><span className="grow">Private</span></div>
            {teamspaces.map((t) => <div key={t.id} className="trash-item" onClick={() => go({ parentId: null, section: t.id })}><span>{t.icon}</span><span className="grow">{t.name}</span></div>)}
          </>
        )}
        <div className="menu-header">Pages</div>
        {pages.map((p) => (
          <div key={p.id} className="trash-item" onClick={() => go({ parentId: p.id })}>
            <PageIcon page={p} size={18} /><span className="grow ellipsis">{pageTitle(p)}</span>
            <span className="faint small ellipsis" style={{ maxWidth: 140 }}>{breadcrumbs(s, p.id).slice(0, -1).map(pageTitle).join(' / ')}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function ImportModal({ onClose, arg }: { onClose: () => void; arg?: { into?: string } }) {
  const s = useStore();
  const into = arg?.into;
  const [confirm, setConfirm] = useState<PersistedState | null>(null);
  const importFiles = async (accept: string, kind: 'md' | 'html' | 'txt' | 'csv' | 'json') => {
    const files = await pickFile(accept, kind !== 'json');
    if (!files.length) return;
    if (kind === 'json') {
      try { setConfirm(JSON.parse(await files[0].text())); } catch { s.showToast('That file isn’t a valid Moving backup'); }
      return;
    }
    let last = '';
    for (const f of files) {
      const text = await f.text();
      const title = f.name.replace(/\.[^.]+$/, '');
      if (kind === 'csv') {
        const rows = parseCSV(text);
        const { dbId, pageId } = s.createDatabase({ inline: false, title, parentId: into ?? null });
        dbRows(useStore.getState(), dbId).forEach((r) => useStore.getState().deleteForever(r.id));
        const header = rows[0] ?? [];
        const db = useStore.getState().databases[dbId];
        useStore.getState().updateDb(dbId, (d) => { d.properties = d.properties.filter((p) => p.type === 'title'); d.properties[0].name = header[0] || 'Name'; d.views.forEach((v) => { v.visible = [d.properties[0].id]; }); });
        const ids = header.slice(1).map((h) => useStore.getState().addProperty(dbId, 'text', h || 'Column'));
        rows.slice(1).forEach((r) => useStore.getState().addRow(dbId, Object.fromEntries(ids.map((id, i) => [id, r[i + 1] ?? ''])), undefined, r[0] ?? ''));
        void db;
        last = pageId;
        continue;
      }
      let blocks = kind === 'html' ? htmlToBlocks(text) : kind === 'md' ? markdownToBlocks(text) : text.split(/\n/).map((l) => ({ id: Math.random().toString(36).slice(2), type: 'text' as const, html: l.replace(/</g, '&lt;') }));
      let pageTitleText = title;
      const h1 = blocks[0];
      if (h1 && h1.type === 'h1') { pageTitleText = h1.html.replace(/<[^>]+>/g, ''); blocks = blocks.slice(1); }
      last = s.createPage({ title: pageTitleText, parentId: into ?? null, content: blocks.length ? blocks : markdownToBlocks('') });
      if (into) s.mutateContent(into, (d) => { d.push({ id: Math.random().toString(36).slice(2), type: 'page', html: '', pageId: last }); });
    }
    s.showToast(`Imported ${files.length} file${files.length > 1 ? 's' : ''}`);
    onClose();
    if (last) goPage(last);
  };
  const opt = (icon: React.ReactNode, label: string, desc: string, run: () => void) => (
    <button className="import-opt" onClick={run}>{icon}<div><b>{label}</b><div className="faint small">{desc}</div></div></button>
  );
  return (
    <Modal onClose={onClose} width={620} top="14vh">
      <div className="modal-pad">
        <h2 style={{ marginTop: 0 }}>Import</h2>
        <div className="import-grid">
          {opt(<FileText size={22} />, 'Text & Markdown', '.md, .markdown, .txt', () => importFiles('.md,.markdown,.txt,text/markdown,text/plain', 'md'))}
          {opt(<FileCode size={22} />, 'HTML', 'Web pages, Google Docs export', () => importFiles('.html,.htm,text/html', 'html'))}
          {opt(<Table2 size={22} />, 'CSV', 'Creates a new database', () => importFiles('.csv,text/csv', 'csv'))}
          {opt(<FileJson size={22} />, 'Moving backup', 'Restore a full .json backup', () => importFiles('.json,application/json', 'json'))}
          {into && s.pages[into]?.isDb && opt(<Upload size={22} />, 'Merge CSV into this database', 'Adds rows to the current database', async () => { await importCSV(s.databases[s.pages[into].isDb!]); onClose(); })}
        </div>
        <p className="faint small">Exports from Notion (Markdown & CSV, HTML), Evernote (HTML), Google Docs (HTML) and Word (save as HTML) all work.</p>
      </div>
      {confirm && <ConfirmDialog title="Replace all data with this backup?" body="Your current workspaces in this browser will be replaced." danger confirm="Restore backup" onConfirm={() => { s.importState(confirm); onClose(); navigate('/home'); }} onClose={() => setConfirm(null)} />}
    </Modal>
  );
}

export function ExportModal({ onClose, arg }: { onClose: () => void; arg?: { pageId?: string; all?: boolean } }) {
  const s = useStore();
  const [format, setFormat] = useState<'md' | 'html' | 'pdf' | 'json'>(arg?.all ? 'json' : 'md');
  const [subpages, setSubpages] = useState(true);
  const page = arg?.pageId ? s.pages[arg.pageId] : null;
  const disabled = s.workspaces[s.wsId].security?.disableExport;
  const title = (id: string) => pageTitle(s.pages[id]);

  const collect = (root: Page): Page[] => {
    const out = [root];
    if (subpages) childPages(s, root.id).forEach((c) => out.push(...collect(c)));
    return out;
  };
  const pageMd = (p: Page) => {
    if (p.isDb) { const db = s.databases[p.isDb]; return `# ${pageTitle(p)}\n\n` + toCSV(s, db, dbRows(s, db.id)); }
    return `# ${pageTitle(p)}\n\n${blocksToMarkdown(p.content, title)}`;
  };
  const pageHtml = (p: Page) => htmlDocument(pageTitle(p), p.isDb ? `<pre>${toCSV(s, s.databases[p.isDb], dbRows(s, p.isDb))}</pre>` : blocksToHTML(p.content, title), p.icon && p.icon.length < 4 ? p.icon : undefined);

  const run = () => {
    if (format === 'json') { download(`moving-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(persistedSnapshot(), null, 1), 'application/json'); onClose(); return; }
    const roots = page ? [page] : Object.values(s.pages).filter((p) => p.wsId === s.wsId && !p.trashedAt && !p.parentId && !p.dbId && !p.isTemplate);
    const pages = roots.flatMap(collect);
    if (format === 'pdf') {
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write(pages.map(pageHtml).join('<div style="page-break-after:always"></div>'));
      w.document.close();
      setTimeout(() => w.print(), 400);
      onClose();
      return;
    }
    if (format === 'md') download(`${page ? pageTitle(page) : 'Moving export'}.md`, pages.map(pageMd).join('\n\n---\n\n'), 'text/markdown');
    else download(`${page ? pageTitle(page) : 'Moving export'}.html`, pages.length === 1 ? pageHtml(pages[0]) : htmlDocument('Moving export', pages.map((p) => `<h1>${pageTitle(p)}</h1>${p.isDb ? '' : blocksToHTML(p.content, title)}<hr>`).join('')), 'text/html');
    onClose();
  };
  return (
    <Modal onClose={onClose} width={420} top="18vh">
      <div className="modal-pad col">
        <h2 style={{ margin: 0 }}>Export {page ? `“${pageTitle(page)}”` : 'workspace'}</h2>
        {disabled ? <p className="faint">Export is disabled by your workspace settings.</p> : (
          <>
            <label className="field-label">Export format</label>
            <select className="input" value={format} onChange={(e) => setFormat(e.target.value as any)}>
              <option value="md">Markdown & CSV</option><option value="html">HTML</option><option value="pdf">PDF (print)</option><option value="json">Moving backup (JSON, everything)</option>
            </select>
            {format !== 'json' && <div className="row" style={{ justifyContent: 'space-between' }}><span>Include subpages</span><Toggle on={subpages} onChange={setSubpages} /></div>}
            <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={run}><Download size={14} /> Export</button>
          </>
        )}
      </div>
    </Modal>
  );
}

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const M = MOD, A = ALT, S = SHIFT;
  const groups: [string, [string, string][]][] = [
    ['General', [[`${M}K / ${M}P`, 'Search & jump to page'], [`${M}N`, 'New page'], [`${M}\\`, 'Toggle sidebar'], [`${M}${S}L`, 'Toggle dark mode'], [`${M}J`, 'Ask Moving AI'], [`${M}[ / ${M}]`, 'Back / forward'], [`${M}${S}U`, 'Go to parent page'], [`${M}L`, 'Copy page link'], ['?', 'Keyboard shortcuts']]],
    ['Text', [[`${M}B`, 'Bold'], [`${M}I`, 'Italic'], [`${M}U`, 'Underline'], [`${M}${S}S`, 'Strikethrough'], [`${M}E`, 'Inline code'], [`${M}${S}E`, 'Inline equation'], [`${M}K`, 'Add link'], [`${M}${S}M`, 'Comment'], [`${M}${S}H`, 'Apply last color'], [`${S}Enter`, 'Line break in block']]],
    ['Blocks', [['Esc', 'Select block'], [`${M}A`, 'Select block / all'], [`${M}D`, 'Duplicate'], [`${M}/`, 'Block actions'], [`${M}${S}↑/↓`, 'Move block'], ['Tab / Shift+Tab', 'Indent / outdent'], [`${M}Enter`, 'Toggle to-do / toggle'], [`${M}${A}T`, 'Expand/collapse all toggles'], [`${M}Z / ${M}${S}Z`, 'Undo / redo'], ['Space (empty line)', 'Ask AI']]],
    ['Turn into', [[`${M}${A}0`, 'Text'], [`${M}${A}1/2/3`, 'Heading 1/2/3'], [`${M}${A}4`, 'To-do'], [`${M}${A}5`, 'Bulleted list'], [`${M}${A}6`, 'Numbered list'], [`${M}${A}7`, 'Toggle'], [`${M}${A}8`, 'Code'], [`${M}${A}9`, 'Page']]],
    ['Markdown', [['# ## ### ####', 'Headings'], ['- * +', 'Bulleted list'], ['1. a. i.', 'Numbered list'], ['[]', 'To-do'], ['>', 'Toggle'], ['"', 'Quote'], ['```', 'Code block'], ['---', 'Divider'], ['**x** *x* `x` ~x~', 'Bold, italic, code, strike'], ['$$x$$', 'Inline math']]],
    ['Commands', [['/', 'Insert any block'], ['@', 'Mention person, page or date'], ['@remind tomorrow', 'Reminder'], ['[[', 'Link to page'], [':name', 'Emoji'], ['+', 'Link or create page (empty line)']]],
    ['Databases & peek', [[`${isMac ? '⌃' : 'Ctrl+'}${S}K / J`, 'Previous / next page in peek'], ['Esc', 'Close peek'], [`${M}${S}Enter`, 'Open peek as full page']]],
  ];
  return (
    <Modal onClose={onClose} width={720} top="8vh" height="80vh">
      <div className="modal-pad"><SearchInput autoFocus value={q} onChange={setQ} placeholder="Search shortcuts…" /></div>
      <div className="shortcuts">
        {groups.map(([g, items]) => {
          const list = items.filter(([k, l]) => fuzzy(q, k, l, g));
          if (!list.length) return null;
          return (
            <div key={g}><div className="menu-header">{g}</div>
              {list.map(([k, l]) => <div key={k + l} className="shortcut-row"><span>{l}</span><span className="kbd-chip">{k}</span></div>)}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

export function CreateWorkspaceModal({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏢');
  return (
    <Modal onClose={onClose} width={420} top="18vh">
      <div className="modal-pad col" style={{ alignItems: 'center', textAlign: 'center' }}>
        <h2 style={{ margin: 0 }}>Create a workspace</h2>
        <p className="faint">Fill in some details for your teammates.</p>
        <input className="input" style={{ width: 70, fontSize: 28, height: 56, textAlign: 'center' }} value={icon} onChange={(e) => setIcon(e.target.value.slice(0, 2))} />
        <input autoFocus className="input" placeholder="Acme Inc." value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) create(); }} />
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!name.trim()} onClick={create}>Continue</button>
      </div>
    </Modal>
  );
  function create() {
    s.createWorkspace(name.trim(), icon);
    onClose();
    const last = useStore.getState().lastPage[useStore.getState().wsId];
    navigate(last ? `/page/${last}` : '/home');
  }
}

export function TeamspaceModal({ onClose, id }: { onClose: () => void; id?: string }) {
  const s = useStore();
  const t = id ? s.teamspaces[id] : null;
  const [name, setName] = useState(t?.name ?? '');
  const [icon, setIcon] = useState(t?.icon ?? '🏠');
  const [desc, setDesc] = useState(t?.description ?? '');
  const [access, setAccess] = useState(t?.access ?? 'open');
  const [email, setEmail] = useState('');
  const [confirm, setConfirm] = useState(false);
  const save = () => {
    if (!name.trim()) return;
    if (t) s.updateTeamspace(t.id, { name: name.trim(), icon, description: desc, access });
    else { const nid = s.createTeamspace(name.trim(), icon, access); s.updateTeamspace(nid, { description: desc }); }
    onClose();
  };
  const ACC = { default: ['Default', 'Everyone in the workspace is a member', Users], open: ['Open', 'Anyone can see and join', Globe], closed: ['Closed', 'Anyone can see, members must be added', Lock], private: ['Private', 'Only members can see', Lock] } as const;
  return (
    <Modal onClose={onClose} width={520} top="12vh">
      <div className="modal-pad col">
        <h2 style={{ margin: 0 }}>{t ? 'Teamspace settings' : 'Create a new teamspace'}</h2>
        {!t && <p className="faint" style={{ margin: 0 }}>Teamspaces are where your team organizes pages, permissions, and members.</p>}
        <label className="field-label">Icon & name</label>
        <div className="row"><input className="input" style={{ width: 56, textAlign: 'center' }} value={icon} onChange={(e) => setIcon(e.target.value.slice(0, 2))} /><input autoFocus className="input" placeholder="Acme Labs" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <label className="field-label">Description</label>
        <textarea className="input" rows={2} placeholder="Details about your teamspace" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <label className="field-label">Permissions</label>
        <select className="input" value={access} onChange={(e) => setAccess(e.target.value as any)}>
          {(Object.keys(ACC) as (keyof typeof ACC)[]).map((k) => <option key={k} value={k}>{ACC[k][0]} — {ACC[k][1]}</option>)}
        </select>
        {t && (
          <>
            <label className="field-label">Members ({t.members.length})</label>
            <div className="row"><input className="input" placeholder="Add people by email" value={email} onChange={(e) => setEmail(e.target.value)} /><button className="btn btn-sm btn-outline" onClick={() => { if (/\S+@\S+/.test(email)) { const uid = s.inviteMember(email, 'member'); s.updateTeamspace(t.id, { members: Array.from(new Set([...t.members, uid])) }); setEmail(''); } }}>Add</button></div>
            {t.members.map((m) => (
              <div key={m} className="row"><Avatar user={s.users[m]} size={22} /><span className="grow">{s.users[m]?.name}</span>{m !== s.meId && <button className="icon-btn sm" onClick={() => s.updateTeamspace(t.id, { members: t.members.filter((x) => x !== m) })}><Trash2 size={13} /></button>}</div>
            ))}
          </>
        )}
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
          {t ? <button className="btn btn-sm btn-danger" disabled={t.access === 'default' && Object.values(s.teamspaces).filter((x) => x.wsId === s.wsId).length <= 1} onClick={() => setConfirm(true)}><Trash2 size={13} /> Archive teamspace</button> : <span />}
          <button className="btn btn-primary" disabled={!name.trim()} onClick={save}>{t ? 'Save' : 'Create teamspace'}</button>
        </div>
      </div>
      {confirm && t && <ConfirmDialog title={`Archive ${t.name}?`} body="Its pages will be moved to Trash." danger confirm="Archive" onConfirm={() => { s.deleteTeamspace(t.id); onClose(); }} onClose={() => setConfirm(false)} />}
    </Modal>
  );
}
