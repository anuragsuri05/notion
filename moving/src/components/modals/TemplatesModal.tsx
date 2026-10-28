import { useState } from 'react';
import { Search } from 'lucide-react';
import { useStore, makeProperty } from '../../store/store';
import type { PropType, ViewType, Property } from '../../store/types';
import { Modal } from '../ui';
import { markdownToBlocks } from '../../lib/markdown';
import { goPage } from '../../lib/router';
import { cx, fuzzy, toISODate, addDays, uid } from '../../lib/util';
import { renderMd } from '../ai/AIChat';

interface DbSpec { props: [string, PropType, string[]?][]; views: ViewType[]; rows: Record<string, any>[]; }
interface Template { id: string; name: string; icon: string; cat: string; desc: string; md?: string; db?: DbSpec; cover?: string; }

const today = () => toISODate(new Date());
const inDays = (n: number) => toISODate(addDays(new Date(), n));

const TEMPLATES: Template[] = [
  { id: 'meeting', name: 'Meeting notes', icon: '📝', cat: 'Work', desc: 'Agenda, notes and action items for any meeting.', md: `## Attendees\n- @\n\n## Agenda\n1. \n2. \n\n## Notes\n- \n\n## Action items\n- [ ] \n- [ ] ` },
  { id: 'prd', name: 'Product spec (PRD)', icon: '📐', cat: 'Work', desc: 'Problem, goals, requirements and launch plan.', md: `## Problem\nWhat problem are we solving and for whom?\n\n## Goals\n- \n\n## Non-goals\n- \n\n## Requirements\n| Requirement | Priority | Notes |\n| --- | --- | --- |\n| | P0 | |\n\n## Design\n> Link Figma files here\n\n## Launch plan\n- [ ] Beta\n- [ ] GA` },
  { id: 'roadmap', name: 'Project roadmap', icon: '🗺️', cat: 'Work', desc: 'Plan projects on a timeline with status and owners.', db: { views: ['timeline', 'board', 'table'], props: [['Status', 'status'], ['Owner', 'person'], ['Dates', 'date'], ['Priority', 'select', ['P0', 'P1', 'P2']]], rows: [{ Name: 'Discovery', Dates: { start: today(), end: inDays(7) }, Priority: 'P0' }, { Name: 'Design', Dates: { start: inDays(5), end: inDays(14) }, Priority: 'P1' }, { Name: 'Build', Dates: { start: inDays(12), end: inDays(30) }, Priority: 'P0' }, { Name: 'Launch', Dates: { start: inDays(31) }, Priority: 'P1' }] } },
  { id: 'bugs', name: 'Bug tracker', icon: '🐞', cat: 'Engineering', desc: 'Triage and track bugs by severity.', db: { views: ['board', 'table'], props: [['Status', 'status'], ['Severity', 'select', ['Critical', 'High', 'Medium', 'Low']], ['Assignee', 'person'], ['Reported', 'created_time'], ['ID', 'unique_id']], rows: [{ Name: 'Login button unresponsive on Safari', Severity: 'High' }, { Name: 'Typo on pricing page', Severity: 'Low' }] } },
  { id: 'crm', name: 'Simple CRM', icon: '🤝', cat: 'Sales', desc: 'Track leads, deal value and stage.', db: { views: ['board', 'table', 'chart'], props: [['Stage', 'select', ['Lead', 'Qualified', 'Proposal', 'Won', 'Lost']], ['Company', 'text'], ['Email', 'email'], ['Deal value', 'number'], ['Next follow-up', 'date']], rows: [{ Name: 'Ada Lovelace', Company: 'Analytical Co', Stage: 'Qualified', 'Deal value': 12000 }, { Name: 'Alan Turing', Company: 'Enigma Ltd', Stage: 'Proposal', 'Deal value': 30000 }, { Name: 'Grace Hopper', Company: 'COBOL Inc', Stage: 'Won', 'Deal value': 18000 }] } },
  { id: 'okrs', name: 'OKRs', icon: '🎯', cat: 'Work', desc: 'Objectives and key results with progress bars.', db: { views: ['table', 'board'], props: [['Quarter', 'select', ['Q1', 'Q2', 'Q3', 'Q4']], ['Progress', 'number'], ['Owner', 'person'], ['Status', 'status']], rows: [{ Name: 'Grow weekly active users 20%', Quarter: 'Q4', Progress: 0.45 }, { Name: 'Ship mobile app v1', Quarter: 'Q4', Progress: 0.7 }] } },
  { id: 'wiki', name: 'Team wiki', icon: '📚', cat: 'Work', desc: 'A home for team knowledge.', md: `> 👋 Welcome to the team wiki. Start here.\n\n## 🧭 Getting started\n- Read the onboarding guide\n- Set up your tools\n\n## 📌 Policies\n- Time off\n- Expenses\n\n## 🛠 Engineering\n- Architecture overview\n- Deploy process\n\n## ❓ FAQ\n- Who do I ask about X?` },
  { id: 'todo', name: 'To-do list', icon: '✅', cat: 'Personal', desc: 'A simple checklist to get things done.', md: `## Today\n- [ ] \n- [ ] \n\n## This week\n- [ ] \n\n## Someday\n- [ ] ` },
  { id: 'weekly', name: 'Weekly planner', icon: '🗓️', cat: 'Personal', desc: 'Plan each day of the week.', md: `## Monday\n- [ ] \n## Tuesday\n- [ ] \n## Wednesday\n- [ ] \n## Thursday\n- [ ] \n## Friday\n- [ ] \n## Weekend\n- [ ] \n\n---\n### Notes & reflection\n` },
  { id: 'habits', name: 'Habit tracker', icon: '🔁', cat: 'Personal', desc: 'Check off daily habits and see your streak.', db: { views: ['table', 'calendar'], props: [['Date', 'date'], ['Exercise', 'checkbox'], ['Read', 'checkbox'], ['Meditate', 'checkbox'], ['Water', 'checkbox']], rows: [0, 1, 2, 3, 4, 5, 6].map((i) => ({ Name: `Day ${i + 1}`, Date: { start: inDays(-6 + i) } })) } },
  { id: 'journal', name: 'Journal', icon: '📔', cat: 'Personal', desc: 'Daily entries with mood tracking.', db: { views: ['list', 'calendar'], props: [['Date', 'date'], ['Mood', 'select', ['😄 Great', '🙂 Good', '😐 Okay', '😔 Low']]], rows: [{ Name: 'First entry', Date: { start: today() }, Mood: '🙂 Good' }] } },
  { id: 'reading', name: 'Reading list', icon: '📖', cat: 'Personal', desc: 'Books, articles and podcasts to get through.', db: { views: ['gallery', 'table'], props: [['Type', 'select', ['Book', 'Article', 'Podcast', 'Video']], ['Author', 'text'], ['Status', 'status'], ['Rating', 'select', ['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐']], ['Link', 'url']], rows: [{ Name: 'Atomic Habits', Type: 'Book', Author: 'James Clear' }] } },
  { id: 'recipes', name: 'Recipe book', icon: '🍳', cat: 'Personal', desc: 'Collect recipes with ingredients and steps.', db: { views: ['gallery', 'table'], props: [['Cuisine', 'multi_select', ['Indian', 'Italian', 'Mexican', 'Japanese']], ['Time (min)', 'number'], ['Difficulty', 'select', ['Easy', 'Medium', 'Hard']]], rows: [{ Name: 'Dal tadka', Cuisine: ['Indian'], 'Time (min)': 35, Difficulty: 'Easy' }] } },
  { id: 'travel', name: 'Travel planner', icon: '✈️', cat: 'Personal', desc: 'Itinerary, packing list and budget.', md: `## Itinerary\n| Day | Place | Plan |\n| --- | --- | --- |\n| 1 | | |\n| 2 | | |\n\n## Packing list\n- [ ] Passport\n- [ ] Chargers\n- [ ] Clothes\n\n## Budget\n- Flights: \n- Stay: \n- Food: ` },
  { id: 'class', name: 'Class notes', icon: '🎓', cat: 'School', desc: 'Cornell-style notes with summary.', md: `## Key questions\n- \n\n## Notes\n- \n\n## Summary\n\n> Write a 2–3 sentence summary in your own words.` },
  { id: 'assignments', name: 'Assignment tracker', icon: '🏫', cat: 'School', desc: 'Never miss a due date.', db: { views: ['table', 'calendar', 'board'], props: [['Course', 'select', ['Math', 'Physics', 'History', 'CS']], ['Due', 'date'], ['Status', 'status'], ['Grade', 'number']], rows: [{ Name: 'Problem set 1', Course: 'Math', Due: { start: inDays(3) } }, { Name: 'Essay draft', Course: 'History', Due: { start: inDays(6) } }] } },
  { id: 'content', name: 'Content calendar', icon: '📣', cat: 'Marketing', desc: 'Plan posts across channels.', db: { views: ['calendar', 'board', 'table'], props: [['Channel', 'multi_select', ['Blog', 'X', 'LinkedIn', 'YouTube', 'Newsletter']], ['Publish date', 'date'], ['Status', 'status'], ['Owner', 'person']], rows: [{ Name: 'Launch announcement', Channel: ['Blog', 'X'], 'Publish date': { start: inDays(2) } }] } },
];

