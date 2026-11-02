/**
 * CountdownMarks — the "Reminders" group (stories 4.2 and 4.3): rendered only
 * in the native shell with the local-notifications plugin, the "Date
 * reminders" switch first, then one switch for each set date (off until
 * marked), a write per toggle through the store, and the offline refusal. The
 * marks and push-preferences services and the Capacitor plugins are mocked; the
 * store is the real one.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const capacitor = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => true),
  isPluginAvailable: vi.fn((_name: string) => true),
}));
const service = vi.hoisted(() => ({
  fetchCountdownMarks: vi.fn(),
  setCountdownMark: vi.fn(),
}));
const preferences = vi.hoisted(() => ({
  fetchPushPreferences: vi.fn(),
  savePushPreference: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: capacitor,
  registerPlugin: () => ({}),
}));
// Sign-out (beforeEach's clearAuth) cancels the date reminders through this plugin.
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    getPending: vi.fn(() => Promise.resolve({ notifications: [] })),
    cancel: vi.fn(() => Promise.resolve()),
  },
}));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: {} }));
vi.mock('../../../api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn(), rpc: vi.fn() },
  getPartnerId: vi.fn(),
  lookupPartnerId: vi.fn(),
  isSeedFallbackName: () => false,
}));
vi.mock('../../../services/countdownMarksService', () => ({
  countdownMarksService: service,
}));
vi.mock('../../../services/pushPreferencesService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/pushPreferencesService')>()),
  pushPreferencesService: preferences,
}));

import { AccountDataError } from '../../../services/accountDataError';
import { ALL_PUSH_PREFERENCES_ON } from '../../../services/pushPreferencesService';
import { useAppStore } from '../../../stores/useAppStore';
import { setOnline } from '../../../../tests/unit/stores/accountDataFixtures';
import { CountdownMarks } from '../CountdownMarks';

const HELPER = 'Remind me a month and a week before.';

/** Local midnight `days` from today: the marks list leaves out events dated today or earlier. */
function daysFromToday(days: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
}

function event(id: string, label: string, date: Date) {
  return {
    id,
    userId: 'user-a',
    label,
    date,
    createdAt: new Date(2026, 9, 1),
    description: null,
    icon: 'calendar' as const,
  };
}

/** Every kind of date set, in the order the list shows them. */
function seedAllDates(): void {
  const settings = useAppStore.getState().settings!;
  useAppStore.setState({
    events: [event('e1', 'Trip', daysFromToday(40)), event('e2', 'Move', daysFromToday(65))],
    settings: {
      ...settings,
      relationship: {
        ...settings.relationship,
        anniversaries: [
          { id: 1, date: '2021-11-06', label: 'Dinner', serverId: 'a1' },
          { id: 2, date: '2021-11-07', label: 'Not saved yet' },
        ],
      },
    },
    coupleSettings: {
      status: 'linked',
      partnerId: 'partner-id',
      relationshipStart: new Date(2020, 10, 6, 22, 30).toISOString(),
      weddingDate: '2026-12-20',
    },
    ownProfile: { displayName: 'Casey', birthday: '1996-12-24' },
    partner: {
      id: 'partner-id',
      email: 'jessie@test.example.com',
      displayName: 'Jessie',
      connectedAt: null,
      birthday: '1995-12-26',
    },
  });
}

const KEYS = [
  'event:e1',
  'event:e2',
  'anniversary:a1',
  'relationship-start',
  'wedding',
  'own-birthday',
  'partner-birthday',
];
const LABELS = [
  'Trip',
  'Move',
  'Dinner',
  'Our anniversary',
  'Wedding',
  'Your birthday',
  "Jessie's birthday",
];

const rowId = (key: string) => `settings-reminder-mark-${key}`;
const SWITCH = 'settings-reminders-switch';
const REMINDERS_OFF = { ...ALL_PUSH_PREFERENCES_ON, dateReminders: false };

/** Every switch in the card but the "Date reminders" one: the marks rows. */
const marksSwitches = () =>
  screen.getAllByRole('switch').filter((row) => row.getAttribute('data-testid') !== SWITCH);

