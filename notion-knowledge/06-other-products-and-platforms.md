# 06 — Other Products, Apps & Developer Platform

## 1. Notion Calendar (formerly Cron)
- Desktop (Mac/Win), web, iOS/Android. Connects Google Calendar & (2025+) iCloud/Outlook accounts; multiple accounts.
- Layout: left mini-month + calendar list (toggle visibility/colors), main grid (Day / Week / Month / custom N days), right event panel.
- Event panel: title, time, time zones, repeat, participants (availability), conferencing (Google Meet / Zoom / Teams), location, description, **attach Notion page/doc**, **Create meeting notes** (Notion page + AI transcription), RSVP Yes/No/Maybe, notifications, color, visibility, busy/free.
- Features: **Share availability** (select slots → copy text/link), **Scheduling links** (booking pages with durations/buffers), **Time zones** column(s), **Menu bar app** (upcoming + join), **Join meeting** button/`Cmd+J`, Notion database dates shown as a calendar layer, Command menu `Cmd+K`, keyboard-first (`T` today, `J/K` next/prev, `C` create, `D/W/M` views, `Shift+…` many more), focus time, event types, dark mode.
- Agent calendar tools (Jul 2026): view/manage schedule, find shared availability, send invites, join calls.

## 2. Notion Mail
- Launched Apr 2025: AI-organized Gmail client. Features: **Auto-label** with AI (custom labels by natural language), **Views** (split inbox like database views), **Snippets** (templates), **Schedule send / Snooze / Undo send**, **AI drafts & replies**, **Scheduling** (insert availability), keyboard-first `Cmd+K`, Notion page mentions, multi-account (Jan 2026), Outlook support via agent connection (Jul 2026).
- **(unverified)**: a third-party mirror of a Notion help page says Notion Mail is shutting down on Sep 22, 2026, with Mail features moving into Notion Agent via Mail & Calendar connections (Settings, Apr 2026). Check official sources.

## 3. Notion Sites (publishing)
- Publish any page → `*.notion.site`. Settings: site name/domain, **custom domain** (add-on $8–10/mo), **navigation header** with links, **theme** (light/dark/system), **favicon**, **social image/preview**, **Google Analytics**, **SEO** (indexing, title/description), **Allow duplicate as template**, **comments/edit**, **link expiration**. No native password protection.
- Free: 1 site; Plus+: 5 sites. Analytics on sites.

## 4. Notion Forms
- See 03 §11. Public link, embed, conditional logic (Business+), anonymous submissions, notify on response.

## 5. Desktop app (Mac/Windows; Linux unofficial)
- Tabs, multiple windows, split view, offline mode (Free: choose pages to download; Plus+: Recents & Favorites auto-download), menu bar/tray quick note, "Open links in desktop app" setting, voice dictation, AI Meeting Notes system audio capture, quick search `Cmd+Shift+…` global shortcut configurable, zoom, spell-check languages, launch at startup.

## 6. Mobile apps (iOS/Android)
- Bottom tabs: Home, Search, Inbox, New page/Agent; 2026 home tab (Home, Chats, Meetings, Inbox). Widgets (iOS/Android home screen: Favorites, Quick add, a page), share extension (save links/text to a page/DB), Siri/Shortcuts, offline, AI Notes one-tap transcription, Agent chat.
- **Notion Agents iOS app** (Jul 2026): capture ideas, voice notes, photos, prep meetings, background tasks.
- Mobile editor toolbar: `+` add block, AI, Turn into, Text style, Mention, Comment, Indent/Outdent, Move up/down, Color, Undo/Redo, Delete, hide keyboard.

## 7. Web Clipper
- Browser extension (Chrome, Firefox, Safari): save page to a page or database; choose workspace & destination, edit title; mobile share sheet.

## 8. Import & export
- **Import from**: Text & Markdown, CSV, HTML, Word (.docx), Google Docs, Evernote, Confluence, Trello, Asana, Jira, Monday, Quip, Dropbox Paper, Workflowy, Hackpad, ClickUp, Airtable, Excel, PDF (beta via AI). Unverified: Coda, OneNote.
- **Export**: Markdown & CSV (zip), HTML, PDF; workspace-wide export (Settings → General → Export all workspace content); Enterprise: export members, audit log CSV.

## 9. Integrations / connections
- **Link previews** (GitHub, Jira, Figma, Slack, Asana, Trello, Zoom, Google Drive…), **Synced databases** (Jira, GitHub, Asana, Linear, Google Drive sync → live database), **Slack** (notifications, unfurl, create pages from messages, Custom Agents in channels), **Microsoft Teams**, **Zapier/Make/n8n**, **Google Drive/OneDrive**, **Gmail/Outlook**, **Salesforce**, **Box**, **HubSpot**, etc.
- Plans: basic connections (Slack, Drive) Plus; premium (GitHub, Asana) Business; Security & compliance (SIEM, DLP) Enterprise.

## 10. Public API (developers.notion.com)
- REST, version header `Notion-Version` (2022-06-28 → 2025-09-03 introduced data sources).
- Resources: **Pages** (create, retrieve, update properties, archive/trash, move), **Blocks** (retrieve, children list/append, update, delete), **Databases** & **Data sources** (create, query with filter/sort, update schema), **Users**, **Comments** (create, list), **Search**, **File uploads** (single & multi-part), **Webhooks** (page.created/updated, database events, comment.created…), **Meeting notes** (Apr 2026), **Markdown API** (read/write pages as Markdown, May 2026), **Custom Agent Insights** (3.7).
- Auth: Internal integration tokens, Public OAuth integrations, workspace-scoped OAuth & **personal access tokens** (May 2026; any member can build connections).
- Limits: ~3 requests/sec avg per integration, 100 blocks per append, 2000-char rich text segments, pagination via `start_cursor` (100 max page size).
- Developer bar (Aug 2026): copy IDs/API object for pages, DBs, blocks, users.

## 11. Notion MCP server
- Hosted MCP (mcp.notion.com) with OAuth for AI tools: search, fetch, create/update pages, DBs, comments, meeting transcripts, Sites. 91% fewer tokens for DB create/update (May 2026). Admin controls for audit & approved tools.

## 12. Developer Platform (Notion 3.5, May 2026)
- **Notion Workers**: hosted runtime for custom code — sync any API into databases, custom deterministic tools for agents, webhook triggers. Free in beta; runs on Notion credits from Aug 11, 2026; shareable to team ("Can connect" / "Full access").
- **Notion CLI** (binary name unverified) — sign in, read/act in Notion, build & deploy Workers; curl installer, Windows via npm.
- **Agent SDK** (beta, 3.7): embed Notion agents in other apps, continue conversations, stream results.
- **External Agents API** (alpha).
- **Developer Portal** inside Notion (Settings → Developer → Enable developer features): Workers, connections, tokens, run logs.
