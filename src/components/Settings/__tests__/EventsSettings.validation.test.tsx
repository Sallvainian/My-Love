/**
 * EventsSettings — behaviour: form validation
 *
 * These pin the validation rows of the story's I/O matrix — what the section
 * does, not how it is styled. The fixtures, the store double's wiring and the
 * form helpers live in eventsSettingsKit.tsx.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HTMLAttributes, ReactNode, Ref } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serializeAccountDataWrite } from '../../../services/accountDataQueue';
import {
  createEventsStoreKit,
  dateFromISO,
  fillForm,
  makeEvent,
  openAddForm,
  regionDescriptions,
  regionLabels,
  renderSection,
  submitForm,
  type CoupleEvent,
} from './eventsSettingsKit';

type DivProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
};

vi.mock('motion/react', () => ({
  m: {
    div: ({ children, initial: _i, animate: _a, exit: _e, ...props }: DivProps) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

/** A subscribable store double: `patch` notifies exactly as `set()` would. */
const store = vi.hoisted(() => {
  let state: Record<string, unknown> = {};
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  return {
    get state() {
      return state;
    },
    replace(next: Record<string, unknown>) {
      state = next;
      notify();
    },
    patch(changes: Record<string, unknown>) {
      state = { ...state, ...changes };
      notify();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return state;
    },
  };
});

vi.mock('../../../stores/useAppStore', async () => {
  const { useSyncExternalStore } = await import('react');
  const useAppStore = () => useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { useAppStore: Object.assign(useAppStore, { getState: () => store.state }) };
});

const { setStore, currentEvents } = createEventsStoreKit(store);

beforeEach(() => {
  vi.clearAllMocks();
  setStore();
});

// Sign-out (`reauthenticate`) deletes the outgoing account's mirror rows through
// the account-data queue, fire-and-forget; drain it so its log lines land inside
// the test rather than after the worker closes.
afterEach(async () => {
  await serializeAccountDataWrite(async () => {});
});

