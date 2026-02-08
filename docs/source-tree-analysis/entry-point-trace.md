# Entry Point Trace

The application boots through this sequence:

1. **`index.html`** -- Vite injects the script tag pointing to `src/main.tsx`.
2. **`src/main.tsx`** -- Creates the React root, renders `<App />`, and registers the service worker via `workbox-window` with an auto-update prompt.
3. **`src/App.tsx`** -- Reads auth state from `useAuth`, gates on login, reads `navigationSlice` from Zustand to render the active view, and wraps everything in `ErrorBoundary`.
4. **`src/stores/useAppStore.ts`** -- Initializes the combined Zustand store with all 10 slices and `persist` middleware backed by localStorage.
5. **`src/api/supabaseClient.ts`** -- Constructs the Supabase client singleton used by all API and service modules.
6. **`src/sw.ts`** -- Runs independently in the service worker thread; handles precaching, runtime caching strategies, and background sync for offline mutations.

---
