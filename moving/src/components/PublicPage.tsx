import { useStore, breadcrumbs, pageTitle } from '../store/store';
import Editor from '../editor/Editor';
import DatabaseView from '../database/DatabaseView';
import { PageIcon } from './ui';
import { goPage } from '../lib/router';
import { Copy } from 'lucide-react';

/** Read-only published view of a page (Moving Sites). */
export default function PublicPage({ id }: { id: string }) {
  const s = useStore();
  const page = s.pages[id];
  const root = page ? breadcrumbs(s, id).find((p) => p.published) : null;
  const published = page && (page.published || root) && !page.trashedAt;
  if (!published) {
    return (
      <div className="public-missing">
        <div style={{ fontSize: 48 }}>🔒</div>
        <h2>This page isn’t published</h2>
        <p className="faint">The owner may have unpublished it, or it only exists in another browser (Moving stores data locally).</p>
      </div>
    );
  }
  const pub = (page!.published ?? root!.published)!;
  const fontCls = page!.font === 'serif' ? 'font-serif' : page!.font === 'mono' ? 'font-mono' : '';
  return (
    <div className="public-site">
      <header className="public-head">
        <div className="crumbs">{breadcrumbs(s, id).filter((p) => !root || breadcrumbs(s, p.id).some((x) => x.id === root.id)).map((p) => (
          <a key={p.id} className="crumb" href={`#/p/${p.id}`}><PageIcon page={p} size={16} /> {pageTitle(p)}</a>
        ))}</div>
        <div className="grow" />
        {pub.allowDuplicate !== false && <button className="btn btn-sm btn-outline" onClick={() => { const nid = s.duplicatePage(id); goPage(nid); }}><Copy size={13} /> Duplicate</button>}
        <a className="btn btn-sm" href="#/home">Made with <b>Moving</b></a>
      </header>
      <div className="main-scroll" id="main-scroll">
        <div className={`page ${fontCls} ${page!.fullWidth ? 'full-width' : ''}`}>
          {page!.cover && <div className="cover" style={page!.cover.kind === 'color' ? { background: page!.cover.value } : undefined}>{page!.cover.kind === 'image' && <img src={page!.cover.value} alt="" />}</div>}
          <div className="page-content">
            <div className={`page-header ${page!.cover ? 'has-cover' : ''} ${page!.icon ? 'has-icon' : ''}`}>
              {page!.icon && <div className="page-icon-big"><PageIcon page={page} size={78} /></div>}
              <h1 className="page-title">{pageTitle(page)}</h1>
            </div>
            {page!.isDb ? <DatabaseView dbId={page!.isDb} readOnly /> : <PublicLinks><Editor pageId={id} readOnly={!pub.allowEdit} /></PublicLinks>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Rewrite in-site page links to stay on the public route. */
function PublicLinks({ children }: { children: React.ReactNode }) {
  return <div onClickCapture={(e) => {
    const t = (e.target as HTMLElement).closest('[data-page], .page-link') as HTMLElement | null;
    if (!t) return;
    const pid = t.dataset.page ?? t.closest('[data-block]')?.querySelector('[data-page]')?.getAttribute('data-page');
    if (pid) { e.preventDefault(); e.stopPropagation(); window.location.hash = `#/p/${pid}`; }
  }}>{children}</div>;
}
