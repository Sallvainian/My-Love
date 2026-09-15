/**
 * Request handling for the `upload-love-note-image` Edge Function.
 *
 * Split out of `index.ts` so it can be exercised by `deno test` without a
 * network fetch of the Supabase SDK and without binding a port: `index.ts`
 * keeps `Deno.serve` and injects the real client factory, tests inject a fake.
 *
 * ## Why the body is streamed rather than buffered
 *
 * The previous implementation called `req.arrayBuffer()` (and `req.formData()`
 * for the unused multipart branch) and only then compared the resulting length
 * against `CONFIG.MAX_FILE_SIZE_BYTES`. Any authenticated caller could therefore
 * make the worker materialise an arbitrarily large body in memory before it was
 * rejected — the rate limiter bounds the *number* of such requests per isolate,
 * not the size of any one of them (CAP-10 / F10).
 *
 * The order here is: declared length first, then a counted stream.
 *
 * 1. `Content-Length` is required (411), must be a canonical non-negative
 *    integer (400) and must not exceed the cap (413). All three are decided
 *    from headers alone, before any chunk is read or retained.
 * 2. The body is then read chunk by chunk, and the running total is checked
 *    *before* each chunk is retained. Pushing first and checking afterwards
 *    would already be holding the oversize chunk, which is the bug. On overflow
 *    everything retained so far is released and 413 returned, so a lying header
 *    buys an attacker one chunk of live memory, not the whole body.
 * 3. A body that ends short of its declared length is a malformed request, not
 *    an image, and is refused with 400 before the magic-byte check.
 *
 * `arrayBuffer()`, `formData()`, `text()` and `json()` must never be called on
 * the request: each of them is the unbounded read this module exists to avoid.
 *
 * ## Why a refused over-limit body is drained and discarded
 *
 * Measured against `supabase-edge-runtime 1.74.3` (Deno 2.1.4) in the local
 * stack, both directly on its port 8081 and through Kong: a handler that
 * answers while the request body is still in flight never reaches the client.
 * A 5 MiB + 1 POST refused without reading hung until the 25s client timeout,
 * and so did `req.body.cancel()` and a read-one-chunk-then-cancel variant. Only
 * a full drain delivered the status (`{"mode":"drain","read":5242881}`, 169 ms).
 * Plain `deno 2.9.6` returns the same refusal in 2.6 ms without any of this, so
 * this is a property of that runtime, not of the contract.
 *
 * So an over-limit refusal drains what is left — and *discards* every chunk as
 * it arrives. Live memory stays one chunk no matter how much is sent, which is
 * the property F10 is about; the drain is only what lets the 413 arrive. It is
 * bounded by `MAX_DISCARD_BYTES` and skipped entirely when the declared length
 * is past that ceiling, so an absurd declaration still costs one header read.
 * Every other refusal — 401, 405, 411, 400 and the multipart 415 — reads
 * nothing at all, because none of them is reachable from the app's own client:
 * it always sends a raw octet-stream body whose Content-Length the browser
 * sets itself.
 *
 * 429 is the exception to that reasoning, and is deliberately left as it was.
 * It *is* reachable from the app — the limiter is 10 uploads/min per user —
 * and it *is* mapped to a message at `loveNoteImageService.ts:155-157`, so on
 * this runtime an 11th upload much over 1 MiB stalls instead of showing it.
 * The rate-limit-before-body ordering predates this change and is unchanged by
 * it; the limiter is out of contract here, and bounding retained memory (which
 * this path already does, since it retains nothing) is what this module is for.
 */

/** Configuration — `MAX_DISCARD_BYTES` aside, unchanged from before the split. */
export const CONFIG = {
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5MB (compressed images)
  /**
   * Ceiling on how much of a refused over-limit body will be drained so its 413
   * can be delivered. 25 MiB is `IMAGE_VALIDATION.MAX_FILE_SIZE_BYTES` in
   * `src/config/images.ts:31` — the largest file the client will even try to
   * compress — so every upload the app can legitimately produce gets a real
   * error message, and anything larger is a caller this endpoint does not owe a
   * clean answer.
   */
  MAX_DISCARD_BYTES: 25 * 1024 * 1024,
  RATE_LIMIT_MAX_UPLOADS: 10,
  RATE_LIMIT_WINDOW_MS: 60 * 1000, // 1 minute
  BUCKET_NAME: 'love-notes-images',
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
};

/**
 * The Supabase surface this handler actually uses.
 *
 * Declared structurally rather than imported so that `handler.ts` — and
 * therefore `deno test` — pulls in no remote module. The real client from
 * `index.ts` satisfies it.
 */
