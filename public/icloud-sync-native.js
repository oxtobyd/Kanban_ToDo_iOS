// iCloud Sync Service using NSUbiquitousKeyValueStore approach
class iCloudSyncNativeService {
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
            console.log('Saving to iCloud using NSUbiquitousKeyValueStore approach...');
            
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

            // Use Preferences with group for iCloud sync
            const { Preferences } = window.Capacitor.Plugins;
            
            // Save with timestamp-based key to ensure uniqueness
            const timestamp = Date.now();
            const dataKey = `group.com.fynesystems.kanbantodo.icloud_sync_data_${timestamp}`;
            
            // Save the actual data
            await Preferences.set({
                key: dataKey,
                value: JSON.stringify(syncData, null, 2)
            });

            // Save a "latest" pointer
            await Preferences.set({
                key: 'group.com.fynesystems.kanbantodo.icloud_latest',
                value: dataKey
            });

            // Also save to a fixed key as backup
            await Preferences.set({
                key: 'group.com.fynesystems.kanbantodo.icloud_sync_data',
                value: JSON.stringify(syncData, null, 2)
            });
            
            console.log('Successfully saved to iCloud using NSUbiquitousKeyValueStore');
            return true;
        } catch (error) {
            console.error('Error saving to iCloud using NSUbiquitousKeyValueStore:', error);
            return false;
        }
    }

    async loadFromiCloud() {
        if (!this.isCapacitor) {
            console.log('Not running on native platform, skipping iCloud sync');
            return null;
        }

        try {
            console.log('Loading from iCloud using NSUbiquitousKeyValueStore...');
            
            const { Preferences } = window.Capacitor.Plugins;
            
            // Try to get the latest key first
            const latestResult = await Preferences.get({
                key: 'group.com.fynesystems.kanbantodo.icloud_latest'
            });

            if (latestResult.value) {
                console.log('Found latest key:', latestResult.value);
                
                // Try to load from the latest key
                const dataResult = await Preferences.get({
                    key: latestResult.value
                });

                if (dataResult.value) {
                    const syncData = JSON.parse(dataResult.value);
                    
                    console.log('Loaded from iCloud using latest key:', {
                        tasks: syncData.tasks?.length || 0,
                        notes: syncData.notes?.length || 0,
                        subtasks: syncData.subtasks?.length || 0,
                        lastSync: syncData.lastSync,
                        deviceId: syncData.deviceId
                    });

                    return syncData;
                }
            }

            // Fallback to fixed key
            console.log('Trying fixed key fallback...');
            const result = await Preferences.get({
                key: 'group.com.fynesystems.kanbantodo.icloud_sync_data'
            });

            if (!result.value) {
                console.log('No iCloud data found');
                return null;
            }

            const syncData = JSON.parse(result.value);
            
            console.log('Loaded from iCloud using fixed key:', {
                tasks: syncData.tasks?.length || 0,
                notes: syncData.notes?.length || 0,
                subtasks: syncData.subtasks?.length || 0,
                lastSync: syncData.lastSync,
                deviceId: syncData.deviceId
            });

            return syncData;
        } catch (error) {
            console.error('Error loading from iCloud using NSUbiquitousKeyValueStore:', error);
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
            await Preferences.set({
                key: 'group.com.fynesystems.kanbantodo.icloud_test',
                value: JSON.stringify(testData)
            });

            // Clean up test value
            try {
                await Preferences.remove({
                    key: 'group.com.fynesystems.kanbantodo.icloud_test'
                });
            } catch (cleanupError) {
                // Ignore cleanup errors
            }

            return { available: true, reason: 'iCloud accessible via NSUbiquitousKeyValueStore' };
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

// Initialize the native iCloud sync service
window.iCloudSyncNative = new iCloudSyncNativeService();
console.log('Native iCloud Sync Service initialized:', window.iCloudSyncNative);
