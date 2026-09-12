import { AuthError, createClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TypedSupabaseClient } from '../../support/factories';
import { createOutsiderClient } from '../../support/helpers/rls-security';
import { TEST_USER_PASSWORD } from '../../support/test-credentials';

vi.mock('@supabase/supabase-js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@supabase/supabase-js')>()),
  createClient: vi.fn(),
}));

const userId = 'created-outsider-id';
const user = { id: userId, email: 'created-outsider@test.example.com' };
const createUser = vi.fn();
const getUserById = vi.fn();
const deleteUser = vi.fn();
const signInWithPassword = vi.fn();
const userClient = { auth: { signInWithPassword } } as unknown as ReturnType<typeof createClient>;
const supabaseAdmin = {
  auth: { admin: { createUser, getUserById, deleteUser } },
} as unknown as TypedSupabaseClient;
const cleanupResponse = { data: { user }, error: null };

describe('createOutsiderClient', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://supabase.example.com');
    vi.stubEnv('SUPABASE_ANON_KEY', 'unit-test-anon-key');
    createUser.mockResolvedValue({ data: { user }, error: null });
    getUserById.mockResolvedValue({ data: { user }, error: null });
    signInWithPassword.mockResolvedValue({ error: null });
    deleteUser.mockResolvedValue(cleanupResponse);
    vi.mocked(createClient).mockReturnValue(userClient);
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns the authenticated client and account cleanup without eager deletion', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(123456789);

    const outsider = await createOutsiderClient(supabaseAdmin, 'security');

    expect(createUser).toHaveBeenCalledExactlyOnceWith({
      email: 'security-123456789@test.example.com',
      password: TEST_USER_PASSWORD,
      email_confirm: true,
    });
    expect(getUserById).toHaveBeenCalledExactlyOnceWith(userId);
    expect(createClient).toHaveBeenCalledExactlyOnceWith(
      'https://supabase.example.com',
      'unit-test-anon-key'
    );
    expect(signInWithPassword).toHaveBeenCalledExactlyOnceWith({
      email: user.email,
      password: TEST_USER_PASSWORD,
    });
    expect(outsider.client).toBe(userClient);
    expect(outsider.userId).toBe(userId);
    expect(outsider.cleanup).toBeTypeOf('function');
    expect(deleteUser).not.toHaveBeenCalled();

    await expect(outsider.cleanup()).resolves.toBe(cleanupResponse);
    expect(deleteUser).toHaveBeenCalledExactlyOnceWith(userId);
  });

  it('forwards returned cleanup errors after successful setup without changing the response', async () => {
    const response = { data: { user: null }, error: new AuthError('Deletion denied') };
    deleteUser.mockResolvedValueOnce(response);

    const outsider = await createOutsiderClient(supabaseAdmin);

    expect(deleteUser).not.toHaveBeenCalled();
    await expect(outsider.cleanup()).resolves.toBe(response);
    expect(deleteUser).toHaveBeenCalledExactlyOnceWith(userId);
  });

  it('forwards cleanup rejections after successful setup unchanged', async () => {
    const cleanupFailure = new Error('Deletion request failed');
    deleteUser.mockRejectedValueOnce(cleanupFailure);

    const outsider = await createOutsiderClient(supabaseAdmin);

    expect(deleteUser).not.toHaveBeenCalled();
    await expect(outsider.cleanup()).rejects.toBe(cleanupFailure);
    expect(deleteUser).toHaveBeenCalledExactlyOnceWith(userId);
  });

  it.each(['user lookup', 'client construction', 'sign-in'] as const)(
    'preserves the exact %s failure when cleanup succeeds',
    async (stage) => {
      const setupFailure = new Error(`${stage} failed`);
      if (stage === 'user lookup') {
        getUserById.mockRejectedValueOnce(setupFailure);
      } else if (stage === 'client construction') {
        vi.mocked(createClient).mockImplementationOnce(() => {
          throw setupFailure;
        });
      } else {
        signInWithPassword.mockRejectedValueOnce(setupFailure);
      }

      await expect(createOutsiderClient(supabaseAdmin)).rejects.toBe(setupFailure);

      expect(deleteUser).toHaveBeenCalledExactlyOnceWith(userId);
    }
  );

  describe.each([
    ['user lookup', getUserById, `Failed to get user ${userId}`],
    ['sign-in', signInWithPassword, `Failed to sign in as ${userId}`],
  ] as const)('returned %s AuthError', (_stage, setupMethod, setupMessagePrefix) => {
    const authFailure = new AuthError('Authentication denied', 403);
    const setupMessage = `${setupMessagePrefix}: ${authFailure.message}`;

    beforeEach(() => {
      setupMethod.mockResolvedValueOnce({ data: { user: null }, error: authFailure });
    });

    it('preserves the setup wrapper when cleanup succeeds', async () => {
      const failure = await createOutsiderClient(supabaseAdmin).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(Error);
      expect(failure).not.toBeInstanceOf(AggregateError);
      expect(failure).not.toBe(authFailure);
      expect(failure).toHaveProperty('message', setupMessage);
      expect(deleteUser).toHaveBeenCalledExactlyOnceWith(userId);
    });

    it.each([
      ['returned AuthError', new AuthError('Account deletion denied', 403), 'Account deletion denied'],
      ['rejected non-Error', 'Deletion transport unavailable', 'Deletion transport unavailable'],
    ])(
      'reports the setup wrapper and %s cleanup failure',
      async (channel, cleanupFailure, cleanupMessage) => {
        if (channel === 'returned AuthError') {
          deleteUser.mockResolvedValueOnce({ data: { user: null }, error: cleanupFailure });
        } else {
          deleteUser.mockRejectedValueOnce(cleanupFailure);
        }

        const failure = await createOutsiderClient(supabaseAdmin).catch((error: unknown) => error);

        expect(failure).toBeInstanceOf(AggregateError);
        const aggregate = failure as AggregateError;
        expect(aggregate.message).toContain(userId);
        expect(aggregate.message).toContain(setupMessage);
        expect(aggregate.message).toContain(cleanupMessage);
        expect(aggregate.errors).toHaveLength(2);
        expect(aggregate.errors[0]).toBeInstanceOf(Error);
        expect(aggregate.errors[0]).not.toBe(authFailure);
        expect(aggregate.errors[0]).toHaveProperty('message', setupMessage);
        expect(aggregate.errors[1]).toBe(cleanupFailure);
        expect(aggregate.cause).toBe(cleanupFailure);
        expect(deleteUser).toHaveBeenCalledExactlyOnceWith(userId);
      }
    );
  });

  it('waits for cleanup to finish before rejecting with the original setup failure', async () => {
    const setupFailure = new Error('Sign-in request failed');
    signInWithPassword.mockRejectedValueOnce(setupFailure);
    let finishCleanup!: (response: typeof cleanupResponse) => void;
    const pendingCleanup = new Promise<typeof cleanupResponse>((resolve) => {
      finishCleanup = resolve;
    });
    let signalCleanupStarted!: () => void;
    const cleanupStarted = new Promise<void>((resolve) => {
      signalCleanupStarted = resolve;
    });
    deleteUser.mockImplementationOnce(() => {
      signalCleanupStarted();
      return pendingCleanup;
    });
    const settled = vi.fn();
    const outsider = createOutsiderClient(supabaseAdmin);
    void outsider.then(settled, settled);

    await cleanupStarted;
    // Let all queued promise reactions run while the deletion remains pending.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(settled).not.toHaveBeenCalled();
    expect(deleteUser).toHaveBeenCalledExactlyOnceWith(userId);

    finishCleanup(cleanupResponse);
    await expect(outsider).rejects.toBe(setupFailure);
    expect(settled).toHaveBeenCalledExactlyOnceWith(setupFailure);
    expect(deleteUser).toHaveBeenCalledExactlyOnceWith(userId);
  });

  it('preserves setup and returned AuthError failures in account-specific diagnostics', async () => {
    const setupFailure = new Error('Sign-in request failed');
    const cleanupFailure = new AuthError('Account deletion denied', 403);
    signInWithPassword.mockRejectedValueOnce(setupFailure);
    deleteUser.mockResolvedValueOnce({ data: { user: null }, error: cleanupFailure });

    const failure = await createOutsiderClient(supabaseAdmin).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AggregateError);
    const aggregate = failure as AggregateError;
    expect(aggregate.message).toContain(userId);
    expect(aggregate.message).toContain(setupFailure.message);
    expect(aggregate.message).toContain(cleanupFailure.message);
    expect(aggregate.errors).toHaveLength(2);
    expect(aggregate.errors[0]).toBe(setupFailure);
    expect(aggregate.errors[1]).toBe(cleanupFailure);
    expect(aggregate.cause).toBe(cleanupFailure);
    expect(deleteUser).toHaveBeenCalledExactlyOnceWith(userId);
  });

  it.each([
    ['Error', new Error('Deletion request failed'), 'Error: Deletion request failed'],
    ['object', { reason: 'Deletion request failed' }, '{"reason":"Deletion request failed"}'],
    ['string', 'Deletion request failed', '"Deletion request failed"'],
    ['undefined', undefined, 'undefined'],
    ['null', null, 'null'],
    ['false', false, 'false'],
    ['zero', 0, '0'],
    ['empty string', '', '""'],
  ])(
    'preserves setup and thrown %s cleanup failures in order',
    async (_label, cleanupFailure, cleanupMessage) => {
      const setupFailure = new Error('Sign-in request failed');
      signInWithPassword.mockRejectedValueOnce(setupFailure);
      deleteUser.mockRejectedValueOnce(cleanupFailure);

      const failure = await createOutsiderClient(supabaseAdmin).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(AggregateError);
      const aggregate = failure as AggregateError;
      expect(aggregate.message).toContain(userId);
      expect(aggregate.message).toContain(setupFailure.message);
      expect(aggregate.message).toContain(`Cleanup: ${cleanupMessage}`);
      expect(aggregate.errors).toHaveLength(2);
      expect(aggregate.errors[0]).toBe(setupFailure);
      expect(aggregate.errors[1]).toBe(cleanupFailure);
      expect(aggregate.cause).toBe(cleanupFailure);
      expect(deleteUser).toHaveBeenCalledExactlyOnceWith(userId);
    }
  );

  it.each([
    ['returned error', { data: { user }, error: new AuthError('Creation denied') }, 'Creation denied'],
    ['missing user', { data: { user: null }, error: null }, 'no user in response'],
    ['missing data', { data: null, error: null }, 'no user in response'],
  ])('skips setup and cleanup after creation returns %s', async (_label, response, message) => {
    createUser.mockResolvedValueOnce(response);

    await expect(createOutsiderClient(supabaseAdmin)).rejects.toThrow(
      `Failed to create outsider user: ${message}`
    );

    expect(createUser).toHaveBeenCalledTimes(1);
    expect(getUserById).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('preserves creation rejection and skips setup and cleanup', async () => {
    const creationFailure = new Error('Creation request failed');
    createUser.mockRejectedValueOnce(creationFailure);

    await expect(createOutsiderClient(supabaseAdmin)).rejects.toBe(creationFailure);

    expect(createUser).toHaveBeenCalledTimes(1);
    expect(getUserById).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
