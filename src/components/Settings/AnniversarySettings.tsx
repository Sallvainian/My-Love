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

import { AnimatePresence, m as motion } from 'motion/react';
import { Check, Pen, Heart, Plus, Trash, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type RefObject, type SubmitEvent } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useSubmitKey } from '../../hooks/useSubmitKey';
import { parseEventDate } from '../../services/eventsService';
import { useAppStore } from '../../stores/useAppStore';
import type { Anniversary } from '../../types';
import { formatDateLong } from '../../utils/dateUtils';
import { isValidationError } from '../../validation/errorMessages';
import {
  ADD_BUTTON,
  DELETE_BUTTON,
  DESTRUCTIVE_BUTTON,
  DIALOG_BACKDROP,
  DIALOG_CLOSE,
  DIALOG_PANEL,
  DIALOG_TITLE,
  DIVIDER,
  EDIT_BUTTON,
  FAILURE_BOX,
  FIELD_ERROR,
  FIELD_LABEL,
  GROUP_ROW,
  GROUP_SUBTITLE,
  GROUP_TILE,
  GROUP_TITLE,
  ITEM_LABEL,
  ITEM_META,
  ITEM_ROW,
  PRIMARY_BUTTON,
  REQUIRED_MARK,
  SECONDARY_BUTTON,
  fieldClass,
} from '../shared/kitClasses';

/**
 * `anniversary.date` is a bare "YYYY-MM-DD"; fed to `new Date(...)` that is the
 * ECMA-262 date-only form, parsed as UTC midnight — west of UTC it renders the
 * previous day. parseEventDate rebuilds from local components, matching
 * getNextAnniversaryDate's math on Home.
 */
function formatAnniversaryDate(date: string): string {
  const parsed = parseEventDate(date);
  return parsed ? formatDateLong(parsed) : date;
}

/**
 * Ids for the field-error paragraphs, so each input can point its
 * aria-describedby at its own message. Only one form is ever mounted at a
 * time, so fixed ids cannot collide.
 */
const LABEL_ERROR_ID = 'anniversary-form-label-error';
const DATE_ERROR_ID = 'anniversary-form-date-error';

