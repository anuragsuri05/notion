import { useState } from 'react';
import {
  User, SlidersHorizontal, Bell, Plug, Settings, Users, LayoutGrid, Shield, Sparkles, Smile, Upload, CreditCard, Globe, Trash2, Plus, Check, Eye, EyeOff, KeyRound, Download,
} from 'lucide-react';
import { useStore, pageTitle, persistedSnapshot, DB_KEY } from '../../store/store';
import type { Workspace } from '../../store/types';
import { Modal, Avatar, Toggle, ConfirmDialog, MenuPopover, PageIcon } from '../ui';
import { cx, pickFile, readFileAsDataURL, download, fmtDate } from '../../lib/util';
import { AI_MODELS } from '../../lib/ai';
import { navigate, publicUrl } from '../../lib/router';
import { del as idbDel } from 'idb-keyval';

type Tab = 'account' | 'preferences' | 'notifications' | 'connections' | 'general' | 'people' | 'teamspaces' | 'security' | 'ai' | 'emoji' | 'import' | 'billing' | 'public';

export default function SettingsModal({ onClose, initial }: { onClose: () => void; initial?: Tab }) {
  const [tab, setTab] = useState<Tab>(initial && typeof initial === 'string' ? initial : 'account');
  const s = useStore();
  const me = s.users[s.meId];
  const ws = s.workspaces[s.wsId];
  const nav = (t: Tab, icon: React.ReactNode, label: string) => (
    <button className={cx('set-nav', tab === t && 'active')} onClick={() => setTab(t)}>{icon}<span>{label}</span></button>
  );
  return (
    <Modal onClose={onClose} width={1100} top="5vh" height="86vh" className="settings-modal">
      <div className="settings">
        <aside className="set-side">
          <div className="set-group">Account</div>
          <div className="set-me"><Avatar user={me} size={22} /><span className="ellipsis">{me.name}</span></div>
          {nav('account', <User size={16} />, 'My account')}
          {nav('preferences', <SlidersHorizontal size={16} />, 'Preferences')}
          {nav('notifications', <Bell size={16} />, 'Notifications')}
          {nav('connections', <Plug size={16} />, 'Connections')}
          <div className="set-group">Workspace</div>
          {nav('general', <Settings size={16} />, 'General')}
          {nav('people', <Users size={16} />, 'People')}
          {nav('teamspaces', <LayoutGrid size={16} />, 'Teamspaces')}
          {nav('security', <Shield size={16} />, 'Security')}
          {nav('ai', <Sparkles size={16} />, 'Moving AI')}
          {nav('public', <Globe size={16} />, 'Public pages')}
          {nav('emoji', <Smile size={16} />, 'Emoji')}
          {nav('import', <Upload size={16} />, 'Import')}
          {nav('billing', <CreditCard size={16} />, 'Plans & billing')}
        </aside>
        <section className="set-main">
          {tab === 'account' && <AccountTab />}
          {tab === 'preferences' && <PreferencesTab />}
          {tab === 'notifications' && <NotificationsTab />}
          {tab === 'connections' && <ConnectionsTab />}
          {tab === 'general' && <GeneralTab ws={ws} onClose={onClose} />}
          {tab === 'people' && <PeopleTab ws={ws} />}
          {tab === 'teamspaces' && <TeamspacesTab />}
          {tab === 'security' && <SecurityTab ws={ws} />}
          {tab === 'ai' && <AITab />}
          {tab === 'public' && <PublicTab />}
          {tab === 'emoji' && <EmojiTab />}
          {tab === 'import' && <div><h2>Import</h2><p className="faint">Bring content into Moving from Markdown, HTML, CSV, plain text, or a Moving backup.</p><button className="btn btn-primary" onClick={() => s.openModal('import')}>Open importer</button></div>}
          {tab === 'billing' && <BillingTab ws={ws} />}
        </section>
      </div>
    </Modal>
  );
}

function Row({ title, desc, children }: { title: React.ReactNode; desc?: React.ReactNode; children?: React.ReactNode }) {
  return <div className="set-row"><div className="grow"><div className="set-row-title">{title}</div>{desc && <div className="faint small">{desc}</div>}</div>{children}</div>;
}