/** Renders the group and waits for the loaded marks to enable the first row. */
async function renderLoaded(marks: string[] = []) {
  service.fetchCountdownMarks.mockResolvedValue(marks);
  render(<CountdownMarks />);
  await waitFor(() => expect(screen.getByTestId(rowId(KEYS[0]))).toBeEnabled());
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  capacitor.isNativePlatform.mockReturnValue(true);
  capacitor.isPluginAvailable.mockReturnValue(true);
  service.setCountdownMark.mockResolvedValue(undefined);
  preferences.savePushPreference.mockResolvedValue(REMINDERS_OFF);
  setOnline(true);
  useAppStore.getState().clearAuth();
  useAppStore.getState().setAuthUser('user-a');
  // The push section loads the switches when it opens; here the test sets them.
  useAppStore.setState({ pushPreferences: { ...ALL_PUSH_PREFERENCES_ON } });
});

afterEach(() => {
  cleanup();
  setOnline(true);
  vi.restoreAllMocks();
});

describe('CountdownMarks: where it shows', () => {
  it('renders nothing and reads nothing off the native platform', () => {
    capacitor.isNativePlatform.mockReturnValue(false);
    seedAllDates();
    const { container } = render(<CountdownMarks />);

    expect(container).toBeEmptyDOMElement();
    expect(service.fetchCountdownMarks).not.toHaveBeenCalled();
  });

  it('renders nothing and reads nothing in a shell without the local-notifications plugin', () => {
    capacitor.isPluginAvailable.mockImplementation((name: string) => name !== 'LocalNotifications');
    seedAllDates();
    const { container } = render(<CountdownMarks />);

    expect(container).toBeEmptyDOMElement();
    expect(service.fetchCountdownMarks).not.toHaveBeenCalled();
  });
});

describe('CountdownMarks: the rows', () => {
  it('is a Reminders card with one switch for each set date, in order, with the helper', async () => {
    seedAllDates();
    await renderLoaded();

    const card = screen.getByTestId('settings-reminder-marks');
    expect(within(card).getByRole('heading', { level: 3, name: 'Reminders' })).toBeInTheDocument();
    const switches = within(card).getAllByRole('switch');
    expect(switches.map((row) => row.getAttribute('data-testid'))).toEqual([SWITCH, ...KEYS.map(rowId)]);
    KEYS.forEach((key, index) => {
      const row = screen.getByTestId(rowId(key));
      expect(row).toHaveAccessibleName(LABELS[index]);
      expect(row).toHaveAccessibleDescription(HELPER);
      expect(screen.getByTestId(`${rowId(key)}-helper`).textContent).toBe(HELPER);
    });
  });

  it('shows every switch off at first', async () => {
    seedAllDates();
    await renderLoaded();

    for (const key of KEYS) expect(screen.getByTestId(rowId(key))).toHaveAttribute('aria-checked', 'false');
  });

  it('shows the loaded marks, and ignores a mark that matches no date', async () => {
    seedAllDates();
    await renderLoaded(['wedding', 'event:deleted']);

    expect(screen.getByTestId(rowId('wedding'))).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId(rowId('own-birthday'))).toHaveAttribute('aria-checked', 'false');
    expect(marksSwitches()).toHaveLength(KEYS.length);
  });

  it('lists no partner birthday without a linked partner or a birthday', async () => {
    seedAllDates();
    useAppStore.setState({ partner: null });
    await renderLoaded();

    expect(screen.queryByTestId(rowId('partner-birthday'))).not.toBeInTheDocument();
    expect(marksSwitches()).toHaveLength(KEYS.length - 1);
  });

  it('says so when there are no dates', async () => {
    service.fetchCountdownMarks.mockResolvedValue([]);
    render(<CountdownMarks />);

    expect(await screen.findByTestId('settings-reminder-marks-empty')).toHaveTextContent(
      'Dates you add show up here.'
    );
    // The Date reminders switch stays; there is no mark to switch.
    expect(screen.getAllByRole('switch').map((row) => row.getAttribute('data-testid'))).toEqual([SWITCH]);
  });

  it('loads the marks once when it opens', async () => {
    seedAllDates();
    await renderLoaded();

    expect(service.fetchCountdownMarks).toHaveBeenCalledExactlyOnceWith('user-a');
  });

  it('keeps the rows disabled until the marks have loaded', async () => {
    seedAllDates();
    // Settled at the end: the account-data queue is serial, so a read left
    // pending would hold every later test's read.
    let finish!: (value: string[]) => void;
    service.fetchCountdownMarks.mockReturnValue(
      new Promise<string[]>((resolve) => {
        finish = resolve;
      })
    );
    render(<CountdownMarks />);

    for (const key of KEYS) expect(screen.getByTestId(rowId(key))).toBeDisabled();

    finish([]);
    await waitFor(() => expect(screen.getByTestId(rowId(KEYS[0]))).toBeEnabled());
  });
});

