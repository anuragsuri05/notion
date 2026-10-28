# 03 — Databases (every property, view, menu, and formula)

## 1. Concepts
- **Database** = container with a title, icon, description, and one or more **data sources** (2025+). Each data source = schema (properties) + rows (pages).
- **Inline database**: lives inside a page as a block. **Full-page database**: the page *is* the database.
- **Linked view / linked database** (`/linked`): a view of an existing data source placed elsewhere; filters/sorts are per view; edits to rows are shared.
- **View**: saved layout + filter + sort + group + visible properties. A database can have many views (tabs at the top).
- **Row = page**: open it to see properties + body content.

## 2. Database header — every control
```
[DB title ▾]  [View tab 1] [View tab 2] [+]           [Filter] [Sort] [⚡] [🔍] [⤢] [•••] [New ▾]
[Filter chips row: Status is Done ×  + Add filter   Reset  Save for everyone]
```
- **Title** (click to edit), **description** toggle ("Show description").
- **View tabs**: click to switch; double-click/`•••` on a tab → Rename, Edit view, Copy link to view, Duplicate view, Delete view. Drag to reorder. Overflow `N more…`. Tab display: text+icon / text only / icon only (Apr 2026, per user).
- **`+` Add view**: choose layout (Table, Board, Gallery, List, Calendar, Timeline, Chart, Feed, Map, Form, Dashboard) and data source.
- **Filter** (funnel icon): add filter rules.
- **Sort** (↑↓ icon): add sorts.
- **⚡ Automations** (Plus+): create/edit automations.
- **🔍 Search** within this view.
- **⤢ Open as full page** (for inline DBs).
- **`•••` View settings** (big menu, see §5).
- **New ▾** (blue): `New` creates row (default template); `▾` → pick template, **+ New template**, set default template per view, Edit/Duplicate/Delete templates, "Empty page".
- **AI icon**: "Ask about this database" / build views with AI / AI Autofill setup.

## 3. Property types (all)
| Property | Description & settings |
|---|---|
| **Title** | Name; one per data source; can't be deleted. Optional "Show page icon". |
| **Text** | Rich text. |
| **Number** | Format: Number, Number with commas, Percent, ~40 currencies (USD, EUR, GBP, INR, JPY…); decimal places; **Show as**: Number / Bar / Ring (with color, divide by, show number). |
| **Select** | Single choice; options with colors; sort options (manual/alphabetical); "Add option". |
| **Multi-select** | Multiple choices; same option editor. |
| **Status** | Grouped options: **To-do**, **In progress**, **Complete** groups; show as Select or Checkbox. |
| **Date** | Single or range (End date toggle), Include time, Date format (Full, Relative, Month/Day/Year, Day/Month/Year, Year/Month/Day), Time format (12h/24h), Time zone, Remind. |
| **Person** | Workspace members/guests; limit to one person option; notifies when assigned (optional). |
| **Files & media** | Uploads or links; show as file names or thumbnails/cover. |
| **Checkbox** | Boolean. |
| **URL** | Clickable link; option "Show full URL". |
| **Email** | mailto link. |
| **Phone** | tel link. |
| **Formula** | Computed (see §9). |
| **Relation** | Link to rows in another (or same) data source; one-way or **two-way** (show on related DB with a synced property); limit (1 page / no limit). |
| **Rollup** | Aggregate a property through a relation: Show original, Show unique values, Count all/values/unique/empty/not empty, Percent empty/not empty, Sum, Average, Median, Min, Max, Range, Earliest/Latest date, Date range, Checked/Unchecked/% checked; number formatting (currency, %, decimals — Apr 2026); show as number/bar/ring. |
| **Created time** / **Created by** | Automatic. |
| **Last edited time** / **Last edited by** | Automatic. |
| **Button** | Runs actions on that row (see editor §6). |
| **ID** (Unique ID) | Auto-increment with optional prefix (e.g., `TASK-12`); can be used in page URL search. |
| **Place / Location** | Address with map preview; powers Map view. |
| **Verification** | Wikis: Verified by, Expiration (1 week/1 month/90 days/custom/indefinite). |
| **Owner** | Wiki owner. |
| **Sub-item / Parent item** | Self-relation created by "Sub-items" feature. |
| **Blocked by / Blocking** | Self-relation created by "Dependencies". |
| **AI Autofill** (AI property) | AI summary, AI key info, AI keywords, AI translation, AI custom autofill; auto-update on page edits (Custom-Agent powered since Apr 2026). |
| **Sprint** | Created by Sprints feature in Projects/Tasks system. |
| *(No native rating property)* | Usually built with a Select (★ options) or a Number shown as Bar/Ring. |

