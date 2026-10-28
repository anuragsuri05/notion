import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import type {
  AIChat, Automation, Block, Comment, CustomEmoji, Database, ID, Notification, Page,
  PageVersion, Property, PropType, PropValue, Settings, Teamspace, User, View, ViewType, Workspace,
} from './types';
import { cloneBlocks, newBlock, now, uid, walkBlocks } from '../lib/util';
import { seedWorkspace } from './seed';

export interface Reminder { id: ID; pageId: ID; at: number; text: string; fired?: boolean; }

export interface PersistedState {
  version: number;
  users: Record<ID, User>;
  meId: ID;
  workspaces: Record<ID, Workspace>;
  wsId: ID;
  teamspaces: Record<ID, Teamspace>;
  pages: Record<ID, Page>;
  databases: Record<ID, Database>;
  comments: Record<ID, Comment>;
  notifications: Record<ID, Notification>;
  reminders: Record<ID, Reminder>;
  favorites: Record<ID, ID[]>;          // wsId -> page ids
  recent: Record<ID, ID[]>;             // wsId -> page ids (most recent first)
  lastPage: Record<ID, ID>;             // wsId -> last visited page
  settings: Settings;
  aiChats: Record<ID, AIChat>;
  emojis: CustomEmoji[];
  collapsedSections: string[];
  expanded: ID[];                       // expanded sidebar items
}

export type ModalName =
  | null | 'search' | 'settings' | 'trash' | 'templates' | 'history' | 'moveTo' | 'import'
  | 'shortcuts' | 'createWorkspace' | 'teamspace' | 'export';

export interface UIState {
  hydrated: boolean;
  modal: ModalName;
  modalArg?: any;
  peek: { pageId: ID; mode: 'side' | 'center' } | null;
  panel: null | 'comments' | 'updates' | 'ai';
  toast: { id: number; text: string; action?: { label: string; run: () => void } } | null;
  aiPrompt?: string;
}

type State = PersistedState & UIState & Actions;

interface Actions {
  // ui
  openModal(m: ModalName, arg?: any): void;
  closeModal(): void;
  setPeek(p: UIState['peek']): void;
  setPanel(p: UIState['panel']): void;
  showToast(text: string, action?: { label: string; run: () => void }): void;
  updateSettings(patch: Partial<Settings>): void;
  toggleSection(key: string): void;
  setExpanded(id: ID, open: boolean): void;

  // users & workspaces
  updateMe(patch: Partial<User>): void;
  createWorkspace(name: string, icon?: string): ID;
  switchWorkspace(id: ID): void;
  updateWorkspace(patch: Partial<Workspace>): void;
  deleteWorkspace(id: ID): void;
  inviteMember(email: string, role: Workspace['members'][number]['role']): ID;
  setMemberRole(userId: ID, role: Workspace['members'][number]['role']): void;
  removeMember(userId: ID): void;

  // teamspaces
  createTeamspace(name: string, icon?: string, access?: Teamspace['access']): ID;
  updateTeamspace(id: ID, patch: Partial<Teamspace>): void;
  deleteTeamspace(id: ID): void;

  // pages
  createPage(opts?: Partial<Page> & { afterId?: ID }): ID;
  updatePage(id: ID, patch: Partial<Page>): void;
  setContent(id: ID, content: Block[]): void;
  mutateContent(id: ID, fn: (content: Block[]) => void): void;
  trashPage(id: ID): void;
  restorePage(id: ID): void;
  deleteForever(id: ID): void;
  emptyTrash(): void;
  duplicatePage(id: ID): ID;
  movePage(id: ID, target: { parentId: ID | null; section?: Page['section']; beforeId?: ID | null }): void;
  toggleFavorite(id: ID): void;
  visit(id: ID): void;
  restoreVersion(id: ID, at: number): void;
  snapshot(id: ID): void;

  // databases
  createDatabase(opts: { hostPageId?: ID; inline: boolean; title?: string; view?: ViewType; section?: Page['section']; parentId?: ID | null }): { dbId: ID; pageId: ID };
  updateDb(id: ID, fn: (db: Database) => void): void;
  addProperty(dbId: ID, type: PropType, name?: string, afterId?: ID): ID;
  updateProperty(dbId: ID, propId: ID, patch: Partial<Property>): void;
  changePropertyType(dbId: ID, propId: ID, type: PropType): void;
  deleteProperty(dbId: ID, propId: ID): void;
  duplicateProperty(dbId: ID, propId: ID): void;
  addView(dbId: ID, type: ViewType, name?: string): ID;
  updateView(dbId: ID, viewId: ID, fn: (v: View) => void): void;
  deleteView(dbId: ID, viewId: ID): void;
  duplicateView(dbId: ID, viewId: ID): ID;
  addRow(dbId: ID, props?: Record<ID, PropValue>, templateId?: ID, title?: string): ID;
  setProp(pageId: ID, propId: ID, value: PropValue): void;
  addTemplate(dbId: ID): ID;
  addAutomation(dbId: ID): ID;
  updateAutomation(dbId: ID, id: ID, fn: (a: Automation) => void): void;
  deleteAutomation(dbId: ID, id: ID): void;

  // comments & notifications
  addComment(c: Omit<Comment, 'id' | 'at' | 'authorId' | 'threadId'> & { threadId?: ID }): ID;
  editComment(id: ID, html: string): void;
  deleteComment(id: ID): void;
  resolveThread(threadId: ID, resolved: boolean): void;
  react(id: ID, emoji: string): void;
  notify(n: Omit<Notification, 'id' | 'at' | 'wsId'>): void;
  markRead(id: ID, read?: boolean): void;
  archiveNotification(id: ID, archived?: boolean): void;
  markAllRead(): void;
  addReminder(r: Omit<Reminder, 'id'>): ID;
  fireReminders(): void;

