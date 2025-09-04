# Legacy Docker Setup (Deprecated)

> **Note**: This app has been converted to a native iOS/macOS app with iCloud sync. The Docker setup below is for reference only and is no longer actively maintained.

## Previous Web Version (PostgreSQL-based)

This documentation refers to the previous web-based version that used PostgreSQL and Docker. The current version is a native iOS/macOS app with iCloud sync.

### What Changed
- **Storage**: PostgreSQL → iCloud Key-Value Store + iCloud Documents
- **Platform**: Web app → Native iOS/macOS app
- **Sync**: Manual → Automatic iCloud sync
- **Deployment**: Docker containers → App Store distribution

### Current Architecture
- **Frontend**: Native iOS/macOS app built with Capacitor
- **Storage**: iCloud Key-Value Store for data, iCloud Documents for files
- **Sync**: Automatic across all Apple devices
- **No servers required**: Everything runs locally and syncs via iCloud

## For Current iOS App Development

If you need to work on the web version for development:

```bash
# Install dependencies
npm install

# Run development server (web only)
npm run dev

# Build for iOS
npm run cap:sync

# Open in Xcode
npx cap open ios
```

## Migration Notes

### Data Migration
If you have data from the PostgreSQL version:
1. Export your data using the web interface
2. Import it into the iOS app using the import feature
3. Data will automatically sync to iCloud

### Development Workflow
1. Make changes to `public/script-capacitor.js` and `public/styles.css`
2. Run `npm run cap:sync` to update the iOS project
3. Build and test in Xcode

## Legacy Docker Commands (Reference Only)

The following commands were used in the previous PostgreSQL-based version:

```bash
# Start with Docker PostgreSQL
docker-compose up -d

# Start with local PostgreSQL
docker-compose -f docker-compose.local-db.yml up -d

# View logs
docker-compose logs -f todo-app

# Stop services
docker-compose down
```

## Current iOS App Troubleshooting

For the current iOS app, see the main README.md and README-iOS.md files for troubleshooting guidance.

### Common iOS Issues
- **iCloud sync problems**: Check Apple ID sign-in and iCloud Drive settings
- **Build errors**: Clean Xcode build folder and sync with `npm run cap:sync`
- **File attachments**: Ensure proper permissions and iCloud Documents sync

## Legacy Environment Variables (Reference)

The previous PostgreSQL version used these environment variables:
```env
PORT=3012
DB_HOST=postgres
DB_PORT=5432
DB_NAME=todo_app
DB_USER=postgres
DB_PASSWORD=your_secure_password
```

## Migration Benefits

The move from PostgreSQL/Docker to iCloud provides:
- ✅ **No server maintenance** - Apple handles all infrastructure
- ✅ **Automatic sync** - Works across all Apple devices instantly
- ✅ **Better security** - Apple's encryption and privacy protection
- ✅ **Offline support** - Works without internet connection
- ✅ **Native performance** - Full iOS/macOS integration
- ✅ **App Store distribution** - Easy updates and installation