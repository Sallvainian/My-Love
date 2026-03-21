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

import { AnimatePresence, m as motion } from 'framer-motion';
import { Calendar, Check, Edit2, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import type { Anniversary } from '../../types';
import { formatDateLong } from '../../utils/dateUtils';
import { isValidationError } from '../../validation/errorMessages';

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
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Manage special dates and milestones
          </p>
        </div>

        <button
          onClick={handleAdd}
          className="flex items-center gap-2 rounded-lg bg-pink-500 px-4 py-2 text-white shadow-md transition-colors duration-200 hover:bg-pink-600 hover:shadow-lg"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Anniversary</span>
        </button>
      </div>

      {/* Anniversary List */}
      <div className="space-y-3">
        {anniversaries.length === 0 ? (
          <div className="rounded-lg bg-gray-50 py-12 text-center dark:bg-gray-800/50">
            <Calendar className="mx-auto mb-3 h-12 w-12 text-gray-400" />
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
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-md dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {anniversary.label}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {formatDateLong(new Date(anniversary.date))}
                    </p>
                    {anniversary.description && (
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
                        {anniversary.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(anniversary)}
                      className="rounded-lg p-2 text-purple-600 transition-colors duration-200 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900/30"
                      aria-label="Edit anniversary"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(anniversary.id)}
                      className="rounded-lg p-2 text-red-600 transition-colors duration-200 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
                      aria-label="Delete anniversary"
                    >
                      <Trash2 className="h-4 w-4" />
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setDeleteConfirmId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
            >
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                Delete Anniversary?
              </h3>
              <p className="mb-6 text-gray-600 dark:text-gray-400">
                This action cannot be undone. The countdown will be removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-gray-900 transition-colors duration-200 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-white transition-colors duration-200 hover:bg-red-600"
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {isEditing ? 'Edit Anniversary' : 'Add Anniversary'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-600 transition-colors duration-200 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            aria-label="Close form"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* General Error */}
        {generalError && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-100 p-3 dark:border-red-700 dark:bg-red-900/30">
            <p className="text-sm text-red-700 dark:text-red-400">{generalError}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Label Field */}
          <div>
            <label
              htmlFor="anniversary-label"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Label <span className="text-red-500">*</span>
            </label>
            <input
              id="anniversary-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className={`w-full rounded-lg border bg-white px-3 py-2 dark:bg-gray-900 ${errors.label ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} text-gray-900 placeholder-gray-500 focus:ring-2 focus:outline-none dark:text-gray-100 ${errors.label ? 'focus:ring-red-500' : 'focus:ring-pink-500'} `}
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
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Date <span className="text-red-500">*</span>
            </label>
            <input
              id="anniversary-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`w-full rounded-lg border bg-white px-3 py-2 dark:bg-gray-900 ${errors.date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} text-gray-900 focus:ring-2 focus:outline-none dark:text-gray-100 ${errors.date ? 'focus:ring-red-500' : 'focus:ring-pink-500'} `}
            />
            {errors.date && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.date}</p>
            )}
          </div>

          {/* Description Field (Optional) */}
          <div>
            <label
              htmlFor="anniversary-description"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Description (optional)
            </label>
            <textarea
              id="anniversary-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-pink-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              placeholder="Add a note about this anniversary..."
            />
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-200 px-4 py-2 text-gray-900 transition-colors duration-200 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button
              type="submit"
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-pink-500 px-4 py-2 text-white transition-colors duration-200 hover:bg-pink-600"
            >
              <Check className="h-4 w-4" />
              {isEditing ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
