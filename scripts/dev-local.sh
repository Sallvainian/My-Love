#!/usr/bin/env bash
# npm run dev:local — Vite in test mode against this checkout's local Supabase.
#
# With the stack backend ([experimental] stack in supabase/config.toml) every
# worktree and branch has its own local Supabase on its own ports, so the URL
# comes from `supabase status`, not from .env.test (whose fixed
# http://127.0.0.1:54321 is only the classic backend's default). The stack
# backend answers `status --env`; the classic one (SUPABASE_EXPERIMENTAL_STACK=0)
# answers `status -o env`.
set -euo pipefail
cd "$(dirname "$0")/.."

env_out=$(supabase status --env --output-format text 2>/dev/null || true)
[[ $env_out == *API_URL=* ]] || env_out=$(supabase status -o env 2>/dev/null || true)
value() { sed -n "s/^$1=[\"']\(.*\)[\"']\$/\1/p" <<<"$env_out"; }

url=$(value API_URL)
if [[ -z $url ]]; then
  echo "dev:local: no local Supabase answers in this checkout; run npm run supabase:up" >&2
  exit 1
fi
export VITE_SUPABASE_URL=$url
key=$(value PUBLISHABLE_KEY)
[[ -n $key ]] && export VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=$key
exec npx vite --mode test "$@"