  // AI
  saveChat(chat: AIChat): void;
  deleteChat(id: ID): void;
  addEmoji(e: CustomEmoji): void;
  removeEmoji(name: string): void;

  // import/export of whole store
  importState(data: PersistedState): void;
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  startWeekMonday: false,
  openOnStart: 'last',
  sidebarWidth: 248,
  sidebarOpen: true,
  aiModel: 'claude-opus-5-5',
  spellcheck: true,
  language: 'English (US)',
  emailNotifications: true,
  pushNotifications: true,
};

const USER_COLORS = ['#E16259', '#D9730D', '#DFAB01', '#0F7B6C', '#0B6E99', '#6940A5', '#AD1A72', '#64473A'];

function initialState(): PersistedState {
  const meId = uid();
  const me: User = { id: meId, name: 'You', email: 'you@moving.app', color: USER_COLORS[4] };
  const base: PersistedState = {
    version: 1,
    users: { [meId]: me },
    meId,
    workspaces: {},
    wsId: '',
    teamspaces: {},
    pages: {},
    databases: {},
    comments: {},
    notifications: {},
    reminders: {},
    favorites: {},
    recent: {},
    lastPage: {},
    settings: DEFAULT_SETTINGS,
    aiChats: {},
    emojis: [],
    collapsedSections: [],
    expanded: [],
  };
  return base;
}

const PERSIST_KEYS: (keyof PersistedState)[] = [
  'version', 'users', 'meId', 'workspaces', 'wsId', 'teamspaces', 'pages', 'databases', 'comments',
  'notifications', 'reminders', 'favorites', 'recent', 'lastPage', 'settings', 'aiChats', 'emojis',
  'collapsedSections', 'expanded',
];

export const DB_KEY = 'moving-state-v1';

function defaultView(type: ViewType, db: Pick<Database, 'properties'>, name?: string): View {
  const visible = db.properties.map((p) => p.id);
  const v: View = {
    id: uid(),
    name: name ?? VIEW_NAMES[type],
    type,
    filter: { id: uid(), conj: 'and', rules: [] },
    sorts: [],
    visible,
    widths: {},
    calc: {},
    openIn: 'side',
    cardPreview: 'none',
    cardSize: 'medium',
  };
  const sel = db.properties.find((p) => p.type === 'status') ?? db.properties.find((p) => p.type === 'select');
  const date = db.properties.find((p) => p.type === 'date');
  if (type === 'board') { v.groupBy = sel?.id; v.visible = visible.filter((id) => id !== sel?.id); }
  if (type === 'calendar' || type === 'timeline') v.dateProp = date?.id;
  if (type === 'timeline') v.timelineZoom = 'week';
  if (type === 'calendar') v.calendarMode = 'month';
  if (type === 'gallery') v.cardPreview = 'cover';
  if (type === 'chart') v.chart = { kind: 'bar', x: sel?.id, agg: 'count', showLabels: true };
  if (type === 'form') v.form = { questions: db.properties.filter((p) => !['created_time', 'created_by', 'last_edited_time', 'last_edited_by', 'formula', 'rollup', 'unique_id', 'button'].includes(p.type)).map((p) => ({ propId: p.id, required: p.type === 'title' })) };
  if (type === 'list' || type === 'gallery' || type === 'feed') v.visible = visible.filter((id) => db.properties.find((p) => p.id === id)?.type !== 'title').slice(0, 3);
  return v;
}

export const VIEW_NAMES: Record<ViewType, string> = {
  table: 'Table', board: 'Board', list: 'List', gallery: 'Gallery', calendar: 'Calendar',
  timeline: 'Timeline', chart: 'Chart', form: 'Form', feed: 'Feed',
};

export const PROP_NAMES: Record<PropType, string> = {
  title: 'Name', text: 'Text', number: 'Number', select: 'Select', multi_select: 'Multi-select',
  status: 'Status', date: 'Date', person: 'Person', files: 'Files & media', checkbox: 'Checkbox',
  url: 'URL', email: 'Email', phone: 'Phone', formula: 'Formula', relation: 'Relation', rollup: 'Rollup',
  created_time: 'Created time', created_by: 'Created by', last_edited_time: 'Last edited time',
  last_edited_by: 'Last edited by', button: 'Button', unique_id: 'ID',
};

export function statusOptions() {
  return [
    { id: uid(), name: 'Not started', color: 'default' as const, group: 'todo' as const },
    { id: uid(), name: 'In progress', color: 'blue' as const, group: 'in_progress' as const },
    { id: uid(), name: 'Done', color: 'green' as const, group: 'complete' as const },
  ];
}

export function makeProperty(type: PropType, name?: string): Property {
  const p: Property = { id: uid(), name: name ?? PROP_NAMES[type], type };
  if (type === 'select' || type === 'multi_select') p.options = [];
  if (type === 'status') p.options = statusOptions();
  if (type === 'number') { p.numberFormat = 'number'; p.numberShow = 'number'; }
  if (type === 'date') p.dateFormat = 'full';
  if (type === 'formula') p.formula = '';
  if (type === 'unique_id') { p.nextId = 1; p.prefix = ''; }
  if (type === 'rollup') p.rollupFn = 'show_original';
  if (type === 'button') { p.buttonLabel = 'Click'; p.buttonActions = []; }
  return p;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Templates can store dynamic values: "@today"/"@now" for dates and "@me" for people. */
function resolveTemplateProps(props: Record<ID, PropValue>, db: Database, meId: ID) {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  for (const p of db.properties) {
    const v = props[p.id] as any;
    if (p.type === 'date' && v?.start === '@today') props[p.id] = { start: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}` };
    if (p.type === 'date' && v?.start === '@now') props[p.id] = { start: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T${pad(today.getHours())}:${pad(today.getMinutes())}`, time: true };
    if (p.type === 'person' && Array.isArray(v)) props[p.id] = v.map((x: string) => (x === '@me' ? meId : x));
  }
  return props;
}

