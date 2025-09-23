#!/bin/bash
set -euo pipefail

echo "Syncing public/ → www/ for Capacitor..."

mkdir -p www

# Mirror all assets from public to www, but we'll remap entrypoint and main script
rsync -av --delete \
  --exclude 'index.html' \
  --exclude 'script.js' \
  public/ www/

# Map Capacitor-specific entry and script names
cp public/index-capacitor.html www/index.html
cp public/script-capacitor.js www/script.js

echo "Files synced successfully! Running Capacitor sync..."

npx cap sync ios

echo "✅ Ready to test on iOS!"