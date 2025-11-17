# Performance Monitoring

## Measured Operations

**Photo Operations**:

- `photo-create`: Create new photo
- `photo-getAll`: Load all photos
- `photo-getPage`: Paginated load

**Database Operations**:

- `db-read`: Single item read
- `db-write`: Insert/update operation
- `db-query`: Complex query

**Service Operations**:

- `sync-mood`: Sync single mood
- `sync-batch`: Batch sync moods

**Custom Metrics**:

- `photo-size-kb`: Photo size tracking
- `compression-ratio`: Compression effectiveness

## Performance Report Example

```
Performance Metrics Report
==================================================

photo-getAll:
  count: 5
  avg: 45.32ms
  min: 12.10ms
  max: 89.20ms
  total: 226.60ms

db-write:
  count: 12
  avg: 23.15ms
  min: 5.20ms
  max: 67.80ms
  total: 277.80ms

sync-mood:
  count: 3
  avg: 234.56ms
  min: 145.20ms
  max: 356.80ms
  total: 703.68ms
```

---
