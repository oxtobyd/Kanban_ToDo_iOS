// Migration script to transition from old sync systems to robust iCloud sync
class SyncMigration {
    constructor() {
        this.isCapacitor = window.Capacitor && window.Capacitor.isNativePlatform();
    }

    async migrateToRobustSync() {
        if (!this.isCapacitor) {
            console.log('Not running on native platform, no migration needed');
            return { success: true, message: 'No migration needed for web platform' };
        }

        console.log('Starting sync migration to robust iCloud sync...');

        try {
            // Step 1: Check if robust sync is available
            if (!window.RobustiCloudSync) {
                throw new Error('Robust iCloud sync not available');
            }

            // Step 2: Check iCloud availability
            const availability = await window.RobustiCloudSync.checkiCloudAvailability();
            if (!availability.available) {
                throw new Error(`iCloud not available: ${availability.reason}`);
            }

            // Step 3: Try to load existing data from old sync systems
            let existingData = null;
            
            // Try old proper iCloud sync first
            if (window.iCloudSyncProper) {
                try {
                    const oldData = await window.iCloudSyncProper.loadFromiCloud();
                    if (oldData && oldData.tasks) {
                        console.log('Found data in old proper iCloud sync, migrating...');
                        existingData = oldData;
                    }
                } catch (error) {
                    console.log('Old proper iCloud sync not available or failed:', error.message);
                }
            }

            // Try old Preferences sync if no data found
            if (!existingData) {
                try {
                    const { Preferences } = window.Capacitor.Plugins;
                    const tasksResult = await Preferences.get({ key: 'group.com.fynesystems.kanbantodo.tasks' });
                    const notesResult = await Preferences.get({ key: 'group.com.fynesystems.kanbantodo.notes' });
                    const subtasksResult = await Preferences.get({ key: 'group.com.fynesystems.kanbantodo.subtasks' });
                    
                    if (tasksResult.value || notesResult.value || subtasksResult.value) {
                        console.log('Found data in old Preferences sync, migrating...');
                        existingData = {
                            tasks: tasksResult.value ? JSON.parse(tasksResult.value) : [],
                            notes: notesResult.value ? JSON.parse(notesResult.value) : [],
                            subtasks: subtasksResult.value ? JSON.parse(subtasksResult.value) : [],
                            lastSync: new Date().toISOString()
                        };
                    }
                } catch (error) {
                    console.log('Old Preferences sync not available or failed:', error.message);
                }
            }

            // Step 4: Save to robust sync
            if (existingData) {
                console.log('Migrating data to robust iCloud sync...');
                const success = await window.RobustiCloudSync.saveToiCloud(existingData);
                
                if (success) {
                    console.log('Migration successful! Data saved to robust iCloud sync');
                    
                    // Clean up old sync data (optional - user can choose)
                    await this.cleanupOldSyncData();
                    
                    return {
                        success: true,
                        message: 'Successfully migrated to robust iCloud sync',
                        dataMigrated: {
                            tasks: existingData.tasks?.length || 0,
                            notes: existingData.notes?.length || 0,
                            subtasks: existingData.subtasks?.length || 0
                        }
                    };
                } else {
                    throw new Error('Failed to save data to robust iCloud sync');
                }
            } else {
                console.log('No existing data found to migrate');
                return {
                    success: true,
                    message: 'No existing data found, ready for fresh start with robust sync'
                };
            }

        } catch (error) {
            console.error('Migration failed:', error);
            return {
                success: false,
                message: `Migration failed: ${error.message}`,
                error: error
            };
        }
    }

