# Moving

Moving is a local-first, Notion-style workspace. You get block-based docs, databases with eight more views alongside the table, comments, sharing and publishing, templates, and an AI assistant (Moving AI) powered by Claude.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/
npm run typecheck
```

Your data is saved in the browser (IndexedDB), so there is no server and no sign-up. To use Moving AI, paste an Anthropic API key in **Settings → Moving AI**. The key stays in this browser and is sent only to `api.anthropic.com`.

## What's inside

| Area | Features |
|---|---|
| **Editor** | Block types: text, H1–H4, to-do, bullet, numbered, toggle, toggle headings, quote, callout, divider, code (60 languages and Mermaid diagrams), block equation (KaTeX), image, video, audio, file, PDF, bookmark, embed (YouTube, Figma, Maps, Loom, …), simple table, page, link to page, inline and linked databases, table of contents, breadcrumb, button, synced block, tabs, 2–5 columns |
| **Editing** | Slash menu, Markdown shortcuts (`#`, `-`, `[]`, `>`, `"`, `` ``` ``, `---`, `**bold**`, `$$math$$`), `@` mentions (people, pages, dates, `@remind`), `[[` page links, `:emoji`, selection toolbar (bold, italic, underline, strike, code, equation, link, color, comment, Ask AI), drag handle with block menu (turn into, color, duplicate, move to, copy link), drag-and-drop to reorder or make columns, drag blocks onto sidebar pages, marquee multi-select, undo/redo, paste of Markdown/HTML/URLs/images |
| **Databases** | 21 property types (formula, relation, rollup, status, unique ID, button, …), plus a formula engine with about 100 functions. Views: table, board, list, gallery, calendar, timeline, chart, feed, form. Filters with AND/OR groups, multi-sort, grouping, table calculations, row templates with defaults, automations, CSV import/export, locking, side/center/full-page peek |
| **Workspace** | Multiple workspaces, teamspaces, a nested page tree with drag to reorder or nest, favorites, Home dashboard, Inbox, search (`⌘K`) with filters, Trash with restore, page history with restore, backlinks, template gallery |
| **Collaboration** | Comments and threads with reactions, mentions and resolve; Share menu with roles and general access; publish to web (read-only public route); reminders and notifications |
| **AI** | Inline AI (space on an empty line, or select text → Ask AI): write, summarize, action items, improve, translate, change tone. A Moving AI chat agent with tools to search, read, create and append pages. AI Meeting Notes (browser speech-to-text, then a summary) |
| **Customization** | Light, dark or system theme, high contrast, per-page fonts (default, serif, mono), small text, full width, icons (emoji, custom, upload), covers (gradients, upload, link, photos), custom emoji |

## Project layout

```
src/
  store/      types, Zustand + immer store, seed data
  editor/     block editor (Editor, BlockList, RichText, ops, menus, blocks/)
  database/   DatabaseView, views/, PropValue, PropertyMenu, FilterSort, logic
  formula/    Notion-style formula engine
  components/ app shell: Sidebar, Topbar, PageView, Peek, modals/, ai/
  lib/        router, markdown import/export, AI client, emoji, utilities
  styles/     base tokens, app, editor, database, views CSS
```

## Limits of local-first mode

Everything works offline in one browser. Inviting people, sharing roles and published links are stored locally, so other people won't see your workspace unless a sync server is added later.
