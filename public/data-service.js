// Data service for iCloud storage using Capacitor Preferences
class DataService {
    constructor() {
        this.isCapacitor = window.Capacitor && window.Capacitor.isNativePlatform();
        this.tasks = [];
        this.notes = [];
        this.subtasks = [];
        this.nextTaskId = 1;
        this.nextNoteId = 1;
        this.nextSubtaskId = 1;
        this.autoSyncInterval = null;
    }

    async init() {
        if (this.isCapacitor) {
            // First try to load from proper iCloud sync (NSUbiquitousKeyValueStore via proper plugin)
            if (window.iCloudSyncProper) {
                console.log('Checking for proper iCloud data...');
                try {
                    // register auto-sync listeners to pull latest on resume/changes
                    window.iCloudSyncProper.setupAutoSync(async (cloudData) => {
                        if (cloudData && cloudData.hasOwnProperty('tasks')) {
                            console.log('Auto-sync: Found iCloud data, checking if newer...');
                            
                            // Check if this data is newer than what we currently have
                            const currentLastSync = this.getLastSyncTime();
                            const cloudLastSync = new Date(cloudData.lastSync);
                            
                            console.log('Auto-sync timestamp comparison:', {
                                current: currentLastSync,
                                cloud: cloudData.lastSync,
                                isNewer: cloudLastSync > currentLastSync
                            });
                            
                            if (cloudLastSync > currentLastSync) {
                                console.log('Auto-sync: Data is newer, importing...');
                                await this.importData({ data: cloudData }, { clearExisting: true });
                                this.setLastSyncTime(cloudData.lastSync || new Date().toISOString());
                                if (window.app && window.app.loadTasks) {
                                    console.log('Auto-sync: Triggering UI refresh...');
                                    window.app.loadTasks();
                                }
                            } else {
                                console.log('Auto-sync: Data is not newer, skipping import');
                            }
                        }
                    });

                    // polling fallback every 30s in case platform events are delayed/missed
                    if (!this.autoSyncInterval) {
                        this.autoSyncInterval = setInterval(async () => {
                            try {
                                const cloudData = await window.iCloudSyncProper.loadFromiCloud();
                                if (cloudData && cloudData.lastSync) {
                                    const currentLastSync = this.getLastSyncTime();
                                    const cloudLastSync = new Date(cloudData.lastSync);
                                    if (cloudLastSync > currentLastSync) {
                                        console.log('Polling auto-sync: importing newer iCloud data...');
                                        await this.importData({ data: cloudData }, { clearExisting: true });
                                        this.setLastSyncTime(cloudData.lastSync);
                                        if (window.app && window.app.loadTasks) window.app.loadTasks();
                                    }
                                }
                            } catch (_) {/* ignore */}
                        }, 30000);
                    }

                    const cloudData = await window.iCloudSyncProper.loadFromiCloud();
                    console.log('Proper iCloud load result:', cloudData ? 'Found data' : 'No data');
                    if (cloudData && cloudData.hasOwnProperty('tasks')) {
                        console.log('Found proper iCloud data, importing...');
                        await this.importData({ data: cloudData }, { clearExisting: true });
                        // Trigger UI refresh after initial import
                        if (window.app && window.app.loadTasks) {
                            console.log('Triggering UI refresh after initial import...');
                            window.app.loadTasks();
                        }
                    } else {
                        // Fallback to Preferences if no proper iCloud data
                        console.log('No proper iCloud data, loading from Preferences...');
                        await this.loadFromiCloud();
                        // Trigger UI refresh after Preferences load
                        if (window.app && window.app.loadTasks) {
                            console.log('Triggering UI refresh after Preferences load...');
                            window.app.loadTasks();
                        }
                    }
                } catch (error) {
                    console.log('Proper iCloud failed, falling back to Preferences:', error.message);
                    await this.loadFromiCloud();
                }
            } else {
                console.log('Proper iCloud sync service not available, loading from Preferences...');
                await this.loadFromiCloud();
            }
        } else {
            await this.loadFromLocalStorage();
        }
    }

