# Data Migration Patterns

## 1. LocalStorage → IndexedDB (One-time)

**Migration Service** handles custom messages migration:

```
1. Read from localStorage
2. Parse JSON
3. Validate each record
4. Check for duplicates in IndexedDB
5. Insert new records
6. Delete localStorage data
```

**Idempotent**: Running twice has no effect (localStorage already deleted)

## 2. IndexedDB Schema v1 → v2 (Photos)

**In-place Data Preservation**:

```
1. Read all v1 photos before deleting store
2. Transform field names (blob → imageBlob)
3. Delete old store
4. Create new v2 store with enhanced schema
5. Re-insert transformed photos
```

**Zero Data Loss**: Existing photos retained with compatible schema

## 3. IndexedDB v2 → v3 (Add Moods)

**Append-only Migration**:

```
1. Create new moods store (doesn't affect existing stores)
2. Existing messages and photos stores remain unchanged
3. No data transformation required
```

---
