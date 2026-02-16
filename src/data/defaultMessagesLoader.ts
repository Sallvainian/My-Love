import type { Message } from '../types';

type SeedMessage = Omit<Message, 'id' | 'createdAt' | 'isCustom'>;

/**
 * Loads default seed messages only when first-run initialization requires them.
 * This keeps the large dataset out of the eager startup path.
 */
export const loadDefaultMessages = async (): Promise<SeedMessage[]> => {
  const module = await import('./defaultMessages');
  return module.default;
};
