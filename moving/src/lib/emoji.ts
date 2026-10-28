import groups from 'unicode-emoji-json/data-by-group.json';

export interface Emoji { e: string; n: string; g: string; skin: boolean }

export const EMOJI_GROUPS: { name: string; emojis: Emoji[] }[] = (groups as any[]).map((g) => ({
  name: g.name,
  emojis: g.emojis.map((x: any) => ({ e: x.emoji, n: x.name, g: g.name, skin: x.skin_tone_support })),
}));

export const ALL_EMOJI: Emoji[] = EMOJI_GROUPS.flatMap((g) => g.emojis);

export function searchEmoji(q: string, limit = 200): Emoji[] {
  const s = q.trim().toLowerCase().replace(/_/g, ' ');
  if (!s) return ALL_EMOJI.slice(0, limit);
  const starts: Emoji[] = [], contains: Emoji[] = [];
  for (const em of ALL_EMOJI) {
    if (em.n.startsWith(s)) starts.push(em);
    else if (em.n.includes(s)) contains.push(em);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

export const SKIN_TONES = ['', '\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}'];

export function withSkin(e: Emoji, tone: number) {
  if (!tone || !e.skin) return e.e;
  const chars = Array.from(e.e);
  return chars[0] + SKIN_TONES[tone] + chars.slice(1).join('');
}

export function randomEmoji() {
  const pool = EMOJI_GROUPS.filter((g) => !['Flags', 'Symbols', 'Component'].includes(g.name)).flatMap((g) => g.emojis);
  return pool[Math.floor(Math.random() * pool.length)].e;
}