describe('EventsSettings validation', () => {
  it('rejects a blank label without issuing a request', async () => {
    const user = userEvent.setup();
    await renderSection();
    await openAddForm(user);

    await fillForm(user, { label: '   ', date: '2026-09-12' });
    await submitForm(user);

    expect(screen.getByTestId('events-form-label-error')).toHaveTextContent('Label is required');
    expect(store.state.addEvent).not.toHaveBeenCalled();
    expect(screen.getByTestId('events-form')).toBeInTheDocument();
  });

  it.each(['', '  '])('accepts a 100-character label with %j padding', async (padding) => {
    const user = userEvent.setup();
    const label = 'x'.repeat(100);
    const description = 'At the label limit';
    await renderSection();
    await openAddForm(user);

    await fillForm(user, { label: `${padding}${label}${padding}`, date: '2026-09-12', description });
    await submitForm(user);

    expect(screen.queryByTestId('events-form-label-error')).not.toBeInTheDocument();
    await waitFor(() => expect(store.state.addEvent).toHaveBeenCalledTimes(1));
    expect(store.state.addEvent).toHaveBeenCalledWith({
      label,
      eventDate: '2026-09-12',
      description,
      icon: 'calendar',
    });
    expect(currentEvents()).toMatchObject([
      { label, date: dateFromISO('2026-09-12'), description, icon: 'calendar' },
    ]);
    await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
    expect(screen.getByTestId('event-label-created-1').textContent).toBe(label);
    expect(screen.getByTestId('event-description-created-1').textContent).toBe(description);
  });

  it.each(['', '  '])('accepts a 500-character description with %j padding', async (padding) => {
    const user = userEvent.setup();
    const label = 'At the description limit';
    const description = 'y'.repeat(500);
    await renderSection();
    await openAddForm(user);

    await fillForm(user, { label, date: '2026-09-12', description: `${padding}${description}${padding}` });
    await submitForm(user);

    expect(screen.queryByTestId('events-form-description-error')).not.toBeInTheDocument();
    await waitFor(() => expect(store.state.addEvent).toHaveBeenCalledTimes(1));
    expect(store.state.addEvent).toHaveBeenCalledWith({
      label,
      eventDate: '2026-09-12',
      description,
      icon: 'calendar',
    });
    expect(currentEvents()).toMatchObject([
      { label, date: dateFromISO('2026-09-12'), description, icon: 'calendar' },
    ]);
    await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
    expect(screen.getByTestId('event-label-created-1').textContent).toBe(label);
    expect(screen.getByTestId('event-description-created-1').textContent).toBe(description);
  });

  it('rejects a 101-character label, naming the 100-character limit', async () => {
    const user = userEvent.setup();
    await renderSection();
    await openAddForm(user);

    await fillForm(user, { label: 'x'.repeat(101), date: '2026-09-12' });
    await submitForm(user);

    expect(screen.getByTestId('events-form-label-error')).toHaveTextContent(
      'Label must be 100 characters or fewer'
    );
    expect(store.state.addEvent).not.toHaveBeenCalled();
    expect(currentEvents()).toEqual([]);
    expect(screen.getByTestId('events-form')).toBeInTheDocument();
  });

  it('rejects a 501-character description, naming the 500-character limit', async () => {
    const user = userEvent.setup();
    await renderSection();
    await openAddForm(user);

    await fillForm(user, { label: 'Fine', date: '2026-09-12', description: 'y'.repeat(501) });
    await submitForm(user);

    expect(screen.getByTestId('events-form-description-error')).toHaveTextContent(
      'Description must be 500 characters or fewer'
    );
    expect(store.state.addEvent).not.toHaveBeenCalled();
    expect(currentEvents()).toEqual([]);
    expect(screen.getByTestId('events-form')).toBeInTheDocument();
  });

  it('rejects a missing date without issuing a request', async () => {
    const user = userEvent.setup();
    await renderSection();
    await openAddForm(user);

    await fillForm(user, { label: 'Fine' });
    await submitForm(user);

    expect(screen.getByTestId('events-form-date-error')).toHaveTextContent('Date is required');
    expect(store.state.addEvent).not.toHaveBeenCalled();
  });

  it('announces each field error and points the input at it', async () => {
    const user = userEvent.setup();
    // aria-invalid on its own tells a screen-reader user the field is wrong and
    // never says why, and an error that is only rendered — not announced —
    // reaches nobody who submitted with the keyboard.
    await renderSection();
    await openAddForm(user);

    await submitForm(user);

    const labelError = screen.getByTestId('events-form-label-error');
    const dateError = screen.getByTestId('events-form-date-error');
    expect(labelError).toHaveAttribute('role', 'alert');
    expect(dateError).toHaveAttribute('role', 'alert');

    const labelInput = screen.getByTestId('events-form-label');
    expect(labelInput).toHaveAttribute('aria-invalid', 'true');
    expect(labelInput).toHaveAttribute('aria-describedby', labelError.id);
    expect(labelError.id).not.toBe('');

    const dateInput = screen.getByTestId('events-form-date');
    expect(dateInput).toHaveAttribute('aria-describedby', dateError.id);
  });

  it('clears a field error as soon as that field is edited', async () => {
    const user = userEvent.setup();
    // setErrors used to run only on submit, so a corrected label kept its red
    // border, its aria-invalid and its message until the user resubmitted.
    await renderSection();
    await openAddForm(user);

    await submitForm(user);
    expect(screen.getByTestId('events-form-label-error')).toBeInTheDocument();
    expect(screen.getByTestId('events-form-date-error')).toBeInTheDocument();

    await fillForm(user, { label: 'Now fine' });

    expect(screen.queryByTestId('events-form-label-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('events-form-label')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByTestId('events-form-label')).not.toHaveAttribute('aria-describedby');
    // Only that field's error goes; the untouched one stays.
    expect(screen.getByTestId('events-form-date-error')).toBeInTheDocument();
  });
});

describe.each([
  {
    mode: 'Add',
    initialEvents: (): CoupleEvent[] => [],
    opener: 'events-settings-add',
    writeAction: 'addEvent',
    otherAction: 'editEvent',
    leadingArgs: [] as string[],
    savedId: 'created-1',
    labelsAfterRefusal: [] as string[],
    descriptionsAfterRefusal: [] as string[],
  },
  {
    mode: 'Edit',
    initialEvents: (): CoupleEvent[] => [
      makeEvent({ id: 'mine', label: 'Original event', description: 'Original description' }),
    ],
    opener: 'event-edit-mine',
    writeAction: 'editEvent',
    otherAction: 'addEvent',
    leadingArgs: ['mine'],
    savedId: 'mine',
    labelsAfterRefusal: ['Original event'],
    descriptionsAfterRefusal: ['Original description'],
  },
] as const)(
  'EventsSettings $mode Unicode validation',
  ({
    initialEvents,
    opener,
    writeAction,
    otherAction,
    leadingArgs,
    savedId,
    labelsAfterRefusal,
    descriptionsAfterRefusal,
  }) => {
    it.each([
      { name: '100 emoji label', label: '💖'.repeat(100), description: 'At the label limit' },
      {
        name: '500 emoji description',
        label: 'At the description limit',
        description: '💖'.repeat(500),
      },
      {
        name: '100 decomposed label code points',
        label: 'e\u0301'.repeat(50),
        description: 'At the label limit',
      },
      {
        name: '500 decomposed description code points',
        label: 'At the description limit',
        description: 'e\u0301'.repeat(250),
      },
    ])('saves a whitespace-padded $name without normalization', async ({ label, description }) => {
      const user = userEvent.setup();
      setStore({ events: initialEvents() });
      await renderSection();
      await user.click(screen.getByTestId(opener));

      await fillForm(user, { label: `  ${label}  `, date: '2026-10-01', description: `  ${description}  ` });
      await user.click(screen.getByTestId('events-form-icon-plane'));
      expect(screen.getByTestId('events-form-label')).toHaveValue(`  ${label}  `);
      expect(screen.getByTestId('events-form-description')).toHaveValue(`  ${description}  `);
      expect(screen.getByTestId('events-form-label')).not.toHaveAttribute('maxlength');
      expect(screen.getByTestId('events-form-description')).not.toHaveAttribute('maxlength');
      await submitForm(user);

      expect(screen.queryByTestId('events-form-label-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('events-form-description-error')).not.toBeInTheDocument();
      const payload = { label, eventDate: '2026-10-01', description, icon: 'plane' };
      await waitFor(() => expect(store.state[writeAction]).toHaveBeenCalledTimes(1));
      expect(store.state[writeAction]).toHaveBeenCalledWith(...leadingArgs, payload);
      expect(store.state[otherAction]).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(currentEvents()).toMatchObject([
          { id: savedId, label, date: dateFromISO('2026-10-01'), description, icon: 'plane' },
        ])
      );
      await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());
      expect(screen.getByTestId(`event-label-${savedId}`).textContent).toBe(label);
      expect(screen.getByTestId(`event-description-${savedId}`).textContent).toBe(description);
    });

    it.each([
      {
        name: '101 emoji label',
        field: 'label',
        label: '💖'.repeat(101),
        description: 'Valid description',
        error: 'Label must be 100 characters or fewer',
      },
      {
        name: '501 emoji description',
        field: 'description',
        label: 'Valid label',
        description: '💖'.repeat(501),
        error: 'Description must be 500 characters or fewer',
      },
      {
        name: '101 decomposed label code points',
        field: 'label',
        label: 'e\u0301'.repeat(50) + '\u0301',
        description: 'Valid description',
        error: 'Label must be 100 characters or fewer',
      },
      {
        name: '501 decomposed description code points',
        field: 'description',
        label: 'Valid label',
        description: 'e\u0301'.repeat(250) + '\u0301',
        error: 'Description must be 500 characters or fewer',
      },
    ])('rejects a $name without either write or changing events', async (fixture) => {
      const user = userEvent.setup();
      const { field, label, description, error } = fixture;
      setStore({ events: initialEvents() });
      await renderSection();
      await user.click(screen.getByTestId(opener));

      await fillForm(user, { label, date: '2026-10-01', description });
      const eventsBeforeSubmission = structuredClone(currentEvents());
      await submitForm(user);

      expect(screen.getByTestId(`events-form-${field}-error`)).toHaveTextContent(error);
      expect(screen.getAllByRole('alert')).toHaveLength(1);
      expect(store.state.addEvent).not.toHaveBeenCalled();
      expect(store.state.editEvent).not.toHaveBeenCalled();
      expect(currentEvents()).toEqual(eventsBeforeSubmission);
      expect(screen.getByTestId('events-form')).toBeInTheDocument();
      expect(screen.getByTestId('events-form-label')).toHaveValue(label);
      expect(screen.getByTestId('events-form-description')).toHaveValue(description);
      expect(regionLabels()).toEqual(labelsAfterRefusal);
      expect(regionDescriptions()).toEqual(descriptionsAfterRefusal);
    });
  }
);
