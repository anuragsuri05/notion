import type { Block } from '../../store/types';
import { useEditor } from '../Editor';
import { useStore, breadcrumbs, pageTitle } from '../../store/store';
import { PageIcon } from '../../components/ui';
import { htmlToText, walkBlocks, cx } from '../../lib/util';
import { goPage } from '../../lib/router';
import { Fragment } from 'react';

export function TocBlock({ block }: { block: Block }) {
  const api = useEditor();
  const content = useStore((s) => s.pages[api.pageId]?.content ?? []);
  const heads: { id: string; level: number; text: string }[] = [];
  walkBlocks(content, (b) => {
    const m = /^(?:toggle_)?h([1-4])$/.exec(b.type);
    if (m) heads.push({ id: b.id, level: +m[1], text: htmlToText(b.html) });
  });
  const min = Math.min(...heads.map((h) => h.level), 4);
  return (
    <div className={cx('toc', block.color && block.color !== 'default' && `c-${block.color}`)} contentEditable={false}>
      {heads.length === 0 && <div className="faint">Add headings to create a table of contents.</div>}
      {heads.map((h) => (
        <div key={h.id} className="toc-item" style={{ paddingLeft: (h.level - min) * 24 }}
          onClick={() => document.getElementById(`block-${h.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          {h.text || <span className="faint">Untitled</span>}
        </div>
      ))}
    </div>
  );
}

export function BreadcrumbBlock() {
  const api = useEditor();
  const crumbs = useStore((s) => breadcrumbs(s, api.pageId));
  return (
    <div className="breadcrumb-block" contentEditable={false}>
      {crumbs.map((p, i) => (
        <Fragment key={p.id}>
          {i > 0 && <span className="faint">/</span>}
          <button className="crumb" onClick={() => goPage(p.id)}><PageIcon page={p} size={16} /> {pageTitle(p)}</button>
        </Fragment>
      ))}
    </div>
  );
}
