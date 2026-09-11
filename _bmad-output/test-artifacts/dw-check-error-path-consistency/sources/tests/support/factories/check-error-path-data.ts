import { faker } from '@faker-js/faker';
import { checkViolation, CHECK_VIOLATION_MESSAGE } from '../check-constraint-envelopes';

/** Browser-only data: never inserted into shared worker accounts. */
export function createCheckErrorPathData() {
  return {
    friendlyCheck: CHECK_VIOLATION_MESSAGE,
    // An incidental "unique" must not send CHECK through duplicate handling.
    checkError: checkViolation({
      message: 'new row violates check constraint "dw38_unique_length_check"',
    }),
    targetId: faker.string.uuid(),
    requestId: faker.string.uuid(),
    noteId: faker.string.uuid(),
    content: `DW38 retryable message ${faker.string.uuid()}`,
    email: faker.internet.email({ provider: 'example.test' }),
    createdAt: new Date().toISOString(),
  };
}
