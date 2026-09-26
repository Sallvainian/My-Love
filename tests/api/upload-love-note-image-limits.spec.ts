/**
 * F10 (CAP-10): the `upload-love-note-image` Edge Function's request bound,
 * over the wire against the local stack.
 *
 * `supabase/functions/upload-love-note-image/handler.test.ts` proves the
 * mechanism — that the decision is taken from headers, that nothing past the
 * cap is ever retained, that Storage is never called on a refusal. It does so
 * against a fake client and a synthetic stream. This file proves the other
 * half: that the same statuses survive Kong, the edge runtime and real Supabase
 * Storage, and that a refused request leaves the uploader's bucket prefix
 * exactly as it found it.
 *
 * Every case lists the prefix before and after. A 413 that nevertheless wrote
 * an object would otherwise pass on the status code alone, which is precisely
 * the failure F10 is about.
 *
 * Requires `supabase start`; the function is served at
 * `${SUPABASE_URL}/functions/v1/upload-love-note-image` by `[edge_runtime]`
 * in `supabase/config.toml`.
 *
 * Only this worker's own account is touched, and only objects this spec created
 * are deleted — the prefix is `<uid>/`, which no other worker can write to.
 */
import { log } from '@seontechnologies/playwright-utils';
import type { TypedSupabaseClient } from '../support/factories';
import { resolveOwnPair } from '../support/helpers/events';
import { test, expect } from '../support/merged-fixtures';

const FUNCTION_PATH = '/functions/v1/upload-love-note-image';
const BUCKET = 'love-notes-images';

/** Mirrors `CONFIG.MAX_FILE_SIZE_BYTES` in the function. */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** The function's JSON answer: the stored object on success, `error` on a refusal. */
type UploadReply = { storagePath?: string; size?: number; error?: string; maxSize?: number };

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** A body the function's magic-byte check accepts, padded to `totalSize`. */
function pngBody(totalSize: number): Buffer {
  const body = Buffer.alloc(totalSize);
  PNG_MAGIC.copy(body, 0, 0, Math.min(PNG_MAGIC.length, totalSize));
  return body;
}

/** Object names directly under this account's own prefix. */
async function listOwnPrefix(
  supabaseAdmin: TypedSupabaseClient,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .list(userId, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

  if (error) {
    throw new Error(`Failed to list ${BUCKET}/${userId}: ${error.message}`);
  }
  return (data ?? []).map((object) => object.name);
}

/**
 * The `storagePath` in a response body, or null when the body is not JSON or
 * names none. Never throws, so it can run before any assertion.
 */
function storagePathOf(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { storagePath?: unknown };
    return typeof parsed.storagePath === 'string' ? parsed.storagePath : null;
  } catch {
    return null;
  }
}

/**
 * Teardown: remove the objects a test created. It runs from `finally`, so a
 * failure is recorded with `expect.soft` rather than thrown — a throw there
 * would replace the test's own error and skip the steps after it.
 */
async function removeObjects(
  supabaseAdmin: TypedSupabaseClient,
  paths: string[]
): Promise<void> {
  if (paths.length === 0) return;
  const what = `Failed to clean up ${paths.join(', ')}`;
  try {
    const { error } = await supabaseAdmin.storage.from(BUCKET).remove(paths);
    expect.soft(error, what).toBeNull();
  } catch (error) {
    expect.soft(error, what).toBeUndefined();
  }
}

