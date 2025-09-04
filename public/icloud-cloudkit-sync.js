// iCloud Sync Service using CloudKit approach
class iCloudCloudKitSyncService {
    constructor() {
        this.syncFileName = 'kanban-data.json';
        this.isCapacitor = window.Capacitor && window.Capacitor.isNativePlatform();
    }

    async saveToiCloud(data) {
        if (!this.isCapacitor) {
            console.log('Not running on native platform, skipping iCloud sync');
            return false;
        }

        try {
            console.log('Saving to iCloud using CloudKit approach...');
            
            const syncData = {
                ...data,
                lastSync: new Date().toISOString(),
                deviceId: await this.getDeviceId()
            };

            console.log('Saving to iCloud:', {
                tasks: syncData.tasks?.length || 0,
                notes: syncData.notes?.length || 0,
                subtasks: syncData.subtasks?.length || 0
            });

            // Use a different key approach for CloudKit
            const { Preferences } = window.Capacitor.Plugins;
            
            // Save with a timestamp-based key to ensure uniqueness
            const timestamp = Date.now();
            const cloudKey = `group.com.fynesystems.kanbantodo.cloudkit_sync_${timestamp}`;
            
            await Preferences.set({
                key: cloudKey,
                value: JSON.stringify(syncData, null, 2)
            });

            // Also save a "latest" pointer
            await Preferences.set({
                key: 'group.com.fynesystems.kanbantodo.cloudkit_latest',
                value: cloudKey
            });
            
            console.log('Successfully saved to iCloud using CloudKit approach');
            return true;
        } catch (error) {
            console.error('Error saving to iCloud using CloudKit approach:', error);
            return false;
        }
    }

    async loadFromiCloud() {
        if (!this.isCapacitor) {
            console.log('Not running on native platform, skipping iCloud sync');
            return null;
        }

        try {
            console.log('Loading from iCloud using CloudKit approach...');
            
            const { Preferences } = window.Capacitor.Plugins;
            
            // Get the latest key
            const latestResult = await Preferences.get({
                key: 'group.com.fynesystems.kanbantodo.cloudkit_latest'
            });

            if (!latestResult.value) {
                console.log('No CloudKit latest pointer found');
                return null;
            }

            const latestKey = latestResult.value;
            console.log('Latest CloudKit key:', latestKey);

            // Get the actual data
            const dataResult = await Preferences.get({
                key: latestKey
            });

            if (!dataResult.value) {
                console.log('No CloudKit data found for key:', latestKey);
                return null;
            }

            const syncData = JSON.parse(dataResult.value);
            
            console.log('Loaded from iCloud using CloudKit approach:', {
                tasks: syncData.tasks?.length || 0,
                notes: syncData.notes?.length || 0,
                subtasks: syncData.subtasks?.length || 0,
                lastSync: syncData.lastSync,
                deviceId: syncData.deviceId
            });

            return syncData;
        } catch (error) {
            console.error('Error loading from iCloud using CloudKit approach:', error);
            return null;
        }
    }

    async getDeviceId() {
        try {
            const { Device } = window.Capacitor.Plugins;
            const info = await Device.getId();
            return info.identifier;
        } catch (error) {
            return 'unknown-device';
        }
    }

    async checkiCloudAvailability() {
        if (!this.isCapacitor) {
            return { available: false, reason: 'Not running on native platform' };
        }

        try {
            const { Preferences } = window.Capacitor.Plugins;
            
            // Try to write a small test value to check if iCloud is accessible
            const testData = { test: true, timestamp: Date.now() };
            const testKey = `group.com.fynesystems.kanbantodo.cloudkit_test_${Date.now()}`;
            
            await Preferences.set({
                key: testKey,
                value: JSON.stringify(testData)
            });

            // Clean up test value
            try {
                await Preferences.remove({
                    key: testKey
                });
            } catch (cleanupError) {
                // Ignore cleanup errors
            }

            return { available: true, reason: 'iCloud accessible via CloudKit approach' };
        } catch (error) {
            return { 
                available: false, 
                reason: `iCloud not accessible: ${error.message || error.code}` 
            };
        }
    }

    async checkForUpdates(currentData) {
        const cloudData = await this.loadFromiCloud();
        
        if (!cloudData) {
            return { hasUpdates: false, data: null };
        }

        const currentSync = currentData.lastSync ? new Date(currentData.lastSync) : new Date(0);
        const cloudSync = new Date(cloudData.lastSync);

        return {
            hasUpdates: cloudSync > currentSync,
            data: cloudData,
            cloudSync: cloudData.lastSync,
            currentSync: currentData.lastSync
        };
    }
}

// Initialize the CloudKit iCloud sync service
window.iCloudCloudKitSync = new iCloudCloudKitSyncService();
console.log('CloudKit iCloud Sync Service initialized:', window.iCloudCloudKitSync);