export interface UploadStorageBucket {
  upload(
    path: string,
    body: Uint8Array,
    options: { contentType: string; cacheControl: string; upsert: boolean }
  ): Promise<{ error: { message: string } | null }>;
}

export interface UploadSupabaseClient {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>;
  };
  storage: {
    from(bucket: string): UploadStorageBucket;
  };
}

export interface UploadDeps {
  /** Build a Supabase client that speaks as the caller's JWT. */
  createClient(authHeader: string): UploadSupabaseClient;
}

// In-memory rate limit store (resets on cold start, acceptable for this use case)
// For production at scale, use Redis or database
const rateLimitStore = new Map<string, number[]>();

/** A canonical non-negative integer. Rejects `-1`, `1.5`, `abc`, `+5`, `0x10`, ``. */
const CONTENT_LENGTH_PATTERN = /^\d+$/;

/**
 * Check magic bytes to determine actual file type
 * More secure than trusting Content-Type header
 */
export function detectMimeType(buffer: Uint8Array): string | null {
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }
  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return 'image/gif';
  }
  return null;
}

/**
 * Check rate limit for user
 * Returns true if within limit, false if exceeded
 */
export function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const timestamps = rateLimitStore.get(userId) || [];

  // Filter to only timestamps within the window
  const recentTimestamps = timestamps.filter((ts) => now - ts < CONFIG.RATE_LIMIT_WINDOW_MS);

  if (recentTimestamps.length >= CONFIG.RATE_LIMIT_MAX_UPLOADS) {
    return { allowed: false, remaining: 0 };
  }

  // Add current timestamp and update store
  recentTimestamps.push(now);
  rateLimitStore.set(userId, recentTimestamps);

  return {
    allowed: true,
    remaining: CONFIG.RATE_LIMIT_MAX_UPLOADS - recentTimestamps.length,
  };
}

/**
 * Generate storage path for the image
 */
export function generateStoragePath(userId: string): string {
  const timestamp = Date.now();
  const uuid = crypto.randomUUID();
  return `${userId}/${timestamp}-${uuid}.jpg`;
}

/**
 * Read the rest of a refused body and throw every chunk away.
 *
 * Nothing is appended to anything: the chunk from the previous iteration is
 * unreachable as soon as the next `read()` resolves, so live memory is one
 * chunk however many bytes arrive. `alreadyRead` carries in the bytes the
 * caller already pulled off the wire so they count against the same ceiling.
 *
 * See the module header for why this exists at all.
 */
async function discardWithReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  alreadyRead: number
): Promise<void> {
  let discarded = alreadyRead;
  try {
    while (discarded < CONFIG.MAX_DISCARD_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      discarded += value?.byteLength ?? 0;
    }
  } catch {
    // The client went away mid-refusal. There is nothing left to complete and
    // nothing was written, so this is not worth a second log line.
  }
  await reader.cancel().catch(() => {});
}

/** `discardWithReader` for a body no one has opened a reader on yet. */
async function discardRefusedBody(req: Request): Promise<void> {
  if (!req.body) return;
  await discardWithReader(req.body.getReader(), 0);
}

/** Either the fully-received body, or the response that refused it. */
type BodyOutcome = { ok: true; bytes: Uint8Array } | { ok: false; response: Response };

/**
 * Read `req.body` with a hard ceiling, never allocating past the cap.
 *
 * `expectedSize` has already been validated against the cap by the caller; it is
 * used here only to detect a body that ends early. The cap — not the declared
 * length — is what stops the read, which is why a header that lies *small* is
 * answered with 413 rather than a length mismatch.
 */
