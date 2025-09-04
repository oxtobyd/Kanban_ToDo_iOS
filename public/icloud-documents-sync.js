// iCloud Documents Sync Service using proper iCloud Documents approach
class iCloudDocumentsSyncService {
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
            console.log('Capacitor Plugins available:', Object.keys(window.Capacitor.Plugins));
            const { Filesystem } = window.Capacitor.Plugins;
            
            if (!Filesystem) {
                console.error('Filesystem plugin not available');
                return false;
            }
            
            const syncData = {
                ...data,
                lastSync: new Date().toISOString(),
                deviceId: await this.getDeviceId()
            };

            console.log('Saving to iCloud Documents (EXTERNAL_STORAGE):', {
                tasks: syncData.tasks?.length || 0,
                notes: syncData.notes?.length || 0,
                subtasks: syncData.subtasks?.length || 0,
                directory: 'EXTERNAL_STORAGE'
            });

            // Use EXTERNAL_STORAGE directory for iCloud sync
            await Filesystem.writeFile({
                path: this.syncFileName,
                data: JSON.stringify(syncData, null, 2),
                directory: 'EXTERNAL_STORAGE',
                encoding: 'utf8',
                recursive: true
            });
            
            console.log('Successfully saved to iCloud Documents');
            return true;
        } catch (error) {
            console.error('Error saving to iCloud Documents:', error);
            return false;
        }
    }

    async loadFromiCloud() {
        if (!this.isCapacitor) {
            console.log('Not running on native platform, skipping iCloud sync');
            return null;
        }

        try {
            const { Filesystem } = window.Capacitor.Plugins;
            
            console.log('=== DEBUG INFO ===');
            console.log('Sync file name:', this.syncFileName);
            console.log('Using iCloud Documents directory');
            console.log('Is Capacitor:', this.isCapacitor);
            console.log('Available plugins:', Object.keys(window.Capacitor.Plugins));
            console.log('=== END DEBUG ===');
            
            console.log('Loading from iCloud Documents (EXTERNAL_STORAGE)...');

            // Read from EXTERNAL_STORAGE directory for iCloud sync
            const result = await Filesystem.readFile({
                path: this.syncFileName,
                directory: 'EXTERNAL_STORAGE',
                encoding: 'utf8'
            });

            const syncData = JSON.parse(result.data);
            
            console.log('Loaded from iCloud Documents:', {
                tasks: syncData.tasks?.length || 0,
                notes: syncData.notes?.length || 0,
                subtasks: syncData.subtasks?.length || 0,
                lastSync: syncData.lastSync,
                deviceId: syncData.deviceId
            });

            return syncData;
        } catch (error) {
            if (error.code === 'OS-PLUG-FILE-0013') {
                console.log('No iCloud Documents file found (first time setup)');
                return null;
            }
            console.error('Error loading from iCloud Documents:', error);
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
            const { Filesystem } = window.Capacitor.Plugins;
            
            // Try to write a small test file to check if EXTERNAL_STORAGE is accessible
            const testData = { test: true, timestamp: Date.now() };
            await Filesystem.writeFile({
                path: 'icloud-test.json',
                data: JSON.stringify(testData),
                directory: 'EXTERNAL_STORAGE',
                encoding: 'utf8',
                recursive: true
            });

            // Clean up test file
            try {
                await Filesystem.deleteFile({
                    path: 'icloud-test.json',
                    directory: 'EXTERNAL_STORAGE'
                });
            } catch (cleanupError) {
                // Ignore cleanup errors
            }

            return { available: true, reason: 'iCloud Documents accessible' };
        } catch (error) {
            return { 
                available: false, 
                reason: `iCloud Documents not accessible: ${error.message || error.code}` 
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

// Initialize the iCloud Documents sync service
window.iCloudDocumentsSync = new iCloudDocumentsSyncService();
console.log('iCloud Documents Sync Service initialized:', window.iCloudDocumentsSync);