    async cleanupOldSyncData() {
        console.log('Cleaning up old sync data...');
        
        try {
            // Clean up old Preferences data
            const { Preferences } = window.Capacitor.Plugins;
            const keysToRemove = [
                'group.com.fynesystems.kanbantodo.tasks',
                'group.com.fynesystems.kanbantodo.notes',
                'group.com.fynesystems.kanbantodo.subtasks',
                'group.com.fynesystems.kanbantodo.next_task_id',
                'group.com.fynesystems.kanbantodo.next_note_id',
                'group.com.fynesystems.kanbantodo.next_subtask_id',
                'group.com.fynesystems.kanbantodo.last_sync'
            ];

            let cleanedKeys = 0;
            let failedKeys = 0;

            for (const key of keysToRemove) {
                try {
                    await Preferences.remove({ key });
                    cleanedKeys++;
                    console.log(`Cleaned up old key: ${key}`);
                } catch (error) {
                    failedKeys++;
                    console.log(`Could not remove old key ${key}:`, error.message);
                }
            }

            // Clean up old iCloud sync data if available
            if (window.iCloudSyncProper) {
                try {
                    // Try to clear old iCloud data
                    await window.iCloudSyncProper.clearAllData();
                    console.log('Cleaned up old iCloud sync data');
                } catch (error) {
                    console.log('Could not clean old iCloud sync data:', error.message);
                }
            }

            console.log(`Old sync data cleanup completed: ${cleanedKeys} keys cleaned, ${failedKeys} failed`);
            
            // Notify user of cleanup results
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Toast) {
                const message = `Migration cleanup completed: ${cleanedKeys} old sync entries removed`;
                window.Capacitor.Plugins.Toast.show({
                    text: message,
                    duration: 'short'
                });
            }

            return {
                success: true,
                cleanedKeys: cleanedKeys,
                failedKeys: failedKeys,
                message: `Cleaned up ${cleanedKeys} old sync entries`
            };

        } catch (error) {
            console.error('Error during cleanup:', error);
            return {
                success: false,
                error: error.message,
                message: 'Cleanup failed: ' + error.message
            };
        }
    }

    async checkMigrationStatus() {
        const status = {
            isCapacitor: this.isCapacitor,
            hasRobustSync: !!window.RobustiCloudSync,
            hasOldProperSync: !!window.iCloudSyncProper,
            hasOldDataService: !!window.dataService,
            robustSyncAvailable: false,
            oldDataExists: false
        };

        if (this.isCapacitor && window.RobustiCloudSync) {
            try {
                const availability = await window.RobustiCloudSync.checkiCloudAvailability();
                status.robustSyncAvailable = availability.available;
            } catch (error) {
                console.log('Could not check robust sync availability:', error.message);
            }

            // Check for old data
            try {
                const { Preferences } = window.Capacitor.Plugins;
                const tasksResult = await Preferences.get({ key: 'group.com.fynesystems.kanbantodo.tasks' });
                status.oldDataExists = !!tasksResult.value;
            } catch (error) {
                console.log('Could not check for old data:', error.message);
            }
        }

        return status;
    }

    // Handle "Fix iCloud Sync" button functionality
    async fixiCloudSync() {
        console.log('Starting iCloud sync fix process...');
        
        try {
            // Step 1: Check current status
            const status = await this.checkMigrationStatus();
            console.log('Current migration status:', status);
            
            if (!status.isCapacitor) {
                return {
                    success: false,
                    message: 'iCloud sync is only available on native platforms'
                };
            }
            
            if (!status.hasRobustSync) {
                return {
                    success: false,
                    message: 'Robust sync service not available'
                };
            }
            
            // Step 2: Perform migration
            const migrationResult = await this.migrateToRobustSync();
            console.log('Migration result:', migrationResult);
            
            if (migrationResult.success) {
                // Step 3: Clean up old data (optional)
                const cleanupResult = await this.cleanupOldSyncData();
                console.log('Cleanup result:', cleanupResult);
                
                return {
                    success: true,
                    message: 'iCloud sync fix completed successfully',
                    migration: migrationResult,
                    cleanup: cleanupResult
                };
            } else {
                return {
                    success: false,
                    message: `Migration failed: ${migrationResult.message}`
                };
            }
            
        } catch (error) {
            console.error('iCloud sync fix failed:', error);
            return {
                success: false,
                message: `Fix failed: ${error.message}`
            };
        }
    }
}

// Initialize migration helper
window.SyncMigration = new SyncMigration();
console.log('Sync Migration helper initialized:', window.SyncMigration);
