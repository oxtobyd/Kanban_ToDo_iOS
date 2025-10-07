# Visual Debug Guide for Offline Testing

Since you can't see console logs when testing offline in Xcode, I've created a visual debugging system that shows debug info directly in your app.

## 🐛 How to Access the Visual Debugger

### Method 1: Debug Button
- Look for the **🐛 orange button** in the top-right corner of your app
- Tap it to open/close the debug panel

### Method 2: Triple-Tap
- **Triple-tap anywhere** on the screen quickly
- This will toggle the debug panel on/off

## 📊 What the Debug Panel Shows

When you open the debug panel, it automatically runs diagnostics and shows:

### ✅ **Network Status**
- `ONLINE` (green) or `OFFLINE` (orange)

### 💾 **localStorage Data**
- How many tasks/notes/subtasks are stored locally
- **Green**: Data found
- **Orange**: No data found

### 🔧 **Data Service Status**
- How many items are loaded in RobustDataService
- **Green**: Data loaded successfully
- **Orange**: No data in service

### 🎨 **UI Status**
- How many tasks are displayed in the app
- **Green**: Tasks visible
- **Orange**: No tasks shown

### ☁️ **Sync Provider**
- Whether cloud sync is available

## 🧪 Testing Steps for Offline Cold Start

### 1. **Setup Test Data** (while online)
1. Start app with internet connection
2. Create 2-3 test tasks
3. Wait for sync to complete
4. Force quit the app completely

### 2. **Test Offline Cold Start**
1. **Turn off WiFi/cellular completely**
2. **Launch app from scratch**
3. **Immediately tap the 🐛 button** (top-right)
4. **Check the diagnostics**:
   - Network should show `OFFLINE`
   - localStorage should show your tasks (e.g., "3 tasks")
   - DataService should show same number
   - UI should show same number

### 3. **If No Data Shows**
The debug panel will help identify where the problem is:

#### **Problem: localStorage shows 0 tasks**
- **Cause**: Data was never saved locally
- **Solution**: Create tasks while online first

#### **Problem: localStorage has data, but DataService shows 0**
- **Cause**: Error loading from localStorage
- **Solution**: Use "Test localStorage Load" button

#### **Problem: DataService has data, but UI shows 0**
- **Cause**: UI not refreshing
- **Solution**: Use "Test UI Refresh" button

## 🔧 Debug Panel Buttons

### **Clear**
- Clears the debug log (top-right of debug panel)

### **Test localStorage Load** (manual test)
- Forces the data service to reload from localStorage
- Use if DataService shows 0 but localStorage has data

### **Test UI Refresh** (manual test)
- Forces the UI to reload tasks
- Use if DataService has data but UI shows 0

### **Create Test Task** (manual test)
- Creates a new test task to verify functionality
- Use to test if offline task creation works

## 📱 Real-Time Logging

The debug panel shows real-time logs as the app initializes:
```
[timestamp] Initializing RobustDataService...
[timestamp] Loaded from localStorage: 3 tasks, 2 notes, 1 subtasks
[timestamp] DataService initialized: 3 tasks, 2 notes, 1 subtasks
[timestamp] Loading tasks with filters: {...}
[timestamp] UI loaded 3 tasks
```

## 🎯 Expected Results for Working Offline Mode

When you cold start offline, you should see:
- ✅ Network: `OFFLINE`
- ✅ localStorage: `X tasks, Y notes, Z subtasks` (your data)
- ✅ DataService: Same numbers as localStorage
- ✅ UI: Same numbers, tasks visible in kanban board

## 🚨 Troubleshooting

### **Debug Panel Won't Open**
- Try triple-tapping the screen
- Make sure you're tapping quickly (within 500ms)
- Look for the 🐛 button in top-right corner

### **No Debug Button Visible**
- The visual debugger might not have loaded
- Check if you ran `npm run cap:sync` after the changes

### **App Crashes When Opening Debug Panel**
- There might be a JavaScript error
- Try creating a simple test task first while online

## 📋 Testing Checklist

- [ ] App starts offline without errors
- [ ] Debug panel opens (🐛 button or triple-tap)
- [ ] localStorage shows your test data
- [ ] DataService shows same data
- [ ] UI displays the tasks
- [ ] Can create new tasks offline
- [ ] Can edit existing tasks offline
- [ ] Data persists after app restart

This visual debugging system will help you identify exactly where the offline data loading breaks down, even without access to console logs!