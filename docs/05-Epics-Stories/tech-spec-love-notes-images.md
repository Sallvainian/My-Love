# Tech-Spec: Love Notes Image Attachments

**Created:** 2025-12-04
**Status:** Ready for Development

## Overview

### Problem Statement

Currently, love notes only support text messages. Users want to share images within their chat conversations (like WhatsApp/iMessage), not just in the separate Photo Gallery feature. The Photo Gallery is for "memory book" style storage, while love notes images are for quick, conversational photo sharing.

### Solution

Add optional image attachment support to the Love Notes feature. Users can:
- Tap an image icon to select a photo from their device
- Preview the image before sending
- Optionally add text with the image
- Send image-only messages or text+image messages
- View received images inline in the chat

### Scope (In/Out)

**In Scope:**
- Database migration: Add `image_url` column to `love_notes` table
- Supabase Storage: Create `love-notes-images` bucket with RLS
- UI: Image picker button in MessageInput component
- UI: Image preview before sending
- UI: Inline image display in LoveNoteMessage
- Compression: Reuse existing `imageCompressionService`
- Upload: Progress indicator during image upload
- Real-time: Partner receives image messages via existing broadcast

**Out of Scope:**
- Multiple images per message (single image only for MVP)
- Image editing/cropping before send
- Video attachments
- Image reactions/replies
- Download/save to device (tap to view full-screen only)
- Camera capture (file picker only)

## Context for Development

### Codebase Patterns

| Pattern | Location | Usage |
|---------|----------|-------|
| State management | `src/stores/slices/notesSlice.ts` | Zustand slice for notes state |
| Optimistic updates | `notesSlice.sendNote()` | Add temp message, replace on success |
| Image compression | `src/services/imageCompressionService.ts` | Canvas API compression |
| Message display | `src/components/love-notes/LoveNoteMessage.tsx` | Chat bubble component |
| Message input | `src/components/love-notes/MessageInput.tsx` | Text input + send button |
| Supabase client | `src/api/supabaseClient.ts` | Database and storage operations |
| Model types | `src/types/models.ts` | LoveNote interface |

### Files to Reference

**Must Read:**
- [src/components/love-notes/MessageInput.tsx](src/components/love-notes/MessageInput.tsx) - Current input, add image picker
- [src/components/love-notes/LoveNoteMessage.tsx](src/components/love-notes/LoveNoteMessage.tsx) - Add image display
- [src/stores/slices/notesSlice.ts](src/stores/slices/notesSlice.ts) - Update sendNote to handle images
- [src/services/imageCompressionService.ts](src/services/imageCompressionService.ts) - Reuse for compression
- [src/types/models.ts](src/types/models.ts) - Update LoveNote interface

**Reference:**
- [src/types/database.types.ts](src/types/database.types.ts) - Database schema types
- [src/hooks/useLoveNotes.ts](src/hooks/useLoveNotes.ts) - Hook for components

### Technical Decisions

1. **Separate storage bucket** - Use `love-notes-images` bucket instead of Epic 6's `photos` bucket to keep features independent
2. **Nullable image_url** - Messages can be text-only (image_url = null) or have image (image_url = storage path)
3. **Reuse compression** - Use existing imageCompressionService (2048px max, 80% JPEG quality)
4. **Signed URLs** - Use 1-hour expiry signed URLs for private image access
5. **Storage path format** - `{user_id}/{timestamp}-{uuid}.jpg` (client-generated UUID, no server round-trip needed)

## Implementation Plan

### Tasks

- [ ] **Task 1: Database Migration**
  - Create migration to add `image_url` column to `love_notes` table
  - Column: `image_url TEXT NULL` (nullable - text messages have no image)
  - Regenerate TypeScript types after migration

- [ ] **Task 2: Supabase Storage Bucket Setup**
  - Create `love-notes-images` bucket via Supabase Dashboard or migration
  - Configure as private bucket (`public: false`)
  - Add RLS policies:
    - Users can upload to their own folder (`{user_id}/`)
    - Users can read their own images
    - Partners can read each other's images (via `users.partner_id`)

- [ ] **Task 3: Update LoveNote Type**
  - Add `image_url?: string | null` to LoveNote interface
  - Add `imageUploading?: boolean` for optimistic UI state
  - Update SendMessageInput type if needed

- [ ] **Task 4: Create Image Upload Service**
  - Create `src/services/loveNoteImageService.ts`
  - Function: `uploadLoveNoteImage(file: File, userId: string): Promise<{ storagePath: string }>`
  - Uses existing `imageCompressionService.compressImage()`
  - Uploads compressed blob to Supabase Storage
  - Returns storage path for database record

