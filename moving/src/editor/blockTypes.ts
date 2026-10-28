import type { BlockType, ViewType } from '../store/types';

export interface SlashItem {
  id: string;
  label: string;
  desc: string;
  group: 'Basic blocks' | 'Media' | 'Database' | 'Advanced blocks' | 'Inline' | 'Embeds' | 'Actions' | 'AI' | 'Colors' | 'Turn into';
  icon: string;            // short glyph shown in preview tile
  keywords?: string;
  type?: BlockType;
  view?: ViewType;
  shortcut?: string;
}

export const SLASH_ITEMS: SlashItem[] = [
  { id: 'ai', label: 'Ask AI', desc: 'Use Moving AI to write, edit, and brainstorm.', group: 'AI', icon: '✦', keywords: 'ai assistant write generate' },
  { id: 'ai_continue', label: 'Continue writing', desc: 'Let AI continue from here.', group: 'AI', icon: '✎', keywords: 'ai continue' },
  { id: 'ai_summary', label: 'Summarize page', desc: 'AI summary of this page.', group: 'AI', icon: '≡', keywords: 'ai summary summarize tldr' },
  { id: 'ai_actions', label: 'Find action items', desc: 'AI lists to-dos from this page.', group: 'AI', icon: '☑', keywords: 'ai action items todo' },

  { id: 'text', type: 'text', label: 'Text', desc: 'Just start writing with plain text.', group: 'Basic blocks', icon: 'Aa', keywords: 'plain paragraph p' },
  { id: 'page', type: 'page', label: 'Page', desc: 'Embed a sub-page inside this page.', group: 'Basic blocks', icon: '📄', keywords: 'subpage new page' },
  { id: 'todo', type: 'todo', label: 'To-do list', desc: 'Track tasks with a to-do list.', group: 'Basic blocks', icon: '☑', keywords: 'todo checkbox task check [] ', shortcut: '[]' },
  { id: 'h1', type: 'h1', label: 'Heading 1', desc: 'Big section heading.', group: 'Basic blocks', icon: 'H1', keywords: '# title heading1', shortcut: '#' },
  { id: 'h2', type: 'h2', label: 'Heading 2', desc: 'Medium section heading.', group: 'Basic blocks', icon: 'H2', keywords: '## heading2 subtitle', shortcut: '##' },
  { id: 'h3', type: 'h3', label: 'Heading 3', desc: 'Small section heading.', group: 'Basic blocks', icon: 'H3', keywords: '### heading3', shortcut: '###' },
  { id: 'h4', type: 'h4', label: 'Heading 4', desc: 'Smallest section heading.', group: 'Basic blocks', icon: 'H4', keywords: '#### heading4', shortcut: '####' },
  { id: 'table', type: 'table', label: 'Table', desc: 'Add a simple table.', group: 'Basic blocks', icon: '▦', keywords: 'grid simple table' },
  { id: 'bullet', type: 'bullet', label: 'Bulleted list', desc: 'Create a simple bulleted list.', group: 'Basic blocks', icon: '•', keywords: 'bullet unordered ul list -', shortcut: '-' },
  { id: 'numbered', type: 'numbered', label: 'Numbered list', desc: 'Create a list with numbering.', group: 'Basic blocks', icon: '1.', keywords: 'number ordered ol list num', shortcut: '1.' },
  { id: 'toggle', type: 'toggle', label: 'Toggle list', desc: 'Toggles can hide and show content inside.', group: 'Basic blocks', icon: '▸', keywords: 'toggle collapse dropdown', shortcut: '>' },
  { id: 'quote', type: 'quote', label: 'Quote', desc: 'Capture a quote.', group: 'Basic blocks', icon: '❝', keywords: 'quote blockquote citation', shortcut: '"' },
  { id: 'divider', type: 'divider', label: 'Divider', desc: 'Visually divide blocks.', group: 'Basic blocks', icon: '—', keywords: 'divider hr line separator div', shortcut: '---' },
  { id: 'link_page', type: 'link_page', label: 'Link to page', desc: 'Link to an existing page.', group: 'Basic blocks', icon: '↗', keywords: 'link page reference' },
  { id: 'callout', type: 'callout', label: 'Callout', desc: 'Make writing stand out.', group: 'Basic blocks', icon: '💡', keywords: 'callout note info warning box' },

  { id: 'image', type: 'image', label: 'Image', desc: 'Upload or embed with a link.', group: 'Media', icon: '🖼', keywords: 'image picture photo img upload' },
  { id: 'video', type: 'video', label: 'Video', desc: 'Embed from YouTube, Vimeo, or upload.', group: 'Media', icon: '▶', keywords: 'video youtube vimeo movie' },
  { id: 'audio', type: 'audio', label: 'Audio', desc: 'Embed audio or upload a file.', group: 'Media', icon: '♪', keywords: 'audio sound music mp3' },
  { id: 'code', type: 'code', label: 'Code', desc: 'Capture a code snippet.', group: 'Media', icon: '</>', keywords: 'code snippet programming ```', shortcut: '```' },
  { id: 'file', type: 'file', label: 'File', desc: 'Upload or embed with a link.', group: 'Media', icon: '📎', keywords: 'file attachment upload' },
  { id: 'bookmark', type: 'bookmark', label: 'Web bookmark', desc: 'Save a link as a visual bookmark.', group: 'Media', icon: '🔖', keywords: 'bookmark link url web' },
  { id: 'pdf', type: 'pdf', label: 'PDF', desc: 'Embed a PDF document.', group: 'Media', icon: '📕', keywords: 'pdf document' },

  { id: 'db_table', type: 'database', view: 'table', label: 'Table view', desc: 'Add an inline database table.', group: 'Database', icon: '▤', keywords: 'database table inline db' },
  { id: 'db_board', type: 'database', view: 'board', label: 'Board view', desc: 'Add a kanban board.', group: 'Database', icon: '▥', keywords: 'database board kanban' },
  { id: 'db_gallery', type: 'database', view: 'gallery', label: 'Gallery view', desc: 'Add a gallery of cards.', group: 'Database', icon: '▦', keywords: 'database gallery cards' },
  { id: 'db_list', type: 'database', view: 'list', label: 'List view', desc: 'Add a minimal list database.', group: 'Database', icon: '☰', keywords: 'database list' },
  { id: 'db_calendar', type: 'database', view: 'calendar', label: 'Calendar view', desc: 'Add a calendar database.', group: 'Database', icon: '📅', keywords: 'database calendar' },
  { id: 'db_timeline', type: 'database', view: 'timeline', label: 'Timeline view', desc: 'Add a timeline / gantt database.', group: 'Database', icon: '⇶', keywords: 'database timeline gantt roadmap' },
  { id: 'db_chart', type: 'database', view: 'chart', label: 'Chart view', desc: 'Visualize data with a chart.', group: 'Database', icon: '📊', keywords: 'database chart graph' },
  { id: 'db_form', type: 'database', view: 'form', label: 'Form', desc: 'Collect responses into a database.', group: 'Database', icon: '📝', keywords: 'form survey database' },
  { id: 'db_full', label: 'Database – Full page', desc: 'Add a database as a new sub-page.', group: 'Database', icon: '▣', keywords: 'database full page' },
  { id: 'db_linked', type: 'database', label: 'Linked view of database', desc: 'Show an existing database.', group: 'Database', icon: '⧉', keywords: 'linked database view existing' },

  { id: 'toc', type: 'toc', label: 'Table of contents', desc: 'Show an outline of this page.', group: 'Advanced blocks', icon: '☷', keywords: 'toc outline contents' },
  { id: 'equation', type: 'equation', label: 'Block equation', desc: 'Display a standalone math equation.', group: 'Advanced blocks', icon: 'Σ', keywords: 'math latex tex equation formula' },
  { id: 'button', type: 'button', label: 'Button', desc: 'Automate actions with one click.', group: 'Advanced blocks', icon: '⏺', keywords: 'button template automation' },
  { id: 'breadcrumb', type: 'breadcrumb', label: 'Breadcrumb', desc: 'Show where this page is.', group: 'Advanced blocks', icon: '›', keywords: 'breadcrumb path location bread' },
  { id: 'toggle_h1', type: 'toggle_h1', label: 'Toggle heading 1', desc: 'Hide content inside a large heading.', group: 'Advanced blocks', icon: '▸H1', keywords: 'toggle heading' },
  { id: 'toggle_h2', type: 'toggle_h2', label: 'Toggle heading 2', desc: 'Hide content inside a medium heading.', group: 'Advanced blocks', icon: '▸H2', keywords: 'toggle heading' },
  { id: 'toggle_h3', type: 'toggle_h3', label: 'Toggle heading 3', desc: 'Hide content inside a small heading.', group: 'Advanced blocks', icon: '▸H3', keywords: 'toggle heading' },
  { id: 'columns2', type: 'columns', label: '2 columns', desc: 'Create 2 columns of blocks.', group: 'Advanced blocks', icon: '⫴', keywords: 'columns layout 2' },
  { id: 'columns3', type: 'columns', label: '3 columns', desc: 'Create 3 columns of blocks.', group: 'Advanced blocks', icon: '⫴', keywords: 'columns layout 3' },
  { id: 'columns4', type: 'columns', label: '4 columns', desc: 'Create 4 columns of blocks.', group: 'Advanced blocks', icon: '⫴', keywords: 'columns layout 4' },
  { id: 'columns5', type: 'columns', label: '5 columns', desc: 'Create 5 columns of blocks.', group: 'Advanced blocks', icon: '⫴', keywords: 'columns layout 5' },
  { id: 'synced', type: 'synced', label: 'Synced block', desc: 'Sync content across pages.', group: 'Advanced blocks', icon: '⟳', keywords: 'synced sync transclusion' },
  { id: 'tabs', type: 'tabs', label: 'Tabs', desc: 'Organize content into tabs.', group: 'Advanced blocks', icon: '⊟', keywords: 'tabs tab layout' },

  { id: 'mention_page', label: 'Mention a page', desc: 'Reference a page inline.', group: 'Inline', icon: '↗', keywords: 'mention page link @' },
  { id: 'mention_person', label: 'Mention a person', desc: 'Notify someone.', group: 'Inline', icon: '@', keywords: 'mention person user @' },
  { id: 'date', label: 'Date or reminder', desc: 'Insert a date or reminder.', group: 'Inline', icon: '📆', keywords: 'date reminder time today now remind' },
  { id: 'inline_equation', label: 'Inline equation', desc: 'Insert math inline.', group: 'Inline', icon: '√x', keywords: 'inline equation math latex' },
  { id: 'emoji', label: 'Emoji', desc: 'Search for an emoji to insert.', group: 'Inline', icon: '😀', keywords: 'emoji smiley' },

  { id: 'embed', type: 'embed', label: 'Embed', desc: 'Embed any link: Figma, Maps, CodePen…', group: 'Embeds', icon: '⧉', keywords: 'embed iframe' },
  { id: 'embed_youtube', type: 'video', label: 'YouTube', desc: 'Embed a YouTube video.', group: 'Embeds', icon: '▶', keywords: 'youtube' },
  { id: 'embed_figma', type: 'embed', label: 'Figma', desc: 'Embed a Figma file.', group: 'Embeds', icon: '◆', keywords: 'figma design' },
  { id: 'embed_maps', type: 'embed', label: 'Google Maps', desc: 'Embed a map.', group: 'Embeds', icon: '📍', keywords: 'google maps map' },
  { id: 'embed_codepen', type: 'embed', label: 'CodePen', desc: 'Embed a CodePen.', group: 'Embeds', icon: '✎', keywords: 'codepen' },
  { id: 'embed_loom', type: 'embed', label: 'Loom', desc: 'Embed a Loom recording.', group: 'Embeds', icon: '●', keywords: 'loom' },
  { id: 'embed_tweet', type: 'embed', label: 'X (Twitter)', desc: 'Embed a post.', group: 'Embeds', icon: '𝕏', keywords: 'twitter tweet x' },

  { id: 'duplicate', label: 'Duplicate', desc: 'Duplicate this block.', group: 'Actions', icon: '⧉', keywords: 'duplicate copy' },
  { id: 'moveto', label: 'Move to', desc: 'Move this block to another page.', group: 'Actions', icon: '↪', keywords: 'move to' },
  { id: 'delete', label: 'Delete', desc: 'Delete this block.', group: 'Actions', icon: '🗑', keywords: 'delete remove' },
  { id: 'comment', label: 'Comment', desc: 'Comment on this block.', group: 'Actions', icon: '💬', keywords: 'comment discuss' },
];

