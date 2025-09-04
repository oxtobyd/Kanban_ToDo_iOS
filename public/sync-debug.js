// iCloud Sync Debug Script
class SyncDebugger {
    constructor() {
        this.isCapacitor = window.Capacitor && window.Capacitor.isNativePlatform();
    }

    async runDiagnostics() {
        console.log('=== iCloud Sync Diagnostics ===');
        console.log('Platform:', this.isCapacitor ? 'Native (Capacitor)' : 'Web');
        
        if (!this.isCapacitor) {
            console.log('Not running on native platform - sync not available');
            return;
        }

        // Check available plugins
        console.log('Available Capacitor Plugins:', Object.keys(window.Capacitor.Plugins));
        
        // Check iCloud sync service
        if (window.iCloudSync) {
            console.log('iCloud Sync Service: Available');
            
            // Test iCloud availability
            try {
                const availability = await window.iCloudSync.checkiCloudAvailability();
                console.log('iCloud Availability:', availability);
            } catch (error) {
                console.error('Error checking iCloud availability:', error);
            }
            
            // Test file operations
            await this.testFileOperations();
            
        } else {
            console.log('iCloud Sync Service: NOT AVAILABLE');
        }
        
        // Check data service
        if (window.dataService) {
            console.log('Data Service: Available');
            await this.testDataService();
        } else {
            console.log('Data Service: NOT AVAILABLE');
        }
        
        console.log('=== Diagnostics Complete ===');
    }

    async testFileOperations() {
        console.log('--- Testing File Operations ---');
        
        try {
            const { Filesystem, Directory } = window.Capacitor.Plugins;
            
            // Test directory listing
            try {
                const dirContents = await Filesystem.readdir({
                    path: '',
                    directory: 'DOCUMENTS'
                });
                console.log('Documents directory contents:', dirContents);
            } catch (error) {
                console.log('Error reading Documents directory:', error);
            }
            
            // Test file write
            try {
                const testData = { test: true, timestamp: Date.now() };
                await Filesystem.writeFile({
                    path: 'sync-debug-test.json',
                    data: JSON.stringify(testData),
                    directory: 'DOCUMENTS',
                    encoding: 'utf8',
                    recursive: true
                });
                console.log('Test file write: SUCCESS');
                
                // Test file read
                const result = await Filesystem.readFile({
                    path: 'sync-debug-test.json',
                    directory: 'DOCUMENTS',
                    encoding: 'utf8'
                });
                console.log('Test file read: SUCCESS', JSON.parse(result.data));
                
                // Clean up
                await Filesystem.deleteFile({
                    path: 'sync-debug-test.json',
                    directory: 'DOCUMENTS'
                });
                console.log('Test file cleanup: SUCCESS');
                
            } catch (error) {
                console.error('File operation test failed:', error);
            }
            
        } catch (error) {
            console.error('Error testing file operations:', error);
        }
    }

    async testDataService() {
        console.log('--- Testing Data Service ---');
        
        try {
            // Test data export
            const exportData = await window.dataService.exportData();
            console.log('Data export:', {
                tasks: exportData.data.tasks?.length || 0,
                notes: exportData.data.notes?.length || 0,
                subtasks: exportData.data.subtasks?.length || 0
            });
            
            // Test manual sync
            console.log('Testing manual sync...');
            await window.dataService.manualSync();
            console.log('Manual sync completed');
            
        } catch (error) {
            console.error('Error testing data service:', error);
        }
    }

    async forceSync() {
        console.log('=== Force Sync ===');
        
        if (!window.dataService || !window.iCloudSync) {
            console.error('Required services not available');
            return;
        }
        
        try {
            // Export current data
            const exportData = await window.dataService.exportData();
            console.log('Current data to sync:', exportData.data);
            
            // Save to iCloud
            const saveResult = await window.iCloudSync.saveToiCloud(exportData.data);
            console.log('Save result:', saveResult);
            
            // Try to load from iCloud
            const loadResult = await window.iCloudSync.loadFromiCloud();
            console.log('Load result:', loadResult);
            
        } catch (error) {
            console.error('Force sync failed:', error);
        }
    }
}

// Initialize debugger
window.syncDebugger = new SyncDebugger();

// Add debug methods to global scope for console access
window.runSyncDiagnostics = () => window.syncDebugger.runDiagnostics();
window.forceSync = () => window.syncDebugger.forceSync();

console.log('Sync Debugger loaded. Use runSyncDiagnostics() or forceSync() in console.');
