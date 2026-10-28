# 07 — Settings, Admin & Plans

Open: sidebar **Settings** (modal with left nav). Sections split into **Account** and **Workspace**. Names below follow the 2025–2026 layout; exact labels may shift slightly.

## Account
### My account / Profile
- Photo (upload/remove), Preferred name, Email (Change email), Password (Set/Change), **2-step verification** (authenticator app / SMS / passkeys), **Passkeys**, Support access toggle (grant Notion support temporary access), **Log out of all devices**, Devices list, **Delete my account**, Leave workspace.
### Preferences
- **Appearance**: Use system setting / Light / Dark; **High contrast** (Jul 2026).
- **Language** (EN, KO, JA, FR, DE, ES, ES-LatAm, PT-BR, ZH-CN, ZH-TW, DA, FI, NL, NB, SV, TH, RU, VI, ID…), **Always show direction controls** (RTL).
- **Start week on Monday**.
- **Set timezone automatically** / Timezone.
- **Open on start**: Last visited page / Home / specific page.
- **Open links in desktop app** (web).
- **Show page view count / analytics privacy** ("Save my view history on pages").
- **Cookie settings**, **Profile discoverability** (show in other workspaces).
- **Spellcheck**, **Autocorrect/AI autocomplete** toggles; **Default database view open behavior**.
### Notifications
- Mobile push, Slack, Email (activity, always send email, page updates, workspace digest, marketing), Desktop sound, Calendar notifications.
### Connections (personal) — see 06 §9; unified tab since May 2026.
### Mail & Calendar (Apr 2026)
- Connect calendar & inbox (Google, Outlook) for agent scheduling/email.

## Workspace
### General
- Workspace name, Icon (emoji/upload), **Domain** (`notion.so/yourdomain`), **Public home page**, **Export all workspace content** (Markdown/CSV, HTML, PDF), **Export members as CSV**, **Analytics** (allow view history), **Delete entire workspace**, workspace ID (developer).
### People (Members / Guests / Groups / Invite links)
- Members table: name, email, role (Workspace owner / Membership admin / Member / Guest), teamspaces, last active; filter/search; change role, remove; **Add members** (emails + role), **Invite link** (enable/reset), **Allowed email domains** (auto-join), Groups (create, add members, use for sharing), Guests list with page access.
### Teamspaces
- Default teamspaces, **Limit teamspace creation to owners**, list of teamspaces with owner, members, access type, `•••` (Settings, Archive, Leave, Delete).
- Teamspace settings modal: General (name, icon, description), Members (add, roles), Security (disable export, guests, public sharing, duplicating, moving pages out — Enterprise), Permissions (default member permission), Leave/Archive.
### Security
- Disable publishing to web, Disable duplicating pages to other workspaces, Disable export, Disable guests / guest invite requests, Allow members to request adding guests, Allow page access requests from non-members, **Allow members to invite to workspace**, Link sharing expiry, **Restrict file downloads**, **Disable Notion AI / AI web search** (AI section), **Workspace-level permission defaults**.
### Identity & provisioning (Business: SAML SSO; Enterprise: SCIM)
- **Domain verification** (DNS TXT), **SAML SSO** (IdP metadata, enforce SSO, linked workspaces), **SCIM** tokens (Okta, Azure AD/Entra, OneLogin, Google), **Managed users** dashboard, session duration, **Claim users** in domain.
### Notion AI
- **General**: enable AI features, model controls (allowed models for Notion Agent & Custom Agents, default model — Sep 2026), web search toggle, meeting notes settings (consent, retention).
- **Agents**: who can create Custom Agents (users/groups), approval policies.
- **AI connectors**: Slack (private content access), Drive, GitHub, Jira, Teams, SharePoint, Salesforce, Box, Asana…; enable/disable per workspace.
### Notion credits
- Credits balance, buy credits, auto-recharge, **credits dashboard** (usage by agent/Workers, spend trends), per-agent limits, workspace limit (Enterprise).
### Connections (workspace)
- Installed integrations, MCP, API connections, **who can install integrations** (owners only / members), audit.
### Public pages / Sites
- List of published pages & sites with Unpublish; **Shared AI chats** links.
### Developer (Aug 2026)
- Enable developer features, developer portal, Workers, tokens, run logs.
### Import
- Importers list (see 06 §8).
### Emoji
- **Custom emoji**: upload image, name `:name:`; manage list.
### Billing / Plans / Upgrade
- Current plan, seats, billing cycle (monthly/annual), payment method, invoices, billing email/address, VAT/tax ID, cancel/downgrade, credits purchase, add-ons (custom domains).
### Audit log, Admin content search, Workspace analytics (Enterprise)
- **Audit log**: filter by event, actor, date; export CSV; includes Custom Agent activity (Jul 2026).
- **Content search**: admins find any page and change access.
- **Data retention** policies, **Legal hold**, **SIEM** & **DLP** integrations, **Organization**/multi-workspace admin console.

## Plans & pricing (notion.com/pricing, Oct 2026)
| | Free | Plus | Business | Enterprise |
|---|---|---|---|---|
| Price/member/mo | $0 | $10 | $20 | Custom |
| Blocks | Unlimited for 1 person; limited for 2+ members | Unlimited | Unlimited | Unlimited |
| File upload | 5 MB/file | ~5 GB/file | ~5 GB/file | ~5 GB/file |
| Page history | 7 days | 30 days | 90 days | Unlimited |
| Guests | 10 | Unlimited | Unlimited | Unlimited |
| Charts | 1 | Unlimited | Unlimited | Unlimited |
| Forms | Basic | Custom (no branding) | + Conditional logic | + Conditional logic |
| Sites | 1 | 5 | 5 | 5 |
| Notion AI | Limited trial | Limited trial | Full (Agent, Meeting Notes, Enterprise Search) | Full + zero data retention |
| Security | — | — | SAML SSO, granular DB permissions, private teamspaces, page verification, domain verification | SCIM, audit log, SIEM/DLP, admin roles, retention, workspace consolidation |
| Offline | Pick pages | Recents & Favorites auto | Same | Same |
- Annual billing saves up to 20%. Plus free for students/educators (individual).
- **Custom Agents & Workers**: Notion credits, $10 per 1,000 credits/month.
- Custom domain add-on: $8/mo per domain annual, $10 monthly.
