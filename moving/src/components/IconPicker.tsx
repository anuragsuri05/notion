import { useMemo, useState } from 'react';
import { Shuffle, Trash2 } from 'lucide-react';
import { EMOJI_GROUPS, searchEmoji, withSkin, randomEmoji, SKIN_TONES } from '../lib/emoji';
import { SearchInput } from './ui';
import { cx, pickFile, readFileAsDataURL } from '../lib/util';
import { useStore } from '../store/store';

const ICON_SET = ['📄', '📝', '📌', '📎', '📁', '📂', '🗂️', '📅', '📆', '📊', '📈', '📉', '✅', '☑️', '🎯', '🚀', '💡', '🔥', '⭐', '❤️', '🏠', '🏢', '💼', '🧠', '🛠️', '⚙️', '🔒', '🔑', '🌍', '🎨', '🎵', '📚', '📖', '✏️', '🧪', '💻', '📱', '🧭', '🗺️', '🏆', '🎉', '🍀', '☕', '🌱', '🌙', '☀️', '⚡', '💬', '📣', '🔔'];
const COLOR_ICONS = ['🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫', '⬛', '⬜', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '🟤', '⚫', '⚪'];

export default function IconPicker({ onPick, allowRemove = true }: { onPick: (icon: string | null) => void; allowRemove?: boolean }) {
  const [tab, setTab] = useState<'emoji' | 'icons' | 'upload' | 'custom'>('emoji');
  const [q, setQ] = useState('');
  const [tone, setTone] = useState(0);
  const [link, setLink] = useState('');
  const customEmojis = useStore((s) => s.emojis);
  const recent = useMemo<string[]>(() => { try { return JSON.parse(localStorage.getItem('moving-recent-emoji') ?? '[]'); } catch { return []; } }, []);
  const pick = (e: string) => {
    try { localStorage.setItem('moving-recent-emoji', JSON.stringify([e, ...recent.filter((x) => x !== e)].slice(0, 16))); } catch { /* ignore */ }
    onPick(e);
  };
  const results = q ? searchEmoji(q, 300) : null;

  return (
    <div className="icon-picker menu">
      <div className="tabs-row">
        {(['emoji', 'icons', 'custom', 'upload'] as const).map((t) => (
          <button key={t} className={cx('tab', tab === t && 'active')} onClick={() => setTab(t)}>{t === 'emoji' ? 'Emoji' : t === 'icons' ? 'Icons' : t === 'custom' ? 'Custom' : 'Upload'}</button>
        ))}
        <div className="grow" />
        {allowRemove && <button className="btn btn-sm" onClick={() => onPick(null)}><Trash2 size={13} /> Remove</button>}
      </div>
      {tab === 'emoji' && (
        <>
          <div className="row" style={{ padding: '8px 8px 4px' }}>
            <div className="grow"><SearchInput autoFocus value={q} onChange={setQ} placeholder="Filter…" /></div>
            <button className="icon-btn" title="Random" onClick={() => pick(randomEmoji())}><Shuffle size={16} /></button>
            <button className="icon-btn" title="Skin tone" onClick={() => setTone((t) => (t + 1) % SKIN_TONES.length)}>{'✋' + SKIN_TONES[tone]}</button>
          </div>
          <div className="emoji-scroll">
            {results ? (
              <div className="emoji-grid big">{results.map((e) => <button key={e.e + e.n} className="emoji-cell" title={e.n} onClick={() => pick(withSkin(e, tone))}>{withSkin(e, tone)}</button>)}</div>
            ) : (
              <>
                {recent.length > 0 && <><div className="menu-header">Recent</div><div className="emoji-grid big">{recent.map((e) => <button key={e} className="emoji-cell" onClick={() => pick(e)}>{e}</button>)}</div></>}
                {EMOJI_GROUPS.filter((g) => g.name !== 'Component').map((g) => (
                  <div key={g.name}>
                    <div className="menu-header">{g.name}</div>
                    <div className="emoji-grid big">{g.emojis.map((e) => <button key={e.e} className="emoji-cell" title={e.n} onClick={() => pick(withSkin(e, tone))}>{withSkin(e, tone)}</button>)}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}
      {tab === 'icons' && (
        <div className="emoji-scroll" style={{ padding: 8 }}>
          <div className="menu-header">Common</div>
          <div className="emoji-grid big">{ICON_SET.map((e) => <button key={e} className="emoji-cell" onClick={() => pick(e)}>{e}</button>)}</div>
          <div className="menu-header">Colors</div>
          <div className="emoji-grid big">{COLOR_ICONS.map((e) => <button key={e} className="emoji-cell" onClick={() => pick(e)}>{e}</button>)}</div>
        </div>
      )}
      {tab === 'custom' && (
        <div className="emoji-scroll" style={{ padding: 8 }}>
          {customEmojis.length === 0 && <div className="faint small" style={{ padding: 8 }}>No custom emoji yet. Add some in Settings → Emoji.</div>}
          <div className="emoji-grid big">{customEmojis.map((e) => <button key={e.name} className="emoji-cell" title={`:${e.name}:`} onClick={() => onPick(e.url)}><img src={e.url} alt="" width={22} height={22} /></button>)}</div>
        </div>
      )}
      {tab === 'upload' && (
        <div className="col" style={{ padding: 12 }}>
          <button className="btn btn-outline" style={{ justifyContent: 'center' }} onClick={async () => { const [f] = await pickFile('image/*'); if (f) onPick(await readFileAsDataURL(f)); }}>Upload an image</button>
          <div className="faint small" style={{ textAlign: 'center' }}>Recommended size is 280 × 280 pixels</div>
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (link.trim()) onPick(link.trim()); }}>
            <input className="input" placeholder="Paste link to an image…" value={link} onChange={(e) => setLink(e.target.value)} />
            <button className="btn btn-primary btn-sm">Submit</button>
          </form>
        </div>
      )}
    </div>
  );
}
