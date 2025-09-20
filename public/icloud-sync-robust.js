// Robust iCloud Sync Service following Apple's best practices
// Uses NSUbiquitousKeyValueStore with proper conflict resolution
class RobustiCloudSyncService {
    constructor() {
        this.syncKey = 'kanban-data';
        this.isCapacitor = window.Capacitor && window.Capacitor.isNativePlatform();
        this.syncInProgress = false;
        this.lastKnownSyncTime = null;
        this.deviceId = null;
        this.changeListeners = [];
        this.retryAttempts = 3;
        this.retryDelay = 2000;
    }

    async init() {
        if (!this.isCapacitor) {
            console.log('Not running on native platform, iCloud sync disabled');
            return false;
        }

        try {
            // Get device ID for conflict resolution
            this.deviceId = await this.getDeviceId();
            console.log('Robust iCloud Sync initialized for device:', this.deviceId);

            // Setup change listeners
            this.setupChangeListeners();
            
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
                        console.log('App became active, checking for iCloud updates...');
                        await this.checkForExternalChanges();
                    }
                });
            }

            // Listen for iCloud key-value store changes
            const iCloud = window.Capacitor.Plugins.iCloudPreferences;
            if (iCloud && iCloud.addListener) {
                try {
                    iCloud.addListener('kvStoreDidChange', async () => {
                        console.log('🔄 iCloud key-value store changed externally - triggering sync');
                        await this.checkForExternalChanges();
                    });
                    console.log('✅ Registered kvStoreDidChange listener for real-time sync');
                } catch (e) {
                    console.log('⚠️ kvStoreDidChange listener not supported, using enhanced polling fallback');
                    // Enhanced polling fallback with adaptive intervals
                    this.startPollingFallback();
                }
            } else {
                console.log('⚠️ iCloudPreferences plugin not available, using enhanced polling fallback');
                this.startPollingFallback();
            }

            // Always start enhanced polling as backup for real-time sync
            this.startPollingFallback();
            
        } catch (err) {
            console.warn('Failed to setup change listeners:', err);
            // Fallback to polling
            this.startPollingFallback();
        }
    }

    async checkForExternalChanges() {
        if (this.syncInProgress) {
            console.log('Sync already in progress, skipping external change check');
            return;
        }

        try {
            console.log('🔍 Checking for external changes...', {
                deviceId: this.deviceId,
                lastKnownSyncTime: this.lastKnownSyncTime,
                timestamp: new Date().toISOString()
            });

            const cloudData = await this.loadFromiCloud();
            
            if (cloudData) {
                console.log('📥 Found cloud data:', {
                    tasks: cloudData.tasks?.length || 0,
                    notes: cloudData.notes?.length || 0,
                    subtasks: cloudData.subtasks?.length || 0,
                    lastSync: cloudData.lastSync,
                    cloudDeviceId: cloudData.deviceId,
                    isNewer: this.isNewerData(cloudData)
                });

                if (this.isNewerData(cloudData)) {
                    console.log('✅ Found newer data in iCloud, notifying listeners...');
                    this.notifyChangeListeners(cloudData);
                    return true; // Return true to indicate changes were found
                } else {
                    console.log('⏭️ Cloud data is not newer, skipping sync');
                }
            } else {
                console.log('❌ No cloud data found');
            }
        } catch (error) {
            console.error('❌ Error checking for external changes:', error);
        }
        
        return false; // Return false to indicate no changes were found
    }

    isNewerData(cloudData) {
        if (!cloudData.lastSync) return true;
        if (!this.lastKnownSyncTime) return true;
        
        const cloudTime = new Date(cloudData.lastSync);
        const localTime = new Date(this.lastKnownSyncTime);
        
        return cloudTime > localTime;
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
            return { success: false, reason: 'Not on native platform' };
        }

        if (this.syncInProgress) {
            console.log('Sync already in progress, queuing save...');
            return { success: false, reason: 'Sync already in progress' };
        }

        this.syncInProgress = true;

        try {
            // Check if iCloud plugin is available
            if (!window.Capacitor.Plugins.iCloudPreferences) {
                const error = 'iCloud Preferences plugin not available';
                console.error(error);
                return { success: false, reason: error };
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

            // Save with enhanced retry logic
            let lastError = null;
            for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
                try {
                    await window.Capacitor.Plugins.iCloudPreferences.set({
                        key: this.syncKey,
                        value: JSON.stringify(syncData, null, 2)
                    });
                    
                    this.lastKnownSyncTime = syncData.lastSync;
                    console.log(`Successfully saved to iCloud on attempt ${attempt}`);
                    
                    // Notify user of successful sync
                    this.notifyUser('Data synced to iCloud successfully', 'success');
                    
                    return { 
                        success: true, 
                        attempt: attempt,
                        lastSync: syncData.lastSync 
                    };
                } catch (error) {
                    lastError = error;
                    console.error(`Save attempt ${attempt} failed:`, error);
                    
                    // Provide user-friendly error messages
                    const userMessage = this.getUserFriendlyErrorMessage(error);
                    if (attempt === this.retryAttempts) {
                        this.notifyUser(`Sync failed: ${userMessage}`, 'error');
                    }
                    
                    if (attempt < this.retryAttempts) {
                        const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
                        console.log(`Retrying in ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }

            return { 
                success: false, 
                reason: this.getUserFriendlyErrorMessage(lastError),
                error: lastError 
            };
        } catch (error) {
            console.error('Error saving to iCloud:', error);
            this.notifyUser(`Sync error: ${this.getUserFriendlyErrorMessage(error)}`, 'error');
            return { 
                success: false, 
                reason: this.getUserFriendlyErrorMessage(error),
                error: error 
            };
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

                        // Update last known sync time
                        if (syncData.lastSync) {
                            this.lastKnownSyncTime = syncData.lastSync;
                        }

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

            console.log('🔍 Testing iCloud connectivity...', {
                deviceId: this.deviceId,
                syncKey: this.syncKey,
                platform: window.Capacitor.getPlatform()
            });

            // Test iCloud connectivity with device info
            const testData = { 
                test: true, 
                timestamp: Date.now(),
                deviceId: this.deviceId,
                platform: window.Capacitor.getPlatform(),
                syncKey: this.syncKey
            };
            
            await window.Capacitor.Plugins.iCloudPreferences.set({
                key: 'icloud-test-robust',
                value: JSON.stringify(testData)
            });

            // Verify the test data was saved
            const verifyResult = await window.Capacitor.Plugins.iCloudPreferences.get({
                key: 'icloud-test-robust'
            });

            if (!verifyResult.value) {
                return { available: false, reason: 'iCloud test data not persisted' };
            }

            // Clean up test value
            try {
                await window.Capacitor.Plugins.iCloudPreferences.remove({
                    key: 'icloud-test-robust'
                });
            } catch (cleanupError) {
                console.warn('Could not clean up test data:', cleanupError);
            }

            console.log('✅ iCloud connectivity test passed');
            return { 
                available: true, 
                reason: 'iCloud accessible via robust sync',
                deviceId: this.deviceId,
                platform: window.Capacitor.getPlatform()
            };
        } catch (error) {
            console.error('❌ iCloud connectivity test failed:', error);
            return { 
                available: false, 
                reason: `iCloud not accessible: ${error.message || error.code}`,
                error: error
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

    // Health check method for monitoring sync status
    async performHealthCheck() {
        try {
            const availability = await this.checkiCloudAvailability();
            const status = {
                status: availability.available ? 'healthy' : 'critical',
                lastSync: this.lastKnownSyncTime,
                deviceId: this.deviceId,
                iCloudAvailable: availability.available,
                iCloudReason: availability.reason,
                syncInProgress: this.syncInProgress,
                timestamp: new Date().toISOString()
            };

            // Additional health checks
            if (this.syncInProgress) {
                status.status = 'warning';
                status.message = 'Sync operation in progress';
            }

            if (!availability.available) {
                status.status = 'critical';
                status.message = `iCloud not available: ${availability.reason}`;
            }

            return status;
        } catch (error) {
            return { 
                status: 'critical', 
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Get user-friendly error messages
    getUserFriendlyErrorMessage(error) {
        if (!error) return 'Unknown error occurred';
        
        const errorMessage = error.message || error.toString();
        
        // Network-related errors
        if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
            return 'Network connection issue. Please check your internet connection.';
        }
        
        // iCloud-specific errors
        if (errorMessage.includes('iCloud') || errorMessage.includes('cloud')) {
            return 'iCloud sync issue. Please check your iCloud settings.';
        }
        
        // Permission errors
        if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
            return 'Permission denied. Please check app permissions in Settings.';
        }
        
        // Storage errors
        if (errorMessage.includes('storage') || errorMessage.includes('quota')) {
            return 'Storage issue. Please free up some space and try again.';
        }
        
        // Generic fallback
        return 'Sync operation failed. Please try again.';
    }

    // Notify user with toast messages
    notifyUser(message, type = 'info') {
        try {
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Toast) {
                const duration = type === 'error' ? 'long' : 'short';
                window.Capacitor.Plugins.Toast.show({
                    text: message,
                    duration: duration
                });
            } else {
                // Fallback to console for web
                console.log(`[${type.toUpperCase()}] ${message}`);
            }
        } catch (error) {
            console.error('Failed to show notification:', error);
        }
    }

    // Smart polling fallback with battery optimization
    startPollingFallback() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        let pollCount = 0;
        let lastChangeTime = Date.now();
        const maxPollInterval = 60000; // 1 minute max (battery friendly)
        const minPollInterval = 15000; // 15 seconds min (reasonable for real-time)
        let currentInterval = 20000; // Start with 20 seconds (battery optimized)

        console.log('🔄 Starting smart polling fallback (battery optimized)');

        this.pollingInterval = setInterval(async () => {
            try {
                const hadChanges = await this.checkForExternalChanges();
                pollCount++;
                
                // If we detected changes, keep polling more frequently
                if (hadChanges) {
                    lastChangeTime = Date.now();
                    currentInterval = minPollInterval; // Back to faster polling
                }
                
                // Gradually increase polling interval if no changes detected
                if (pollCount > 5 && currentInterval < maxPollInterval) {
                    currentInterval = Math.min(currentInterval * 1.5, maxPollInterval);
                    clearInterval(this.pollingInterval);
                    this.startPollingFallback(); // Restart with new interval
                }
            } catch (error) {
                console.warn('Polling fallback error:', error);
                // Reset to faster polling on errors
                currentInterval = minPollInterval;
            }
        }, currentInterval);

        console.log(`Started enhanced polling fallback with ${currentInterval}ms interval`);
    }

    // Stop polling fallback
    stopPollingFallback() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
            console.log('Stopped polling fallback');
        }
    }

    // Comprehensive sync debugging for cross-device issues
    async debugCrossDeviceSync() {
        console.log('🔍 === CROSS-DEVICE SYNC DEBUG ===');
        
        const debugInfo = {
            timestamp: new Date().toISOString(),
            deviceId: this.deviceId,
            platform: window.Capacitor?.getPlatform() || 'unknown',
            isCapacitor: this.isCapacitor,
            syncKey: this.syncKey,
            lastKnownSyncTime: this.lastKnownSyncTime,
            syncInProgress: this.syncInProgress
        };

        console.log('📱 Device Info:', debugInfo);

        try {
            // Test 1: Check iCloud availability
            console.log('🧪 Test 1: iCloud Availability');
            const availability = await this.checkiCloudAvailability();
            console.log('Result:', availability);

            // Test 2: Try to save test data (using separate test key)
            console.log('🧪 Test 2: Save Test Data');
            const testData = {
                test: true,
                timestamp: Date.now(),
                deviceId: this.deviceId,
                platform: window.Capacitor?.getPlatform(),
                message: 'Cross-device sync test'
            };

            // Use a separate test key to avoid overwriting real data
            const originalKey = this.syncKey;
            this.syncKey = 'kanban-debug-test';
            
            const saveResult = await this.saveToiCloud(testData);
            console.log('Save Result:', saveResult);
            
            // Restore original key
            this.syncKey = originalKey;

            // Test 3: Try to load data
            console.log('🧪 Test 3: Load Data');
            const loadResult = await this.loadFromiCloud();
            console.log('Load Result:', loadResult ? {
                hasData: !!loadResult,
                tasks: loadResult.tasks?.length || 0,
                lastSync: loadResult.lastSync,
                deviceId: loadResult.deviceId
            } : 'No data found');

            // Test 4: Check for external changes
            console.log('🧪 Test 4: External Changes Check');
            await this.checkForExternalChanges();

            return {
                success: true,
                debugInfo: debugInfo,
                availability: availability,
                saveResult: saveResult,
                loadResult: !!loadResult
            };

        } catch (error) {
            console.error('❌ Cross-device sync debug failed:', error);
            return {
                success: false,
                error: error.message,
                debugInfo: debugInfo
            };
        }
    }
}

// Initialize the robust iCloud sync service
window.RobustiCloudSync = new RobustiCloudSyncService();
console.log('Robust iCloud Sync Service initialized:', window.RobustiCloudSync);
