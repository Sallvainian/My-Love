export const CHAR_COUNTER_RATIO = 0.75;

export function getCharCounterThreshold(maxLength: number): number {
  return Math.floor(maxLength * CHAR_COUNTER_RATIO);
}