- [ ] **Task 5: Update notesSlice.sendNote()**
  - Accept optional `imageFile?: File` parameter
  - If image provided:
    1. Compress image using imageCompressionService
    2. Upload to Supabase Storage
    3. Get storage path
    4. Insert love_note with content + image_url
  - Update optimistic note to show image uploading state
  - **Cache compressed blob** in optimistic note for retry flow (store `imageBlob` and `previewUrl` so AC-12 retry doesn't re-compress)

- [ ] **Task 6: Update MessageInput Component**
  - Add image picker button (camera/image icon) next to send button
  - Hidden file input: `accept="image/jpeg,image/png,image/webp"`
  - On file select: validate with `imageCompressionService.validateImageFile()`
  - Show image preview above text input when image selected
  - Add "X" button to remove selected image
  - Modify send to pass imageFile to sendNote

- [ ] **Task 7: Update LoveNoteMessage Component**
  - Check if `message.image_url` exists
  - If yes, fetch signed URL from Supabase Storage
  - Display image above text content (if any text)
  - Style: rounded corners, max-width 80%, tap to view full-screen
  - Loading state while image loads
  - Error state if image fails to load

- [ ] **Task 8: Create Full-Screen Image Viewer**
  - Simple modal component for viewing images at full size
  - Tap anywhere outside image to close (or X button in corner)
  - Dark overlay background for focus
  - MVP: No pinch-to-zoom (keep simple, add later if needed)
  - Used when user taps image in LoveNoteMessage (AC-9)

- [ ] **Task 9: Create ImagePreview Subcomponent**
  - Used in MessageInput to show selected image before send
  - Props: `file: File`, `onRemove: () => void`, `isCompressing?: boolean`
  - Display thumbnail preview using `URL.createObjectURL()`
  - Show file size and compression estimate
  - Show "Compressing..." indicator for large files (>5MB) to reduce user anxiety
  - "X" button to remove

- [ ] **Task 10: Update Real-time Broadcast**
  - Ensure image_url is included in broadcast payload
  - Partner receives message with image_url
  - No changes to useRealtimeMessages hook needed (already passes full message)

- [ ] **Task 11: Write Tests**
  - Unit: imageCompressionService validation (already exists)
  - Unit: notesSlice.sendNote with image
  - Unit: loveNoteImageService - mock compression failure scenarios
  - Component: MessageInput image picker flow (use `userEvent.upload()` for file input testing)
  - Component: LoveNoteMessage image display
  - Component: FullScreenImageViewer open/close behavior
  - E2E: Send image message, verify partner receives

### Acceptance Criteria

- [ ] **AC-1:** User can tap image icon in MessageInput to select a photo
- [ ] **AC-2:** Selected image shows preview above text input with "X" to remove
- [ ] **AC-3:** User can send image-only message (no text required)
- [ ] **AC-4:** User can send text+image message together
- [ ] **AC-5:** Image is compressed before upload (max 2048px, JPEG 80%)
- [ ] **AC-6:** Upload shows progress/loading state in chat bubble
- [ ] **AC-7:** Sent image displays inline in chat with rounded corners
- [ ] **AC-8:** Partner receives image message via real-time broadcast
- [ ] **AC-9:** Tapping image opens full-screen view
- [ ] **AC-10:** Invalid file types (video, PDF) are rejected with error message
- [ ] **AC-11:** Files >25MB are rejected with error message
- [ ] **AC-12:** Failed upload shows retry option (like failed text messages)

## Additional Context

### Dependencies

**Existing (no new packages):**
- `@supabase/supabase-js` - Storage and database operations
- `imageCompressionService` - Canvas API compression
- `framer-motion` - Animation for image preview
- `lucide-react` - Icons (ImageIcon, X)

### Database Schema Change

```sql
-- Migration: Add image_url to love_notes
ALTER TABLE love_notes
ADD COLUMN image_url TEXT NULL;

-- Comment for clarity
COMMENT ON COLUMN love_notes.image_url IS 'Storage path in love-notes-images bucket, null for text-only messages';
```

### Supabase Storage RLS Policies

```sql
-- Create bucket (via Supabase Dashboard or API)
INSERT INTO storage.buckets (id, name, public)
VALUES ('love-notes-images', 'love-notes-images', false);

-- Policy: Users can upload to their own folder
CREATE POLICY "Users upload own images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'love-notes-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can read their own images
CREATE POLICY "Users read own images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'love-notes-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Partners can read each other's images
CREATE POLICY "Partners read partner images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'love-notes-images' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.partner_id::text = (storage.foldername(name))[1]
  )
);

-- Policy: Users can delete their own images
CREATE POLICY "Users delete own images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'love-notes-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### Testing Strategy

**Unit Tests (Vitest):**
- `loveNoteImageService.uploadLoveNoteImage()` - mock Supabase storage
- `loveNoteImageService` - mock compression failure, verify error handling
- `notesSlice.sendNote()` with image file - verify compression + upload flow
- `notesSlice.retryFailedMessage()` with cached image blob - verify no re-compression
- Validation: file type, file size limits

**Component Tests:**
- `MessageInput` - image picker using `userEvent.upload()`, preview, remove, send with image
- `LoveNoteMessage` - image display, loading state, error state
- `FullScreenImageViewer` - open on tap, close on overlay click, close on X button
- `ImagePreview` - thumbnail display, compression indicator, remove button

**E2E Tests (Playwright):**
- Full flow: select image → preview → send → appears in chat
- Partner view: image appears via real-time
- Error handling: select invalid file type
- Full-screen viewer: tap image → modal opens → tap to close

### Notes

- Image URLs are signed with 1-hour expiry for security
- **URL refresh on 403**: If a signed URL returns 403 (expired), automatically regenerate and retry once before showing error
- Storage path: `{user_id}/{timestamp}-{uuid}.jpg` ensures unique filenames (client-generated, no server round-trip)
- Compression dramatically reduces upload time and storage (typically 90% reduction)
- **Visual layout**: Image messages display with image above text content (if both present), matching iMessage/WhatsApp visual hierarchy
