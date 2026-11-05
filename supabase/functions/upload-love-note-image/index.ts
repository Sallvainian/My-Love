/**
 * Edge Function: upload-love-note-image
 *
 * Server-side validation for love note image uploads.
 * Provides robust security that cannot be bypassed client-side.
 *
 * Features:
 * - Authentication verification
 * - Bounded request body: Content-Length precheck plus a counted stream read,
 *   so an oversized body is refused without ever being buffered
 * - File size validation (max 5MB compressed)
 * - MIME type validation via magic bytes
 * - Rate limiting (10 uploads per minute per user), shared and database-backed
 *   through `claim_love_note_upload()`
 * - Uploads to love-notes-images bucket
 *
 * The request lifecycle lives in `handler.ts` so it can be tested with
 * `deno test` against a fake Supabase client; this file is only the serve
 * binding and the real client factory.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0?deps=iceberg-js@0.8.1';

import { apiKeyFromEnv } from '../_shared/apiKeys.ts';
import { handleUpload } from './handler.ts';

Deno.serve((req) =>
  handleUpload(req, {
    createClient: (authHeader: string) => {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const publishableKey = apiKeyFromEnv('publishable', (name) => Deno.env.get(name)).key;
      return createClient(supabaseUrl, publishableKey, {
        global: { headers: { Authorization: authHeader } },
      });
    },
  })
);
