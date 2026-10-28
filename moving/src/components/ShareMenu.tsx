import { useState } from 'react';
import { Globe, Lock, Building2, Link2, ChevronDown, ExternalLink, Check, Users } from 'lucide-react';
import { useStore, breadcrumbs, pageTitle } from '../store/store';
import type { Role } from '../store/types';
import { Popover, Avatar, Toggle, MenuPopover } from './ui';
import { cx, fmtDate } from '../lib/util';
import { pageUrl, publicUrl } from '../lib/router';

export const ROLE_LABEL: Record<Role, string> = { full: 'Full access', edit: 'Can edit', edit_content: 'Can edit content', comment: 'Can comment', view: 'Can view' };
const ROLE_DESC: Record<Role, string> = {
  full: 'Edit, suggest, comment, and share with others',
  edit: 'Edit, suggest, and comment',
  edit_content: 'Edit database content, not structure',
  comment: 'Suggest and comment',
  view: 'View only',
};

export default function ShareMenu({ pageId, anchor, onClose }: { pageId: string; anchor: HTMLElement; onClose: () => void }) {
  const s = useStore();
  const page = s.pages[pageId];
  const [tab, setTab] = useState<'share' | 'publish'>('share');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('edit');
  const [roleMenu, setRoleMenu] = useState<{ el: HTMLElement; target: 'new' | string } | null>(null);
  const [accessMenu, setAccessMenu] = useState<HTMLElement | null>(null);
  const [copied, setCopied] = useState(false);
  if (!page) return null;
  const ws = s.workspaces[s.wsId];
  const crumbs = breadcrumbs(s, pageId);
  const inheritedFrom = crumbs.length > 1 ? crumbs[0] : null;
  const invites = page.invites ?? [];
  const access = page.generalAccess ?? 'invited';
  const section = page.section !== 'private' ? s.teamspaces[page.section] : null;

  const invite = () => {
    const list = email.split(/[,\s]+/).map((x) => x.trim()).filter((x) => /\S+@\S+\.\S+/.test(x));
    if (!list.length) return;
    const next = [...invites];
    for (const e of list) {
      if (!next.some((i) => i.email === e)) next.push({ email: e, role });
      const isMember = ws.members.some((m) => s.users[m.userId]?.email === e);
      const uidv = s.inviteMember(e, isMember ? 'member' : 'guest');
      void uidv;
    }
    s.updatePage(pageId, { invites: next });
    s.notify({ kind: 'invite', pageId, actorId: s.meId, text: `You shared “${pageTitle(page)}” with ${list.join(', ')}`, read: true } as any);
    s.showToast(`Invited ${list.length} ${list.length === 1 ? 'person' : 'people'}`);
    setEmail('');
  };

  const copy = (url: string) => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const ACCESS = {
    invited: { icon: Lock, label: 'Only people invited', desc: 'Only people with access can open' },
    workspace: { icon: Building2, label: `Everyone at ${ws.name}`, desc: 'Anyone in this workspace can find and access' },
    public: { icon: Globe, label: 'Anyone on the web with link', desc: 'Anyone with the link can view' },
  } as const;
  const A = ACCESS[access];

  return (
    <Popover anchor={anchor} onClose={onClose} placement="bottom-end" width={440}>
      <div className="menu share-menu">
        <div className="tabs-row">
          <button className={cx('tab', tab === 'share' && 'active')} onClick={() => setTab('share')}>Share</button>
          <button className={cx('tab', tab === 'publish' && 'active')} onClick={() => setTab('publish')}>Publish {page.published && <span className="pub-dot" />}</button>
        </div>
        {tab === 'share' ? (
          <div className="share-body">
            <div className="row">
              <input autoFocus className="input" placeholder="Email or group, separated by commas" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') invite(); }} />
              <button className="btn btn-sm btn-outline" onClick={(e) => setRoleMenu({ el: e.currentTarget, target: 'new' })}>{ROLE_LABEL[role]} <ChevronDown size={12} /></button>
              <button className="btn btn-primary btn-sm" disabled={!email.trim()} onClick={invite}>Invite</button>
            </div>
            <div className="share-list">
              <div className="share-person">
                <Avatar user={s.users[s.meId]} size={28} />
                <div className="grow"><div>{s.users[s.meId].name} <span className="faint">(You)</span></div><div className="faint small">{s.users[s.meId].email}</div></div>
                <span className="faint small">Full access</span>
              </div>
              {section && (
                <div className="share-person">
                  <span className="share-icon">{section.icon}</span>
                  <div className="grow"><div>Everyone in {section.name}</div><div className="faint small">{section.members.length} members · teamspace</div></div>
                  <span className="faint small">Can edit</span>
                </div>
              )}
              {invites.map((inv) => {
                const u = Object.values(s.users).find((x) => x.email === inv.email);
                const guest = !ws.members.some((m) => m.userId === u?.id && m.role !== 'guest');
                return (
                  <div key={inv.email} className="share-person">
                    <Avatar user={u} size={28} />
                    <div className="grow"><div>{u?.name ?? inv.email} {guest && <span className="badge">Guest</span>}</div><div className="faint small">{inv.email}</div></div>
                    <button className="btn btn-sm" onClick={(e) => setRoleMenu({ el: e.currentTarget, target: inv.email })}>{ROLE_LABEL[inv.role]} <ChevronDown size={12} /></button>
                  </div>
                );
              })}
              {inheritedFrom && inheritedFrom.id !== pageId && <div className="faint small" style={{ padding: '4px 2px' }}>Access is inherited from “{pageTitle(inheritedFrom)}” unless changed here.</div>}
            </div>
            <div className="menu-header">General access</div>
            <div className="share-person clickable" onClick={(e) => setAccessMenu(e.currentTarget)}>
              <span className="share-icon"><A.icon size={16} /></span>
              <div className="grow"><div className="row" style={{ gap: 4 }}>{A.label} <ChevronDown size={12} /></div><div className="faint small">{A.desc}</div></div>
              {access !== 'invited' && <span className="faint small">{access === 'public' ? 'Can view' : 'Can edit'}</span>}
            </div>
            <div className="share-foot">
              <a className="faint small" href="https://www.notion.com/help/sharing-and-permissions" target="_blank" rel="noreferrer">Learn about sharing</a>
              <button className="btn btn-sm btn-outline" onClick={() => copy(access === 'public' ? publicUrl(pageId) : pageUrl(pageId))}>{copied ? <Check size={13} /> : <Link2 size={13} />} {copied ? 'Copied' : 'Copy link'}</button>
            </div>
          </div>
        ) : (
          <PublishTab pageId={pageId} />
        )}
        {roleMenu && (
          <MenuPopover anchor={roleMenu.el} onClose={() => setRoleMenu(null)} width={280} items={[
            ...(['full', 'edit', 'edit_content', 'comment', 'view'] as Role[]).filter((r) => r !== 'edit_content' || !!page.isDb).map((r) => ({
              label: <div><div>{ROLE_LABEL[r]}</div><div className="faint small">{ROLE_DESC[r]}</div></div>,
              checked: roleMenu.target === 'new' ? role === r : invites.find((i) => i.email === roleMenu.target)?.role === r,
              onClick: () => roleMenu.target === 'new' ? setRole(r) : s.updatePage(pageId, { invites: invites.map((i) => (i.email === roleMenu.target ? { ...i, role: r } : i)) }),
            })),
            ...(roleMenu.target !== 'new' ? [{ divider: true }, { label: 'Remove', danger: true, onClick: () => s.updatePage(pageId, { invites: invites.filter((i) => i.email !== roleMenu.target) }) }] : []),
          ]} />
        )}
        {accessMenu && (
          <MenuPopover anchor={accessMenu} onClose={() => setAccessMenu(null)} width={320} items={(Object.keys(ACCESS) as (keyof typeof ACCESS)[]).map((k) => {
            const X = ACCESS[k];
            return {
              label: <div><div>{X.label}</div><div className="faint small">{X.desc}</div></div>, icon: <X.icon size={16} />, checked: access === k,
              disabled: k === 'public' && ws.security?.disablePublish,
              onClick: () => s.updatePage(pageId, { generalAccess: k, published: k === 'public' ? (page.published ?? { at: Date.now(), indexing: false }) : page.published }),
            };
          })} />
        )}
      </div>
    </Popover>
  );
}

