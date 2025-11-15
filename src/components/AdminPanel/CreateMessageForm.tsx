import { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import type { MessageCategory } from '../../types';
import { isValidationError } from '../../validation/errorMessages';

interface CreateMessageFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateMessageForm({ isOpen, onClose }: CreateMessageFormProps) {
  const { createCustomMessage } = useAppStore();
  const [text, setText] = useState('');
  const [category, setCategory] = useState<MessageCategory>('custom');
  const [active, setActive] = useState(true); // Story 3.5: Default to active

  // Error state
  const [error, setError] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const maxLength = 500;
  const remainingChars = maxLength - text.length;
  const isValid = text.trim().length > 0 && text.length <= maxLength;

  const handleSave = async () => {
    if (!isValid) return;

    try {
      setError(null);
      setTextError(null);
      setCategoryError(null);

      await createCustomMessage({ text: text.trim(), category, active });
      setText('');
      setCategory('custom');
      setActive(true);
      onClose();
    } catch (err) {
      console.error('[CreateMessageForm] Failed to create message:', err);

      // Handle validation errors with field-specific messages
      if (isValidationError(err)) {
        const fieldErrors = err.fieldErrors;

        // Set field-specific errors
        if (fieldErrors.has('text')) {
          setTextError(fieldErrors.get('text') || null);
        }
        if (fieldErrors.has('category')) {
          setCategoryError(fieldErrors.get('category') || null);
        }

        // Set general error message
        setError(err.message);
      } else {
        setError('Failed to create message. Please try again.');
      }
    }
  };

  const handleCancel = () => {
    setText('');
    setCategory('custom');
    setActive(true);
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
        data-testid="admin-create-form-backdrop"
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
          data-testid="admin-create-form"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Create New Message</h2>
              <p className="text-sm text-gray-500 mt-1">
                Add a personalized message to your library
              </p>
            </div>
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close"
              data-testid="admin-create-form-close"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* Form */}
          <div className="p-6 space-y-6">
            {/* Message text */}
            <div>
              <label
                htmlFor="message-text"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Message Text *
              </label>
              <textarea
                id="message-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter your message here..."
                maxLength={maxLength}
                rows={6}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none ${
                  textError ? 'border-red-500' : 'border-gray-300'
                }`}
                data-testid="admin-create-form-text"
              />
              <div className="flex items-center justify-between mt-2">
                {textError ? (
                  <p className="text-sm text-red-600">{textError}</p>
                ) : (
                  <p className="text-sm text-gray-500">
                    {text.length === 0 ? 'Required' : 'Characters used'}
                  </p>
                )}
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
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as MessageCategory)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${
                  categoryError ? 'border-red-500' : 'border-gray-300'
                }`}
                data-testid="admin-create-form-category"
              >
                <option value="reason">💖 Reasons</option>
                <option value="memory">✨ Memories</option>
                <option value="affirmation">🌟 Affirmations</option>
                <option value="future">🌈 Future Plans</option>
                <option value="custom">💕 Custom</option>
              </select>
              {categoryError ? (
                <p className="text-sm text-red-600 mt-2">{categoryError}</p>
              ) : (
                <p className="text-sm text-gray-500 mt-2">
                  Choose a category that best describes your message
                </p>
              )}
            </div>

            {/* Active toggle (Story 3.5 AC-3.5.4) */}
            <div>
              <label htmlFor="create-active" className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  id="create-active"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-5 h-5 text-pink-500 border-gray-300 rounded focus:ring-2 focus:ring-pink-500"
                  data-testid="create-message-active-toggle"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Active in rotation</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {active
                      ? 'This message can appear in daily rotation'
                      : "Save as draft - won't appear in rotation until activated"}
                  </p>
                </div>
              </label>
            </div>

            {/* General Error Message */}
            {error && (
              <div
                className="px-4 py-3 bg-red-50 border border-red-300 rounded-lg text-red-700"
                data-testid="admin-create-form-error"
              >
                {error}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handleCancel}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              data-testid="admin-create-form-cancel"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid}
              className="px-6 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg hover:shadow-lg transition-shadow font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
              data-testid="admin-create-form-save"
            >
              Save Message
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
