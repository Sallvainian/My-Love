# Summary Statistics

## Store Complexity

| Metric                       | Value                        |
| ---------------------------- | ---------------------------- |
| **Total Slices**             | 7                            |
| **Actions (Total)**          | ~65                          |
| **State Fields**             | ~40+                         |
| **Persistence Types**        | 2 (LocalStorage + IndexedDB) |
| **External Services**        | 10+                          |
| **Cross-Slice Dependencies** | 1 (Settings → Messages)      |

## Slice Breakdown

| Slice        | Actions | State Fields | Async  |
| ------------ | ------- | ------------ | ------ |
| Settings     | 7       | 2            | 1      |
| Messages     | 16      | 6            | 8      |
| Photos       | 8       | 5            | 4      |
| Mood         | 7       | 3            | 6      |
| Partner      | 8       | 6            | 5      |
| Interactions | 8       | 3            | 5      |
| Navigation   | 5       | 1            | 0      |
| **Total**    | **59**  | **26**       | **29** |

## Persistence Breakdown

| Data           | Size     | Storage                  | Schema Version |
| -------------- | -------- | ------------------------ | -------------- |
| settings       | 1-2KB    | LocalStorage             | v0             |
| messageHistory | 1-5KB    | LocalStorage             | v0             |
| moods          | 1-10KB   | LocalStorage + IndexedDB | v0             |
| messages       | Variable | IndexedDB                | Auto-increment |
| customMessages | Variable | IndexedDB                | Auto-increment |
| photos         | Variable | IndexedDB (Blobs)        | Auto-increment |
| interactions   | 0        | Ephemeral                | -              |

---
