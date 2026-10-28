import type { Database, Page, PropValue, View } from '../store/types';

/** Props every database layout component receives from DatabaseView. */
export interface ViewProps {
  db: Database;
  view: View;
  /** Rows after the view's filter, search and sorts have been applied. */
  rows: Page[];
  readOnly: boolean;
  /** Open a row page using the view's "open pages in" setting (side peek / center peek / full page). */
  openRow(id: string): void;
  /** Create a row (applies default template + given props). Returns the new page id. Opens it when opts.open. */
  addRow(props?: Record<string, PropValue>, opts?: { open?: boolean; title?: string }): string;
  /** Update this view's settings (immer draft). */
  updateView(fn: (v: View) => void): void;
}
