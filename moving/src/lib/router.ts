import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'page'; id: string; block?: string }
  | { name: 'public'; id: string }
  | { name: 'inbox' }
  | { name: 'ai'; chat?: string }
  | { name: 'meetings' }
  | { name: 'root' };

export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  const [path, anchor] = h.split('#');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'home') return { name: 'home' };
  if (parts[0] === 'inbox') return { name: 'inbox' };
  if (parts[0] === 'meetings') return { name: 'meetings' };
  if (parts[0] === 'ai') return { name: 'ai', chat: parts[1] };
  if (parts[0] === 'p' && parts[1]) return { name: 'public', id: parts[1] };
  if (parts[0] === 'page' && parts[1]) return { name: 'page', id: parts[1], block: anchor };
  return { name: 'root' };
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return parseRoute(hash);
}

export function navigate(path: string, replace = false) {
  const target = '#' + (path.startsWith('/') ? path : '/' + path);
  if (replace) window.history.replaceState(null, '', target);
  else window.location.hash = target;
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export const goPage = (id: string, block?: string) => navigate(`/page/${id}${block ? '#' + block : ''}`);

export function pageUrl(id: string, block?: string) {
  return `${window.location.origin}${window.location.pathname}#/page/${id}${block ? '#' + block : ''}`;
}

export function publicUrl(id: string) {
  return `${window.location.origin}${window.location.pathname}#/p/${id}`;
}