function AccountTab() {
  const s = useStore();
  const me = s.users[s.meId];
  const [confirm, setConfirm] = useState(false);
  return (
    <div>
      <h2>My account</h2>
      <div className="set-profile">
        <button className="set-avatar" onClick={async () => { const [f] = await pickFile('image/*'); if (f) s.updateMe({ avatar: await readFileAsDataURL(f) }); }} title="Upload photo"><Avatar user={me} size={64} /></button>
        <div className="grow">
          <label className="field-label">Preferred name</label>
          <input className="input" value={me.name} onChange={(e) => s.updateMe({ name: e.target.value })} />
        </div>
      </div>
      {me.avatar && <button className="btn btn-sm" onClick={() => s.updateMe({ avatar: undefined })}>Remove photo</button>}
      <h3>Account security</h3>
      <Row title="Email" desc={me.email}><input className="input" style={{ width: 240 }} value={me.email} onChange={(e) => s.updateMe({ email: e.target.value })} /></Row>
      <Row title="Password" desc="Moving runs locally in your browser — no password needed."><button className="btn btn-sm btn-outline" disabled>Set password</button></Row>
      <Row title="2-step verification" desc="Not needed for local-only workspaces."><Toggle on={false} onChange={() => s.showToast('2-step verification needs a Moving server')} /></Row>
      <h3>Danger zone</h3>
      <Row title={<span style={{ color: 'var(--red)' }}>Delete all local data</span>} desc="Permanently deletes every workspace, page and setting stored in this browser."><button className="btn btn-sm btn-danger" onClick={() => setConfirm(true)}>Delete my data</button></Row>
      {confirm && <ConfirmDialog title="Delete all local data?" body="This cannot be undone. Export a backup first if you need one." danger confirm="Delete everything" onConfirm={async () => { await idbDel(DB_KEY); location.hash = ''; location.reload(); }} onClose={() => setConfirm(false)} />}
    </div>
  );
}

function PreferencesTab() {
  const s = useStore();
  const st = s.settings;
  return (
    <div>
      <h2>Preferences</h2>
      <Row title="Appearance" desc="Customize how Moving looks on your device.">
        <select className="input" style={{ width: 160 }} value={st.theme} onChange={(e) => s.updateSettings({ theme: e.target.value as any })}><option value="system">Use system setting</option><option value="light">Light</option><option value="dark">Dark</option></select>
      </Row>
      <Row title="High contrast" desc="Make text, icons and borders easier to read."><Toggle on={!!st.highContrast} onChange={(v) => s.updateSettings({ highContrast: v })} /></Row>
      <h3>Language & time</h3>
      <Row title="Language" desc="Change the language used in the interface.">
        <select className="input" style={{ width: 160 }} value={st.language} onChange={(e) => s.updateSettings({ language: e.target.value })}>{['English (US)', 'English (UK)', 'हिन्दी', 'Español', 'Français', 'Deutsch', '日本語', '한국어', 'Português (Brasil)', '中文 (简体)'].map((l) => <option key={l}>{l}</option>)}</select>
      </Row>
      <Row title="Start week on Monday" desc="This will change how all calendars in your app look."><Toggle on={st.startWeekMonday} onChange={(v) => s.updateSettings({ startWeekMonday: v })} /></Row>
      <Row title="Timezone" desc={Intl.DateTimeFormat().resolvedOptions().timeZone} />
      <h3>Editor</h3>
      <Row title="Spellcheck" desc="Underline misspelled words while typing."><Toggle on={st.spellcheck} onChange={(v) => s.updateSettings({ spellcheck: v })} /></Row>
      <h3>Desktop & navigation</h3>
      <Row title="Open on start" desc="Choose what to show when Moving starts.">
        <select className="input" style={{ width: 160 }} value={st.openOnStart} onChange={(e) => s.updateSettings({ openOnStart: e.target.value as any })}><option value="last">Last visited page</option><option value="home">Home</option></select>
      </Row>
      <Row title="Reset sidebar width"><button className="btn btn-sm btn-outline" onClick={() => s.updateSettings({ sidebarWidth: 248 })}>Reset</button></Row>
    </div>
  );
}

