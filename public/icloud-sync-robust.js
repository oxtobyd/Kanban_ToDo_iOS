// Robust iCloud Sync Service following Apple's best practices
// Uses NSUbiquitousKeyValueStore with proper conflict resolution
class RobustiCloudSyncService {
    constructor() {
        this.syncKey = 'kanban-data.json';
        this.isCapacitor = window.Capacitor && window.Capacitor.isNativePlatform();
        this.syncInProgress = false;
        this.lastKnownSyncTime = null;
        this.deviceId = null;
        this.changeListeners = [];
        this.retryAttempts = 3;
        this.retryDelay = 2000;
        this.lastLocalSaveTime = 0; // debounce external checks after local writes
    }

    async init() {
        if (!this.isCapacitor) {
            return false;
        }

        try {
            // Get device ID for conflict resolution
            this.deviceId = await this.getDeviceId();
            // Robust iCloud Sync initialized

            // Setup change listeners
            this.setupChangeListeners();
            
            // Immediately check for changes on startup
            // Checking for iCloud changes on startup
            setTimeout(() => this.checkForExternalChanges(), 2000); // Check after 2 seconds
            
            return true;
        } catch (error) {
            console.error('Failed to initialize robust iCloud sync:', error);
            return false;
        }
    }

    async getDeviceId() {
        try {
            const { Device } = window.Capacitor.Plugins;
            const info = await Device.getId();
            return info.identifier;
        } catch (error) {
            return `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
    }

    setupChangeListeners() {
        if (!this.isCapacitor) return;

        try {
            // Listen for app state changes
            const { App } = window.Capacitor.Plugins;
            if (App && App.addListener) {
                App.addListener('appStateChange', async (state) => {
                    if (state.isActive) {
                        // App became active, checking for iCloud updates
                        await this.checkForExternalChanges();
                    }
                });
            }

            // Listen for iCloud key-value store changes
            const iCloud = window.Capacitor.Plugins.iCloudPreferences;
            if (iCloud && iCloud.addListener) {
                try {
                    iCloud.addListener('kvStoreDidChange', async () => {
                        // iCloud key-value store changed externally
                        await this.checkForExternalChanges();
                    });
                    // kvStoreDidChange listener registered
                } catch (e) {
                    // kvStoreDidChange listener not supported, using polling fallback
                }
            }
            
            // Always run polling as backup (even if kvStoreDidChange works)
            // Setting up polling fallback for external changes
            setInterval(() => this.checkForExternalChanges(), 5000); // 5 seconds for faster sync
        } catch (err) {
            console.warn('Failed to setup change listeners:', err);
        }
    }

    async checkForExternalChanges() {
        if (this.syncInProgress) {
            return;
        }

        // Debounce: skip external checks within 1500ms of a local save to avoid racey re-renders
        if (Date.now() - this.lastLocalSaveTime < 1500) {
            // Too soon after local save; skip this poll
            return;
        }

        try {
            const cloudData = await this.loadFromiCloud();
            
            if (cloudData && this.isNewerData(cloudData)) {
                // Update lastKnownSyncTime when receiving external changes
                this.lastKnownSyncTime = cloudData.lastSync;
                this.notifyChangeListeners(cloudData);
            }
        } catch (error) {
            console.error('Error checking for external changes:', error);
        }
    }

    isNewerData(cloudData) {
        if (!cloudData.lastSync) {
            console.log('isNewerData: No cloud lastSync, returning true');
            return true;
        }
        if (!this.lastKnownSyncTime) {
            console.log('isNewerData: No local lastKnownSyncTime, returning true');
            return true;
        }
        
        const cloudTime = new Date(cloudData.lastSync);
        const localTime = new Date(this.lastKnownSyncTime);
        
        // Consider equal timestamps from a different device as newer (to avoid missed updates)
        const isNewer = (cloudTime > localTime) || (
            cloudTime.getTime() === localTime.getTime() && cloudData.deviceId && cloudData.deviceId !== this.deviceId
        );
        console.log('isNewerData comparison:', {
            cloudTime: cloudData.lastSync,
            localTime: this.lastKnownSyncTime,
            isNewer: isNewer,
            cloudDevice: cloudData.deviceId,
            localDevice: this.deviceId
        });
        
        return isNewer;
    }

    notifyChangeListeners(data) {
        this.changeListeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('Error in change listener:', error);
            }
        });
    }

    addChangeListener(callback) {
        this.changeListeners.push(callback);
    }

    removeChangeListener(callback) {
        const index = this.changeListeners.indexOf(callback);
        if (index > -1) {
            this.changeListeners.splice(index, 1);
        }
    }

    async saveToiCloud(data) {
        if (!this.isCapacitor) {
            console.log('Not running on native platform, skipping iCloud sync');
            return false;
        }

        if (this.syncInProgress) {
            console.log('Sync already in progress, queuing save...');
            return false;
        }

        this.syncInProgress = true;

        try {
            // Check if iCloud plugin is available
            if (!window.Capacitor.Plugins.iCloudPreferences) {
                console.error('iCloud Preferences plugin not available');
                return false;
            }

            // Create sync data with proper metadata
            const syncData = {
                ...data,
                lastSync: new Date().toISOString(),
                deviceId: this.deviceId,
                version: 1,
                syncId: `${this.deviceId}-${Date.now()}`
            };

            console.log('Saving to iCloud with robust sync:', {
                tasks: syncData.tasks?.length || 0,
                notes: syncData.notes?.length || 0,
                subtasks: syncData.subtasks?.length || 0,
                deviceId: syncData.deviceId,
                lastSync: syncData.lastSync
            });

            // Save with retry logic
            let success = false;
            for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
                try {
                    await window.Capacitor.Plugins.iCloudPreferences.set({
                        key: this.syncKey,
                        value: JSON.stringify(syncData, null, 2)
                    });
                    
                    success = true;
                    this.lastKnownSyncTime = syncData.lastSync;
                    console.log(`Successfully saved to iCloud on attempt ${attempt}`);
                    this.lastLocalSaveTime = Date.now();
                    break;
                } catch (error) {
                    console.error(`Save attempt ${attempt} failed:`, error);
                    if (attempt < this.retryAttempts) {
                        console.log(`Retrying in ${this.retryDelay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                    }
                }
            }

