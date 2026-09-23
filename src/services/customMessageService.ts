import { LOG_TRUNCATE_LENGTH } from '../config/performance';
import type {
  CreateMessageInput,
  CustomMessagesExport,
  Message,
  MessageFilter,
  UpdateMessageInput,
} from '../types';
import { projectMessageFavorites } from './messageFavorites';
import { logger } from '../utils/logger';
import { AccountDataError, NOT_SYNCED_MESSAGE } from './accountDataError';
import { serializeAccountDataWrite } from './accountDataQueue';
import { customMessagesApi, type ServerCustomMessage } from './customMessagesApi';
import {
  CreateMessageInputSchema,
  CustomMessagesExportSchema,
  UpdateMessageInputSchema,
} from '../validation/schemas';
import { createValidationError, isZodError } from '../validation/errorMessages';
import { BaseIndexedDBService } from './BaseIndexedDBService';
import { type MyLoveDBSchema, DB_VERSION, openMyLoveDB } from './dbSchema';

/**
 * Custom Message Service - IndexedDB CRUD operations for custom messages
 * Story 3.5: Migrate from LocalStorage to IndexedDB for scalability
 * Story 5.3: Refactored to extend BaseIndexedDBService to reduce duplication
 * Story 5.5: Added validation layer to prevent data corruption
 *
 * OWNERSHIP IS A REQUIRED ARGUMENT, NOT A LOOKUP
 *
 * The `messages` store holds every account that has signed in on this device.
 * Custom rows carry a `userId`; the seeded daily rows do not, and are shared by
 * everyone. Every method here that returns, changes, counts or exports a row
 * takes the caller's id and matches it against the row first — so one partner
 * can no longer list, edit, delete, export or rotate through the other's
 * private messages on a shared browser.
 *
 * The one exception is `createUnownedIfAbsent()`, which takes no caller id
 * because it has none to take: it exists for the legacy LocalStorage migration
 * and writes a row that belongs to NOBODY. It reads the whole store to
 * deduplicate, and that is safe only because it returns no row to its caller —
 * see its own comment.
 *
 * The id is passed IN rather than read from the store, so the service stays
 * store-free and a continuation that resolves after an account switch writes
 * under the id it was raised with instead of whoever is signed in now.
 *
 * SUPABASE IS THE SOURCE OF TRUTH
 *
 * Custom messages live in `public.custom_messages` (`customMessagesApi`). The
 * owned rows in IndexedDB are a read mirror: every write here goes to the
 * server first and to the mirror only after the server accepted it, so an
 * offline write fails with a clear error and leaves nothing half-written. Each
 * mirrored row carries its server id as `serverId`; a row without one is not
 * in the account and cannot be edited or deleted. `replaceMirrorForUser()`
 * swaps the mirror for the server's rows on every signed-in start.
 *
 * Extends: BaseIndexedDBService<Message>
 * - Inherits: init(), add()
 * - Implements: getStoreName(), _doInit()
 * - OVERRIDDEN TO THROW: get(), getAll(), update(), delete(), clear(), getPage().
 *   TypeScript cannot narrow an inherited public method into one that demands an
 *   owner, so each unscoped base method is closed off here instead; nothing may
 *   reach the base implementation for this store. Their owner-scoped
 *   replacements are getForUser(), getAllForUser(), updateMessage() and
 *   deleteForUser().
 * - Owner-scoped: create(), getActiveCustomMessages(), exportMessages(),
 *   importMessages()
 * - Unowned, migration-only: createUnownedIfAbsent()
 */
class CustomMessageService extends BaseIndexedDBService<Message, MyLoveDBSchema, 'messages'> {
  /**
   * Get the object store name for messages
   */
  protected getStoreName(): 'messages' {
    return 'messages';
  }

  /**
   * Initialize IndexedDB connection
   * Uses centralized upgradeDb function from dbSchema.ts
   */
  protected async _doInit(): Promise<void> {
    try {
      logger.debug(`[CustomMessageService] Initializing IndexedDB (version ${DB_VERSION})...`);

      this.db = await openMyLoveDB();

      logger.debug(`[CustomMessageService] IndexedDB initialized successfully (v${DB_VERSION})`);
    } catch (error) {
      this.handleError('initialize', error as Error);
    }
  }

