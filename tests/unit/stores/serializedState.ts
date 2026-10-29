/**
 * A value as text, for a leak check. Plain `JSON.stringify` writes an Error, a
 * Map and a Set as `{}`, so the previous account's label or failure text held
 * in one of them would not be found; this spells each one out.
 *
 * Kept free of imports so a test that builds its own store with `create` can
 * use it without loading `useAppStore`; `serializedStore()` in
 * `loaderIdentityGuardsFixture.ts` is this applied to the whole store.
 */
export function serialized(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item instanceof Error) {
      return { ...item, name: item.name, message: item.message, cause: item.cause };
    }
    if (item instanceof Map) return Array.from(item.entries());
    if (item instanceof Set) return Array.from(item.values());
    return item;
  });
}
