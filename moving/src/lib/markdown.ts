import type { Block, BlockType } from '../store/types';
import { escapeHtml, htmlToText, newBlock } from './util';

// ---------- inline ----------

export function inlineMdToHtml(md: string): string {
  let s = escapeHtml(md);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\$\$([^$]+)\$\$/g, (_m, tex) => `<span class="inline-eq" contenteditable="false" data-tex="${tex}">${tex}</span>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/__([^_]+)__/g, '<b>$1</b>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
  s = s.replace(/(^|[^_\w])_([^_\s][^_]*)_/g, '$1<i>$2</i>');
  s = s.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, u) => (/^(https?:|mailto:|#)/i.test(u) ? `<a href="${u}">${t}</a>` : t));
  s = s.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2">$2</a>');
  return s;
}

export function inlineHtmlToMd(html: string): string {
  if (!html) return '';
  const d = document.createElement('div');
  d.innerHTML = html;
  const walk = (n: Node): string => {
    if (n.nodeType === Node.TEXT_NODE) return (n as Text).data;
    if (!(n instanceof HTMLElement)) return '';
    const inner = Array.from(n.childNodes).map(walk).join('');
    switch (n.tagName) {
      case 'B': case 'STRONG': return inner.trim() ? `**${inner}**` : inner;
      case 'I': case 'EM': return inner.trim() ? `*${inner}*` : inner;
      case 'S': case 'STRIKE': case 'DEL': return `~~${inner}~~`;
      case 'CODE': return `\`${inner}\``;
      case 'U': return inner;
      case 'BR': return '\n';
      case 'A': return `[${inner}](${n.getAttribute('href')})`;
      case 'SPAN':
        if (n.dataset.tex) return `$$${n.dataset.tex}$$`;
        return inner;
      default: return inner;
    }
  };
  return Array.from(d.childNodes).map(walk).join('');
}

// ---------- blocks → markdown ----------

export function blocksToMarkdown(blocks: Block[], resolveTitle: (id: string) => string = () => 'Untitled', indent = ''): string {
  const out: string[] = [];
  let num = 0;
  for (const b of blocks) {
    const t = inlineHtmlToMd(b.html);
    num = b.type === 'numbered' ? num + 1 : 0;
    let line = '';
    switch (b.type) {
      case 'h1': case 'toggle_h1': line = `# ${t}`; break;
      case 'h2': case 'toggle_h2': line = `## ${t}`; break;
      case 'h3': case 'toggle_h3': line = `### ${t}`; break;
      case 'h4': line = `#### ${t}`; break;
      case 'bullet': case 'toggle': line = `- ${t}`; break;
      case 'numbered': line = `${num}. ${t}`; break;
      case 'todo': line = `- [${b.checked ? 'x' : ' '}] ${t}`; break;
      case 'quote': line = `> ${t}`; break;
      case 'callout': line = `> ${b.icon ?? '💡'} ${t}`; break;
      case 'divider': line = '---'; break;
      case 'code': line = '```' + (b.language ?? '') + '\n' + htmlToText(b.html) + '\n```'; break;
      case 'equation': line = `$$\n${htmlToText(b.html)}\n$$`; break;
      case 'image': line = `![${b.caption ?? ''}](${b.url?.startsWith('data:') ? 'image' : b.url ?? ''})`; break;
      case 'bookmark': case 'embed': case 'video': case 'audio': case 'pdf': case 'file': line = b.url && !b.url.startsWith('data:') ? `[${b.name || b.meta?.title || b.url}](${b.url})` : `[${b.name || b.type}]`; break;
      case 'page': case 'link_page': line = `[${resolveTitle(b.pageId ?? '')}](${b.pageId ?? ''})`; break;
      case 'table': {
        const rows = b.rows ?? [];
        if (rows.length) {
          const md = rows.map((r) => `| ${r.map((c) => inlineHtmlToMd(c).replace(/\|/g, '\\|')).join(' | ')} |`);
          md.splice(1, 0, `| ${rows[0].map(() => '---').join(' | ')} |`);
          line = md.join('\n');
        }
        break;
      }
      case 'synced':
        if (b.syncId) { out.push(indent + '[Synced block]'); continue; }
        out.push(blocksToMarkdown(b.children ?? [], resolveTitle, indent));
        continue;
      case 'columns': case 'column':
        out.push(blocksToMarkdown(b.children ?? [], resolveTitle, indent));
        continue;
      case 'tabs':
        for (const tab of b.tabs ?? []) { out.push(`${indent}**${tab.name}**`); out.push(blocksToMarkdown(tab.children, resolveTitle, indent)); }
        continue;
      case 'toc': case 'breadcrumb': case 'button': case 'database': continue;
      default: line = t;
    }
    out.push(line.split('\n').map((l) => indent + l).join('\n'));
    if (b.children?.length) out.push(blocksToMarkdown(b.children, resolveTitle, indent + '    '));
  }
  return out.join('\n\n').replace(/\n{3,}/g, '\n\n');
}

// ---------- markdown → blocks ----------

