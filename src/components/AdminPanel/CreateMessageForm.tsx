import { m as motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useState } from 'react';
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
        className="fixed inset-0 z-50 bg-black/50"
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
          className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          data-testid="admin-create-form"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 p-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Create New Message</h2>
              <p className="mt-1 text-sm text-gray-500">
                Add a personalized message to your library
              </p>
            </div>
            <button
              onClick={handleCancel}
              className="rounded-lg p-2 transition-colors hover:bg-gray-100"
              aria-label="Close"
              data-testid="admin-create-form-close"
            >
              <X className="h-6 w-6 text-gray-500" />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-6 p-6">
            {/* Message text */}
            <div>
              <label
                htmlFor="message-text"
                className="mb-2 block text-sm font-medium text-gray-700"
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
                className={`w-full resize-none rounded-lg border px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-pink-500 ${
                  textError ? 'border-red-500' : 'border-gray-300'
                }`}
                data-testid="admin-create-form-text"
              />
              <div className="mt-2 flex items-center justify-between">
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
              <label htmlFor="category" className="mb-2 block text-sm font-medium text-gray-700">
                Category *
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as MessageCategory)}
                className={`w-full rounded-lg border px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-pink-500 ${
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
                <p className="mt-2 text-sm text-red-600">{categoryError}</p>
              ) : (
                <p className="mt-2 text-sm text-gray-500">
                  Choose a category that best describes your message
                </p>
              )}
            </div>

            {/* Active toggle (Story 3.5 AC-3.5.4) */}
            <div>
              <label htmlFor="create-active" className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  id="create-active"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 text-pink-500 focus:ring-2 focus:ring-pink-500"
                  data-testid="create-message-active-toggle"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Active in rotation</span>
                  <p className="mt-0.5 text-xs text-gray-500">
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
                className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700"
                data-testid="admin-create-form-error"
              >
                {error}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 p-6">
            <button
              onClick={handleCancel}
              className="rounded-lg border border-gray-300 px-6 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-100"
              data-testid="admin-create-form-cancel"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid}
              className="rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-2.5 font-medium text-white transition-shadow hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
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
