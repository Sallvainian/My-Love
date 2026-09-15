# Proposed DW dispositions

These are session proposals only; the live deferred-work ledger remains untouched.

| DW | Verified baseline | Proposed treatment |
| --- | --- | --- |
| 100, 101 | Done in ledger, implemented and 117 guard tests passing | Preserve; extend relevant initialization coverage |
| 102 | No rendered AdminPanel ownership test | Add real service/store/UI regression |
| 103 | Delete dialog closes before rejected async deletion settles | Fix pending/failure/retry behavior |
| 117, 119 | Raw IndexedDB reaches UI and sync payload | Shared normalization and boundary regressions |
| 118 | Unknown elements can crash icon consumers or render unknown values | Validate elements and scalar fallback |
| 120 | Same exposure as 117/119; contradicts earlier reachability rationale | Resolve through shared sync-boundary work, not separate change |
| 121 | Speculative literal-idiom enforcement | Defer custom lint rule; shared helper/behavior tests replace duplicated normalization |
| 122 | Duplicated normalization and runtime key lists | Canonical vocabulary/normalizer; preserve different UI styling |
| 127 | Unrestricted update fields allow ownership changes | Owner-only transaction and editable-field allowlist |
| 128 | Visibility-based update/delete permit shared daily mutation | Separate readable shared messages from writable owned custom rows |
| 129 | Shared row favorite and global persisted favoriteIds | Approved account-keyed IndexedDB migration and session/hydration reset |

No candidate was found actively owned in the inspected loop state. Recheck before any resumed work.
