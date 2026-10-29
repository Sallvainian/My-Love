import { faker } from '@faker-js/faker';
import { checkViolation, CHECK_VIOLATION_MESSAGE } from '../check-constraint-envelopes';

const CONSTRAINT_NAME = 'dw38_unique_length_check';
const ROW_PREFIX = 'new row';

/**
 * Fragments of the raw CHECK message `createCheckErrorPathData()` builds,
 * none of which may reach the friendly copy shown to the user.
 */
export const CHECK_ERROR_LEAK_FRAGMENTS = [CONSTRAINT_NAME, ROW_PREFIX] as const;

/** Browser-only data: never inserted into shared worker accounts. */
export function createCheckErrorPathData() {
  return {
    friendlyCheck: CHECK_VIOLATION_MESSAGE,
    // An incidental "unique" must not send CHECK through duplicate handling.
    checkError: checkViolation({
      message: `${ROW_PREFIX} violates check constraint "${CONSTRAINT_NAME}"`,
    }),
    targetId: faker.string.uuid(),
    requestId: faker.string.uuid(),
    noteId: faker.string.uuid(),
    content: `DW38 retryable message ${faker.string.uuid()}`,
    email: faker.internet.email({ provider: 'example.test' }),
    createdAt: new Date().toISOString(),
  };
}
