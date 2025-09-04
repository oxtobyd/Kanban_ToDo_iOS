// iCloud Sync Service using proper iCloud plugin
class iCloudSyncServiceProper {
    constructor() {
        this.syncFileName = 'kanban-data.json';
        this.isCapacitor = window.Capacitor && window.Capacitor.isNativePlatform();
        this.hasSetupListeners = false;
    }

    async saveToiCloud(data) {
        if (!this.isCapacitor) {
            console.log('Not running on native platform, skipping iCloud sync');
            return false;
        }

        try {
            console.log('Capacitor Plugins available:', Object.keys(window.Capacitor.Plugins));
            
            // Check if iCloud plugin is available
            if (!window.Capacitor.Plugins.iCloudPreferences) {
                console.error('iCloud Preferences plugin not available');
                return false;
            }
            
            const syncData = {
                ...data,
                lastSync: new Date().toISOString(),
                deviceId: await this.getDeviceId()
            };

            console.log('Saving to iCloud using proper iCloud plugin:', {
                tasks: syncData.tasks?.length || 0,
                notes: syncData.notes?.length || 0,
                subtasks: syncData.subtasks?.length || 0
            });

            // Use the proper iCloud plugin to save data
            await window.Capacitor.Plugins.iCloudPreferences.set({
                key: this.syncFileName,
                value: JSON.stringify(syncData, null, 2)
            });
            
            console.log('Successfully saved to iCloud using proper plugin');
            return true;
        } catch (error) {
            console.error('Error saving to iCloud using proper plugin:', error);
            return false;
        }
    }

    // Setup listeners for automatic sync on app resume and iCloud external changes (if supported)
    setupAutoSync(onCloudData) {
        if (this.hasSetupListeners || !this.isCapacitor) return;

        try {
            const { App } = window.Capacitor.Plugins;
            if (App && App.addListener) {
                App.addListener('appStateChange', async (state) => {
                    if (state.isActive) {
                        console.log('App became active, checking iCloud for updates...');
                        const data = await this.loadFromiCloud();
                        if (data && onCloudData) {
                            console.log('Auto-sync: Found iCloud data on app resume, checking if newer...');
                            onCloudData(data);
                        }
                    }
                });
                console.log('Registered appStateChange listener for auto iCloud sync');
            }

            // If plugin exposes change notifications, subscribe here
            const iCloud = window.Capacitor.Plugins.iCloudPreferences;
            if (iCloud && iCloud.addListener) {
                try {
                    iCloud.addListener('kvStoreDidChange', async () => {
                        console.log('iCloud key-value store changed, loading updates...');
                        const data = await this.loadFromiCloud();
                        if (data && onCloudData) {
                            console.log('Auto-sync: Found iCloud data on store change, checking if newer...');
                            onCloudData(data);
                        }
                    });
                    console.log('Registered kvStoreDidChange listener for auto iCloud sync');
                } catch (e) {
                    // Silently ignore if event not supported by plugin
                }
            }

            this.hasSetupListeners = true;
        } catch (err) {
            console.warn('Auto-sync listener setup failed:', err);
        }
    }

    async loadFromiCloud() {
        if (!this.isCapacitor) {
            console.log('Not running on native platform, skipping iCloud sync');
            return null;
        }

        try {
            // Check if iCloud plugin is available
            if (!window.Capacitor.Plugins.iCloudPreferences) {
                console.error('iCloud Preferences plugin not available');
                return null;
            }
            
            console.log('=== DEBUG INFO ===');
            console.log('Sync file name:', this.syncFileName);
            console.log('Using proper iCloud plugin');
            console.log('Is Capacitor:', this.isCapacitor);
            console.log('Available plugins:', Object.keys(window.Capacitor.Plugins));
            console.log('=== END DEBUG ===');
            
            console.log('Loading from iCloud using proper plugin...');

            // Try multiple times with delays to account for iCloud sync timing
            for (let attempt = 1; attempt <= 3; attempt++) {
                console.log(`iCloud load attempt ${attempt}/3...`);
                
                const result = await window.Capacitor.Plugins.iCloudPreferences.get({
                    key: this.syncFileName
                });

                console.log(`Attempt ${attempt} result:`, result);

                if (result.value) {
                    const syncData = JSON.parse(result.value);
                    
                    console.log('Loaded from iCloud using proper plugin:', {
                        tasks: syncData.tasks?.length || 0,
                        notes: syncData.notes?.length || 0,
                        subtasks: syncData.subtasks?.length || 0,
                        lastSync: syncData.lastSync,
                        deviceId: syncData.deviceId
                    });

                    return syncData;
                }

                if (attempt < 3) {
                    console.log(`No data found on attempt ${attempt}, waiting 2 seconds before retry...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            console.log('No iCloud data found after 3 attempts');
            return null;
        } catch (error) {
            if (error.message && error.message.includes('No value found')) {
                console.log('No iCloud sync data found (first time setup)');
                return null;
            }
            console.error('Error loading from iCloud using proper plugin:', error);
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
            // Check if iCloud plugin is available
            if (!window.Capacitor.Plugins.iCloudPreferences) {
                return { available: false, reason: 'iCloud Preferences plugin not available' };
            }
            
            // Try to write a small test value to check if iCloud is accessible
            const testData = { test: true, timestamp: Date.now() };
            await window.Capacitor.Plugins.iCloudPreferences.set({
                key: 'icloud-test',
                value: JSON.stringify(testData)
            });

            // Clean up test value
            try {
                await window.Capacitor.Plugins.iCloudPreferences.remove({
                    key: 'icloud-test'
                });
            } catch (cleanupError) {
                // Ignore cleanup errors
            }

            return { available: true, reason: 'iCloud accessible via proper plugin' };
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

    // Manual sync function for debugging
    async forceSync() {
        console.log('=== FORCE SYNC DEBUG ===');
        
        // Check iCloud availability
        const availability = await this.checkiCloudAvailability();
        console.log('iCloud availability:', availability);
        
        if (!availability.available) {
            console.error('iCloud not available:', availability.reason);
            return { success: false, reason: availability.reason };
        }
        
        // Try to load data with extended retry
        console.log('Attempting extended sync with 5 retries...');
        for (let attempt = 1; attempt <= 5; attempt++) {
            console.log(`Force sync attempt ${attempt}/5...`);
            
            const result = await window.Capacitor.Plugins.iCloudPreferences.get({
                key: this.syncFileName
            });
            
            console.log(`Force sync attempt ${attempt} result:`, result);
            
            if (result.value) {
                const syncData = JSON.parse(result.value);
                console.log('Force sync SUCCESS! Found data:', {
                    tasks: syncData.tasks?.length || 0,
                    notes: syncData.notes?.length || 0,
                    subtasks: syncData.subtasks?.length || 0,
                    lastSync: syncData.lastSync,
                    deviceId: syncData.deviceId
                });
                return { success: true, data: syncData };
            }
            
            if (attempt < 5) {
                console.log(`No data on attempt ${attempt}, waiting 3 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        
        console.log('Force sync FAILED - No data found after 5 attempts');
        return { success: false, reason: 'No data found after 5 attempts' };
    }
}

// Initialize the proper iCloud sync service
window.iCloudSyncProper = new iCloudSyncServiceProper();
console.log('Proper iCloud Sync Service initialized:', window.iCloudSyncProper);
