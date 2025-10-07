// Visual debugging system for offline testing
// Shows debug info directly in the app UI when console isn't available

class VisualDebugger {
    constructor() {
        this.debugPanel = null;
        this.logs = [];
        this.maxLogs = 20;
        this.isVisible = false;
    }

    init() {
        this.createDebugPanel();
        this.setupToggle();
        this.setupKeyboardShortcuts();
        this.log('Visual Debugger initialized');
    }

    setupKeyboardShortcuts() {
        // Close debug panel with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.toggle();
                e.preventDefault();
            }
        });
    }

    createDebugPanel() {
        // Create debug panel
        this.debugPanel = document.createElement('div');
        this.debugPanel.id = 'visualDebugPanel';
        // Responsive positioning - leave more space at top on tablets/mobile
        const isTabletOrMobile = window.innerWidth <= 1024;
        const topPosition = isTabletOrMobile ? '100px' : '80px';
        
        this.debugPanel.style.cssText = `
            position: fixed;
            top: ${topPosition};
            left: 10px;
            right: 10px;
            bottom: 10px;
            background: rgba(0, 0, 0, 0.95);
            color: #00ff00;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            padding: 10px;
            border-radius: 8px;
            z-index: 20000;
            display: none;
            overflow-y: auto;
            border: 2px solid #00ff00;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        `;

        // Create header
        const header = document.createElement('div');
        header.style.cssText = `
            position: sticky;
            top: 0;
            background: rgba(0, 0, 0, 0.9);
            padding: 5px 0;
            border-bottom: 1px solid #00ff00;
            margin-bottom: 10px;
        `;
        header.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>🐛 Visual Debug Console</span>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <button onclick="window.VisualDebugger.createTestTask()" style="background: #10b981; color: white; border: none; padding: 2px 8px; border-radius: 4px; font-size: 10px;">Test Save</button>
                    <button onclick="window.VisualDebugger.clear()" style="background: #ff4444; color: white; border: none; padding: 2px 8px; border-radius: 4px; font-size: 10px;">Clear</button>
                    <button onclick="window.VisualDebugger.toggle()" style="background: #6b7280; color: white; border: none; padding: 2px 8px; border-radius: 4px; font-size: 10px; margin-left: 4px;" title="Close debug panel">✕</button>
                </div>
            </div>
        `;

        // Create logs container
        this.logsContainer = document.createElement('div');
        this.logsContainer.id = 'debugLogs';

        this.debugPanel.appendChild(header);
        this.debugPanel.appendChild(this.logsContainer);
        document.body.appendChild(this.debugPanel);
    }

    setupToggle() {
        // Setup triple-click on logo to toggle debug panel
        const headerLogo = document.getElementById('headerLogo');
        if (headerLogo) {
            let clickCount = 0;
            let clickTimer = null;
            
            const handleLogoClick = (e) => {
                clickCount++;
                if (clickCount === 1) {
                    clickTimer = setTimeout(() => {
                        clickCount = 0;
                    }, 500);
                } else if (clickCount === 3) {
                    clearTimeout(clickTimer);
                    clickCount = 0;
                    this.toggle();
                    e.preventDefault();
                    e.stopPropagation();
                }
            };
            
            // Add both click and touch events for cross-platform support
            headerLogo.addEventListener('click', handleLogoClick);
            headerLogo.addEventListener('touchend', handleLogoClick);
            
            // Make logo clickable
            headerLogo.style.cursor = 'pointer';
            headerLogo.style.userSelect = 'none';
        }

        // Also allow triple-tap anywhere as fallback
        let tapCount = 0;
        let tapTimer = null;
        
        document.addEventListener('touchstart', (e) => {
            // Skip if the touch is on the logo (handled above)
            if (e.target.closest('#headerLogo')) return;
            
            tapCount++;
            if (tapCount === 1) {
                tapTimer = setTimeout(() => {
                    tapCount = 0;
                }, 500);
            } else if (tapCount === 3) {
                clearTimeout(tapTimer);
                tapCount = 0;
                this.toggle();
            }
        });
    }

    toggle() {
        this.isVisible = !this.isVisible;
        this.debugPanel.style.display = this.isVisible ? 'block' : 'none';
        
        if (this.isVisible) {
            this.runDiagnostics();
        }
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            timestamp,
            message,
            type
        };
        
        this.logs.push(logEntry);
        
        // Keep only recent logs
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        this.updateDisplay();
        
        // Also log to console if available
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    error(message) {
        this.log(message, 'error');
    }

    warn(message) {
        this.log(message, 'warn');
    }

    success(message) {
        this.log(message, 'success');
    }

    updateDisplay() {
        if (!this.logsContainer) return;
        
        const logsHtml = this.logs.map(log => {
            const color = {
                info: '#00ff00',
                error: '#ff4444',
                warn: '#ffaa00',
                success: '#44ff44'
            }[log.type] || '#00ff00';
            
            return `<div style="color: ${color}; margin-bottom: 5px;">
                [${log.timestamp}] ${log.message}
            </div>`;
        }).join('');
        
        this.logsContainer.innerHTML = logsHtml;
        this.logsContainer.scrollTop = this.logsContainer.scrollHeight;
    }

    clear() {
        this.logs = [];
        this.updateDisplay();
    }

    async runDiagnostics() {
        this.log('=== RUNNING OFFLINE DIAGNOSTICS ===');
        
        // Check network status
        this.log(`Network Status: ${navigator.onLine ? 'ONLINE' : 'OFFLINE'}`, navigator.onLine ? 'success' : 'warn');
        
        // Check storage (Capacitor Preferences or localStorage)
        try {
            let taskCount = 0, noteCount = 0, subtaskCount = 0;
            
            if (window.Capacitor?.isNativePlatform() && window.Capacitor?.Plugins?.Preferences) {
                // Check Capacitor Preferences
                this.log('Checking Capacitor Preferences...');
                const { Preferences } = window.Capacitor.Plugins;
                
                const tasksResult = await Preferences.get({ key: 'kanban_tasks' });
                const notesResult = await Preferences.get({ key: 'kanban_notes' });
                const subtasksResult = await Preferences.get({ key: 'kanban_subtasks' });
                
                taskCount = tasksResult.value ? JSON.parse(tasksResult.value).length : 0;
                noteCount = notesResult.value ? JSON.parse(notesResult.value).length : 0;
                subtaskCount = subtasksResult.value ? JSON.parse(subtasksResult.value).length : 0;
                
                this.log(`Capacitor Preferences: ${taskCount} tasks, ${noteCount} notes, ${subtaskCount} subtasks`, taskCount > 0 ? 'success' : 'warn');
            } else {
                // Check web localStorage
                this.log('Checking web localStorage...');
                const localTasks = localStorage.getItem('kanban_tasks');
                const localNotes = localStorage.getItem('kanban_notes');
                const localSubtasks = localStorage.getItem('kanban_subtasks');
                
                taskCount = localTasks ? JSON.parse(localTasks).length : 0;
                noteCount = localNotes ? JSON.parse(localNotes).length : 0;
                subtaskCount = localSubtasks ? JSON.parse(localSubtasks).length : 0;
                
                this.log(`Web localStorage: ${taskCount} tasks, ${noteCount} notes, ${subtaskCount} subtasks`, taskCount > 0 ? 'success' : 'warn');
            }
        } catch (error) {
            this.error(`Storage error: ${error.message}`);
        }
        
        // Check RobustDataService
        if (window.RobustDataService) {
            const serviceTasks = window.RobustDataService.tasks?.length || 0;
            const serviceNotes = window.RobustDataService.notes?.length || 0;
            const serviceSubtasks = window.RobustDataService.subtasks?.length || 0;
            
            this.log(`DataService: ${serviceTasks} tasks, ${serviceNotes} notes, ${serviceSubtasks} subtasks`, serviceTasks > 0 ? 'success' : 'warn');
            
            // Test getTasks method
            try {
                const filteredTasks = window.RobustDataService.getTasks();
                this.log(`getTasks() returned: ${filteredTasks.length} tasks`, filteredTasks.length > 0 ? 'success' : 'warn');
            } catch (error) {
                this.error(`getTasks() error: ${error.message}`);
            }
        } else {
            this.error('RobustDataService not available');
        }
        
        // Check app state
        if (window.app) {
            const appTasks = window.app.tasks?.length || 0;
            this.log(`App UI: ${appTasks} tasks displayed`, appTasks > 0 ? 'success' : 'warn');
        } else {
            this.error('App not available');
        }
        
        // Check sync provider
        if (window.RobustiCloudSync) {
            this.log('Sync provider: Available', 'success');
        } else {
            this.warn('Sync provider: Not available');
        }
        
        this.log('=== DIAGNOSTICS COMPLETE ===');
    }

    // Test methods for manual debugging
    async testLocalStorageLoad() {
        this.log('Testing storage load...');
        try {
            if (window.RobustDataService) {
                await window.RobustDataService.loadFromLocalStorage();
                const count = window.RobustDataService.tasks?.length || 0;
                this.log(`Loaded ${count} tasks from storage`, count > 0 ? 'success' : 'warn');
            } else {
                this.error('RobustDataService not available');
            }
        } catch (error) {
            this.error(`Storage load failed: ${error.message}`);
        }
    }

    async testUIRefresh() {
        this.log('Testing UI refresh...');
        try {
            if (window.app && window.app.loadTasks) {
                await window.app.loadTasks();
                const count = window.app.tasks?.length || 0;
                this.log(`UI refreshed with ${count} tasks`, count > 0 ? 'success' : 'warn');
            } else {
                this.error('App loadTasks not available');
            }
        } catch (error) {
            this.error(`UI refresh failed: ${error.message}`);
        }
    }

    async createTestTask() {
        this.log('Creating test task...');
        try {
            if (window.RobustDataService) {
                const testTask = await window.RobustDataService.addTask({
                    title: 'Debug Test Task ' + Date.now(),
                    description: 'Created by visual debugger',
                    priority: 'medium',
                    status: 'todo',
                    tags: ['debug-test']
                });
                this.success(`Test task created with ID: ${testTask.id}`);
                
                // Check if it was saved to storage
                await this.checkStorageAfterSave();
                
                // Refresh UI
                if (window.app && window.app.loadTasks) {
                    await window.app.loadTasks();
                    this.success('UI refreshed after test task creation');
                }
            } else {
                this.error('RobustDataService not available');
            }
        } catch (error) {
            this.error(`Test task creation failed: ${error.message}`);
        }
    }

    async checkStorageAfterSave() {
        this.log('Checking storage after save...');
        try {
            if (window.Capacitor?.isNativePlatform() && window.Capacitor?.Plugins?.Preferences) {
                const { Preferences } = window.Capacitor.Plugins;
                const tasksResult = await Preferences.get({ key: 'kanban_tasks' });
                const taskCount = tasksResult.value ? JSON.parse(tasksResult.value).length : 0;
                this.log(`Storage check: ${taskCount} tasks in Capacitor Preferences`, taskCount > 0 ? 'success' : 'warn');
                
                if (taskCount === 0) {
                    this.warn('No tasks found in Capacitor Preferences after save - investigating...');
                    
                    // Check if saveToLocalStorage was called
                    this.log('Checking if RobustDataService has tasks in memory...');
                    const memoryTasks = window.RobustDataService?.tasks?.length || 0;
                    this.log(`Tasks in DataService memory: ${memoryTasks}`);
                    
                    if (memoryTasks > 0) {
                        this.warn('Tasks exist in memory but not in Capacitor Preferences - save may have failed');
                        
                        // Try manual save
                        this.log('Attempting manual save to Capacitor Preferences...');
                        await window.RobustDataService.saveToLocalStorage();
                        
                        // Check again
                        const retryResult = await Preferences.get({ key: 'kanban_tasks' });
                        const retryCount = retryResult.value ? JSON.parse(retryResult.value).length : 0;
                        this.log(`After manual save: ${retryCount} tasks`, retryCount > 0 ? 'success' : 'error');
                    }
                }
            }
        } catch (error) {
            this.error(`Storage check failed: ${error.message}`);
        }
    }
}

// Initialize visual debugger
window.VisualDebugger = new VisualDebugger();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.VisualDebugger.init();
    });
} else {
    window.VisualDebugger.init();
}

// Add global debug functions for easy access
window.debugLog = (message, type) => window.VisualDebugger.log(message, type);
window.runDiagnostics = () => window.VisualDebugger.runDiagnostics();
window.testLocalStorageLoad = () => window.VisualDebugger.testLocalStorageLoad();
window.testUIRefresh = () => window.VisualDebugger.testUIRefresh();
window.createTestTask = () => window.VisualDebugger.createTestTask();

console.log('Visual Debugger loaded. Tap 🐛 button or triple-tap screen to open debug panel.');