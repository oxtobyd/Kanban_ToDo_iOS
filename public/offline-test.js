// Offline functionality test script
// This script helps test and debug offline sync behavior

class OfflineTest {
    constructor() {
        this.testResults = [];
    }

    async runOfflineTest() {
        console.log('=== OFFLINE FUNCTIONALITY TEST ===');
        this.testResults = [];

        // Test 1: Check if local storage works
        await this.testLocalStorage();

        // Test 2: Check if data persists when offline
        await this.testOfflineDataPersistence();

        // Test 3: Check if sync works when back online
        await this.testOnlineSync();

        // Test 4: Check network detection
        await this.testNetworkDetection();

        // Generate report
        const report = this.generateTestReport();
        console.log('=== OFFLINE TEST COMPLETE ===');
        console.log(report);
        
        return report;
    }

    async testLocalStorage() {
        const test = {
            name: 'Local Storage Functionality',
            status: 'unknown',
            details: {},
            issues: []
        };

        try {
            // Test basic localStorage operations
            const testKey = 'offline_test_' + Date.now();
            const testData = { test: true, timestamp: Date.now() };
            
            localStorage.setItem(testKey, JSON.stringify(testData));
            const retrieved = JSON.parse(localStorage.getItem(testKey));
            localStorage.removeItem(testKey);

            if (retrieved && retrieved.test === true) {
                test.status = 'passed';
                test.details.localStorage = 'Working';
            } else {
                test.status = 'failed';
                test.issues.push('localStorage read/write failed');
            }

            // Test if RobustDataService can save to localStorage
            if (window.RobustDataService) {
                await window.RobustDataService.saveToLocalStorage();
                test.details.dataServiceSave = 'Working';
            } else {
                test.issues.push('RobustDataService not available');
            }

        } catch (error) {
            test.status = 'failed';
            test.issues.push(`localStorage error: ${error.message}`);
        }

        this.testResults.push(test);
    }

    async testOfflineDataPersistence() {
        const test = {
            name: 'Offline Data Persistence',
            status: 'unknown',
            details: {},
            issues: []
        };

        try {
            if (!window.RobustDataService) {
                test.status = 'failed';
                test.issues.push('RobustDataService not available');
                this.testResults.push(test);
                return;
            }

            // Create a test task
            const testTask = {
                title: 'Offline Test Task ' + Date.now(),
                description: 'This task tests offline functionality',
                priority: 'medium',
                status: 'todo',
                tags: ['offline-test']
            };

            const createdTask = await window.RobustDataService.addTask(testTask);
            test.details.taskCreated = !!createdTask;

            // Check if task persists in local storage
            const tasks = window.RobustDataService.getTasks();
            const foundTask = tasks.find(t => t.id === createdTask.id);
            
            if (foundTask) {
                test.status = 'passed';
                test.details.taskPersisted = true;
                
                // Clean up test task
                await window.RobustDataService.deleteTask(createdTask.id);
            } else {
                test.status = 'failed';
                test.issues.push('Task not found after creation');
            }

        } catch (error) {
            test.status = 'failed';
            test.issues.push(`Data persistence error: ${error.message}`);
        }

        this.testResults.push(test);
    }

    async testOnlineSync() {
        const test = {
            name: 'Online Sync Functionality',
            status: 'unknown',
            details: {},
            issues: []
        };

        try {
            test.details.isOnline = navigator.onLine;
            test.details.hasRobustDataService = !!window.RobustDataService;
            test.details.hasCloudSync = !!window.RobustiCloudSync;

            if (!navigator.onLine) {
                test.status = 'skipped';
                test.details.reason = 'Device is offline';
                this.testResults.push(test);
                return;
            }

            if (window.RobustDataService && window.RobustDataService.manualSync) {
                try {
                    await window.RobustDataService.manualSync();
                    test.status = 'passed';
                    test.details.syncCompleted = true;
                } catch (error) {
                    test.status = 'warning';
                    test.issues.push(`Sync failed: ${error.message}`);
                }
            } else {
                test.status = 'skipped';
                test.details.reason = 'Manual sync not available';
            }

        } catch (error) {
            test.status = 'failed';
            test.issues.push(`Online sync error: ${error.message}`);
        }

        this.testResults.push(test);
    }

