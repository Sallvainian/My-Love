/**
 * RelationshipTimers Component
 *
 * Displays a panel of relationship-related timers:
 * - Time together (count-up from dating start)
 * - Birthday countdowns with upcoming age
 * - Wedding countdown (or placeholder)
 * - Visit countdowns
 */

import { m as motion } from 'framer-motion';
import { TimeTogether } from './TimeTogether';
import { BirthdayCountdown } from './BirthdayCountdown';
import { EventCountdown } from './EventCountdown';
import { RELATIONSHIP_DATES } from '../../config/relationshipDates';

export interface RelationshipTimersProps {
  className?: string;
}

export function RelationshipTimers({ className = '' }: RelationshipTimersProps) {
  const { birthdays, wedding, visits } = RELATIONSHIP_DATES;

  return (
    <div className={`relative w-full max-w-2xl mx-auto px-4 py-8 ${className}`} data-testid="relationship-timers">
      {/* Header - matches DailyMessage header structure */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center mb-6"
      >
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 flex items-center justify-center gap-2">
          <span className="text-pink-400">💕</span>
          <span>Our Timers</span>
          <span className="text-pink-400">💕</span>
        </h2>
      </motion.div>

      {/* Timer cards container */}
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >

        {/* Time Together - Count UP */}
        <TimeTogether />

        {/* Birthday Countdowns */}
        <BirthdayCountdown birthday={birthdays.frank} />
        <BirthdayCountdown birthday={birthdays.gracie} />

        {/* Wedding Countdown */}
        <EventCountdown
          label="Wedding"
          icon="ring"
          date={wedding}
          placeholderText="Date TBD"
        />

        {/* Visit Countdowns */}
        {visits.length > 0 ? (
          visits.map((visit) => (
            <EventCountdown
              key={visit.id}
              label={visit.label}
              icon="plane"
              date={visit.date}
              description={visit.description}
            />
          ))
        ) : (
          <EventCountdown
            label="Next Visit"
            icon="plane"
            date={null}
            placeholderText="No visits planned yet"
          />
        )}
      </motion.div>
    </div>
  );
}
