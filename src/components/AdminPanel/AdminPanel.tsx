import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../stores/useAppStore';
import { X, Plus, Download, Upload } from 'lucide-react';
import { MessageList } from './MessageList';
import { CreateMessageForm } from './CreateMessageForm';
import { EditMessageForm } from './EditMessageForm';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import type { CustomMessage } from '../../types';

interface AdminPanelProps {
  onExit?: () => void;
}

export function AdminPanel({ onExit }: AdminPanelProps) {
  const { loadCustomMessages, customMessagesLoaded, exportCustomMessages, importCustomMessages } =
    useAppStore();
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
    try {
      await exportCustomMessages();
    } catch (error) {
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

    try {
      const result = await importCustomMessages(file);
      alert(
        `Import complete!\nImported: ${result.imported} messages\nSkipped duplicates: ${result.skipped}`
      );
    } catch (error) {
      console.error('[AdminPanel] Import failed:', error);
      alert('Failed to import messages. Please check the file format and try again.');
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-purple-50">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-rose-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-xl">⚙️</span>
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
                className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium"
                data-testid="export-messages-button"
                title="Export all custom messages to JSON"
              >
                <Download className="w-4 h-4" />
                <span className="hidden lg:inline">Export</span>
              </button>

              {/* Import button (Story 3.5 AC-3.5.6) */}
              <button
                onClick={handleImportClick}
                className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-medium"
                data-testid="import-messages-button"
                title="Import custom messages from JSON"
              >
                <Upload className="w-4 h-4" />
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
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg hover:shadow-lg transition-shadow font-medium"
                data-testid="admin-create-button"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Create Message</span>
              </button>

              {/* Exit button */}
              <button
                onClick={handleExit}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                data-testid="admin-exit-button"
              >
                <X className="w-5 h-5" />
                <span className="hidden sm:inline">Exit Admin</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
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

export default AdminPanel;
