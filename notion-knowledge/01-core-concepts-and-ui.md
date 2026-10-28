# 01 — Core Concepts & the App Shell (every button)

## 1. Mental model
- **Block**: the atomic unit. Every paragraph, heading, image, toggle, database, and page is a block with an `id`, `type`, `properties`/content, `parent`, and ordered `children` (content).
- **Page**: a block that has a title, icon, cover, and children. Pages can contain pages → infinite nesting (tree).
- **Database**: a container whose children are pages (rows/items). Every row is a full page with properties at the top and free-form content below.
  - Since 2025 a database can hold **multiple data sources** (each data source = its own schema + rows); views point at a data source.
- **Workspace**: top-level tenant (members, billing, settings). A user can belong to many workspaces and switch between them.
- **Teamspace**: a section of a workspace for a team (Open / Closed / Private / Default). Has its own members, owners, and permission defaults.
- **Private section**: pages only you can see (unless shared).
- **Permissions inherit** from parent to child unless overridden at a child page.
- **Backlinks**: any page that @-mentions or links to another page shows up as a backlink on the target.

## 2. App layout overview
```
┌──────────────┬──────────────────────────────────────────────────────┐
│  SIDEBAR     │ TOP BAR: breadcrumbs | Edited x ago | Share | 💬 | 🕘 | ☆ | ••• │
│              ├──────────────────────────────────────────────────────┤
│ Workspace ▾  │  [cover image]                                       │
│ Search       │  [icon]  Page title                                  │
│ Home         │  (Add icon / Add cover / Add comment / properties)   │
│ Meetings     │  ─────────────────────────────────────────────        │
│ Notion AI    │  blocks…                                             │
│ Inbox        │                                                      │
│ Favorites    │                                                      │
│ Teamspaces   │                                                      │
│ Shared       │                                                      │
│ Private      │                                                      │
│ Library/Agents│                                                     │
│ Settings     │                                                      │
│ Templates    │                                                      │
│ Trash        │                                                      │
│ Invite members│                                                     │
└──────────────┴──────────────────────────────────────────────────────┘
```

## 3. Sidebar — every element
**Workspace switcher (top-left, workspace name + icon ▾)**
- List of all workspaces you belong to (with email account grouping) → click to switch.
- `Settings` shortcut, `Invite members`.
- `Create workspace` / `Join or create workspace`.
- `Add another account`, `Log out` / `Log out all accounts`.
- `Get Mac/Windows app` (in browser).
- `•••` next to email: options for the account.

