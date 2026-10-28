# Notion — Complete Knowledge Base (Index)

Reference compiled 2026-10-09. Sources: official Notion help center (notion.com/help), release notes (notion.com/releases, through Notion 3.7 / Sep 2026), pricing page, plus product knowledge.
Anything marked **(unverified)** came from third-party mirrors and should be double-checked.

| File | Covers |
|---|---|
| [01-core-concepts-and-ui.md](01-core-concepts-and-ui.md) | Mental model (everything is a block), workspace → teamspace → page hierarchy, every part of the app shell: sidebar, top bar, page header, `•••` page menu, Share menu, Updates, Trash, Search, Home, Inbox |
| [02-editor-and-blocks.md](02-editor-and-blocks.md) | Every block type, the `⋮⋮` block handle menu, text-selection toolbar, slash / @ / [[ / + menus, markdown autoformat, colors, columns, synced blocks, buttons, tabs, HTML blocks |
| [03-databases.md](03-databases.md) | Data sources vs databases, every property type, every view type and its settings, filters/sorts/groups/sub-items/dependencies, formulas 2.0 (all functions), relations, rollups, templates, automations, forms, charts, dashboards, permissions |
| [04-sharing-collaboration.md](04-sharing-collaboration.md) | Share menu buttons, permission levels, guests, publish to web, comments, discussions, suggested edits, mentions, reminders, notifications, page history, analytics, locking, verification |
| [05-notion-ai-and-agents.md](05-notion-ai-and-agents.md) | Notion AI, Notion Agent, Custom Agents, Skills, AI Autofill, AI Meeting Notes, Enterprise Search, Research mode, Plan mode, model picker, credits, connectors, MCP, External Agents |
| [06-other-products-and-platforms.md](06-other-products-and-platforms.md) | Notion Calendar, Notion Mail, Notion Sites, Forms, desktop / mobile / web clipper, integrations and connections, import/export, API, CLI, Workers, MCP server, Developer Platform |
| [07-settings-admin-plans.md](07-settings-admin-plans.md) | Every Settings tab and toggle, Members/Groups, Security, Identity (SSO/SCIM), Teamspaces, billing, plans and limits |
| [08-keyboard-shortcuts.md](08-keyboard-shortcuts.md) | All official keyboard, markdown and slash commands (Mac/Windows) |
| [09-changelog-2025-2026.md](09-changelog-2025-2026.md) | Timeline of releases from Notion 3.0 (Sep 2025) through 3.7 (Sep 2026) |
| [10-building-a-notion-clone.md](10-building-a-notion-clone.md) | Engineering notes: Notion's data model, block tree, permissions model, real-time sync, how to replicate each feature |

## One-paragraph summary
Notion is a connected workspace where **every piece of content is a block** (text, heading, image, database, page…). A **page** is itself a block that contains child blocks, so pages nest infinitely. A **database** is a collection of pages that share typed **properties**, shown through multiple **views** (table, board, list, gallery, calendar, timeline, chart, feed, map, form, dashboard). Workspaces are split into **teamspaces**, and access is controlled per page with inheritable permissions. Around this core Notion has added **Notion AI / Agents** (autonomous multi-step AI inside the workspace, plus scheduled/triggered Custom Agents), **Notion Calendar**, **Notion Mail**, **Notion Sites** (publishing), **Forms**, **AI Meeting Notes**, and a **Developer Platform** (API, MCP, CLI, Workers).
