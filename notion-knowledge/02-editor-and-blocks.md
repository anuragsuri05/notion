# 02 — The Editor & Every Block

## 1. How editing works
- Each line is a block. `Enter` = new block (same type for lists); `Shift+Enter` = soft line break inside block.
- `Backspace` at the start of a styled block turns it into plain text; again merges with previous block.
- `Tab`/`Shift+Tab` nest/un-nest (children). Any block can have children (indented); toggles/lists show them.
- Hover any block → left gutter shows **`+`** (insert block below; `Option/Alt+click` inserts above) and **`⋮⋮` drag handle** (click = block menu, drag = move).
- Drag blocks to the side of another block to create **columns** (blue vertical line indicator). Drag onto a page in sidebar/body to move into it.
- Multi-select: click-drag in the margin (marquee), `Shift+click`, `Esc` then `Shift+↑↓`.
- Placeholder in an empty line: "Write, press 'space' for AI, '/' for commands…".
- **Space on empty line** → opens Notion AI prompt.

## 2. `/` Slash menu — all categories & blocks
### Basic blocks
| Block | Slash | Markdown | Notes |
|---|---|---|---|
| Text | `/text` | — | plain paragraph |
| Page | `/page` | — | sub-page block (link to child page) |
| To-do list | `/todo` | `[]` + space | checkbox; checked → strikethrough grey |
| Heading 1/2/3 | `/h1 /h2 /h3` | `#`, `##`, `###` | |
| Heading 4 | `/h4` | `####` | added 2025 |
| Toggle heading 1/2/3 | `/toggle h1` | `> ` then turn into | headings that collapse their children |
| Table | `/table` | — | simple table (not database); header row/column toggles, merge cells (May 2026), fit to width |
| Bulleted list | `/bullet` | `-`, `*`, `+` | |
| Numbered list | `/num` | `1.` `a.` `i.` | list format options: numbers/letters/roman |
| Toggle list | `/toggle` | `>` + space | collapsible |
| Quote | `/quote` | `"` + space | size options (Default/Large) |
| Divider | `/div` | `---` | |
| Link to page | `/link` | `[[` | inline/blocks link to existing page |
| Callout | `/callout` | — | box with icon + background color; can contain blocks |

### Media
| Block | Slash | Notes / buttons |
|---|---|---|
| Image | `/image` | Upload, Embed link, Unsplash, GIPHY; toolbar: Align (left/center/right), Caption, Replace, Crop, Alt text (AI can write), Download, Comment, Original (view full), `•••` (Copy link to block, Duplicate, Turn into, Delete). Resize via side handles. Space = fullscreen. |
| Video | `/video` | Upload / embed YouTube, Vimeo, Loom… |
| Audio | `/audio` | Upload / embed (Spotify, SoundCloud) |
| Code | `/code` | language dropdown (~70 langs incl. Mermaid diagrams, Plain text), Wrap code toggle, Copy, Caption; Mermaid has Code / Preview / Split |
| File | `/file` | upload any file, shows name+size, download |
| Web bookmark | `/book` | URL card with title, description, favicon, thumbnail |
| PDF | `/pdf` | inline viewer |

### Database blocks
- `/table view`, `/board view`, `/gallery view`, `/list view`, `/calendar view`, `/timeline view`, `/chart view`, `/feed view`, `/map view`, `/form` — each offers **New database** (inline or full page) or **Link to existing data source** (linked database view).
- `/linked` → Linked view of data source.
- `/dashboard` (2026) → dashboard view with KPI widgets.

### Suggested / Advanced blocks
| Block | Slash | Notes |
|---|---|---|
| Table of contents | `/toc` | auto from headings; color option |
| Block equation | `/math` `/latex` | KaTeX; centered display |
| Button | `/button` | runs actions (see §6) |
| Breadcrumb | `/bread` | shows page path |
| Synced block | `/synced` | content mirrored everywhere it's pasted (see §7) |
| Toggle heading | `/toggle heading` | |
| Columns | `/2 columns` … `/5 columns` | |
| Tabs | `/tabs` | tab block layout (Mar 2026) — each tab holds blocks; rename/reorder tabs |
| Template button (legacy) | `/template` | now replaced by Button |
| HTML / interactive block | via Agent | interactive custom HTML (calculators, quizzes) built by agents (3.6, Jul 2026) |
| AI block / AI Meeting Notes | `/meet`, `/ai meeting notes` | records & transcribes meeting; tabs Summary / Notes / Transcript |
| Agent embed | `/agent` | embed a Custom Agent in a doc (3.7) |
| Transcription | `/transcribe` | |
| Simple table | see above | |

### Inline
| Item | Trigger | Notes |
|---|---|---|
| Mention person | `@name` | notifies them |
| Mention page | `@page` / `[[` | live title link; creates backlink |
| Date or reminder | `@today`, `@tomorrow`, `@next friday 3pm`, `@remind` | date pill; click → edit date, include time, date format, time zone, remind (at time / 5 min / 1 day before etc.) |
| Emoji | `:name` or `/emoji` | |
| Inline equation | `/inline equation` or `$$...$$` | |
| Link mention | paste URL → "Mention" | rich preview (GitHub PR, Figma, Jira, Slack…) |

### Embeds (`/embed` + 500+ services)
Google Drive (Docs/Sheets/Slides with preview, needs account), Figma, Miro, Whimsical, Loom, GitHub Gist, Twitter/X, CodePen, Framer, Typeform, Google Maps, Abstract, Invision, Sketch, Excalidraw, Replit, Spotify, SoundCloud, YouTube, Vimeo, Airtable, Calendly, PDF, etc. Pasting a URL shows a menu: **Dismiss / Mention / Paste as preview / Create bookmark / Create embed / Paste as link**.

