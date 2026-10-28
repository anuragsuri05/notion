# 10 — Engineering Notes: How Notion Works & How to Clone It

## 1. Data model (Notion's real architecture, simplified)
Notion stores everything as rows in a `block` table (Postgres, sharded by workspace).
```ts
type Block = {
  id: string;              // UUID
  type: 'page' | 'text' | 'header' | 'sub_header' | 'sub_sub_header' | 'to_do'
      | 'bulleted_list' | 'numbered_list' | 'toggle' | 'quote' | 'callout' | 'divider'
      | 'code' | 'image' | 'video' | 'file' | 'bookmark' | 'embed' | 'equation'
      | 'table' | 'table_row' | 'column_list' | 'column' | 'collection_view'
      | 'collection_view_page' | 'transclusion_container' /* synced */ | 'button' | ...;
  properties: Record<string, RichText>;  // e.g. { title: [["Hello", [["b"]]]] }
  format?: Record<string, any>;          // icon, cover, width, color, block_color, page_full_width…
  content: string[];                     // ordered child ids
  parent_id: string; parent_table: 'block' | 'collection' | 'space';
  space_id: string;                      // workspace
  created_by: string; created_time: number;
  last_edited_by: string; last_edited_time: number;
  alive: boolean;                        // soft delete (trash)
  permissions?: Permission[];            // only on pages that override
  version: number;
};
type Collection = {                      // database / data source
  id: string; parent_id: string; name: RichText;
  schema: Record<propId, { name: string; type: PropType; options?: Option[]; ... }>;
};
type CollectionView = { id: string; type: 'table'|'board'|...; query: {filter, sort, group}; format: {...visible props, widths}; };
// Database rows are Blocks with parent_table='collection'; their property values live in block.properties keyed by propId.
```
- **Rich text** is an array of `[text, annotations[]]` segments: annotations like `b`, `i`, `s`, `c` (code), `_` (underline), `a` (link url), `h` (color), `p` (page mention), `u` (user mention), `d` (date), `e` (equation), `m` (comment id).
- **Ordering**: parent holds `content` array of child IDs (not fractional indexes). Clone alternative: fractional indexing (`lexorank`) for fewer conflicts.

## 2. Real-time sync
- Client builds **transactions** of **operations** (`set`, `update`, `listBefore`, `listAfter`, `listRemove`) against record paths; sends to `/api/v3/saveTransactions`; server applies, bumps `version`, broadcasts via WebSocket ("message store") to subscribers of those records.
- Client-side: local cache (SQLite in desktop/mobile, IndexedDB in web) → instant UI, optimistic updates, offline queue.
- Conflict handling: last-writer-wins at property level; text merging improved over time (CRDT-like for text since offline mode 2025).
- Clone options: **Yjs** or **Automerge** CRDT per page + y-websocket/Hocuspocus; or Liveblocks / PartyKit; or Supabase/Firebase realtime with LWW per block.

## 3. Permissions model
- Permissions stored on page blocks; effective permission = walk up ancestors until explicit permission found; most permissive across user, groups, teamspace, workspace, public. Explicit restriction on child overrides.
- Roles: none < read (view) < comment_only < read_and_write (edit) < editor (full access); DB-specific: `edit content`, `create pages`; row-level via person property rules.

## 4. Editor implementation choices
- Notion uses its own contenteditable-per-block editor. Clone stacks:
  - **BlockNote** (built on ProseMirror/TipTap, Notion-like out of the box: slash menu, drag handles, side menu, Yjs collab).
  - **TipTap** + extensions (Notion-like template), **Lexical** (Meta), **Plate** (Slate-based, has Notion-style components), **Editor.js** (block-based JSON).
- Must-have UX: slash menu with fuzzy search, `⋮⋮` drag handle + block menu, floating selection toolbar, markdown input rules, `@` mentions, `[[` page links, nesting with Tab, multi-block selection, columns via drag, undo/redo, copy/paste Markdown/HTML.

