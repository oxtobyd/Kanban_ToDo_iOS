# ToDo Kanban - iOS App

A modern, native iOS/macOS Kanban-style todo application built with Capacitor and vanilla JavaScript. Features drag-and-drop functionality, mobile touch gestures, task prioritization, tagging system, and automatic iCloud sync across all your Apple devices.

![ToDo Kanban](https://img.shields.io/badge/Status-Active-green) ![iOS](https://img.shields.io/badge/iOS-14+-blue) ![macOS](https://img.shields.io/badge/macOS-11+-blue) ![iCloud](https://img.shields.io/badge/iCloud-Sync-green)

## 📸 Screenshot

![Kanban Board Interface](docs/images/kanban-board-screenshot.png)

*The Kanban board showing tasks organized across four columns with priority indicators, tags, and pending workflow*

## ✨ Features

### 🎯 Core Functionality
- **Kanban Board Layout**: Four columns - To Do, In Progress, Pending, Done
- **Drag & Drop**: Move tasks between columns with smooth animations
- **Mobile Touch Gestures**: Swipe tasks left/right to change status on mobile devices
- **Task Management**: Create, edit, delete tasks with rich descriptions

### 🏷️ Organization & Filtering
- **Priority System**: Urgent, High, Medium, Low with visual indicators
- **Tagging System**: Add multiple tags to tasks for better organization
- **Search Functionality**: Real-time search across task titles and descriptions
- **Smart Filtering**: Filter by priority, tags, or search terms
- **Sorting Options**: Sort by priority, date, or title

### 📝 Advanced Features
- **Pending Workflow**: Special pending column with required reason tracking
- **Notes System**: Add, edit, and delete notes on individual tasks with file attachments
- **Subtasks**: Create and manage subtasks for complex task breakdown
- **File Attachments**: Drag and drop files into notes and subtasks
- **Clickable URLs**: Automatic detection and linking of URLs in task content
- **Status Management**: Set task status directly when creating/editing
- **Responsive Design**: Works seamlessly on iPhone, iPad, and Mac

### 🎨 User Experience
- **Modern UI**: Clean, professional design with smooth animations
- **Visual Feedback**: Priority badges, swipe indicators, and status colors
- **Keyboard Shortcuts**: Enter to save, Escape to cancel in modals
- **Touch-Friendly**: Optimized for mobile interaction

## 🚀 Quick Start

### Prerequisites
- macOS with Xcode 14+
- Apple Developer Account (for device testing and App Store)
- Node.js 18+ and npm
- iOS 14+ or macOS 11+ for target devices

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/oxtobyd/Kanban_ToDo_iOS.git
   cd Kanban_ToDo_iOS
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build for iOS**
   ```bash
   npm run cap:sync
   ```

4. **Open in Xcode**
   ```bash
   npx cap open ios
   ```

5. **Configure in Xcode**
   - Select your development team
   - Update bundle identifier if needed
   - Build and run on device or simulator

### iCloud Setup (Automatic)
- **No configuration needed** - iCloud sync works automatically
- Data syncs across all devices signed into the same Apple ID
- Works offline and syncs when connected

## 📱 Platform Support

### iOS (iPhone/iPad)
- **Native app** with full touch gestures and haptic feedback
- **Optimized UI** for mobile screens with collapsible columns
- **Swipe gestures** to move tasks between columns
- **File attachments** via drag and drop or file picker

### macOS (Mac Catalyst)
- **Native Mac app** with full keyboard shortcuts
- **Drag and drop** from Finder for file attachments
- **Window management** with proper Mac UI patterns
- **Menu bar integration** and standard Mac behaviors

## 📱 Usage Guide

### Creating Tasks
1. Click the "Add Task" button
2. Fill in title, description, priority, and tags
3. Set initial status (To Do, In Progress, Pending, Done)
4. If setting to Pending, provide a reason

### Moving Tasks
- **Desktop**: Drag and drop between columns
- **Mobile**: Swipe left (backward) or right (forward) to change status
- **Pending**: When moving to Pending, you'll be prompted for a reason

### Task Management
- **Edit**: Click the edit icon on any task
- **Delete**: Click the delete icon (with confirmation)
- **Notes**: Click the notes icon to add/edit task notes with file attachments
- **Subtasks**: Add and manage subtasks for complex task breakdown
- **File Attachments**: Drag files into notes or subtasks for easy reference

### Filtering & Search
- Use the search box for real-time filtering
- Filter by priority using the priority dropdown
- Filter by tags using the tags dropdown
- Sort by priority, date, or title

## 🏗️ Project Structure

```
Kanban_ToDo_iOS/
├── public/
│   ├── index-capacitor.html    # Main HTML for iOS app
│   ├── script-capacitor.js     # Frontend JavaScript with iOS features
│   ├── data-service.js         # iCloud sync and data management
│   ├── icloud-sync-proper.js   # iCloud Key-Value Store sync
│   ├── styles.css              # CSS styles
│   └── logo.svg                # Application logo
├── ios/
│   └── App/                    # iOS Xcode project
│       ├── App.xcodeproj/      # Xcode project file
│       ├── App/                # iOS app source
│       │   ├── AppDelegate.swift
│       │   ├── Info.plist      # App configuration
│       │   ├── App.entitlements # iCloud permissions
│       │   └── Assets.xcassets/ # App icons and images
│       └── Podfile             # CocoaPods dependencies
├── capacitor.config.json       # Capacitor configuration
├── build-capacitor.js          # Build script for iOS
└── package.json                # Node.js dependencies
```

## 🔧 Data Storage & Sync

### iCloud Integration
- **Automatic Sync**: Data syncs across all devices signed into the same Apple ID
- **Offline First**: Works without internet, syncs when connected
- **Real-time Updates**: Changes appear on other devices within seconds
- **Conflict Resolution**: Last-write-wins with timestamp comparison

### Data Storage
- **Local Storage**: Capacitor Preferences for immediate access
- **iCloud Key-Value Store**: For cross-device synchronization
- **File Attachments**: Stored in app's Documents directory with iCloud sync
- **No External Servers**: All data stays in your personal iCloud

## 🎨 Customization

### Styling
The application uses CSS custom properties for easy theming. Main colors can be modified in `public/styles.css`:

```css
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --success-color: #38a169;
  --warning-color: #f39c12;
  --danger-color: #e53e3e;
}
```

### Data Schema
The app's data structure supports:
- Tasks with status, priority, tags, and pending reasons
- Notes linked to tasks with file attachments
- Subtasks for task breakdown
- Timestamps for creation and updates
- File attachments with clickable links

## 🔒 Security Notes

- **iCloud Security**: All data is encrypted in transit and at rest by Apple
- **Local Storage**: Data is stored securely in the app's sandbox
- **Input Validation**: Frontend validation for all user inputs
- **No External Servers**: Data never leaves your personal iCloud account
- **Apple Privacy**: Follows Apple's privacy guidelines and data protection

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🐛 Troubleshooting

### Common Issues

**iCloud Not Syncing**
- Ensure you're signed into iCloud on all devices
- Check that iCloud Drive is enabled in Settings
- Verify the same Apple ID is used on all devices
- Try logging out and back into iCloud

**Build Errors in Xcode**
- Clean build folder: Product → Clean Build Folder
- Delete `ios/App/Pods` and run `npx cap sync ios`
- Ensure Xcode command line tools are installed
- Check that your Apple Developer account is properly configured

**File Attachments Not Working**
- Ensure the app has proper file access permissions
- Check that files are being saved to the Documents directory
- Verify iCloud Documents sync is enabled

## 📞 Support

If you encounter any issues or have questions:
1. Check the troubleshooting section above
2. Search existing [GitHub Issues](https://github.com/oxtobyd/Kanban_ToDo_iOS/issues)
3. Create a new issue with detailed information

## 🙏 Acknowledgments

- Built with Capacitor for native iOS/macOS performance
- iCloud sync powered by Apple's NSUbiquitousKeyValueStore
- Inspired by popular Kanban tools like Trello and Jira
- Icons and design patterns follow Apple's Human Interface Guidelines

---

**Made with ❤️ for Apple ecosystem productivity enthusiasts**