    async manualSync() {
        if (this.isCapacitor) {
            console.log('Manual sync requested...');
            
            // Check proper iCloud for updates
            if (window.iCloudSyncProper) {
                console.log('Checking proper iCloud for updates...');
                try {
                    const cloudData = await window.iCloudSyncProper.loadFromiCloud();
                    if (cloudData && cloudData.hasOwnProperty('tasks')) {
                        console.log('Found proper iCloud data, checking if newer...');
                        const currentData = { 
                            tasks: this.tasks, 
                            notes: this.notes, 
                            subtasks: this.subtasks,
                            lastSync: null 
                        };
                        
                        const syncResult = await window.iCloudSyncProper.checkForUpdates(currentData);
                        console.log('Sync check result:', syncResult);
                        
                        if (syncResult.hasUpdates) {
                            console.log('Updates found, importing from proper iCloud...');
                            await this.importData({ data: syncResult.data }, { clearExisting: true });
                        } else {
                            console.log('No updates found in proper iCloud');
                        }
                    } else {
                        console.log('No proper iCloud data found');
                    }
                } catch (error) {
                    console.error('Error during proper iCloud sync:', error);
                }
            } else {
                console.log('Proper iCloud sync service not available for manual sync');
            }
            
            // Trigger UI refresh
            if (window.app && window.app.loadTasks) {
                window.app.loadTasks();
            }
            console.log('Manual sync completed');
        }
    }