export const useStore = create<State>()(
  immer((set, get) => {
    const me = () => get().meId;
    const touch = (p: Page) => { p.updatedAt = now(); p.updatedBy = get().meId; };

    const collectDescendants = (s: PersistedState, id: ID): ID[] => {
      const out: ID[] = [];
      const stack = [id];
      while (stack.length) {
        const cur = stack.pop()!;
        out.push(cur);
        for (const p of Object.values(s.pages)) {
          if (p.parentId === cur) stack.push(p.id);
        }
        const pg = s.pages[cur];
        if (pg?.isDb) for (const r of Object.values(s.pages)) if (r.dbId === pg.isDb) stack.push(r.id);
        // inline databases hosted on this page
        if (pg) walkBlocks(pg.content, (b) => {
          if (b.type === 'database' && b.dbId && !b.viewIds) {
            const db = s.databases[b.dbId];
            if (db && db.pageId === cur) for (const r of Object.values(s.pages)) if (r.dbId === b.dbId) stack.push(r.id);
          }
        });
      }
      return out;
    };

    const runAutomations = (s: State, dbId: ID, pageId: ID, kind: 'page_added' | 'prop_edited', propId?: ID) => {
      const db = s.databases[dbId];
      if (!db) return;
      for (const a of db.automations) {
        if (!a.enabled || a.trigger.kind !== kind) continue;
        if (kind === 'prop_edited' && a.trigger.propId && a.trigger.propId !== propId) continue;
        const page = s.pages[pageId];
        for (const act of a.actions) {
          if (act.kind === 'set_prop' && act.propId) page.props[act.propId] = act.value ?? null;
          if (act.kind === 'notify') {
            const n: Notification = { id: uid(), wsId: s.wsId, kind: 'automation', pageId, text: act.message || `Automation “${a.name}” ran on “${page.title || 'Untitled'}”`, at: now() };
            s.notifications[n.id] = n;
          }
        }
        a.runs += 1;
        a.lastRun = now();
      }
    };

    return {
      ...initialState(),
      hydrated: false,
      modal: null,
      peek: null,
      panel: null,
      toast: null,

      openModal: (m, arg) => set((s) => { s.modal = m; s.modalArg = arg; }),
      closeModal: () => set((s) => { s.modal = null; s.modalArg = undefined; }),
      setPeek: (p) => set((s) => { s.peek = p; }),
      setPanel: (p) => set((s) => { s.panel = s.panel === p ? null : p; }),
      showToast: (text, action) => {
        const id = Date.now();
        set((s) => { s.toast = { id, text, action } as any; });
        setTimeout(() => { if (get().toast?.id === id) set((s) => { s.toast = null; }); }, 4000);
      },
      updateSettings: (patch) => set((s) => { Object.assign(s.settings, patch); }),
      toggleSection: (key) => set((s) => {
        const i = s.collapsedSections.indexOf(key);
        if (i >= 0) s.collapsedSections.splice(i, 1); else s.collapsedSections.push(key);
      }),
      setExpanded: (id, open) => set((s) => {
        const i = s.expanded.indexOf(id);
        if (open && i < 0) s.expanded.push(id);
        if (!open && i >= 0) s.expanded.splice(i, 1);
      }),

      updateMe: (patch) => set((s) => { Object.assign(s.users[s.meId], patch); }),
      createWorkspace: (name, icon) => {
        const st = get();
        const seeded = seedWorkspace(st.meId, name, icon ?? '', false);
        set((s) => {
          s.workspaces[seeded.ws.id] = seeded.ws;
          Object.assign(s.teamspaces, seeded.teamspaces);
          Object.assign(s.pages, seeded.pages);
          Object.assign(s.databases, seeded.databases);
          s.wsId = seeded.ws.id;
          s.lastPage[seeded.ws.id] = seeded.firstPage;
        });
        return seeded.ws.id;
      },
      switchWorkspace: (id) => set((s) => { s.wsId = id; s.peek = null; }),
      updateWorkspace: (patch) => set((s) => { Object.assign(s.workspaces[s.wsId], patch); }),
      deleteWorkspace: (id) => set((s) => {
        delete s.workspaces[id];
        for (const p of Object.values(s.pages)) if (p.wsId === id) delete s.pages[p.id];
        for (const d of Object.values(s.databases)) if (d.wsId === id) delete s.databases[d.id];
        for (const t of Object.values(s.teamspaces)) if (t.wsId === id) delete s.teamspaces[t.id];
        s.wsId = Object.keys(s.workspaces)[0] ?? '';
      }),
      inviteMember: (email, role) => {
        const existing = Object.values(get().users).find((u) => u.email.toLowerCase() === email.toLowerCase());
        const id = existing?.id ?? uid();
        set((s) => {
          if (!existing) {
            const local = email.split('@')[0].replace(/[._-]+/g, ' ');
            s.users[id] = { id, email, name: local.replace(/\b\w/g, (c) => c.toUpperCase()), color: USER_COLORS[Object.keys(s.users).length % USER_COLORS.length] };
          }
          const ws = s.workspaces[s.wsId];
          if (!ws.members.some((m) => m.userId === id)) ws.members.push({ userId: id, role });
        });
        return id;
      },
      setMemberRole: (userId, role) => set((s) => {
        const m = s.workspaces[s.wsId].members.find((x) => x.userId === userId);
        if (m) m.role = role;
      }),
      removeMember: (userId) => set((s) => {
        const ws = s.workspaces[s.wsId];
        ws.members = ws.members.filter((m) => m.userId !== userId);
      }),

      createTeamspace: (name, icon, access = 'open') => {
        const id = uid();
        set((s) => {
          s.teamspaces[id] = { id, wsId: s.wsId, name, icon: icon ?? '🏠', members: [s.meId], access, order: now() };
        });
        return id;
      },
      updateTeamspace: (id, patch) => set((s) => { Object.assign(s.teamspaces[id], patch); }),
      deleteTeamspace: (id) => {
        const st = get();
        Object.values(st.pages).filter((p) => p.section === id && !p.parentId).forEach((p) => get().trashPage(p.id));
        set((s) => { delete s.teamspaces[id]; });
      },

      createPage: (opts = {}) => {
        const id = opts.id ?? uid();
        const { afterId, ...rest } = opts;
        set((s) => {
          let order = now();
          if (afterId && s.pages[afterId]) order = s.pages[afterId].order + 0.5;
          const parent = rest.parentId ? s.pages[rest.parentId] : null;
          const page: Page = {
            id,
            wsId: s.wsId,
            title: '',
            parentId: null,
            section: parent ? parent.section : 'private',
            props: {},
            content: [newBlock()],
            order,
            createdAt: now(),
            createdBy: s.meId,
            updatedAt: now(),
            updatedBy: s.meId,
            generalAccess: 'invited',
            invites: [],
            versions: [],
            ...rest,
          };
          s.pages[id] = page;
          if (page.parentId) { if (!s.expanded.includes(page.parentId)) s.expanded.push(page.parentId); }
        });
        return id;
      },
      updatePage: (id, patch) => set((s) => {
        const p = s.pages[id];
        if (!p) return;
        Object.assign(p, patch);
        touch(p);
      }),
      setContent: (id, content) => set((s) => {
        const p = s.pages[id];
        if (!p) return;
        p.content = content as any;
        touch(p);
      }),
      mutateContent: (id, fn) => set((s) => {
        const p = s.pages[id];
        if (!p) return;
        fn(p.content as Block[]);
        touch(p);
      }),
      snapshot: (id) => set((s) => {
        const p = s.pages[id];
        if (!p) return;
        p.versions ??= [];
        const last = p.versions[p.versions.length - 1];
        if (last && now() - last.at < 2 * 60 * 1000) {
          last.content = JSON.parse(JSON.stringify(p.content)); last.title = p.title; last.at = now();
          return;
        }
        const v: PageVersion = { at: now(), by: s.meId, title: p.title, content: JSON.parse(JSON.stringify(p.content)) };
        p.versions.push(v);
        if (p.versions.length > 60) p.versions.shift();
      }),
      restoreVersion: (id, at) => set((s) => {
        const p = s.pages[id];
        const v = p?.versions?.find((x) => x.at === at);
        if (!p || !v) return;
        p.versions!.push({ at: now(), by: s.meId, title: p.title, content: JSON.parse(JSON.stringify(p.content)) });
        p.content = JSON.parse(JSON.stringify(v.content));
        p.title = v.title;
        touch(p);
      }),
      trashPage: (id) => set((s) => {
        const ids = collectDescendants(s, id);
        const t = now();
        for (const pid of ids) if (s.pages[pid] && !s.pages[pid].trashedAt) s.pages[pid].trashedAt = pid === id ? t : t - 1;
        for (const ws of Object.keys(s.favorites)) s.favorites[ws] = s.favorites[ws].filter((f) => !ids.includes(f));
        if (s.peek && ids.includes(s.peek.pageId)) s.peek = null;
      }),
      restorePage: (id) => set((s) => {
        const page = s.pages[id];
        if (!page) return;
        const t = page.trashedAt;
        const ids = collectDescendants(s, id);
        for (const pid of ids) {
          const p = s.pages[pid];
          if (p && p.trashedAt && (pid === id || p.trashedAt === (t ?? 0) - 1)) delete p.trashedAt;
        }
        if (page.parentId && (!s.pages[page.parentId] || s.pages[page.parentId].trashedAt)) {
          page.parentId = null;
          page.section = 'private';
        }
      }),
      deleteForever: (id) => set((s) => {
        const ids = collectDescendants(s, id);
        for (const pid of ids) {
          const p = s.pages[pid];
          if (p?.isDb) delete s.databases[p.isDb];
          delete s.pages[pid];
        }
        for (const c of Object.values(s.comments)) if (ids.includes(c.pageId)) delete s.comments[c.id];
      }),
      emptyTrash: () => {
        const ids = Object.values(get().pages).filter((p) => p.wsId === get().wsId && p.trashedAt && !(p.parentId && get().pages[p.parentId]?.trashedAt)).map((p) => p.id);
        ids.forEach((id) => get().deleteForever(id));
      },
      duplicatePage: (id) => {
        const st = get();
        const src = st.pages[id];
        const newId = uid();
        const idMap = new Map<ID, ID>();
        set((s) => {
          const copy = (pid: ID, parentId: ID | null, top: boolean): ID => {
            const p = s.pages[pid];
            const nid = top ? newId : uid();
            idMap.set(pid, nid);
            const clone: Page = JSON.parse(JSON.stringify(p));
            clone.id = nid;
            clone.parentId = parentId;
            clone.title = top ? `${p.title || 'Untitled'} (1)` : p.title;
            clone.createdAt = clone.updatedAt = now();
            clone.order = top ? p.order + 0.5 : p.order;
            clone.versions = [];
            clone.content = cloneBlocks(p.content);
            delete clone.published;
            if (p.isDb) {
              const db: Database = JSON.parse(JSON.stringify(s.databases[p.isDb]));
              const newDbId = uid();
              db.id = newDbId;
              db.pageId = nid;
              db.title = clone.title;
              s.databases[newDbId] = db;
              clone.isDb = newDbId;
              for (const r of Object.values(s.pages).filter((r) => r.dbId === p.isDb)) {
                const rc: Page = JSON.parse(JSON.stringify(r));
                rc.id = uid(); rc.dbId = newDbId; rc.versions = [];
                s.pages[rc.id] = rc;
              }
            }
            s.pages[nid] = clone;
            for (const child of Object.values(s.pages).filter((c) => c.parentId === pid && !c.trashedAt)) copy(child.id, nid, false);
            return nid;
          };
          copy(id, src.parentId, true);
          // relink sub-page blocks to the copied children
          for (const nid of idMap.values()) {
            walkBlocks(s.pages[nid].content, (b) => { if (b.type === 'page' && b.pageId && idMap.has(b.pageId)) b.pageId = idMap.get(b.pageId); });
          }
        });
        return newId;
      },
      movePage: (id, target) => set((s) => {
        const p = s.pages[id];
        if (!p) return;
        // prevent cycles
        let cur = target.parentId;
        while (cur) { if (cur === id) return; cur = s.pages[cur]?.parentId ?? null; }
        const oldParent = p.parentId;
        p.parentId = target.parentId;
        if (target.parentId) p.section = s.pages[target.parentId].section;
        else if (target.section) p.section = target.section;
        const descendants = collectDescendants(s, id);
        for (const d of descendants) if (s.pages[d] && !s.pages[d].dbId) s.pages[d].section = p.section;
        const siblings = Object.values(s.pages)
          .filter((x) => x.id !== id && x.parentId === p.parentId && !x.dbId && !x.trashedAt && (p.parentId || x.section === p.section) && x.wsId === p.wsId)
          .sort((a, b) => a.order - b.order);
        if (target.beforeId) {
          const i = siblings.findIndex((x) => x.id === target.beforeId);
          const prev = siblings[i - 1];
          const next = siblings[i];
          p.order = next ? (prev ? (prev.order + next.order) / 2 : next.order - 1) : now();
        } else {
          p.order = (siblings[siblings.length - 1]?.order ?? 0) + 1;
        }
        // remove sub-page block from old parent, add to new parent
        if (oldParent !== target.parentId) {
          if (oldParent && s.pages[oldParent]) {
            const strip = (list: Block[]): Block[] => list.filter((b) => !(b.type === 'page' && b.pageId === id)).map((b) => (b.children ? { ...b, children: strip(b.children) } : b));
            s.pages[oldParent].content = strip(s.pages[oldParent].content as Block[]) as any;
            if (s.pages[oldParent].content.length === 0) s.pages[oldParent].content.push(newBlock() as any);
          }
          if (target.parentId && s.pages[target.parentId]) {
            const tp = s.pages[target.parentId];
            let has = false;
            walkBlocks(tp.content, (b) => { if (b.type === 'page' && b.pageId === id) has = true; });
            if (!has) tp.content.push(newBlock('page', { pageId: id }) as any);
          }
        }
      }),
      toggleFavorite: (id) => set((s) => {
        const list = (s.favorites[s.wsId] ??= []);
        const i = list.indexOf(id);
        if (i >= 0) list.splice(i, 1); else list.push(id);
      }),
      visit: (id) => set((s) => {
        const list = (s.recent[s.wsId] ??= []);
        const i = list.indexOf(id);
        if (i >= 0) list.splice(i, 1);
        list.unshift(id);
        if (list.length > 30) list.pop();
        s.lastPage[s.wsId] = id;
      }),

      createDatabase: ({ hostPageId, inline, title, view = 'table', section, parentId }) => {
        const dbId = uid();
        const titleProp = makeProperty('title', 'Name');
        const tags = makeProperty('multi_select', 'Tags');
        tags.options = [];
        const db: Database = {
          id: dbId,
          wsId: get().wsId,
          title: title ?? '',
          pageId: '',
          inline,
          properties: [titleProp, tags],
          views: [],
          templates: [],
          automations: [],
        };
        if (view === 'board' || view === 'calendar' || view === 'timeline' || view === 'chart') {
          db.properties.splice(1, 0, makeProperty('status', 'Status'));
          if (view !== 'board') db.properties.push(makeProperty('date', 'Date'));
        }
        db.views.push(defaultView(view, db));
        let pageId = hostPageId ?? '';
        if (!inline) {
          pageId = get().createPage({ title: title ?? '', isDb: dbId, content: [], section: section ?? 'private', parentId: parentId ?? null });
        }
        db.pageId = pageId;
        set((s) => { s.databases[dbId] = db; });
        // three empty rows like Notion
        for (let i = 0; i < 3; i++) get().addRow(dbId);
        return { dbId, pageId };
      },
      updateDb: (id, fn) => set((s) => { if (s.databases[id]) fn(s.databases[id]); }),
      addProperty: (dbId, type, name, afterId) => {
        const p = makeProperty(type, name);
        set((s) => {
          const db = s.databases[dbId];
          let n = p.name, k = 1;
          while (db.properties.some((x) => x.name === n)) n = `${p.name} ${++k}`;
          p.name = n;
          const i = afterId ? db.properties.findIndex((x) => x.id === afterId) + 1 : db.properties.length;
          db.properties.splice(i, 0, p);
          for (const v of db.views) {
            const vi = afterId ? v.visible.indexOf(afterId) + 1 : v.visible.length;
            v.visible.splice(vi > 0 ? vi : v.visible.length, 0, p.id);
          }
          if (type === 'unique_id') {
            const rows = Object.values(s.pages).filter((r) => r.dbId === dbId).sort((a, b) => a.createdAt - b.createdAt);
            rows.forEach((r, i2) => { r.props[p.id] = i2 + 1; });
            db.properties.find((x) => x.id === p.id)!.nextId = rows.length + 1;
          }
        });
        return p.id;
      },
      updateProperty: (dbId, propId, patch) => set((s) => {
        const db = s.databases[dbId];
        const p = db.properties.find((x) => x.id === propId);
        if (!p) return;
        // two-way relation: create/remove reverse property
        if (patch.relationDb !== undefined && p.type === 'relation' && p.relationReverse && p.relationDb && patch.relationDb !== p.relationDb) {
          const old = s.databases[p.relationDb];
          if (old) old.properties = old.properties.filter((x) => x.id !== p.relationReverse);
          patch.relationReverse = undefined;
        }
        Object.assign(p, patch);
      }),
      changePropertyType: (dbId, propId, type) => set((s) => {
        const db = s.databases[dbId];
        const p = db.properties.find((x) => x.id === propId);
        if (!p || p.type === 'title') return;
        const rows = Object.values(s.pages).filter((r) => r.dbId === dbId);
        const fresh = makeProperty(type, p.name);
        // convert values where reasonable
        for (const r of rows) {
          const v = r.props[propId];
          if (v == null) continue;
          if (type === 'text' || type === 'url' || type === 'email' || type === 'phone') {
            if (Array.isArray(v)) r.props[propId] = v.map((id) => p.options?.find((o) => o.id === id)?.name ?? '').join(', ');
            else if (typeof v === 'object') r.props[propId] = (v as any).start ?? '';
            else if (p.options && typeof v === 'string') r.props[propId] = p.options.find((o) => o.id === v)?.name ?? v;
            else r.props[propId] = String(v);
          } else if (type === 'number') {
            const n = parseFloat(String(v));
            r.props[propId] = isNaN(n) ? null : n;
          } else if (type === 'checkbox') {
            r.props[propId] = v === true || v === 'true' || v === 'Yes';
          } else if (type === 'select' || type === 'multi_select' || type === 'status') {
            const names = Array.isArray(v) && p.options ? v.map((id) => p.options!.find((o) => o.id === id)?.name).filter(Boolean) as string[]
              : typeof v === 'string' && p.options?.some((o) => o.id === v) ? [p.options.find((o) => o.id === v)!.name]
              : typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean) : [];
            const opts = type === 'status' ? fresh.options! : (p.options && (p.type === 'select' || p.type === 'multi_select' || p.type === 'status') ? p.options : []);
            const ids: string[] = [];
            for (const name of names) {
              let o = opts.find((x) => x.name === name);
              if (!o && type !== 'status') { o = { id: uid(), name, color: (['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'] as const)[opts.length % 9] }; opts.push(o); }
              if (o) ids.push(o.id);
            }
            fresh.options = opts;
            r.props[propId] = type === 'multi_select' ? ids : ids[0] ?? null;
          } else if (type === 'date') {
            const d = new Date(String(v));
            r.props[propId] = isNaN(d.getTime()) ? null : { start: d.toISOString().slice(0, 10) };
          } else r.props[propId] = null;
        }
        Object.assign(p, { ...fresh, id: p.id, name: p.name, description: p.description });
        if (type === 'unique_id') {
          const sorted = rows.sort((a, b) => a.createdAt - b.createdAt);
          sorted.forEach((r, i) => { r.props[propId] = i + 1; });
          p.nextId = sorted.length + 1;
        }
      }),
      deleteProperty: (dbId, propId) => set((s) => {
        const db = s.databases[dbId];
        const p = db.properties.find((x) => x.id === propId);
        if (!p || p.type === 'title') return;
        db.properties = db.properties.filter((x) => x.id !== propId);
        for (const v of db.views) {
          v.visible = v.visible.filter((x) => x !== propId);
          v.sorts = v.sorts.filter((x) => x.propId !== propId);
          if (v.groupBy === propId) v.groupBy = undefined;
          const strip = (g: any) => { g.rules = g.rules.filter((r: any) => r.rules ? (strip(r), true) : r.propId !== propId); };
          strip(v.filter);
        }
        if (p.type === 'relation' && p.relationReverse && p.relationDb && s.databases[p.relationDb]) {
          const t = s.databases[p.relationDb];
          t.properties = t.properties.filter((x) => x.id !== p.relationReverse);
        }
      }),
      duplicateProperty: (dbId, propId) => set((s) => {
        const db = s.databases[dbId];
        const i = db.properties.findIndex((x) => x.id === propId);
        const p = db.properties[i];
        if (!p || p.type === 'title') return;
        const np: Property = { ...JSON.parse(JSON.stringify(p)), id: uid(), name: `${p.name} (1)`, relationReverse: undefined };
        db.properties.splice(i + 1, 0, np);
        for (const v of db.views) { const vi = v.visible.indexOf(propId); if (vi >= 0) v.visible.splice(vi + 1, 0, np.id); }
        for (const r of Object.values(s.pages)) if (r.dbId === dbId && r.props[propId] !== undefined) r.props[np.id] = JSON.parse(JSON.stringify(r.props[propId]));
      }),
      addView: (dbId, type, name) => {
        const db = get().databases[dbId];
        const v = defaultView(type, db, name);
        set((s) => {
          const d = s.databases[dbId];
          if ((type === 'calendar' || type === 'timeline') && !v.dateProp) {
            const p = makeProperty('date', 'Date');
            d.properties.push(p);
            d.views.forEach((x) => x.visible.push(p.id));
            v.dateProp = p.id;
            v.visible.push(p.id);
          }
          if (type === 'board' && !v.groupBy) {
            const p = makeProperty('status', 'Status');
            d.properties.push(p);
            d.views.forEach((x) => x.visible.push(p.id));
            v.groupBy = p.id;
          }
          d.views.push(v);
        });
        return v.id;
      },
      updateView: (dbId, viewId, fn) => set((s) => {
        const v = s.databases[dbId]?.views.find((x) => x.id === viewId);
        if (v) fn(v);
      }),
      deleteView: (dbId, viewId) => set((s) => {
        const db = s.databases[dbId];
        if (db.views.length <= 1) return;
        db.views = db.views.filter((v) => v.id !== viewId);
      }),
      duplicateView: (dbId, viewId) => {
        const id = uid();
        set((s) => {
          const db = s.databases[dbId];
          const i = db.views.findIndex((v) => v.id === viewId);
          const v: View = JSON.parse(JSON.stringify(db.views[i]));
          v.id = id;
          v.name = `${v.name} (1)`;
          db.views.splice(i + 1, 0, v);
        });
        return id;
      },
      addRow: (dbId, props = {}, templateId, title = '') => {
        const st = get();
        const db = st.databases[dbId];
        const tpl = templateId ? st.pages[templateId] : db.templates.map((t) => st.pages[t]).find((t) => t && db.views.some((v) => v.defaultTemplate === t.id));
        const id = uid();
        set((s) => {
          const d = s.databases[dbId];
          const rowProps: Record<ID, PropValue> = tpl ? resolveTemplateProps(JSON.parse(JSON.stringify(tpl.props)), d, s.meId) : {};
          Object.assign(rowProps, props);
          for (const p of d.properties) {
            if (p.type === 'unique_id') { rowProps[p.id] = p.nextId ?? 1; p.nextId = (p.nextId ?? 1) + 1; }
          }
          s.pages[id] = {
            id,
            wsId: d.wsId,
            title: title || (tpl?.title ?? ''),
            icon: tpl?.icon,
            cover: tpl?.cover,
            parentId: null,
            section: 'private',
            dbId,
            props: rowProps,
            content: tpl ? cloneBlocks(tpl.content) : [newBlock()],
            order: now() + Math.random(),
            createdAt: now(),
            createdBy: s.meId,
            updatedAt: now(),
            updatedBy: s.meId,
            versions: [],
          };
          runAutomations(s as State, dbId, id, 'page_added');
        });
        return id;
      },
      setProp: (pageId, propId, value) => set((s) => {
        const page = s.pages[pageId];
        if (!page || !page.dbId) return;
        const db = s.databases[page.dbId];
        const prop = db?.properties.find((p) => p.id === propId);
        const prev = page.props[propId];
        page.props[propId] = value as any;
        touch(page);
        if (prop?.type === 'relation' && prop.relationReverse && prop.relationDb) {
          const before = new Set((prev as string[]) ?? []);
          const after = new Set((value as string[]) ?? []);
          for (const id of after) if (!before.has(id) && s.pages[id]) {
            const list = ((s.pages[id].props[prop.relationReverse] as string[]) ?? []).slice();
            if (!list.includes(pageId)) list.push(pageId);
            s.pages[id].props[prop.relationReverse] = list;
          }
          for (const id of before) if (!after.has(id) && s.pages[id]) {
            s.pages[id].props[prop.relationReverse] = ((s.pages[id].props[prop.relationReverse] as string[]) ?? []).filter((x) => x !== pageId);
          }
        }
        if (prop?.type === 'person' && Array.isArray(value)) {
          const added = (value as string[]).filter((u) => !((prev as string[]) ?? []).includes(u) && u !== s.meId);
          for (const u of added) {
            const n: Notification = { id: uid(), wsId: s.wsId, kind: 'assign', pageId, actorId: s.meId, text: `${s.users[u]?.name ?? 'Someone'} was assigned to “${page.title || 'Untitled'}”`, at: now() };
            s.notifications[n.id] = n;
          }
        }
        if (!page.isTemplate) runAutomations(s as State, page.dbId, pageId, 'prop_edited', propId);
      }),
      addTemplate: (dbId) => {
        const id = uid();
        set((s) => {
          const d = s.databases[dbId];
          s.pages[id] = {
            id, wsId: d.wsId, title: 'New template', parentId: null, section: 'private', isTemplate: true, templateOf: dbId, dbId,
            props: {}, content: [newBlock()], order: now(), createdAt: now(), createdBy: s.meId, updatedAt: now(), updatedBy: s.meId, versions: [],
          };
          d.templates.push(id);
        });
        return id;
      },
      addAutomation: (dbId) => {
        const id = uid();
        set((s) => {
          s.databases[dbId].automations.push({ id, name: 'New automation', enabled: true, trigger: { kind: 'page_added' }, actions: [], runs: 0 });
        });
        return id;
      },
      updateAutomation: (dbId, id, fn) => set((s) => {
        const a = s.databases[dbId].automations.find((x) => x.id === id);
        if (a) fn(a);
      }),
      deleteAutomation: (dbId, id) => set((s) => {
        s.databases[dbId].automations = s.databases[dbId].automations.filter((a) => a.id !== id);
      }),

      addComment: (c) => {
        const id = uid();
        set((s) => {
          const comment: Comment = { ...c, id, at: now(), authorId: s.meId, threadId: c.threadId ?? id };
          s.comments[id] = comment;
          // mentions in comments notify
          const mentioned = Array.from(c.html.matchAll(/data-user="([^"]+)"/g)).map((m) => m[1]);
          for (const u of mentioned) {
            const n: Notification = { id: uid(), wsId: s.wsId, kind: 'mention', pageId: c.pageId, actorId: s.meId, text: `${s.users[s.meId].name} mentioned ${s.users[u]?.name ?? 'someone'} in a comment`, at: now() };
            s.notifications[n.id] = n;
          }
          if (c.threadId) {
            const n: Notification = { id: uid(), wsId: s.wsId, kind: 'comment', pageId: c.pageId, actorId: s.meId, text: `New reply on “${s.pages[c.pageId]?.title || 'Untitled'}”`, at: now(), read: true };
            s.notifications[n.id] = n;
          }
        });
        return id;
      },
      editComment: (id, html) => set((s) => { s.comments[id].html = html; s.comments[id].editedAt = now(); }),
      deleteComment: (id) => set((s) => {
        const c = s.comments[id];
        if (!c) return;
        if (c.threadId === id) for (const x of Object.values(s.comments)) { if (x.threadId === id) delete s.comments[x.id]; }
        else delete s.comments[id];
      }),
      resolveThread: (threadId, resolved) => set((s) => {
        for (const c of Object.values(s.comments)) if (c.threadId === threadId) c.resolved = resolved;
      }),
      react: (id, emoji) => set((s) => {
        const c = s.comments[id];
        c.reactions ??= {};
        const list = (c.reactions[emoji] ??= []);
        const i = list.indexOf(s.meId);
        if (i >= 0) list.splice(i, 1); else list.push(s.meId);
        if (!list.length) delete c.reactions[emoji];
      }),
      notify: (n) => set((s) => {
        const id = uid();
        s.notifications[id] = { ...n, id, at: now(), wsId: s.wsId };
      }),
      markRead: (id, read = true) => set((s) => { if (s.notifications[id]) s.notifications[id].read = read; }),
      archiveNotification: (id, archived = true) => set((s) => { if (s.notifications[id]) { s.notifications[id].archived = archived; s.notifications[id].read = true; } }),
      markAllRead: () => set((s) => { for (const n of Object.values(s.notifications)) if (n.wsId === s.wsId) n.read = true; }),
      addReminder: (r) => {
        const id = uid();
        set((s) => { s.reminders[id] = { ...r, id }; });
        return id;
      },
      fireReminders: () => set((s) => {
        for (const r of Object.values(s.reminders)) {
          if (!r.fired && r.at <= now()) {
            r.fired = true;
            const page = s.pages[r.pageId];
            const n: Notification = { id: uid(), wsId: page?.wsId ?? s.wsId, kind: 'reminder', pageId: r.pageId, text: `Reminder: ${r.text} in “${page?.title || 'Untitled'}”`, at: now() };
            s.notifications[n.id] = n;
            if (typeof Notification !== 'undefined' && (window as any).Notification?.permission === 'granted') {
              try { new window.Notification('Moving reminder', { body: r.text }); } catch { /* ignore */ }
            }
          }
        }
      }),

      saveChat: (chat) => set((s) => { s.aiChats[chat.id] = chat as any; }),
      deleteChat: (id) => set((s) => { delete s.aiChats[id]; }),
      addEmoji: (e) => set((s) => { s.emojis = s.emojis.filter((x) => x.name !== e.name); s.emojis.push(e); }),
      removeEmoji: (name) => set((s) => { s.emojis = s.emojis.filter((x) => x.name !== name); }),

      importState: (data) => set((s) => {
        for (const k of PERSIST_KEYS) (s as any)[k] = (data as any)[k] ?? (s as any)[k];
      }),
    };
  }),
);

