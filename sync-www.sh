#!/bin/bash

# Sync public directory to www directory for Capacitor
echo "Syncing public/ to www/ for Capacitor..."

# Copy updated files
cp public/script-capacitor.js www/script.js
cp public/data-service.js www/
cp public/styles.css www/
cp public/icloud-sync.js www/
cp public/index-capacitor.html www/index.html

echo "Files synced successfully!"
echo "Running Capacitor sync..."

# Sync with Capacitor
npx cap sync ios

echo "✅ Ready to test on iOS!"