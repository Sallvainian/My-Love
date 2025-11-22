# Performance Characteristics

## Bundle Analysis

- Initial JS: ~280KB (gzipped, includes Supabase client)
- CSS: ~15KB (gzipped, Tailwind purged)
- Total initial load: ~350KB

## Runtime Performance

- First Contentful Paint: <1.5s
- Time to Interactive: <2.5s
- Offline load: <800ms
- State update propagation: <16ms (60fps animations)

## Optimization Strategies

- Lazy loading for photos (pagination + infinite scroll)
- Zustand shallow comparison selectors
- Framer Motion LazyMotion provider
- IndexedDB pagination for large datasets
- Service worker caching (NetworkFirst/CacheFirst strategies)
