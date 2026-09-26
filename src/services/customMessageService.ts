import { LOG_TRUNCATE_LENGTH } from '../config/performance';
import type {
  CreateMessageInput,
  CustomMessagesExport,
  Message,
  UpdateMessageInput,
} from '../types';
import { logger } from '../utils/logger';
import { AccountDataError, NOT_SYNCED_MESSAGE } from './accountDataError';
import { customMessagesApi, type ServerCustomMessage } from './customMessagesApi';
import { MESSAGE_DATA_COPY_KIND, type StoredMessageData } from './dbSchema';
import { readLocalCopy, writeLocalCopy } from './localCopy';
import {
  CreateMessageInputSchema,
  CustomMessagesExportSchema,
  UpdateMessageInputSchema,
} from '../validation/schemas';
import { createValidationError, isZodError } from '../validation/errorMessages';

/**
 * Custom Message Service — one account's custom daily messages.
 *
 * SUPABASE IS THE SOURCE OF TRUTH
 *
 * Custom messages live in `public.custom_messages` (`customMessagesApi`). The
 * device keeps them in the account's shared local copy (`services/localCopy.ts`,
 * kind `message-data`, value `MessageDataCopy`), beside the ids of the bundled
 * messages the account has favorited. This module opens no database of its
 * own. It holds:
 *
 * - the copy's read and write (`readMessageData`, `writeMessageData`), which go
 *   through `localCopy` under the caller's id;
 * - the server writes (`createRemote`, `updateRemote`, `deleteRemote`), each
 *   validated first and each refused offline by `customMessagesApi`;
 * - pure transforms of the copy value (`with…`), so the caller saves exactly
 *   what the server confirmed.
 *
 * `messagesSlice` does the rest: it runs each write in the account-data queue,
 * reads the copy, sends the server write, re-checks `{ userId,
 * authSessionVersion }`, and only then saves the transformed copy.
 *
 * LOCAL IDS
 *
 * Every custom row keeps a device-local numeric `id` — rotation history,
 * favorites and the Admin panel refer to it — and its `serverId`. A row matched
 * by `serverId` keeps its id across refreshes. A new row takes the next id
 * above every bundled id and every id the copy has handed out
 * (`nextCustomId`), so an id a deleted row used is never reused.
 */

/** The value of the `message-data` local copy. */
export type MessageDataCopy = StoredMessageData;

export { MESSAGE_DATA_COPY_KIND };

/** A copy with nothing in it; the first new id is never below `minNewId`. */
export function emptyMessageData(minNewId = 1): MessageDataCopy {
  return { custom: [], bundledFavoriteIds: [], nextCustomId: minNewId };
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/** One saved custom row, or null when it is malformed. */
function parseCustomRow(value: unknown): Message | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const createdAt = toDate(row.createdAt);
  if (typeof row.id !== 'number' || typeof row.text !== 'string' || !createdAt) return null;
  const updatedAt = toDate(row.updatedAt);
  return {
    id: row.id,
    text: row.text,
    category: (typeof row.category === 'string' ? row.category : 'custom') as Message['category'],
    isCustom: true,
    ...(typeof row.userId === 'string' ? { userId: row.userId } : {}),
    ...(typeof row.serverId === 'string' ? { serverId: row.serverId } : {}),
    active: row.active !== false,
    isFavorite: row.isFavorite === true,
    createdAt,
    ...(updatedAt ? { updatedAt } : {}),
    tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === 'string') : [],
  };
}

/** The saved copy's valid parts; anything malformed is dropped, not shown. */
export function parseMessageData(value: unknown): MessageDataCopy | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const custom = Array.isArray(v.custom)
    ? v.custom.map(parseCustomRow).filter((row): row is Message => row !== null)
    : [];
  const bundledFavoriteIds = Array.isArray(v.bundledFavoriteIds)
    ? v.bundledFavoriteIds.filter((id): id is number => typeof id === 'number')
    : [];
  const highest = Math.max(0, ...custom.map((row) => row.id));
  const nextCustomId =
    typeof v.nextCustomId === 'number' && Number.isFinite(v.nextCustomId)
      ? Math.max(v.nextCustomId, highest + 1)
      : highest + 1;
  return { custom: custom.sort((a, b) => a.id - b.id), bundledFavoriteIds, nextCustomId };
}

