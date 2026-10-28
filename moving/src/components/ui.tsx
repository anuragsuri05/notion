import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, FileText, Search, X } from 'lucide-react';
import type { Color, Page, User } from '../store/types';
import { cx } from '../lib/util';

// ---------- Popover ----------

export type Anchor = HTMLElement | DOMRect | { x: number; y: number } | null;

function rectOf(a: Anchor): DOMRect {
  if (!a) return new DOMRect(window.innerWidth / 2, window.innerHeight / 3, 0, 0);
  if (a instanceof HTMLElement) return a.getBoundingClientRect();
  if (a instanceof DOMRect) return a;
  return new DOMRect(a.x, a.y, 0, 0);
}

export function Popover({
  anchor, onClose, children, placement = 'bottom-start', width, className, offset = 4, style, closeOnScroll,
}: {
  anchor: Anchor; onClose: () => void; children: React.ReactNode; placement?: 'bottom-start' | 'bottom-end' | 'right-start' | 'top-start' | 'left-start';
  width?: number; className?: string; offset?: number; style?: React.CSSProperties; closeOnScroll?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = () => {
      const r = rectOf(anchor);
      const w = el.offsetWidth, h = el.offsetHeight;
      let left = r.left, top = r.bottom + offset;
      if (placement === 'bottom-end') left = r.right - w;
      if (placement === 'right-start') { left = r.right + offset; top = r.top - 6; }
      if (placement === 'left-start') { left = r.left - w - offset; top = r.top - 6; }
      if (placement === 'top-start') top = r.top - h - offset;
      if (placement === 'right-start' && left + w > window.innerWidth - 8) left = r.left - w - offset;
      if (top + h > window.innerHeight - 8) {
        const above = (placement.startsWith('bottom') ? r.top : r.bottom) - h - offset;
        top = above >= 8 ? above : Math.max(8, window.innerHeight - h - 8);
      }
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      top = Math.max(8, top);
      setPos({ left, top });
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, placement, offset]);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      // clicks inside nested popovers (portals) should not close parents
      const layer = (t as HTMLElement).closest?.('.popover');
      if (layer && layer !== ref.current && Number((layer as HTMLElement).dataset.z) > Number(ref.current?.dataset.z)) return;
      onCloseRef.current();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const layers = document.querySelectorAll('.popover');
        if (layers[layers.length - 1] === ref.current) { e.stopPropagation(); e.preventDefault(); onCloseRef.current(); }
      }
    };
    const scroll = (e: Event) => { if (closeOnScroll && !ref.current?.contains(e.target as Node)) onCloseRef.current(); };
    setTimeout(() => document.addEventListener('mousedown', down), 0);
    document.addEventListener('keydown', key, true);
    window.addEventListener('scroll', scroll, true);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key, true); window.removeEventListener('scroll', scroll, true); };
  }, [closeOnScroll]);

  const z = useMemo(() => ++zCounter, []);
  return createPortal(
    <div
      ref={ref}
      data-z={z}
      className={cx('popover', className)}
      style={{ position: 'fixed', zIndex: 1000 + z, left: pos?.left ?? 0, top: pos?.top ?? 0, width, opacity: pos ? 1 : 0, ...style }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}
let zCounter = 0;

// ---------- Menu ----------

export interface MenuItemDef {
  label?: React.ReactNode;
  icon?: React.ReactNode;
  kbd?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  checked?: boolean;
  disabled?: boolean;
  divider?: boolean;
  header?: string;
  submenu?: MenuItemDef[] | (() => React.ReactNode);
  keywords?: string;
  hint?: string;
  keepOpen?: boolean;
}

export function Menu({
  items, onClose, searchable, placeholder = 'Search…', footer, width = 260, header,
}: { items: MenuItemDef[]; onClose: () => void; searchable?: boolean; placeholder?: string; footer?: React.ReactNode; width?: number; header?: React.ReactNode }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(-1);
  const [sub, setSub] = useState<{ idx: number; el: HTMLElement } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const s = q.toLowerCase();
    return items.filter((it) => !it.divider && !it.header && (String(typeof it.label === 'string' ? it.label : '') + ' ' + (it.keywords ?? '')).toLowerCase().includes(s));
  }, [items, q]);
  const actionable = filtered.map((it, i) => (it.divider || it.header || it.disabled ? -1 : i)).filter((i) => i >= 0);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (sub) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const pos = actionable.indexOf(active);
        const next = e.key === 'ArrowDown' ? actionable[(pos + 1) % actionable.length] : actionable[(pos - 1 + actionable.length) % actionable.length];
        setActive(next ?? -1);
      } else if (e.key === 'Enter' && active >= 0) {
        e.preventDefault();
        const it = filtered[active];
        if (it?.submenu) {
          const el = listRef.current?.querySelector(`[data-idx="${active}"]`) as HTMLElement;
          if (el) setSub({ idx: active, el });
        } else if (it?.onClick) { it.onClick(); if (!it.keepOpen) onClose(); }
      } else if (e.key === 'ArrowRight' && active >= 0 && filtered[active]?.submenu) {
        const el = listRef.current?.querySelector(`[data-idx="${active}"]`) as HTMLElement;
        if (el) setSub({ idx: active, el });
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  });

  return (
    <div className="menu" style={{ width }}>
      {header}
      {searchable && (
        <div className="menu-search">
          <input autoFocus className="input" placeholder={placeholder} value={q} onChange={(e) => { setQ(e.target.value); setActive(-1); }} />
        </div>
      )}
      <div className="menu-list" ref={listRef}>
        {filtered.length === 0 && <div className="menu-empty">No results</div>}
        {filtered.map((it, i) => {
          if (it.divider) return <div key={i} className="sep" />;
          if (it.header) return <div key={i} className="menu-header">{it.header}</div>;
          return (
            <div
              key={i}
              data-idx={i}
              className={cx('menu-item', active === i && 'active', it.danger && 'danger', it.disabled && 'disabled')}
              onMouseEnter={(e) => {
                setActive(i);
                if (it.submenu) setSub({ idx: i, el: e.currentTarget });
                else setSub(null);
              }}
              onClick={(e) => {
                if (it.disabled) return;
                if (it.submenu) { setSub({ idx: i, el: e.currentTarget }); return; }
                it.onClick?.();
                if (!it.keepOpen) onClose();
              }}
              title={it.hint}
            >
              {it.icon !== undefined && <span className="menu-icon">{it.icon}</span>}
              <span className="menu-label">{it.label}</span>
              {it.right}
              {it.kbd && <span className="kbd">{it.kbd}</span>}
              {it.checked && <Check size={14} />}
              {it.submenu && <ChevronRight size={14} className="faint" />}
            </div>
          );
        })}
      </div>
      {footer}
      {sub && filtered[sub.idx]?.submenu && (
        <Popover anchor={sub.el} onClose={() => setSub(null)} placement="right-start">
          {typeof filtered[sub.idx].submenu === 'function'
            ? (filtered[sub.idx].submenu as () => React.ReactNode)()
            : <Menu items={filtered[sub.idx].submenu as MenuItemDef[]} onClose={() => { setSub(null); onClose(); }} />}
        </Popover>
      )}
    </div>
  );
}