function PublishTab({ pageId }: { pageId: string }) {
  const s = useStore();
  const page = s.pages[pageId];
  const ws = s.workspaces[s.wsId];
  const pub = page.published;
  const url = publicUrl(pageId);
  if (ws.security?.disablePublish) return <div className="share-body faint">Publishing is disabled by your workspace admin (Settings → Security).</div>;
  if (!pub) {
    return (
      <div className="share-body publish-empty">
        <Globe size={40} strokeWidth={1.2} className="faint" />
        <b>Publish to web</b>
        <div className="faint small" style={{ textAlign: 'center' }}>Create a website with Moving. Anyone with the link can view the page and its sub-pages.</div>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => s.updatePage(pageId, { published: { at: Date.now(), allowComments: false, allowDuplicate: true, indexing: false }, generalAccess: 'public' })}>Publish</button>
      </div>
    );
  }
  const set = (patch: Partial<NonNullable<typeof pub>>) => s.updatePage(pageId, { published: { ...pub, ...patch } });
  return (
    <div className="share-body">
      <div className="row publish-url"><Globe size={14} className="pub-live" /><span className="ellipsis grow">{url}</span>
        <button className="btn btn-sm btn-outline" onClick={() => { navigator.clipboard.writeText(url); s.showToast('Copied site link'); }}>Copy</button></div>
      <div className="faint small">Published {fmtDate(pub.at, true)}</div>
      <div className="menu-item"><span className="menu-label">Allow editing</span><Toggle on={!!pub.allowEdit} onChange={(v) => set({ allowEdit: v })} /></div>
      <div className="menu-item"><span className="menu-label">Allow comments</span><Toggle on={!!pub.allowComments} onChange={(v) => set({ allowComments: v })} /></div>
      <div className="menu-item"><span className="menu-label">Allow duplicate as template</span><Toggle on={pub.allowDuplicate !== false} onChange={(v) => set({ allowDuplicate: v })} /></div>
      <div className="menu-item"><span className="menu-label">Search engine indexing</span><Toggle on={!!pub.indexing} onChange={(v) => set({ indexing: v })} /></div>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
        <button className="btn btn-sm btn-danger" onClick={() => s.updatePage(pageId, { published: undefined, generalAccess: 'invited' })}>Unpublish</button>
        <a className="btn btn-sm btn-primary" href={url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> View site</a>
      </div>
      <div className="faint small row" style={{ marginTop: 6 }}><Users size={12} /> Viewers see this page read-only in their own browser.</div>
    </div>
  );
}
