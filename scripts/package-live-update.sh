#!/usr/bin/env bash
# Packages dist/ as a live update for the native shell (src/services/nativeUpdates.ts):
#   dist/updates/bundle-<id>.zip  the built site, index.html at the zip's root
#   dist/updates/latest.json      { version, url, checksum } that the shell checks
#
# Run after the build, with the same GITHUB_SHA the build saw: vite.config.ts
# bakes it in as __BUILD_ID__, and the shell downloads only when the two differ.
# UPDATE_BASE_URL points the zip's url elsewhere, e.g. at `wrangler dev` for a
# local test.

set -euo pipefail

BUILD_ID="${GITHUB_SHA:?GITHUB_SHA must name the build in dist/}"
BASE_URL="${UPDATE_BASE_URL:-https://my-love.sallvain.workers.dev}"
DIST="dist"

# A build made without this GITHUB_SHA carries a different __BUILD_ID__, and a
# shell running it would download its own build again on every launch.
# Matched as a quoted string literal: a bare substring check finds short ids
# inside unrelated code ("nope" in "onopen").
if ! grep -rqE "[\"'\`]$BUILD_ID[\"'\`]" "$DIST/assets"; then
  echo "❌ $DIST/assets does not contain build id $BUILD_ID; build with the same GITHUB_SHA first" >&2
  exit 1
fi

rm -rf "$DIST/updates"
mkdir -p "$DIST/updates"

ZIP_NAME="bundle-$BUILD_ID.zip"
# stats.html never reaches the site (.assetsignore), so it stays out of the bundle too.
(cd "$DIST" && zip -qr "../$ZIP_NAME" . -x 'stats.html' -x 'updates/*')
mv "$ZIP_NAME" "$DIST/updates/$ZIP_NAME"

if command -v sha256sum >/dev/null; then
  CHECKSUM=$(sha256sum "$DIST/updates/$ZIP_NAME" | cut -d' ' -f1)
else
  CHECKSUM=$(shasum -a 256 "$DIST/updates/$ZIP_NAME" | cut -d' ' -f1)
fi

cat > "$DIST/updates/latest.json" <<EOF
{
  "version": "$BUILD_ID",
  "url": "$BASE_URL/updates/$ZIP_NAME",
  "checksum": "$CHECKSUM"
}
EOF

echo "✅ Live update $BUILD_ID packaged ($(du -h "$DIST/updates/$ZIP_NAME" | cut -f1), sha256 $CHECKSUM)"
