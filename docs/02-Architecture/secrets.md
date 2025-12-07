# Secrets & Environment Variables Documentation

> **IMPORTANT:** This document describes the structure and usage of secrets. NEVER commit actual secret values.

*Last Updated: 2025-12-07*

---

## Overview

This document describes all environment variables and secrets required for the My-Love PWA. Secrets are managed differently depending on where they're used:

| Secret Type | Storage Location | Access |
|-------------|------------------|--------|
| Client-safe | `.env` / `.env.local` | Browser bundle |
| Server-only | Supabase Edge Function secrets | Edge Functions only |
| CI/CD | GitHub Secrets | GitHub Actions |

---

## Supabase Configuration

### Client-Safe Variables

These variables are safe to include in the client bundle (exposed to browsers):

```bash
# Supabase Project URL
# Get from: Supabase Dashboard → Project Settings → API
VITE_SUPABASE_URL=https://[project-id].supabase.co

# Supabase Anonymous Key (Public/Publishable Key)
# This key is protected by Row Level Security (RLS)
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=[anon-key]
```

---

## Web Push (VAPID) Configuration

### What is VAPID?

VAPID (Voluntary Application Server Identification) authenticates Web Push notifications:
- Identifies your server to push services (Google FCM, Apple APNs, Mozilla)
- Prevents spoofing of push notifications
- Required by the Web Push protocol (RFC 8292)

### Key Types

| Key | Location | Purpose |
|-----|----------|---------|
| **Public Key** | `.env` (client) | Browser uses to subscribe to push service |
| **Private Key** | Supabase secrets | Server signs push requests |
| **Subject** | Supabase secrets | Contact email for push service operators |

### Generating VAPID Keys

```bash
# Install web-push CLI
npm install -g web-push

# Generate new keys
web-push generate-vapid-keys

# Output:
# Public Key: B[base64-encoded-string]
# Private Key: [base64-encoded-string]
```

### Client-Side Configuration

Add to `.env` or `.env.local`:

```bash
# VAPID Public Key (safe for client bundle)
VITE_VAPID_PUBLIC_KEY=[your-public-key]
```

### Server-Side Configuration (Supabase Edge Functions)

Set secrets via Supabase CLI:

```bash
# Set VAPID secrets for Edge Functions
supabase secrets set VAPID_PUBLIC_KEY=[your-public-key]
supabase secrets set VAPID_PRIVATE_KEY=[your-private-key]
supabase secrets set VAPID_SUBJECT=mailto:your-email@example.com

# Verify secrets are set
supabase secrets list
```

### Usage in Edge Functions

```typescript
// supabase/functions/send-push/index.ts
const vapidKeys = {
  publicKey: Deno.env.get('VAPID_PUBLIC_KEY')!,
  privateKey: Deno.env.get('VAPID_PRIVATE_KEY')!,
  subject: Deno.env.get('VAPID_SUBJECT')!,
};
```

---

## E2E Testing Configuration

### Test User Credentials

For Playwright E2E tests, test users are required:

```bash
# Primary test user
VITE_TEST_USER_EMAIL=[test-email]
VITE_TEST_USER_PASSWORD=[test-password]

# Partner test user (for multi-user tests)
VITE_TEST_PARTNER_EMAIL=[partner-email]
VITE_TEST_PARTNER_PASSWORD=[partner-password]
```

### Setup Test Users

```bash
# Automated setup
node scripts/setup-test-users.js

# Or manually via Supabase Dashboard → Authentication → Users
```

---

## CI/CD Secrets (GitHub Actions)

Required GitHub repository secrets:

| Secret Name | Description |
|-------------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anon key |
| `VITE_VAPID_PUBLIC_KEY` | VAPID public key |
| `VITE_TEST_USER_EMAIL` | E2E test user email |
| `VITE_TEST_USER_PASSWORD` | E2E test user password |
| `VITE_TEST_PARTNER_EMAIL` | E2E partner email |
| `VITE_TEST_PARTNER_PASSWORD` | E2E partner password |

### Setting GitHub Secrets

```bash
# Via GitHub CLI
gh secret set VITE_SUPABASE_URL
gh secret set VITE_VAPID_PUBLIC_KEY
# etc.

# Or via GitHub UI: Settings → Secrets and variables → Actions
```

---

## Security Best Practices

1. **Never commit secrets**: Add `.env.local` to `.gitignore`
2. **Rotate keys**: Generate new VAPID keys if compromised
3. **Use dotenvx**: Encrypt `.env` files for safe git commits
4. **Audit access**: Review who has access to Supabase project
5. **Service role key**: NEVER use in client code - bypasses RLS

---

## Secret Rotation Checklist

When rotating secrets:

- [ ] Generate new VAPID keys: `web-push generate-vapid-keys`
- [ ] Update `.env` with new public key
- [ ] Update Supabase secrets: `supabase secrets set ...`
- [ ] Update GitHub secrets
- [ ] Existing push subscriptions will need to re-subscribe

---

*See also: [Architecture Documentation](./architecture.md)*