**Property header menu (click column header)**: Rename, Edit property (type, settings), Filter, Sort ascending/descending, Group (board), Calculate, Freeze up to column, Hide in view, Wrap text / Wrap column, Insert left/right, Duplicate property, Delete property. Property icon customization. Property description (tooltip).

## 4. View types & their unique settings
| View | Key settings / buttons |
|---|---|
| **Table** | Columns = properties; column width drag; **Wrap all columns**; **Show vertical lines**; **Freeze columns**; row height; calculation footer per column (Count all, Count values, Unique, Empty, Not empty, % empty, Sum, Average, Median, Min, Max, Range, Earliest/Latest/Date range, Checked…); grouping; sub-items nested (toggle); open rows in side/center/full; "+ New" row at bottom; select rows → bulk actions bar (Edit property, Delete, Duplicate, Move to, Comment, Ask AI, Open). `Cmd/Ctrl+/` bulk edit. |
| **Board** | Group by Select/Status/Person/Multi-select/Relation/Date/etc; Card preview (None, Page cover, Page content, Files & media); Card size (S/M/L); Fit image; Color columns; hidden groups; "+ New" in each column; sub-grouping (swimlanes). |
| **Gallery** | Card preview, card size, fit image, show properties on cards. |
| **List** | Minimal rows showing chosen properties at the right. |
| **Calendar** | Show calendar by (date property); Month / Week view; Show weekends; Start week on Monday (setting); drag to reschedule; "No date" sidebar; Today; `< >`; sync with Notion Calendar. |
| **Timeline** | Show timeline by (start/end dates or two date properties); zoom Hours/Day/Week/Bi-week/Month/Quarter/Year; **Table** sidebar toggle with properties; dependencies arrows (drag between bars); Today; drag bars to move/resize; "Show timeline" options. |
| **Chart** | Vertical bar, Horizontal bar, Line, Donut, (Number/KPI); X-axis property, Y-axis (count/sum/avg of property), group by/stack, sort, colors, show data labels, legend, gridlines, cumulative, smooth line, axis ranges; Free plan limited to 1 chart. |
| **Feed** | Rows shown as stream of full pages with content (blog-style). |
| **Map** | Pins from Place property; zoom; click pin = peek. |
| **Form** | Builder for a form that creates rows (see §11). |
| **Dashboard** (Mar 2026) | Grid of widgets (charts, numbers/KPIs, lists, tables) from one or more data sources. |

## 5. `•••` View settings menu (database options)
- **View name & icon**, **Layout** (switch type + layout-specific options: Show database title, Open pages in Side peek/Center peek/Full page, Show page icon, Wrap all content, Load limit 10/25/50/100 per group…).
- **Property visibility** (Shown in table / Hidden; "Hide all"; drag order).
- **Filter**, **Sort**, **Group** (by property; Sort groups; Hide empty groups; Show/Hide individual groups; Date grouping by Relative/Day/Week/Month/Year), **Sub-group** (board).
- **Conditional color** (2025: color rows/cards when rule matches).
- **Sub-items** (enable: parent/sub-item relation; display Nested in toggle / Flattened list / Parent items only / Sub-items only; Filter applies to parents/sub-items).
- **Dependencies** (Blocked by/Blocking; timeline shift options: shift dependents when moving).
- **Automations**.
- **Templates** (manage).
- **Data source** settings: Edit properties, **Lock database** (lock views & properties), **Manage data sources** (add data source to this database), **Database permissions** / page-level permissions (Business: "Can edit content", "Can create pages" (Apr 2026), row-level permissions via Person/Created-by properties).
- **Copy link to view**, **Duplicate view**, **Delete view**.
- **Import** CSV into this database, **Export** (CSV/Markdown).
- **Connections**.
- **Turn into wiki**, **Turn into data source/merge**.
- **Show/hide** database title & description.
- **Sprints** setup (Projects & Tasks), **Show in "My Tasks"** (designate as Tasks database).
- **Group/aggregate in calculation** row.

