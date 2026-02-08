# Navigation System

The app uses a custom navigation system without a client-side router library.

**Views:** `home`, `photos`, `mood`, `partner`, `notes`, `scripture`

**URL mapping:**
| View | Path |
|---|---|
| `home` | `/` |
| `photos` | `/photos` |
| `mood` | `/mood` |
| `partner` | `/partner` |
| `notes` | `/notes` |
| `scripture` | `/scripture` |

**Implementation:**
- `navigationSlice.setView(view)` updates Zustand state and calls `history.pushState()`
- `popstate` event listener syncs browser back/forward to Zustand state
- `BottomNavigation` component renders tab buttons bound to `setView()`
- Production paths are prefixed with `/My-Love/` (GitHub Pages base path)
- Admin route (`/admin`) is detected separately and renders `AdminPanel`

---
