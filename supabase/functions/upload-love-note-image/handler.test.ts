/**
 * `deno test` coverage for the bounded upload handler (CAP-10 / F10).
 *
 * Run with:
 *   deno test supabase/functions/upload-love-note-image/
 *
 * These cases assert *mechanism*, not only status codes. A handler that
 * buffered the whole body and then returned 413 would pass a status-only test
 * while leaving the finding open, so every rejection row also asserts:
 *
 * - `pulls` — how many times the body stream was actually pumped, which is what
 *   separates a header-only decision (zero) from a bounded discard.
 * - `cancels` — that the reader is let go rather than pumped forever once the
 *   discard ceiling is reached.
 * - `uploadCalls` — that nothing reached Storage. This is also the only place a
 *   retained buffer could surface, since the handler keeps no other handle on
 *   the bytes it read.
 *
 * The Supabase client is injected as a fake, so nothing here touches the
 * network: `handler.ts` deliberately imports no remote module.
 */

import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import { CONFIG, handleUpload, type UploadDeps } from './handler.ts';

const ENDPOINT = 'http://localhost/functions/v1/upload-love-note-image';
const MAX = CONFIG.MAX_FILE_SIZE_BYTES;

/** PNG magic bytes — what `detectMimeType` looks for. */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Backed by an explicit `ArrayBuffer` rather than `new Uint8Array(n)`, whose
 * inferred `ArrayBufferLike` buffer is not a `BodyInit` — these bytes are
 * handed straight to `new Request` in the non-stream cases.
 */
function pngBytes(totalSize: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(totalSize));
  bytes.set(PNG_MAGIC.slice(0, Math.min(PNG_MAGIC.length, totalSize)));
  return bytes;
}

interface FakeClient {
  deps: UploadDeps;
  /** Every `storage.from(bucket).upload(...)` call, in order. */
  uploadCalls: Array<{ bucket: string; path: string; size: number; contentType: string }>;
  /** Authorization headers the factory was handed. */
  authHeaders: string[];
  userId: string;
}

function fakeClient(
  options: { userId?: string; authFails?: boolean; uploadError?: string } = {}
): FakeClient {
  const userId = options.userId ?? crypto.randomUUID();
  const uploadCalls: FakeClient['uploadCalls'] = [];
  const authHeaders: string[] = [];

  const deps: UploadDeps = {
    createClient(authHeader) {
      authHeaders.push(authHeader);
      return {
        auth: {
          getUser: () =>
            Promise.resolve(
              options.authFails
                ? { data: { user: null }, error: { message: 'invalid JWT' } }
                : { data: { user: { id: userId } }, error: null }
            ),
        },
        storage: {
          from(bucket: string) {
            return {
              upload(path, body, uploadOptions) {
                uploadCalls.push({
                  bucket,
                  path,
                  size: body.byteLength,
                  contentType: uploadOptions.contentType,
                });
                return Promise.resolve({
                  error: options.uploadError ? { message: options.uploadError } : null,
                });
              },
            };
          },
        },
      };
    },
  };

  return { deps, uploadCalls, authHeaders, userId };
}

interface CountedStream {
  stream: ReadableStream<Uint8Array>;
  counts: { pulls: number; cancels: number };
}

/**
 * A body stream that reports how often it was pumped and cancelled.
 *
 * `failAfter` makes the stream error once that many chunks have been handed
 * out, which is how a client disconnecting mid-upload reaches the handler.
 *
 * `highWaterMark: 0` is load-bearing: with the default strategy of 1 a stream
 * pulls its first chunk eagerly at construction, so `pulls === 0` would be
 * unobservable and "the body was never read" untestable.
 */
function countedStream(chunks: Uint8Array[], failAfter?: number): CountedStream {
  const counts = { pulls: 0, cancels: 0 };
  let index = 0;

  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        counts.pulls++;
        if (failAfter !== undefined && index >= failAfter) {
          controller.error(new Error('connection reset by peer'));
          return;
        }
        if (index >= chunks.length) {
          controller.close();
          return;
        }
        controller.enqueue(chunks[index++]);
      },
      cancel() {
        counts.cancels++;
      },
    },
    new CountQueuingStrategy({ highWaterMark: 0 })
  );

  return { stream, counts };
}

