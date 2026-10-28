// Core data model for Moving. Mirrors Notion's model: everything is a block,
// pages own a tree of content blocks, databases own a schema + views and their
// rows are ordinary pages with property values.

export type ID = string;

export type Color =
  | 'default' | 'gray' | 'brown' | 'orange' | 'yellow'
  | 'green' | 'blue' | 'purple' | 'pink' | 'red';

export const COLORS: Color[] = ['default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];

export type BlockType =
  | 'text' | 'h1' | 'h2' | 'h3' | 'h4'
  | 'todo' | 'bullet' | 'numbered' | 'toggle'
  | 'toggle_h1' | 'toggle_h2' | 'toggle_h3'
  | 'quote' | 'callout' | 'divider' | 'code' | 'equation'
  | 'image' | 'video' | 'audio' | 'file' | 'bookmark' | 'embed' | 'pdf'
  | 'table' | 'page' | 'link_page' | 'database'
  | 'columns' | 'column' | 'toc' | 'breadcrumb' | 'button' | 'synced' | 'tabs';

export interface ButtonAction {
  kind: 'insert_blocks' | 'add_page' | 'open_page' | 'notify' | 'confirm';
  blocks?: Block[];
  dbId?: ID;
  pageId?: ID;
  message?: string;
  props?: Record<ID, PropValue>;
}

export interface Block {
  id: ID;
  type: BlockType;
  html: string;                 // inline rich text (sanitized HTML subset)
  children?: Block[];           // nested blocks (also used for columns → column → children)
  checked?: boolean;            // todo
  open?: boolean;               // toggles
  color?: Color;                // text color
  bg?: Color;                   // background color
  icon?: string;                // callout icon
  language?: string;            // code
  wrap?: boolean;               // code wrap
  url?: string;                 // media/bookmark/embed
  caption?: string;
  name?: string;                // file name
  size?: number;                // file size
  width?: number;               // media width percent / column ratio
  align?: 'left' | 'center' | 'right';
  pageId?: ID;                  // page / link_page
  dbId?: ID;                    // database block (inline / linked)
  viewIds?: ID[];               // linked database: views visible in this block
  rows?: string[][];            // simple table cell html
  headerRow?: boolean;
  headerCol?: boolean;
  meta?: { title?: string; description?: string; favicon?: string; image?: string };
  numberStyle?: 'numbers' | 'letters' | 'roman';
  quoteSize?: 'default' | 'large';
  actions?: ButtonAction[];     // button block
  syncId?: ID;                  // synced block source id
  tabs?: { id: ID; name: string; children: Block[] }[];
  activeTab?: number;
}

export type CoverValue =
  | { kind: 'color'; value: string; pos?: number }
  | { kind: 'image'; value: string; pos?: number };

export type PageFont = 'default' | 'serif' | 'mono';
export type Role = 'full' | 'edit' | 'edit_content' | 'comment' | 'view';

export interface Invite { email: string; role: Role; }

export interface PageVersion { at: number; by: ID; title: string; content: Block[]; }

export interface Page {
  id: ID;
  wsId: ID;
  title: string;
  icon?: string;               // emoji or data/url image
  cover?: CoverValue;
  parentId: ID | null;         // parent page id, null = top level in section
  section: 'private' | ID;     // private or teamspace id (for top-level pages)
  dbId?: ID;                   // set when this page is a database row
  isDb?: ID;                   // set when this page IS a full-page database
  props: Record<ID, PropValue>;
  content: Block[];
  order: number;
  createdAt: number;
  createdBy: ID;
  updatedAt: number;
  updatedBy: ID;
  trashedAt?: number;
  font?: PageFont;
  smallText?: boolean;
  fullWidth?: boolean;
  locked?: boolean;
  generalAccess?: 'invited' | 'workspace' | 'public';
  invites?: Invite[];
  published?: { allowEdit?: boolean; allowComments?: boolean; allowDuplicate?: boolean; indexing?: boolean; at: number };
  versions?: PageVersion[];
  isTemplate?: boolean;        // database template page
  templateOf?: ID;             // database the template belongs to
  verifiedUntil?: number | null;
  meeting?: { startedAt: number; endedAt?: number; transcript: { at: number; text: string }[]; summarized?: boolean };
  backlinksMode?: 'expanded' | 'popover' | 'off';
  commentsMode?: 'expanded' | 'off';
}

// ---------- Databases ----------

export type PropType =
  | 'title' | 'text' | 'number' | 'select' | 'multi_select' | 'status'
  | 'date' | 'person' | 'files' | 'checkbox' | 'url' | 'email' | 'phone'
  | 'formula' | 'relation' | 'rollup'
  | 'created_time' | 'created_by' | 'last_edited_time' | 'last_edited_by'
  | 'button' | 'unique_id';

export interface SelectOption { id: ID; name: string; color: Color; group?: 'todo' | 'in_progress' | 'complete'; }

export type NumberFormat = 'number' | 'commas' | 'percent' | 'usd' | 'eur' | 'gbp' | 'inr' | 'jpy' | 'cny' | 'krw' | 'rub' | 'brl' | 'cad' | 'aud';

export type RollupFn =
  | 'show_original' | 'show_unique' | 'count_all' | 'count_values' | 'count_unique'
  | 'count_empty' | 'count_not_empty' | 'percent_empty' | 'percent_not_empty'
  | 'sum' | 'average' | 'median' | 'min' | 'max' | 'range'
  | 'earliest' | 'latest' | 'checked' | 'unchecked' | 'percent_checked';

export interface Property {
  id: ID;
  name: string;
  type: PropType;
  options?: SelectOption[];
  numberFormat?: NumberFormat;
  numberShow?: 'number' | 'bar' | 'ring';
  formula?: string;
  relationDb?: ID;
  relationReverse?: ID;        // two-way: reverse property id in target db
  rollupRelation?: ID;
  rollupProp?: ID;
  rollupFn?: RollupFn;
  dateFormat?: 'full' | 'relative' | 'mdy' | 'dmy' | 'ymd';
  timeFormat?: '12' | '24';
  prefix?: string;             // unique id prefix
  nextId?: number;
  description?: string;
  buttonLabel?: string;
  buttonActions?: { propId: ID; value: PropValue }[];
}

export type ViewType = 'table' | 'board' | 'list' | 'gallery' | 'calendar' | 'timeline' | 'chart' | 'form' | 'feed';

export type FilterOp =
  | 'is' | 'is_not' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with'
  | 'empty' | 'not_empty' | 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte'
  | 'before' | 'after' | 'on_or_before' | 'on_or_after' | 'checked' | 'unchecked' | 'me';

export interface FilterRule { id: ID; propId: ID; op: FilterOp; value?: unknown; }
export interface FilterGroup { id: ID; conj: 'and' | 'or'; rules: (FilterRule | FilterGroup)[]; }
export interface SortRule { propId: ID; dir: 'asc' | 'desc'; }

export interface View {
  id: ID;
  name: string;
  type: ViewType;
  filter: FilterGroup;
  sorts: SortRule[];
  groupBy?: ID;
  hiddenGroups?: string[];
  hideEmptyGroups?: boolean;
  visible: ID[];                    // property ids shown, in order
  widths: Record<ID, number>;
  wrap?: boolean;
  openIn?: 'side' | 'center' | 'full';
  cardPreview?: 'none' | 'cover' | 'content';
  cardSize?: 'small' | 'medium' | 'large';
  dateProp?: ID;                    // calendar / timeline start
  endProp?: ID;                     // timeline end
  timelineZoom?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  calendarMode?: 'month' | 'week';
  chart?: { kind: 'bar' | 'hbar' | 'line' | 'donut' | 'number'; x?: ID; agg: 'count' | 'sum' | 'avg' | 'min' | 'max'; y?: ID; showLabels?: boolean; cumulative?: boolean };
  calc: Record<ID, string>;        // table footer calculations
  showTitle?: boolean;
  colorColumns?: boolean;
  form?: { title?: string; description?: string; questions: { propId: ID; required?: boolean; label?: string }[]; submitted?: number; anonymous?: boolean; closed?: boolean; thanks?: string };
  defaultTemplate?: ID;
  subItems?: boolean;
  conditionalColors?: { rule: FilterRule; color: Color }[];
}

export interface Database {
  id: ID;
  wsId: ID;
  title: string;
  description?: string;
  showDescription?: boolean;
  icon?: string;
  pageId: ID;                       // host page (full-page db page, or page containing inline block)
  inline: boolean;
  properties: Property[];
  views: View[];
  templates: ID[];                  // template page ids
  locked?: boolean;
  automations: Automation[];
  isTasks?: boolean;
}

export interface Automation {
  id: ID;
  name: string;
  enabled: boolean;
  trigger: { kind: 'page_added' | 'prop_edited'; propId?: ID };
  actions: { kind: 'set_prop' | 'notify'; propId?: ID; value?: PropValue; message?: string }[];
  runs: number;
  lastRun?: number;
}

export interface DateValue { start: string; end?: string; time?: boolean; remind?: number; }
export interface FileValue { name: string; url: string; }

export type PropValue =
  | string | number | boolean | null
  | string[]            // multi_select option ids, person ids, relation page ids
  | DateValue | FileValue[];

// ---------- Collaboration ----------

export interface User { id: ID; name: string; email: string; avatar?: string; color: string; }

export interface Comment {
  id: ID;
  pageId: ID;
  blockId?: ID;                    // anchored to block; undefined = page discussion
  quote?: string;                  // selected text
  threadId: ID;                    // root comment id
  authorId: ID;
  html: string;
  at: number;
  editedAt?: number;
  resolved?: boolean;
  reactions?: Record<string, ID[]>;
}

export interface Notification {
  id: ID;
  wsId: ID;
  kind: 'mention' | 'comment' | 'reminder' | 'invite' | 'assign' | 'automation' | 'system';
  pageId?: ID;
  text: string;
  actorId?: ID;
  at: number;
  read?: boolean;
  archived?: boolean;
}

export interface Teamspace { id: ID; wsId: ID; name: string; icon: string; description?: string; members: ID[]; access: 'default' | 'open' | 'closed' | 'private'; order: number; }

export interface Workspace {
  id: ID;
  name: string;
  icon: string;
  domain?: string;
  members: { userId: ID; role: 'owner' | 'admin' | 'member' | 'guest' }[];
  createdAt: number;
  plan: 'free' | 'plus' | 'business' | 'enterprise';
  security?: { disablePublish?: boolean; disableExport?: boolean; disableGuests?: boolean; disableDuplicate?: boolean };
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  highContrast?: boolean;
  startWeekMonday: boolean;
  openOnStart: 'last' | 'home';
  sidebarWidth: number;
  sidebarOpen: boolean;
  aiKey?: string;
  aiModel: string;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  spellcheck: boolean;
  language: string;
}

export interface AIChat { id: ID; title: string; at: number; messages: { role: 'user' | 'assistant'; content: string; at: number }[]; }

export interface CustomEmoji { name: string; url: string; }
