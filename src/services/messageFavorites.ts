import type { IDBPDatabase } from 'idb';
import type { Message } from '../types';
import type { MyLoveDBSchema } from './dbSchema';

/** Legacy row flags are never authoritative, including when signed out. */
export async function projectMessageFavorites(
  db: IDBPDatabase<MyLoveDBSchema>,
  messages: Message[],
  userId: string | null
): Promise<Message[]> {
  const favorites = userId
    ? await db.getAllFromIndex('message-favorites', 'by-user', userId)
    : [];
  const ids = new Set(favorites.map((favorite) => favorite.messageId));
  return messages.map((message) => ({ ...message, isFavorite: ids.has(message.id) }));
}