  // ==========================================================================
  // Ownership
  // ==========================================================================

  /**
   * Is this row readable by `userId`?
   *
   * Seeded daily rows (`isCustom: false`) are shared — they ship with the app,
   * carry no owner and are not partitioned. A custom row belongs to exactly one
   * account. A custom row with no `userId` is legacy: it belongs to nobody and
   * is readable by nobody. `userId` is always a non-empty string here (callers
   * fail closed before reaching this), so an absent owner cannot match.
   */
  private isVisibleTo(message: Message, userId: string): boolean {
    if (!message.isCustom) return true;
    return message.userId === userId;
  }

  /**
   * Is this row writable by `userId`?
   *
   * Stricter than readability: the shared daily rows are nobody's to change
   * through this service, so only an owned custom row qualifies.
   */
  private isOwnedBy(message: Message, userId: string): boolean {
    return message.isCustom === true && message.userId === userId;
  }

  /**
   * Demand a signed-in owner for a mutation.
   *
   * Writes fail loudly rather than silently doing nothing, matching the base
   * class's split: reads degrade to empty, writes throw. A signed-out caller
   * has no custom messages to change, and guessing an owner is the whole bug
   * this service exists to remove.
   */
  private requireOwner(userId: string | null | undefined, operation: string): string {
    if (!userId) {
      throw new Error(
        `[CustomMessageService] ${operation} requires a signed-in user — refusing to write an unowned custom message`
      );
    }
    return userId;
  }

  // ==========================================================================
  // Inherited unscoped methods — closed off
  //
  // Each of these is public on BaseIndexedDBService and reaches every account's
  // rows in this store. They cannot be narrowed to demand an owner (a subclass
  // method may not add required parameters), so they are overridden to throw
  // and named replacements are provided below.
  // ==========================================================================

  /** @deprecated Unscoped. Use {@link getForUser}. */
  async get(_id: number | string): Promise<Message | null> {
    throw new Error(
      '[CustomMessageService] get() is unscoped — use getForUser(userId, id) so one account cannot read another’s custom messages'
    );
  }

  /** @deprecated Unscoped. Use {@link getAllForUser}. */
  async getAll(): Promise<Message[]> {
    throw new Error(
      '[CustomMessageService] getAll() is unscoped — use getAllForUser(userId, filter) so one account cannot read another’s custom messages'
    );
  }

  /** @deprecated Unscoped. Use {@link updateMessage}. */
  async update(_id: number | string, _updates: Partial<Message>): Promise<void> {
    throw new Error(
      '[CustomMessageService] update() is unscoped — use updateMessage(userId, input) so one account cannot change another’s custom messages'
    );
  }

  /** @deprecated Unscoped. Use {@link deleteForUser}. */
  async delete(_id: number | string): Promise<void> {
    throw new Error(
      '[CustomMessageService] delete() is unscoped — use deleteForUser(userId, id) so one account cannot delete another’s custom messages'
    );
  }

  /**
   * @deprecated Unscoped, and has no owner-scoped replacement: clearing the
   * store would take the seeded daily messages and every other account's custom
   * rows with it. Delete rows one at a time through {@link deleteForUser}.
   */
  async clear(): Promise<void> {
    throw new Error(
      '[CustomMessageService] clear() would wipe every account’s messages — delete owned rows through deleteForUser(userId, id)'
    );
  }

  /** @deprecated Unscoped. Page over {@link getAllForUser} instead. */
  async getPage(_offset: number, _limit: number): Promise<Message[]> {
    throw new Error(
      '[CustomMessageService] getPage() is unscoped — page over getAllForUser(userId, filter) instead'
    );
  }

  // ==========================================================================
  // Owner-scoped API
  // ==========================================================================