## 6. Filters
- Simple filters (chips) and **Advanced filter** groups: AND / OR, nested filter groups (up to 3 levels).
- Operators by type: Text: is, is not, contains, does not contain, starts with, ends with, is empty, is not empty. Number: =, ≠, >, <, ≥, ≤, empty. Select/Status: is, is not, is empty. Multi-select: contains, does not contain. Date: is, before, after, on or before, on or after, is within (past week/month/year, next week/month/year, this week, custom N days), is relative to today, is empty. Person: contains, does not contain, **Me** (dynamic current viewer). Checkbox: is checked / unchecked. Relation: contains page, empty. Formula/rollup inherit their output type.
- "Save for everyone" vs personal unsaved filter changes ("Reset").
- **Personal views/filters** (only for you) vs shared.

## 7. Sorts
- Multiple sort rules applied in order; ascending/descending; manual drag order when no sort.

## 8. Grouping
- Group by any property; date grouping granularity; Group sorting (manual, alphabetical, reverse); Hide empty groups; Collapse groups; Count per group; Board columns = groups.

## 9. Formulas 2.0 (syntax & functions)
Editor: code-style editor with autocomplete, multi-line (`Shift+Enter`), comments `/* */`, live preview, error messages, **AI formula writer** ("Describe the formula").
Reference properties by name: `prop("Name")` or the property token. `let(var, value, expr)` and `lets(a, 1, b, 2, expr)` for variables. Can return rich types: text, number, boolean, date, person, page (relation), lists — lists render as chips.

**Operators**: `+ - * / % ^`, `==`, `!=`, `>`, `<`, `>=`, `<=`, `and`/`&&`, `or`/`||`, `not`/`!`, ternary `cond ? a : b`.

**Logic**: `if(cond, a, b)`, `ifs(c1, v1, c2, v2, …, else)`, `empty(x)`, `and()`, `or()`, `not()`.

**Text**: `length()`, `substring(text, start, end)`, `contains()`, `test(text, regex)`, `match(text, regex)`, `replace()`, `replaceAll()`, `lower()`, `upper()`, `repeat()`, `padStart()`, `padEnd()`, `trim()`, `split(text, sep)`, `join(list, sep)`, `concat()`, `format(x)`, `link(label, url)`, `style(text, "b","i","u","s","c", "red", "red_background"…)`, `unstyle()`, `toNumber()`.

**Math**: `add subtract multiply divide pow mod`, `abs`, `round(n, places)`, `ceil`, `floor`, `sqrt`, `cbrt`, `exp`, `ln`, `log10`, `log2`, `sign`, `min`, `max`, `sum`, `mean`, `median`, `pi`, `e`, `toNumber`.

**Dates**: `now()`, `today()`, `minute()`, `hour()`, `day()` (weekday 0-6), `date()` (day of month), `week()`, `month()`, `year()`, `dateAdd(date, n, unit)`, `dateSubtract()`, `dateBetween(a, b, unit)`, `dateRange(start, end)`, `dateStart()`, `dateEnd()`, `timestamp()`, `fromTimestamp()`, `formatDate(date, "MMMM D, YYYY")`, `parseDate("2026-10-09")`. Units: years, quarters, months, weeks, days, hours, minutes.