export function MenuPopover(props: { anchor: Anchor; onClose: () => void; items: MenuItemDef[]; searchable?: boolean; width?: number; placement?: 'bottom-start' | 'bottom-end' | 'right-start'; header?: React.ReactNode; footer?: React.ReactNode; placeholder?: string }) {
  return (
    <Popover anchor={props.anchor} onClose={props.onClose} placement={props.placement}>
      <Menu items={props.items} onClose={props.onClose} searchable={props.searchable} width={props.width} header={props.header} footer={props.footer} placeholder={props.placeholder} />
    </Popover>
  );
}

// ---------- Modal ----------

export function Modal({ onClose, children, width = 720, className, top = '12vh', height }: { onClose: () => void; children: React.ReactNode; width?: number | string; className?: string; top?: string; height?: number | string }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.popover')) { e.preventDefault(); onClose(); }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);
  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={cx('modal', className)} style={{ width, marginTop: top, height }}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ title, body, confirm = 'Confirm', danger, onConfirm, onClose }: { title: string; body?: React.ReactNode; confirm?: string; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal onClose={onClose} width={380} top="25vh">
      <div className="confirm">
        <div className="confirm-title">{title}</div>
        {body && <div className="muted" style={{ marginTop: 6 }}>{body}</div>}
        <div className="col" style={{ marginTop: 18 }}>
          <button autoFocus className={cx('btn', danger ? 'btn-danger-fill' : 'btn-primary')} style={{ justifyContent: 'center', height: 32 }} onClick={() => { onConfirm(); onClose(); }}>{confirm}</button>
          <button className="btn btn-outline" style={{ justifyContent: 'center', height: 32 }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- Tooltip ----------

export function Tip({ label, kbd, children, side = 'bottom' }: { label: string; kbd?: string; children: React.ReactElement; side?: 'bottom' | 'top' | 'right' }) {
  const [show, setShow] = useState<DOMRect | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const child = React.cloneElement(children, {
    onMouseEnter: (e: React.MouseEvent) => {
      children.props.onMouseEnter?.(e);
      const el = e.currentTarget as HTMLElement;
      timer.current = setTimeout(() => setShow(el.getBoundingClientRect()), 450);
    },
    onMouseLeave: (e: React.MouseEvent) => { children.props.onMouseLeave?.(e); clearTimeout(timer.current); setShow(null); },
    onMouseDown: (e: React.MouseEvent) => { children.props.onMouseDown?.(e); clearTimeout(timer.current); setShow(null); },
  });
  return (
    <>
      {child}
      {show && createPortal(
        <div className="tooltip" style={side === 'right' ? { left: show.right + 6, top: show.top + show.height / 2, transform: 'translateY(-50%)' }
          : side === 'top' ? { left: show.left + show.width / 2, top: show.top - 6, transform: 'translate(-50%, -100%)' }
            : { left: show.left + show.width / 2, top: show.bottom + 6, transform: 'translateX(-50%)' }}>
          <div>{label}</div>
          {kbd && <div className="tooltip-kbd">{kbd}</div>}
        </div>,
        document.body,
      )}
    </>
  );
}

// ---------- Small components ----------

export function Avatar({ user, size = 20 }: { user?: User | null; size?: number }) {
  if (!user) return <span className="avatar" style={{ width: size, height: size, background: 'var(--text-4)' }} />;
  return (
    <span className="avatar" style={{ width: size, height: size, background: user.avatar ? 'transparent' : user.color, fontSize: size * 0.5 }} title={user.name}>
      {user.avatar ? <img src={user.avatar} alt="" /> : user.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function PageIcon({ page, size = 18, fallback = true }: { page?: Pick<Page, 'icon' | 'isDb'> | null; size?: number; fallback?: boolean }) {
  const icon = page?.icon;
  if (icon && (icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('blob:'))) {
    return <img className="page-icon-img" src={icon} alt="" style={{ width: size, height: size }} />;
  }
  if (icon) return <span className="emoji-icon" style={{ fontSize: size * 0.95, width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>;
  if (!fallback) return null;
  return <FileText size={size * 0.9} strokeWidth={1.6} className="faint" style={{ flexShrink: 0 }} />;
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button className={cx('toggle', on && 'on')} onClick={(e) => { e.stopPropagation(); onChange(!on); }} aria-pressed={on} />;
}

export function Checkbox({ checked, onChange, size = 16 }: { checked: boolean; onChange?: (v: boolean) => void; size?: number }) {
  return (
    <span className={cx('checkbox', checked && 'checked')} style={{ width: size, height: size }} onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); onChange?.(!checked); }} role="checkbox" aria-checked={checked}>
      {checked && <Check size={size - 4} strokeWidth={3} />}
    </span>
  );
}

export function Tag({ name, color, onRemove, status, group }: { name: string; color: Color; onRemove?: () => void; status?: boolean; group?: string }) {
  if (status) {
    return (
      <span className={cx('tag', 'status-tag', `tag-${color}`)}>
        <span className={cx('dot', `dot-${color}`)} />
        {name}
        {onRemove && <span className="x" onClick={(e) => { e.stopPropagation(); onRemove(); }}><X size={12} /></span>}
      </span>
    );
  }
  return (
    <span className={cx('tag', `tag-${color}`)} data-group={group}>
      <span className="ellipsis">{name}</span>
      {onRemove && <span className="x" onClick={(e) => { e.stopPropagation(); onRemove(); }}><X size={12} /></span>}
    </span>
  );
}

export function SearchInput({ value, onChange, placeholder, autoFocus, onKeyDown }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; onKeyDown?: (e: React.KeyboardEvent) => void }) {
  return (
    <div className="search-input">
      <Search size={14} className="faint" />
      <input autoFocus={autoFocus} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} />
    </div>
  );
}

export function ColorSwatch({ color, kind }: { color: Color; kind: 'text' | 'bg' }) {
  return (
    <span className={cx('swatch', kind === 'bg' ? (color === 'default' ? '' : `bg-${color}`) : '')} style={{ color: kind === 'text' && color !== 'default' ? `var(--c-${color})` : undefined }}>
      A
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

/** Hook: anchor element for a popover toggled by a button. */
export function useAnchor<T extends HTMLElement = HTMLElement>() {
  const [anchor, setAnchor] = useState<T | null>(null);
  return {
    anchor,
    open: (e: React.MouseEvent<T> | T) => setAnchor('currentTarget' in e ? (e.currentTarget as T) : e),
    close: () => setAnchor(null),
  };
}
