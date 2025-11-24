/**
 * Relationship Dates Configuration
 *
 * Contains all important dates for the relationship timers:
 * - Dating start date (count-up timer)
 * - Birthday information (countdown with age calculation)
 * - Wedding date (countdown or placeholder)
 * - Visit dates (countdown to planned visits)
 */

export interface BirthdayInfo {
  name: string;
  month: number; // 1-12
  day: number;
  birthYear: number;
}

export interface VisitInfo {
  id: string;
  label: string;
  date: Date | null; // null = not yet planned
  description?: string;
}

export interface RelationshipDatesConfig {
  /** The date and time the relationship started */
  datingStart: Date;

  /** Birthday information for both partners */
  birthdays: {
    frank: BirthdayInfo;
    gracie: BirthdayInfo;
  };

  /** Wedding date - null if not yet set */
  wedding: Date | null;

  /** Planned visits to each other */
  visits: VisitInfo[];
}

/**
 * Relationship dates configuration
 *
 * Dating since: October 18th, 2025 at 6:00pm
 * Frank's birthday: July 9th, 1997
 * Gracie's birthday: March 10th, 1998
 */
export const RELATIONSHIP_DATES: RelationshipDatesConfig = {
  // October 18, 2025 at 6:00pm local time
  datingStart: new Date('2025-10-18T18:00:00'),

  birthdays: {
    frank: {
      name: 'Frank',
      month: 7,  // July
      day: 9,
      birthYear: 1997,
    },
    gracie: {
      name: 'Gracie',
      month: 3,  // March
      day: 10,
      birthYear: 1998,
    },
  },

  // Wedding date not yet set
  wedding: null,

  // No visits planned yet - can be added here when scheduled
  visits: [
    // Example format for when visits are planned:
    // {
    //   id: 'visit-1',
    //   label: 'Frank visits Gracie',
    //   date: new Date('2026-01-15'),
    //   description: 'First in-person visit!'
    // },
  ],
};

/**
 * Calculate the next occurrence of a birthday
 */
export function getNextBirthday(birthday: BirthdayInfo): Date {
  const today = new Date();
  const thisYear = today.getFullYear();

  // Create date for this year's birthday
  const birthdayThisYear = new Date(thisYear, birthday.month - 1, birthday.day);

  // If birthday has passed this year, use next year
  if (birthdayThisYear <= today) {
    return new Date(thisYear + 1, birthday.month - 1, birthday.day);
  }

  return birthdayThisYear;
}

/**
 * Calculate the age someone will turn on their next birthday
 */
export function getUpcomingAge(birthday: BirthdayInfo): number {
  const nextBirthday = getNextBirthday(birthday);
  return nextBirthday.getFullYear() - birthday.birthYear;
}

/**
 * Calculate time difference between two dates
 */
export interface TimeDifference {
  years: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMilliseconds: number;
  isPast: boolean;
}

export function calculateTimeDifference(from: Date, to: Date): TimeDifference {
  const diff = to.getTime() - from.getTime();
  const isPast = diff < 0;
  const absDiff = Math.abs(diff);

  const seconds = Math.floor(absDiff / 1000) % 60;
  const minutes = Math.floor(absDiff / (1000 * 60)) % 60;
  const hours = Math.floor(absDiff / (1000 * 60 * 60)) % 24;
  const totalDays = Math.floor(absDiff / (1000 * 60 * 60 * 24));
  const years = Math.floor(totalDays / 365);
  const days = totalDays % 365;

  return {
    years,
    days,
    hours,
    minutes,
    seconds,
    totalMilliseconds: absDiff,
    isPast,
  };
}

/**
 * Format time together as a readable string
 * Format: "X year(s) Y day(s) Z hour(s) M minute(s) and S second(s) together"
 */
export function formatTimeTogether(diff: TimeDifference): string {
  const parts: string[] = [];

  if (diff.years > 0) {
    parts.push(`${diff.years} ${diff.years === 1 ? 'year' : 'years'}`);
  }

  if (diff.days > 0 || diff.years > 0) {
    parts.push(`${diff.days} ${diff.days === 1 ? 'day' : 'days'}`);
  }

  parts.push(`${diff.hours} ${diff.hours === 1 ? 'hour' : 'hours'}`);
  parts.push(`${diff.minutes} ${diff.minutes === 1 ? 'minute' : 'minutes'}`);
  parts.push(`${diff.seconds} ${diff.seconds === 1 ? 'second' : 'seconds'}`);

  // Join with commas and "and" before the last item
  if (parts.length > 1) {
    const lastPart = parts.pop();
    return `${parts.join(', ')} and ${lastPart} together`;
  }

  return `${parts[0]} together`;
}

/**
 * Format countdown as days, hours, minutes, seconds
 */
export function formatCountdown(diff: TimeDifference): string {
  const totalDays = diff.years * 365 + diff.days;

  const dayStr = `${totalDays} ${totalDays === 1 ? 'day' : 'days'}`;
  const hourStr = String(diff.hours).padStart(2, '0');
  const minStr = String(diff.minutes).padStart(2, '0');
  const secStr = String(diff.seconds).padStart(2, '0');

  return `${dayStr} ${hourStr}:${minStr}:${secStr}`;
}
