# iCloud Sync Test Guide

## What We Fixed

1. **Dual Sync System**: Now using both Capacitor Preferences (for local backup) AND Capacitor Filesystem (for iCloud Documents sync)
2. **Manual Sync Button**: Added working manual sync functionality with visual feedback
3. **Automatic Sync**: Data automatically saves to iCloud Documents when you add/edit tasks
4. **Startup Sync**: App checks for newer iCloud data on startup

## How to Test iCloud Sync

### Step 1: Verify Setup
1. Build and run the app on your iPhone
2. Open Safari Developer Tools (if testing in simulator)
3. Look for these console messages:
   - `"iCloud Sync Service initialized"`
   - `"Capacitor Plugins available: [...]"`

### Step 2: Test Data Saving
1. **Add a new task** on iPhone
2. Look for console logs:
   - `"Saving to iCloud Documents: {tasks: X, notes: Y, subtasks: Z}"`
   - `"Successfully saved to iCloud Documents"`

### Step 3: Test Manual Sync
1. **On iPad**: Tap the sync button (refresh icon in header)
2. Look for console logs:
   - `"Manual sync requested..."`
   - `"Loading from iCloud Documents..."`
   - `"Manual sync completed"`

### Step 4: Test Cross-Device Sync
1. **iPhone**: Add a task called "Test from iPhone"
2. **iPad**: Tap the manual sync button
3. **iPad**: You should see the new task appear

## Expected Console Messages

### On App Start:
```
iCloud Sync Service initialized
Loading from iCloud...
Found iCloud Documents data, checking if newer...
```

### When Adding/Editing Tasks:
```
Saving to iCloud: {tasks: 1, notes: 0, subtasks: 0}
Capacitor Plugins available: ["Filesystem", "Preferences", ...]
Saving to iCloud Documents: {tasks: 1, notes: 0, subtasks: 0, directory: "DOCUMENTS", path: "kanban-data.json"}
Successfully saved to iCloud Documents
```

### When Manual Sync:
```
Manual sync requested...
Loading from iCloud Documents...
Loaded from iCloud Documents: {tasks: 1, notes: 0, subtasks: 0, lastSync: "2025-01-09T..."}
Manual sync completed
```

## Troubleshooting

### If Sync Doesn't Work:
1. **Check iCloud Settings**: Make sure iCloud Drive is enabled for your app
2. **Check Entitlements**: Verify `App.entitlements` has correct iCloud container ID
3. **Check Console**: Look for error messages in Safari Developer Tools
4. **Force Restart**: Close app completely and reopen

### Common Issues:
- **"Filesystem plugin not available"**: Capacitor not properly initialized
- **"File does not exist"**: First time setup (normal)
- **No sync logs**: Check if running on simulator vs real device

## Key Files Modified:
- `public/script-capacitor.js`: Added `manualSync()` function
- `public/data-service.js`: Integrated iCloud Documents sync
- `public/icloud-sync.js`: Core iCloud sync logic
- `public/index-capacitor.html`: Fixed function calls
- `public/styles.css`: Added sync button animations

## Next Steps:
1. Test on real iOS devices (not simulator)
2. Verify sync works between multiple devices
3. Test with larger datasets
4. Monitor for any sync conflicts