function NotificationsTab() {
  const s = useStore();
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
  return (
    <div>
      <h2>Notifications</h2>
      <Row title="Desktop notifications" desc="Get notified about reminders even when Moving is in the background.">
        {perm === 'granted' ? <span className="faint small"><Check size={12} /> Enabled</span> : <button className="btn btn-sm btn-outline" onClick={async () => setPerm(await Notification.requestPermission())}>Enable</button>}
      </Row>
      <Row title="Activity in your workspace" desc="Receive notifications for mentions, comments, reminders and invites in your Inbox."><Toggle on={!!s.settings.pushNotifications} onChange={(v) => s.updateSettings({ pushNotifications: v })} /></Row>
      <Row title="Email digests" desc="Requires a Moving server to send email."><Toggle on={!!s.settings.emailNotifications} onChange={(v) => s.updateSettings({ emailNotifications: v })} /></Row>
    </div>
  );
}

function ConnectionsTab() {
  const s = useStore();
  const items = [
    ['Anthropic (Claude)', 'Powers Moving AI', !!s.settings.aiKey],
    ['Slack', 'Send notifications to channels', false], ['Google Drive', 'Embed and preview files', false], ['GitHub', 'Link previews and synced databases', false],
    ['Figma', 'Embed designs', true], ['Google Maps', 'Embed maps', true], ['YouTube', 'Embed videos', true], ['Loom', 'Embed recordings', true],
  ] as const;
  return (
    <div>
      <h2>Connections</h2>
      <p className="faint">Embeds work out of the box. API-based integrations need a Moving server.</p>
      {items.map(([n, d, on]) => (
        <Row key={n} title={n} desc={d}>{on ? <span className="badge green">Connected</span> : <button className="btn btn-sm btn-outline" onClick={() => n.startsWith('Anthropic') ? s.openModal('settings', 'ai') : s.showToast(`${n} requires a server connection`)}>Connect</button>}</Row>
      ))}
    </div>
  );
}

function GeneralTab({ ws, onClose }: { ws: Workspace; onClose: () => void }) {
  const s = useStore();
  const [confirm, setConfirm] = useState(false);
  return (
    <div>
      <h2>Workspace settings</h2>
      <label className="field-label">Name</label>
      <input className="input" style={{ maxWidth: 360 }} value={ws.name} onChange={(e) => s.updateWorkspace({ name: e.target.value })} />
      <div className="faint small" style={{ marginBottom: 12 }}>You can use your organization or company name. Keep it simple.</div>
      <label className="field-label">Icon</label>
      <div className="row">
        <span className="sb-ws-icon big">{ws.icon.length <= 3 ? ws.icon : <img src={ws.icon} alt="" />}</span>
        <input className="input" style={{ width: 80 }} value={ws.icon.length <= 3 ? ws.icon : ''} placeholder="🚀" onChange={(e) => s.updateWorkspace({ icon: e.target.value.slice(0, 2) || ws.name[0] })} />
        <button className="btn btn-sm btn-outline" onClick={async () => { const [f] = await pickFile('image/*'); if (f) s.updateWorkspace({ icon: await readFileAsDataURL(f) }); }}>Upload image</button>
      </div>
      <label className="field-label" style={{ marginTop: 12 }}>Domain</label>
      <div className="row"><span className="faint">moving.app/</span><input className="input" style={{ width: 220 }} value={ws.domain ?? ''} placeholder={ws.name.toLowerCase().replace(/\W+/g, '-')} onChange={(e) => s.updateWorkspace({ domain: e.target.value })} /></div>
      <h3>Export</h3>
      <Row title="Export all workspace content" desc="Download every page as Markdown, HTML or a full Moving backup (JSON)."><button className="btn btn-sm btn-outline" onClick={() => s.openModal('export', { all: true })}>Export</button></Row>
      <Row title="Export members as CSV"><button className="btn btn-sm btn-outline" onClick={() => download('members.csv', ['Name,Email,Role', ...ws.members.map((m) => `${s.users[m.userId]?.name},${s.users[m.userId]?.email},${m.role}`)].join('\n'), 'text/csv')}>Export</button></Row>
      <h3>Danger zone</h3>
      <Row title={<span style={{ color: 'var(--red)' }}>Delete entire workspace</span>} desc="Deletes all pages, databases and settings of this workspace.">
        <button className="btn btn-sm btn-danger" disabled={Object.keys(s.workspaces).length <= 1} onClick={() => setConfirm(true)}>Delete workspace</button>
      </Row>
      {confirm && <ConfirmDialog title={`Delete “${ws.name}”?`} body="All pages in this workspace will be permanently deleted." danger confirm="Delete workspace" onConfirm={() => { s.deleteWorkspace(ws.id); onClose(); navigate('/home'); }} onClose={() => setConfirm(false)} />}
    </div>
  );
}

