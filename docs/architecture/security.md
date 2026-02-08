# Security

| Layer | Mechanism | Implementation |
|---|---|---|
| **Data Access** | Supabase Row Level Security | All tables enforce that only the two partner users can access each other's data |
| **Authentication** | Supabase Auth | Email/password with JWT tokens, auto-refresh, session persistence |
| **XSS Prevention** | DOMPurify | Sanitizes all user-generated content before DOM insertion |
| **Input Validation** | Zod schemas | Runtime validation at all service boundaries before IndexedDB writes and API calls |
| **Secret Management** | dotenvx | Environment variables encrypted at rest, committed to repo safely |
| **Client Security** | No secrets in client code | All API access through Supabase client SDK with anon key (RLS enforces authorization) |
| **Content Security** | Validation limits | Max message length, max photo dimensions, max note length enforced via Zod |

---