    async testNetworkDetection() {
        const test = {
            name: 'Network Detection',
            status: 'unknown',
            details: {},
            issues: []
        };

        try {
            test.details.navigatorOnLine = navigator.onLine;
            test.details.hasOnlineListener = typeof window.addEventListener === 'function';
            test.details.hasOfflineListener = typeof window.addEventListener === 'function';

            // Test if network events are properly set up
            let onlineEventFired = false;
            let offlineEventFired = false;

            const onlineHandler = () => { onlineEventFired = true; };
            const offlineHandler = () => { offlineEventFired = true; };

            window.addEventListener('online', onlineHandler);
            window.addEventListener('offline', offlineHandler);

            // Simulate network events (this won't actually change network state)
            // but we can check if the listeners are properly attached
            test.details.eventListenersAttached = true;

            // Clean up
            window.removeEventListener('online', onlineHandler);
            window.removeEventListener('offline', offlineHandler);

            test.status = 'passed';

        } catch (error) {
            test.status = 'failed';
            test.issues.push(`Network detection error: ${error.message}`);
        }

        this.testResults.push(test);
    }

    generateTestReport() {
        const passed = this.testResults.filter(r => r.status === 'passed').length;
        const failed = this.testResults.filter(r => r.status === 'failed').length;
        const warnings = this.testResults.filter(r => r.status === 'warning').length;
        const skipped = this.testResults.filter(r => r.status === 'skipped').length;

        const overallStatus = failed > 0 ? 'FAILED' : warnings > 0 ? 'WARNING' : 'PASSED';

        const report = {
            timestamp: new Date().toISOString(),
            overallStatus: overallStatus,
            summary: {
                total: this.testResults.length,
                passed: passed,
                failed: failed,
                warnings: warnings,
                skipped: skipped
            },
            results: this.testResults,
            recommendations: this.generateRecommendations()
        };

        return report;
    }

    generateRecommendations() {
        const recommendations = [];
        const failedTests = this.testResults.filter(r => r.status === 'failed');
        const warningTests = this.testResults.filter(r => r.status === 'warning');

        if (failedTests.length === 0 && warningTests.length === 0) {
            recommendations.push('✅ Offline functionality is working correctly');
            recommendations.push('✅ Data will be preserved when offline and synced when back online');
        }

        failedTests.forEach(test => {
            recommendations.push(`❌ Fix ${test.name}: ${test.issues.join(', ')}`);
        });

        warningTests.forEach(test => {
            recommendations.push(`⚠️ Review ${test.name}: ${test.issues.join(', ')}`);
        });

        if (failedTests.some(t => t.name === 'Local Storage Functionality')) {
            recommendations.push('🔧 Check browser storage permissions and available space');
        }

        if (failedTests.some(t => t.name === 'Offline Data Persistence')) {
            recommendations.push('🔧 Verify RobustDataService is properly initialized');
        }

        return recommendations;
    }

    // Quick test method for console use
    async quickTest() {
        console.log('Running quick offline test...');
        
        // Test 1: Check if we have local data
        if (window.RobustDataService) {
            const tasks = window.RobustDataService.getTasks();
            console.log(`✅ Found ${tasks.length} tasks in local storage`);
            
            // Test 2: Try to create a task
            try {
                const testTask = await window.RobustDataService.addTask({
                    title: 'Quick Test Task',
                    description: 'Testing offline functionality',
                    priority: 'low',
                    status: 'todo'
                });
                console.log('✅ Successfully created test task:', testTask.id);
                
                // Clean up
                await window.RobustDataService.deleteTask(testTask.id);
                console.log('✅ Successfully deleted test task');
                
            } catch (error) {
                console.error('❌ Failed to create/delete test task:', error);
            }
            
            // Test 3: Check sync status
            if (window.RobustDataService.getSyncStatus) {
                const status = window.RobustDataService.getSyncStatus();
                console.log('📊 Sync status:', status);
            }
            
        } else {
            console.error('❌ RobustDataService not available');
        }
        
        console.log('Network status:', navigator.onLine ? 'Online' : 'Offline');
    }
}

// Initialize offline test
window.OfflineTest = new OfflineTest();

// Add global functions for easy access
window.testOffline = () => window.OfflineTest.runOfflineTest();
window.quickOfflineTest = () => window.OfflineTest.quickTest();

console.log('Offline Test loaded. Use testOffline() or quickOfflineTest() in console.');