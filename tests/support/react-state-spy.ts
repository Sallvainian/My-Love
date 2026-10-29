/**
 * A `react` module whose `useState` setter reports every call to
 * `stateSetterCalls` before forwarding it to real state. React 19 silently
 * ignores an update to an unmounted component, so nothing on screen can show a
 * late one; a test observes the dispatch itself instead.
 *
 * `vi.mock` factories are hoisted above imports, so a test reaches this module
 * by dynamic `import()` inside the factory and imports `stateSetterCalls`
 * statically; vitest hands both the same module instance:
 *
 *   vi.mock('react', async () =>
 *     (await import('<rel>/tests/support/react-state-spy')).reactWithStateSpy()
 *   );
 *
 * Only types come from `react` statically: a value import here would load
 * the mocked module from inside its own factory.
 */
import type { Dispatch, SetStateAction } from 'react';
import { vi } from 'vitest';

/** Every value or updater passed to a `useState` setter, in call order. */
export const stateSetterCalls = vi.fn<(next: unknown) => void>();

/**
 * The real `react` module with `useState` swapped for the observed one. Typed
 * loosely: `vi.mock` takes any module shape, and React's own `useState`
 * overloads are not worth restating for a test double.
 */
export async function reactWithStateSpy(): Promise<Record<string, unknown>> {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    // Forward to real state and keep the setter's identity across renders.
    useState<T>(initial: T | (() => T)) {
      const [value, setValue] = actual.useState(initial);
      const observedSetter = actual.useCallback<Dispatch<SetStateAction<T>>>(
        (next) => {
          stateSetterCalls(next);
          setValue(next);
        },
        [setValue]
      );
      return [value, observedSetter];
    },
  };
}
