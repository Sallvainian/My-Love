/**
 * The four badges the milestone screen (`Milestone.tsx`) draws: the block of
 * four 25-day marks that holds the newest milestone reached (25 to 100, then
 * 125 to 200, ...). The only thing the client works out about milestones; the
 * count itself is the server's (`streak.milestones`).
 *
 * @module components/DailyQuestion/milestoneBadges
 */

/** Days between two milestones, and badges drawn at once. */
const MILESTONE_DAYS = 25;
const BADGES_SHOWN = 4;

/**
 * The four badges of the block that holds the `milestones`-th milestone
 * (a count under 1 shows the first block): days are 25 times its position, and
 * a badge is reached when the held days it stands for are within the count.
 */
export function milestoneBadges(milestones: number): { days: number; reached: boolean }[] {
  const block = Math.floor((Math.max(milestones, 1) - 1) / BADGES_SHOWN);
  return Array.from({ length: BADGES_SHOWN }, (_, index) => {
    const days = (block * BADGES_SHOWN + index + 1) * MILESTONE_DAYS;
    return { days, reached: days <= milestones * MILESTONE_DAYS };
  });
}