describe('CountdownMarks: toggling', () => {
  it('marks a date through the store and shows it on', async () => {
    const user = userEvent.setup();
    seedAllDates();
    await renderLoaded();

    await user.click(screen.getByTestId(rowId('event:e1')));

    await waitFor(() => expect(screen.getByTestId(rowId('event:e1'))).toHaveAttribute('aria-checked', 'true'));
    expect(service.setCountdownMark).toHaveBeenCalledExactlyOnceWith('user-a', 'event:e1', true);
    expect(useAppStore.getState().countdownMarks).toEqual(['event:e1']);
    expect(screen.getByTestId(rowId('wedding'))).toHaveAttribute('aria-checked', 'false');
  });

  it('unmarks a marked date', async () => {
    const user = userEvent.setup();
    seedAllDates();
    await renderLoaded(['wedding', 'own-birthday']);

    await user.click(screen.getByTestId(rowId('wedding')));

    await waitFor(() => expect(screen.getByTestId(rowId('wedding'))).toHaveAttribute('aria-checked', 'false'));
    expect(service.setCountdownMark).toHaveBeenCalledExactlyOnceWith('user-a', 'wedding', false);
    expect(useAppStore.getState().countdownMarks).toEqual(['own-birthday']);
  });

  it('disables only the row whose save is in flight', async () => {
    const user = userEvent.setup();
    seedAllDates();
    await renderLoaded();
    let finish!: () => void;
    service.setCountdownMark.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );

    await user.click(screen.getByTestId(rowId('wedding')));

    expect(screen.getByTestId(rowId('wedding'))).toBeDisabled();
    expect(screen.getByTestId(rowId('own-birthday'))).toBeEnabled();

    finish();
    await waitFor(() => expect(screen.getByTestId(rowId('wedding'))).toBeEnabled());
  });

  it('refuses a toggle offline with the offline message and sends nothing', async () => {
    const user = userEvent.setup();
    seedAllDates();
    await renderLoaded();
    setOnline(false);

    await user.click(screen.getByTestId(rowId('wedding')));

    expect(await screen.findByTestId('settings-reminder-marks-error')).toHaveTextContent(
      'You are offline. Reminders need a connection to save.'
    );
    expect(service.setCountdownMark).not.toHaveBeenCalled();
    expect(screen.getByTestId(rowId('wedding'))).toHaveAttribute('aria-checked', 'false');
  });

  it('shows the error and leaves the switch off when the save fails', async () => {
    const user = userEvent.setup();
    seedAllDates();
    await renderLoaded();
    service.setCountdownMark.mockRejectedValue(new AccountDataError('transport', 'Server said no'));

    await user.click(screen.getByTestId(rowId('wedding')));

    expect(await screen.findByTestId('settings-reminder-marks-error')).toHaveTextContent('Server said no');
    expect(screen.getByTestId(rowId('wedding'))).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId(rowId('wedding'))).toBeEnabled();
    expect(useAppStore.getState().countdownMarks).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it('clears an earlier error on the next toggle', async () => {
    const user = userEvent.setup();
    seedAllDates();
    await renderLoaded();
    service.setCountdownMark.mockRejectedValueOnce(new Error('first failure'));

    await user.click(screen.getByTestId(rowId('wedding')));
    expect(await screen.findByTestId('settings-reminder-marks-error')).toBeInTheDocument();
    await user.click(screen.getByTestId(rowId('wedding')));

    await waitFor(() => expect(screen.queryByTestId('settings-reminder-marks-error')).not.toBeInTheDocument());
    expect(screen.getByTestId(rowId('wedding'))).toHaveAttribute('aria-checked', 'true');
  });
});

