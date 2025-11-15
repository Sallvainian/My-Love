# Memory Profiling Methodology

## Overview

This guide documents the methodology for profiling IndexedDB memory usage in the My Love PWA application. The app stores photos, messages, and mood entries locally, requiring careful monitoring to prevent storage quota exhaustion.

## Storage Architecture

### Data Stores

1. **Photos Store** (`photos`)
   - Primary storage consumer (images compressed to ~200KB each)
   - Metadata: caption, tags, dimensions, compression details
   - Index: `by-date` for chronological retrieval

2. **Messages Store** (`messages`)
   - Small footprint (~100 bytes per message)
   - Metadata: text, category, favorite status, timestamps
   - Indexes: `by-category`, `by-date`

3. **Moods Store** (`moods`)
   - Minimal footprint (~50 bytes per entry)
   - Daily mood tracking with optional notes
   - No indexes (small dataset)

### Storage Quotas

**Browser Storage Quotas:**
- **Chrome/Edge:** ~60% of available disk space (up to 80% temporary)
- **Firefox:** ~50% of available disk space (up to 2GB)
- **Safari:** 1GB default (can request more)
- **Mobile browsers:** ~10-50MB (varies by device)

**App Thresholds:**
- **80% usage:** Warning displayed to user (yellow banner)
- **95% usage:** Error state, photo uploads disabled (red banner)
- **100% usage:** QuotaExceededError thrown by IndexedDB

## Profiling Methodology

### 1. Estimate Current Usage

Use the Storage API to query current quota and usage:

```typescript
// Available in photoStorageService.estimateQuotaRemaining()
const estimate = await navigator.storage.estimate();
const used = estimate.usage || 0;      // Bytes used
const quota = estimate.quota || 0;     // Total quota in bytes
const percentUsed = (used / quota) * 100;
```

**Location:** `src/services/photoStorageService.ts:288-330`

**Output:**
```
Quota: 25.45MB / 458.12MB (5.6% used)
Remaining: 432.67MB
```

### 2. Calculate Per-Store Usage

Each service provides `getStorageSize()` to estimate store-specific usage:

```typescript
// Photo storage size
const photoSize = await photoStorageService.getStorageSize();
// Message storage size (estimate: messages.length * 100 bytes)
const messageCount = await customMessageService.getAll();
const messageSize = messageCount.length * 100; // Approximate
```

**Location:** `src/services/photoStorageService.ts:265-280`

**Example Output:**
```
Photos: 24.8MB (120 photos * ~200KB average)
Messages: 0.02MB (200 messages * 100 bytes)
Moods: 0.001MB (20 entries * 50 bytes)
Total: ~24.82MB
```

### 3. Profile Compression Effectiveness

Monitor photo compression ratios to validate image compression:

```typescript
const photos = await photoStorageService.getAll();
const compressionStats = photos.map(p => ({
  id: p.id,
  originalSize: p.originalSize,
  compressedSize: p.compressedSize,
  compressionRatio: ((1 - p.compressedSize / p.originalSize) * 100).toFixed(1) + '%',
  dimensions: `${p.width}x${p.height}`,
}));
```

**Expected Results:**
- Original size: 2-8MB (modern smartphone photos)
- Compressed size: 100-300KB (target: <200KB)
- Compression ratio: 90-97% reduction
- Dimensions preserved (no resizing yet)

### 4. Browser DevTools Profiling

#### Chrome DevTools

**Application Tab → Storage:**
1. Open DevTools (F12)
2. Navigate to Application → Storage
3. Expand IndexedDB → my-love-db
4. Inspect object stores: photos, messages, moods
5. View individual records and sizes

**Performance Tab → Memory:**
1. Open Performance tab
2. Click "Collect garbage" icon (🗑️)
3. Take heap snapshot
4. Search for "my-love" or "Photo" objects
5. Analyze retained size

#### Firefox DevTools

**Storage Inspector:**
1. Open DevTools (F12)
2. Navigate to Storage → IndexedDB
3. Select my-love-db
4. View object stores and data

### 5. Programmatic Storage Monitoring

**Periodic Quota Checks:**

```typescript
// Run every 5 minutes in background
setInterval(async () => {
  const { percentUsed } = await photoStorageService.estimateQuotaRemaining();

  if (percentUsed >= 95) {
    console.error('[StorageMonitor] CRITICAL: 95% quota exceeded');
    // Trigger error UI
  } else if (percentUsed >= 80) {
    console.warn('[StorageMonitor] WARNING: 80% quota threshold reached');
    // Trigger warning UI
  }
}, 5 * 60 * 1000);
```