export function AnniversarySettings() {
  const { settings, addAnniversary, updateAnniversary, removeAnniversary } = useAppStore();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // The header Add button: the one control that outlives a delete, and so
  // where focus goes once the deleted row has taken its own Delete button away.
  const addButtonRef = useRef<HTMLButtonElement>(null);

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

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingId(null);
  };

  const editingAnniversary = editingId ? anniversaries.find((a) => a.id === editingId) : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Group header: h3 under Settings' "Countdowns" h2. An empty list is
          said by the subtitle alone, with no empty block below it. */}
      <div className={GROUP_ROW}>
        <span className={GROUP_TILE} aria-hidden="true">
          <Heart className="h-4.25 w-4.25" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className={GROUP_TITLE}>Anniversaries</h3>
          <p className={GROUP_SUBTITLE} data-testid="anniversaries-subtitle">
            {anniversaries.length === 0 ? 'Special dates · none yet' : 'Special dates'}
          </p>
        </div>

        <button
          ref={addButtonRef}
          type="button"
          onClick={handleAdd}
          aria-label="Add Anniversary"
          className={ADD_BUTTON}
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Anniversary List */}
      {anniversaries.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <AnimatePresence>
            {anniversaries.map((anniversary) => (
              <motion.div
                key={anniversary.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col gap-1.5"
              >
                <div className={DIVIDER} aria-hidden="true" />
                <div className={ITEM_ROW}>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <h4 className={ITEM_LABEL}>{anniversary.label}</h4>
                    <p
                      className={ITEM_META}
                      data-testid={`anniversary-row-date-${anniversary.id}`}
                    >
                      {formatAnniversaryDate(anniversary.date)}
                    </p>
                    {anniversary.description && (
                      <p className={ITEM_META}>{anniversary.description}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(anniversary)}
                      className={EDIT_BUTTON}
                      aria-label={`Edit ${anniversary.label}`}
                    >
                      <Pen className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(anniversary.id)}
                      className={DELETE_BUTTON}
                      aria-label={`Delete ${anniversary.label}`}
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <AnniversaryForm
            anniversary={editingAnniversary}
            onClose={handleFormClose}
            onSave={async (data, clientKey) => {
              // Throws on failure; the form shows the reason and stays open.
              if (editingId) {
                await updateAnniversary(editingId, data);
              } else {
                await addAnniversary(data, clientKey);
              }
              handleFormClose();
            }}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId !== null && (
          <AnniversaryDeleteConfirmation
            onClose={() => setDeleteConfirmId(null)}
            onConfirmDelete={() => removeAnniversary(deleteConfirmId)}
            fallbackFocusRef={addButtonRef}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface AnniversaryDeleteConfirmationProps {
  onClose: () => void;
  /** Throws on failure; the dialog shows the reason and stays open. */
  onConfirmDelete: () => Promise<void>;
  /**
   * Where focus goes after a successful delete, which removes the row and the
   * opener with it — useFocusTrap skips its restore when the opener is gone.
   */
  fallbackFocusRef: RefObject<HTMLElement | null>;
}

function AnniversaryDeleteConfirmation({
  onClose,
  onConfirmDelete,
  fallbackFocusRef,
}: AnniversaryDeleteConfirmationProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const isDeletingRef = useRef(false);
  const deleteSucceededRef = useRef(false);

  const titleId = 'anniversary-delete-title';

  // useFocusTrap lists onEscape in its deps and re-focuses its initial target
  // on every run, so the handler's identity is kept fixed with a latest-ref —
  // the shape EventsSettings' dialogs use.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleEscape = useCallback(() => {
    // Suppressed mid-write so a stray key cannot orphan a delete.
    if (isDeletingRef.current) return;
    onCloseRef.current();
  }, []);

  // Cancel takes initial focus because this action cannot be undone.
  useFocusTrap(panelRef, true, {
    onEscape: handleEscape,
    initialFocusRef: cancelButtonRef,
  });

  // Declared after the trap call so its cleanup runs second, overwriting the
  // hook's restore with a target known to survive the delete.
  useEffect(() => {
    return () => {
      if (!deleteSucceededRef.current) return;
      // eslint-disable-next-line react-hooks/exhaustive-deps -- reads the ref at cleanup on purpose: the fallback must be the node mounted now
      const fallback = fallbackFocusRef.current;
      if (fallback?.isConnected) {
        fallback.focus();
      }
    };
  }, [fallbackFocusRef]);

  useEffect(() => {
    if (deleteError && !isDeleting) {
      cancelButtonRef.current?.focus();
    }
  }, [deleteError, isDeleting]);

  // Server first: the dialog stays open with the reason when the delete fails
  // (offline included), rather than closing as if it had worked.
  const handleDelete = async () => {
    setIsDeleting(true);
    isDeletingRef.current = true;
    setDeleteError(null);
    // The button about to be disabled holds focus; move it onto the panel while
    // that can still land, or the browser parks focus on <body>, outside the
    // element the trap's keydown listener is bound to.
    panelRef.current?.focus();

    try {
      await onConfirmDelete();
      deleteSucceededRef.current = true;
      onClose();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete anniversary');
      setIsDeleting(false);
      isDeletingRef.current = false;
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isDeleting) {
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={DIALOG_BACKDROP}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`${DIALOG_PANEL} max-w-sm`}
        data-testid="anniversary-delete-panel"
      >
        <h3 id={titleId} className={`${DIALOG_TITLE} mb-2`}>Delete Anniversary?</h3>
        <p className="mb-5 text-[15px] text-ink">
          This action cannot be undone. The countdown will be removed.
        </p>
        {deleteError && (
          <p role="alert" className={`${FAILURE_BOX} mb-4`}>
            {deleteError}
          </p>
        )}
        <div className="flex gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className={SECONDARY_BUTTON}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className={DESTRUCTIVE_BUTTON}
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

interface AnniversaryFormProps {
  anniversary?: Anniversary;
  onClose: () => void;
  /** `clientKey` is reused when the same submit is retried (useSubmitKey). */
  onSave: (data: Omit<Anniversary, 'id' | 'serverId'>, clientKey: string) => Promise<void>;
}

function AnniversaryForm({ anniversary, onClose, onSave }: AnniversaryFormProps) {
  const [label, setLabel] = useState(anniversary?.label || '');
  const [date, setDate] = useState(anniversary?.date || '');
  const [description, setDescription] = useState(anniversary?.description || '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { keyFor } = useSubmitKey();

  const panelRef = useRef<HTMLDivElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const isSavingRef = useRef(false);

  const isEditing = Boolean(anniversary);
  const titleId = 'anniversary-form-title';

  // Latest-ref plus an empty-dep useCallback keeps the Escape handler's
  // identity fixed; useFocusTrap re-focuses the label field whenever it changes.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleEscape = useCallback(() => {
    // Suppressed mid-write so a stray key cannot orphan a save.
    if (isSavingRef.current) return;
    onCloseRef.current();
  }, []);

  useFocusTrap(panelRef, true, {
    onEscape: handleEscape,
    initialFocusRef: labelInputRef,
  });

  // Hand focus to the re-enabled Save after a failure. Doing it inside the
  // await would focus a still-disabled button, which the DOM ignores.
  useEffect(() => {
    if (generalError && !isSaving) {
      submitButtonRef.current?.focus();
    }
  }, [generalError, isSaving]);

  /**
   * Drop one field's error the moment the user edits it; otherwise a corrected
   * field keeps its red border, its aria-invalid and its message until the next
   * submit, telling a screen-reader user it is still wrong while they fix it.
   */
  const clearFieldError = useCallback((field: string) => {
    setErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }, []);

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
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

      // Submit form — saved to the account first, so this can fail offline
      setIsSaving(true);
      isSavingRef.current = true;
      // Save, Cancel and Close are all about to be disabled; move focus onto
      // the panel first, or the browser parks it on <body>, outside the trap.
      panelRef.current?.focus();
      const data = {
        label: label.trim(),
        date,
        description: description.trim() || undefined,
      };
      await onSave(data, keyFor(data));
    } catch (error) {
      if (isValidationError(error)) {
        const fieldErrors: Record<string, string> = {};
        error.fieldErrors.forEach((message, field) => {
          fieldErrors[field] = message;
        });
        setErrors(fieldErrors);
        setGeneralError(error.message);
      } else {
        setGeneralError(error instanceof Error ? error.message : 'Failed to save anniversary');
      }
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSaving) {
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={DIALOG_BACKDROP}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`${DIALOG_PANEL} max-w-md`}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 id={titleId} className={DIALOG_TITLE}>
            {isEditing ? 'Edit Anniversary' : 'Add Anniversary'}
          </h3>
          <button
            onClick={onClose}
            disabled={isSaving}
            className={DIALOG_CLOSE}
            aria-label="Close form"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* General Error */}
        {generalError && (
          <div className={`${FAILURE_BOX} mb-4`} role="alert">
            <p>{generalError}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Label Field */}
          <div>
            <label
              htmlFor="anniversary-label"
              className={FIELD_LABEL}
            >
              Label <span className={REQUIRED_MARK}>*</span>
            </label>
            <input
              ref={labelInputRef}
              id="anniversary-label"
              type="text"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                clearFieldError('label');
              }}
              aria-invalid={Boolean(errors.label)}
              // Paired with the id below: aria-invalid alone tells a screen
              // reader the field is wrong without ever saying why.
              aria-describedby={errors.label ? LABEL_ERROR_ID : undefined}
              className={fieldClass(Boolean(errors.label))}
              placeholder="e.g., First Date Anniversary"
            />
            {errors.label && (
              <p id={LABEL_ERROR_ID} className={FIELD_ERROR} role="alert">
                {errors.label}
              </p>
            )}
          </div>

          {/* Date Field */}
          <div>
            <label
              htmlFor="anniversary-date"
              className={FIELD_LABEL}
            >
              Date <span className={REQUIRED_MARK}>*</span>
            </label>
            <input
              id="anniversary-date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                clearFieldError('date');
              }}
              aria-invalid={Boolean(errors.date)}
              aria-describedby={errors.date ? DATE_ERROR_ID : undefined}
              className={fieldClass(Boolean(errors.date))}
            />
            {errors.date && (
              <p id={DATE_ERROR_ID} className={FIELD_ERROR} role="alert">
                {errors.date}
              </p>
            )}
          </div>

          {/* Description Field (Optional) */}
          <div>
            <label
              htmlFor="anniversary-description"
              className={FIELD_LABEL}
            >
              Description (optional)
            </label>
            <textarea
              id="anniversary-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={fieldClass(false, true)}
              placeholder="Add a note about this anniversary..."
            />
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className={SECONDARY_BUTTON}
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button
              ref={submitButtonRef}
              type="submit"
              disabled={isSaving}
              className={PRIMARY_BUTTON}
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
