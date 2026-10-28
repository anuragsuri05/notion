import { useStore } from '../../store/store';
import SearchModal from './SearchModal';
import SettingsModal from './SettingsModal';
import TemplatesModal from './TemplatesModal';
import { TrashModal, HistoryModal, MoveToModal, ImportModal, ExportModal, ShortcutsModal, CreateWorkspaceModal, TeamspaceModal } from './OtherModals';

export default function Modals() {
  const modal = useStore((s) => s.modal);
  const arg = useStore((s) => s.modalArg);
  const close = useStore((s) => s.closeModal);
  switch (modal) {
    case 'search': return <SearchModal onClose={close} />;
    case 'settings': return <SettingsModal onClose={close} initial={arg} />;
    case 'templates': return <TemplatesModal onClose={close} arg={arg} />;
    case 'trash': return <TrashModal onClose={close} />;
    case 'history': return <HistoryModal onClose={close} pageId={arg} />;
    case 'moveTo': return <MoveToModal onClose={close} arg={arg} />;
    case 'import': return <ImportModal onClose={close} arg={arg} />;
    case 'export': return <ExportModal onClose={close} arg={arg} />;
    case 'shortcuts': return <ShortcutsModal onClose={close} />;
    case 'createWorkspace': return <CreateWorkspaceModal onClose={close} />;
    case 'teamspace': return <TeamspaceModal onClose={close} id={arg} />;
    default: return null;
  }
}
