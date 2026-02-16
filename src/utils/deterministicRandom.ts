/**
 * Deterministic pseudo-random helpers for render-safe value generation.
 * The output is stable for a given seed and does not rely on Math.random.
 */

function hashString(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateDeterministicNumbers(
  seed: string,
  count: number,
  min: number = 0,
  max: number = 1
): number[] {
  if (count <= 0) {
    return [];
  }

  const lowerBound = Math.min(min, max);
  const upperBound = Math.max(min, max);
  const span = upperBound - lowerBound;
  const generator = createSeededGenerator(hashString(seed) || 1);

  return Array.from({ length: count }, () => lowerBound + generator() * span);
}
