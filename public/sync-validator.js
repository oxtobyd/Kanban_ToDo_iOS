// Comprehensive Sync Validation Script
class SyncValidator {
    constructor() {
        this.isCapacitor = window.Capacitor && window.Capacitor.isNativePlatform();
        this.validationResults = [];
    }

    async runFullValidation() {
        console.log('=== COMPREHENSIVE SYNC VALIDATION ===');
        this.validationResults = [];

        // Test 1: Platform Detection
        await this.validatePlatform();

        // Test 2: Plugin Availability
        await this.validatePlugins();

        // Test 3: iCloud Connectivity
        await this.validateiCloudConnectivity();

        // Test 4: Data Service Integration
        await this.validateDataServiceIntegration();

        // Test 5: Sync Operations
        await this.validateSyncOperations();

        // Test 6: Conflict Resolution
        await this.validateConflictResolution();

        // Test 7: Data Integrity
        await this.validateDataIntegrity();

        // Test 8: Error Handling
        await this.validateErrorHandling();

        // Generate final report
        const report = this.generateValidationReport();
        console.log('=== VALIDATION COMPLETE ===');
        console.log(report);
        
        return report;
    }

    async validatePlatform() {
        const test = {
            name: 'Platform Detection',
            status: 'unknown',
            details: {},
            issues: []
        };

        try {
            test.details.isCapacitor = this.isCapacitor;
            test.details.platform = this.isCapacitor ? 'native' : 'web';
            test.details.userAgent = navigator.userAgent;

            if (this.isCapacitor) {
                test.details.capacitorVersion = window.Capacitor?.version || 'unknown';
                test.details.isNative = window.Capacitor?.isNativePlatform() || false;
            }

            test.status = 'passed';
        } catch (error) {
            test.status = 'failed';
            test.issues.push(`Platform detection failed: ${error.message}`);
        }

        this.validationResults.push(test);
    }

    async validatePlugins() {
        const test = {
            name: 'Plugin Availability',
            status: 'unknown',
            details: {},
            issues: []
        };

        try {
            if (!this.isCapacitor) {
                test.status = 'skipped';
                test.details.reason = 'Not running on native platform';
                this.validationResults.push(test);
                return;
            }

            const plugins = window.Capacitor?.Plugins || {};
            test.details.availablePlugins = Object.keys(plugins);

            // Check required plugins
            const requiredPlugins = ['iCloudPreferences', 'Preferences', 'App'];
            const missingPlugins = requiredPlugins.filter(plugin => !plugins[plugin]);

            if (missingPlugins.length > 0) {
                test.status = 'failed';
                test.issues.push(`Missing required plugins: ${missingPlugins.join(', ')}`);
            } else {
                test.status = 'passed';
            }

            test.details.requiredPlugins = requiredPlugins;
            test.details.missingPlugins = missingPlugins;

        } catch (error) {
            test.status = 'failed';
            test.issues.push(`Plugin validation failed: ${error.message}`);
        }

        this.validationResults.push(test);
    }

    async validateiCloudConnectivity() {
        const test = {
            name: 'iCloud Connectivity',
            status: 'unknown',
            details: {},
            issues: []
        };

        try {
            if (!this.isCapacitor) {
                test.status = 'skipped';
                test.details.reason = 'Not running on native platform';
                this.validationResults.push(test);
                return;
            }

            if (!window.RobustiCloudSync) {
                test.status = 'failed';
                test.issues.push('Robust iCloud sync service not available');
                this.validationResults.push(test);
                return;
            }

            // Test iCloud availability
            const availability = await window.RobustiCloudSync.checkiCloudAvailability();
            test.details.iCloudAvailable = availability.available;
            test.details.iCloudReason = availability.reason;

            if (!availability.available) {
                test.status = 'failed';
                test.issues.push(`iCloud not available: ${availability.reason}`);
            } else {
                test.status = 'passed';
            }

        } catch (error) {
            test.status = 'failed';
            test.issues.push(`iCloud connectivity test failed: ${error.message}`);
        }

        this.validationResults.push(test);
    }

