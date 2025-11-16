/**
 * AnniversarySettings Component
 *
 * Manages anniversary CRUD operations in Settings view.
 * Features:
 * - Add/Edit/Delete anniversaries
 * - Form validation using AnniversarySchema
 * - Field-specific error messages
 * - Responsive mobile-first design
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Calendar, Plus, Edit2, Trash2, X, Check } from 'lucide-react';
import type { Anniversary } from '../../types';
import { useAppStore } from '../../stores/useAppStore';
import { isValidationError } from '../../validation/errorMessages';
import { formatDateLong } from '../../utils/dateHelpers';

export function AnniversarySettings() {
  const { settings, addAnniversary, removeAnniversary, updateSettings } = useAppStore();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const anniversaries = settings?.relationship.anniversaries || [];

  const handleAdd = () => {
    setEditingId(null);
    setIsFormOpen(true);
  };

  const handleEdit = (anniversary: Anniversary) => {
    setEditingId(anniversary.id);
    setIsFormOpen(true);
  };

  const handleDelete = (id: number) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (deleteConfirmId !== null) {
      removeAnniversary(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingId(null);
  };

  const editingAnniversary = editingId ? anniversaries.find((a) => a.id === editingId) : undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Anniversary Countdowns
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage special dates and milestones
          </p>
        </div>

        <button
          onClick={handleAdd}
          className="
            flex items-center gap-2
            px-4 py-2
            bg-pink-500 hover:bg-pink-600
            text-white rounded-lg
            transition-colors duration-200
            shadow-md hover:shadow-lg
          "
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Anniversary</span>
        </button>
      </div>

      {/* Anniversary List */}
      <div className="space-y-3">
        {anniversaries.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600 dark:text-gray-400">
              No anniversaries yet. Add your first special date!
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {anniversaries.map((anniversary) => (
              <motion.div
                key={anniversary.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="
                  bg-white dark:bg-gray-800
                  rounded-lg shadow-md
                  p-4
                  border border-gray-200 dark:border-gray-700
                "
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                      {anniversary.label}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {formatDateLong(new Date(anniversary.date))}
                    </p>
                    {anniversary.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                        {anniversary.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(anniversary)}
                      className="
                        p-2 rounded-lg
                        text-purple-600 dark:text-purple-400
                        hover:bg-purple-100 dark:hover:bg-purple-900/30
                        transition-colors duration-200
                      "
                      aria-label="Edit anniversary"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(anniversary.id)}
                      className="
                        p-2 rounded-lg
                        text-red-600 dark:text-red-400
                        hover:bg-red-100 dark:hover:bg-red-900/30
                        transition-colors duration-200
                      "
                      aria-label="Delete anniversary"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Add/Edit Form Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <AnniversaryForm
            anniversary={editingAnniversary}
            onClose={handleFormClose}
            onSave={(data) => {
              if (editingId && settings) {
                // Update existing anniversary
                const updatedAnniversaries = settings.relationship.anniversaries.map((a) =>
                  a.id === editingId ? { ...a, ...data } : a
                );
                updateSettings({
                  relationship: {
                    ...settings.relationship,
                    anniversaries: updatedAnniversaries,
                  },
                });
              } else {
                // Add new anniversary
                addAnniversary(data);
              }
              handleFormClose();
            }}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setDeleteConfirmId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="
                bg-white dark:bg-gray-800
                rounded-xl shadow-2xl
                p-6 max-w-sm w-full
                border border-gray-200 dark:border-gray-700
              "
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Delete Anniversary?
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                This action cannot be undone. The countdown will be removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="
                    flex-1 px-4 py-2
                    bg-gray-200 dark:bg-gray-700
                    text-gray-900 dark:text-gray-100
                    rounded-lg
                    transition-colors duration-200
                    hover:bg-gray-300 dark:hover:bg-gray-600
                  "
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="
                    flex-1 px-4 py-2
                    bg-red-500 hover:bg-red-600
                    text-white rounded-lg
                    transition-colors duration-200
                  "
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface AnniversaryFormProps {
  anniversary?: Anniversary;
  onClose: () => void;
  onSave: (data: Omit<Anniversary, 'id'>) => void;
}

function AnniversaryForm({ anniversary, onClose, onSave }: AnniversaryFormProps) {
  const [label, setLabel] = useState(anniversary?.label || '');
  const [date, setDate] = useState(anniversary?.date || '');
  const [description, setDescription] = useState(anniversary?.description || '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const isEditing = Boolean(anniversary);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);

    try {
      // Basic validation
      const newErrors: Record<string, string> = {};

      if (!label.trim()) {
        newErrors.label = 'Anniversary label cannot be empty';
      }

      if (!date) {
        newErrors.date = 'Date is required';
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        newErrors.date = 'Date must be in YYYY-MM-DD format';
      } else {
        // Validate date values
        const [, month, day] = date.split('-').map(Number);
        if (month < 1 || month > 12) {
          newErrors.date = 'Invalid month (must be 1-12)';
        } else if (day < 1 || day > 31) {
          newErrors.date = 'Invalid day (must be 1-31)';
        } else {
          const dateObj = new Date(date);
          if (!dateObj.toISOString().startsWith(date)) {
            newErrors.date = 'Invalid date values';
          }
        }
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      // Submit form
      onSave({
        label: label.trim(),
        date,
        description: description.trim() || undefined,
      });
    } catch (error) {
      if (isValidationError(error)) {
        const fieldErrors: Record<string, string> = {};
        error.fieldErrors.forEach((message, field) => {
          fieldErrors[field] = message;
        });
        setErrors(fieldErrors);
        setGeneralError(error.message);
      } else {
        setGeneralError('Failed to save anniversary');
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="
          bg-white dark:bg-gray-800
          rounded-xl shadow-2xl
          p-6 max-w-md w-full
          border border-gray-200 dark:border-gray-700
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {isEditing ? 'Edit Anniversary' : 'Add Anniversary'}
          </h3>
          <button
            onClick={onClose}
            className="
              p-2 rounded-lg
              text-gray-600 dark:text-gray-400
              hover:bg-gray-100 dark:hover:bg-gray-700
              transition-colors duration-200
            "
            aria-label="Close form"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* General Error */}
        {generalError && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-400">{generalError}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Label Field */}
          <div>
            <label
              htmlFor="anniversary-label"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Label <span className="text-red-500">*</span>
            </label>
            <input
              id="anniversary-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className={`
                w-full px-3 py-2 rounded-lg
                bg-white dark:bg-gray-900
                border ${errors.label ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
                text-gray-900 dark:text-gray-100
                placeholder-gray-500
                focus:outline-none focus:ring-2
                ${errors.label ? 'focus:ring-red-500' : 'focus:ring-pink-500'}
              `}
              placeholder="e.g., First Date Anniversary"
            />
            {errors.label && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.label}</p>
            )}
          </div>

          {/* Date Field */}
          <div>
            <label
              htmlFor="anniversary-date"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Date <span className="text-red-500">*</span>
            </label>
            <input
              id="anniversary-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`
                w-full px-3 py-2 rounded-lg
                bg-white dark:bg-gray-900
                border ${errors.date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
                text-gray-900 dark:text-gray-100
                focus:outline-none focus:ring-2
                ${errors.date ? 'focus:ring-red-500' : 'focus:ring-pink-500'}
              `}
            />
            {errors.date && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.date}</p>
            )}
          </div>

          {/* Description Field (Optional) */}
          <div>
            <label
              htmlFor="anniversary-description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Description (optional)
            </label>
            <textarea
              id="anniversary-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="
                w-full px-3 py-2 rounded-lg
                bg-white dark:bg-gray-900
                border border-gray-300 dark:border-gray-600
                text-gray-900 dark:text-gray-100
                placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-pink-500
                resize-none
              "
              placeholder="Add a note about this anniversary..."
            />
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="
                flex-1 px-4 py-2
                bg-gray-200 dark:bg-gray-700
                text-gray-900 dark:text-gray-100
                rounded-lg
                transition-colors duration-200
                hover:bg-gray-300 dark:hover:bg-gray-600
                flex items-center justify-center gap-2
              "
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              type="submit"
              className="
                flex-1 px-4 py-2
                bg-pink-500 hover:bg-pink-600
                text-white rounded-lg
                transition-colors duration-200
                flex items-center justify-center gap-2
              "
            >
              <Check className="w-4 h-4" />
              {isEditing ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
