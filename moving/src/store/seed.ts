import type { Block, Database, ID, Notification, Page, Property, Teamspace, Workspace } from './types';
import { newBlock, now, toISODate, addDays, uid } from '../lib/util';

const b = (type: Block['type'], html = '', patch: Partial<Block> = {}) => newBlock(type, { html, ...patch });

interface Seed {
  ws: Workspace;
  teamspaces: Record<ID, Teamspace>;
  pages: Record<ID, Page>;
  databases: Record<ID, Database>;
  firstPage: ID;
  notifications: Notification[];
}

export function seedWorkspace(meId: ID, name: string, icon: string, rich: boolean): Seed {
  const ws: Workspace = { id: uid(), name, icon: icon || name.slice(0, 1).toUpperCase(), members: [{ userId: meId, role: 'owner' }], createdAt: now(), plan: 'plus' };
  const general: Teamspace = { id: uid(), wsId: ws.id, name: 'General', icon: '🏠', members: [meId], access: 'default', order: 1 };
  const pages: Record<ID, Page> = {};
  const databases: Record<ID, Database> = {};
  let order = 1;

  const page = (p: Partial<Page> & { title: string }): Page => {
    const pg: Page = {
      id: uid(), wsId: ws.id, parentId: null, section: 'private', props: {}, content: [newBlock()],
      order: order++, createdAt: now(), createdBy: meId, updatedAt: now(), updatedBy: meId,
      generalAccess: 'invited', invites: [], versions: [], ...p,
    };
    pages[pg.id] = pg;
    return pg;
  };

  const welcome = page({
    title: `Welcome to Moving`,
    icon: '👋',
    cover: { kind: 'color', value: 'linear-gradient(120deg, #f6d365 0%, #fda085 100%)', pos: 50 },
  });

  if (!rich) {
    welcome.content = [
      b('text', 'This is your new workspace. Press <code>/</code> for commands, or <code>space</code> to ask Moving AI.'),
      b('todo', 'Create your first page with the <b>+ New page</b> button'),
      b('todo', 'Invite your team from <b>Settings → People</b>'),
    ];
    return { ws, teamspaces: { [general.id]: general }, pages, databases, firstPage: welcome.id, notifications: [] };
  }

  // ---------- Tasks database ----------
  const status: Property = { id: uid(), name: 'Status', type: 'status', options: [
    { id: uid(), name: 'Not started', color: 'default', group: 'todo' },
    { id: uid(), name: 'In progress', color: 'blue', group: 'in_progress' },
    { id: uid(), name: 'Done', color: 'green', group: 'complete' },
  ] };
  const priority: Property = { id: uid(), name: 'Priority', type: 'select', options: [
    { id: uid(), name: 'High', color: 'red' }, { id: uid(), name: 'Medium', color: 'yellow' }, { id: uid(), name: 'Low', color: 'green' },
  ] };
  const titleP: Property = { id: uid(), name: 'Task name', type: 'title' };
  const assignee: Property = { id: uid(), name: 'Assignee', type: 'person' };
  const due: Property = { id: uid(), name: 'Due', type: 'date', dateFormat: 'full' };
  const tags: Property = { id: uid(), name: 'Tags', type: 'multi_select', options: [
    { id: uid(), name: 'Design', color: 'purple' }, { id: uid(), name: 'Engineering', color: 'blue' }, { id: uid(), name: 'Marketing', color: 'orange' },
  ] };
  const est: Property = { id: uid(), name: 'Estimate (h)', type: 'number', numberFormat: 'number', numberShow: 'number' };
  const taskId: Property = { id: uid(), name: 'ID', type: 'unique_id', prefix: 'TASK', nextId: 7 };
  const overdue: Property = { id: uid(), name: 'Overdue?', type: 'formula', formula: 'if(prop("Status") != "Done" and !empty(prop("Due")) and prop("Due") < today(), "⚠️ Overdue", "")' };

  const tasksPage = page({ title: 'Tasks', icon: '✅', section: general.id, content: [] });
  const tasksDb: Database = {
    id: uid(), wsId: ws.id, title: 'Tasks', pageId: tasksPage.id, inline: false, isTasks: true,
    description: 'Track work across the team. Try the Board, Calendar and Timeline views.',
    properties: [titleP, status, assignee, due, priority, tags, est, taskId, overdue],
    views: [], templates: [], automations: [],
  };
  tasksPage.isDb = tasksDb.id;
  const all = tasksDb.properties.map((p) => p.id);
  const baseView = { filter: { id: uid(), conj: 'and' as const, rules: [] }, sorts: [], widths: {}, calc: {}, openIn: 'side' as const, cardPreview: 'none' as const, cardSize: 'medium' as const };
  tasksDb.views = [
    { ...baseView, id: uid(), name: 'Board', type: 'board', groupBy: status.id, visible: [assignee.id, due.id, priority.id, tags.id] },
    { ...baseView, id: uid(), name: 'All tasks', type: 'table', visible: all, calc: { [est.id]: 'sum', [titleP.id]: 'count_all' } },
    { ...baseView, id: uid(), name: 'Calendar', type: 'calendar', dateProp: due.id, calendarMode: 'month', visible: [status.id] },
    { ...baseView, id: uid(), name: 'Timeline', type: 'timeline', dateProp: due.id, timelineZoom: 'week', visible: [status.id] },
    { ...baseView, id: uid(), name: 'By priority', type: 'chart', visible: [], chart: { kind: 'bar', x: priority.id, agg: 'count', showLabels: true } },
  ];
  databases[tasksDb.id] = tasksDb;
  const today = new Date();
  const rows: [string, number, number, number, string[], number][] = [
    ['Design the landing page', 1, 2, 0, ['Design'], 6],
    ['Set up analytics', 0, 1, 1, ['Engineering'], 3],
    ['Write launch blog post', 0, 4, 1, ['Marketing'], 4],
    ['Fix login redirect bug', 2, -1, 0, ['Engineering'], 2],
    ['Plan Q4 roadmap', 1, 7, 0, [], 5],
    ['Customer interviews', 2, -3, 2, ['Design', 'Marketing'], 8],
  ];
  rows.forEach(([title, st, d, pr, tg, e], i) => {
    const id = uid();
    pages[id] = {
      id, wsId: ws.id, title, parentId: null, section: 'private', dbId: tasksDb.id,
      props: {
        [status.id]: status.options![st].id,
        [assignee.id]: [meId],
        [due.id]: { start: toISODate(addDays(today, d)) },
        [priority.id]: priority.options![pr].id,
        [tags.id]: tg.map((n) => tags.options!.find((o) => o.name === n)!.id),
        [est.id]: e,
        [taskId.id]: i + 1,
      },
      content: [b('h3', 'Description'), b('text', ''), b('h3', 'Checklist'), b('todo', 'First step'), b('todo', 'Second step')],
      order: i, createdAt: now() - (6 - i) * 864e5, createdBy: meId, updatedAt: now(), updatedBy: meId, versions: [],
    };
  });

  // ---------- Reading list (gallery) ----------
  const rTitle: Property = { id: uid(), name: 'Name', type: 'title' };
  const rType: Property = { id: uid(), name: 'Type', type: 'select', options: [
    { id: uid(), name: 'Book', color: 'brown' }, { id: uid(), name: 'Article', color: 'blue' }, { id: uid(), name: 'Podcast', color: 'pink' },
  ] };
  const rAuthor: Property = { id: uid(), name: 'Author', type: 'text' };
  const rUrl: Property = { id: uid(), name: 'Link', type: 'url' };
  const rDone: Property = { id: uid(), name: 'Finished', type: 'checkbox' };
  const reading = page({ title: 'Reading List', icon: '📚', content: [] });
  const readDb: Database = {
    id: uid(), wsId: ws.id, title: 'Reading List', pageId: reading.id, inline: false,
    properties: [rTitle, rType, rAuthor, rUrl, rDone], templates: [], automations: [],
    views: [
      { ...baseView, id: uid(), name: 'Gallery', type: 'gallery', cardPreview: 'cover', visible: [rType.id, rAuthor.id, rDone.id] },
      { ...baseView, id: uid(), name: 'Table', type: 'table', visible: [rTitle.id, rType.id, rAuthor.id, rUrl.id, rDone.id] },
    ],
  };
  reading.isDb = readDb.id;
  databases[readDb.id] = readDb;
  const covers = ['linear-gradient(135deg,#667eea,#764ba2)', 'linear-gradient(135deg,#43cea2,#185a9d)', 'linear-gradient(135deg,#ff9a9e,#fecfef)', 'linear-gradient(135deg,#f7971e,#ffd200)'];
  [['The Design of Everyday Things', 0, 'Don Norman', true], ['Shape Up', 0, 'Ryan Singer', false], ['How to Do Great Work', 1, 'Paul Graham', false], ['Acquired: Nvidia', 2, 'Ben & David', true]].forEach(([t, ty, a, d], i) => {
    const id = uid();
    pages[id] = {
      id, wsId: ws.id, title: t as string, parentId: null, section: 'private', dbId: readDb.id,
      cover: { kind: 'color', value: covers[i] }, icon: ['📕', '📗', '📰', '🎧'][i],
      props: { [rType.id]: rType.options![ty as number].id, [rAuthor.id]: a as string, [rDone.id]: d as boolean },
      content: [b('text', 'Notes…')], order: i, createdAt: now(), createdBy: meId, updatedAt: now(), updatedBy: meId, versions: [],
    };
  });

  // ---------- Getting started content ----------
  const quick = page({ title: 'Quick Note', icon: '📝', parentId: welcome.id, content: [
    b('text', 'Jot down anything here. Drag the <b>⋮⋮</b> handle to move blocks around.'),
    b('bullet', 'Ideas'), b('bullet', 'Links'), b('bullet', 'Snippets'),
  ] });
  const journal = page({ title: 'Journal', icon: '📔', parentId: welcome.id, content: [
    b('h2', toISODate(today)), b('text', 'What went well today?'), b('text', ''),
  ] });

  welcome.content = [
    b('callout', `Welcome to <b>Moving</b>, your connected workspace for docs, wikis and projects. Everything here is a block you can edit, move and transform.`, { icon: '🚀', bg: 'blue' }),
    b('h2', 'Getting started'),
    b('todo', 'Click anywhere and just start typing', { checked: true }),
    b('todo', 'Hit <code>/</code> to see all the types of content you can add: headings, lists, databases, images, code and more'),
    b('todo', 'Highlight any text, and use the menu that pops up to <b>style</b> <i>your</i> <u>writing</u> <s>however</s> <span class="c-red">you like</span>'),
    b('todo', 'Type <code>@</code> to mention a page, a person, or a date like <code>@tomorrow</code>'),
    b('todo', 'Drag the <b>⋮⋮</b> handle next to any block to reorder it, or click it for more actions'),
    b('todo', `Press <code>Space</code> on an empty line to ask <b>Moving AI</b> to write for you`),
    b('toggle', 'Click the arrow to open this toggle. Toggles can hold <b>anything</b>', { open: false, children: [b('text', 'Surprise! 🎉 Toggles keep long pages tidy.'), b('quote', 'Simplicity is the ultimate sophistication.')] }),
    b('h2', 'Explore your workspace'),
    b('page', '', { pageId: quick.id }),
    b('page', '', { pageId: journal.id }),
    b('link_page', '', { pageId: tasksPage.id }),
    b('link_page', '', { pageId: reading.id }),
    b('h2', 'Some things you can build'),
    newBlock('columns', { children: [
      newBlock('column', { children: [b('h3', 'Docs & notes'), b('bullet', 'Meeting notes'), b('bullet', 'Specs & PRDs'), b('bullet', 'Personal journal')] }),
      newBlock('column', { children: [b('h3', 'Projects'), b('bullet', 'Kanban boards'), b('bullet', 'Roadmaps & timelines'), b('bullet', 'Bug trackers')] }),
    ] }),
    b('code', 'function greet(name) {\n  return `Hello, ${name}!`;\n}', { language: 'javascript' }),
    b('equation', 'e^{i\\pi} + 1 = 0'),
    b('divider'),
    b('text', 'Tip: press <code>⌘K</code> / <code>Ctrl+K</code> to search everything, and <code>?</code> to see keyboard shortcuts.'),
  ];

  const notifications: Notification[] = [
    { id: uid(), wsId: ws.id, kind: 'system', pageId: welcome.id, text: 'Welcome to Moving! Explore the Getting Started page to learn the basics.', at: now() },
  ];

  return { ws, teamspaces: { [general.id]: general }, pages, databases, firstPage: welcome.id, notifications };
}
