import type { Message } from '../types';
import type { StoredMessageData } from './dbSchema';

/**
 * The rotation pool one account sees: the bundled rows by ascending id, then
 * that account's custom rows (from its `message-data` copy) by ascending id.
 *
 * Favorites come from the copy alone — a bundled row's favorite is its id in
 * `bundledFavoriteIds`, a custom row's is its own `isFavorite`. A legacy flag
 * on a bundled row is never authoritative, and with no copy (signed out, or
 * nothing saved yet) nothing is a favorite.
 */
export function projectMessageFavorites(
  bundled: Message[],
  copy: StoredMessageData | null
): Message[] {
  const favoriteIds = new Set(copy?.bundledFavoriteIds ?? []);
  const shared = bundled
    .filter((message) => !message.isCustom)
    .map((message) => ({ ...message, isFavorite: favoriteIds.has(message.id) }))
    .sort((a, b) => a.id - b.id);
  const own = [...(copy?.custom ?? [])]
    .map((message) => ({ ...message, isFavorite: message.isFavorite === true }))
    .sort((a, b) => a.id - b.id);
  return [...shared, ...own];
}

/** Set one message's favorite in the copy: a custom row's own flag, or a bundled id. */
export function withFavorite(
  copy: StoredMessageData,
  message: Pick<Message, 'id' | 'isCustom'>,
  isFavorite: boolean
): StoredMessageData {
  if (message.isCustom) {
    return {
      ...copy,
      custom: copy.custom.map((row) => (row.id === message.id ? { ...row, isFavorite } : row)),
    };
  }
  const others = copy.bundledFavoriteIds.filter((id) => id !== message.id);
  return { ...copy, bundledFavoriteIds: isFavorite ? [...others, message.id] : others };
}

/** Is this message a favorite in the copy? */
export function isFavoriteIn(
  copy: StoredMessageData,
  message: Pick<Message, 'id' | 'isCustom'>
): boolean {
  if (message.isCustom) {
    return copy.custom.some((row) => row.id === message.id && row.isFavorite === true);
  }
  return copy.bundledFavoriteIds.includes(message.id);
}