  /**
   * Create a new custom message owned by `userId`
   * AC-3.5.1: Save to IndexedDB messages store with isCustom: true
   * AC-5.5.6: Validate input at service boundary before IndexedDB write
   * Uses inherited add() method from base class
   *
   * @param userId - The authenticated user the row belongs to. Required.
   * @param input - Message content
   */
  async create(
    userId: string | null,
    input: CreateMessageInput,
    clientKey: string = crypto.randomUUID()
  ): Promise<Message> {
    // Queued with the mirror refresh — see accountDataQueue.ts.
    return serializeAccountDataWrite(() => this.createNow(userId, input, clientKey));
  }

  private async createNow(
    userId: string | null,
    input: CreateMessageInput,
    clientKey: string
  ): Promise<Message> {
    try {
      const owner = this.requireOwner(userId, 'create');

      // Validate input at service boundary
      const validated = CreateMessageInputSchema.parse(input);

      // Server first: an offline or rejected write throws here, before the
      // mirror is touched.
      const remote = await customMessagesApi.createCustomMessage(
        owner,
        {
          text: validated.text,
          category: validated.category,
          active: validated.active ?? true, // Default: true
          tags: validated.tags || [],
        },
        clientKey
      );

      // A retried submit resolves to the row its first attempt stored, which a
      // mirror refresh may already have brought onto this device.
      const mirrored = (await this.readOwnedRows(owner)).find(
        (row) => row.serverId === remote.serverId
      );
      if (mirrored) return mirrored;

      const message: Omit<Message, 'id'> = {
        text: remote.text,
        category: remote.category,
        isCustom: true,
        userId: owner,
        serverId: remote.serverId,
        active: remote.active,
        isFavorite: false,
        createdAt: remote.createdAt,
        updatedAt: remote.updatedAt,
        tags: remote.tags,
      };

      let created: Message;
      try {
        created = await super.add(message);
      } catch (mirrorError) {
        // The message IS saved; saying "failed" would invite a retry that
        // stores it twice. The next mirror refresh brings it onto this device.
        console.error('[CustomMessageService] Saved remotely, mirror write failed:', mirrorError);
        throw new Error(
          'Your message was saved to your account, but this device could not store its copy. Reload to see it.',
          { cause: mirrorError }
        );
      }
      logger.debug('[CustomMessageService] Custom message created, id:', created.id);

      return created;
    } catch (error) {
      // Transform Zod validation errors into user-friendly messages
      if (isZodError(error)) {
        console.error('[CustomMessageService] Validation failed:', error.issues);
        throw createValidationError(error);
      }
      console.error('[CustomMessageService] Failed to create custom message:', error);
      console.error('[CustomMessageService] Input:', input);
      throw error;
    }
  }

  /**
   * Store a legacy LocalStorage row that belongs to nobody
   *
   * The Story 3.4 LocalStorage list predates accounts entirely, so there is no
   * honest owner for it: stamping it with whoever happens to be signed in when
   * the migration runs is exactly the inference this story forbids. The row is
   * written without a `userId`, which keeps it on disk and hides it from every
   * account — the same standing as a custom row written before this field
   * existed. If those rows should ever come back, that is a product decision,
   * not something a migration may make on the user's behalf.
   *
   * Deduplication lives inside this method rather than in the caller so that no
   * unowned row is ever handed out: reading them to compare texts is precisely
   * what the rest of this service exists to prevent. The check and the write
   * share one readwrite transaction, so two openers cannot both insert.
   *
   * @returns `'created'` when the row was written, `'duplicate'` when an
   *          unowned row with the same text already exists
   */
  async createUnownedIfAbsent(input: CreateMessageInput): Promise<'created' | 'duplicate'> {
    try {
      const validated = CreateMessageInputSchema.parse(input);
      await this.init();

      const normalizedText = validated.text.trim().toLowerCase();
      const tx = this.getTypedDB().transaction('messages', 'readwrite');

      const existing = await tx.store.getAll();
      const alreadyStored = existing.some(
        (row) =>
          row.isCustom === true &&
          row.userId === undefined &&
          row.text.trim().toLowerCase() === normalizedText
      );

      if (alreadyStored) {
        await tx.done;
        return 'duplicate';
      }

      // No `userId` key at all, rather than an explicit undefined: IndexedDB
      // keeps the property when it is present, and an own-property `userId`
      // reads back differently from an absent one in anything that inspects
      // the row.
      await tx.store.add({
        text: validated.text,
        category: validated.category,
        isCustom: true,
        active: validated.active ?? true,
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: validated.tags || [],
      } as Message);
      await tx.done;

      logger.debug('[CustomMessageService] Stored legacy message without an owner');
      return 'created';
    } catch (error) {
      if (isZodError(error)) {
        console.error('[CustomMessageService] Validation failed:', error.issues);
        throw createValidationError(error);
      }
      console.error('[CustomMessageService] Failed to store legacy message:', error);
      throw error;
    }
  }