/** The account's saved copy, or `null` when there is none or the read failed. */
export async function readMessageData(userId: string): Promise<MessageDataCopy | null> {
  return parseMessageData(await readLocalCopy<unknown>(userId, MESSAGE_DATA_COPY_KIND));
}

/** Replace the account's saved copy. Throws on failure. */
export async function writeMessageData(userId: string, value: MessageDataCopy): Promise<void> {
  await writeLocalCopy(userId, MESSAGE_DATA_COPY_KIND, value);
}

function requireOwner(userId: string | null | undefined, operation: string): string {
  if (!userId) {
    throw new Error(
      `[CustomMessageService] ${operation} requires a signed-in user — refusing to write an unowned custom message`
    );
  }
  return userId;
}

function toCustomRow(id: number, owner: string, remote: ServerCustomMessage): Message {
  return {
    id,
    text: remote.text,
    category: remote.category,
    isCustom: true,
    userId: owner,
    serverId: remote.serverId,
    active: remote.active,
    isFavorite: remote.isFavorite,
    createdAt: remote.createdAt,
    updatedAt: remote.updatedAt,
    tags: remote.tags,
  };
}

function nextId(copy: MessageDataCopy, minNewId: number): number {
  return Math.max(copy.nextCustomId, minNewId, ...copy.custom.map((row) => row.id + 1));
}

/** Rethrow a Zod failure as the form's validation error. */
function validated<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (isZodError(error)) {
      console.error('[CustomMessageService] Validation failed:', error.issues);
      throw createValidationError(error);
    }
    throw error;
  }
}

function requireServerId(row: Message): string {
  if (!row.serverId) throw new AccountDataError('not-synced', NOT_SYNCED_MESSAGE);
  return row.serverId;
}