describe('CountdownMarks: the Date reminders switch', () => {
  it('is the first row of the card, before the marks rows, with its label, helper and bell', async () => {
    seedAllDates();
    await renderLoaded();

    const card = screen.getByTestId('settings-reminder-marks');
    const first = within(card).getAllByRole('switch')[0];
    expect(first).toBe(screen.getByTestId(SWITCH));
    expect(first).toHaveAccessibleName('Date reminders');
    expect(first).toHaveAccessibleDescription('At 9:00 before each date.');
    expect(first.querySelector('svg')).toBeInTheDocument();
    // After the heading and before the first mark row.
    const heading = within(card).getByRole('heading', { level: 3, name: 'Reminders' });
    expect(heading.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(first.compareDocumentPosition(screen.getByTestId(rowId(KEYS[0]))) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is first, before the empty line, when there are no dates', async () => {
    service.fetchCountdownMarks.mockResolvedValue([]);
    render(<CountdownMarks />);

    const empty = await screen.findByTestId('settings-reminder-marks-empty');
    expect(screen.getByTestId(SWITCH).compareDocumentPosition(empty) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is on by default: a row with no values yet reads as on, but is disabled', async () => {
    useAppStore.setState({ pushPreferences: null });
    seedAllDates();
    await renderLoaded();

    expect(screen.getByTestId(SWITCH)).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId(SWITCH)).toBeDisabled();
  });

  it('is on and enabled once the push switches have loaded', async () => {
    seedAllDates();
    await renderLoaded();

    expect(screen.getByTestId(SWITCH)).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId(SWITCH)).toBeEnabled();
  });

  it('shows off when the saved row has it off', async () => {
    useAppStore.setState({ pushPreferences: REMINDERS_OFF });
    seedAllDates();
    await renderLoaded();

    expect(screen.getByTestId(SWITCH)).toHaveAttribute('aria-checked', 'false');
  });

  it('turns off through the store, sending only that switch', async () => {
    const user = userEvent.setup();
    seedAllDates();
    await renderLoaded();

    await user.click(screen.getByTestId(SWITCH));

    await waitFor(() => expect(screen.getByTestId(SWITCH)).toHaveAttribute('aria-checked', 'false'));
    expect(preferences.savePushPreference).toHaveBeenCalledExactlyOnceWith('user-a', 'dateReminders', false);
    expect(useAppStore.getState().pushPreferences).toEqual(REMINDERS_OFF);
  });

  it('turns on again from off', async () => {
    const user = userEvent.setup();
    useAppStore.setState({ pushPreferences: REMINDERS_OFF });
    preferences.savePushPreference.mockResolvedValue(ALL_PUSH_PREFERENCES_ON);
    seedAllDates();
    await renderLoaded();

    await user.click(screen.getByTestId(SWITCH));

    await waitFor(() => expect(screen.getByTestId(SWITCH)).toHaveAttribute('aria-checked', 'true'));
    expect(preferences.savePushPreference).toHaveBeenCalledExactlyOnceWith('user-a', 'dateReminders', true);
  });

  it('is disabled while its save is in flight, and the marks rows stay usable', async () => {
    const user = userEvent.setup();
    seedAllDates();
    await renderLoaded();
    let finish!: (row: typeof REMINDERS_OFF) => void;
    preferences.savePushPreference.mockReturnValue(
      new Promise<typeof REMINDERS_OFF>((resolve) => {
        finish = resolve;
      })
    );

    await user.click(screen.getByTestId(SWITCH));

    expect(screen.getByTestId(SWITCH)).toBeDisabled();
    expect(screen.getByTestId(rowId('wedding'))).toBeEnabled();

    finish(REMINDERS_OFF);
    await waitFor(() => expect(screen.getByTestId(SWITCH)).toBeEnabled());
  });

  it('leaves the marks rows usable while it is off', async () => {
    useAppStore.setState({ pushPreferences: REMINDERS_OFF });
    seedAllDates();
    await renderLoaded();

    for (const row of marksSwitches()) expect(row).toBeEnabled();
  });

  it('refuses a toggle offline with the offline message and sends nothing', async () => {
    const user = userEvent.setup();
    seedAllDates();
    await renderLoaded();
    setOnline(false);

    await user.click(screen.getByTestId(SWITCH));

    expect(await screen.findByTestId('settings-reminder-marks-error')).toHaveTextContent(
      'You are offline. Reminders need a connection to save.'
    );
    expect(preferences.savePushPreference).not.toHaveBeenCalled();
    expect(screen.getByTestId(SWITCH)).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the error and keeps state when the save fails', async () => {
    const user = userEvent.setup();
    seedAllDates();
    await renderLoaded();
    preferences.savePushPreference.mockRejectedValue(new AccountDataError('transport', 'Server said no'));

    await user.click(screen.getByTestId(SWITCH));

    expect(await screen.findByTestId('settings-reminder-marks-error')).toHaveTextContent('Server said no');
    expect(screen.getByTestId(SWITCH)).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId(SWITCH)).toBeEnabled();
    expect(useAppStore.getState().pushPreferences).toEqual(ALL_PUSH_PREFERENCES_ON);
    expect(console.error).toHaveBeenCalled();
  });

  it('renders nothing off the native platform', () => {
    capacitor.isNativePlatform.mockReturnValue(false);
    const { container } = render(<CountdownMarks />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId(SWITCH)).not.toBeInTheDocument();
  });
});