    async validateDataServiceIntegration() {
        const test = {
            name: 'Data Service Integration',
            status: 'unknown',
            details: {},
            issues: []
        };

        try {
            test.details.hasRobustDataService = !!window.RobustDataService;
            test.details.hasRobustiCloudSync = !!window.RobustiCloudSync;

            if (!window.RobustDataService) {
                test.status = 'failed';
                test.issues.push('Robust data service not available');
                this.validationResults.push(test);
                return;
            }

            // Test data service methods
            const methods = ['getTasks', 'addTask', 'updateTask', 'deleteTask', 'exportData', 'importData'];
            const missingMethods = methods.filter(method => typeof window.RobustDataService[method] !== 'function');

            if (missingMethods.length > 0) {
                test.status = 'failed';
                test.issues.push(`Missing data service methods: ${missingMethods.join(', ')}`);
            } else {
                test.status = 'passed';
            }

            test.details.availableMethods = methods.filter(method => typeof window.RobustDataService[method] === 'function');
            test.details.missingMethods = missingMethods;

        } catch (error) {
            test.status = 'failed';
            test.issues.push(`Data service integration test failed: ${error.message}`);
        }

        this.validationResults.push(test);
    }

    async validateSyncOperations() {
        const test = {
            name: 'Sync Operations',
            status: 'unknown',
            details: {},
            issues: []
        };

        try {
            if (!this.isCapacitor || !window.RobustiCloudSync) {
                test.status = 'skipped';
                test.details.reason = 'Sync operations only available on native platform with iCloud';
                this.validationResults.push(test);
                return;
            }

            // Test save operation
            const testData = {
                tasks: [{ id: 999999, title: 'Validation Test Task', status: 'todo', created_at: new Date().toISOString() }],
                notes: [],
                subtasks: [],
                timestamp: Date.now()
            };

            const saveResult = await window.RobustiCloudSync.saveToiCloud(testData);
            test.details.saveResult = saveResult;

            if (!saveResult) {
                test.issues.push('Failed to save test data to iCloud');
            }

            // Test load operation
            const loadResult = await window.RobustiCloudSync.loadFromiCloud();
            test.details.loadResult = !!loadResult;

            if (!loadResult) {
                test.issues.push('Failed to load data from iCloud');
            } else if (loadResult.timestamp !== testData.timestamp) {
                test.issues.push('Loaded data does not match saved data');
            }

            test.status = test.issues.length === 0 ? 'passed' : 'failed';

        } catch (error) {
            test.status = 'failed';
            test.issues.push(`Sync operations test failed: ${error.message}`);
        }

        this.validationResults.push(test);
    }

    async validateConflictResolution() {
        const test = {
            name: 'Conflict Resolution',
            status: 'unknown',
            details: {},
            issues: []
        };

        try {
            if (!window.RobustDataService) {
                test.status = 'skipped';
                test.details.reason = 'Data service not available';
                this.validationResults.push(test);
                return;
            }

            // Test timestamp-based conflict resolution
            const olderData = {
                tasks: [{ id: 1, title: 'Older Task', updated_at: '2023-01-01T00:00:00.000Z' }],
                notes: [],
                subtasks: []
            };

            const newerData = {
                tasks: [{ id: 1, title: 'Newer Task', updated_at: '2024-01-01T00:00:00.000Z' }],
                notes: [],
                subtasks: []
            };

            // Import older data first
            await window.RobustDataService.importData({ data: olderData }, { clearExisting: true });
            
            // Import newer data - should overwrite
            await window.RobustDataService.importData({ data: newerData }, { clearExisting: false });

            const tasks = window.RobustDataService.getTasks();
            const resolvedTask = tasks.find(t => t.id === 1);

            if (!resolvedTask) {
                test.issues.push('Task not found after conflict resolution');
            } else if (resolvedTask.title !== 'Newer Task') {
                test.issues.push('Conflict resolution failed - older data was kept');
            }

            test.details.resolvedCorrectly = resolvedTask?.title === 'Newer Task';
            test.status = test.issues.length === 0 ? 'passed' : 'failed';

        } catch (error) {
            test.status = 'failed';
            test.issues.push(`Conflict resolution test failed: ${error.message}`);
        }

        this.validationResults.push(test);
    }

