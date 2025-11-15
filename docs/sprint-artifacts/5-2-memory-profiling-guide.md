# Memory Profiling Guide for Photo Pagination

## Story 5.2: Implement Photo Pagination with Lazy Loading

### Memory Testing Requirement (AC-5)

Verify memory optimization with large photo collections (100+ photos).

**Target:** Memory usage should stay under:

- **<50MB with 100 photos**
- **<100MB with 500 photos**

---

## Chrome DevTools Memory Profiling Steps

### 1. Setup Test Environment

1. **Build the app:**

   ```bash
   npm run build
   npm run preview
   ```

2. **Open Chrome DevTools:**
   - Navigate to `http://localhost:4173/My-Love/`
   - Press `F12` to open DevTools
   - Go to **Performance** tab → **Memory** section

### 2. Baseline Memory Snapshot

1. **Clear all data:**
   - DevTools → **Application** tab → **Storage** → **Clear site data**
   - Reload page

2. **Take initial heap snapshot:**
   - DevTools → **Memory** tab → **Heap snapshot**
   - Click **Take snapshot** button
   - Label: "Baseline (0 photos)"

3. **Record baseline:**
   - Note: JS Heap size (typically 10-15MB for empty app)

### 3. Test with 100 Photos

1. **Upload 100 test photos:**
   - Use the Photo Upload modal
   - Upload 100 photos in batches of 20
   - Monitor memory during upload

2. **Navigate to Photo Gallery:**
   - Click Photos tab
   - Wait for initial 20 photos to load
   - Scroll to trigger pagination (load 5 pages total)

3. **Take heap snapshot:**
   - Label: "After loading 100 photos (paginated)"
   - Compare with baseline

4. **Expected Memory Usage:**
   - **Initial load (20 photos):** ~15-25MB
   - **After loading all 100 photos:** ~40-50MB
   - **Retained size:** Photos should be in IndexedDB, not all in memory

### 4. Test with 500 Photos (Optional)

1. **Upload 500 test photos** (or use bulk import script)

2. **Navigate to Photo Gallery:**
   - Initial load: 20 photos
   - Scroll through pages progressively

3. **Take heap snapshot:**
   - Label: "After loading 500 photos (paginated)"

4. **Expected Memory Usage:**
   - Should stay **under 100MB** total heap size
   - Verify old pages are garbage collected

### 5. Memory Leak Detection

1. **Test multiple pagination cycles:**
   - Load 20 photos → scroll to load more → navigate away → return → repeat
   - Take snapshots before/after each cycle

2. **Check for memory growth:**
   - Heap size should stabilize (not grow unbounded)
   - Look for detached DOM nodes (indicates memory leaks)

3. **Verify blob URL cleanup:**
   - PhotoGridItem uses `URL.revokeObjectURL()` on unmount
   - Verify no dangling blob URLs in heap snapshot

---

## Performance Monitoring

### 1. Performance Tab Recording

1. **Start recording:**
   - DevTools → **Performance** tab
   - Click **Record** button

2. **Perform pagination actions:**
   - Load initial photos
   - Scroll to trigger 3-4 pagination loads
   - Stop recording

3. **Analyze:**
   - **Memory timeline:** Should show stable memory usage
   - **JS Heap:** No continuous growth
   - **Nodes:** DOM nodes should remain constant (not accumulating)

### 2. Key Metrics

- **Initial Load Time:** Target <500ms for first 20 photos
- **Load More Time:** Target <300ms for next 20 photos
- **Memory Growth Rate:** Should plateau after initial load
- **Garbage Collection:** Should reclaim memory from old blob URLs

---

## Interpreting Results

### Good Memory Profile

✅ Memory increases during load, then stabilizes
✅ Garbage collection reclaims memory from old pages
✅ Total heap size stays within target limits
✅ No continuous memory growth over time

### Bad Memory Profile (Indicates Leak)

❌ Memory grows unbounded with each pagination cycle
❌ Detached DOM nodes accumulate in heap snapshot
❌ Blob URLs not revoked (appear in heap as "Blob" objects)
❌ Event listeners not cleaned up (check "Detached" category)

---

## Debugging Memory Issues

### If Memory Exceeds Target:

1. **Check blob URL cleanup:**
   - Verify `URL.revokeObjectURL()` in PhotoGridItem useEffect cleanup
   - Search heap snapshot for "blob:" URLs

2. **Verify IndexedDB usage:**
   - Photos should be stored in IndexedDB, not all loaded into memory
   - Check `photoStorageService.getPage()` only loads 20 photos at a time

3. **Check for retained references:**
   - Search heap snapshot for "Photo" objects
   - Verify old photo pages are not retained in Zustand store

4. **Optimize getPage() if needed:**
   - Current implementation: `getAllFromIndex()` then `slice()`
   - If memory is high with 500+ photos, consider cursor-based pagination

---

## Automated Memory Test (Future Enhancement)

```typescript
// tests/performance/memory-profiling.spec.ts
import { test, expect } from '@playwright/test';

test('memory usage stays under 50MB with 100 photos', async ({ page }) => {
  // Upload 100 photos
  // Navigate to gallery
  // Trigger pagination

  const memoryUsage = await page.evaluate(() => {
    return (performance as any).memory?.usedJSHeapSize || 0;
  });

  expect(memoryUsage).toBeLessThan(50 * 1024 * 1024); // 50MB in bytes
});
```

---

## Documentation Requirements (Story 5.2)

### Update technical-decisions.md

Document the following:

1. **Pagination Strategy:**
   - Slice-based pagination suitable for <100 photos
   - Deferred cursor optimization for 500+ photos

2. **Memory Benchmarks:**
   - Baseline: 10-15MB (empty app)
   - 100 photos (paginated): 40-50MB
   - 500 photos (paginated): 80-100MB

3. **Performance Characteristics:**
   - Initial load: <500ms (20 photos)
   - Load more: <300ms (20 photos)
   - Memory stable after initial pagination

4. **Trade-offs:**
   - Simplicity vs. performance (slice-based chosen for MVP)
   - Cursor-based pagination adds complexity, deferred until needed

---

## References

- [Chrome DevTools Memory Profiling](https://developer.chrome.com/docs/devtools/memory-problems/)
- [Detecting Memory Leaks](https://developer.chrome.com/docs/devtools/memory-problems/memory-101/)
- [IndexedDB Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)
- [Story 5.2 Tech Spec](../tech-spec-epic-5.md#story-52-implement-photo-pagination-with-lazy-loading)