  /**
   * Update a custom message the caller owns
   * AC-3.5.4: Update active field to control rotation participation
   * AC-5.5.6: Validate input at service boundary before IndexedDB write
   *
   * The ownership read and the write share ONE readwrite transaction. Checking
   * through the base class's `get` then `put` would leave an await between the
   * two, which is the same check-then-act defect one microtask wide.
   *
   * @param userId - The authenticated user. Required.
   * @param input - Fields to change, including the row id
   * @throws if the row is missing, is a shared daily row, or belongs to someone
   *         else — a write never fails silently
   */
  async updateMessage(userId: string | null, input: UpdateMessageInput): Promise<void> {
    // Queued with the mirror refresh — see accountDataQueue.ts.
    return serializeAccountDataWrite(() => this.updateMessageNow(userId, input));
  }

  private async updateMessageNow(userId: string | null, input: UpdateMessageInput): Promise<void> {
    try {
      const owner = this.requireOwner(userId, 'updateMessage');

      // Validate input at service boundary
      const validated = UpdateMessageInputSchema.parse(input);

      await this.init();

      const serverId = await this.requireSyncedRow(owner, validated.id);
      await customMessagesApi.updateCustomMessage(serverId, {
        ...(validated.text !== undefined && { text: validated.text }),
        ...(validated.category !== undefined && { category: validated.category }),
        ...(validated.active !== undefined && { active: validated.active }),
        ...(validated.tags !== undefined && { tags: validated.tags }),
      });

      const tx = this.getTypedDB().transaction('messages', 'readwrite');
      const current = await tx.store.get(validated.id);

      if (!current || !this.isOwnedBy(current, owner)) {
        await tx.done;
        // Deliberately one message for "missing" and "not yours": a caller who
        // may not touch the row also may not learn whether it exists.
        throw new Error(`Custom message ${validated.id} not found for this user`);
      }

      await tx.store.put({
        ...current,
        ...(validated.text !== undefined && { text: validated.text }),
        ...(validated.category !== undefined && { category: validated.category }),
        ...(validated.active !== undefined && { active: validated.active }),
        ...(validated.tags !== undefined && { tags: validated.tags }),
        updatedAt: new Date(),
      });
      await tx.done;

      logger.debug('[CustomMessageService] Custom message updated, id:', validated.id);
    } catch (error) {
      // Transform Zod validation errors into user-friendly messages
      if (isZodError(error)) {
        console.error('[CustomMessageService] Validation failed:', error.issues);
        throw createValidationError(error);
      }
      console.error('[CustomMessageService] Failed to update custom message:', error);
      console.error('[CustomMessageService] Input:', input);
      throw error;
    }
  }

  /**
   * The server id of a row the caller owns, or a throw.
   *
   * Read outside the write transaction on purpose: the server request sits
   * between this read and the mirror write, and an IndexedDB transaction does
   * not survive a network await. The mirror write re-checks ownership.
   */
  private async requireSyncedRow(owner: string, id: number): Promise<string> {
    const current = await this.readRow(id);
    if (!current || !this.isOwnedBy(current, owner)) {
      throw new Error(`Custom message ${id} not found for this user`);
    }
    if (!current.serverId) {
      throw new AccountDataError('not-synced', NOT_SYNCED_MESSAGE);
    }
    return current.serverId;
  }