**Per-Upload Monitoring:**

```typescript
// Before adding photo
const quotaBefore = await photoStorageService.estimateQuotaRemaining();
await photoStorageService.create(photo);
const quotaAfter = await photoStorageService.estimateQuotaRemaining();

console.log(`Photo upload consumed: ${(quotaAfter.used - quotaBefore.used) / 1024}KB`);
```

## Performance Baselines

### Storage Growth Rates

**Photo Storage (Primary Concern):**
- Average photo size: 200KB (compressed)
- Photos per week: ~10-20 (estimated)
- Monthly growth: ~2-4MB
- Annual capacity: ~2,500 photos (500MB quota)

**Message Storage (Negligible):**
- Average message size: 100 bytes
- Messages per week: ~50-100 (estimated)
- Monthly growth: ~0.02MB
- Effectively unlimited (text-only)

**Mood Storage (Negligible):**
- Average entry size: 50 bytes
- Entries per week: 7 (daily tracking)
- Monthly growth: ~0.001MB
- Effectively unlimited (daily entries only)

### Quota Thresholds

Based on typical 1GB mobile quota:

| Photos | Storage Used | % of 1GB | Status |
|--------|--------------|----------|--------|
| 100    | 20MB         | 2%       | ✅ Safe |
| 500    | 100MB        | 10%      | ✅ Safe |
| 1,000  | 200MB        | 20%      | ✅ Safe |
| 2,500  | 500MB        | 50%      | ⚠️ Monitor |
| 4,000  | 800MB        | 80%      | ⚠️ Warning |
| 4,750  | 950MB        | 95%      | 🚨 Critical |

## Troubleshooting

### QuotaExceededError

**Symptoms:**
- IndexedDB write operations fail with `QuotaExceededError`
- Photo uploads fail with error message
- Browser DevTools shows quota at 100%

**Resolution:**
1. Check current quota usage: `photoStorageService.estimateQuotaRemaining()`
2. Identify largest photos: Sort by `compressedSize` DESC
3. Delete old or duplicate photos manually
4. Clear browser cache (Settings → Privacy → Clear browsing data)
5. Request persistent storage: `navigator.storage.persist()`

### Inaccurate Quota Estimates

**Symptoms:**
- `navigator.storage.estimate()` returns 0 or undefined
- Quota percentages don't match browser DevTools

**Resolution:**
- Browser doesn't support Storage API (Safari < 15.2)
- Fallback to conservative 50MB default quota
- Use browser DevTools for accurate measurement
- Test on Chrome/Firefox for accurate profiling

### Storage Fragmentation

**Symptoms:**
- Quota usage remains high after deleting photos
- `estimateQuotaRemaining()` doesn't reflect deletions

**Resolution:**
- Browser hasn't reclaimed deleted space yet
- Trigger manual garbage collection in DevTools
- Wait 10-15 minutes for browser cleanup
- Compact IndexedDB: Close all tabs, restart browser

## Testing & Validation

### Unit Tests

```typescript
// tests/services/photoStorageService.test.ts
describe('getStorageSize', () => {
  it('calculates total compressed size of all photos', async () => {
    const photos = [
      { compressedSize: 100000 },
      { compressedSize: 200000 },
      { compressedSize: 150000 },
    ];
    const total = photos.reduce((sum, p) => sum + p.compressedSize, 0);
    expect(total).toBe(450000); // 450KB
  });
});
```

### E2E Tests

```typescript
// tests/e2e/storage-quota.spec.ts
test('displays warning when 80% quota reached', async ({ page }) => {
  // Mock quota at 81%
  await page.route('**/storage/estimate', route => {
    route.fulfill({
      json: { usage: 810000000, quota: 1000000000 }
    });
  });

  await expect(page.locator('[data-testid="quota-warning"]')).toBeVisible();
});
```

## References

- **Photo Compression:** `src/services/imageCompressionService.ts`
- **Storage Services:** `src/services/photoStorageService.ts`, `src/services/customMessageService.ts`
- **Storage Monitor:** `src/utils/storageMonitor.ts`
- **Epic 4 Technical Spec:** `docs/tech-spec-epic-4.md` (AC-4.1.9)
- **MDN Storage API:** https://developer.mozilla.org/en-US/docs/Web/API/Storage_API

---

**Last Updated:** 2025-11-15
**Maintained By:** Engineering Team
