// iCloud Sync Service using Capacitor Filesystem
class iCloudSyncService {
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

            console.log('Saving to iCloud Documents:', {
                tasks: syncData.tasks?.length || 0,
                notes: syncData.notes?.length || 0,
                subtasks: syncData.subtasks?.length || 0,
                directory: 'DOCUMENTS',
                path: this.syncFileName
            });

            // Try to save to iCloud Documents using DOCUMENTS directory (consistent with read)
            try {
                await Filesystem.writeFile({
                    path: this.syncFileName,
                    data: JSON.stringify(syncData, null, 2),
                    directory: 'DOCUMENTS',
                    encoding: 'utf8',
                    recursive: true
                });
                console.log('Successfully saved to iCloud Documents');
                return true;
            } catch (iCloudError) {
                console.log('Could not save to iCloud Drive container, trying local Documents:', {
                    code: iCloudError.code,
                    errorMessage: iCloudError.errorMessage || iCloudError.message
                });
                
                // Fallback to local Documents
                try {
                    await Filesystem.writeFile({
                        path: this.syncFileName,
                        data: JSON.stringify(syncData, null, 2),
                        directory: 'DOCUMENTS',
                        encoding: 'utf8',
                        recursive: true
                    });
                    
                    console.log('Successfully saved to local Documents');
                    return true;
                } catch (fallbackError) {
                    console.error('Fallback save also failed:', fallbackError);
                    return false;
                }
            }
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
            
            // DEBUG: Log the actual path being used
            console.log('=== DEBUG INFO ===');
            console.log('Sync file name:', this.syncFileName);
            console.log('Full path being used:', this.syncFileName);
            console.log('Directory being used:', 'DOCUMENTS');
            console.log('Is Capacitor:', this.isCapacitor);
            console.log('Available plugins:', Object.keys(window.Capacitor.Plugins));
            console.log('=== END DEBUG ===');
            
            console.log('Loading from iCloud Documents...');

            // First try to read from iCloud Drive container
            try {
                const result = await Filesystem.readFile({
                    path: this.syncFileName,
                    directory: 'DOCUMENTS',
                    encoding: 'utf8'
                });

                const syncData = JSON.parse(result.data);
                
                console.log('Loaded from iCloud Drive container:', {
                    tasks: syncData.tasks?.length || 0,
                    notes: syncData.notes?.length || 0,
                    subtasks: syncData.subtasks?.length || 0,
                    lastSync: syncData.lastSync,
                    deviceId: syncData.deviceId
                });

                return syncData;
            } catch (iCloudError) {
                console.log('Could not read from iCloud Drive container, trying local Documents:', {
                    code: iCloudError.code,
                    errorMessage: iCloudError.errorMessage || iCloudError.message
                });
                
                // Fallback to local Documents
                try {
                    const result = await Filesystem.readFile({
                        path: this.syncFileName,
                        directory: 'DOCUMENTS',
                        encoding: 'utf8'
                    });

                    const syncData = JSON.parse(result.data);
                    
                    console.log('Loaded from local Documents:', {
                        tasks: syncData.tasks?.length || 0,
                        notes: syncData.notes?.length || 0,
                        subtasks: syncData.subtasks?.length || 0,
                        lastSync: syncData.lastSync,
                        deviceId: syncData.deviceId
                    });

                    return syncData;
                } catch (localError) {
                    console.log('Could not read from local Documents either:', {
                        code: localError.code,
                        errorMessage: localError.errorMessage || localError.message
                    });
                    throw localError;
                }
            }
        } catch (error) {
            if (error.message && error.message.includes('File does not exist')) {
                console.log('No iCloud sync file found (first time setup)');
                return null;
            }
            if (error.code === 'OS-PLUG-FILE-0013') {
                console.log('File not found in Documents directory');
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
            
            // Try to write a small test file to check if iCloud Documents is accessible
            const testData = { test: true, timestamp: Date.now() };
            await Filesystem.writeFile({
                path: 'icloud-test.json',
                data: JSON.stringify(testData),
                directory: 'DOCUMENTS',
                encoding: 'utf8',
                recursive: true
            });

            // Clean up test file
            try {
                await Filesystem.deleteFile({
                    path: 'icloud-test.json',
                    directory: 'DOCUMENTS'
                });
            } catch (cleanupError) {
                // Ignore cleanup errors
            }

            return { available: true, reason: 'iCloud Drive container accessible' };
        } catch (error) {
            return { 
                available: false, 
                reason: `iCloud Drive container not accessible: ${error.message || error.code}` 
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

// Initialize the iCloud sync service
window.iCloudSync = new iCloudSyncService();
console.log('iCloud Sync Service initialized:', window.iCloudSync);