  /**
   * One row by id, through an explicit readonly transaction whose `done` is
   * observed — the idb `db.get` shortcut leaves an aborted transaction's
   * rejection unhandled.
   */
  private async readRow(id: number): Promise<Message | undefined> {
    const tx = this.getTypedDB().transaction('messages', 'readonly');
    void tx.done.catch(() => {});
    return tx.store.get(id);
  }

  /** This account's own custom rows, through the same observed-transaction read. */
  private async readOwnedRows(owner: string): Promise<Message[]> {
    await this.init();
    const tx = this.getTypedDB().transaction('messages', 'readonly');
    void tx.done.catch(() => {});
    const rows = await tx.store.index('by-user').getAll(owner);
    return rows.filter((row) => this.isOwnedBy(row, owner));
  }

  /**
   * Delete a custom message the caller owns
   *
   * Absent rows are a no-op, as the base class's delete was, so a retry that
   * lands twice does not fail. A row that EXISTS and is not the caller's throws
   * instead: that is the cross-account case, and it must not look like success.
   *
   * @param userId - The authenticated user. Required.
   * @param id - Row id
   */
  async deleteForUser(userId: string | null, id: number): Promise<void> {
    // Queued with the mirror refresh — see accountDataQueue.ts.
    return serializeAccountDataWrite(() => this.deleteForUserNow(userId, id));
  }

  private async deleteForUserNow(userId: string | null, id: number): Promise<void> {
    try {
      const owner = this.requireOwner(userId, 'deleteForUser');

      await this.init();

      const stored = await this.readRow(id);
      if (!stored) {
        logger.debug('[CustomMessageService] Nothing to delete, id:', id);
        return;
      }
      // Server first; an already-deleted server row counts as deleted.
      await customMessagesApi.deleteCustomMessage(await this.requireSyncedRow(owner, id));

      const tx = this.getTypedDB().transaction(['messages', 'message-favorites'], 'readwrite');
      const current = await tx.objectStore('messages').get(id);

      if (!current) {
        await tx.done;
        logger.debug('[CustomMessageService] Nothing to delete, id:', id);
        return;
      }

      if (!this.isOwnedBy(current, owner)) {
        await tx.done;
        throw new Error(`Custom message ${id} not found for this user`);
      }

      await tx.objectStore('messages').delete(id);
      await tx.objectStore('message-favorites').delete([id, owner]);
      await tx.done;

      logger.debug('[CustomMessageService] Custom message deleted, id:', id);
    } catch (error) {
      console.error(`[CustomMessageService] Failed to delete custom message ${id}:`, error);
      throw error;
    }
  }

  /**
   * Replace `userId`'s mirrored custom rows with the server's.
   *
   * A row matched by `serverId` keeps its local id (the rotation history and
   * any open dialog refer to it); a server row with no local copy is added;
   * every other owned row — one the server no longer holds, or one with no
   * `serverId` — is deleted with its favorite. Legacy unowned rows and every
   * other account's rows are not touched. Favorites of these rows follow the
   * server's `is_favorite`.
   *
   * One readwrite transaction, so a reader never sees half a swap.
   */
  async replaceMirrorForUser(userId: string, rows: ServerCustomMessage[]): Promise<void> {
    const owner = this.requireOwner(userId, 'replaceMirrorForUser');
    await this.init();

    const tx = this.getTypedDB().transaction(['messages', 'message-favorites'], 'readwrite');
    // A failed request also rejects tx.done; observe both failure channels.
    void tx.done.catch(() => {});
    const messages = tx.objectStore('messages');
    const favorites = tx.objectStore('message-favorites');

    const owned = (await messages.getAll()).filter((row) => this.isOwnedBy(row, owner));
    const byServerId = new Map(
      owned.filter((row) => row.serverId).map((row) => [row.serverId as string, row])
    );
    const kept = new Set<number>();

    for (const row of rows) {
      const existing = byServerId.get(row.serverId);
      const record: Omit<Message, 'id'> = {
        text: row.text,
        category: row.category,
        isCustom: true,
        userId: owner,
        serverId: row.serverId,
        active: row.active,
        isFavorite: false, // never authoritative; `message-favorites` is
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        tags: row.tags,
      };
      let id: number;
      if (existing) {
        id = existing.id;
        await messages.put({ ...record, id });
      } else {
        id = await messages.add(record as Message);
      }
      kept.add(id);
      if (row.isFavorite) await favorites.put({ messageId: id, userId: owner });
      else await favorites.delete([id, owner]);
    }

    for (const row of owned) {
      if (kept.has(row.id)) continue;
      await messages.delete(row.id);
      await favorites.delete([row.id, owner]);
    }

    await tx.done;
    logger.debug('[CustomMessageService] Mirror replaced from server, rows:', rows.length);
  }

