# IndexedDB Service Patterns

## Service Hierarchy

```
BaseIndexedDBService<T, DBSchema>
  ├── PhotoStorageService extends BaseIndexedDBService<Photo>
  ├── CustomMessageService extends BaseIndexedDBService<Message>
  └── MoodService extends BaseIndexedDBService<MoodEntry, MyLoveDBSchema>

StorageService (legacy, not inherited)
  ├── Photo operations
  └── Message operations
```

## Initialization Pattern

```typescript
class MyService extends BaseIndexedDBService<MyType> {
  protected async _doInit(): Promise<void> {
    this.db = await openDB<MySchema>('my-love-db', VERSION_NUMBER, {
      upgrade(db, oldVersion, newVersion) {
        // Create/migrate object stores
        if (!db.objectStoreNames.contains('mystore')) {
          const store = db.createObjectStore('mystore', {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('by-date', 'createdAt');
        }
      },
    });
  }

  protected getStoreName(): string {
    return 'mystore';
  }
}

// Usage: automatic initialization
await myService.init(); // Called by first operation if not done
```

## CRUD Operations

**Create**:

```typescript
const created = await service.add({
  /* data */
});
// Returns: { ...data, id: <auto-incremented> }
```

**Read**:

```typescript
const item = await service.get(id); // Single item or null
const items = await service.getAll(); // All items or []
const page = await service.getPage(offset, limit); // Paginated or []
```

**Update**:

```typescript
await service.update(id, {
  /* partial updates */
});
// Throws error if id not found
```

**Delete**:

```typescript
await service.delete(id);
// Throws error if id not found
```

**Clear**:

```typescript
await service.clear();
// Throws error if operation fails
```

## Database Versions & Migrations

| Service              | Version | Stores           | Key Features          |
| -------------------- | ------- | ---------------- | --------------------- |
| StorageService       | 3       | messages, photos | Baseline              |
| PhotoStorageService  | 2       | photos           | Enhanced schema v1→v2 |
| CustomMessageService | 1       | messages         | Initial version       |
| MoodService          | 3       | moods            | Unique by-date index  |

**Migration Pattern** (v2 → v3 for moods):

```typescript
async upgrade(db, oldVersion, newVersion) {
  if (oldVersion < 3) {
    // Create new moods store with unique date index
    const moods = db.createObjectStore('moods', {
      keyPath: 'id',
      autoIncrement: true,
    });
    moods.createIndex('by-date', 'date', { unique: true });
  }
}
```

---