export function persistedSnapshot(): PersistedState {
  const s = useStore.getState() as any;
  const out: any = {};
  for (const k of PERSIST_KEYS) out[k] = s[k];
  return out;
}

export async function hydrate() {
  let data: PersistedState | undefined;
  try { data = await idbGet(DB_KEY); } catch { data = undefined; }
  if (data && data.wsId) {
    useStore.getState().importState(data);
    // merge settings defaults for newly added keys
    useStore.setState((s) => { s.settings = { ...DEFAULT_SETTINGS, ...data!.settings }; });
  } else {
    const st = useStore.getState();
    const seeded = seedWorkspace(st.meId, 'My Workspace', '🚀', true);
    useStore.setState((s) => {
      s.workspaces[seeded.ws.id] = seeded.ws;
      Object.assign(s.teamspaces, seeded.teamspaces);
      Object.assign(s.pages, seeded.pages);
      Object.assign(s.databases, seeded.databases);
      s.wsId = seeded.ws.id;
      s.lastPage[seeded.ws.id] = seeded.firstPage;
      s.favorites[seeded.ws.id] = [seeded.firstPage];
      Object.assign(s.notifications, Object.fromEntries(seeded.notifications.map((n) => [n.id, n])));
    });
  }
  useStore.setState((s) => { s.hydrated = true; });
  useStore.subscribe((state, prev) => {
    if (PERSIST_KEYS.every((k) => (state as any)[k] === (prev as any)[k])) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { idbSet(DB_KEY, persistedSnapshot()).catch(() => {}); }, 300);
  });
}