  /**
   * Get one message by id, if the caller may see it
   *
   * A read, so it degrades to `null` rather than throwing: another account's
   * row, a legacy unowned row and a row that does not exist are indistinguishable
   * to the caller, which is the point.
   *
   * @param userId - The authenticated user, or null when signed out
   * @param id - Row id
   */
  async getForUser(userId: string | null, id: number): Promise<Message | null> {
    try {
      if (!userId) return null;

      await this.init();

      const message = await this.getTypedDB().get('messages', id);

      if (!message || !this.isVisibleTo(message, userId)) return null;

      return (await projectMessageFavorites(this.getTypedDB(), [message], userId))[0];
    } catch (error) {
      console.error(`[CustomMessageService] Failed to get message ${id}:`, error);
      return null; // Graceful fallback
    }
  }

  /**
   * Get the messages one user may see, with optional filtering
   * AC-3.5.3: Category filter works with custom messages
   *
   * Returns the shared daily rows plus this user's own custom rows. Another
   * account's custom rows and legacy unowned rows are never included, whatever
   * the filter says.
   *
   * Signed out (`userId` null) this returns NOTHING, not the shared rows: the
   * daily rotation reads through `storageService.getAllMessages`, so failing
   * closed here costs nothing and removes the one way an unscoped read could
   * still be reached.
   *
   * @param userId - The authenticated user, or null when signed out
   * @param filter - Optional category / isCustom / active / text / tag filters
   */
  async getAllForUser(userId: string | null, filter?: MessageFilter): Promise<Message[]> {
    try {
      if (!userId) return [];

      await this.init();

      const db = this.getTypedDB();
      let messages: Message[];

      // Use index if filtering by category
      if (filter?.category && filter.category !== 'all') {
        messages = await db.getAllFromIndex('messages', 'by-category', filter.category);
      } else {
        messages = await db.getAll('messages');
      }

      // Ownership FIRST, before any caller-supplied filter can widen it
      messages = messages.filter((m) => this.isVisibleTo(m, userId));

      // Filter by isCustom
      if (filter?.isCustom !== undefined) {
        messages = messages.filter((m) => m.isCustom === filter.isCustom);
      }

      // Filter by active status
      if (filter?.active !== undefined) {
        messages = messages.filter((m) => m.active === filter.active);
      }

      // Filter by search term
      if (filter?.searchTerm) {
        const term = filter.searchTerm.toLowerCase();
        messages = messages.filter((m) => m.text.toLowerCase().includes(term));
      }

      // Filter by tags
      if (filter?.tags && filter.tags.length > 0) {
        messages = messages.filter(
          (m) => m.tags && m.tags.some((tag) => filter.tags!.includes(tag))
        );
      }

      logger.debug(
        '[CustomMessageService] Retrieved messages, count:',
        messages.length,
        'filter:',
        filter
      );
      return await projectMessageFavorites(db, messages, userId);
    } catch (error) {
      console.error('[CustomMessageService] Failed to get all messages:', error);
      console.error('[CustomMessageService] Filter:', filter);
      return []; // Graceful fallback: return empty array
    }
  }

  /**
   * Get one user's active custom messages for the rotation algorithm
   * AC-3.5.2: Only messages with active: true participate in daily rotation
   *
   * @param userId - The authenticated user, or null when signed out
   */
  async getActiveCustomMessages(userId: string | null): Promise<Message[]> {
    return this.getAllForUser(userId, { isCustom: true, active: true });
  }

