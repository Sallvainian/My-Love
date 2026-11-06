// src/services/__tests__/dateRemindersKit.ts
import { planDateReminders, type PlannedReminder, type ReminderDates } from '../dateReminders';

// Vitest runs with TZ=America/New_York. Local time throughout, as the app reads it.
export const NOW = new Date(2026, 10, 1, 10, 0); // Sun 1 Nov 2026, 10:00

const NO_DATES: ReminderDates = {
  events: [],
  anniversaries: [],
  relationshipStart: null,
  weddingDate: null,
  ownBirthday: null,
  partnerBirthday: null,
  marks: new Set(),
  remindersOn: true,
};

/** What `plan` takes: an event's id defaults to `event-<label>`, and the marks are a list. */
type PlanInput = Partial<Omit<ReminderDates, 'events' | 'marks'>> & {
  events?: { id?: string; label: string; date: Date }[];
  marks?: readonly string[];
};

export function plan({ events = [], marks = [], ...dates }: PlanInput, now: Date = NOW): PlannedReminder[] {
  return planDateReminders(
    {
      ...NO_DATES,
      ...dates,
      events: events.map((event) => ({ id: `event-${event.label}`, ...event })),
      marks: new Set(marks),
    },
    now
  );
}
