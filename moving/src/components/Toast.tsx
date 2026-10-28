import { createPortal } from 'react-dom';
import { useStore } from '../store/store';

export default function Toast() {
  const toast = useStore((s) => s.toast);
  if (!toast) return null;
  return createPortal(
    <div className="toast" key={toast.id}>
      <span>{toast.text}</span>
      {toast.action && <button className="toast-action" onClick={() => { toast.action!.run(); useStore.setState((s) => { s.toast = null; }); }}>{toast.action.label}</button>}
    </div>,
    document.body,
  );
}