export const customMessageService = {
  /**
   * Create a custom message on the server for `userId`. Validates first.
   * `clientKey` is reused across a retry of one submit, so a lost response
   * resolves to the row the first attempt stored.
   */
  async createRemote(
    userId: string | null,
    input: CreateMessageInput,
    clientKey: string
  ): Promise<ServerCustomMessage> {
    const owner = requireOwner(userId, 'create');
    const fields = validated(() => CreateMessageInputSchema.parse(input));
    return customMessagesApi.createCustomMessage(
      owner,
      {
        text: fields.text,
        category: fields.category,
        active: fields.active ?? true,
        tags: fields.tags || [],
      },
      clientKey
    );
  },

  /** Validate an edit before it is queued; throws the form's error. */
  validateUpdate(input: UpdateMessageInput): UpdateMessageInput {
    return validated(() => UpdateMessageInputSchema.parse(input));
  },

  /** Send an edit of `row` (a row of the caller's copy); returns the server row. */
  async updateRemote(row: Message, input: UpdateMessageInput): Promise<ServerCustomMessage> {
    const serverId = requireServerId(row);
    return customMessagesApi.updateCustomMessage(serverId, {
      ...(input.text !== undefined && { text: input.text }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.active !== undefined && { active: input.active }),
      ...(input.tags !== undefined && { tags: input.tags }),
    });
  },

  /** Delete `row` on the server; an already-deleted server row counts as deleted. */
  async deleteRemote(row: Message): Promise<void> {
    await customMessagesApi.deleteCustomMessage(requireServerId(row));
  },

  /**
   * Add the server's new row to the copy under the next free id. A retried
   * submit resolves to a row a refresh may already have brought in: that row
   * is returned and the copy is unchanged.
   */
  withCreatedRow(
    copy: MessageDataCopy,
    remote: ServerCustomMessage,
    owner: string,
    minNewId: number
  ): { copy: MessageDataCopy; message: Message } {
    const existing = copy.custom.find((row) => row.serverId === remote.serverId);
    if (existing) return { copy, message: existing };
    const id = nextId(copy, minNewId);
    const message = toCustomRow(id, owner, remote);
    return {
      copy: { ...copy, custom: [...copy.custom, message], nextCustomId: id + 1 },
      message,
    };
  },

  /** Replace row `id` with the server's confirmed row, keeping its local id. */
  withUpdatedRow(
    copy: MessageDataCopy,
    id: number,
    remote: ServerCustomMessage,
    owner: string
  ): MessageDataCopy {
    return {
      ...copy,
      custom: copy.custom.map((row) => (row.id === id ? toCustomRow(id, owner, remote) : row)),
    };
  },

  /** Drop row `id`. `nextCustomId` is kept, so the id is never handed out again. */
  withoutRow(copy: MessageDataCopy, id: number): MessageDataCopy {
    return { ...copy, custom: copy.custom.filter((row) => row.id !== id) };
  },

  /**
   * The server's rows in copy form. A row matched by `serverId` keeps its local
   * id; a new one takes the next id; every other row — one the server no longer
   * holds, or one without a `serverId` — is dropped. `bundledFavoriteIds`
   * replaces the bundled favorites.
   */
  withServerRows(
    copy: MessageDataCopy,
    rows: ServerCustomMessage[],
    owner: string,
    bundledFavoriteIds: number[],
    minNewId: number
  ): MessageDataCopy {
    const idByServerId = new Map(
      copy.custom.filter((row) => row.serverId).map((row) => [row.serverId as string, row.id])
    );
    let next = nextId(copy, minNewId);
    const custom = rows.map((remote) => {
      const known = idByServerId.get(remote.serverId);
      return toCustomRow(known ?? next++, owner, remote);
    });
    return {
      custom: custom.sort((a, b) => a.id - b.id),
      bundledFavoriteIds: [...bundledFavoriteIds],
      nextCustomId: next,
    };
  },

  /**
   * One account's custom messages as an export file. The file carries NO owner
   * field: the account that imports it becomes the owner of the rows it creates.
   */
  exportMessages(custom: Message[]): CustomMessagesExport {
    const exportData: CustomMessagesExport = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      messageCount: custom.length,
      messages: custom.map((m) => ({
        text: m.text,
        category: m.category,
        active: m.active ?? true,
        tags: m.tags || [],
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt?.toISOString() || m.createdAt.toISOString(),
      })),
    };
    logger.debug('[CustomMessageService] Exported messages, count:', custom.length);
    return exportData;
  },

  /**
   * Validate an export file and split it into the rows to create and the count
   * skipped as duplicates of `existing` (the importing account's own rows) or
   * of an earlier row in the same file. Any owner field in the file is ignored:
   * the schema strips unknown keys.
   */
  planImport(
    existing: Message[],
    exportData: CustomMessagesExport
  ): { toCreate: CreateMessageInput[]; skipped: number } {
    const file = validated(() => CustomMessagesExportSchema.parse(exportData));
    const seen = new Set(existing.map((m) => m.text.trim().toLowerCase()));
    const toCreate: CreateMessageInput[] = [];
    let skipped = 0;
    for (const msg of file.messages) {
      const normalized = msg.text.trim().toLowerCase();
      if (seen.has(normalized)) {
        skipped++;
        logger.debug(
          '[CustomMessageService] Skipping duplicate message:',
          msg.text.substring(0, LOG_TRUNCATE_LENGTH) + '...'
        );
        continue;
      }
      seen.add(normalized);
      toCreate.push({ text: msg.text, category: msg.category, active: msg.active, tags: msg.tags });
    }
    return { toCreate, skipped };
  },
};