    async loadFromiCloud() {
        try {
            const { Preferences } = window.Capacitor.Plugins;
            
            console.log('Loading from iCloud...');
            
            // Use group-prefixed keys for better iCloud sync
            const tasksResult = await Preferences.get({ key: 'group.com.fynesystems.kanbantodo.tasks' });
            this.tasks = tasksResult.value ? JSON.parse(tasksResult.value) : [];
            
            const notesResult = await Preferences.get({ key: 'group.com.fynesystems.kanbantodo.notes' });
            this.notes = notesResult.value ? JSON.parse(notesResult.value) : [];
            
            const subtasksResult = await Preferences.get({ key: 'group.com.fynesystems.kanbantodo.subtasks' });
            this.subtasks = subtasksResult.value ? JSON.parse(subtasksResult.value) : [];
            
            const taskIdResult = await Preferences.get({ key: 'group.com.fynesystems.kanbantodo.next_task_id' });
            this.nextTaskId = taskIdResult.value ? parseInt(taskIdResult.value) : 1;
            
            const noteIdResult = await Preferences.get({ key: 'group.com.fynesystems.kanbantodo.next_note_id' });
            this.nextNoteId = noteIdResult.value ? parseInt(noteIdResult.value) : 1;
            
            const subtaskIdResult = await Preferences.get({ key: 'group.com.fynesystems.kanbantodo.next_subtask_id' });
            this.nextSubtaskId = subtaskIdResult.value ? parseInt(subtaskIdResult.value) : 1;
            
            // Check last sync time
            const lastSyncResult = await Preferences.get({ key: 'group.com.fynesystems.kanbantodo.last_sync' });
            const lastSync = lastSyncResult.value ? new Date(lastSyncResult.value) : null;
            
            console.log('Loaded from iCloud:', {
                tasks: this.tasks.length,
                notes: this.notes.length,
                subtasks: this.subtasks.length,
                lastSync: lastSync ? lastSync.toLocaleString() : 'Never'
            });
            
        } catch (error) {
            console.error('Error loading from iCloud:', error);
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

    async saveToStorage() {
        if (this.isCapacitor) {
            await this.saveToiCloud();
            // Also save to proper iCloud for cross-device sync (NSUbiquitousKeyValueStore via proper plugin)
            if (window.iCloudSyncProper) {
                console.log('Saving to proper iCloud...');
                const exportData = await this.exportData();

                // Check iCloud availability first
                const iCloudStatus = await window.iCloudSyncProper.checkiCloudAvailability();
                console.log('Proper iCloud availability check:', iCloudStatus);

                const success = await window.iCloudSyncProper.saveToiCloud(exportData.data);
                console.log('Proper iCloud save result:', success);
            } else {
                console.log('Proper iCloud sync service not available');
            }
        } else {
            await this.saveToLocalStorage();
        }
    }

    async saveToiCloud() {
        try {
            const { Preferences } = window.Capacitor.Plugins;
            
            console.log('Saving to iCloud:', {
                tasks: this.tasks.length,
                notes: this.notes.length,
                subtasks: this.subtasks.length
            });
            
            // Use group-prefixed keys for better iCloud sync
            await Preferences.set({
                key: 'group.com.fynesystems.kanbantodo.tasks',
                value: JSON.stringify(this.tasks)
            });
            
            await Preferences.set({
                key: 'group.com.fynesystems.kanbantodo.notes',
                value: JSON.stringify(this.notes)
            });
            
            await Preferences.set({
                key: 'group.com.fynesystems.kanbantodo.subtasks',
                value: JSON.stringify(this.subtasks)
            });
            
            await Preferences.set({
                key: 'group.com.fynesystems.kanbantodo.next_task_id',
                value: this.nextTaskId.toString()
            });
            
            await Preferences.set({
                key: 'group.com.fynesystems.kanbantodo.next_note_id',
                value: this.nextNoteId.toString()
            });
            
            await Preferences.set({
                key: 'group.com.fynesystems.kanbantodo.next_subtask_id',
                value: this.nextSubtaskId.toString()
            });
            
            // Add a timestamp for sync tracking
            await Preferences.set({
                key: 'group.com.fynesystems.kanbantodo.last_sync',
                value: new Date().toISOString()
            });
            
            console.log('Successfully saved to iCloud');
            
        } catch (error) {
            console.error('Error saving to iCloud:', error);
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

    // Task methods
    async getTasks(filters = {}) {
        let filteredTasks = [...this.tasks];
        
        // Apply filters
        if (filters.priority) {
            filteredTasks = filteredTasks.filter(task => task.priority === filters.priority);
        }
        
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filteredTasks = filteredTasks.filter(task => 
                task.title.toLowerCase().includes(searchLower) ||
                (task.description && task.description.toLowerCase().includes(searchLower))
            );
        }
        
        const includeTags = Array.isArray(filters.includeTags) ? filters.includeTags.filter(Boolean) : [];
        const excludeTags = Array.isArray(filters.excludeTags) ? filters.excludeTags.filter(Boolean) : [];
        
        if (includeTags.length > 0) {
            filteredTasks = filteredTasks.filter(task => {
                const taskTags = task.tags || [];
                return includeTags.some(t => taskTags.includes(t));
            });
        }
        
        if (excludeTags.length > 0) {
            filteredTasks = filteredTasks.filter(task => {
                const taskTags = task.tags || [];
                return excludeTags.every(t => !taskTags.includes(t));
            });
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
                return new Date(b.created_at) - new Date(a.created_at);
            });
        } else if (sortBy === 'title') {
            filteredTasks.sort((a, b) => a.title.localeCompare(b.title));
        } else {
            filteredTasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
        
        return filteredTasks;
    }

    async createTask(taskData) {
        const task = {
            id: this.nextTaskId++,
            title: taskData.title,
            description: taskData.description || '',
            priority: taskData.priority || 'medium',
            status: taskData.status || 'todo',
            tags: taskData.tags || [],
            pending_on: taskData.pending_on || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        this.tasks.push(task);
        await this.saveToStorage();
        return task;
    }

    async updateTask(id, taskData) {
        const taskIndex = this.tasks.findIndex(task => task.id === parseInt(id));
        if (taskIndex === -1) {
            throw new Error('Task not found');
        }
        
        this.tasks[taskIndex] = {
            ...this.tasks[taskIndex],
            ...taskData,
            updated_at: new Date().toISOString()
        };
        
        await this.saveToStorage();
        return this.tasks[taskIndex];
    }

    async updateTaskStatus(id, status, pendingReason = null) {
        return await this.updateTask(id, { 
            status, 
            pending_on: pendingReason 
        });
    }

    async updateTaskPriority(id, priority) {
        return await this.updateTask(id, { priority });
    }

    async deleteTask(id) {
        const taskIndex = this.tasks.findIndex(task => task.id === parseInt(id));
        if (taskIndex === -1) {
            throw new Error('Task not found');
        }
        
        // Delete attachment files referenced by task, its notes, and its subtasks
        try {
            const task = this.tasks[taskIndex];
            await this._deleteAttachmentsInText(task.description || '');
            const relatedNotes = this.notes.filter(note => note.task_id === parseInt(id));
            for (const note of relatedNotes) {
                await this._deleteAttachmentsInText(note.content || '');
            }
            const relatedSubtasks = this.subtasks.filter(subtask => subtask.task_id === parseInt(id));
            for (const st of relatedSubtasks) {
                await this._deleteAttachmentsInText(st.title || '');
            }
        } catch (_) {}

        // Also delete related notes and subtasks (data rows)
        this.notes = this.notes.filter(note => note.task_id !== parseInt(id));
        this.subtasks = this.subtasks.filter(subtask => subtask.task_id !== parseInt(id));
        
        this.tasks.splice(taskIndex, 1);
        await this.saveToStorage();
    }

    // Notes methods
    async getNotes(taskId) {
        return this.notes
            .filter(note => note.task_id === parseInt(taskId))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    async createNote(taskId, content) {
        const note = {
            id: this.nextNoteId++,
            task_id: parseInt(taskId),
            content,
            created_at: new Date().toISOString()
        };
        
        this.notes.push(note);
        await this.saveToStorage();
        return note;
    }

    async updateNote(id, content) {
        const noteIndex = this.notes.findIndex(note => note.id === parseInt(id));
        if (noteIndex === -1) {
            throw new Error('Note not found');
        }
        
        this.notes[noteIndex].content = content;
        await this.saveToStorage();
        return this.notes[noteIndex];
    }

    async deleteNote(id) {
        const noteIndex = this.notes.findIndex(note => note.id === parseInt(id));
        if (noteIndex === -1) {
            throw new Error('Note not found');
        }
        
        this.notes.splice(noteIndex, 1);
        await this.saveToStorage();
    }

    // Subtasks methods
    async getSubtasks(taskId) {
        return this.subtasks
            .filter(subtask => subtask.task_id === parseInt(taskId))
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    async createSubtask(taskId, title) {
        const subtask = {
            id: this.nextSubtaskId++,
            task_id: parseInt(taskId),
            title,
            completed: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        this.subtasks.push(subtask);
        await this.saveToStorage();
        return subtask;
    }

    async updateSubtask(id, data) {
        const subtaskIndex = this.subtasks.findIndex(subtask => subtask.id === parseInt(id));
        if (subtaskIndex === -1) {
            throw new Error('Subtask not found');
        }
        
        this.subtasks[subtaskIndex] = {
            ...this.subtasks[subtaskIndex],
            ...data,
            updated_at: new Date().toISOString()
        };
        
        await this.saveToStorage();
        return this.subtasks[subtaskIndex];
    }

    async toggleSubtask(id) {
        const subtaskIndex = this.subtasks.findIndex(subtask => subtask.id === parseInt(id));
        if (subtaskIndex === -1) {
            throw new Error('Subtask not found');
        }
        
        this.subtasks[subtaskIndex].completed = !this.subtasks[subtaskIndex].completed;
        this.subtasks[subtaskIndex].updated_at = new Date().toISOString();
        
        await this.saveToStorage();
        return this.subtasks[subtaskIndex];
    }

    async deleteSubtask(id) {
        const subtaskIndex = this.subtasks.findIndex(subtask => subtask.id === parseInt(id));
        if (subtaskIndex === -1) {
            throw new Error('Subtask not found');
        }
        // Delete attachment files referenced in the subtask title
        try {
            const subtask = this.subtasks[subtaskIndex];
            await this._deleteAttachmentsInText(subtask.title || '');
        } catch (_) {}
        this.subtasks.splice(subtaskIndex, 1);
        await this.saveToStorage();
    }

    // INTERNAL: delete files referenced by markdown-style links like
    // [File: name](file:///.../Documents/filename)
    async _deleteAttachmentsInText(text) {
        try {
            if (!text || !window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.Filesystem) return;
            const { Filesystem } = window.Capacitor.Plugins;
            const regex = /\[File: [^\]]+\]\((file:[^)]+)\)/g;
            let match;
            const uris = [];
            while ((match = regex.exec(String(text))) !== null) {
                if (match[1]) uris.push(match[1]);
            }
            for (const uri of uris) {
                try {
                    const decoded = decodeURIComponent(uri);
                    if (!/\/Documents\//.test(decoded)) continue;
                    const fileName = decoded.split('/').pop();
                    if (!fileName) continue;
                    await Filesystem.deleteFile({ path: fileName, directory: 'DOCUMENTS' });
                } catch (_) {}
            }
        } catch (_) {}
    }

    // Tags methods
    async getTags() {
        const tagSet = new Set();
        this.tasks.forEach(task => {
            if (task.tags) {
                task.tags.forEach(tag => tagSet.add(tag));
            }
        });
        return Array.from(tagSet).sort();
    }

    // Export/Import methods
    async exportData() {
        // Create export data compatible with both PostgreSQL and iOS formats
        const exportData = {
            exportDate: new Date().toISOString(),
            version: "1.0",
            database: {
                tasks: this.tasks,
                notes: this.notes,
                subTasks: this.subtasks,
                tags: await this.getTags()
            },
            metadata: {
                totalTasks: this.tasks.length,
                totalNotes: this.notes.length,
                totalSubTasks: this.subtasks.length,
                totalTags: (await this.getTags()).length
            },
            // Also include iOS format for backward compatibility
            data: {
                tasks: this.tasks,
                notes: this.notes,
                subtasks: this.subtasks
            },
            exported_at: new Date().toISOString(),
            app_name: "Kanban Todo Board"
        };
        return exportData;
    }

    getLastSyncTime() {
        // Get the last sync time from the current data
        // This is used to compare with iCloud data to see if it's newer
        try {
            // Try to get from the last saved data timestamp
            const lastSync = localStorage.getItem('lastSync');
            if (lastSync) {
                return new Date(lastSync);
            }
            
            // Fallback to current time if no last sync found
            return new Date(0);
        } catch (error) {
            console.warn('Error getting last sync time:', error);
            return new Date(0);
        }
    }

    setLastSyncTime(isoString) {
        try {
            localStorage.setItem('lastSync', isoString);
        } catch (error) {
            console.warn('Error setting last sync time:', error);
        }
    }

    async importData(importData, options = {}) {
        try {
            // Support both formats: PostgreSQL and iOS
            let data;
            
            if (importData.database) {
                // PostgreSQL format
                data = {
                    tasks: importData.database.tasks || [],
                    notes: importData.database.notes || [],
                    subtasks: importData.database.subTasks || [] // Note: subTasks vs subtasks
                };
            } else if (importData.data) {
                // iOS format
                data = importData.data;
            } else {
                throw new Error('Invalid import data format. Expected "data" or "database" property.');
            }
            
            if (!data.tasks || !Array.isArray(data.tasks)) {
                throw new Error('Invalid import data format. Expected tasks array.');
            }
            let importStats = {
                tasks: { imported: 0, skipped: 0, errors: 0 },
                notes: { imported: 0, skipped: 0, errors: 0 },
                subtasks: { imported: 0, skipped: 0, errors: 0 }
            };

            // Clear existing data if requested
            if (options.clearExisting) {
                this.tasks = [];
                this.notes = [];
                this.subtasks = [];
                this.nextTaskId = 1;
                this.nextNoteId = 1;
                this.nextSubtaskId = 1;
            }

            // Create ID mapping for tasks (old ID -> new ID)
            const taskIdMapping = {};

            // Import tasks
            for (const task of data.tasks) {
                try {
                    const newTask = {
                        id: this.nextTaskId++,
                        title: task.title,
                        description: task.description || '',
                        priority: task.priority || 'medium',
                        status: task.status || 'todo',
                        tags: task.tags || [],
                        pending_on: task.pending_on || null,
                        created_at: task.created_at || new Date().toISOString(),
                        updated_at: task.updated_at || new Date().toISOString()
                    };

                    taskIdMapping[task.id] = newTask.id;
                    this.tasks.push(newTask);
                    importStats.tasks.imported++;
                } catch (error) {
                    console.error('Error importing task:', error);
                    importStats.tasks.errors++;
                }
            }

            // Import notes
            if (data.notes) {
                for (const note of data.notes) {
                    try {
                        const newTaskId = taskIdMapping[note.task_id];
                        if (newTaskId) {
                            const newNote = {
                                id: this.nextNoteId++,
                                task_id: newTaskId,
                                content: note.content,
                                created_at: note.created_at || new Date().toISOString()
                            };
                            this.notes.push(newNote);
                            importStats.notes.imported++;
                        } else {
                            importStats.notes.skipped++;
                        }
                    } catch (error) {
                        console.error('Error importing note:', error);
                        importStats.notes.errors++;
                    }
                }
            }

            // Import subtasks (handle both subtasks and subTasks naming)
            const subtasksData = data.subtasks || data.subTasks || [];
            if (Array.isArray(subtasksData)) {
                for (const subtask of subtasksData) {
                    try {
                        const newTaskId = taskIdMapping[subtask.task_id];
                        if (newTaskId) {
                            const newSubtask = {
                                id: this.nextSubtaskId++,
                                task_id: newTaskId,
                                title: subtask.title,
                                completed: subtask.completed || false,
                                created_at: subtask.created_at || new Date().toISOString(),
                                updated_at: subtask.updated_at || new Date().toISOString()
                            };
                            this.subtasks.push(newSubtask);
                            importStats.subtasks.imported++;
                        } else {
                            importStats.subtasks.skipped++;
                        }
                    } catch (error) {
                        console.error('Error importing subtask:', error);
                        importStats.subtasks.errors++;
                    }
                }
            }

            // Save to storage
            await this.saveToStorage();

            // Track last sync time for auto-sync comparisons
            if (data && data.lastSync) {
                this.setLastSyncTime(data.lastSync);
            } else {
                this.setLastSyncTime(new Date().toISOString());
            }

            // Trigger UI refresh after import
            if (window.app && window.app.loadTasks) {
                console.log('Triggering UI refresh after import...');
                window.app.loadTasks();
            }

            return {
                success: true,
                message: 'Data imported successfully',
                stats: importStats
            };

        } catch (error) {
            console.error('Import error:', error);
            throw error;
        }
    }
}

// Create global instance
window.dataService = new DataService();