**Lists**: `at(list, i)`, `first()`, `last()`, `slice()`, `concat()`, `sort()`, `reverse()`, `join()`, `includes()`, `find(list, cond)`, `findIndex()`, `filter(list, current > 2)`, `some()`, `every()`, `map(list, current.prop("Name"))`, `flat()`, `unique()`, `count()`. Inside list functions use `current` and `index`.

**People/Pages**: `name(person)`, `email(person)`, `id()` (page id), access related page properties via `.prop("X")` on relations: `prop("Tasks").map(current.prop("Status"))`.

**Misc**: `id()`, `toNumber()`, `format()`, `ifs`, `let/lets`.

## 10. Relations & rollups
- Relation setup: choose target data source → "Show on [target]" toggle (two-way, name the reverse property) → Limit (1 page / No limit).
- Self-relations power sub-items and dependencies.
- Rollup: select relation → property → calculate (list in §3).

## 11. Forms
- Create via `/form` or `+ Add view → Form`. Each question maps to a database property (Text, Number, Select, Multi-select, Date, Person, Files, Checkbox, Email, Phone, URL, Status…).
- Builder buttons: Add question, question type, **Required** toggle, description, rename question vs property, cover/icon, title & description, **Conditional logic** (Business+: "If answer is X, skip to question Y / show question"), **Anonymous submissions**, **Who can submit**: Anyone with link / Only people in workspace / Specific people, **Notify on submission**, **Close form** / accept responses toggle, **Custom thank-you** text, **Branding off** (Plus+), **Custom URL**, Preview, Share form link, Embed form.
- Responses land as rows; "Responses" view.

## 12. Database templates
- Template builder: same as a page with properties pre-filled + content.
- Options per template: Set as default (per view), Duplicate, Delete, **Repeat** (recurring: daily/weekly/monthly/yearly at time — creates new page on schedule), use `@Today`/`@Now`/`Me` dynamic values, nested linked views filtered to "This page".

## 13. Automations (⚡, Plus+ for most)
- **Triggers**: Page added, Property edited (any/specific values), Every (recurring schedule), Button clicked (button property), Webhook received (Business), Meeting note summarized (for agents).
- **Conditions** (filter which pages).
- **Actions**: Edit property (incl. formulas & "Trigger page"), Add page to (another DB), Edit pages in (another DB), Send notification to, Send mail to (Gmail), Send Slack notification to (channel), Send webhook, Define variables, Run Custom Agent.
- Settings: On/Off toggle, rename, Run history/"Last ran", Delete, Who created; automations run as the "Notion Automations" bot (or as creator).

## 14. Charts & dashboards
- Chart view settings in §4; charts can be placed in pages as linked views; Free plan: 1 chart.
- **Dashboards** (Mar 2026): a view type that composes multiple widgets (number cards/KPIs, charts, tables) from one/more data sources; layout grid with drag-to-resize.

## 15. Database permissions
- Page-level share applies to the whole DB (there are no per-view permissions). Business+ adds granular options: **row-level permissions** via Person / Created by property ("Can edit pages where they are in Assignee"), "Can edit content" (rows but not structure), **Can create pages** (Apr 2026), **Can view**, **Can comment**, **Full access**. Lock database prevents structure edits.

## 16. Projects / Tasks / Sprints system
- **Tasks DB**: Assignee, Status, Due, Priority, Project relation, Sub-tasks, Dependencies.
- **Sprints**: Sprint DB with Current/Next/Last, sprint board & planning views, "Complete sprint" button that moves unfinished tasks.
- **My Tasks** home widget reads databases flagged as Tasks.

## 17. Import into database
- CSV import (map columns to properties), merge CSV into existing DB, paste CSV, import from Airtable/Trello/Asana/Jira/Monday/ClickUp, Google Sheets (via import), Excel.

## 18. Limits & performance tips
- Large databases (100k+ rows) load in pages; use filters, limit relations/rollups, use "Load limit".
- Database load speeds improved via 2025 "database indexing".
