# Step-by-Step Debug Guide

The issue is clear: `Capacitor Preferences: 0 tasks` means no data has been saved to local storage yet.

## 🧪 **Testing Steps to Identify the Issue**

### **Step 1: Test Save Functionality**
1. Run `npm run cap:sync` to get the enhanced debugging
2. Launch app (online or offline doesn't matter for this test)
3. Open debug panel (🐛 button)
4. **Click "Test Save" button** (new green button next to Clear)
5. Watch the debug logs carefully

**Expected logs:**
```
Creating test task...
Test task created with ID: [number]
Checking storage after save...
About to save to Capacitor Preferences: {...}
Saved to Capacitor Preferences - verification: {...}
Storage check: 1 tasks in Capacitor Preferences ✅
```

**If you see errors here, that's the root cause.**

### **Step 2: Test Online Data Creation**
1. Make sure you have internet connection
2. Create a real task through the UI (not test button)
3. Check debug panel - should show the task was saved
4. Force quit app completely
5. Launch offline and check debug panel

### **Step 3: Check Capacitor Preferences Plugin**
If Step 1 fails, the issue might be the Capacitor Preferences plugin:

1. In debug panel, check if you see:
   - `Checking Capacitor Preferences...` (should appear)
   - Any error messages about Preferences plugin

## 🔍 **Possible Issues & Solutions**

### **Issue 1: Capacitor Preferences Plugin Not Working**
**Symptoms:** 
- "Test Save" button shows errors
- Debug shows "Checking web localStorage..." instead of "Checking Capacitor Preferences..."

**Solution:** Check if Capacitor Preferences plugin is properly installed:
```bash
npm ls @capacitor/preferences
npx cap sync ios
```

### **Issue 2: Data Created Before the Fix**
**Symptoms:**
- You have tasks in Supabase
- But `Capacitor Preferences: 0 tasks`
- App worked online but not offline

**Cause:** Tasks were created before the Capacitor Preferences fix, so they were saved to web localStorage (which doesn't persist) instead of Capacitor Preferences.

**Solution:** 
1. Start app online (to download from Supabase)
2. Create one new task (to trigger save to Capacitor Preferences)
3. Test offline

### **Issue 3: Import Not Saving Locally**
**Symptoms:**
- App loads data from Supabase when online
- But doesn't save it to Capacitor Preferences

**Cause:** The `importData` method might not be calling `saveToLocalStorage`

**Check:** Look for this log when starting online:
```
Import completed - skipping save to avoid overwriting newer data
```

If you see this, the import is NOT saving to local storage.

## 🎯 **Quick Test Sequence**

### **Test A: Can We Save At All?**
1. Open debug panel
2. Click "Test Save" button
3. **Result:** Should show 1 task in Capacitor Preferences

### **Test B: Does Online Import Save Locally?**
1. Start app online (with existing Supabase data)
2. Check debug panel immediately
3. **Expected:** Should show tasks in Capacitor Preferences
4. **If not:** Import is not saving locally

### **Test C: Does Manual Task Creation Save?**
1. Create a task through normal UI
2. Check debug panel
3. **Expected:** Should show increased task count in Capacitor Preferences

## 🔧 **Most Likely Issue**

Based on your logs, I suspect **Issue 2**: You have data in Supabase that was created before the Capacitor Preferences fix. The data exists in the cloud but was never saved to Capacitor Preferences.

**Quick Fix Test:**
1. Start app online
2. Create ONE new task through the UI
3. Check if debug panel shows `Capacitor Preferences: 1 tasks`
4. If yes, go offline and test - should work now

## 📊 **What the Enhanced Debug Will Show**

The new debugging will show exactly:
- Whether Capacitor Preferences plugin is working
- Whether saves are actually writing to storage
- Whether the verification after save succeeds
- Detailed step-by-step save process

This will pinpoint exactly where the chain breaks: Plugin → Save → Verification → Load.