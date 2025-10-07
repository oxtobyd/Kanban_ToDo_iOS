// Robust Data Service using Apple-standard iCloud sync
// Eliminates conflicts by using single sync system
class RobustDataService {
    constructor() {
        this.isCapacitor = window.Capacitor && window.Capacitor.isNativePlatform();
        this.tasks = [];
        this.notes = [];
        this.subtasks = [];
        this.nextTaskId = 1;
        this.nextNoteId = 1;
        this.nextSubtaskId = 1;
        this.lastSyncTime = null;
        this.syncInProgress = false;
        this.pendingChanges = false;
        this.changeListeners = [];
        this.deviceId = null;
    }

    async init() {
        console.log('=== RobustDataService.init() starting ===');
        if (window.debugLog) window.debugLog('RobustDataService.init() starting...');
        
        // Generate or retrieve device ID for conflict-free ID generation
        console.log('Initializing device ID...');
        await this.initializeDeviceId();
        console.log('Device ID initialized:', this.deviceId);
        
        // Ensure the desired sync provider (iCloud or Supabase) is selected before using it
        console.log('Selecting sync provider...');
        try {
            if (window.SyncSettings && typeof window.SyncSettings.selectProvider === 'function') {
                await window.SyncSettings.selectProvider();
                console.log('Sync provider selected successfully');
            } else {
                console.log('SyncSettings.selectProvider not available');
            }
        } catch (e) {
            console.warn('Provider select failed or unavailable, continuing with default:', e?.message || e);
            if (window.debugLog) window.debugLog(`Provider select failed: ${e?.message}`, 'warn');
        }
        
        if (this.isCapacitor) {
            // Always load from local storage first to ensure offline functionality
            console.log('Loading from local storage first for offline support...');
            if (window.debugLog) window.debugLog('Loading from localStorage first...');
            
            try {
                await this.loadFromLocalStorage();
                console.log('Local storage loaded successfully:', {
                    tasks: this.tasks?.length || 0,
                    notes: this.notes?.length || 0,
                    subtasks: this.subtasks?.length || 0
                });
                
                if (window.debugLog) {
                    window.debugLog(`Loaded from localStorage: ${this.tasks?.length || 0} tasks, ${this.notes?.length || 0} notes, ${this.subtasks?.length || 0} subtasks`,
                        (this.tasks?.length || 0) > 0 ? 'success' : 'warn');
                }
            } catch (error) {
                console.error('Error loading from local storage:', error);
                if (window.debugLog) window.debugLog(`Error loading from localStorage: ${error.message}`, 'error');
                // Initialize empty arrays if loading fails
                this.tasks = [];
                this.notes = [];
                this.subtasks = [];
            }
            
            // Initialize sync if provider is selected (but don't let it block local data loading)
            if (window.RobustiCloudSync) {
                try {
                    console.log('Initializing cloud sync...');
                    await window.RobustiCloudSync.init();
                    console.log('Cloud sync initialized successfully');
                    
                    // Setup change listener for external updates
                    window.RobustiCloudSync.addChangeListener(async (cloudData) => {
                        // Check if sync is disabled for local changes
                        if (window.__syncDisabled) {
                            console.log('Skipping cloud import - sync disabled for local changes');
                            return;
                        }
                        
                        // Check if we have recent local changes (within last 10 seconds)
                        const now = Date.now();
                        if (window.__lastLocalChange && (now - window.__lastLocalChange) < 10000) {
                            console.log('Skipping cloud import - recent local changes detected (age:', now - window.__lastLocalChange, 'ms)');
                            return;
                        }
                        
                        // External cloud change detected, importing
                        await this.importData({ data: cloudData }, { clearExisting: true });
                        this.lastSyncTime = cloudData.lastSync;
                        this.notifyChangeListeners();
                    });

                    // Try to load initial data from sync provider (with timeout for offline scenarios)
                    console.log('Attempting to sync with cloud provider...');
                    const cloudData = await Promise.race([
                        window.RobustiCloudSync.loadFromiCloud(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Cloud sync timeout')), 10000))
                    ]);
                    
                    if (cloudData && cloudData.hasOwnProperty('tasks')) {
                        console.log('Cloud data found, merging with local data...');
                        // Merge cloud data with local data instead of clearing existing
                        await this.importData({ data: cloudData }, { clearExisting: false });
                        this.lastSyncTime = cloudData.lastSync;
                        console.log('Successfully synced with cloud provider');
                    } else {
                        console.log('No cloud data available, using local data');
                    }
                } catch (error) {
                    console.log('Cloud sync failed (offline or network issue), using local data:', error.message);
                    if (window.debugLog) window.debugLog(`Cloud sync failed: ${error.message} - using local data`, 'warn');
                    // Local data is already loaded, so we can continue offline
                    // Make sure we still notify listeners even if sync fails
                    console.log('Ensuring UI is notified despite sync failure...');
                }
            } else {
                // No sync provider selected - using local storage only
                console.log('No sync provider selected - using local storage only');
            }
            
            // Always notify listeners after initialization
            this.notifyChangeListeners();
        } else {
            await this.loadFromLocalStorage();
            this.notifyChangeListeners();
        }

        // FAIL-SAFE: Ensure we have data loaded, regardless of what happened above
        console.log('Final data check after initialization:', {
            tasks: this.tasks?.length || 0,
            notes: this.notes?.length || 0,
            subtasks: this.subtasks?.length || 0
        });
        
        if (this.isCapacitor && (this.tasks?.length || 0) === 0) {
            console.log('FAIL-SAFE: No tasks loaded, attempting emergency local storage load...');
            if (window.debugLog) window.debugLog('FAIL-SAFE: Attempting emergency local storage load...', 'warn');
            
            try {
                await this.loadFromLocalStorage();
                console.log('Emergency load result:', {
                    tasks: this.tasks?.length || 0,
                    notes: this.notes?.length || 0,
                    subtasks: this.subtasks?.length || 0
                });
                
                if ((this.tasks?.length || 0) > 0) {
                    console.log('Emergency load successful, notifying UI...');
                    this.notifyChangeListeners();
                }
            } catch (error) {
                console.error('Emergency load failed:', error);
                if (window.debugLog) window.debugLog(`Emergency load failed: ${error.message}`, 'error');
            }
        }

        // Run cleanup on startup and then every 24 hours
        await this.cleanupDeletedItems();
        setInterval(() => this.cleanupDeletedItems(), 24 * 60 * 60 * 1000); // 24 hours

        // Setup network connectivity monitoring for automatic sync when back online
        this.setupNetworkMonitoring();

        // Robust Data Service initialized
    }

    async initializeDeviceId() {
        try {
            if (this.isCapacitor && window.Capacitor.Plugins.Device) {
                const deviceInfo = await window.Capacitor.Plugins.Device.getId();
                this.deviceId = deviceInfo.identifier;
            } else {
                // Fallback for web - use localStorage
                let deviceId = localStorage.getItem('deviceId');
                if (!deviceId) {
                    deviceId = 'web-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                    localStorage.setItem('deviceId', deviceId);
                }
                this.deviceId = deviceId;
            }
            // Device ID initialized
        } catch (error) {
            // Fallback device ID
            this.deviceId = 'device-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            console.warn('Could not get device ID, using fallback:', this.deviceId);
        }
    }

    // Generate conflict-free IDs using device ID + timestamp + counter
    generateUniqueId(type = 'task') {
        const timestamp = Date.now();
        
        // Ensure we have a valid device ID
        if (!this.deviceId) {
            console.error('Device ID not initialized, generating fallback');
            this.deviceId = 'fallback-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        }
        
        // Use a more robust device prefix
        const devicePrefix = this.deviceId.slice(-6).replace(/\D/g, '').padStart(6, '0');
        const counter = type === 'task' ? this.nextTaskId++ : 
                      type === 'note' ? this.nextNoteId++ : 
                      this.nextSubtaskId++;
        
        // Format: timestamp + device + counter (ensures uniqueness across devices)
        const uniqueId = parseInt(`${timestamp}${devicePrefix}${counter.toString().padStart(3, '0')}`);
        
        console.log(`Generated unique ID for ${type}:`, {
            deviceId: this.deviceId,
            devicePrefix: devicePrefix,
            counter: counter,
            uniqueId: uniqueId
        });
        
        return uniqueId;
    }

    async saveToStorage() {
        if (this.syncInProgress) {
            this.pendingChanges = true;
            return;
        }

        this.syncInProgress = true;

        try {
            // Always save to localStorage first to ensure data persistence
            await this.saveToLocalStorage();
            console.log('Data saved to local storage');
            
            if (this.isCapacitor && window.RobustiCloudSync) {
                // Try to sync to cloud provider
                const exportData = await this.exportData();
                console.log('Attempting cloud sync - data summary:', {
                    tasks: exportData.data.tasks?.length || 0,
                    notes: exportData.data.notes?.length || 0,
                    deletedNotes: exportData.data.notes?.filter(n => n.deleted)?.length || 0,
                    subtasks: exportData.data.subtasks?.length || 0
                });
                
                try {
                    const success = await window.RobustiCloudSync.saveToiCloud(exportData.data);
                    
                    if (success) {
                        this.lastSyncTime = exportData.exported_at;
                        console.log('Successfully saved to cloud sync and local storage');
                    } else {
                        console.log('Cloud sync failed (likely offline), but data is safely stored locally');
                    }
                } catch (cloudError) {
                    console.log('Cloud sync error (likely offline):', cloudError.message, '- data is safely stored locally');
                }
            }
        } catch (error) {
            console.error('Error saving data:', error);
            // Critical: Try to save to local storage again if the first attempt failed
            try {
                await this.saveToLocalStorage();
                console.log('Saved to local storage as fallback after error');
            } catch (localError) {
                console.error('Critical: Failed to save to local storage:', localError);
                throw localError; // This is a critical error - we can't save data anywhere
            }
        } finally {
            this.syncInProgress = false;
            
            // Handle pending changes
            if (this.pendingChanges) {
                this.pendingChanges = false;
                setTimeout(() => this.saveToStorage(), 1000);
            }
        }
    }

    async manualSync() {
        if (!this.isCapacitor || !window.RobustiCloudSync) {
            return;
        }
        
        // Check if sync is disabled for local changes
        if (window.__syncDisabled) {
            console.log('Skipping manual sync - sync disabled for local changes');
            return;
        }
        
        try {
            // Check for updates from iCloud
            const currentData = {
                tasks: this.tasks,
                notes: this.notes,
                subtasks: this.subtasks,
                lastSync: this.lastSyncTime
            };

            console.log('Manual sync check - current lastSync:', this.lastSyncTime);
            const syncResult = await window.RobustiCloudSync.checkForUpdates(currentData);
            console.log('Sync check result:', {
                hasUpdates: syncResult.hasUpdates,
                currentSync: syncResult.currentSync,
                cloudSync: syncResult.cloudSync
            });
            
            if (syncResult.hasUpdates) {
                // Check if we have recent local changes (within last 10 seconds)
                const now = Date.now();
                if (window.__lastLocalChange && (now - window.__lastLocalChange) < 10000) {
                    console.log('Skipping sync import - recent local changes detected (age:', now - window.__lastLocalChange, 'ms)');
                    return;
                }
                
                console.log('Updates found! Importing data...');
                await this.importData({ data: syncResult.data }, { clearExisting: true });
                this.lastSyncTime = syncResult.cloudSync;
                console.log('Data imported, new lastSync:', this.lastSyncTime);
                this.notifyChangeListeners();
            } else {
                console.log('No updates found');
            }
        } catch (error) {
            console.error('Error during manual sync:', error);
        }
    }

    async loadFromLocalStorage() {
        try {
            if (this.isCapacitor && window.Capacitor?.Plugins?.Preferences) {
                // Use Capacitor Preferences for persistent storage on mobile
                console.log('Loading from Capacitor Preferences...');
                const { Preferences } = window.Capacitor.Plugins;
                
                const tasksResult = await Preferences.get({ key: 'kanban_tasks' });
                this.tasks = tasksResult.value ? JSON.parse(tasksResult.value) : [];
                
                const notesResult = await Preferences.get({ key: 'kanban_notes' });
                this.notes = notesResult.value ? JSON.parse(notesResult.value) : [];
                
                const subtasksResult = await Preferences.get({ key: 'kanban_subtasks' });
                this.subtasks = subtasksResult.value ? JSON.parse(subtasksResult.value) : [];
                
                const taskIdResult = await Preferences.get({ key: 'kanban_next_task_id' });
                this.nextTaskId = taskIdResult.value ? parseInt(taskIdResult.value) : 1;
                
                const noteIdResult = await Preferences.get({ key: 'kanban_next_note_id' });
                this.nextNoteId = noteIdResult.value ? parseInt(noteIdResult.value) : 1;
                
                const subtaskIdResult = await Preferences.get({ key: 'kanban_next_subtask_id' });
                this.nextSubtaskId = subtaskIdResult.value ? parseInt(subtaskIdResult.value) : 1;
                
                console.log('Loaded from Capacitor Preferences:', {
                    tasks: this.tasks.length,
                    notes: this.notes.length,
                    subtasks: this.subtasks.length
                });
            } else {
                // Fallback to localStorage for web
                console.log('Loading from web localStorage...');
                this.tasks = JSON.parse(localStorage.getItem('kanban_tasks') || '[]');
                this.notes = JSON.parse(localStorage.getItem('kanban_notes') || '[]');
                this.subtasks = JSON.parse(localStorage.getItem('kanban_subtasks') || '[]');
                this.nextTaskId = parseInt(localStorage.getItem('kanban_next_task_id') || '1');
                this.nextNoteId = parseInt(localStorage.getItem('kanban_next_note_id') || '1');
                this.nextSubtaskId = parseInt(localStorage.getItem('kanban_next_subtask_id') || '1');
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            if (window.debugLog) window.debugLog(`Error loading from storage: ${error.message}`, 'error');
        }
    }

    // Save only to local storage (used by import to avoid race conditions)
    async saveToLocalStorageOnly() {
        return await this.saveToLocalStorage();
    }

    async saveToLocalStorage() {
        try {
            if (this.isCapacitor && window.Capacitor?.Plugins?.Preferences) {
                // Use Capacitor Preferences for persistent storage on mobile
                console.log('Saving to Capacitor Preferences...');
                const { Preferences } = window.Capacitor.Plugins;
                
                console.log('About to save to Capacitor Preferences:', {
                    tasks: this.tasks.length,
                    notes: this.notes.length,
                    subtasks: this.subtasks.length,
                    tasksData: this.tasks.map(t => ({ id: t.id, title: t.title }))
                });
                
                await Preferences.set({ key: 'kanban_tasks', value: JSON.stringify(this.tasks) });
                await Preferences.set({ key: 'kanban_notes', value: JSON.stringify(this.notes) });
                await Preferences.set({ key: 'kanban_subtasks', value: JSON.stringify(this.subtasks) });
                await Preferences.set({ key: 'kanban_next_task_id', value: this.nextTaskId.toString() });
                await Preferences.set({ key: 'kanban_next_note_id', value: this.nextNoteId.toString() });
                await Preferences.set({ key: 'kanban_next_subtask_id', value: this.nextSubtaskId.toString() });
                
                // Verify the save worked
                const verifyResult = await Preferences.get({ key: 'kanban_tasks' });
                const verifyCount = verifyResult.value ? JSON.parse(verifyResult.value).length : 0;
                
                console.log('Saved to Capacitor Preferences - verification:', {
                    intended: this.tasks.length,
                    actual: verifyCount,
                    success: verifyCount === this.tasks.length
                });
                
                if (window.debugLog) {
                    window.debugLog(`Saved to Capacitor Preferences: ${this.tasks.length} tasks → verified: ${verifyCount} tasks`, 
                        verifyCount === this.tasks.length ? 'success' : 'error');
                }
            } else {
                // Fallback to localStorage for web
                console.log('Saving to web localStorage...');
                localStorage.setItem('kanban_tasks', JSON.stringify(this.tasks));
                localStorage.setItem('kanban_notes', JSON.stringify(this.notes));
                localStorage.setItem('kanban_subtasks', JSON.stringify(this.subtasks));
                localStorage.setItem('kanban_next_task_id', this.nextTaskId.toString());
                localStorage.setItem('kanban_next_note_id', this.nextNoteId.toString());
                localStorage.setItem('kanban_next_subtask_id', this.nextSubtaskId.toString());
            }
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            if (window.debugLog) window.debugLog(`Error saving to storage: ${error.message}`, 'error');
        }
    }

    // Task management methods
    async addTask(task) {
        const newTask = {
            ...task,
            id: this.generateUniqueId('task'),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        this.tasks.push(newTask);
        await this.saveToStorage();
        this.notifyChangeListeners();
        return newTask;
    }

    async updateTask(id, updates) {
        const taskIndex = this.tasks.findIndex(task => task.id == id);
        if (taskIndex !== -1) {
            this.tasks[taskIndex] = {
                ...this.tasks[taskIndex],
                ...updates,
                updated_at: new Date().toISOString()
            };
            await this.saveToStorage();
            this.notifyChangeListeners();
            return this.tasks[taskIndex];
        }
        return null;
    }

    async deleteTask(id) {
        const taskIndex = this.tasks.findIndex(task => task.id == id);
        if (taskIndex !== -1) {
            // Mark as deleted with timestamp instead of removing immediately
            this.tasks[taskIndex] = {
                ...this.tasks[taskIndex],
                deleted: true,
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            // Also mark related notes and subtasks as deleted
            this.notes.forEach((note, index) => {
                if (note.task_id == id) {
                    this.notes[index] = {
                        ...note,
                        deleted: true,
                        deleted_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };
                }
            });
            
            this.subtasks.forEach((subtask, index) => {
                if (subtask.task_id == id) {
                    this.subtasks[index] = {
                        ...subtask,
                        deleted: true,
                        deleted_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };
                }
            });
            
            // Task and related items marked as deleted
            
            await this.saveToStorage();
            this.notifyChangeListeners();
            return true;
        }
        return false;
    }

    // Note management methods
    async addNote(note) {
        const newNote = {
            ...note,
            // Keep task_id as-is (no parseInt needed for large IDs)
            task_id: note.task_id,
            id: this.generateUniqueId('note'),
            created_at: new Date().toISOString()
        };
        
        this.notes.push(newNote);
        await this.saveToStorage();
        this.notifyChangeListeners();
        return newNote;
    }

    async updateNote(id, updates) {
        const noteIndex = this.notes.findIndex(note => note.id == id);
        if (noteIndex !== -1) {
            this.notes[noteIndex] = {
                ...this.notes[noteIndex],
                ...updates
            };
            await this.saveToStorage();
            this.notifyChangeListeners();
            return this.notes[noteIndex];
        }
        return null;
    }

    async deleteNote(id) {
        const noteIndex = this.notes.findIndex(note => note.id == id);
        if (noteIndex !== -1) {
            console.log('Marking note as deleted:', {
                id: id,
                noteIndex,
                currentNote: this.notes[noteIndex]
            });
            
            // Mark as deleted with timestamp instead of removing immediately
            this.notes[noteIndex] = {
                ...this.notes[noteIndex],
                deleted: true,
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            console.log('Note marked as deleted:', this.notes[noteIndex]);
            
            await this.saveToStorage();
            this.notifyChangeListeners();
            return true;
        }
        console.log('Note not found for deletion:', numericId);
        return false;
    }

    // Subtask management methods
    async addSubtask(subtask) {
        const newSubtask = {
            ...subtask,
            // Keep task_id as-is (no parseInt needed for large IDs)
            task_id: subtask.task_id,
            id: this.generateUniqueId('subtask'),
            created_at: new Date().toISOString()
        };
        
        this.subtasks.push(newSubtask);
        await this.saveToStorage();
        this.notifyChangeListeners();
        return newSubtask;
    }

    async updateSubtask(id, updates) {
        console.log('updateSubtask called with:', { id, updates });
        const subtaskIndex = this.subtasks.findIndex(subtask => subtask.id == id);
        console.log('Found subtask at index:', subtaskIndex, 'for id:', id);
        if (subtaskIndex !== -1) {
            const updated = {
                ...this.subtasks[subtaskIndex],
                ...updates,
                updated_at: new Date().toISOString()
            };
            console.log('Updating subtask from:', this.subtasks[subtaskIndex], 'to:', updated);
            this.subtasks[subtaskIndex] = updated;
            // Subtask updated
            await this.saveToStorage();
            this.notifyChangeListeners();
            return updated;
        }
        console.warn('Subtask not found for update:', { id: id });
        return null;
    }

    async deleteSubtask(id) {
        console.log('deleteSubtask in data service called with:', id);
        const subtaskIndex = this.subtasks.findIndex(subtask => subtask.id == id);
        console.log('Found subtask at index:', subtaskIndex, 'for id:', id);
        if (subtaskIndex !== -1) {
            console.log('Before delete - subtask:', this.subtasks[subtaskIndex]);
            // Mark as deleted with timestamp instead of removing immediately
            this.subtasks[subtaskIndex] = {
                ...this.subtasks[subtaskIndex],
                deleted: true,
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            console.log('After delete - subtask:', this.subtasks[subtaskIndex]);
            
            // Subtask marked as deleted
            
            await this.saveToStorage();
            this.notifyChangeListeners();
            return true;
        }
        console.log('Subtask not found for deletion');
        return false;
    }

    // Data export/import
    async exportData() {
        const exportData = {
            tasks: this.tasks,
            notes: this.notes,
            subtasks: this.subtasks,
            nextTaskId: this.nextTaskId,
            nextNoteId: this.nextNoteId,
            nextSubtaskId: this.nextSubtaskId,
            exported_at: new Date().toISOString(),
            version: 1
        };

        return {
            data: exportData,
            exported_at: exportData.exported_at
        };
    }

    async importData(importData, options = {}) {
        try {
            console.log('importData called - clearExisting:', options.clearExisting, 'syncDisabled:', window.__syncDisabled, 'lastLocalChange:', window.__lastLocalChange);
            
            // Check if sync is disabled for local changes
            if (window.__syncDisabled) {
                console.log('Skipping importData - sync disabled for local changes');
                return {
                    success: false,
                    message: 'Import skipped - sync disabled for local changes'
                };
            }
            
            // Check if we have recent local changes (within last 10 seconds)
            const now = Date.now();
            if (window.__lastLocalChange && (now - window.__lastLocalChange) < 10000) {
                console.log('Skipping importData - recent local changes detected (age:', now - window.__lastLocalChange, 'ms)');
                return {
                    success: false,
                    message: 'Import skipped - recent local changes detected'
                };
            }
        
        const { data } = importData;
        const { clearExisting = false } = options;

        const isIncomingNewer = (existing, incoming) => {
            const ex = existing?.updated_at || existing?.created_at;
            const inc = incoming?.updated_at || incoming?.created_at;
            const exT = ex ? new Date(ex).getTime() : 0;
            const incT = inc ? new Date(inc).getTime() : 0;
            return incT >= exT;
        };

        // Helper to merge items with proper deletion handling
        const mergeItems = (localItems, incomingItems, itemType = 'items') => {
            const itemMap = new Map();
            
            console.log(`Merging ${itemType} - Local:`, localItems.length, 'Incoming:', incomingItems.length);
            
            // Add all local items first
            localItems.forEach(item => itemMap.set(item.id, item));
            
            // Process incoming items
            incomingItems.forEach(incomingItem => {
                const existingItem = itemMap.get(incomingItem.id);
                
                if (!existingItem) {
                    // New item from remote
                    console.log(`${itemType} - New item from remote:`, incomingItem.id, incomingItem.deleted ? '(DELETED)' : '(ACTIVE)');
                    itemMap.set(incomingItem.id, incomingItem);
                } else if (isIncomingNewer(existingItem, incomingItem)) {
                    // Incoming item is newer, use it
                    console.log(`${itemType} - Incoming newer:`, incomingItem.id, 
                        existingItem.deleted ? 'was DELETED' : 'was ACTIVE', 
                        '→', 
                        incomingItem.deleted ? 'now DELETED' : 'now ACTIVE');
                    itemMap.set(incomingItem.id, incomingItem);
                } else {
                    console.log(`${itemType} - Keeping existing:`, existingItem.id, existingItem.deleted ? '(DELETED)' : '(ACTIVE)');
                }
                // If existing is newer or equal, keep existing (no action needed)
            });
            
            const result = Array.from(itemMap.values());
            console.log(`${itemType} merge result:`, result.length, 'total,', result.filter(i => i.deleted).length, 'deleted');
            return result;
        };

        const incomingTasks = (data.tasks || []).map(t => ({ ...t }));
        const incomingNotes = (data.notes || []).map(n => ({ ...n }));
        const incomingSubtasks = (data.subtasks || []).map(s => ({ ...s }));

        // Use the new merge function that properly handles deletions
        console.log('Before merge - local notes:', this.notes.length, 'deleted:', this.notes.filter(n => n.deleted).length);
        console.log('Incoming notes:', incomingNotes.length, 'deleted:', incomingNotes.filter(n => n.deleted).length);
        
        this.tasks = mergeItems(this.tasks, incomingTasks, 'tasks');
        this.notes = mergeItems(this.notes, incomingNotes, 'notes');
        this.subtasks = mergeItems(this.subtasks, incomingSubtasks, 'subtasks');
        
        console.log('After merge - total notes:', this.notes.length, 'deleted:', this.notes.filter(n => n.deleted).length);

        // Update ID counters
        if (clearExisting) {
            this.nextTaskId = data.nextTaskId || this.nextTaskId || 1;
            this.nextNoteId = data.nextNoteId || this.nextNoteId || 1;
            this.nextSubtaskId = data.nextSubtaskId || this.nextSubtaskId || 1;
        } else {
            this.nextTaskId = Math.max(this.nextTaskId, data.nextTaskId || 1);
            this.nextNoteId = Math.max(this.nextNoteId, data.nextNoteId || 1);
            this.nextSubtaskId = Math.max(this.nextSubtaskId, data.nextSubtaskId || 1);
        }

        // Import completed - save to local storage to ensure offline availability
        console.log('Import completed - saving merged data to local storage for offline access');
        
        // Use a separate method that only saves to local storage (no cloud sync)
        // This avoids race conditions with ongoing cloud sync operations
        await this.saveToLocalStorageOnly();
        console.log('Imported data saved to local storage:', {
            tasks: this.tasks.length,
            notes: this.notes.length,
            subtasks: this.subtasks.length
        });
        
        this.notifyChangeListeners();
        
        // Return success result
        return {
            success: true,
            message: 'Data imported successfully',
            stats: {
                tasks: { imported: incomingTasks.length, errors: 0 },
                notes: { imported: incomingNotes.length, errors: 0 },
                subtasks: { imported: incomingSubtasks.length, errors: 0 }
            }
        };
        
        } catch (error) {
            console.error('Import error:', error);
            return {
                success: false,
                message: 'Import failed: ' + (error.message || 'Unknown error'),
                stats: {
                    tasks: { imported: 0, errors: 1 },
                    notes: { imported: 0, errors: 1 },
                    subtasks: { imported: 0, errors: 1 }
                }
            };
        }
    }

    // Change listeners
    addChangeListener(callback) {
        this.changeListeners.push(callback);
    }

    removeChangeListener(callback) {
        const index = this.changeListeners.indexOf(callback);
        if (index > -1) {
            this.changeListeners.splice(index, 1);
        }
    }

    notifyChangeListeners() {
        this.changeListeners.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('Error in change listener:', error);
            }
        });
    }

    // Getters
    getTasks(filters = {}) {
        console.log('getTasks called with filters:', filters);
        console.log('Total tasks in data service:', this.tasks?.length || 0);
        console.log('Tasks array:', this.tasks);
        
        // First filter out deleted tasks
        let filteredTasks = this.tasks.filter(task => !task.deleted);
        console.log('Non-deleted tasks:', filteredTasks.length);
        
        // Apply filters
        if (filters.priority) {
            filteredTasks = filteredTasks.filter(task => task.priority === filters.priority);
        }
        
        if (filters.status) {
            filteredTasks = filteredTasks.filter(task => task.status === filters.status);
        }
        
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            filteredTasks = filteredTasks.filter(task => 
                task.title.toLowerCase().includes(searchTerm) ||
                task.description.toLowerCase().includes(searchTerm)
            );
        }
        
        if (filters.includeTags && filters.includeTags.length > 0) {
            filteredTasks = filteredTasks.filter(task => 
                filters.includeTags.some(tag => task.tags && task.tags.includes(tag))
            );
        }
        
        if (filters.excludeTags && filters.excludeTags.length > 0) {
            filteredTasks = filteredTasks.filter(task => 
                !filters.excludeTags.some(tag => task.tags && task.tags.includes(tag))
            );
        }
        
        // Apply sorting
        const sortBy = filters.sortBy || 'created_at';
        if (sortBy === 'priority') {
            const priorityOrder = { urgent: 1, high: 2, medium: 3, low: 4 };
            filteredTasks.sort((a, b) => {
                const aPriority = priorityOrder[a.priority] || 3;
                const bPriority = priorityOrder[b.priority] || 3;
                if (aPriority !== bPriority) {
                    return aPriority - bPriority;
                }
                // Secondary sort by due date if available, otherwise created date
                const aDate = a.due_date ? new Date(a.due_date) : new Date(a.created_at);
                const bDate = b.due_date ? new Date(b.due_date) : new Date(b.created_at);
                return aDate - bDate;
            });
        } else if (sortBy === 'due_date') {
            filteredTasks.sort((a, b) => {
                // Tasks with due dates first, then by due date
                const aHasDue = !!a.due_date;
                const bHasDue = !!b.due_date;
                if (aHasDue !== bHasDue) {
                    return bHasDue - aHasDue; // Due dates first
                }
                if (aHasDue && bHasDue) {
                    return new Date(a.due_date) - new Date(b.due_date);
                }
                // If no due dates, sort by created date
                return new Date(b.created_at) - new Date(a.created_at);
            });
        } else if (sortBy === 'title') {
            filteredTasks.sort((a, b) => a.title.localeCompare(b.title));
        } else {
            // Default sort by created date
            filteredTasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
        
        return filteredTasks;
    }

    getTags() {
        const allTags = new Set();
        // Only get tags from non-deleted tasks
        this.tasks.filter(task => !task.deleted).forEach(task => {
            if (task.tags && Array.isArray(task.tags)) {
                task.tags.forEach(tag => allTags.add(tag));
            }
        });
        return Array.from(allTags);
    }

    getSubtasks(taskId) {
        const filtered = this.subtasks.filter(subtask => subtask.task_id === taskId && !subtask.deleted);
        console.log('getSubtasks for task', taskId, 'found', filtered.length, 'subtasks. All subtasks for this task:', this.subtasks.filter(s => s.task_id === taskId).map(s => ({ id: s.id, deleted: s.deleted, title: s.title })));
        return filtered;
    }

    getNotes() {
        return this.notes.filter(note => !note.deleted);
    }

    getTaskById(id) {
        return this.tasks.find(task => task.id == id && !task.deleted);
    }

    getNotesByTaskId(taskId) {
        return this.notes.filter(note => note.task_id == taskId && !note.deleted);
    }

    getSubtasksByTaskId(taskId) {
        return this.subtasks.filter(subtask => subtask.task_id == taskId && !subtask.deleted);
    }

    getSubtaskById(id) {
        const subtask = this.subtasks.find(subtask => subtask.id == id);
        return (subtask && !subtask.deleted) ? subtask : null;
    }

    hasPendingChanges() {
        // Check if we have local changes that haven't been synced to the cloud
        if (!this.lastSyncTime) return true; // No sync time means we have unsaved changes
        
        // Check if any items have been modified after the last sync
        const lastSync = new Date(this.lastSyncTime);
        
        const hasRecentTasks = this.tasks.some(task => {
            const updated = new Date(task.updated_at || task.created_at);
            return updated > lastSync;
        });
        
        const hasRecentNotes = this.notes.some(note => {
            const updated = new Date(note.updated_at || note.created_at);
            return updated > lastSync;
        });
        
        const hasRecentSubtasks = this.subtasks.some(subtask => {
            const updated = new Date(subtask.updated_at || subtask.created_at);
            return updated > lastSync;
        });
        
        return hasRecentTasks || hasRecentNotes || hasRecentSubtasks;
    }

    async updateTaskStatus(taskId, newStatus, pendingReason = null) {
        const task = this.getTaskById(taskId);
        if (task) {
            return await this.updateTask(taskId, { 
                status: newStatus, 
                pending_on: pendingReason 
            });
        }
        return null;
    }

    async updateTaskPriority(taskId, priority) {
        return await this.updateTask(taskId, { priority });
    }

    // Additional helper method for debugging sync status
    getSyncStatus() {
        return {
            lastSyncTime: this.lastSyncTime,
            hasPendingChanges: this.hasPendingChanges(),
            isOnline: navigator.onLine,
            syncInProgress: this.syncInProgress,
            totalTasks: this.tasks.filter(t => !t.deleted).length,
            totalNotes: this.notes.filter(n => !n.deleted).length,
            totalSubtasks: this.subtasks.filter(s => !s.deleted).length,
            deletedItems: {
                tasks: this.tasks.filter(t => t.deleted).length,
                notes: this.notes.filter(n => n.deleted).length,
                subtasks: this.subtasks.filter(s => s.deleted).length
            }
        };
    }

    // Validate data integrity after sync operations
    async validateDataIntegrity() {
        const issues = [];
        
        // Check for duplicate IDs
        const taskIds = this.tasks.map(t => t.id);
        const duplicateTaskIds = taskIds.filter((id, index) => taskIds.indexOf(id) !== index);
        if (duplicateTaskIds.length > 0) {
            issues.push(`Duplicate task IDs found: ${duplicateTaskIds.join(', ')}`);
        }
        
        const noteIds = this.notes.map(n => n.id);
        const duplicateNoteIds = noteIds.filter((id, index) => noteIds.indexOf(id) !== index);
        if (duplicateNoteIds.length > 0) {
            issues.push(`Duplicate note IDs found: ${duplicateNoteIds.join(', ')}`);
        }
        
        const subtaskIds = this.subtasks.map(s => s.id);
        const duplicateSubtaskIds = subtaskIds.filter((id, index) => subtaskIds.indexOf(id) !== index);
        if (duplicateSubtaskIds.length > 0) {
            issues.push(`Duplicate subtask IDs found: ${duplicateSubtaskIds.join(', ')}`);
        }
        
        // Check for orphaned notes and subtasks
        const taskIdSet = new Set(this.tasks.map(t => t.id));
        const orphanedNotes = this.notes.filter(n => n.task_id && !taskIdSet.has(n.task_id));
        const orphanedSubtasks = this.subtasks.filter(s => s.task_id && !taskIdSet.has(s.task_id));
        
        if (orphanedNotes.length > 0) {
            issues.push(`${orphanedNotes.length} orphaned notes found`);
        }
        
        if (orphanedSubtasks.length > 0) {
            issues.push(`${orphanedSubtasks.length} orphaned subtasks found`);
        }
        
        // Auto-fix orphaned data
        if (orphanedNotes.length > 0 || orphanedSubtasks.length > 0) {
            this.notes = this.notes.filter(n => !n.task_id || taskIdSet.has(n.task_id));
            this.subtasks = this.subtasks.filter(s => !s.task_id || taskIdSet.has(s.task_id));
            await this.saveToStorage();
            // Auto-fixed orphaned data
        }
        
        return {
            isValid: issues.length === 0,
            issues: issues,
            stats: {
                tasks: this.tasks.filter(t => !t.deleted).length,
                notes: this.notes.filter(n => !n.deleted).length,
                subtasks: this.subtasks.filter(s => !s.deleted).length,
                deletedTasks: this.tasks.filter(t => t.deleted).length,
                deletedNotes: this.notes.filter(n => n.deleted).length,
                deletedSubtasks: this.subtasks.filter(s => s.deleted).length
            }
        };
    }

    // Cleanup old deleted items (tombstones) older than 30 days
    setupNetworkMonitoring() {
        // Monitor network connectivity for automatic sync when back online
        if (typeof window !== 'undefined') {
            // Web/Capacitor network monitoring
            const handleOnline = async () => {
                console.log('Network connection restored - attempting automatic sync...');
                if (window.RobustiCloudSync) {
                    try {
                        await this.manualSync();
                        console.log('Automatic sync completed successfully');
                    } catch (error) {
                        console.log('Automatic sync failed:', error.message);
                    }
                }
            };

            const handleOffline = () => {
                console.log('Network connection lost - app is now offline');
            };

            // Listen for online/offline events
            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);

            // For Capacitor apps, also listen to app state changes
            if (this.isCapacitor && window.Capacitor?.Plugins?.App) {
                window.Capacitor.Plugins.App.addListener('appStateChange', async (state) => {
                    if (state.isActive && navigator.onLine) {
                        console.log('App became active and online - attempting sync...');
                        setTimeout(handleOnline, 1000); // Small delay to ensure network is stable
                    }
                });
            }

            // Initial network status check
            if (navigator.onLine) {
                console.log('App started with network connection available');
            } else {
                console.log('App started offline - local data will be used');
            }
        }
    }

    async cleanupDeletedItems() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const cutoffTime = thirtyDaysAgo.getTime();

        let cleaned = false;

        // Clean up old deleted tasks
        const originalTaskCount = this.tasks.length;
        this.tasks = this.tasks.filter(task => {
            if (task.deleted && task.deleted_at) {
                const deletedTime = new Date(task.deleted_at).getTime();
                return deletedTime > cutoffTime; // Keep if deleted less than 30 days ago
            }
            return true; // Keep all non-deleted tasks
        });
        
        // Clean up old deleted notes
        const originalNoteCount = this.notes.length;
        this.notes = this.notes.filter(note => {
            if (note.deleted && note.deleted_at) {
                const deletedTime = new Date(note.deleted_at).getTime();
                return deletedTime > cutoffTime;
            }
            return true;
        });

        // Clean up old deleted subtasks
        const originalSubtaskCount = this.subtasks.length;
        this.subtasks = this.subtasks.filter(subtask => {
            if (subtask.deleted && subtask.deleted_at) {
                const deletedTime = new Date(subtask.deleted_at).getTime();
                return deletedTime > cutoffTime;
            }
            return true;
        });

        cleaned = (this.tasks.length < originalTaskCount) || 
                 (this.notes.length < originalNoteCount) || 
                 (this.subtasks.length < originalSubtaskCount);

        if (cleaned) {
            await this.saveToStorage();
        }

        return cleaned;
    }
}

// Initialize the robust data service
window.RobustDataService = new RobustDataService();
// Robust Data Service initialized
