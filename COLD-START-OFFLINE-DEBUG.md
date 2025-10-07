# Cold Start Offline Debug Guide

## What Should Happen When Cold Starting Offline

### 1. **Data Service Initialization**
```javascript
// This happens FIRST in RobustDataService.init()
await this.loadFromLocalStorage();
```
- Loads `kanban_tasks` from localStorage → `this.tasks` array
- Loads `kanban_notes` from localStorage → `this.notes` array  
- Loads `kanban_subtasks` from localStorage → `this.subtasks` array
- **Result**: Data service has your data immediately

### 2. **Cloud Sync Attempt (Background)**
```javascript
// This runs with 10-second timeout
const cloudData = await Promise.race([
    window.RobustiCloudSync.loadFromiCloud(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
]);
```
- **If Offline**: Times out, logs "Cloud sync failed (offline)"
- **If Online**: Merges cloud data with local data
- **Critical**: Local data is NEVER cleared

### 3. **UI Initialization**
```javascript
await this.loadTasks(); // Calls window.RobustDataService.getTasks()
```
- Gets tasks from data service
- Renders them in the UI
- Should show your data immediately

## Debugging Steps

### Step 1: Check Console Logs
Look for these logs in Xcode console when cold starting offline:

```
✅ Expected logs:
[log] - Initializing RobustDataService...
[log] - Loading from local storage first for offline support...
[log] - RobustDataService initialized, data loaded: {"tasks":X,"notes":Y,"subtasks":Z}
[log] - Loading initial tasks...
[log] - getTasks called with filters: {...}
[log] - Total tasks in data service: X
[log] - Tasks loaded from RobustDataService: X
```

```
❌ Problem indicators:
[log] - Total tasks in data service: 0
[log] - Tasks loaded from RobustDataService: 0
[error] - Error loading tasks: ...
```

### Step 2: Check localStorage in Safari Web Inspector
1. Connect device to Mac
2. Open Safari → Develop → [Your Device] → [Your App]
3. In console, run:
```javascript
// Check if data exists in localStorage
localStorage.getItem('kanban_tasks')
localStorage.getItem('kanban_notes') 
localStorage.getItem('kanban_subtasks')
```

### Step 3: Manual Data Service Check
In Safari console:
```javascript
// Check data service state
window.RobustDataService.tasks.length
window.RobustDataService.getTasks().length

// Test loading from localStorage manually
await window.RobustDataService.loadFromLocalStorage()
window.RobustDataService.tasks.length
```

### Step 4: Force UI Refresh
In Safari console:
```javascript
// Force reload tasks
await window.app.loadTasks()

// Check app state
window.app.tasks.length
```

## Common Issues & Solutions

### Issue 1: No Data in localStorage
**Symptom**: `localStorage.getItem('kanban_tasks')` returns `null`
**Cause**: No data was ever saved locally
**Solution**: Create some tasks while online first, then test offline

### Issue 2: Data Service Not Loading from localStorage
**Symptom**: localStorage has data but `window.RobustDataService.tasks.length` is 0
**Cause**: Error in `loadFromLocalStorage()` method
**Solution**: Check console for JSON parsing errors

### Issue 3: UI Not Displaying Data
**Symptom**: Data service has tasks but UI shows empty
**Cause**: UI not calling `getTasks()` or rendering issue
**Solution**: Check `loadTasks()` method and `renderTasks()`

### Issue 4: Timing Issues
**Symptom**: Intermittent loading, sometimes works
**Cause**: Race condition between data service init and UI load
**Solution**: Added retry logic and secondary load

## Testing Procedure

### 1. **Setup Test Data**
1. Start app while online
2. Create 2-3 test tasks
3. Verify they sync to cloud
4. Force quit app

### 2. **Test Offline Cold Start**
1. Turn off WiFi/cellular completely
2. Launch app from scratch
3. **Expected**: Tasks appear immediately
4. **If not**: Follow debugging steps above

### 3. **Verify Offline Functionality**
1. Create new task while offline
2. Edit existing task
3. Delete a task
4. **Expected**: All operations work, data persists

### 4. **Test Online Recovery**
1. Turn WiFi/cellular back on
2. **Expected**: Automatic sync, no data loss

## Debug Console Commands

Add these to your testing:

```javascript
// Quick status check
console.log('=== OFFLINE STATUS ===');
console.log('Online:', navigator.onLine);
console.log('localStorage tasks:', localStorage.getItem('kanban_tasks') ? JSON.parse(localStorage.getItem('kanban_tasks')).length : 0);
console.log('DataService tasks:', window.RobustDataService?.tasks?.length || 0);
console.log('App tasks:', window.app?.tasks?.length || 0);

// Force data reload
await window.RobustDataService.loadFromLocalStorage();
await window.app.loadTasks();

// Check sync status
window.RobustDataService.getSyncStatus();
```

## Expected Behavior Summary

- ✅ **Cold start offline**: Shows existing data immediately
- ✅ **No network delay**: Data loads from localStorage instantly  
- ✅ **Full functionality**: Create/edit/delete works offline
- ✅ **Automatic recovery**: Syncs when back online
- ✅ **No data loss**: Local changes preserved and merged

If any of these don't work, use the debugging steps above to identify the issue.