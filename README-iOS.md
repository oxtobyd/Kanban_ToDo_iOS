# ToDo Kanban - iOS App Setup

This guide will help you set up the ToDo Kanban app as a native iOS/macOS application with automatic iCloud sync.

## Prerequisites

- macOS with Xcode installed
- Apple Developer Account (for App Store distribution)
- Node.js and npm

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Build for Capacitor
```bash
npm run build
```

### 3. Open in Xcode
```bash
npx cap open ios
```

### 4. Configure iCloud in Xcode

1. **Select your project** in the navigator
2. **Select the App target**
3. **Go to "Signing & Capabilities" tab**
4. **Add Capability**: Click the "+" button and add:
   - **iCloud**
   - **Background App Refresh** (optional, for better sync)

5. **Configure iCloud**:
   - Check "CloudKit"
   - Check "CloudDocuments" 
   - Add container: `iCloud.com.fynesystems.kanbantodo`

6. **Update Bundle Identifier** (if needed):
   - Current: `com.fynesystems.kanbantodo`
   - Change to your actual bundle ID if needed
   - Make sure it matches your Apple Developer Account

### 5. Update App Configuration

1. **Current capacitor.config.json** (already configured):
   ```json
   {
     "appId": "com.fynesystems.kanbantodo",
     "appName": "ToDo Kanban"
   }
   ```

2. **Current entitlements file** (`ios/App/App/App.entitlements`):
   - Already configured with `com.fynesystems.kanbantodo`
   - Update only if you need a different bundle ID

### 6. Build and Run

1. **Select a target device** (iPhone/iPad simulator or physical device)
2. **Click the Play button** in Xcode to build and run

## Features

### ✅ What Works
- **Native iOS/macOS app** with full touch gestures
- **Automatic iCloud sync** - data syncs across all your Apple devices
- **Offline-first** - works without internet, syncs when connected
- **Drag & drop** task management
- **Swipe gestures** to move tasks between columns
- **Priority management** with visual indicators
- **Tags and filtering**
- **Notes and subtasks** with file attachments
- **File attachments** - drag files into notes and subtasks
- **Clickable URLs** - automatic detection in task content
- **Search functionality**
- **Export/Import** - backup and restore your data

### 🔄 Data Storage
- Uses **iCloud Key-Value Store** for automatic cross-device sync
- **File attachments** stored in iCloud Documents for larger files
- Data is stored locally and synced across devices signed into the same Apple ID
- No external server required - everything is stored in your personal iCloud
- **Conflict resolution** with timestamp-based last-write-wins

### 📱 Platform Support
- **iPhone** - Optimized for mobile with touch gestures
- **iPad** - Great for larger screens with drag & drop
- **macOS** - Can be built as a Mac Catalyst app

## Development Commands

```bash
# Build web assets for Capacitor
npm run build

# Sync changes to iOS project
npm run cap:sync

# Open in Xcode
npm run cap:ios

# For development with live reload (web only)
npm run dev
```

## Customization

### App Icon
Replace the icon files in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

### App Name
Currently set to "ToDo Kanban" in `capacitor.config.json` and `Info.plist`

### Bundle ID
Currently set to `com.fynesystems.kanbantodo`:
1. Update in `capacitor.config.json` if needed
2. Update in Xcode project settings if needed
3. Update in `App.entitlements` if needed
4. Sync with `npm run cap:sync`

## Troubleshooting

### iCloud Not Syncing
1. Ensure you're signed into iCloud on all devices
2. Check that iCloud Drive is enabled
3. Verify the bundle ID matches across all configurations
4. Try logging out and back into iCloud

### Build Errors
1. Clean build folder in Xcode (Product → Clean Build Folder)
2. Delete `ios/App/Pods` and run `npx cap sync ios`
3. Ensure Xcode command line tools are installed

### App Store Submission
1. Update bundle ID to match your Apple Developer Account
2. Configure proper signing certificates
3. Update app icons and metadata
4. Test on physical devices before submission

## Next Steps

1. **Customize the app** with your branding
2. **Test on multiple devices** to verify iCloud sync
3. **Add additional features** as needed
4. **Submit to App Store** when ready

The app is now ready to use with full iCloud synchronization across all your Apple devices!