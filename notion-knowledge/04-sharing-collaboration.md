# 04 — Sharing, Permissions & Collaboration

## 1. Share menu (top-right "Share") — two tabs
### Tab "Share"
- **Invite field**: "Email or group, separated by commas" → pick people/groups/guests → choose permission → **Invite** (optional message).
- **People with access** list: each row with permission dropdown (Full access / Can edit / Can edit content / Can comment / Can view / Remove). Inherited access shows "From parent page/teamspace" with link to "Restrict"/edit at source.
- **General access** dropdown:
  - *Only people invited* (private)
  - *Everyone at [Workspace]* (with permission level)
  - *Teamspace members* (if in teamspace)
  - *Anyone on the web with link* (publish; with permission: Can view / Can comment / Can edit for link)
- **Share with Custom Agent** (Aug 2026): give an agent access to this page/database.
- Buttons: **Copy link**, **Learn about sharing**, link expiration (Enterprise), "Allow search engines" when web-shared.
### Tab "Publish" (Notion Sites)
- **Publish** button → site URL `yourname.notion.site/page`.
- Options: **Link expires** (Plus+), **Allow editing**, **Allow comments**, **Allow duplicate as template**, **Search engine indexing**, **Site customization** (domain, header/nav, theme light/dark/system, favicon, Google Analytics ID, social preview image, custom domain add-on), **View site**, **Unpublish**.

## 2. Permission levels
| Level | Can |
|---|---|
| **Full access** | Edit, share with others, change permissions, delete. |
| **Can edit** | Edit content and (for DBs) structure, but not share. |
| **Can edit content** | Databases only: edit rows/values, but not properties/views. |
| **Can create pages** | Databases only (Apr 2026): add rows without seeing/editing others. |
| **Can comment** | View + comment. |
| **Can view** | Read-only. |
| **No access** | Removed (explicit restriction under teamspace/parent). |

## 3. Members, guests, groups
- **Workspace owners** (billing, settings, all), **Membership admins** (Enterprise: manage members/groups), **Members**, **Guests** (external, per-page access; Free plan limit 10 guests).
- **Groups** (Settings → People → Groups): share with groups at once.
- **Teamspace roles**: Teamspace owner, member; teamspace types Default (everyone auto-joins), Open, Closed (visible, request to join), Private (hidden, Business+).
- **Guest invite requests** (Enterprise): members request; admins approve.

## 4. Comments & discussions
- Start: select text → Comment, block handle → Comment, page top → "Add comment", or `Cmd/Ctrl+Shift+M`.
- Comment box: rich text, @mentions, attachments (📎), emoji reactions, **Send** (`Enter` / `Cmd+Enter`).
- Thread actions (`•••`): Edit, Delete, Copy link to discussion, **Resolve** (✓), Re-open, **Mute replies** (Apr 2026; auto-unmute on @mention).
- Comments panel (top bar 💬): filter Open/Resolved/All, jump to location.
- Page-level discussions above content; database rows show comments under properties.
- AI can summarize discussions; agents reply in comment threads when @-mentioned.

## 5. Suggested edits
- Turn on **Suggest edits** (from `•••` or text toolbar). Changes appear as green inserts/red strikethrough with author.
- Reviewer buttons: **Accept ✓**, **Reject ✕** each suggestion, or Accept all/Reject all; comment on suggestions.
- Agents can suggest edits instead of editing directly (Aug 2026).

## 6. Mentions & reminders
- `@person` notifies, `@page` links (creates backlink), `@date`/`@remind` with reminder times (At time of event, 5/10/30 min before, 1 hour, 1 day, 2 days, 1 week before; 9am on day of event…).
- Person property assignment can notify.

## 7. Notifications & Inbox
- Inbox shows: mentions, comments/replies, page invites, edits on followed pages, reminders, property assignment, automation notifications, agent messages, access requests.
- Settings → Notifications: Mobile push (activity/changes), Slack notifications (DM by Notion), Email notifications (Activity in workspace, Always send email, Page updates, Workspace digest, Announcements & updates), desktop notification sound.
- Per-page follow: `•••` → Notifications (Comments & replies / All updates / Off).
- Inbox catch-up (3.7): AI groups notifications.

## 8. Page history & updates
- **Updates panel** (clock icon): edit events by person/time, "show all versions".
- **Page history**: preview prior versions, **Restore version**; retention: Free 7 days, Plus 30, Business 90, Enterprise unlimited.
- **Undo** `Cmd/Ctrl+Z`, **Redo** `Cmd/Ctrl+Shift+Z`.

## 9. Page analytics
- Hover title → views count; `•••` → Analytics: total views, unique viewers, graph over time, list of viewers and editors (Business includes editors list). Workspace owners can disable.
- Workspace analytics (Enterprise): members, page views, search.

## 10. Real-time collaboration
- Live cursors/avatars at top showing who's viewing; avatars appear beside blocks being edited; changes sync in real time (operation-based transaction sync).
- Click an avatar → jump to where they are.

## 11. Locking & verification
- **Lock page**: prevents editing until unlocked (anyone with edit can unlock) — guardrail, not permission.
- **Verify page** (Business+ / wikis): Verified by user, expiry date; shows badge; expires → "Verification expired".

## 12. Access requests
- Users without access see "Request access" with message; owners get notification with **Approve with role** / **Deny**.

## 13. Sharing with integrations / agents
- `•••` → **Connections** → add integration/agent to page; it inherits to children.
- Share menu → share with Custom Agent.

## 14. Duplicating & templates for others
- **Duplicate as template** on public pages (top-right "Duplicate" button for visitors).
- **Template links** to share copies.