// ---------- Selectors ----------

export const selectWsPages = (s: PersistedState) => Object.values(s.pages).filter((p) => p.wsId === s.wsId);

export function childPages(s: PersistedState, parentId: ID | null, section?: Page['section']): Page[] {
  return Object.values(s.pages)
    .filter((p) => p.wsId === s.wsId && !p.trashedAt && !p.dbId && !p.isTemplate && p.parentId === parentId && (parentId !== null || p.section === section))
    .sort((a, b) => a.order - b.order);
}

export function breadcrumbs(s: PersistedState, id: ID): Page[] {
  const out: Page[] = [];
  let cur: Page | undefined = s.pages[id];
  const seen = new Set<ID>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift(cur);
    if (cur.parentId) cur = s.pages[cur.parentId];
    else if (cur.dbId) cur = s.pages[s.databases[cur.dbId]?.pageId];
    else cur = undefined;
  }
  return out;
}

export function dbRows(s: PersistedState, dbId: ID): Page[] {
  return Object.values(s.pages).filter((p) => p.dbId === dbId && !p.trashedAt && !p.isTemplate).sort((a, b) => a.order - b.order);
}

export function backlinks(s: PersistedState, id: ID): Page[] {
  const out: Page[] = [];
  for (const p of Object.values(s.pages)) {
    if (p.id === id || p.trashedAt || p.wsId !== s.wsId) continue;
    let hit = false;
    walkBlocks(p.content, (b) => {
      if (hit) return;
      if (b.type === 'link_page' && b.pageId === id) hit = true;
      else if (b.html && b.html.includes(`data-page="${id}"`)) hit = true;
    });
    if (!hit && p.dbId) {
      const db = s.databases[p.dbId];
      for (const prop of db?.properties ?? []) if (prop.type === 'relation' && (p.props[prop.id] as string[] | undefined)?.includes(id)) hit = true;
    }
    if (hit) out.push(p);
  }
  return out;
}

export function pageTitle(p?: Page | null) {
  return p?.title || 'Untitled';
}

export function canEdit(p?: Page | null) {
  return !!p && !p.locked && !p.trashedAt;
}