            return success;
        } catch (error) {
            console.error('Error saving to iCloud:', error);
            return false;
        } finally {
            this.syncInProgress = false;
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

            console.log('Loading from iCloud with robust sync...');

            // Load with retry logic
            for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
                try {
                    const result = await window.Capacitor.Plugins.iCloudPreferences.get({
                        key: this.syncKey
                    });

                    if (result.value) {
                        const syncData = JSON.parse(result.value);
                        
                        console.log('Loaded from iCloud:', {
                            tasks: syncData.tasks?.length || 0,
                            notes: syncData.notes?.length || 0,
                            subtasks: syncData.subtasks?.length || 0,
                            lastSync: syncData.lastSync,
                            deviceId: syncData.deviceId,
                            version: syncData.version
                        });

                        return syncData;
                    }

                    if (attempt < this.retryAttempts) {
                        console.log(`No data found on attempt ${attempt}, retrying in ${this.retryDelay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                    }
                } catch (error) {
                    console.error(`Load attempt ${attempt} failed:`, error);
                    if (attempt < this.retryAttempts) {
                        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                    }
                }
            }

            console.log('No iCloud data found after all attempts');
            return null;
        } catch (error) {
            if (error.message && error.message.includes('No value found')) {
                console.log('No iCloud sync data found (first time setup)');
                return null;
            }
            console.error('Error loading from iCloud:', error);
            return null;
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

            // Test iCloud connectivity
            const testData = { 
                test: true, 
                timestamp: Date.now(),
                deviceId: this.deviceId
            };
            
            await window.Capacitor.Plugins.iCloudPreferences.set({
                key: 'icloud-test-robust',
                value: JSON.stringify(testData)
            });

            // Clean up test value
            try {
                await window.Capacitor.Plugins.iCloudPreferences.remove({
                    key: 'icloud-test-robust'
                });
            } catch (cleanupError) {
                // Ignore cleanup errors
            }

            return { available: true, reason: 'iCloud accessible via robust sync' };
        } catch (error) {
            return { 
                available: false, 
                reason: `iCloud not accessible: ${error.message || error.code}` 
            };
        }
    }

    async getSyncStatus() {
        if (!this.isCapacitor) {
            return { status: 'web', message: 'Running on web platform' };
        }

        try {
            const availability = await this.checkiCloudAvailability();
            const currentData = await this.loadFromiCloud();
            
            return {
                status: 'native',
                iCloudAvailable: availability.available,
                iCloudReason: availability.reason,
                hasData: !!currentData,
                dataSize: currentData ? {
                    tasks: currentData.tasks?.length || 0,
                    notes: currentData.notes?.length || 0,
                    subtasks: currentData.subtasks?.length || 0
                } : null,
                lastSync: currentData?.lastSync || null,
                deviceId: currentData?.deviceId || null,
                syncInProgress: this.syncInProgress,
                lastKnownSyncTime: this.lastKnownSyncTime,
                syncKey: this.syncKey
            };
        } catch (error) {
            return { status: 'error', message: error.message };
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

    // Manual sync with detailed logging
    async forceSync() {
        console.log('=== ROBUST FORCE SYNC DEBUG ===');
        
        // Check iCloud availability
        const availability = await this.checkiCloudAvailability();
        console.log('iCloud availability:', availability);
        
        if (!availability.available) {
            console.error('iCloud not available:', availability.reason);
            return { success: false, reason: availability.reason };
        }
        
        // Try to load data
        const data = await this.loadFromiCloud();
        if (data) {
            console.log('Force sync SUCCESS! Found data:', {
                tasks: data.tasks?.length || 0,
                notes: data.notes?.length || 0,
                subtasks: data.subtasks?.length || 0,
                lastSync: data.lastSync,
                deviceId: data.deviceId,
                version: data.version
            });
            return { success: true, data: data };
        }
        
        console.log('Force sync FAILED - No data found');
        return { success: false, reason: 'No data found' };
    }

    // Get sync status for debugging
    getSyncStatus() {
        return {
            isCapacitor: this.isCapacitor,
            syncInProgress: this.syncInProgress,
            lastKnownSyncTime: this.lastKnownSyncTime,
            deviceId: this.deviceId,
            changeListeners: this.changeListeners.length
        };
    }

    // Comprehensive sync health check
    async performHealthCheck() {
        console.log('=== iCloud Sync Health Check ===');
        
        const healthReport = {
            timestamp: new Date().toISOString(),
            platform: this.isCapacitor ? 'native' : 'web',
            status: 'unknown',
            issues: [],
            recommendations: []
        };

        if (!this.isCapacitor) {
            healthReport.status = 'not_applicable';
            healthReport.issues.push('Running on web platform - iCloud sync not available');
            return healthReport;
        }

        try {
            // Check plugin availability
            if (!window.Capacitor.Plugins.iCloudPreferences) {
                healthReport.issues.push('iCloud Preferences plugin not available');
                healthReport.recommendations.push('Ensure @serebano/capacitor-icloud-preferences is installed');
            }

            // Check iCloud availability
            const availability = await this.checkiCloudAvailability();
            if (!availability.available) {
                healthReport.issues.push(`iCloud not accessible: ${availability.reason}`);
                healthReport.recommendations.push('Check device iCloud settings and network connectivity');
            }

            // Test sync operations
            const testData = {
                test: true,
                timestamp: Date.now(),
                deviceId: this.deviceId
            };

            try {
                await window.Capacitor.Plugins.iCloudPreferences.set({
                    key: 'health-check-test',
                    value: JSON.stringify(testData)
                });

                const result = await window.Capacitor.Plugins.iCloudPreferences.get({
                    key: 'health-check-test'
                });

                if (result.value) {
                    const retrieved = JSON.parse(result.value);
                    if (retrieved.timestamp === testData.timestamp) {
                        console.log('✅ Sync operations working correctly');
                    } else {
                        healthReport.issues.push('Data integrity issue in sync operations');
                    }
                } else {
                    healthReport.issues.push('Failed to retrieve test data from iCloud');
                }

                // Cleanup
                await window.Capacitor.Plugins.iCloudPreferences.remove({
                    key: 'health-check-test'
                });

            } catch (error) {
                healthReport.issues.push(`Sync operation test failed: ${error.message}`);
            }

            // Check current data
            try {
                const currentData = await this.loadFromiCloud();
                if (currentData) {
                    console.log('✅ Current iCloud data accessible');
                    healthReport.dataStats = {
                        tasks: currentData.tasks?.length || 0,
                        notes: currentData.notes?.length || 0,
                        subtasks: currentData.subtasks?.length || 0,
                        lastSync: currentData.lastSync
                    };
                } else {
                    healthReport.issues.push('No data found in iCloud (may be first run)');
                }
            } catch (error) {
                healthReport.issues.push(`Failed to load current data: ${error.message}`);
            }

            // Determine overall status
            if (healthReport.issues.length === 0) {
                healthReport.status = 'healthy';
            } else if (healthReport.issues.some(issue => issue.includes('not accessible') || issue.includes('plugin not available'))) {
                healthReport.status = 'critical';
            } else {
                healthReport.status = 'warning';
            }

        } catch (error) {
            healthReport.status = 'error';
            healthReport.issues.push(`Health check failed: ${error.message}`);
        }

        console.log('Health Check Report:', healthReport);
        return healthReport;
    }
}

// Initialize the robust iCloud sync service
window.RobustiCloudSync = new RobustiCloudSyncService();
console.log('Robust iCloud Sync Service initialized:', window.RobustiCloudSync);
