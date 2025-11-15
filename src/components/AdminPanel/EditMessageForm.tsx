import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import type { CustomMessage, MessageCategory } from '../../types';

interface EditMessageFormProps {
  message: CustomMessage;
  isOpen: boolean;
  onClose: () => void;
}

export function EditMessageForm({ message, isOpen, onClose }: EditMessageFormProps) {
  const { updateCustomMessage } = useAppStore();
  const [text, setText] = useState(message.text);
  const [category, setCategory] = useState<MessageCategory>(message.category);
  const [active, setActive] = useState(message.active ?? true);

  // Reset form when message changes
  useEffect(() => {
    setText(message.text);
    setCategory(message.category);
    setActive(message.active ?? true);
  }, [message]);

  const maxLength = 500;
  const remainingChars = maxLength - text.length;
  const isValid = text.trim().length > 0 && text.length <= maxLength;
  const hasChanges =
    text.trim() !== message.text || category !== message.category || active !== message.active;

  const handleSave = () => {
    if (isValid && hasChanges) {
      updateCustomMessage({
        id: message.id,
        text: text.trim(),
        category,
        active,
      });
      onClose();
    }
  };

  const handleCancel = () => {
    setText(message.text);
    setCategory(message.category);
    setActive(message.active ?? true);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleCancel}
        className="fixed inset-0 bg-black/50 z-50"
        data-testid="admin-edit-form-backdrop"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', duration: 0.3 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          data-testid="admin-edit-form"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Edit Message</h2>
              <p className="text-sm text-gray-500 mt-1">Update your message details</p>
            </div>
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close"
              data-testid="admin-edit-form-close"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* Form */}
          <div className="p-6 space-y-6">
            {/* Message text */}
            <div>
              <label
                htmlFor="edit-message-text"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Message Text *
              </label>
              <textarea
                id="edit-message-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter your message here..."
                maxLength={maxLength}
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                data-testid="admin-edit-form-text"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-sm text-gray-500">
                  {text.length === 0 ? 'Required' : 'Characters used'}
                </p>
                <p
                  className={`text-sm font-medium ${
                    remainingChars < 50 ? 'text-orange-600' : 'text-gray-600'
                  }`}
                >
                  {remainingChars} remaining
                </p>
              </div>
            </div>

            {/* Category */}
            <div>
              <label
                htmlFor="edit-category"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Category *
              </label>
              <select
                id="edit-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as MessageCategory)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                data-testid="admin-edit-form-category"
              >
                <option value="reason">💖 Reasons</option>
                <option value="memory">✨ Memories</option>
                <option value="affirmation">🌟 Affirmations</option>
                <option value="future">🌈 Future Plans</option>
                <option value="custom">💕 Custom</option>
              </select>
            </div>

            {/* Active toggle (Story 3.5 AC-3.5.4) */}
            <div>
              <label htmlFor="edit-active" className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  id="edit-active"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-5 h-5 text-pink-500 border-gray-300 rounded focus:ring-2 focus:ring-pink-500"
                  data-testid="edit-message-active-toggle"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Active in rotation</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {active
                      ? 'This message can appear in daily rotation'
                      : "This message is a draft and won't appear in rotation"}
                  </p>
                </div>
              </label>
            </div>

            {/* Message metadata */}
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Message ID:</span>
                <span className="font-medium text-gray-900">{message.id}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Created:</span>
                <span className="font-medium text-gray-900">
                  {new Date(message.createdAt).toLocaleString()}
                </span>
              </div>
              {message.updatedAt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Last updated:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(message.updatedAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handleCancel}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              data-testid="admin-edit-form-cancel"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid || !hasChanges}
              className="px-6 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg hover:shadow-lg transition-shadow font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
              data-testid="admin-edit-form-save"
            >
              {hasChanges ? 'Save Changes' : 'No Changes'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