test.describe('Love note image upload limits', () => {
  test('[P0] a supported octet-stream upload is accepted under the uploader prefix', async ({
    request,
    authToken,
    supabaseAdmin,
  }) => {
    const { userId } = await resolveOwnPair(supabaseAdmin);
    const before = await listOwnPrefix(supabaseAdmin, userId);
    const created: string[] = [];

    try {
      // playwright-utils deviation: apiRequest returns no response headers, and this case asserts x-ratelimit-remaining.
      const response = await request.post(FUNCTION_PATH, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/octet-stream',
        },
        data: pngBody(64 * 1024),
      });

      expect(response.status(), 'a supported upload is accepted').toBe(200);
      const body = await response.json();
      // Registered for cleanup before any assertion can throw: a failure after
      // a 200 would otherwise leak the object into this worker's prefix and
      // skew the before/after counts of every later case.
      if (body.storagePath) created.push(body.storagePath);

      expect(body.success).toBe(true);
      expect(body.size).toBe(64 * 1024);
      expect(body.mimeType).toBe('image/png');
      expect(
        body.storagePath.startsWith(`${userId}/`),
        `storagePath ${body.storagePath} must be under the uploader's own prefix`
      ).toBe(true);
      expect(response.headers()['x-ratelimit-remaining']).toBeDefined();

      const after = await listOwnPrefix(supabaseAdmin, userId);
      expect(after.length, 'exactly one object was written').toBe(before.length + 1);
      expect(after).toContain(body.storagePath.slice(`${userId}/`.length));
    } finally {
      await removeObjects(supabaseAdmin, created);
    }
  });

  test('[P0] a body at exactly the cap is accepted', async ({
    apiRequest,
    authToken,
    supabaseAdmin,
  }) => {
    const { userId } = await resolveOwnPair(supabaseAdmin);
    const before = await listOwnPrefix(supabaseAdmin, userId);
    const created: string[] = [];

    try {
      const { status, body } = await apiRequest<UploadReply>({
        method: 'POST',
        path: FUNCTION_PATH,
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/octet-stream',
        },
        body: pngBody(MAX_FILE_SIZE_BYTES),
        retryConfig: { maxRetries: 0 },
      });

      expect(status, 'the cap itself is inclusive').toBe(200);
      // Registered for cleanup before any assertion can throw: a failure after
      // a 200 would otherwise leak the object into this worker's prefix and
      // skew the before/after counts of every later case.
      if (body.storagePath) created.push(body.storagePath);

      expect(body.size).toBe(MAX_FILE_SIZE_BYTES);

      const after = await listOwnPrefix(supabaseAdmin, userId);
      expect(after.length).toBe(before.length + 1);
    } finally {
      await removeObjects(supabaseAdmin, created);
    }
  });

  test('[P0] one byte past the cap is refused with 413 and writes nothing', async ({
    apiRequest,
    authToken,
    supabaseAdmin,
  }) => {
    const { userId } = await resolveOwnPair(supabaseAdmin);
    const before = await listOwnPrefix(supabaseAdmin, userId);

    const { status, body } = await apiRequest<UploadReply>({
      method: 'POST',
      path: FUNCTION_PATH,
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/octet-stream',
      },
      body: pngBody(MAX_FILE_SIZE_BYTES + 1),
      retryConfig: { maxRetries: 0 },
    });

    expect(status, 'one byte past the cap is refused').toBe(413);
    expect(body.error).toBe('File too large');
    expect(body.maxSize).toBe(MAX_FILE_SIZE_BYTES);

    const after = await listOwnPrefix(supabaseAdmin, userId);
    expect(after, 'a refused upload writes no object').toEqual(before);
  });

  test('[P0] multipart/form-data is refused with 415 and writes nothing', async ({
    apiRequest,
    authToken,
    supabaseAdmin,
  }) => {
    const { userId } = await resolveOwnPair(supabaseAdmin);
    const before = await listOwnPrefix(supabaseAdmin, userId);

    // Built by hand rather than through Playwright's `multipart` option: the
    // api project sets a global `Content-Type: application/json`, and the point
    // of the case is the exact Content-Type the function sees.
    const boundary = '----MyLoveUploadLimitsBoundary';
    const multipartBody = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
          'Content-Disposition: form-data; name="file"; filename="photo.png"\r\n' +
          'Content-Type: image/png\r\n\r\n'
      ),
      pngBody(1024),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const { status, body } = await apiRequest<UploadReply>({
      method: 'POST',
      path: FUNCTION_PATH,
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBody,
      retryConfig: { maxRetries: 0 },
    });

    expect(status, 'the unused multipart format is rejected').toBe(415);
    expect(body.error).toBe('Unsupported media type');

    const after = await listOwnPrefix(supabaseAdmin, userId);
    expect(after, 'a refused format writes no object').toEqual(before);
  });

  test('[P0] an unauthenticated request is refused with 401 and writes nothing', async ({
    apiRequest,
    supabaseAdmin,
  }) => {
    const { userId } = await resolveOwnPair(supabaseAdmin);
    const before = await listOwnPrefix(supabaseAdmin, userId);

    const { status, body } = await apiRequest<UploadReply>({
      method: 'POST',
      path: FUNCTION_PATH,
      headers: { 'Content-Type': 'application/octet-stream' },
      body: pngBody(1024),
      retryConfig: { maxRetries: 0 },
    });

    expect(status, 'no bearer token, no upload').toBe(401);
    expect(body.error).toBe('Missing authorization header');

    const after = await listOwnPrefix(supabaseAdmin, userId);
    expect(after).toEqual(before);
  });

  /**
   * The 411 in the handler rests on `SPEC.md`'s assumption that real traffic
   * carries `Content-Length`. This is the measurement behind it: a real browser
   * posting a `Blob`, in the exact shape of `loveNoteImageService.ts:139-145`
   * (Authorization + `application/octet-stream`, no apikey, no hand-set length),
   * through Kong to the function. A 411 here would mean the header does not
   * survive the real path and the contract has to be revisited — which is why
   * this asserts the 200 rather than just "not 411": the body only reaches the
   * magic-byte check if the length arrived intact.
   */
  test('[P1] a browser Blob upload carries Content-Length through to the function', async ({
    browser,
    authToken,
    supabaseAdmin,
  }) => {
    const { userId } = await resolveOwnPair(supabaseAdmin);
    const functionUrl = `${process.env.SUPABASE_URL}${FUNCTION_PATH}`;
    const context = await browser.newContext();
    const page = await context.newPage();
    const created: string[] = [];

    try {
      // Any document on the dev server's origin will do — what is being measured
      // is the browser's own framing of a Blob body, not the page.
      await page.goto('http://localhost:5173/');

      const result = await page.evaluate(
        async ({ url, token }) => {
          const bytes = new Uint8Array(4096);
          bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
          const blob = new Blob([bytes], { type: 'image/png' });

          // playwright-utils deviation: the browser's own fetch of a Blob is what is measured; apiRequest runs in Node and frames the body itself.
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/octet-stream',
            },
            body: blob,
          });

          return { status: response.status, body: await response.text() };
        },
        { url: functionUrl, token: authToken }
      );
      // Registered for cleanup before any assertion can throw: a failure after
      // a 200 would otherwise leak the object into this worker's prefix.
      const storagePath = storagePathOf(result.body);
      if (storagePath) created.push(storagePath);

      await log.step(`browser Blob upload answered ${result.status}`);
      expect(
        result.status,
        `411 would mean the browser sent no Content-Length; got ${result.body}`
      ).not.toBe(411);
      expect(result.status, 'the blob reached the magic-byte check intact').toBe(200);

      const parsed = JSON.parse(result.body) as { storagePath: string; size: number };
      expect(parsed.size).toBe(4096);
      expect(parsed.storagePath.startsWith(`${userId}/`)).toBe(true);
    } finally {
      // Objects first: a context that fails to close must not skip their
      // removal, and the removal records rather than throws, so the close runs.
      await removeObjects(supabaseAdmin, created);
      await context.close().catch(() => {});
    }
  });
});
