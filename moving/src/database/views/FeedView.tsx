import React from 'react';
import { Plus } from 'lucide-react';
import type { Block, Page } from '../../store/types';
import { useStore } from '../../store/store';
import type { ViewProps } from '../viewTypes';
import { Avatar, PageIcon } from '../../components/ui';
import { PropValueView } from '../PropValue';
import { cx, htmlToText, timeAgo } from '../../lib/util';
import { isEmptyValue, visibleProps } from './RowCard';

const MAX_BLOCKS = 12;

function flatten(list: Block[], out: Block[] = []): Block[] {
  for (const b of list ?? []) {
    out.push(b);
    if (b.type === 'columns' || b.type === 'column' || b.type === 'synced') flatten(b.children ?? [], out);
    else if (b.children?.length && (b.open !== false || !b.type.startsWith('toggle'))) flatten(b.children, out);
  }
  return out;
}

function BlockPreview({ b, n }: { b: Block; n: number }) {
  const html = { __html: b.html || '' };
  switch (b.type) {
    case 'h1': case 'h2': case 'h3': case 'h4': case 'toggle_h1': case 'toggle_h2': case 'toggle_h3':
      return <h3 className="feed-h" dangerouslySetInnerHTML={html} />;
    case 'bullet': return <div className="feed-li"><span className="feed-bullet">•</span><span dangerouslySetInnerHTML={html} /></div>;
    case 'numbered': return <div className="feed-li"><span className="feed-bullet">{n}.</span><span dangerouslySetInnerHTML={html} /></div>;
    case 'todo': return <div className={cx('feed-li', b.checked && 'feed-done')}><span className="feed-bullet">{b.checked ? '☑' : '☐'}</span><span dangerouslySetInnerHTML={html} /></div>;
    case 'toggle': return <div className="feed-li"><span className="feed-bullet">▸</span><span dangerouslySetInnerHTML={html} /></div>;
    case 'quote': return <blockquote className="feed-quote" dangerouslySetInnerHTML={html} />;
    case 'callout': return <div className="feed-callout"><span>{b.icon ?? '💡'}</span><span dangerouslySetInnerHTML={html} /></div>;
    case 'code': return <pre className="feed-code">{htmlToText(b.html)}</pre>;
    case 'divider': return <hr className="feed-hr" />;
    case 'image': return b.url ? <img className="feed-img" src={b.url} alt={b.caption ?? ''} /> : null;
    case 'text': return b.html ? <p className="feed-p" dangerouslySetInnerHTML={html} /> : null;
    case 'columns': case 'column': case 'synced': return null;
    default: return null;
  }
}

function Post({ page, props, openRow }: { page: Page; props: ReturnType<typeof visibleProps>; openRow: (id: string) => void }) {
  const users = useStore((s) => s.users);
  const st = useStore.getState();
  const blocks = flatten(page.content);
  const shown = blocks.slice(0, MAX_BLOCKS);
  const more = blocks.length > MAX_BLOCKS;
  const author = users[page.createdBy];
  let num = 0;
  const shownProps = props.filter((p) => !isEmptyValue(st, page, p));
  return (
    <article className="feed-post">
      <div className="feed-meta">
        <Avatar user={author} size={20} />
        <span className="feed-author">{author?.name ?? 'Unknown'}</span>
        <span className="faint">· {timeAgo(page.createdAt)}</span>
      </div>
      <div className="feed-title" onClick={() => openRow(page.id)}>
        {page.icon && <PageIcon page={page} size={26} />}
        <span className={cx(!page.title && 'faint')}>{page.title || 'Untitled'}</span>
      </div>
      {shownProps.length > 0 && (
        <div className="feed-props">
          {shownProps.map((p) => (
            <span key={p.id} className="feed-prop" title={p.name}><span className="feed-prop-name">{p.name}</span><PropValueView page={page} prop={p} compact /></span>
          ))}
        </div>
      )}
      {shown.length > 0 && (
        <div className="feed-content">
          {shown.map((b) => {
            num = b.type === 'numbered' ? num + 1 : 0;
            return <React.Fragment key={b.id}><BlockPreview b={b} n={num} /></React.Fragment>;
          })}
        </div>
      )}
      {more && <button className="feed-more" onClick={() => openRow(page.id)}>Read more</button>}
    </article>
  );
}

export default function FeedView({ db, view, rows, readOnly, openRow, addRow }: ViewProps) {
  useStore((s) => s.pages);
  const props = visibleProps(db, view);
  return (
    <div className="feed-view">
      {!readOnly && (
        <button className="feed-new" onClick={() => addRow({}, { open: true })}><Plus size={16} /> New post</button>
      )}
      {rows.map((r) => <Post key={r.id} page={r} props={props} openRow={openRow} />)}
      {rows.length === 0 && <div className="view-empty faint">No posts yet</div>}
    </div>
  );
}
