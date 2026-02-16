# 10. Edge Functions

## `upload-love-note-image`

**Location:** `supabase/functions/upload-love-note-image/index.ts`
**Runtime:** Deno (Supabase Edge Functions)
**URL:** `{SUPABASE_URL}/functions/v1/upload-love-note-image`

Server-side image upload handler with security validation that cannot be bypassed client-side.

### Request

```
POST /functions/v1/upload-love-note-image
Authorization: Bearer {JWT}
Content-Type: application/octet-stream  (or multipart/form-data)
Body: raw image bytes
```

### Configuration

| Setting | Value |
|---|---|
| Max file size | 5MB (compressed images) |
| Rate limit | 10 uploads per minute per user |
| Allowed MIME types | JPEG, PNG, WebP, GIF |
| Storage bucket | `love-notes-images` |
| Storage path format | `{user_id}/{timestamp}-{uuid}.jpg` |

### Validation Pipeline

1. **Authentication:** Verify JWT via `supabase.auth.getUser()`.
2. **Rate limiting:** In-memory sliding window (10 uploads / 60 seconds per user). Resets on cold start.
3. **File size:** Reject if > 5MB.
4. **MIME type (magic bytes):** Inspect first 8-12 bytes for file signature. More secure than trusting `Content-Type` header.
5. **Upload:** Store in `love-notes-images` bucket with `cacheControl: '3600'`.

### Response

**Success (200):**
```json
{
  "success": true,
  "storagePath": "{user_id}/{timestamp}-{uuid}.jpg",
  "size": 123456,
  "mimeType": "image/jpeg",
  "rateLimitRemaining": 8
}
```

**Error responses:**

| Status | Cause |
|---|---|
| 401 | Missing/invalid authorization |
| 405 | Non-POST method |
| 413 | File too large (> 5MB) |
| 415 | Invalid MIME type (magic bytes check) |
| 429 | Rate limit exceeded. `Retry-After: 60` header. |
| 500 | Upload failure or internal error |

---