### Actions inside slash menu
`/duplicate`, `/moveto`, `/delete`, `/turn` (turn into), `/color`, `/default` (remove color), `/comment`, `/ai` (Ask AI with sub-commands: Continue writing, Summarize, Find action items, Translate, Explain, Improve writing, Fix spelling & grammar, Make shorter/longer, Change tone, Simplify).

## 3. `⋮⋮` Block menu (click handle, or `Cmd/Ctrl+/`)
- Search actions field.
- **Ask AI**: edit with AI (selection actions above).
- **Delete** (Del)
- **Duplicate** (`Cmd/Ctrl+D`)
- **Turn into** → Text, Page, To-do, H1–H4, Toggle headings, Bulleted/Numbered list, Toggle list, Code, Quote, Callout, Block equation, Synced block, Columns.
- **Turn into page in…** (moves block content to new page in a location)
- **Copy link to block** (`Option/Alt+Shift+L`) → URL with `#blockid` anchor
- **Duplicate**, **Move to** (`Cmd/Ctrl+Shift+P`)
- **Comment** (`Cmd/Ctrl+Shift+M`)
- **Color** → Text color (Default, Gray, Brown, Orange, Yellow, Green, Blue, Purple, Pink, Red) and Background color (same 10)
- **Suggest edits**
- Block-specific: Code language, Wrap; Image Replace/Caption/Download; Callout icon; List style; Table options; Toggle "open/close all".
- Footer: "Last edited by X · time".

## 4. Text-selection toolbar (select text)
Left → right:
1. **Ask AI / Edit with AI** (Improve, Fix spelling, Shorter, Longer, Change tone, Simplify, Translate, Explain, Summarize, Find action items, Custom prompt)
2. **Turn into** dropdown (block type)
3. **Link** (`Cmd/Ctrl+K`) — paste URL or search page to link
4. **Comment** (`Cmd/Ctrl+Shift+M`)
5. **Bold** `B` (`Cmd/Ctrl+B`)
6. *Italic* `I` (`Cmd/Ctrl+I`)
7. Underline `U` (`Cmd/Ctrl+U`)
8. ~~Strikethrough~~ `S` (`Cmd/Ctrl+Shift+S`)
9. `Code` (`Cmd/Ctrl+E`)
10. **Equation** `√x` (`Cmd/Ctrl+Shift+E`) turns selection into inline TeX
11. **Color** `A` (text + background; "Last used" row; `Cmd/Ctrl+Shift+H` reapplies last)
12. **Mention** `@`
13. **`•••` more**: Suggest edits, Copy link to block, Turn into, etc.
Word & character count appears when blocks selected.

## 5. Columns
- Create by dragging block beside another or `/2 columns`.
- Drag the column divider to resize; columns stack on mobile.
- Delete a column by moving its contents out.

## 6. Buttons (`/button`)
Configure: **Name**, **Icon**, then **actions** (multiple, executed in order):
- **Insert blocks** (template content above/below the button)
- **Add page to** (a database, with preset property values)
- **Edit pages in** (a database: filter which pages + set properties) — e.g., "mark all done"
- **Show confirmation** (dialog text)
- **Open page** (in new tab / side peek / center peek / full)
- **Send notification to** (person)
- **Send mail to** (Gmail via Notion Mail)
- **Send webhook** (Plus+)
- **Define variables** / formulas in values
- **Run Custom Agent** (2026)
Buttons can also be a **Button property** in databases (runs on that row; can reference "This page").

## 7. Synced blocks
- `/synced` or copy blocks → paste → choose "Paste and sync". Red outline when editing.
- Menu: **Copy and sync**, **Unsync** (this copy only), **Unsync all**, **Open original**, list of "Synced to N pages" with links.
- Permissions: viewers of the copy need access to original's content.

## 8. Toggles & headings
- Toggle list arrow click, `Cmd/Ctrl+Enter` toggles; `Cmd/Ctrl+Option/Alt+T` expand/collapse all.
- Toggle headings collapse content under heading.

## 9. Code block
- Language picker, **Wrap**, **Copy**, **Caption**, line numbers (setting), syntax highlighting; `Tab` indents inside; Mermaid & LaTeX render previews.

## 10. Tables (simple)
- Header row / Header column toggles, Fit table to page width, Add row/column (+ hover handles), drag rows/columns, **Merge cells** (May 2026), cell background colors, **Turn into database** (converts to DB). `Cmd/Ctrl+R` fill right, `Cmd/Ctrl+D` fill down.

## 11. Callout
- Click icon to change (emoji/icon/upload), background color from block menu, can nest any blocks.

## 12. Copy / paste behaviors
- Paste Markdown → converted to blocks. Paste HTML/Google Docs/Word → blocks. Paste CSV → offered as database.
- `Cmd/Ctrl+Shift+V` paste plain text.
- Copy block → paste in another app as Markdown/plain text.

## 13. Page-level formatting
- Font (Default / Serif / Mono), Small text, Full width, per page (see 01 §4).
- Dark mode / Light / System / **High contrast** (Jul 2026).

## 14. AI in the editor
- `Space` on empty line → AI prompt.
- Select text → "Ask AI"/"Edit with AI" (edits in place, Apr 2026).
- **Suggest edits mode** for agents (Aug 2026) — AI proposes, you accept/reject top to bottom.
- AI image generation on pages (Mar 2026).
- Voice dictation (mic button) on desktop.

## 15. Templates within pages
- Page templates (database templates), Template gallery, `Duplicate` as template, `/template` legacy button.

## 16. Comments in editor
- Inline (select text → Comment) vs block (handle → Comment) vs page-level (top). Highlights yellow. See 04.
