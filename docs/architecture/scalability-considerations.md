# Scalability Considerations

## Current Design (2-User Scope)

The app is designed for exactly two users (a couple). This simplifies several architectural decisions:

- **RLS policies** assume a partner pair, not arbitrary user groups
- **Realtime subscriptions** filter by single partner user ID
- **IndexedDB** stores all data locally (no multi-tenant concerns)
- **Background Sync** syncs all pending items without user-scoping conflicts

## Growth Path (If Needed)

If the app were to support multiple couples or group features:

| Concern | Current | Growth Path |
|---|---|---|
| **Data isolation** | RLS with partner_id lookup | Introduce `couple_id` grouping table |
| **Realtime** | Direct user ID filter | Channel per couple/group |
| **IndexedDB** | Single user's data | Prefix stores with user ID |
| **Auth** | Two hardcoded partner slots | Dynamic partner management |
| **Storage** | Local-first for all data | Selective sync with server pagination |

These changes are not currently needed and should only be pursued if the user base grows beyond the couple use case.
