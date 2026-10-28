import { useState } from 'react';
import { Popover } from './ui';
import type { CoverValue } from '../store/types';
import { cx, pickFile, readFileAsDataURL } from '../lib/util';

const GRADIENTS = [
  'linear-gradient(120deg, #f6d365 0%, #fda085 100%)', 'linear-gradient(120deg, #a1c4fd 0%, #c2e9fb 100%)', 'linear-gradient(120deg, #d4fc79 0%, #96e6a1 100%)',
  'linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)', 'linear-gradient(120deg, #e0c3fc 0%, #8ec5fc 100%)', 'linear-gradient(120deg, #fccb90 0%, #d57eeb 100%)',
  'linear-gradient(120deg, #ff9a9e 0%, #fad0c4 100%)', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
];
const COLORS = ['#e16259', '#d9730d', '#dfab01', '#0f7b6c', '#0b6e99', '#6940a5', '#ad1a72', '#64473a', '#9b9a97', '#191919', '#f1f1ef', '#fbf3db'];
const TEXTURES = [
  'repeating-linear-gradient(45deg, #e7f3f8 0 12px, #d3e5ef 12px 24px)',
  'radial-gradient(circle at 20% 30%, #fdebec 0 20%, transparent 21%), radial-gradient(circle at 70% 60%, #e7f3f8 0 25%, transparent 26%), #fbf3db',
  'conic-gradient(from 90deg at 50% 50%, #edf3ec, #fbecdd, #f6f3f9, #edf3ec)',
  'repeating-radial-gradient(circle at 50% 50%, #f1f1ef 0 8px, #e3e2e0 8px 16px)',
];

export default function CoverPicker({ anchor, onClose, onPick }: { anchor: HTMLElement; onClose: () => void; onPick: (c: CoverValue | null) => void }) {
  const [tab, setTab] = useState<'gallery' | 'upload' | 'link' | 'unsplash'>('gallery');
  const [link, setLink] = useState('');
  const [q, setQ] = useState('');
  return (
    <Popover anchor={anchor} onClose={onClose} placement="bottom-end" width={540}>
      <div className="menu cover-picker">
        <div className="tabs-row">
          {(['gallery', 'upload', 'link', 'unsplash'] as const).map((t) => <button key={t} className={cx('tab', tab === t && 'active')} onClick={() => setTab(t)}>{t === 'link' ? 'Link' : t[0].toUpperCase() + t.slice(1)}</button>)}
          <div className="grow" />
          <button className="btn btn-sm" onClick={() => onPick(null)}>Remove</button>
        </div>
        <div className="cover-body">
          {tab === 'gallery' && (
            <>
              <div className="menu-header">Color & gradient</div>
              <div className="cover-grid">{[...COLORS, ...GRADIENTS].map((g) => <button key={g} className="cover-swatch" style={{ background: g }} onClick={() => onPick({ kind: 'color', value: g, pos: 50 })} />)}</div>
              <div className="menu-header">Patterns</div>
              <div className="cover-grid">{TEXTURES.map((g) => <button key={g} className="cover-swatch" style={{ background: g }} onClick={() => onPick({ kind: 'color', value: g, pos: 50 })} />)}</div>
            </>
          )}
          {tab === 'upload' && (
            <div className="col" style={{ alignItems: 'center', padding: 16 }}>
              <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }} onClick={async () => { const [f] = await pickFile('image/*'); if (f) onPick({ kind: 'image', value: await readFileAsDataURL(f), pos: 50 }); }}>Upload file</button>
              <div className="faint small">Images wider than 1500 pixels work best. The maximum size per file is 5 MB.</div>
            </div>
          )}
          {tab === 'link' && (
            <form className="col" style={{ padding: 12 }} onSubmit={(e) => { e.preventDefault(); if (link.trim()) onPick({ kind: 'image', value: link.trim(), pos: 50 }); }}>
              <input autoFocus className="input" placeholder="Paste an image link…" value={link} onChange={(e) => setLink(e.target.value)} />
              <button className="btn btn-primary" style={{ alignSelf: 'center', minWidth: 200, justifyContent: 'center' }}>Submit</button>
              <div className="faint small" style={{ textAlign: 'center' }}>Works with any image from the web.</div>
            </form>
          )}
          {tab === 'unsplash' && (
            <div className="col" style={{ padding: 12 }}>
              <input autoFocus className="input" placeholder="Search for an image… (e.g. mountains, ocean, city)" value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="cover-grid photos">
                {(q ? [1, 2, 3, 4, 5, 6, 7, 8] : []).map((i) => {
                  const url = `https://picsum.photos/seed/${encodeURIComponent(q)}-${i}/1500/600`;
                  return <button key={i} className="cover-photo" style={{ backgroundImage: `url(https://picsum.photos/seed/${encodeURIComponent(q)}-${i}/300/120)` }} onClick={() => onPick({ kind: 'image', value: url, pos: 50 })} />;
                })}
              </div>
              {!q && <div className="faint small">Type a keyword to find free photos (served by picsum.photos).</div>}
            </div>
          )}
        </div>
      </div>
    </Popover>
  );
}
