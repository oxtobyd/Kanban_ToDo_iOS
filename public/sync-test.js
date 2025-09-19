// Test script for robust iCloud sync
class SyncTest {
    constructor() {
        this.isCapacitor = window.Capacitor && window.Capacitor.isNativePlatform();
    }

    async runTests() {
        console.log('=== ROBUST ICLOUD SYNC TESTS ===');
        
        if (!this.isCapacitor) {
            console.log('Tests only available on native platforms');
            return;
        }

        const results = {
            robustSyncAvailable: false,
            iCloudAccessible: false,
            dataSaveTest: false,
            dataLoadTest: false,
            migrationStatus: null,
            overallStatus: 'FAILED'
        };

        try {
            // Test 1: Check if robust sync is available
            console.log('Test 1: Checking robust sync availability...');
            results.robustSyncAvailable = !!window.RobustiCloudSync;
            console.log('✓ Robust sync available:', results.robustSyncAvailable);

            if (!results.robustSyncAvailable) {
                console.error('❌ Robust sync not available');
                return results;
            }

            // Test 2: Check iCloud accessibility
            console.log('Test 2: Checking iCloud accessibility...');
            const availability = await window.RobustiCloudSync.checkiCloudAvailability();
            results.iCloudAccessible = availability.available;
            console.log('✓ iCloud accessible:', results.iCloudAccessible, availability.reason);

            if (!results.iCloudAccessible) {
                console.error('❌ iCloud not accessible:', availability.reason);
                return results;
            }

            // Test 3: Test data save
            console.log('Test 3: Testing data save...');
            const testData = {
                tasks: [
                    { id: 1, title: 'Test Task', status: 'todo', priority: 'medium', created_at: new Date().toISOString() }
                ],
                notes: [],
                subtasks: []
            };

            const saveSuccess = await window.RobustiCloudSync.saveToiCloud(testData);
            results.dataSaveTest = saveSuccess;
            console.log('✓ Data save test:', saveSuccess);

            // Test 4: Test data load
            console.log('Test 4: Testing data load...');
            const loadedData = await window.RobustiCloudSync.loadFromiCloud();
            results.dataLoadTest = !!loadedData && loadedData.tasks && loadedData.tasks.length > 0;
            console.log('✓ Data load test:', results.dataLoadTest);

            // Test 5: Check migration status
            console.log('Test 5: Checking migration status...');
            if (window.SyncMigration) {
                results.migrationStatus = await window.SyncMigration.checkMigrationStatus();
                console.log('✓ Migration status:', results.migrationStatus);
            }

            // Overall status
            results.overallStatus = (results.robustSyncAvailable && 
                                   results.iCloudAccessible && 
                                   results.dataSaveTest && 
                                   results.dataLoadTest) ? 'PASSED' : 'FAILED';

            console.log('=== TEST RESULTS ===');
            console.log('Overall Status:', results.overallStatus);
            console.log('Robust Sync Available:', results.robustSyncAvailable);
            console.log('iCloud Accessible:', results.iCloudAccessible);
            console.log('Data Save Test:', results.dataSaveTest);
            console.log('Data Load Test:', results.dataLoadTest);
            console.log('Migration Status:', results.migrationStatus);

            return results;

        } catch (error) {
            console.error('Test failed with error:', error);
            results.error = error.message;
            return results;
        }
    }

    async runQuickTest() {
        console.log('=== QUICK SYNC TEST ===');
        
        if (!this.isCapacitor) {
            return { status: 'SKIPPED', reason: 'Not on native platform' };
        }

        try {
            // Quick availability check
            const availability = await window.RobustiCloudSync.checkiCloudAvailability();
            if (!availability.available) {
                return { status: 'FAILED', reason: availability.reason };
            }

            // Quick sync status
            const syncStatus = window.RobustiCloudSync.getSyncStatus();
            const dataStatus = window.RobustDataService.getSyncStatus();

            return {
                status: 'PASSED',
                iCloudAvailable: availability.available,
                syncInProgress: syncStatus.syncInProgress,
                lastSyncTime: dataStatus.lastSyncTime,
                hasRobustSync: dataStatus.hasRobustSync
            };

        } catch (error) {
            return { status: 'FAILED', reason: error.message };
        }
    }
}

// Initialize test helper
window.SyncTest = new SyncTest();
console.log('Sync Test helper initialized:', window.SyncTest);

// Add sync status check function
window.SyncTest.checkSyncStatus = async function() {
    console.log('=== SYNC STATUS CHECK ===');
    
    if (!this.isCapacitor) {
        console.log('Platform: Web (no iCloud sync)');
        return { platform: 'web' };
    }

    console.log('Platform: Native iOS');
    
    // Check if robust sync is available
    if (!window.RobustiCloudSync) {
        console.error('❌ Robust iCloud sync not available');
        return { platform: 'native', robustSyncAvailable: false };
    }
    
    console.log('✅ Robust iCloud sync available');
    
    // Get detailed sync status
    const syncStatus = await window.RobustiCloudSync.getSyncStatus();
    console.log('Sync Status:', syncStatus);
    
    // Check for old sync systems
    console.log('=== CHECKING FOR OLD SYNC SYSTEMS ===');
    if (window.iCloudSyncProper) {
        console.log('⚠️ Old proper iCloud sync still active');
        try {
            const oldData = await window.iCloudSyncProper.loadFromiCloud();
            if (oldData) {
                console.log('Old sync data found:', {
                    tasks: oldData.tasks?.length || 0,
                    lastSync: oldData.lastSync
                });
            }
        } catch (e) {
            console.log('Old sync not accessible:', e.message);
        }
    }
    
    console.log('=== END SYNC STATUS ===');
    return { platform: 'native', robustSyncAvailable: true, syncStatus };
};

// Auto-run quick test on load
if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    setTimeout(async () => {
        const result = await window.SyncTest.runQuickTest();
        console.log('Quick sync test result:', result);
    }, 2000);
}
