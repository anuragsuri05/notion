import { useRef, useState } from 'react';
import { Image as ImageIcon, Video, Music, Paperclip, Bookmark, Code2, FileText, AlignLeft, AlignCenter, AlignRight, Download, Maximize2, MoreHorizontal, MessageSquare, Type, Replace, ExternalLink, Trash2, Link2 } from 'lucide-react';
import type { Block } from '../../store/types';
import { useEditor } from '../Editor';
import { Popover, Tip, MenuPopover, useAnchor } from '../../components/ui';
import { cx, fmtBytes, pickFile, readFileAsDataURL, uid, download } from '../../lib/util';
import { createPortal } from 'react-dom';

const META: Record<string, { icon: typeof ImageIcon; label: string; accept: string; embedLabel: string }> = {
  image: { icon: ImageIcon, label: 'Add an image', accept: 'image/*', embedLabel: 'Embed image' },
  video: { icon: Video, label: 'Embed or upload a video', accept: 'video/*', embedLabel: 'Embed video' },
  audio: { icon: Music, label: 'Embed or upload audio', accept: 'audio/*', embedLabel: 'Embed audio' },
  file: { icon: Paperclip, label: 'Upload or embed a file', accept: '*/*', embedLabel: 'Embed link' },
  pdf: { icon: FileText, label: 'Embed or upload a PDF', accept: 'application/pdf', embedLabel: 'Embed PDF' },
  bookmark: { icon: Bookmark, label: 'Add a web bookmark', accept: '', embedLabel: 'Create bookmark' },
  embed: { icon: Code2, label: 'Embed anything', accept: '', embedLabel: 'Embed link' },
};

export function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, '');
    if (h === 'youtube.com' || h === 'm.youtube.com') { const v = u.searchParams.get('v'); if (v) return `https://www.youtube.com/embed/${v}`; if (u.pathname.startsWith('/embed/')) return url; if (u.pathname.startsWith('/shorts/')) return `https://www.youtube.com/embed/${u.pathname.split('/')[2]}`; }
    if (h === 'youtu.be') return `https://www.youtube.com/embed${u.pathname}`;
    if (h === 'vimeo.com') return `https://player.vimeo.com/video${u.pathname}`;
    if (h === 'loom.com') return url.replace('/share/', '/embed/');
    if (h === 'figma.com') return `https://www.figma.com/embed?embed_host=moving&url=${encodeURIComponent(url)}`;
    if (h === 'codepen.io') return url.replace('/pen/', '/embed/');
    if (h === 'open.spotify.com') return url.replace('open.spotify.com/', 'open.spotify.com/embed/');
    if (h === 'google.com' && u.pathname.startsWith('/maps')) return url.includes('/embed') ? url : `https://maps.google.com/maps?q=${encodeURIComponent(u.pathname.split('/place/')[1]?.split('/')[0] ?? u.searchParams.get('q') ?? '')}&output=embed`;
    if (h === 'docs.google.com') return url.replace(/\/edit.*$/, '/preview');
    if (h === 'miro.com') return url.replace('/board/', '/app/live-embed/');
    if (h === 'codesandbox.io') return url.replace('/s/', '/embed/');
    if (h === 'airtable.com') return url.replace('airtable.com/', 'airtable.com/embed/');
    if (h === 'calendly.com') return url;
    if (h === 'excalidraw.com' || h === 'whimsical.com' || h === 'replit.com') return url;
    return url;
  } catch { return null; }
}