function chunked(bytes: Uint8Array, chunkSize: number): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    chunks.push(bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength)));
  }
  return chunks;
}

function uploadRequest(
  init: {
    body?: BodyInit | null;
    contentLength?: string | null;
    contentType?: string | null;
    authorization?: string | null;
    method?: string;
  } = {}
): Request {
  const headers = new Headers();
  if (init.authorization !== null) {
    headers.set('Authorization', init.authorization ?? 'Bearer test-token');
  }
  if (init.contentType !== null) {
    headers.set('Content-Type', init.contentType ?? 'application/octet-stream');
  }
  if (init.contentLength !== null && init.contentLength !== undefined) {
    headers.set('Content-Length', init.contentLength);
  }
  return new Request(ENDPOINT, {
    method: init.method ?? 'POST',
    headers,
    body: init.body ?? null,
  });
}

/** Run `fn` with `console.error` captured, so "logged once" is assertable. */
async function withCapturedErrors<T>(fn: () => Promise<T>): Promise<{ result: T; logs: string[] }> {
  const logs: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    logs.push(args.map((a) => String(a)).join(' '));
  };
  try {
    const result = await fn();
    return { result, logs };
  } finally {
    console.error = original;
  }
}

// ---------------------------------------------------------------------------
// Declared length — every one of these is decided from headers alone
// ---------------------------------------------------------------------------

Deno.test('an over-limit Content-Length is refused with no body present at all', async () => {
  // The strongest statement that the decision is header-only: there is nothing
  // to read, and the refusal is still the right one.
  const client = fakeClient();

  const response = await handleUpload(
    uploadRequest({ body: null, contentLength: String(MAX + 1) }),
    client.deps
  );

  assertEquals(response.status, 413);
  const body = await response.json();
  assertEquals(body.error, 'File too large');
  assertEquals(body.maxSize, MAX);
  assertEquals(body.actualSize, MAX + 1);
  assertStringIncludes(body.message, '5MB');
  assertEquals(client.uploadCalls.length, 0);
});

Deno.test('an over-limit body is discarded rather than retained', async () => {
  const client = fakeClient();
  const chunkSize = 64 * 1024;
  const declared = 8 * 1024 * 1024;
  const chunks = chunked(pngBytes(declared), chunkSize);
  const { stream, counts } = countedStream(chunks);

  const response = await handleUpload(
    uploadRequest({ body: stream, contentLength: String(declared) }),
    client.deps
  );

  assertEquals(response.status, 413);
  assertEquals((await response.json()).error, 'File too large');
  // Drained to completion so the status can be delivered, then released. The
  // fake client records the only place a retained buffer could have gone.
  assertEquals(counts.pulls, chunks.length + 1);
  assertEquals(counts.cancels, 0, 'a fully-consumed stream is already closed');
  assertEquals(client.uploadCalls.length, 0);
});

Deno.test('the discard stops at MAX_DISCARD_BYTES rather than running forever', async () => {
  const client = fakeClient();
  const chunkSize = 256 * 1024;
  // Far more body than the discard ceiling: the handler must give up on it.
  const chunks = chunked(pngBytes(CONFIG.MAX_DISCARD_BYTES + 4 * chunkSize), chunkSize);
  const { stream, counts } = countedStream(chunks);

  const response = await handleUpload(
    uploadRequest({ body: stream, contentLength: String(CONFIG.MAX_DISCARD_BYTES) }),
    client.deps
  );

  assertEquals(response.status, 413);
  assertEquals(counts.pulls, CONFIG.MAX_DISCARD_BYTES / chunkSize);
  assertEquals(counts.cancels, 1, 'the reader is cancelled once the ceiling is hit');
  assertEquals(client.uploadCalls.length, 0);
});

Deno.test('a declaration past the discard ceiling is refused without any read', async () => {
  const client = fakeClient();
  const { stream, counts } = countedStream([pngBytes(1024)]);

  const response = await handleUpload(
    uploadRequest({ body: stream, contentLength: String(CONFIG.MAX_DISCARD_BYTES + 1) }),
    client.deps
  );

  assertEquals(response.status, 413);
  assertEquals(counts.pulls, 0, 'an absurd declaration costs one header read');
  assertEquals(counts.cancels, 0);
  assertEquals(client.uploadCalls.length, 0);
});