## 5. Feature-by-feature build plan (MVP → advanced)
1. **Auth & workspaces** (NextAuth/Clerk/Supabase Auth; workspace switcher).
2. **Sidebar page tree** (recursive, lazy-load children, drag-and-drop with dnd-kit, favorites, private/shared/teamspace sections, trash with restore).
3. **Page view**: icon (emoji-mart picker), cover (upload/Unsplash, reposition), title, editor, full-width/small-text/font toggles.
4. **Block editor** (BlockNote/TipTap) with all basic blocks, media upload (S3/UploadThing/Supabase Storage), code highlighting (Shiki), KaTeX, Mermaid.
5. **Search** (Postgres full-text / Meilisearch / Typesense) + `Cmd+K` palette (cmdk library).
6. **Sharing**: invite by email, roles, inherited permissions, publish to web (public route `/{slug}`).
7. **Databases**: schema editor, property types, table view (TanStack Table + virtualization), board (dnd-kit), calendar (custom / FullCalendar), gallery, list, timeline, chart (Recharts/visx), filters (AND/OR groups), sorts, groups, relations/rollups, formula engine (write parser or use a sandboxed expression evaluator), templates, forms.
8. **Comments & mentions & inbox** notifications.
9. **Realtime collaboration** (Yjs + presence cursors).
10. **Page history** (snapshots every N minutes / per session; diff view).
11. **AI** (Claude API — e.g. `claude-opus-5-5` / `claude-sonnet-5-5`): writing actions on selection, chat with page context, agent with tools (search_pages, create_page, update_block, query_database) via tool use; RAG over pages with embeddings (pgvector).
12. **Import/export** (Markdown/CSV/HTML/PDF), **API**, dark mode, mobile responsive, keyboard shortcuts (see 08).

## 6. Suggested stack for a clone
- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui; Postgres (Supabase/Neon) + Prisma/Drizzle; Yjs + Hocuspocus for collab; BlockNote editor; dnd-kit; cmdk; TanStack Table/Virtual; Zustand/React Query; S3-compatible storage; Meilisearch; Anthropic SDK for AI.

## 7. Notion's visual design tokens (approx.)
- Font stack: `ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI Variable Display", "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif`; Serif: `Lyon-Text, Georgia, ui-serif`; Mono: `iawriter-mono, Nitti, Menlo, Courier, monospace`.
- Page width ~708px content (900px with padding), full width option; title 40px bold; H1 30px, H2 24px, H3 20px; body 16px, line-height 1.5.
- Light: background `#FFFFFF`, text `rgb(55,53,47)` (#37352F), sidebar `#F7F7F5`/`#FBFBFA`, hover `rgba(55,53,47,0.08)`, borders `rgba(55,53,47,0.09)`, blue accent `#2383E2`.
- Dark: background `#191919`, sidebar `#202020`, text `rgba(255,255,255,0.81)`.
- Text colors (light): gray `#787774`, brown `#9F6B53`, orange `#D9730D`, yellow `#CB912F`, green `#448361`, blue `#337EA9`, purple `#9065B0`, pink `#C14C8A`, red `#D44C47`.
- Background colors (light): gray `#F1F1EF`, brown `#F4EEEE`, orange `#FBECDD`, yellow `#FBF3DB`, green `#EDF3EC`, blue `#E7F3F8`, purple `#F6F3F9`, pink `#FAF1F5`, red `#FDEBEC`.
- Select option tag colors: Default, Gray, Brown, Orange, Yellow, Green, Blue, Purple, Pink, Red (pill, 3px radius, 14px text).
- Radius 3–6px; subtle shadows `rgba(15,15,15,0.05) 0 0 0 1px, rgba(15,15,15,0.1) 0 3px 6px, rgba(15,15,15,0.2) 0 9px 24px` for menus.