export const TURN_INTO: { type: BlockType; label: string; icon: string }[] = [
  { type: 'text', label: 'Text', icon: 'Aa' },
  { type: 'h1', label: 'Heading 1', icon: 'H1' },
  { type: 'h2', label: 'Heading 2', icon: 'H2' },
  { type: 'h3', label: 'Heading 3', icon: 'H3' },
  { type: 'h4', label: 'Heading 4', icon: 'H4' },
  { type: 'page', label: 'Page', icon: '📄' },
  { type: 'todo', label: 'To-do list', icon: '☑' },
  { type: 'bullet', label: 'Bulleted list', icon: '•' },
  { type: 'numbered', label: 'Numbered list', icon: '1.' },
  { type: 'toggle', label: 'Toggle list', icon: '▸' },
  { type: 'toggle_h1', label: 'Toggle heading 1', icon: '▸H1' },
  { type: 'toggle_h2', label: 'Toggle heading 2', icon: '▸H2' },
  { type: 'toggle_h3', label: 'Toggle heading 3', icon: '▸H3' },
  { type: 'code', label: 'Code', icon: '</>' },
  { type: 'quote', label: 'Quote', icon: '❝' },
  { type: 'callout', label: 'Callout', icon: '💡' },
  { type: 'equation', label: 'Block equation', icon: 'Σ' },
];

export const CODE_LANGUAGES = [
  'plain text', 'bash', 'c', 'c#', 'c++', 'clojure', 'css', 'dart', 'diff', 'docker', 'elixir', 'elm', 'erlang', 'go', 'graphql',
  'groovy', 'haskell', 'html', 'java', 'javascript', 'json', 'julia', 'kotlin', 'latex', 'less', 'lisp', 'lua', 'makefile', 'markdown',
  'matlab', 'mermaid', 'nix', 'objective-c', 'ocaml', 'pascal', 'perl', 'php', 'powershell', 'prolog', 'protobuf', 'python', 'r',
  'ruby', 'rust', 'sass', 'scala', 'scheme', 'scss', 'shell', 'solidity', 'sql', 'swift', 'toml', 'typescript', 'vb.net', 'verilog',
  'vhdl', 'xml', 'yaml',
];

export const BLOCK_LABEL: Partial<Record<BlockType, string>> = Object.fromEntries(
  [...TURN_INTO.map((t) => [t.type, t.label]), ...SLASH_ITEMS.filter((s) => s.type).map((s) => [s.type!, s.label])].reverse(),
);
