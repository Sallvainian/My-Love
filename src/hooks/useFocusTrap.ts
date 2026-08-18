import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface UseFocusTrapOptions {
  /** Called when Escape is pressed. If omitted, ESC is not handled. */
  onEscape?: () => void;
  /** Auto-focus a specific element on mount. Defaults to first focusable. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Traps keyboard focus within a container element (WCAG 2.4.3).
 * Optionally handles Escape key for dismissal.
 *
 * @param containerRef - Ref to the container element that bounds focus
 * @param enabled - Whether the trap is active (e.g. tied to dialog visibility)
 * @param options - Optional escape handler and initial focus target
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  options?: UseFocusTrapOptions
): void {
  const onEscape = options?.onEscape;
  const initialFocusRef = options?.initialFocusRef;
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    // Captured once per activation rather than per effect run. This effect
    // re-runs whenever a caller passes an unstable onEscape -- most do, since an
    // inline arrow is the normal thing to write -- and by then focus is already
    // inside the trap, so capturing again would aim the restore at an element
    // that unmounts with the dialog.
    if (!restoreRef.current) {
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== document.body && !container.contains(active)) {
        restoreRef.current = active;
      }
    }

    // Auto-focus initial element
    if (initialFocusRef?.current) {
      initialFocusRef.current.focus();
    } else {
      const first = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      first?.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        onEscape();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, enabled, onEscape, initialFocusRef]);

  // Give focus back when the trap goes away. Taking focus without returning it
  // strands a keyboard user on <body> with no position in the page behind the
  // dialog, and three consumers already document the return as an acceptance
  // criterion they did not have: components/MoodHistory/MoodDetailModal.tsx:77,
  // components/MoodHistory/MoodHistoryCalendar.tsx:173 and
  // components/scripture-reading/hooks/useReadingDialogs.ts:28 -- the last of which
  // hand-rolled it, as does components/love-notes/FullScreenImageViewer.tsx:64.
  // Doing it here is what those were working around.
  //
  // Keyed on `enabled` alone so it fires on unmount or deactivation, not on
  // every re-arm. The isConnected guard matters: a dialog whose opener was
  // removed by the very action it confirmed has nothing to restore to, and the
  // caller is left to choose a surviving destination.
  useEffect(() => {
    if (!enabled) return;
    return () => {
      const target = restoreRef.current;
      restoreRef.current = null;
      if (target?.isConnected) {
        target.focus();
      }
    };
  }, [enabled]);
}