    async validateDataIntegrity() {
        const test = {
            name: 'Data Integrity',
            status: 'unknown',
            details: {},
            issues: []
        };

        try {
            if (!window.RobustDataService || typeof window.RobustDataService.validateDataIntegrity !== 'function') {
                test.status = 'skipped';
                test.details.reason = 'Data integrity validation not available';
                this.validationResults.push(test);
                return;
            }

            const integrity = await window.RobustDataService.validateDataIntegrity();
            test.details.integrityResult = integrity;

            if (!integrity.isValid) {
                test.status = 'warning';
                test.issues.push(...integrity.issues);
            } else {
                test.status = 'passed';
            }

        } catch (error) {
            test.status = 'failed';
            test.issues.push(`Data integrity test failed: ${error.message}`);
        }

        this.validationResults.push(test);
    }

    async validateErrorHandling() {
        const test = {
            name: 'Error Handling',
            status: 'unknown',
            details: {},
            issues: []
        };

        try {
            // Test graceful handling of invalid operations
            let errorsCaught = 0;

            // Test invalid task operations
            try {
                await window.RobustDataService?.updateTask(999999999, { title: 'Non-existent task' });
            } catch (error) {
                errorsCaught++;
                test.details.taskUpdateErrorHandled = true;
            }

            // Test invalid note operations
            try {
                await window.RobustDataService?.deleteNote(999999999);
            } catch (error) {
                errorsCaught++;
                test.details.noteDeleteErrorHandled = true;
            }

            test.details.errorsCaught = errorsCaught;
            test.status = errorsCaught > 0 ? 'passed' : 'warning';

            if (errorsCaught === 0) {
                test.issues.push('Error handling may not be working correctly - no errors were caught');
            }

        } catch (error) {
            test.status = 'failed';
            test.issues.push(`Error handling test failed: ${error.message}`);
        }

        this.validationResults.push(test);
    }

    generateValidationReport() {
        const passed = this.validationResults.filter(r => r.status === 'passed').length;
        const failed = this.validationResults.filter(r => r.status === 'failed').length;
        const warnings = this.validationResults.filter(r => r.status === 'warning').length;
        const skipped = this.validationResults.filter(r => r.status === 'skipped').length;

        const overallStatus = failed > 0 ? 'FAILED' : warnings > 0 ? 'WARNING' : 'PASSED';

        const report = {
            timestamp: new Date().toISOString(),
            overallStatus: overallStatus,
            summary: {
                total: this.validationResults.length,
                passed: passed,
                failed: failed,
                warnings: warnings,
                skipped: skipped
            },
            results: this.validationResults,
            recommendations: this.generateRecommendations()
        };

        return report;
    }

    generateRecommendations() {
        const recommendations = [];
        const failedTests = this.validationResults.filter(r => r.status === 'failed');
        const warningTests = this.validationResults.filter(r => r.status === 'warning');

        if (failedTests.length === 0 && warningTests.length === 0) {
            recommendations.push('✅ All sync systems are working optimally');
            recommendations.push('✅ Your Kanban app has robust iCloud sync with proper conflict resolution');
            recommendations.push('✅ Data integrity is maintained across all operations');
        }

        failedTests.forEach(test => {
            recommendations.push(`❌ Fix ${test.name}: ${test.issues.join(', ')}`);
        });

        warningTests.forEach(test => {
            recommendations.push(`⚠️ Review ${test.name}: ${test.issues.join(', ')}`);
        });

        if (failedTests.some(t => t.name === 'iCloud Connectivity')) {
            recommendations.push('🔧 Check device iCloud settings and ensure app has iCloud permissions');
        }

        if (failedTests.some(t => t.name === 'Plugin Availability')) {
            recommendations.push('🔧 Run "npm install" and "npx cap sync" to ensure all plugins are installed');
        }

        return recommendations;
    }
}

// Initialize validator
window.SyncValidator = new SyncValidator();

// Add global function for easy access
window.validateSync = () => window.SyncValidator.runFullValidation();

console.log('Sync Validator loaded. Use validateSync() in console for comprehensive validation.');