Deno.test('an absent Content-Length is refused with 411', async () => {
  const client = fakeClient();
  const { stream, counts } = countedStream([pngBytes(1024)]);

  const response = await handleUpload(
    uploadRequest({ body: stream, contentLength: null }),
    client.deps
  );

  assertEquals(response.status, 411);
  assertEquals((await response.json()).error, 'Length required');
  assertEquals(counts.pulls, 0);
  assertEquals(client.uploadCalls.length, 0);
});

// `' 100'` is deliberately absent: `Headers` strips leading and trailing OWS at
// `set()` time, so the handler only ever sees `'100'` and there is no such input
// to reject.
for (const declared of ['abc', '-1', '1.5', '', '+100', '0x10', '1e3', '5 1']) {
  Deno.test(`a non-integer Content-Length (${JSON.stringify(declared)}) is refused with 400`, async () => {
    const client = fakeClient();
    const { stream, counts } = countedStream([pngBytes(1024)]);

    const response = await handleUpload(
      uploadRequest({ body: stream, contentLength: declared }),
      client.deps
    );

    assertEquals(response.status, 400);
    assertEquals((await response.json()).error, 'Invalid Content-Length');
    assertEquals(counts.pulls, 0);
    assertEquals(client.uploadCalls.length, 0);
  });
}

Deno.test('a Content-Length past the safe integer range is refused with 400', async () => {
  const client = fakeClient();
  const { stream, counts } = countedStream([pngBytes(1024)]);

  const response = await handleUpload(
    uploadRequest({ body: stream, contentLength: '99999999999999999999' }),
    client.deps
  );

  assertEquals(response.status, 400);
  assertEquals(counts.pulls, 0);
  assertEquals(client.uploadCalls.length, 0);
});

// ---------------------------------------------------------------------------
// Streaming — the header is not trusted
// ---------------------------------------------------------------------------

Deno.test('a header that lies small is still stopped by the cap, not by the header', async () => {
  const client = fakeClient();
  const chunkSize = 64 * 1024;
  // 6 MiB of body behind a `Content-Length: 10`. The declared length is under
  // the cap, so nothing rejects this up front — only the running total can.
  const chunks = chunked(pngBytes(6 * 1024 * 1024), chunkSize);
  const { stream, counts } = countedStream(chunks);

  const response = await handleUpload(
    uploadRequest({ body: stream, contentLength: '10' }),
    client.deps
  );

  assertEquals(response.status, 413);
  const body = await response.json();
  assertEquals(body.error, 'File too large');
  assertEquals(body.maxSize, MAX);

  // Retention stopped at the cap: the handler released its chunks at
  // MAX + one chunk and everything pumped afterwards was thrown away, which is
  // why the remaining pulls cost no memory. 6 MiB is under MAX_DISCARD_BYTES,
  // so the drain runs to completion and the stream closes itself.
  assertEquals(counts.pulls, chunks.length + 1);
  assertEquals(counts.cancels, 0);
  assertEquals(client.uploadCalls.length, 0);
});

Deno.test('the overflowing chunk itself is never retained', async () => {
  const client = fakeClient();
  // One byte short of the cap, then a chunk that crosses it. If the handler
  // pushed before checking, it would be holding that second chunk.
  const chunks = [pngBytes(MAX - 1), new Uint8Array(new ArrayBuffer(1024))];
  const { stream, counts } = countedStream(chunks);

  const response = await handleUpload(
    uploadRequest({ body: stream, contentLength: String(MAX) }),
    client.deps
  );

  assertEquals(response.status, 413);
  assertEquals(counts.pulls, 3, 'two chunks, then the close');
  assertEquals(client.uploadCalls.length, 0);
});

Deno.test('a body that ends short of its declared length is refused with 400', async () => {
  const client = fakeClient();
  const { stream } = countedStream(chunked(pngBytes(100 * 1024), 32 * 1024));

  const response = await handleUpload(
    uploadRequest({ body: stream, contentLength: String(1024 * 1024) }),
    client.deps
  );

  assertEquals(response.status, 400);
  const body = await response.json();
  assertEquals(body.error, 'Incomplete request body');
  assertStringIncludes(body.message, '1048576');
  assertEquals(client.uploadCalls.length, 0);
});

