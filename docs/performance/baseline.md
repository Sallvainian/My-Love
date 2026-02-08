# Performance Baseline

Date: 2026-02-07  
Commit: `f75703fdcfb18866be39ffe95cb26c3cca6d9612`

## Baseline (Pre-Remediation)

Source: `/Users/sallvain/Projects/My-Love/dist/assets` from the baseline commit.

| Chunk Group      | File                           |  Raw Size | Gzip Size |
| ---------------- | ------------------------------ | --------: | --------: |
| index            | `index-BwevuqlE.js`            | 379,694 B | 110,256 B |
| index            | `index-BFw1Cmnn.js`            |  42,764 B |  10,394 B |
| index            | `index-Bq-bIbbU.js`            |  41,486 B |  15,097 B |
| vendor-supabase  | `vendor-supabase-CywEAasM.js`  | 170,055 B |  44,278 B |
| vendor-animation | `vendor-animation-Bnii21FO.js` | 119,561 B |  39,457 B |
| vendor-state     | `vendor-state-DzYpuYgh.js`     |  73,011 B |  20,006 B |

### Baseline Build Observations

- Build graph showed startup pressure concentrated in the largest `index-*.js` chunk.
- Prior remediation anchor: ineffective dynamic import warning around `authService` in mixed static/dynamic import graph.

## Guardrails (Current Remediation Cycle)

- `index` startup pressure should decrease or stay flat with documented rationale.
- `vendor-supabase`, `vendor-animation`, and `vendor-state` gzip sizes should decrease or stay flat with documented rationale.
- Build should not reintroduce dynamic-import chunking warnings for auth paths.

## Post-Change Metrics

Source: `npm run perf:bundle-report` + `dist/assets` on 2026-02-07.

| Chunk Group                   | File                           |  Raw Size | Gzip Size | Delta vs Baseline                |
| ----------------------------- | ------------------------------ | --------: | --------: | -------------------------------- |
| index (largest startup chunk) | `index-A6-1I9H4.js`            | 340,712 B | 100,399 B | `-38,982 B raw`, `-9,857 B gzip` |
| index                         | `index-28XVZcBB.js`            |  43,322 B |  10,564 B | comparable                       |
| index                         | `index-BmyVZfYW.js`            |  41,516 B |  15,110 B | comparable                       |
| vendor-supabase               | `vendor-supabase-CywEAasM.js`  | 170,055 B |  44,278 B | unchanged                        |
| vendor-animation              | `vendor-animation-Bnii21FO.js` | 119,561 B |  39,457 B | unchanged                        |
| vendor-state                  | `vendor-state-DzYpuYgh.js`     |  73,011 B |  20,006 B | unchanged                        |

### Deferred Chunks Added

- `defaultMessages-DWHzF5_D.js` → 38,622 B raw / 8,860 B gzip (loaded on first-run seed path only)
- `motionFeatures-D6XL2AH5.js` → 143 B raw / 152 B gzip (loaded by `LazyMotion` feature loader)

### Build Warning Delta

- Prior auth graph warning about ineffective dynamic import of `authService` is no longer present.
- Residual warning: CSS minifier warning for unsupported property name (`[file:line]` artifact from generated CSS).

### Status Against Guardrails

- Startup `index` pressure: **PASS** (reduced).
- `vendor-*` chunk guardrails: **PASS with no regressions** (flat).
- Auth dynamic-import warning removal: **PASS**.
