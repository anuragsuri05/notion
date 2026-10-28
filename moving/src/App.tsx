import { useEffect } from 'react';
import { useStore, breadcrumbs } from './store/store';
import { useRoute, navigate, goPage, pageUrl } from './lib/router';
import { mod } from './lib/util';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import PageView from './components/PageView';
import Home from './components/Home';
import Inbox from './components/Inbox';
import Meetings from './components/Meetings';
import AIChatPage from './components/ai/AIChatPage';
import PublicPage from './components/PublicPage';
import Peek from './components/Peek';
import Modals from './components/modals/Modals';
import RightPanel from './components/RightPanel';
import Toast from './components/Toast';

export default function App() {
  const route = useRoute();
  const theme = useStore((s) => s.settings.theme);
  const highContrast = useStore((s) => s.settings.highContrast);
  const wsId = useStore((s) => s.wsId);
  const lastPage = useStore((s) => s.lastPage[s.wsId]);
  const openOnStart = useStore((s) => s.settings.openOnStart);
  const panel = useStore((s) => s.panel);

  // theme
  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.documentElement.dataset.contrast = highContrast ? 'high' : '';
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme, highContrast]);

  // root redirect
  useEffect(() => {
    if (route.name !== 'root') return;
    const s = useStore.getState();
    const p = lastPage && s.pages[lastPage] && !s.pages[lastPage].trashedAt ? lastPage : null;
    if (openOnStart === 'home' || !p) navigate('/home', true);
    else navigate(`/page/${p}`, true);
  }, [route.name, wsId, lastPage, openOnStart]);

  // page in another workspace → switch
  useEffect(() => {
    if (route.name !== 'page') return;
    const s = useStore.getState();
    const p = s.pages[route.id];
    if (p && p.wsId !== s.wsId) s.switchWorkspace(p.wsId);
    if (p) s.visit(route.id);
  }, [route]);

  // reminders ticker
  useEffect(() => {
    const t = setInterval(() => useStore.getState().fireReminders(), 20000);
    useStore.getState().fireReminders();
    return () => clearInterval(t);
  }, []);

  // global shortcuts
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const s = useStore.getState();
      const k = e.key.toLowerCase();
      const editing = (e.target as HTMLElement)?.closest?.('[contenteditable="true"], input, textarea');
      if (mod(e) && !e.shiftKey && (k === 'k' || k === 'p') && !editing) { e.preventDefault(); s.openModal('search'); return; }
      if (mod(e) && !e.shiftKey && k === 'p') { e.preventDefault(); s.openModal('search'); return; }
      if (mod(e) && k === '\\') { e.preventDefault(); s.updateSettings({ sidebarOpen: !s.settings.sidebarOpen }); return; }
      if (mod(e) && e.shiftKey && k === 'l') {
        e.preventDefault();
        const isDark = document.documentElement.dataset.theme === 'dark';
        s.updateSettings({ theme: isDark ? 'light' : 'dark' });
        return;
      }
      if (mod(e) && !e.shiftKey && k === 'n' && !e.altKey) {
        e.preventDefault();
        goPage(s.createPage({}));
        return;
      }
      if (mod(e) && k === 'j' && !e.shiftKey) { e.preventDefault(); s.setPanel('ai'); return; }
      if (mod(e) && k === '[') { e.preventDefault(); history.back(); return; }
      if (mod(e) && k === ']') { e.preventDefault(); history.forward(); return; }
      const r = window.location.hash.match(/#\/page\/([^#/]+)/);
      if (mod(e) && e.shiftKey && k === 'u' && r) {
        e.preventDefault();
        const crumbs = breadcrumbs(s, r[1]);
        if (crumbs.length > 1) goPage(crumbs[crumbs.length - 2].id); else navigate('/home');
        return;
      }
      if (mod(e) && k === 'l' && !e.shiftKey && r && !editing) {
        e.preventDefault();
        navigator.clipboard.writeText(pageUrl(r[1]));
        s.showToast('Copied link to clipboard');
        return;
      }
      if (e.key === '?' && !editing && !s.modal) { e.preventDefault(); s.openModal('shortcuts'); return; }
      if (mod(e) && e.key === '/' && !editing && !s.modal) { e.preventDefault(); s.openModal('shortcuts'); }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);

  if (route.name === 'public') {
    return <><PublicPage id={route.id} /><Modals /><Toast /></>;
  }

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Topbar route={route} />
        <div className="main-body">
          <div className="main-scroll" id="main-scroll">
            {route.name === 'page' && <PageView key={route.id} pageId={route.id} blockAnchor={route.block} />}
            {route.name === 'home' && <Home />}
            {route.name === 'inbox' && <Inbox />}
            {route.name === 'meetings' && <Meetings />}
            {route.name === 'ai' && <AIChatPage chatId={route.chat} />}
          </div>
          {panel && <RightPanel route={route} />}
        </div>
      </main>
      <Peek />
      <Modals />
      <Toast />
    </div>
  );
}
