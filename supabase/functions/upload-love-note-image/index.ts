/**
 * Edge Function: upload-love-note-image
 *
 * Server-side validation for love note image uploads.
 * Provides robust security that cannot be bypassed client-side.
 *
 * Features:
 * - Authentication verification
 * - File size validation (max 5MB compressed)
 * - MIME type validation via magic bytes
 * - Rate limiting (10 uploads per minute per user)
 * - Uploads to love-notes-images bucket
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Configuration
const CONFIG = {
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5MB (compressed images)
  RATE_LIMIT_MAX_UPLOADS: 10,
  RATE_LIMIT_WINDOW_MS: 60 * 1000, // 1 minute
  BUCKET_NAME: 'love-notes-images',
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
};

// In-memory rate limit store (resets on cold start, acceptable for this use case)
// For production at scale, use Redis or database
const rateLimitStore = new Map<string, number[]>();

/**
 * Check magic bytes to determine actual file type
 * More secure than trusting Content-Type header
 */
function detectMimeType(buffer: Uint8Array): string | null {
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
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return 'image/gif';
  }
  return null;
}

/**
 * Check rate limit for user
 * Returns true if within limit, false if exceeded
 */
function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const timestamps = rateLimitStore.get(userId) || [];

  // Filter to only timestamps within the window
  const recentTimestamps = timestamps.filter(
    (ts) => now - ts < CONFIG.RATE_LIMIT_WINDOW_MS
  );

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
function generateStoragePath(userId: string): string {
  const timestamp = Date.now();
  const uuid = crypto.randomUUID();
  return `${userId}/${timestamp}-${uuid}.jpg`;
}

Deno.serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many uploads. Please wait a minute.',
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': '60',
          },
        }
      );
    }

    // Get file from request body
    const contentType = req.headers.get('Content-Type') || '';
    let fileBuffer: Uint8Array;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return new Response(
          JSON.stringify({ error: 'No file provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      fileBuffer = new Uint8Array(await file.arrayBuffer());
    } else {
      // Raw binary body
      fileBuffer = new Uint8Array(await req.arrayBuffer());
    }

    // Validate file size
    if (fileBuffer.length > CONFIG.MAX_FILE_SIZE_BYTES) {
      return new Response(
        JSON.stringify({
          error: 'File too large',
          message: `Maximum file size is ${CONFIG.MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`,
          maxSize: CONFIG.MAX_FILE_SIZE_BYTES,
          actualSize: fileBuffer.length,
        }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate MIME type via magic bytes
    const detectedMime = detectMimeType(fileBuffer);
    if (!detectedMime || !CONFIG.ALLOWED_MIME_TYPES.includes(detectedMime)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid file type',
          message: 'Only JPEG, PNG, WebP, and GIF images are allowed',
          detectedType: detectedMime || 'unknown',
        }),
        { status: 415, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      return new Response(
        JSON.stringify({
          error: 'Upload failed',
          message: uploadError.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Success
    return new Response(
      JSON.stringify({
        success: true,
        storagePath,
        size: fileBuffer.length,
        mimeType: detectedMime,
        rateLimitRemaining: rateLimit.remaining,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        },
      }
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
});
