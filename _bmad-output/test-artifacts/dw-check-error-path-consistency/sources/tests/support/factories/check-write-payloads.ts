import { randomUUID } from 'node:crypto';

/** Source: photos/base-schema/remote-schema migrations; IDs belong to this test only. */
export const CHECK_WRITE_CASES = [
  { table: 'photos', constraint: 'photos_caption_check', conflict: 'storage_path' },
  {
    table: 'love_notes',
    constraint: 'love_notes_content_check',
    conflict: 'from_user_id,idempotency_key',
  },
  { table: 'partner_requests', constraint: 'no_self_requests', conflict: null },
] as const;

export type CheckWriteTable = (typeof CHECK_WRITE_CASES)[number]['table'];

/** Complete valid defaults; tests override only the value whose boundary they exercise. */
export function createCheckWritePayload(
  table: CheckWriteTable,
  userId: string,
  partnerId: string,
  overrides: Record<string, unknown> = {}
): { id: string } & Record<string, unknown> {
  const id = randomUUID();
  if (table === 'photos') {
    return {
      id,
      user_id: userId,
      storage_path: `${userId}/dw38-${id}.jpg`,
      filename: `dw38-${id}.jpg`,
      caption: 'DW-38 API metadata probe',
      mime_type: 'image/jpeg',
      file_size: 100,
      width: 1,
      height: 1,
      ...overrides,
    };
  }
  if (table === 'love_notes') {
    return {
      id,
      from_user_id: userId,
      to_user_id: partnerId,
      content: 'DW-38 API note probe',
      idempotency_key: `dw38-${id}`,
      ...overrides,
    };
  }
  return {
    id,
    from_user_id: userId,
    to_user_id: partnerId,
    status: 'pending',
    ...overrides,
  };
}
