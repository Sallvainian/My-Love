import { AnimatePresence, m as motion } from 'framer-motion';
import { Download, Plus, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AccountDataError } from '../../services/accountDataError';
import { useAppStore } from '../../stores/useAppStore';
import type { CustomMessage } from '../../types';
import { NetworkStatusIndicator } from '../shared';
import { CreateMessageForm } from './CreateMessageForm';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { EditMessageForm } from './EditMessageForm';
import { MessageList } from './MessageList';
import { useDialogSession } from './useDialogSession';

interface AdminPanelProps {
  onExit?: () => void;
}

export function AdminPanel({ onExit }: AdminPanelProps) {
  const userId = useAppStore((s) => s.userId);
  const sessionVersion = useAppStore((s) => s.authSessionVersion);
  // A whole new panel owns each identity's previews and completion callbacks.
  // Unmount outside AnimatePresence so outgoing private dialogs cannot linger.
  return <AccountAdminPanel key={`${userId}:${sessionVersion}`} onExit={onExit} />;
}

function AccountAdminPanel({ onExit }: AdminPanelProps) {
  const captureSession = useDialogSession();
  const customMessagesLoaded = useAppStore((s) => s.customMessagesLoaded);
  const loadCustomMessages = useAppStore((s) => s.loadCustomMessages);
  const exportCustomMessages = useAppStore((s) => s.exportCustomMessages);
  const importCustomMessages = useAppStore((s) => s.importCustomMessages);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<CustomMessage | null>(null);
  const [deletingMessage, setDeletingMessage] = useState<CustomMessage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load custom messages on mount
  useEffect(() => {
    if (!customMessagesLoaded) {
      loadCustomMessages();
    }
  }, [customMessagesLoaded, loadCustomMessages]);

  const handleExit = () => {
    if (onExit) {
      onExit();
    } else {
      // Fallback: navigate back to main app
      window.location.pathname = window.location.pathname.replace('/admin', '');
    }
  };

  // Export messages (Story 3.5 AC-3.5.6)
  const handleExport = async () => {
    const stillCurrent = captureSession();
    try {
      await exportCustomMessages();
    } catch (error) {
      if (!stillCurrent()) return;
      console.error('[AdminPanel] Export failed:', error);
      alert('Failed to export messages. Please try again.');
    }
  };

  // Import messages (Story 3.5 AC-3.5.6)
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const stillCurrent = captureSession();

    try {
      const result = await importCustomMessages(file);
      if (!stillCurrent()) return;
      alert(
        `Import complete!\nImported: ${result.imported} messages\nSkipped duplicates: ${result.skipped}`
      );
    } catch (error) {
      if (!stillCurrent()) return;
      console.error('[AdminPanel] Import failed:', error);
      // Offline, the file is fine: say what actually stopped the import.
      alert(
        error instanceof AccountDataError && error.code === 'offline'
          ? error.message
          : 'Failed to import messages. Please check the file format and try again.'
      );
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-pink-50 via-rose-50 to-purple-50">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 shadow-sm backdrop-blur-md"
      >
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-r from-pink-600 to-rose-600 text-white">
                <span className="text-xl text-white">⚙️</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900" data-testid="admin-title">
                  Admin Panel
                </h1>
                <p className="text-sm text-gray-500">Manage custom messages</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              {/* Export button (Story 3.5 AC-3.5.6) */}
              <button
                onClick={handleExport}
                className="flex items-center gap-2 rounded-lg bg-blue-100 px-3 py-2 font-medium text-blue-700 transition-colors hover:bg-blue-200"
                data-testid="export-messages-button"
                title="Export all custom messages to JSON"
              >
                <Download className="h-4 w-4" />
                <span className="hidden lg:inline">Export</span>
              </button>

              {/* Import button (Story 3.5 AC-3.5.6) */}
              <button
                onClick={handleImportClick}
                className="flex items-center gap-2 rounded-lg bg-green-100 px-3 py-2 font-medium text-green-700 transition-colors hover:bg-green-200"
                data-testid="import-messages-button"
                title="Import custom messages from JSON"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden lg:inline">Import</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
                data-testid="import-file-input"
              />

              {/* Create button */}
              <button
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-linear-to-r from-pink-600 to-rose-600 px-4 py-2 font-medium text-white transition-shadow hover:shadow-lg"
                data-testid="admin-create-button"
              >
                <Plus className="h-5 w-5" />
                <span className="hidden sm:inline">Create Message</span>
              </button>

              {/* Exit button */}
              <button
                onClick={handleExit}
                className="flex items-center gap-2 rounded-lg bg-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-300"
                data-testid="admin-exit-button"
              >
                <X className="h-5 w-5" />
                <span className="hidden sm:inline">Exit Admin</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* App returns this panel before the shell that carries the app-wide
          indicator, so the editor carries its own. */}
      <NetworkStatusIndicator showOnlyWhenOffline />

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <MessageList onEdit={setEditingMessage} onDelete={setDeletingMessage} />
      </div>

      {/* Modals */}
      <AnimatePresence>
        {/* Create message modal */}
        {isCreateOpen && (
          <CreateMessageForm isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
        )}

        {/* Edit message modal */}
        {editingMessage && (
          <EditMessageForm
            key={`${editingMessage.id}-${editingMessage.updatedAt ?? editingMessage.createdAt}`}
            message={editingMessage}
            isOpen={!!editingMessage}
            onClose={() => setEditingMessage(null)}
          />
        )}

        {/* Delete confirmation dialog */}
        {deletingMessage && (
          <DeleteConfirmDialog
            message={deletingMessage}
            isOpen={!!deletingMessage}
            onConfirm={() => {
              // Actual deletion handled in DeleteConfirmDialog
              setDeletingMessage(null);
            }}
            onCancel={() => setDeletingMessage(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
