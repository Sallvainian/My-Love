# IndexedDB Schema

## Database Configuration

```typescript
// src/services/storage.ts

const DB_NAME = 'my-love-db';
const DB_VERSION = 3;

const dbSchema = {
  stores: {
    photos: {
      keyPath: 'id',
      indexes: [
        { name: 'dateTaken', keyPath: 'dateTaken' },
        { name: 'createdAt', keyPath: 'createdAt' },
      ],
    },
    customMessages: {
      keyPath: 'id',
      indexes: [{ name: 'createdAt', keyPath: 'createdAt' }],
    },
    moodEntries: {
      keyPath: 'id',
      indexes: [
        { name: 'timestamp', keyPath: 'timestamp' },
        { name: 'userId', keyPath: 'userId' },
      ],
    },
    offlineQueue: {
      keyPath: 'id',
      indexes: [
        { name: 'createdAt', keyPath: 'createdAt' },
        { name: 'type', keyPath: 'type' },
      ],
    },
  },
};
```

## Migration Support

```typescript
// Database version upgrades
interface MigrationStep {
  version: number;
  migrate: (db: IDBDatabase) => void;
}

const migrations: MigrationStep[] = [
  {
    version: 2,
    migrate: (db) => {
      // Add mood entries store
      db.createObjectStore('moodEntries', { keyPath: 'id' });
    },
  },
  {
    version: 3,
    migrate: (db) => {
      // Add offline queue for sync
      db.createObjectStore('offlineQueue', { keyPath: 'id' });
    },
  },
];
```