export default function MediaBlock({ block }: { block: Block }) {
  const api = useEditor();
  const [picker, setPicker] = useState<HTMLElement | null>(null);
  const m = META[block.type];

  if (!block.url) {
    const Icon = m.icon;
    return (
      <>
        <div className="media-empty media" onClick={(e) => !api.readOnly && setPicker(e.currentTarget)}>
          <Icon size={20} /> <span>{m.label}</span>
          {block.meta?.title && <span className="faint small" style={{ marginLeft: 'auto' }}>{block.meta.title}</span>}
        </div>
        {picker && <MediaPicker block={block} anchor={picker} onClose={() => setPicker(null)} />}
      </>
    );
  }

  switch (block.type) {
    case 'image': return <ImageView block={block} />;
    case 'video': {
      const e = embedUrl(block.url);
      const isFile = block.url.startsWith('data:') || /\.(mp4|webm|mov|ogg)(\?|$)/i.test(block.url);
      return <Resizable block={block} ratio>{isFile ? <video src={block.url} controls className="media-fill" /> : <iframe src={e ?? block.url} className="media-fill" allowFullScreen allow="autoplay; encrypted-media; picture-in-picture" title="video" />}</Resizable>;
    }
    case 'audio': return <div className="media audio-block"><audio src={block.url} controls style={{ width: '100%' }} />{block.name && <div className="faint small">{block.name}</div>}</div>;
    case 'pdf': return <Resizable block={block} height={600}><iframe src={block.url} className="media-fill" title="pdf" /></Resizable>;
    case 'file': return (
      <div className="media file-block" onClick={() => block.url && (block.url.startsWith('data:') ? download(block.name ?? 'file', dataUrlToBlob(block.url)) : window.open(block.url, '_blank'))}>
        <Paperclip size={16} /> <span className="file-name">{block.name ?? block.url}</span><span className="faint small">{fmtBytes(block.size)}</span>
      </div>
    );
    case 'bookmark': return <BookmarkView block={block} />;
    case 'embed': return <Resizable block={block} height={block.width ? undefined : 400}><iframe src={embedUrl(block.url) ?? block.url} className="media-fill" title="embed" allowFullScreen sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation" /></Resizable>;
  }
  return null;
}