async function readBoundedBody(
  req: Request,
  expectedSize: number,
  json: (body: unknown, status: number, extraHeaders?: Record<string, string>) => Response
): Promise<BodyOutcome> {
  const chunks: Uint8Array[] = [];
  let receivedSize = 0;

  if (req.body) {
    const reader = req.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.byteLength === 0) continue;

        // Count BEFORE retaining. `chunks.push(value)` followed by a check would
        // already be holding the oversize chunk, so nothing would be bounded.
        if (receivedSize + value.byteLength > CONFIG.MAX_FILE_SIZE_BYTES) {
          const pulledSoFar = receivedSize + value.byteLength;
          // Release everything retained so far *before* draining, so the discard
          // never runs on top of a full buffer.
          chunks.length = 0;
          await discardWithReader(reader, pulledSoFar);
          return {
            ok: false,
            response: json(
              {
                error: 'File too large',
                message: `Maximum file size is ${CONFIG.MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`,
                maxSize: CONFIG.MAX_FILE_SIZE_BYTES,
              },
              413
            ),
          };
        }

        receivedSize += value.byteLength;
        chunks.push(value);
      }
    } catch (streamError) {
      // A client that disconnects mid-upload surfaces here. Logged once, then
      // refused: there is no body to validate and nothing was written.
      console.error('Upload body read failed:', streamError);
      await reader.cancel().catch(() => {});
      return {
        ok: false,
        response: json(
          {
            error: 'Request body read failed',
            message: 'The request body ended before it was fully received',
          },
          400
        ),
      };
    }
  }

  // Either direction is a malformed request: short of the declared length, or
  // past it while still under the cap. (A body past the *cap* never reaches
  // here — it was answered 413 inside the loop above.)
  if (receivedSize !== expectedSize) {
    return {
      ok: false,
      response: json(
        {
          error: 'Content-Length mismatch',
          message: `Content-Length declared ${expectedSize} bytes but ${receivedSize} were received`,
        },
        400
      ),
    };
  }

  const bytes = new Uint8Array(receivedSize);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, bytes };
}

/**
 * The whole request lifecycle: CORS, method, auth, rate limit, bounded body
 * read, magic-byte validation and the Storage write.
 */
export async function handleUpload(req: Request, deps: UploadDeps): Promise<Response> {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  const json = (body: unknown, status: number, extraHeaders: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
    });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401);
    }

    // Create Supabase client with user's JWT
    const supabase = deps.createClient(authHeader);

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // Check rate limit
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      return json(
        {
          error: 'Rate limit exceeded',
          message: 'Too many uploads. Please wait a minute.',
        },
        429,
        { 'Retry-After': '60' }
      );
    }

    // The only supported format is a raw binary body. The multipart branch was
    // never used by any client and is the other unbounded read, so it is
    // refused here rather than parsed.
    const contentType = req.headers.get('Content-Type') || '';
    if (contentType.includes('multipart/form-data')) {
      return json(
        {
          error: 'Unsupported media type',
          message: 'Send the image as a raw application/octet-stream body',
        },
        415
      );
    }

    // --- Declared length, decided from headers alone ---
    const declaredLength = req.headers.get('Content-Length');
    if (declaredLength === null) {
      return json(
        {
          error: 'Length required',
          message: 'A Content-Length header is required',
        },
        411
      );
    }

    if (!CONTENT_LENGTH_PATTERN.test(declaredLength)) {
      return json(
        {
          error: 'Invalid Content-Length',
          message: 'Content-Length must be a non-negative integer',
        },
        400
      );
    }

    const expectedSize = Number(declaredLength);
    if (!Number.isSafeInteger(expectedSize)) {
      return json(
        {
          error: 'Invalid Content-Length',
          message: 'Content-Length must be a non-negative integer',
        },
        400
      );
    }

    if (expectedSize > CONFIG.MAX_FILE_SIZE_BYTES) {
      // Nothing is retained either way; the drain is only what lets the status
      // reach the caller on the edge runtime. See the module header.
      if (expectedSize <= CONFIG.MAX_DISCARD_BYTES) {
        await discardRefusedBody(req);
      }
      return json(
        {
          error: 'File too large',
          message: `Maximum file size is ${CONFIG.MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`,
          maxSize: CONFIG.MAX_FILE_SIZE_BYTES,
          actualSize: expectedSize,
        },
        413
      );
    }

    // --- Bounded read ---
    const body = await readBoundedBody(req, expectedSize, json);
    if (!body.ok) {
      return body.response;
    }
    const fileBuffer = body.bytes;

    // Validate MIME type via magic bytes
    const detectedMime = detectMimeType(fileBuffer);
    if (!detectedMime || !CONFIG.ALLOWED_MIME_TYPES.includes(detectedMime)) {
      return json(
        {
          error: 'Invalid file type',
          message: 'Only JPEG, PNG, WebP, and GIF images are allowed',
          detectedType: detectedMime || 'unknown',
        },
        415
      );
    }

    // Generate storage path and upload
    const storagePath = generateStoragePath(user.id);

    const { error: uploadError } = await supabase.storage
      .from(CONFIG.BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: detectedMime,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return json(
        {
          error: 'Upload failed',
          message: uploadError.message,
        },
        500
      );
    }

    // Success
    return json(
      {
        success: true,
        storagePath,
        size: fileBuffer.length,
        mimeType: detectedMime,
        rateLimitRemaining: rateLimit.remaining,
      },
      200,
      { 'X-RateLimit-Remaining': rateLimit.remaining.toString() }
    );
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