export function markdownToBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const root: Block[] = [];
  const stack: { indent: number; block: Block }[] = [];
  const push = (b: Block, indent: number) => {
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1]?.block;
    if (parent && ['bullet', 'numbered', 'todo', 'toggle', 'quote'].includes(parent.type)) (parent.children ??= []).push(b);
    else root.push(b);
    stack.push({ indent, block: b });
  };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) { stack.length = 0; continue; }
    const indent = raw.match(/^\s*/)![0].replace(/\t/g, '    ').length;
    const line = raw.trim();
    let m: RegExpMatchArray | null;
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) body.push(lines[i++]);
      push(newBlock('code', { html: escapeHtml(body.join('\n')), language: lang || 'plain text' }), indent);
      continue;
    }
    if (line === '$$') {
      const body: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '$$') body.push(lines[i++]);
      push(newBlock('equation', { html: escapeHtml(body.join('\n')) }), indent);
      continue;
    }
    if (/^\|.*\|$/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        const r = lines[i].trim().slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim());
        if (!r.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(r.map((c) => inlineMdToHtml(c.replace(/\\\|/g, '|'))));
        i++;
      }
      i--;
      push(newBlock('table', { rows, headerRow: true }), indent);
      continue;
    }
    let type: BlockType = 'text';
    let text = line;
    let checked: boolean | undefined;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { type = (['h1', 'h2', 'h3', 'h4'] as const)[m[1].length - 1]; text = m[2]; }
    else if ((m = line.match(/^[-*+]\s+\[([ xX])\]\s*(.*)$/))) { type = 'todo'; checked = m[1] !== ' '; text = m[2]; }
    else if ((m = line.match(/^[-*+]\s+(.*)$/))) { type = 'bullet'; text = m[1]; }
    else if ((m = line.match(/^\d+[.)]\s+(.*)$/))) { type = 'numbered'; text = m[1]; }
    else if ((m = line.match(/^>\s?(.*)$/))) { type = 'quote'; text = m[1]; }
    else if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { push(newBlock('divider'), indent); continue; }
    else if ((m = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/))) { push(newBlock('image', { url: m[2], caption: m[1] }), indent); continue; }
    push(newBlock(type, { html: inlineMdToHtml(text), checked }), indent);
  }
  return root.length ? root : [newBlock()];
}

// ---------- HTML export ----------

export function blocksToHTML(blocks: Block[], resolveTitle: (id: string) => string = () => 'Untitled'): string {
  const out: string[] = [];
  let listTag: string | null = null;
  const closeList = () => { if (listTag) { out.push(`</${listTag}>`); listTag = null; } };
  for (const b of blocks) {
    const kids = b.children?.length ? blocksToHTML(b.children, resolveTitle) : '';
    const want = b.type === 'bullet' || b.type === 'todo' ? 'ul' : b.type === 'numbered' ? 'ol' : null;
    if (want !== listTag) { closeList(); if (want) { out.push(`<${want}>`); listTag = want; } }
    const cls = [b.color && b.color !== 'default' ? `c-${b.color}` : '', b.bg && b.bg !== 'default' ? `bg-${b.bg}` : ''].filter(Boolean).join(' ');
    const c = cls ? ` class="${cls}"` : '';
    switch (b.type) {
      case 'h1': case 'toggle_h1': out.push(`<h1${c}>${b.html}</h1>${kids}`); break;
      case 'h2': case 'toggle_h2': out.push(`<h2${c}>${b.html}</h2>${kids}`); break;
      case 'h3': case 'toggle_h3': out.push(`<h3${c}>${b.html}</h3>${kids}`); break;
      case 'h4': out.push(`<h4${c}>${b.html}</h4>${kids}`); break;
      case 'bullet': case 'numbered': out.push(`<li${c}>${b.html}${kids}</li>`); break;
      case 'todo': out.push(`<li${c}><input type="checkbox" ${b.checked ? 'checked' : ''} disabled> ${b.html}${kids}</li>`); break;
      case 'toggle': out.push(`<details ${b.open ? 'open' : ''}><summary>${b.html}</summary>${kids}</details>`); break;
      case 'quote': out.push(`<blockquote${c}>${b.html}${kids}</blockquote>`); break;
      case 'callout': out.push(`<aside class="callout ${b.bg ? 'bg-' + b.bg : ''}"><span>${b.icon ?? ''}</span><div>${b.html}${kids}</div></aside>`); break;
      case 'divider': out.push('<hr>'); break;
      case 'code': out.push(`<pre><code class="language-${b.language}">${b.html}</code></pre>`); break;
      case 'equation': out.push(`<div class="equation">$$${b.html}$$</div>`); break;
      case 'image': out.push(`<figure><img src="${b.url}" style="max-width:100%">${b.caption ? `<figcaption>${escapeHtml(b.caption)}</figcaption>` : ''}</figure>`); break;
      case 'video': out.push(`<video src="${b.url}" controls style="max-width:100%"></video>`); break;
      case 'audio': out.push(`<audio src="${b.url}" controls></audio>`); break;
      case 'bookmark': case 'embed': case 'pdf': case 'file': out.push(`<p><a href="${b.url}">${escapeHtml(b.name || b.meta?.title || b.url || '')}</a></p>`); break;
      case 'page': case 'link_page': out.push(`<p>📄 ${escapeHtml(resolveTitle(b.pageId ?? ''))}</p>`); break;
      case 'table': out.push(`<table>${(b.rows ?? []).map((r, i) => `<tr>${r.map((cell, j) => (i === 0 && b.headerRow) || (j === 0 && b.headerCol) ? `<th>${cell}</th>` : `<td>${cell}</td>`).join('')}</tr>`).join('')}</table>`); break;
      case 'columns': out.push(`<div style="display:flex;gap:24px">${(b.children ?? []).map((col) => `<div style="flex:1">${blocksToHTML(col.children ?? [], resolveTitle)}</div>`).join('')}</div>`); break;
      case 'synced': out.push(kids); break;
      case 'tabs': for (const t of b.tabs ?? []) out.push(`<h4>${escapeHtml(t.name)}</h4>${blocksToHTML(t.children, resolveTitle)}`); break;
      case 'toc': case 'breadcrumb': case 'button': case 'database': break;
      default: out.push(`<p${c}>${b.html || '<br>'}</p>${kids ? `<div style="margin-left:24px">${kids}</div>` : ''}`);
    }
  }
  closeList();
  return out.join('\n');
}

