/**
 * Always-succeeding stand-ins for the Supabase half of custom messages and
 * favorites, for tests that drive the real message-data local copy.
 *
 * `customMessageService` and `storageService.toggleFavorite` write the server
 * first; these fakes let a test exercise the copy without a network. Wire
 * them with a partial mock so the pure helpers (`isMessageCategory`,
 * `bundledMessageKey`, `hashText`) stay real:
 *
 *   vi.mock('…/src/services/customMessagesApi', async (importOriginal) => ({
 *     ...(await importOriginal<typeof import('…/src/services/customMessagesApi')>()),
 *     customMessagesApi: (await import('…/helpers/fakeAccountDataApis')).fakeCustomMessagesApi,
 *   }));
 */
import { vi } from 'vitest';
import type {
  CustomMessageFields,
  ServerCustomMessage,
} from '../../../src/services/customMessagesApi';

let nextServerId = 0;

export const fakeCustomMessagesApi = {
  fetchCustomMessages: vi.fn(async (_userId: string): Promise<ServerCustomMessage[]> => []),
  createCustomMessage: vi.fn(
    async (
      _userId: string,
      fields: CustomMessageFields,
      _clientKey: string
    ): Promise<ServerCustomMessage> => ({
      serverId: `server-${++nextServerId}`,
      ...fields,
      isFavorite: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  ),
  updateCustomMessage: vi.fn(
    async (
      serverId: string,
      updates: Partial<CustomMessageFields> & { isFavorite?: boolean }
    ): Promise<ServerCustomMessage> => ({
      serverId,
      text: 'updated',
      category: 'custom',
      active: true,
      tags: [],
      isFavorite: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...updates,
    })
  ),
  deleteCustomMessage: vi.fn(async (_serverId: string): Promise<void> => {}),
};

export const fakeMessageFavoritesApi = {
  fetchFavoriteKeys: vi.fn(async (_userId: string): Promise<string[]> => []),
  addFavorite: vi.fn(async (_userId: string, _key: string): Promise<void> => {}),
  removeFavorite: vi.fn(async (_userId: string, _key: string): Promise<void> => {}),
};
