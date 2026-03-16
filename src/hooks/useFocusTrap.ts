import { useEffect, type RefObject } from 'react';

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

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

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
}