**Top icons next to workspace name**
- `«` **Close sidebar** (`Cmd/Ctrl + \`). Hover the left edge to peek it again; `»` re-opens.
- **New page** (pencil/compose icon) → creates an untitled page in Private (or opens "new page" modal where you can choose a location/template/AI).

**Fixed navigation items**
- **Search** (`Cmd/Ctrl+K` / `P`): modal search with filters (see §8).
- **Home**: personalized dashboard — greeting, Recently visited cards, Upcoming events (calendar), My tasks (from task databases), Learn/Featured templates, Agents. Each widget has `•••` to hide/reorder; "Customize home" toggles.
- **Meetings**: AI Meeting Notes hub — list of past/upcoming meetings, `Start transcribing`, calendar-linked meeting notes.
- **Notion AI** (Agent): opens the AI chat (full page or side panel).
- **Inbox**: notifications (see 04). Filters: All / Mentions / Unread / Archived; per-item "Mark as read", "Archive"; Inbox catch-up (AI groups notifications).
- **Library / Agents**: directory of Custom Agents (browse, pin, create) — added May 2026. 2026 sidebar redesign also introduced **customizable sidebar tabs**.

**Sections (collapsible, hover to show `•••` and `+`)**
- **Favorites**: pages you starred. Drag to reorder.
- **Teamspaces**: each teamspace header with icon; hover → `•••` (Teamspace settings, Leave teamspace, Archive, Copy link, Pin/unpin) and `+` (add page in teamspace). Below: "Browse teamspaces / Create teamspace".
- **Shared**: pages shared with you or you shared with specific people outside teamspaces.
- **Private**: your private pages. `+` adds a page.
- **Agents**: (2026) your pinned Custom Agents.

**Each page row in the sidebar**
- `▸` toggle to expand children (shows "No pages inside" if empty).
- Icon + title. Click = open; `Cmd/Ctrl+click` = new tab (desktop); drag = move/reorder/nest.
- Hover → `•••` menu: Add to Favorites / Remove from Favorites, Copy link, Duplicate (`Cmd/Ctrl+D`), Rename (`Cmd/Ctrl+Shift+R`), Move to (`Cmd/Ctrl+Shift+P`), Move to Trash (Delete), Open in new tab, Open in side peek, Turn into wiki (for teamspace pages), Last edited by… line.
- Hover → `+` adds a sub-page.

**Bottom of sidebar**
- **Settings** (and in older layout "Settings & members").
- **Marketplace / Templates**: template gallery (categories: Work, Personal, School, Life, AI templates, Agents) with Preview / Get template.
- **Trash**: modal listing deleted pages with search, filter by "Last edited by", "In" (location), Teamspaces; per item `↩ Restore` and `🗑 Delete permanently`. Pages auto-delete after 30 days (or per plan retention).
- **Invite members** button.
- **Help & support (`?` bottom-right of page)**: Help & documentation, Send feedback, Keyboard shortcuts, What's new, Join community, Twitter, Terms & privacy, Status, version number.
- **Sidebar resizing**: drag the right edge.

## 4. Top bar (page header bar) — every button
Left side:
- **Breadcrumbs**: path of parent pages; click any to navigate. Hover shows sibling pages (Apr 2026). Truncates with `…` that expands.
- **Lock icon / "Private"/teamspace label** showing location and access.
- `← →` back/forward (desktop app).
Right side:
- **"Edited Xm ago"**: hover shows last editor; click opens page Updates/history.
- **Share**: opens Share menu (see 04).
- **Comments icon** (💬): opens comments side panel (All / Open / Resolved filters).
- **Updates / Clock** (🕘): page updates panel — all edits, comments, version timestamps; "View all" → Page history.
- **Favorite star** (☆): add to Favorites.
- **AI icon / "Ask AI"**: opens Notion Agent in side panel with page as context.
- **`•••` page menu** (below).
- On database pages: **Open as page / Open in full page** and view controls.

### `•••` Page menu (top-right) — every item
- Search actions box at top.
- **Style**: Default / Serif / Mono font choice (three "Ag" tiles).
- **Small text** toggle.
- **Full width** toggle.
- **Customize page**: show/hide Backlinks (Expanded / In popover / Off), Page comments (Expanded / Off), top-of-page discussions.
- **Lock page** (prevents accidental edits; editors can unlock). For databases: Lock database (structure & views).
- **Add to Favorites**.
- **Copy link**, **Duplicate**, **Move to**, **Move to Trash**.
- **Undo** (`Cmd/Ctrl+Z`).
- **Page history** (version list with Restore, retained per plan: 7/30/90 days/unlimited).
- **Show deleted pages** (Trash for subpages).
- **Notifications**: Comments & replies / All comments / Off ("Updates to this page").
- **Translate** (AI) to a language.
- **Import** (into this page).
- **Export**: Markdown & CSV, HTML, PDF (Plus+ for full PDF options); options: Include content (Everything/No files & images), Include subpages, Create folders for subpages, Page format (A4/Letter…), Scale.
- **Connections / Add connections**: integrations that can access the page.
- **Turn into wiki** (makes database with verification/owner).
- **Turn into page in Sites** / Publish.
- **Page analytics** (views, unique viewers, editors — Plus/Business).
- **Word count** footer: "Word count: N · Last edited by … · Today".
- Desktop: **Open in browser / Open in Mac app**, **Open in new tab/window**.

## 5. Page header area (above title)
Hover the title area to reveal:
- **Add icon** → picker: Emoji (search, skin tone, Random, Remove), Icons (Notion icon set with color), Upload (image/URL, recommended 280×280), Link.
- **Add cover** → random cover appears; hover cover: **Change cover** (Gallery collections incl. Met Museum, NASA, Texturelabs, Pomological, solid colors/gradients; Upload; Link; Unsplash search), **Reposition** (drag, Save position), **Remove**.
- **Add comment** (page-level discussion at top).
- **Add verification** (wiki pages / Business+).
- **Add property** on database pages; properties list with "N more properties" collapse; property visibility per property: Always show / Hide when empty / Always hide.
- **Backlinks** ("N backlinks") popover.
- **Page title**: H1-style text; `Enter` moves into body.
- Empty page state shows quick-starts: "Ask AI", "AI Meeting Notes", "Database", "Form", "Templates", "Import", and template suggestions (Table, Board, List…), plus "Press Enter to continue with an empty page".

## 6. Side peek / Center peek / Full page
- Opening a database item can show as **Side peek** (right panel), **Center peek** (modal), or **Full page** — set per view ("Open pages in" option).
- Peek header buttons: `⤢` Open as full page, `⇅` previous/next item (`Ctrl+Shift+K/J` Mac), copy link, comments, `•••`, close `×`.

## 7. Tabs & windows (desktop)
- Notion desktop supports **browser-style tabs** (`Cmd/Ctrl+T` new tab, `Cmd/Ctrl+W` close, `Cmd+Click` opens link in new tab), multiple windows (`Cmd/Ctrl+Shift+N`), and split view (2025+: open a page side-by-side).
- Notion Calendar & Mail can be opened from the app switcher.

## 8. Search (`Cmd/Ctrl+K` or `P`)
- Type query → results grouped: Best matches, recent pages, AI answer ("Ask AI" button turns query into AI search across workspace + connected apps = **Enterprise Search**).
- Filters: **Title only** toggle, **Created by**, **In** (teamspace/page), **Date** (Today, Last 7/30 days, custom), **Teamspaces**, **Sort** (Best matches, Last edited newest/oldest, Created newest/oldest), connected-app sources (Slack, Google Drive, GitHub, Jira, Teams, SharePoint, etc.).
- Keyboard: `↑↓` navigate, `Enter` open, `Cmd/Ctrl+Enter` open in new tab, `Shift+Enter`/side-peek.
- Recent pages shown when query is empty.
- Command-palette style actions are also searchable (e.g., "Keyboard shortcuts", "Toggle dark mode").

## 9. Home (details)
- Widgets: **Recently visited**, **Upcoming events** (needs Notion Calendar connect: "Connect calendar"), **My tasks** (pulls from any database marked as a Tasks database with Assignee/Status/Due), **Featured templates / Learn**, **Agents**.
- Each widget `•••`: Hide widget, settings (e.g., which task databases).
- Mobile (May 2026): Home tab with Home, Chats, Meetings, Inbox one swipe apart.

## 10. Trash
- Soft-deleted pages; restore puts back to original parent (or to Private if parent gone).
- Database rows deleted go to the database's own "Deleted pages".
- Permanent delete requires full access; admins can bulk restore (Enterprise admin content search).

## 11. Page types / quick creates
- Empty page, Page from template, Database (full page or inline), Form, Wiki, AI Meeting Notes page, Import (from file/app), Link to existing page.
- **Wiki**: a page converted to a database with Owner and Verification properties, a "Home" view, and verification expiry.
- **Projects & tasks template**: linked Projects/Tasks databases with sprints, sub-tasks, dependencies.