export function dataUrlToBlob(url: string) {
  const [h, b64] = url.split(',');
  const mime = /data:([^;]+)/.exec(h)?.[1] ?? 'application/octet-stream';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function MediaPicker({ block, anchor, onClose }: { block: Block; anchor: HTMLElement; onClose: () => void }) {
  const api = useEditor();
  const m = META[block.type];
  const canUpload = block.type !== 'bookmark' && block.type !== 'embed';
  const [tab, setTab] = useState<'upload' | 'link' | 'gallery'>(canUpload ? 'upload' : 'link');
  const [link, setLink] = useState('');
  const upload = async () => {
    const [f] = await pickFile(m.accept);
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) { alert('Files over 25 MB are not supported in local mode.'); return; }
    const url = await readFileAsDataURL(f);
    api.ops.update(block.id, { url, name: f.name, size: f.size });
    onClose();
  };
  const GALLERY = ['linear-gradient(135deg,#667eea,#764ba2)', 'linear-gradient(135deg,#f093fb,#f5576c)', 'linear-gradient(135deg,#4facfe,#00f2fe)', 'linear-gradient(135deg,#43e97b,#38f9d7)', 'linear-gradient(135deg,#fa709a,#fee140)', 'linear-gradient(135deg,#30cfd0,#330867)'];
  return (
    <Popover anchor={anchor} onClose={onClose} width={Math.max(anchor.offsetWidth, 420)}>
      <div className="menu media-picker">
        <div className="tabs-row">
          {canUpload && <button className={cx('tab', tab === 'upload' && 'active')} onClick={() => setTab('upload')}>Upload</button>}
          <button className={cx('tab', tab === 'link' && 'active')} onClick={() => setTab('link')}>{block.type === 'bookmark' ? 'Bookmark' : 'Embed link'}</button>
          {block.type === 'image' && <button className={cx('tab', tab === 'gallery' && 'active')} onClick={() => setTab('gallery')}>Gradients</button>}
        </div>
        <div style={{ padding: 12 }}>
          {tab === 'upload' && (
            <div className="col">
              <button className="btn btn-outline" style={{ justifyContent: 'center' }} onClick={upload}>Choose a file</button>
              <div className="faint small" style={{ textAlign: 'center' }}>The maximum size per file is 25 MB. Files are stored in your browser.</div>
            </div>
          )}
          {tab === 'link' && (
            <form className="col" onSubmit={(e) => { e.preventDefault(); if (!link.trim()) return; const url = /^https?:|^data:/.test(link) ? link.trim() : `https://${link.trim()}`; api.ops.update(block.id, { url, name: url.split('/').pop() }); onClose(); }}>
              <input autoFocus className="input" placeholder={block.meta?.title ?? 'Paste in https://…'} value={link} onChange={(e) => setLink(e.target.value)} />
              <button className="btn btn-primary" style={{ justifyContent: 'center', alignSelf: 'center', minWidth: 200 }}>{m.embedLabel}</button>
              <div className="faint small" style={{ textAlign: 'center' }}>Works with YouTube, Vimeo, Loom, Figma, Google Maps & Docs, CodePen, Miro, Spotify, PDFs and more</div>
            </form>
          )}
          {tab === 'gallery' && (
            <div className="cover-grid">
              {GALLERY.map((g) => (
                <button key={g} className="cover-swatch" style={{ background: g }} onClick={() => {
                  const c = document.createElement('canvas'); c.width = 1200; c.height = 600;
                  const ctx = c.getContext('2d')!; const cols = g.match(/#[0-9a-f]{6}/gi)!;
                  const grad = ctx.createLinearGradient(0, 0, 1200, 600); grad.addColorStop(0, cols[0]); grad.addColorStop(1, cols[1]);
                  ctx.fillStyle = grad; ctx.fillRect(0, 0, 1200, 600);
                  api.ops.update(block.id, { url: c.toDataURL('image/png'), name: 'gradient.png' }); onClose();
                }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Popover>
  );
}

function Resizable({ block, children, ratio, height }: { block: Block; children: React.ReactNode; ratio?: boolean; height?: number }) {
  const api = useEditor();
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState<number | null>(null);
  const width = w ?? block.width ?? 100;
  const start = (side: 'l' | 'r', e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const parent = ref.current!.parentElement!.getBoundingClientRect().width;
    const x0 = e.clientX, w0 = (width / 100) * parent;
    let cur = width;
    const move = (ev: MouseEvent) => {
      const dx = (ev.clientX - x0) * (side === 'r' ? 1 : -1) * (block.align === 'center' || !block.align ? 2 : 1);
      cur = Math.max(15, Math.min(100, ((w0 + dx) / parent) * 100));
      setW(cur);
    };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); api.ops.update(block.id, { width: Math.round(cur) }); setW(null); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };
  return (
    <div className={cx('media resizable', `align-${block.align ?? 'center'}`)}>
      <div ref={ref} className="resizable-inner" style={{ width: `${width}%`, aspectRatio: ratio ? '16 / 9' : undefined, height: !ratio && height ? height : undefined }}>
        {children}
        {!api.readOnly && <><div className="resize-handle left" onMouseDown={(e) => start('l', e)} /><div className="resize-handle right" onMouseDown={(e) => start('r', e)} /></>}
        {w !== null && <div className="resize-shield" />}
      </div>
    </div>
  );
}

function ImageView({ block }: { block: Block }) {
  const api = useEditor();
  const [full, setFull] = useState(false);
  const more = useAnchor();
  const align = useAnchor();
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState<number | null>(null);
  const width = w ?? block.width ?? 100;
  const start = (side: 'l' | 'r', e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const parent = ref.current!.parentElement!.getBoundingClientRect().width;
    const x0 = e.clientX, w0 = (width / 100) * parent;
    let cur = width;
    const move = (ev: MouseEvent) => {
      const k = !block.align || block.align === 'center' ? 2 : 1;
      cur = Math.max(10, Math.min(100, ((w0 + (ev.clientX - x0) * (side === 'r' ? 1 : -1) * k) / parent) * 100));
      setW(cur);
    };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); api.ops.update(block.id, { width: Math.round(cur) }); setW(null); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };
  const replace = async () => {
    const [f] = await pickFile('image/*');
    if (f) api.ops.update(block.id, { url: await readFileAsDataURL(f), name: f.name, size: f.size });
  };
  const AlignIcon = block.align === 'left' ? AlignLeft : block.align === 'right' ? AlignRight : AlignCenter;
  return (
    <div className={cx('media image-block', `align-${block.align ?? 'center'}`)}>
      <div ref={ref} className="image-wrap" style={{ width: `${width}%` }} onDoubleClick={() => setFull(true)}>
        <img src={block.url} alt={block.caption ?? ''} draggable={false} onKeyDown={(e) => { if (e.key === ' ') setFull(true); }} />
        {!api.readOnly && (
          <>
            <div className="resize-handle left" onMouseDown={(e) => start('l', e)} />
            <div className="resize-handle right" onMouseDown={(e) => start('r', e)} />
            <div className="media-toolbar">
              <Tip label="Align"><button className="mt-btn" onClick={align.open}><AlignIcon size={14} /></button></Tip>
              <Tip label="Caption"><button className="mt-btn" onClick={() => api.ops.update(block.id, { caption: block.caption ?? '' })}><Type size={14} /></button></Tip>
              <Tip label="Comment"><button className="mt-btn" onClick={() => window.dispatchEvent(new CustomEvent('moving:comment', { detail: { pageId: api.pageId, blockId: block.id, threadId: uid(), quote: '' } }))}><MessageSquare size={14} /></button></Tip>
              <Tip label="Download"><button className="mt-btn" onClick={() => block.url!.startsWith('data:') ? download(block.name ?? 'image.png', dataUrlToBlob(block.url!)) : window.open(block.url, '_blank')}><Download size={14} /></button></Tip>
              <Tip label="View original"><button className="mt-btn" onClick={() => setFull(true)}><Maximize2 size={14} /></button></Tip>
              <button className="mt-btn" onClick={more.open}><MoreHorizontal size={14} /></button>
            </div>
          </>
        )}
      </div>
      {block.caption !== undefined && (
        <input className="caption-input" style={{ width: `${width}%` }} value={block.caption} placeholder="Write a caption…" readOnly={api.readOnly} onChange={(e) => api.ops.update(block.id, { caption: e.target.value }, true)} />
      )}
      {align.anchor && <MenuPopover anchor={align.anchor} onClose={align.close} width={160} items={[
        { label: 'Left', icon: <AlignLeft size={16} />, checked: block.align === 'left', onClick: () => api.ops.update(block.id, { align: 'left' }) },
        { label: 'Center', icon: <AlignCenter size={16} />, checked: !block.align || block.align === 'center', onClick: () => api.ops.update(block.id, { align: 'center' }) },
        { label: 'Right', icon: <AlignRight size={16} />, checked: block.align === 'right', onClick: () => api.ops.update(block.id, { align: 'right' }) },
      ]} />}
      {more.anchor && <MenuPopover anchor={more.anchor} onClose={more.close} width={220} items={[
        { label: 'Replace', icon: <Replace size={16} />, onClick: replace },
        { label: 'Copy link to block', icon: <Link2 size={16} />, onClick: () => navigator.clipboard.writeText(`${location.origin}${location.pathname}#/page/${api.pageId}#${block.id}`) },
        { label: 'Open in new tab', icon: <ExternalLink size={16} />, onClick: () => { const w2 = window.open(); if (w2) w2.document.write(`<img src="${block.url}" style="max-width:100%">`); } },
        { label: 'Full width', icon: <Maximize2 size={16} />, onClick: () => api.ops.update(block.id, { width: 100 }) },
        { label: 'Delete', icon: <Trash2 size={16} />, danger: true, onClick: () => api.ops.remove([block.id]) },
      ]} />}
      {full && createPortal(
        <div className="lightbox" onClick={() => setFull(false)} onKeyDown={(e) => e.key === 'Escape' && setFull(false)} tabIndex={-1} ref={(el) => el?.focus()}>
          <img src={block.url} alt="" />
        </div>, document.body)}
    </div>
  );
}

function BookmarkView({ block }: { block: Block }) {
  let host = '';
  try { host = new URL(block.url!).hostname; } catch { /* ignore */ }
  const title = block.meta?.title && !block.meta.title.startsWith('https://') ? block.meta.title : host || block.url;
  return (
    <a className="media bookmark" href={block.url} target="_blank" rel="noreferrer" contentEditable={false}>
      <div className="bookmark-text">
        <div className="bookmark-title">{title}</div>
        <div className="bookmark-desc faint">{block.meta?.description ?? `Visit ${host}`}</div>
        <div className="bookmark-url"><img src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`} alt="" width={16} height={16} /> <span className="ellipsis">{block.url}</span></div>
      </div>
    </a>
  );
}
