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

/**
 * Relationship dates configuration
 *
 * Dating since: October 18th, 2025 at 6:00pm
 * Frank's birthday: July 9th, 1997
 * Gracie's birthday: March 10th, 1998
 */
export const RELATIONSHIP_DATES = {
  // October 18, 2025 at 6:00pm local time
  datingStart: new Date('2025-10-18T18:00:00'),

  birthdays: {
    frank: {
      name: 'Frank',
      month: 7, // July
      day: 9,
      birthYear: 1997,
    },
    gracie: {
      name: 'Gracie',
      month: 3, // March
      day: 10,
      birthYear: 1998,
    },
  },

  // Wedding date not yet set
  wedding: null,

  // Planned visits (using local dates to avoid UTC timezone issues)
  visits: [
    {
      id: 'visit-1',
      label: 'Next Visit',
      date: new Date(2025, 10, 26), // November 26, 2025 (month is 0-indexed)
      description: 'November visit',
    },
    {
      id: 'visit-2',
      label: 'Following Visit',
      date: new Date(2025, 11, 20), // December 20, 2025
      description: 'December visit',
    },
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