const CATS = ['All', 'Work', 'Engineering', 'Sales', 'Marketing', 'Personal', 'School'];

export default function TemplatesModal({ onClose, arg }: { onClose: () => void; arg?: { into?: string } }) {
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Template>(TEMPLATES[0]);
  const list = TEMPLATES.filter((t) => (cat === 'All' || t.cat === cat) && fuzzy(q, t.name, t.desc));
  const use = (t: Template) => {
    const id = applyTemplate(t, arg?.into);
    onClose();
    goPage(id);
  };
  return (
    <Modal onClose={onClose} width={1040} top="5vh" height="86vh" className="templates-modal">
      <div className="templates">
        <aside className="tpl-side">
          <div className="search-input"><Search size={14} className="faint" /><input autoFocus placeholder="Search templates" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {CATS.map((c) => <button key={c} className={cx('set-nav', cat === c && 'active')} onClick={() => setCat(c)}>{c}</button>)}
          <div className="tpl-list">
            {list.map((t) => (
              <button key={t.id} className={cx('tpl-item', sel.id === t.id && 'on')} onClick={() => setSel(t)} onDoubleClick={() => use(t)}>
                <span className="emoji-icon">{t.icon}</span><span>{t.name}</span>
              </button>
            ))}
          </div>
        </aside>
        <section className="tpl-preview">
          <div className="tpl-head">
            <div><div className="tpl-title">{sel.icon} {sel.name}</div><div className="faint">{sel.desc}</div></div>
            <button className="btn btn-primary" onClick={() => use(sel)}>{arg?.into ? 'Use in this page' : 'Get template'}</button>
          </div>
          <div className="tpl-body">
            {sel.md && <div className="ai-md" dangerouslySetInnerHTML={{ __html: renderMd(sel.md) }} />}
            {sel.db && (
              <div>
                <div className="faint small" style={{ marginBottom: 8 }}>Database with {sel.db.views.join(', ')} views</div>
                <table className="set-table">
                  <thead><tr><th>Name</th>{sel.db.props.map(([n]) => <th key={n}>{n}</th>)}</tr></thead>
                  <tbody>{sel.db.rows.map((r, i) => <tr key={i}><td>{r.Name}</td>{sel.db!.props.map(([n]) => <td key={n} className="faint">{fmt(r[n])}</td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </Modal>
  );
}

function fmt(v: any) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object' && v.start) return v.end ? `${v.start} → ${v.end}` : v.start;
  if (typeof v === 'number' && v < 1 && v > 0) return `${Math.round(v * 100)}%`;
  return String(v);
}

export function applyTemplate(t: Template, into?: string): string {
  const st = useStore.getState();
  if (t.md) {
    const blocks = markdownToBlocks(t.md);
    if (into) {
      st.updatePage(into, { icon: st.pages[into].icon ?? t.icon, title: st.pages[into].title || t.name });
      st.setContent(into, blocks);
      return into;
    }
    return st.createPage({ title: t.name, icon: t.icon, content: blocks });
  }
  const spec = t.db!;
  const { dbId, pageId } = st.createDatabase({ inline: false, title: t.name, view: spec.views[0], parentId: into ?? null });
  st.updatePage(pageId, { icon: t.icon });
  // reset to exact schema
  Object.values(useStore.getState().pages).filter((p) => p.dbId === dbId).forEach((p) => useStore.getState().deleteForever(p.id));
  const props: Property[] = [];
  useStore.getState().updateDb(dbId, (d) => {
    d.properties = d.properties.filter((p) => p.type === 'title');
    for (const [name, type, opts] of spec.props) {
      const p = makeProperty(type, name);
      if (opts) p.options = opts.map((o, i) => ({ id: uid(), name: o, color: (['blue', 'green', 'orange', 'purple', 'pink', 'red', 'yellow', 'brown', 'gray'] as const)[i % 9] }));
      if (type === 'number' && name === 'Progress') { p.numberFormat = 'percent'; p.numberShow = 'bar'; }
      if (type === 'number' && name === 'Deal value') p.numberFormat = 'usd';
      d.properties.push(p);
      props.push(p);
    }
    d.isTasks = spec.props.some(([, ty]) => ty === 'person') && spec.props.some(([, ty]) => ty === 'status');
    d.views = [];
  });
  for (const v of spec.views) st.addView(dbId, v);
  // make the first view show everything
  useStore.getState().updateDb(dbId, (d) => {
    const all = d.properties.map((p) => p.id);
    d.views.forEach((v) => { if (v.type === 'table') v.visible = all; });
    const date = d.properties.find((p) => p.type === 'date');
    d.views.forEach((v) => { if (v.type === 'calendar' || v.type === 'timeline') v.dateProp = date?.id ?? v.dateProp; });
  });
  for (const r of spec.rows) {
    const values: Record<string, any> = {};
    for (const p of props) {
      const v = r[p.name];
      if (v == null) continue;
      if (p.options) values[p.id] = Array.isArray(v) ? v.map((n) => p.options!.find((o) => o.name === n)?.id).filter(Boolean) : p.options.find((o) => o.name === v)?.id ?? null;
      else values[p.id] = v;
    }
    st.addRow(dbId, values, undefined, r.Name);
  }
  return pageId;
}
