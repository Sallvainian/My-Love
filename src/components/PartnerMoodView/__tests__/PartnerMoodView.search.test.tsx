/**
 * PartnerMoodView's Connect screen: the exact-email partner search.
 *
 * The search runs on submit, never per keystroke, and each answer the store
 * holds renders its own state: found (the account and a Send Request button),
 * taken (a message and nothing about the account), missing (the "no account"
 * message) and error. An answer is shown only for the address still in the box.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PartnerSearchResult } from '../../../api/partnerService';

vi.mock('../../../api/supabaseClient', () => ({ supabase: {} }));
vi.mock('../../../api/moodSyncService', () => ({
  moodSyncService: { subscribeMoodUpdates: vi.fn(async () => () => {}) },
}));
vi.mock('../../PokeKissInterface', () => ({ PokeKissInterface: () => null }));
vi.mock('../../../stores/useAppStore', () => ({ useAppStore: () => state }));

import { PartnerMoodView } from '../PartnerMoodView';

const TARGET_ID = '00000000-0000-4000-8000-00000000f00d';
const EMAIL = 'jessie@example.test';

const MISSING = "No account uses that email — check it's the one they sign in with.";
const TAKEN = 'That account is already connected with a partner.';

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    partnerMoods: [],
    fetchPartnerMoods: vi.fn(async () => {}),
    syncStatus: { isOnline: true },
    partner: null,
    isLoadingPartner: false,
    partnerLoadError: false,
    sentRequests: [],
    receivedRequests: [],
    searchResult: null as PartnerSearchResult | null,
    isSearching: false,
    loadPartner: vi.fn(),
    loadPendingRequests: vi.fn(),
    searchUsers: vi.fn(async () => {}),
    clearSearch: vi.fn(),
    sendPartnerRequest: vi.fn(async () => {}),
    acceptPartnerRequest: vi.fn(),
    declinePartnerRequest: vi.fn(),
    ...overrides,
  };
}

let state = makeState();

/** Type `email` into the box and submit it with the Find button. */
async function search(email: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Your partner's email"), email);
  await user.click(screen.getByRole('button', { name: 'Find' }));
  return user;
}

describe('PartnerMoodView partner search', () => {
  beforeEach(() => {
    cleanup();
    state = makeState();
  });

  it("asks for the partner's email in an email field", () => {
    render(<PartnerMoodView />);

    const input = screen.getByLabelText("Your partner's email");
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('placeholder', "Enter your partner's email");
  });

  it('does not search while the address is being typed', async () => {
    render(<PartnerMoodView />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Your partner's email"), EMAIL);

    expect(state.searchUsers).not.toHaveBeenCalled();
  });

  it('keeps Find disabled until the box holds an email-shaped address', async () => {
    render(<PartnerMoodView />);
    const user = userEvent.setup();
    const find = screen.getByRole('button', { name: 'Find' });

    expect(find).toBeDisabled();
    await user.type(screen.getByLabelText("Your partner's email"), 'jessie');
    expect(find).toBeDisabled();
    await user.type(screen.getByLabelText("Your partner's email"), '@example.test');
    expect(find).toBeEnabled();
  });

  it('searches the trimmed address on Find, and on Enter', async () => {
    render(<PartnerMoodView />);
    const user = await search(`  ${EMAIL} `);
    expect(state.searchUsers).toHaveBeenLastCalledWith(EMAIL);

    await user.type(screen.getByLabelText("Your partner's email"), '{Enter}');
    expect(state.searchUsers).toHaveBeenCalledTimes(2);
  });

  it('found: shows the account with a Send Request button that sends to it', async () => {
    state = makeState({
      searchResult: {
        status: 'found',
        user: { id: TARGET_ID, email: EMAIL, displayName: 'Jessie' },
      },
    });
    render(<PartnerMoodView />);
    const user = await search(EMAIL);

    const results = screen.getByTestId('partner-search-results');
    expect(results).toHaveTextContent('Jessie');
    expect(results).toHaveTextContent(EMAIL);
    await user.click(screen.getByTestId(`send-request-${TARGET_ID}`));

    expect(state.sendPartnerRequest).toHaveBeenCalledWith(TARGET_ID);
    expect(screen.queryByText(MISSING)).not.toBeInTheDocument();
  });

  it('found without a chosen name: shows the address once, not a seed name', async () => {
    state = makeState({
      searchResult: { status: 'found', user: { id: TARGET_ID, email: EMAIL, displayName: null } },
    });
    render(<PartnerMoodView />);
    await search(EMAIL);

    const results = screen.getByTestId('partner-search-results');
    expect(results.textContent?.split(EMAIL)).toHaveLength(2);
  });

  it('taken: says the account is already connected, with no button and no details', async () => {
    state = makeState({ searchResult: { status: 'taken' } });
    render(<PartnerMoodView />);
    await search(EMAIL);

    expect(screen.getByTestId('partner-search-taken')).toHaveTextContent(TAKEN);
    expect(screen.queryByRole('button', { name: /send request/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('partner-search-results')).not.toBeInTheDocument();
    expect(screen.queryByText(MISSING)).not.toBeInTheDocument();
  });

  it('missing: says no account uses that email', async () => {
    state = makeState({ searchResult: { status: 'missing' } });
    render(<PartnerMoodView />);
    await search(EMAIL);

    expect(screen.getByTestId('partner-search-empty')).toHaveTextContent(MISSING);
    expect(screen.queryByText(TAKEN)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send request/i })).not.toBeInTheDocument();
  });

  it('error: says the search failed, not that there is no account', async () => {
    state = makeState({ searchResult: { status: 'error', reason: 'fetch failed' } });
    render(<PartnerMoodView />);
    await search(EMAIL);

    expect(screen.getByTestId('partner-search-error')).toHaveTextContent("Couldn't search");
    expect(screen.queryByText(MISSING)).not.toBeInTheDocument();
  });

  it('shows no answer while a search is in flight', async () => {
    state = makeState({ searchResult: { status: 'missing' } });
    const { rerender } = render(<PartnerMoodView />);
    await search(EMAIL);
    expect(screen.getByTestId('partner-search-empty')).toBeInTheDocument();

    state = { ...state, isSearching: true };
    rerender(<PartnerMoodView />);

    expect(screen.getByText('Searching...')).toBeInTheDocument();
    expect(screen.queryByTestId('partner-search-empty')).not.toBeInTheDocument();
  });

  it('drops the answer as soon as the address is edited', async () => {
    state = makeState({ searchResult: { status: 'missing' } });
    render(<PartnerMoodView />);
    const user = await search(EMAIL);
    expect(screen.getByTestId('partner-search-empty')).toBeInTheDocument();

    await user.type(screen.getByLabelText("Your partner's email"), 'm');

    expect(screen.queryByTestId('partner-search-empty')).not.toBeInTheDocument();
    expect(state.clearSearch).toHaveBeenCalled();
  });
});