export function htmlDocument(title: string, body: string, icon?: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;max-width:720px;margin:60px auto;padding:0 24px;color:#37352f;line-height:1.6}
h1.title{font-size:40px}pre{background:#f7f6f3;padding:16px;border-radius:4px;overflow:auto}code{background:rgba(135,131,120,.15);color:#eb5757;padding:2px 4px;border-radius:3px}pre code{background:none;color:inherit}
blockquote{border-left:3px solid currentColor;margin:0;padding-left:14px}.callout{display:flex;gap:10px;padding:16px;border-radius:4px;background:#f1f1ef}table{border-collapse:collapse}td,th{border:1px solid #e9e9e7;padding:6px 8px}
.c-red{color:#d44c47}.c-blue{color:#337ea9}.c-green{color:#448361}.c-orange{color:#d9730d}.c-yellow{color:#cb912f}.c-purple{color:#9065b0}.c-pink{color:#c14c8a}.c-brown{color:#9f6b53}.c-gray{color:#787774}
.bg-red{background:#fdebec}.bg-blue{background:#e7f3f8}.bg-green{background:#edf3ec}.bg-yellow{background:#fbf3db}.bg-orange{background:#fbecdd}.bg-purple{background:#f6f3f9}.bg-pink{background:#faf1f5}.bg-gray{background:#f1f1ef}.bg-brown{background:#f4eeee}</style></head>
<body><h1 class="title">${icon ? icon + ' ' : ''}${escapeHtml(title)}</h1>${body}</body></html>`;
}

/** Convert pasted HTML (e.g. from Google Docs or the web) into blocks. */
export function htmlToBlocks(html: string): Block[] {
  const d = document.createElement('div');
  d.innerHTML = html;
  const out: Block[] = [];
  const inline = (el: Element) => {
    const c = el.cloneNode(true) as HTMLElement;
    c.querySelectorAll('script,style,meta').forEach((x) => x.remove());
    return c.innerHTML.replace(/<(?!\/?(b|strong|i|em|u|s|strike|code|a|br)\b)[^>]*>/gi, '').trim();
  };
  const visit = (el: Element) => {
    const tag = el.tagName;
    if (/^H[1-6]$/.test(tag)) { out.push(newBlock((['h1', 'h2', 'h3', 'h3', 'h3', 'h3'] as const)[+tag[1] - 1], { html: inline(el) })); return; }
    if (tag === 'P' || tag === 'DIV' && !el.querySelector('p,h1,h2,h3,ul,ol,pre,blockquote,table,img')) { const h = inline(el); if (h) out.push(newBlock('text', { html: h })); return; }
    if (tag === 'UL' || tag === 'OL') {
      for (const li of Array.from(el.children)) {
        const cb = li.querySelector('input[type=checkbox]') as HTMLInputElement | null;
        out.push(newBlock(cb ? 'todo' : tag === 'UL' ? 'bullet' : 'numbered', { html: inline(li), checked: cb?.checked }));
      }
      return;
    }
    if (tag === 'BLOCKQUOTE') { out.push(newBlock('quote', { html: inline(el) })); return; }
    if (tag === 'PRE') { out.push(newBlock('code', { html: escapeHtml(el.textContent ?? ''), language: 'plain text' })); return; }
    if (tag === 'HR') { out.push(newBlock('divider')); return; }
    if (tag === 'IMG') { out.push(newBlock('image', { url: (el as HTMLImageElement).src })); return; }
    if (tag === 'TABLE') {
      const rows = Array.from(el.querySelectorAll('tr')).map((tr) => Array.from(tr.children).map((c) => inline(c)));
      out.push(newBlock('table', { rows, headerRow: !!el.querySelector('th') }));
      return;
    }
    if (el.children.length) Array.from(el.children).forEach(visit);
    else if (el.textContent?.trim()) out.push(newBlock('text', { html: inline(el) }));
  };
  Array.from(d.children).forEach(visit);
  return out;
}
