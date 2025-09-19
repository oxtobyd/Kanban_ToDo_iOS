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
        // Initializing Robust Data Service
        
        // Generate or retrieve device ID for conflict-free ID generation
        await this.initializeDeviceId();
        
        if (this.isCapacitor) {
            // Initialize robust iCloud sync
            if (window.RobustiCloudSync) {
                await window.RobustiCloudSync.init();
                
                // Setup change listener for external updates
                window.RobustiCloudSync.addChangeListener(async (cloudData) => {
                    // External iCloud change detected, importing
                    await this.importData({ data: cloudData }, { clearExisting: true });
                    this.lastSyncTime = cloudData.lastSync;
                    this.notifyChangeListeners();
                });

                // Load initial data from iCloud
                const cloudData = await window.RobustiCloudSync.loadFromiCloud();
                if (cloudData && cloudData.hasOwnProperty('tasks')) {
                    await this.importData({ data: cloudData }, { clearExisting: true });
                    this.lastSyncTime = cloudData.lastSync;
                }
            } else {
                console.error('Robust iCloud sync not available');
            }
        } else {
            await this.loadFromLocalStorage();
        }

        // Run cleanup on startup and then every 24 hours
        await this.cleanupDeletedItems();
        setInterval(() => this.cleanupDeletedItems(), 24 * 60 * 60 * 1000); // 24 hours

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
        const devicePrefix = this.deviceId ? this.deviceId.slice(-4) : 'unkn';
        const counter = type === 'task' ? this.nextTaskId++ : 
                      type === 'note' ? this.nextNoteId++ : 
                      this.nextSubtaskId++;
        
        // Format: timestamp + device + counter (ensures uniqueness across devices)
        return parseInt(`${timestamp}${devicePrefix.replace(/\D/g, '').padStart(4, '0')}${counter.toString().padStart(3, '0')}`);
    }

    async saveToStorage() {
        if (this.syncInProgress) {
            this.pendingChanges = true;
            return;
        }

        this.syncInProgress = true;

        try {
            if (this.isCapacitor && window.RobustiCloudSync) {
                // Use robust iCloud sync
                const exportData = await this.exportData();
                const success = await window.RobustiCloudSync.saveToiCloud(exportData.data);
                
                if (success) {
                    this.lastSyncTime = exportData.exported_at;
                } else {
                    console.error('Failed to save to iCloud');
                }
            } else {
                // Fallback to localStorage
                await this.saveToLocalStorage();
            }
        } catch (error) {
            console.error('Error saving data:', error);
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
        
        try {
            // Check for updates from iCloud
            const currentData = {
                tasks: this.tasks,
                notes: this.notes,
                subtasks: this.subtasks,
                lastSync: this.lastSyncTime
            };

            const syncResult = await window.RobustiCloudSync.checkForUpdates(currentData);
            
            if (syncResult.hasUpdates) {
                await this.importData({ data: syncResult.data }, { clearExisting: true });
                this.lastSyncTime = syncResult.cloudSync;
                this.notifyChangeListeners();
            }
        } catch (error) {
            console.error('Error during manual sync:', error);
        }
    }

    async loadFromLocalStorage() {
        try {
            this.tasks = JSON.parse(localStorage.getItem('kanban_tasks') || '[]');
            this.notes = JSON.parse(localStorage.getItem('kanban_notes') || '[]');
            this.subtasks = JSON.parse(localStorage.getItem('kanban_subtasks') || '[]');
            this.nextTaskId = parseInt(localStorage.getItem('kanban_next_task_id') || '1');
            this.nextNoteId = parseInt(localStorage.getItem('kanban_next_note_id') || '1');
            this.nextSubtaskId = parseInt(localStorage.getItem('kanban_next_subtask_id') || '1');
        } catch (error) {
            console.error('Error loading from localStorage:', error);
        }
    }

    async saveToLocalStorage() {
        try {
            localStorage.setItem('kanban_tasks', JSON.stringify(this.tasks));
            localStorage.setItem('kanban_notes', JSON.stringify(this.notes));
            localStorage.setItem('kanban_subtasks', JSON.stringify(this.subtasks));
            localStorage.setItem('kanban_next_task_id', this.nextTaskId.toString());
            localStorage.setItem('kanban_next_note_id', this.nextNoteId.toString());
            localStorage.setItem('kanban_next_subtask_id', this.nextSubtaskId.toString());
        } catch (error) {
            console.error('Error saving to localStorage:', error);
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
        // Convert id to number for comparison
        const numericId = parseInt(id, 10);
        const taskIndex = this.tasks.findIndex(task => task.id === numericId);
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
        // Convert id to number for comparison
        const numericId = parseInt(id, 10);
        const taskIndex = this.tasks.findIndex(task => task.id === numericId);
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
                if (note.task_id === numericId) {
                    this.notes[index] = {
                        ...note,
                        deleted: true,
                        deleted_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };
                }
            });
            
            this.subtasks.forEach((subtask, index) => {
                if (subtask.task_id === numericId) {
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
            // Ensure task_id is numeric
            task_id: note.task_id != null ? parseInt(note.task_id, 10) : note.task_id,
            id: this.generateUniqueId('note'),
            created_at: new Date().toISOString()
        };
        
        this.notes.push(newNote);
        await this.saveToStorage();
        this.notifyChangeListeners();
        return newNote;
    }

    async updateNote(id, updates) {
        const numericId = parseInt(id, 10);
        const noteIndex = this.notes.findIndex(note => note.id === numericId);
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
        const numericId = parseInt(id, 10);
        const noteIndex = this.notes.findIndex(note => note.id === numericId);
        if (noteIndex !== -1) {
            // Mark as deleted with timestamp instead of removing immediately
            this.notes[noteIndex] = {
                ...this.notes[noteIndex],
                deleted: true,
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            // Note marked as deleted
            
            await this.saveToStorage();
            this.notifyChangeListeners();
            return true;
        }
        return false;
    }

    // Subtask management methods
    async addSubtask(subtask) {
        const newSubtask = {
            ...subtask,
            // Ensure task_id is numeric
            task_id: subtask.task_id != null ? parseInt(subtask.task_id, 10) : subtask.task_id,
            id: this.generateUniqueId('subtask'),
            created_at: new Date().toISOString()
        };
        
        this.subtasks.push(newSubtask);
        await this.saveToStorage();
        this.notifyChangeListeners();
        return newSubtask;
    }

    async updateSubtask(id, updates) {
        const numericId = parseInt(id, 10);
        const subtaskIndex = this.subtasks.findIndex(subtask => subtask.id === numericId);
        if (subtaskIndex !== -1) {
            const updated = {
                ...this.subtasks[subtaskIndex],
                ...updates,
                updated_at: new Date().toISOString()
            };
            this.subtasks[subtaskIndex] = updated;
            // Subtask updated
            await this.saveToStorage();
            this.notifyChangeListeners();
            return updated;
        }
        console.warn('Subtask not found for update:', { id: numericId });
        return null;
    }

    async deleteSubtask(id) {
        const numericId = parseInt(id, 10);
        const subtaskIndex = this.subtasks.findIndex(subtask => subtask.id === numericId);
        if (subtaskIndex !== -1) {
            // Mark as deleted with timestamp instead of removing immediately
            this.subtasks[subtaskIndex] = {
                ...this.subtasks[subtaskIndex],
                deleted: true,
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            // Subtask marked as deleted
            
            await this.saveToStorage();
            this.notifyChangeListeners();
            return true;
        }
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
        const mergeItems = (localItems, incomingItems) => {
            const itemMap = new Map();
            
            // Add all local items first
            localItems.forEach(item => itemMap.set(item.id, item));
            
            // Process incoming items
            incomingItems.forEach(incomingItem => {
                const existingItem = itemMap.get(incomingItem.id);
                
                if (!existingItem) {
                    // New item from remote
                    itemMap.set(incomingItem.id, incomingItem);
                } else if (isIncomingNewer(existingItem, incomingItem)) {
                    // Incoming item is newer, use it
                    itemMap.set(incomingItem.id, incomingItem);
                }
                // If existing is newer or equal, keep existing (no action needed)
            });
            
            return Array.from(itemMap.values());
        };

        const incomingTasks = (data.tasks || []).map(t => ({ ...t }));
        const incomingNotes = (data.notes || []).map(n => ({ ...n }));
        const incomingSubtasks = (data.subtasks || []).map(s => ({ ...s }));

        // Use the new merge function that properly handles deletions
        this.tasks = mergeItems(this.tasks, incomingTasks);
        this.notes = mergeItems(this.notes, incomingNotes);
        this.subtasks = mergeItems(this.subtasks, incomingSubtasks);

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

        // Import completed

        await this.saveToStorage();
        this.notifyChangeListeners();
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
        // First filter out deleted tasks
        let filteredTasks = this.tasks.filter(task => !task.deleted);
        
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
        return this.subtasks.filter(subtask => subtask.task_id === taskId && !subtask.deleted);
    }

    getNotes() {
        return this.notes.filter(note => !note.deleted);
    }

    getTaskById(id) {
        // Convert id to number for comparison since task IDs are stored as numbers
        const numericId = parseInt(id, 10);
        return this.tasks.find(task => task.id === numericId && !task.deleted);
    }

    getNotesByTaskId(taskId) {
        const numericId = parseInt(taskId, 10);
        return this.notes.filter(note => note.task_id === numericId && !note.deleted);
    }

    getSubtasksByTaskId(taskId) {
        const numericId = parseInt(taskId, 10);
        return this.subtasks.filter(subtask => subtask.task_id === numericId && !subtask.deleted);
    }

    getSubtaskById(id) {
        const numericId = parseInt(id, 10);
        const subtask = this.subtasks.find(subtask => subtask.id === numericId);
        return (subtask && !subtask.deleted) ? subtask : null;
    }

    async updateTaskStatus(taskId, newStatus, pendingReason = null) {
        const task = this.getTaskById(taskId);
        
        if (!task) {
            console.error('Task not found. Available tasks:', this.tasks.map(t => ({ id: t.id, title: t.title })));
            throw new Error(`Task not found with ID: ${taskId}`);
        }

        const updates = {
            status: newStatus,
            updated_at: new Date().toISOString()
        };

        if (newStatus === 'pending' && pendingReason) {
            updates.pending_reason = pendingReason;
        } else if (newStatus !== 'pending') {
            updates.pending_reason = null;
        }

        const result = await this.updateTask(taskId, updates);
        return result;
    }

    // Sync status
    getSyncStatus() {
        return {
            isCapacitor: this.isCapacitor,
            syncInProgress: this.syncInProgress,
            lastSyncTime: this.lastSyncTime,
            pendingChanges: this.pendingChanges,
            hasRobustSync: !!window.RobustiCloudSync
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
