/**
 * OneFieldPage -- the one-field edit page every field row with a chevron opens:
 * one kit card holding one field, Save in the Settings bar.
 *
 * Opens with the saved value in the field, focused; an untouched field follows
 * the saved value if it changes meanwhile. Save is enabled only when
 * the (trimmed) value differs from the saved one and is valid, and while no
 * save is running; Enter in the field does the same. A Save checks the
 * connection first and refuses offline with `offlineRefusal` in the Error box,
 * before `save` is called. A save that succeeds returns one level (`goBack`),
 * unless the page was left meanwhile; one that fails shows its message in the
 * Error box and keeps what was typed. The Error box clears on the next Save or
 * when the page is left. Leaving without Save discards the edit; nothing is
 * written.
 *
 * The page is registered with `reloadsToParent`, so a reload shows the page
 * above it instead of an empty field.
 *
 * @component
 */

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { isOnline } from '../../../api/errorHandlers';
import { CARD } from '../../shared/kitClasses';
import { SettingsBarAction } from './SettingsBarAction';
import { useSettingsPage } from './settingsPageContext';
import { ErrorBox } from '../ErrorBox';

interface FieldProps {
  /** The field's `id`, which its sr-only label points at. */
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** True while a save is running. */
  disabled: boolean;
}

interface OneFieldPageProps {
  /** The field's name; its sr-only label (the page's title is the same word). */
  label: string;
  /** The value now stored; the field starts here, and Save stays off while the value equals it. */
  saved: string;
  /** Whether a value (trimmed) is worth saving. */
  isValid: (value: string) => boolean;
  /** Writes the trimmed value; throws to show its message in the Error box. */
  save: (value: string) => Promise<void>;
  /** The Error box's text when Save is tapped without a connection. */
  offlineRefusal: string;
  renderField: (props: FieldProps) => ReactNode;
  testId?: string;
}

export function OneFieldPage({
  label,
  saved,
  isValid,
  save,
  offlineRefusal,
  renderField,
  testId,
}: OneFieldPageProps) {
  const { goBack } = useSettingsPage();
  const fieldId = useId();
  const [value, setValue] = useState(saved);
  // The saved value the field last followed. When `saved` moves while the page
  // is open (the server's answer replacing the saved copy), an untouched field
  // follows it, so Save cannot write the old value back; an edited one is left.
  const [followed, setFollowed] = useState(saved);
  if (saved !== followed) {
    setFollowed(saved);
    if (value === followed) setValue(saved);
  }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** False once the page is left, so a save that lands late does not navigate. */
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    document.getElementById(fieldId)?.focus({ preventScroll: true });
    return () => {
      mounted.current = false;
    };
  }, [fieldId]);

  const canSave = !saving && value.trim() !== saved && isValid(value.trim());

  const submit = async () => {
    if (!canSave) return;
    setError(null);
    if (!isOnline()) {
      setError(offlineRefusal);
      return;
    }
    setSaving(true);
    try {
      await save(value.trim());
      if (mounted.current) goBack();
    } catch (caught) {
      console.error(`[OneFieldPage] Could not save the ${label.toLowerCase()}:`, caught);
      if (mounted.current) {
        setError(
          caught instanceof Error ? caught.message : `Could not save your ${label.toLowerCase()}.`
        );
      }
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4" data-testid={testId}>
      <SettingsBarAction>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSave}
          className="min-h-11 rounded-full px-2 text-[17px] font-semibold text-accent focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="settings-field-save"
        >
          Save
        </button>
      </SettingsBarAction>
      {error && <ErrorBox message={error} testId="settings-field-error" />}
      <form
        className={CARD}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="sr-only" htmlFor={fieldId}>
          {label}
        </label>
        {renderField({ id: fieldId, value, onChange: setValue, disabled: saving })}
      </form>
    </div>
  );
}