function PeopleTab({ ws }: { ws: Workspace }) {
  const s = useStore();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Workspace['members'][number]['role']>('member');
  const [tab, setTab] = useState<'members' | 'guests'>('members');
  const [roleMenu, setRoleMenu] = useState<{ el: HTMLElement; id: string } | null>(null);
  const list = ws.members.filter((m) => (tab === 'guests' ? m.role === 'guest' : m.role !== 'guest'));
  const owners = ws.members.filter((m) => m.role === 'owner').length;
  return (
    <div>
      <h2>People</h2>
      <div className="row">
        <input className="input" placeholder="Search name or emails, separated by commas" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
        <select className="input" style={{ width: 130 }} value={role} onChange={(e) => setRole(e.target.value as any)}><option value="owner">Workspace owner</option><option value="admin">Membership admin</option><option value="member">Member</option><option value="guest">Guest</option></select>
        <button className="btn btn-primary" onClick={add}>Invite</button>
      </div>
      <div className="tabs-row" style={{ marginTop: 12 }}>
        <button className={cx('tab', tab === 'members' && 'active')} onClick={() => setTab('members')}>Members <span className="faint">{ws.members.filter((m) => m.role !== 'guest').length}</span></button>
        <button className={cx('tab', tab === 'guests' && 'active')} onClick={() => setTab('guests')}>Guests <span className="faint">{ws.members.filter((m) => m.role === 'guest').length}</span></button>
      </div>
      <table className="set-table">
        <thead><tr><th>User</th><th>Role</th><th /></tr></thead>
        <tbody>
          {list.map((m) => {
            const u = s.users[m.userId];
            return (
              <tr key={m.userId}>
                <td><div className="row"><Avatar user={u} size={28} /><div><div>{u?.name}{m.userId === s.meId && <span className="faint"> (You)</span>}</div><div className="faint small">{u?.email}</div></div></div></td>
                <td><button className="btn btn-sm" onClick={(e) => setRoleMenu({ el: e.currentTarget, id: m.userId })}>{ROLE[m.role]}</button></td>
                <td>{m.userId !== s.meId && <button className="icon-btn sm" onClick={() => s.removeMember(m.userId)} title="Remove"><Trash2 size={14} /></button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {roleMenu && <MenuPopover anchor={roleMenu.el} onClose={() => setRoleMenu(null)} width={240} items={(['owner', 'admin', 'member', 'guest'] as const).map((r) => ({
        label: ROLE[r], checked: ws.members.find((m) => m.userId === roleMenu.id)?.role === r,
        disabled: roleMenu.id === s.meId && r !== 'owner' && owners <= 1,
        onClick: () => s.setMemberRole(roleMenu.id, r),
      }))} />}
      <p className="faint small" style={{ marginTop: 12 }}>Moving stores data in this browser, so invited people appear in mentions, sharing and assignments here. Real-time multi-user sync needs a Moving server.</p>
    </div>
  );
  function add() {
    const list2 = email.split(/[,\s]+/).filter((x) => /\S+@\S+\.\S+/.test(x));
    list2.forEach((e) => s.inviteMember(e, role));
    if (list2.length) s.showToast(`Invited ${list2.length} ${list2.length === 1 ? 'person' : 'people'}`);
    setEmail('');
  }
}
const ROLE = { owner: 'Workspace owner', admin: 'Membership admin', member: 'Member', guest: 'Guest' } as const;

function TeamspacesTab() {
  const s = useStore();
  const ts = Object.values(s.teamspaces).filter((t) => t.wsId === s.wsId);
  return (
    <div>
      <h2>Teamspaces</h2>
      <div className="row" style={{ justifyContent: 'space-between' }}><span className="faint">Manage all teamspaces you have access to.</span><button className="btn btn-sm btn-primary" onClick={() => s.openModal('teamspace')}><Plus size={13} /> New teamspace</button></div>
      <table className="set-table">
        <thead><tr><th>Teamspace</th><th>Access</th><th>Members</th><th /></tr></thead>
        <tbody>{ts.map((t) => (
          <tr key={t.id}>
            <td><span style={{ marginRight: 6 }}>{t.icon}</span>{t.name}</td>
            <td className="faint">{t.access[0].toUpperCase() + t.access.slice(1)}</td>
            <td>{t.members.length}</td>
            <td className="row" style={{ gap: 4 }}>
              {!t.members.includes(s.meId) && <button className="btn btn-sm btn-outline" onClick={() => s.updateTeamspace(t.id, { members: [...t.members, s.meId] })}>Join</button>}
              <button className="btn btn-sm" onClick={() => s.openModal('teamspace', t.id)}>Settings</button>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function SecurityTab({ ws }: { ws: Workspace }) {
  const s = useStore();
  const sec = ws.security ?? {};
  const set = (patch: Partial<NonNullable<Workspace['security']>>) => s.updateWorkspace({ security: { ...sec, ...patch } });
  return (
    <div>
      <h2>Security</h2>
      <Row title="Disable publishing sites" desc="Prevent members from publishing pages to the web."><Toggle on={!!sec.disablePublish} onChange={(v) => set({ disablePublish: v })} /></Row>
      <Row title="Disable duplicating pages to other workspaces"><Toggle on={!!sec.disableDuplicate} onChange={(v) => set({ disableDuplicate: v })} /></Row>
      <Row title="Disable export" desc="Prevent anyone from exporting as Markdown, CSV, HTML or PDF."><Toggle on={!!sec.disableExport} onChange={(v) => set({ disableExport: v })} /></Row>
      <Row title="Disable guests" desc="Prevent pages from being shared with guests."><Toggle on={!!sec.disableGuests} onChange={(v) => set({ disableGuests: v })} /></Row>
      <h3>Identity</h3>
      <Row title="SAML SSO" desc="Available with a Moving server on the Business plan."><span className="badge">Server</span></Row>
      <Row title="SCIM provisioning" desc="Available with a Moving server on the Enterprise plan."><span className="badge">Server</span></Row>
    </div>
  );
}

function AITab() {
  const s = useStore();
  const [show, setShow] = useState(false);
  const [key, setKey] = useState(s.settings.aiKey ?? '');
  return (
    <div>
      <h2>Moving AI</h2>
      <p className="faint">Moving AI uses Claude by Anthropic. Paste your own API key. It is stored only in this browser and sent only to api.anthropic.com.</p>
      <label className="field-label"><KeyRound size={12} /> Anthropic API key</label>
      <div className="row">
        <input className="input mono" type={show ? 'text' : 'password'} placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} />
        <button className="icon-btn" onClick={() => setShow((x) => !x)}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        <button className="btn btn-primary" onClick={() => { s.updateSettings({ aiKey: key.trim() || undefined }); s.showToast(key.trim() ? 'API key saved' : 'API key removed'); }}>Save</button>
      </div>
      <div className="faint small" style={{ marginTop: 4 }}>Get a key at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">console.anthropic.com</a>. Anyone with access to this browser profile can read it.</div>
      <h3>Model</h3>
      {AI_MODELS.map((m) => (
        <div key={m.id} className={cx('model-card', s.settings.aiModel === m.id && 'on')} onClick={() => s.updateSettings({ aiModel: m.id })}>
          <div className="grow"><b>{m.label}</b><div className="faint small">{m.desc} · <span className="mono">{m.id}</span></div></div>
          {s.settings.aiModel === m.id && <Check size={16} />}
        </div>
      ))}
      <p className="faint small">Requests on Opus, Sonnet and Fable models use Anthropic’s server-side refusal fallback so a declined request is retried on another model automatically.</p>
    </div>
  );
}

function PublicTab() {
  const s = useStore();
  const pubs = Object.values(s.pages).filter((p) => p.wsId === s.wsId && p.published && !p.trashedAt);
  return (
    <div>
      <h2>Public pages</h2>
      {pubs.length === 0 && <p className="faint">No pages are published. Use Share → Publish on any page.</p>}
      <table className="set-table"><tbody>{pubs.map((p) => (
        <tr key={p.id}>
          <td><div className="row"><PageIcon page={p} size={18} /> {pageTitle(p)}</div></td>
          <td className="faint small">Published {fmtDate(p.published!.at)}</td>
          <td className="row" style={{ gap: 4 }}>
            <a className="btn btn-sm" href={publicUrl(p.id)} target="_blank" rel="noreferrer">View</a>
            <button className="btn btn-sm btn-danger" onClick={() => s.updatePage(p.id, { published: undefined, generalAccess: 'invited' })}>Unpublish</button>
          </td>
        </tr>
      ))}</tbody></table>
      <h3>Shared AI chats</h3>
      <p className="faint small">{Object.keys(s.aiChats).length} saved chats in this browser.</p>
    </div>
  );
}

function EmojiTab() {
  const s = useStore();
  const [name, setName] = useState('');
  return (
    <div>
      <h2>Custom emoji</h2>
      <p className="faint">Upload images to use as emoji anywhere: type <code>:name</code> in the editor.</p>
      <div className="row">
        <input className="input" style={{ width: 200 }} placeholder="emoji_name" value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} />
        <button className="btn btn-primary" disabled={!name} onClick={async () => { const [f] = await pickFile('image/*'); if (f) { s.addEmoji({ name, url: await readFileAsDataURL(f) }); setName(''); } }}><Plus size={14} /> Upload</button>
      </div>
      <div className="emoji-list">{s.emojis.map((e) => (
        <div key={e.name} className="row emoji-row"><img src={e.url} alt="" width={24} height={24} /><span className="grow">:{e.name}:</span><button className="icon-btn sm" onClick={() => s.removeEmoji(e.name)}><Trash2 size={14} /></button></div>
      ))}</div>
    </div>
  );
}

function BillingTab({ ws }: { ws: Workspace }) {
  const s = useStore();
  const plans = [
    { id: 'free', name: 'Free', price: '$0', feats: ['Unlimited pages & blocks', 'Basic databases & forms', '7-day page history'] },
    { id: 'plus', name: 'Plus', price: '$10', feats: ['Unlimited charts & uploads', 'Custom forms & sites', '30-day page history'] },
    { id: 'business', name: 'Business', price: '$20', feats: ['Moving AI included', 'Private teamspaces', '90-day page history'] },
    { id: 'enterprise', name: 'Enterprise', price: 'Custom', feats: ['SCIM & audit log', 'Advanced security', 'Unlimited history'] },
  ] as const;
  return (
    <div>
      <h2>Plans</h2>
      <p className="faint">Moving is free and local-first. Plans here are for demonstration — switching changes labels only.</p>
      <div className="plans">
        {plans.map((p) => (
          <div key={p.id} className={cx('plan', ws.plan === p.id && 'on')}>
            <b>{p.name}</b><div className="plan-price">{p.price}<span className="faint small"> /member/mo</span></div>
            <ul>{p.feats.map((f) => <li key={f}><Check size={12} /> {f}</li>)}</ul>
            <button className={cx('btn btn-sm', ws.plan === p.id ? 'btn-outline' : 'btn-primary')} disabled={ws.plan === p.id} onClick={() => s.updateWorkspace({ plan: p.id })}>{ws.plan === p.id ? 'Current plan' : 'Switch'}</button>
          </div>
        ))}
      </div>
      <h3>Backup</h3>
      <Row title="Download full backup" desc="Everything in this browser as one JSON file you can import later."><button className="btn btn-sm btn-outline" onClick={() => download(`moving-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(persistedSnapshot()), 'application/json')}><Download size={13} /> Download</button></Row>
    </div>
  );
}