Deno.test('a client that disconnects mid-stream is refused with 400 and logged once', async () => {
  const client = fakeClient();
  const { stream, counts } = countedStream(chunked(pngBytes(256 * 1024), 32 * 1024), 2);

  const { result: response, logs } = await withCapturedErrors(() =>
    handleUpload(uploadRequest({ body: stream, contentLength: String(1024 * 1024) }), client.deps)
  );

  assertEquals(response.status, 400);
  assertEquals((await response.json()).error, 'Request body read failed');
  assertEquals(logs.length, 1, `expected exactly one log line, got ${JSON.stringify(logs)}`);
  assertStringIncludes(logs[0], 'Upload body read failed');
  // Two chunks delivered, then the pull that errored — and nothing after it.
  // `counts.cancels` stays 0 here by design: cancelling an already-errored
  // stream does not run its source's cancel algorithm, which is why the handler
  // has to tolerate that call rejecting rather than assume it succeeds.
  assertEquals(counts.pulls, 3);
  assertEquals(counts.cancels, 0);
  assertEquals(client.uploadCalls.length, 0);
});

Deno.test('a body at exactly the cap is accepted', async () => {
  const client = fakeClient();
  const { stream } = countedStream(chunked(pngBytes(MAX), 256 * 1024));

  const response = await handleUpload(
    uploadRequest({ body: stream, contentLength: String(MAX) }),
    client.deps
  );

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.success, true);
  assertEquals(body.size, MAX);
  assertEquals(body.mimeType, 'image/png');
  assertEquals(client.uploadCalls.length, 1);
  assertEquals(client.uploadCalls[0].size, MAX);
  assertEquals(client.uploadCalls[0].bucket, CONFIG.BUCKET_NAME);
  assert(client.uploadCalls[0].path.startsWith(`${client.userId}/`));
});

// ---------------------------------------------------------------------------
// Format and content
// ---------------------------------------------------------------------------

Deno.test('multipart/form-data is refused with 415 before any read', async () => {
  const client = fakeClient();
  const { stream, counts } = countedStream([pngBytes(1024)]);

  const response = await handleUpload(
    uploadRequest({
      body: stream,
      contentLength: '1024',
      contentType: 'multipart/form-data; boundary=----abc',
    }),
    client.deps
  );

  assertEquals(response.status, 415);
  assertEquals((await response.json()).error, 'Unsupported media type');
  assertEquals(counts.pulls, 0, 'a multipart body must never be parsed');
  assertEquals(client.uploadCalls.length, 0);
});

Deno.test('a body whose magic bytes are not an image is refused with 415', async () => {
  const client = fakeClient();
  const text = new TextEncoder().encode('this is definitely not a png, it is just text');
  const { stream } = countedStream([text]);

  const response = await handleUpload(
    uploadRequest({ body: stream, contentLength: String(text.byteLength) }),
    client.deps
  );

  assertEquals(response.status, 415);
  const body = await response.json();
  assertEquals(body.error, 'Invalid file type');
  assertEquals(body.detectedType, 'unknown');
  assertEquals(client.uploadCalls.length, 0);
});

Deno.test('a normal octet-stream upload succeeds with the uploader-prefixed path', async () => {
  const client = fakeClient();
  const bytes = pngBytes(64 * 1024);
  const { stream } = countedStream(chunked(bytes, 16 * 1024));

  const response = await handleUpload(
    uploadRequest({ body: stream, contentLength: String(bytes.byteLength) }),
    client.deps
  );

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.success, true);
  assertEquals(body.storagePath, client.uploadCalls[0].path);
  assertEquals(body.size, bytes.byteLength);
  assert(body.storagePath.startsWith(`${client.userId}/`));
  assertEquals(body.rateLimitRemaining, CONFIG.RATE_LIMIT_MAX_UPLOADS - 1);
  assertEquals(
    response.headers.get('X-RateLimit-Remaining'),
    String(CONFIG.RATE_LIMIT_MAX_UPLOADS - 1)
  );
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(client.uploadCalls[0].contentType, 'image/png');
});

