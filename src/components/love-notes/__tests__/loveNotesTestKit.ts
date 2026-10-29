/** Shared helpers for the `LoveNotes` component tests. */
import { act, waitFor } from '@testing-library/react';
import { expect } from 'vitest';

/** A mocked function as far as `settleNameLookups` reads it. */
interface LookupMock {
  mock: { results: Array<{ value: unknown }> };
}

/** The three name-lookup mocks a test hands `LoveNotes` through `vi.mock`. */
export interface NameLookupMocks {
  getOwnDisplayName: LookupMock;
  getUser: LookupMock;
  getPartnerDisplayName: LookupMock;
}

/**
 * Wait until the mount effect's name lookups have answered and their state is
 * applied. The fallbacks equal LoveNotes' initial state, so a fallback asserted
 * any earlier passes before the behaviour has run. The own-name branch
 * (`getOwnDisplayName` with `getUser`) settles first; `getPartnerDisplayName`
 * is asked only when both of those fulfilled, so a rejected own-name read
 * settles the effect without it rather than timing out on the partner lookup.
 */
export async function settleNameLookups(api: NameLookupMocks): Promise<void> {
  const settle = (lookups: LookupMock[]) =>
    act(async () =>
      Promise.allSettled(
        lookups.flatMap((lookup) => lookup.mock.results.map((result) => result.value))
      )
    );

  await waitFor(() => {
    expect(api.getOwnDisplayName).toHaveBeenCalled();
    expect(api.getUser).toHaveBeenCalled();
  });
  const ownName = await settle([api.getOwnDisplayName, api.getUser]);
  if (ownName.some((result) => result.status === 'rejected')) return;

  await waitFor(() => expect(api.getPartnerDisplayName).toHaveBeenCalled());
  await settle([api.getPartnerDisplayName]);
}