  /**
   * Export one user's custom messages to JSON for backup
   * AC-3.5.6: Export functionality for backing up custom messages
   *
   * The export file carries NO owner field. It is a list of texts, and the
   * account that imports it becomes the owner of the rows it creates — an owner
   * read out of a file would be an owner the importing user never chose.
   *
   * @param userId - The authenticated user, or null when signed out
   */
  async exportMessages(userId: string | null): Promise<CustomMessagesExport> {
    try {
      const messages = await this.getAllForUser(userId, { isCustom: true });

      const exportData: CustomMessagesExport = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        messageCount: messages.length,
        messages: messages.map((m) => ({
          text: m.text,
          category: m.category,
          active: m.active ?? true,
          tags: m.tags || [],
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt?.toISOString() || m.createdAt.toISOString(),
        })),
      };

      logger.debug('[CustomMessageService] Exported messages, count:', messages.length);
      return exportData;
    } catch (error) {
      console.error('[CustomMessageService] Failed to export messages:', error);
      // Return empty export on failure
      return {
        version: '1.0',
        exportDate: new Date().toISOString(),
        messageCount: 0,
        messages: [],
      };
    }
  }

  /**
   * Import custom messages from JSON backup, owned by the importing user
   * AC-3.5.6: Import functionality with duplicate detection
   * AC-5.5.6: Validate import data structure before processing
   *
   * Duplicate detection compares against THIS user's rows only. Comparing
   * against the whole store would silently skip a message because the other
   * partner happens to have written the same sentence — which both loses the
   * import and discloses that their row exists.
   *
   * Any owner field in the file is ignored: `CustomMessagesExportSchema` is a
   * plain Zod object, so unknown keys are stripped before anything reads them.
   *
   * @param userId - The authenticated user. Required.
   * @param exportData - Parsed export file
   */
  async importMessages(
    userId: string | null,
    exportData: CustomMessagesExport
  ): Promise<{ imported: number; skipped: number }> {
    try {
      const owner = this.requireOwner(userId, 'importMessages');

      // Validate import data structure at service boundary
      const validated = CustomMessagesExportSchema.parse(exportData);

      if (validated.version !== '1.0') {
        throw new Error(`Unsupported export version: ${validated.version}`);
      }

      let importedCount = 0;
      let skippedCount = 0;

      // Get this user's existing custom message texts for duplicate detection
      const existingMessages = await this.getAllForUser(owner, { isCustom: true });
      const existingTexts = new Set(existingMessages.map((m) => m.text.trim().toLowerCase()));

      for (const msg of validated.messages) {
        const normalizedText = msg.text.trim().toLowerCase();

        if (existingTexts.has(normalizedText)) {
          skippedCount++;
          logger.debug(
            '[CustomMessageService] Skipping duplicate message:',
            msg.text.substring(0, LOG_TRUNCATE_LENGTH) + '...'
          );
        } else {
          // A fresh key per row, deliberately not one derived from the text:
          // an imported message edited since would own that key, and a
          // re-import would get the edited row back and store nothing.
          await this.create(owner, {
            text: msg.text,
            category: msg.category,
            active: msg.active,
            tags: msg.tags,
          });
          existingTexts.add(normalizedText); // Prevent duplicates within same import
          importedCount++;
        }
      }

      logger.debug(
        '[CustomMessageService] Import complete - imported:',
        importedCount,
        'skipped:',
        skippedCount
      );
      return { imported: importedCount, skipped: skippedCount };
    } catch (error) {
      // Transform Zod validation errors into user-friendly messages
      if (isZodError(error)) {
        console.error('[CustomMessageService] Import data validation failed:', error.issues);
        throw createValidationError(error);
      }
      console.error('[CustomMessageService] Failed to import messages:', error);
      console.error('[CustomMessageService] Export data:', exportData);
      throw error;
    }
  }
}

// Singleton instance
export const customMessageService = new CustomMessageService();