Deno.test('a Uint8Array body (not a stream) still round-trips', async () => {
  const client = fakeClient();
  const bytes = pngBytes(2048);

  const response = await handleUpload(
    uploadRequest({ body: bytes, contentLength: String(bytes.byteLength) }),
    client.deps
  );

  assertEquals(response.status, 200);
  assertEquals((await response.json()).size, bytes.byteLength);
  assertEquals(client.uploadCalls.length, 1);
});

// ---------------------------------------------------------------------------
// Unchanged paths
// ---------------------------------------------------------------------------

Deno.test('a request without an Authorization header is refused with 401', async () => {
  const client = fakeClient();
  const { stream, counts } = countedStream([pngBytes(1024)]);

  const response = await handleUpload(
    uploadRequest({ body: stream, contentLength: '1024', authorization: null }),
    client.deps
  );

  assertEquals(response.status, 401);
  assertEquals((await response.json()).error, 'Missing authorization header');
  assertEquals(counts.pulls, 0);
  assertEquals(client.authHeaders.length, 0, 'no client is built without a token');
  assertEquals(client.uploadCalls.length, 0);
});

Deno.test('a rejected bearer token is refused with 401 before the body is read', async () => {
  const client = fakeClient({ authFails: true });
  const { stream, counts } = countedStream([pngBytes(1024)]);

  const response = await handleUpload(
    uploadRequest({ body: stream, contentLength: '1024', authorization: 'Bearer nope' }),
    client.deps
  );

  assertEquals(response.status, 401);
  assertEquals((await response.json()).error, 'Unauthorized');
  assertEquals(counts.pulls, 0);
  assertEquals(client.authHeaders, ['Bearer nope']);
  assertEquals(client.uploadCalls.length, 0);
});

Deno.test('the rate limiter still refuses the eleventh upload in a window', async () => {
  const client = fakeClient();
  const bytes = pngBytes(512);

  for (let attempt = 0; attempt < CONFIG.RATE_LIMIT_MAX_UPLOADS; attempt++) {
    const ok = await handleUpload(
      uploadRequest({ body: bytes, contentLength: String(bytes.byteLength) }),
      client.deps
    );
    assertEquals(ok.status, 200);
    await ok.body?.cancel();
  }

  const { stream, counts } = countedStream([bytes]);
  const response = await handleUpload(
    uploadRequest({ body: stream, contentLength: String(bytes.byteLength) }),
    client.deps
  );

  assertEquals(response.status, 429);
  assertEquals(response.headers.get('Retry-After'), '60');
  assertEquals((await response.json()).error, 'Rate limit exceeded');
  assertEquals(counts.pulls, 0, 'a throttled request must not read its body');
  assertEquals(client.uploadCalls.length, CONFIG.RATE_LIMIT_MAX_UPLOADS);
});

Deno.test('a CORS preflight is answered without auth', async () => {
  const client = fakeClient();

  const response = await handleUpload(
    new Request(ENDPOINT, { method: 'OPTIONS' }),
    client.deps
  );

  assertEquals(response.status, 200);
  assertEquals(await response.text(), 'ok');
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(
    response.headers.get('Access-Control-Allow-Headers'),
    'authorization, x-client-info, apikey, content-type'
  );
});

Deno.test('a non-POST method is refused with 405', async () => {
  const client = fakeClient();

  const response = await handleUpload(new Request(ENDPOINT, { method: 'GET' }), client.deps);

  assertEquals(response.status, 405);
  assertEquals((await response.json()).error, 'Method not allowed');
  assertEquals(client.authHeaders.length, 0);
});

Deno.test('a Storage failure is reported as 500 without leaking the body', async () => {
  const client = fakeClient({ uploadError: 'bucket unavailable' });
  const bytes = pngBytes(1024);

  const { result: response } = await withCapturedErrors(() =>
    handleUpload(
      uploadRequest({ body: bytes, contentLength: String(bytes.byteLength) }),
      client.deps
    )
  );

  assertEquals(response.status, 500);
  const body = await response.json();
  assertEquals(body.error, 'Upload failed');
  assertEquals(body.message, 'bucket unavailable');
  assertEquals(client.uploadCalls.length, 1);
});
