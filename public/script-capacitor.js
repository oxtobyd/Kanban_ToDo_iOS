class TodoApp {
    constructor() {
        this.tasks = [];
        this.currentTaskId = null;
        this.currentPriority = '';
        this.currentSortBy = 'priority';
        this.currentSearch = '';
        this.currentTag = '';
        this.currentTaskTags = [];
        this.availableTags = [];
        this.searchTimeout = null;
        this.editingNoteId = null;
        this.pendingTaskId = null;
        // Touch gesture properties
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchEndX = 0;
        this.touchEndY = 0;
        this.isSwiping = false;
        this.swipeThreshold = 50;
        this.swipeTimeout = null;
        this.mobileColumn = 'todo';
        this.isDragging = false;
    }

    async init() {
        // Wait for Capacitor to be ready
        if (window.Capacitor) {
            try {
                if (window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
                    await window.Capacitor.Plugins.App.addListener('appStateChange', (state) => {
                        if (state.isActive) {
                            // App became active, reload data in case it was synced from another device
                            this.loadTasks();
                        }
                    });
                }
            } catch (error) {
                // Continue without the listener - not critical
            }
        }

        // Initialize data service
        await window.dataService.init();
        
        await this.loadTags();
        await this.loadTasks();
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.setupTouchGestures();
        this.setupTagsInput();
        this.setupFileDragAndDrop();
        this.syncUIState();
        this.setupMobileUI();
        // Inject a style to disable text selection while dragging
        if (!document.getElementById('no-text-select-style')) {
            const style = document.createElement('style');
            style.id = 'no-text-select-style';
            style.textContent = `
                body.no-text-select, body.no-text-select * { 
                    -webkit-user-select: none !important; 
                    -moz-user-select: none !important; 
                    -ms-user-select: none !important; 
                    user-select: none !important; 
                }
            `;
            document.head.appendChild(style);
        }
    }

    toggleMobileSearch() {
        const overlay = document.getElementById('mobileSearch');
        const visible = overlay && overlay.style.display !== 'none';
        if (overlay) overlay.style.display = visible ? 'none' : 'flex';
        if (!visible) {
            const input = document.getElementById('mobileSearchInput');
            if (input) setTimeout(() => input.focus(), 50);
        }
        // sync tag options
        const mobileTag = document.getElementById('mobileTag');
        if (mobileTag) {
            mobileTag.innerHTML = '<option value="">All Tags</option>' + this.availableTags.map(t => `<option value="${t}">${t}</option>`).join('');
        }
    }

    openMobileActions() {
        const sheet = document.getElementById('mobileActions');
        if (sheet) sheet.style.display = 'flex';
    }

    closeMobileActions() {
        const sheet = document.getElementById('mobileActions');
        if (sheet) sheet.style.display = 'none';
    }

    async manualSync() {
        if (!window.Capacitor || !window.Capacitor.isNativePlatform()) {
            console.log('Manual sync only available on native platforms');
            return;
        }

        try {
            console.log('Manual sync requested...');
            
            // Show sync indicator
            const syncBtn = document.querySelector('.sync-btn');
            if (syncBtn) {
                syncBtn.classList.add('syncing');
                syncBtn.disabled = true;
            }

            // Use the iCloud sync service to check for updates
            if (window.iCloudSync) {
                const currentData = await window.dataService.exportData();
                const syncResult = await window.iCloudSync.checkForUpdates(currentData.data);
                
                if (syncResult.hasUpdates) {
                    console.log('Updates found, importing from iCloud...');
                    await window.dataService.importData({ data: syncResult.data }, { clearExisting: true });
                    await this.loadTasks();
                    console.log('Manual sync completed - data updated');
                } else {
                    console.log('No updates found in iCloud');
                }
            } else {
                console.error('iCloud sync service not available');
            }

        } catch (error) {
            console.error('Manual sync failed:', error);
        } finally {
            // Remove sync indicator
            const syncBtn = document.querySelector('.sync-btn');
            if (syncBtn) {
                syncBtn.classList.remove('syncing');
                syncBtn.disabled = false;
            }
        }
    }

    async loadTasks(priority = null, sortBy = null, search = null, tag = null) {
        try {
            // Use provided values or keep current state
            if (priority !== null) this.currentPriority = priority;
            if (sortBy !== null) this.currentSortBy = sortBy;
            if (search !== null) this.currentSearch = search;
            if (tag !== null) this.currentTag = tag;
            
            // Sync UI dropdowns with current state
            this.syncUIState();
            
            const filters = {
                priority: this.currentPriority || undefined,
                sortBy: this.currentSortBy,
                search: this.currentSearch || undefined,
                tag: this.currentTag || undefined
            };
            
            this.tasks = await window.dataService.getTasks(filters);
            this.renderTasks();
        } catch (error) {
            console.error('Error loading tasks:', error);
        }
    }

    async loadTags() {
        try {
            this.availableTags = await window.dataService.getTags();
            this.updateTagFilter();
        } catch (error) {
            console.error('Error loading tags:', error);
        }
    }

    syncUIState() {
        // Update dropdown values to match current state
        const priorityFilter = document.getElementById('priorityFilter');
        const sortBy = document.getElementById('sortBy');
        const tagFilter = document.getElementById('tagFilter');
        const searchInput = document.getElementById('searchInput');
        const clearSearch = document.getElementById('clearSearch');
        
        if (priorityFilter) {
            priorityFilter.value = this.currentPriority;
            priorityFilter.classList.toggle('filter-active', !!this.currentPriority);
        }
        if (sortBy) sortBy.value = this.currentSortBy;
        if (tagFilter) {
            tagFilter.value = this.currentTag;
            tagFilter.classList.toggle('filter-active', !!this.currentTag);
        }
        if (searchInput) {
            searchInput.value = this.currentSearch;
            if (clearSearch) {
                clearSearch.style.display = this.currentSearch ? 'block' : 'none';
            }
        }
    }

    updateTagFilter() {
        const tagFilter = document.getElementById('tagFilter');
        if (!tagFilter) return;
        
        // Clear existing options except "All Tags"
        tagFilter.innerHTML = '<option value="">All Tags</option>';
        
        // Add available tags
        this.availableTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            tagFilter.appendChild(option);
        });
    }

    handleSearch(searchTerm) {
        // Clear existing timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        
        // Debounce search
        this.searchTimeout = setTimeout(() => {
            this.currentSearch = searchTerm.trim();
            this.loadTasks();
        }, 300);
    }

    clearSearch() {
        document.getElementById('searchInput').value = '';
        this.currentSearch = '';
        this.loadTasks();
    }

    async filterByTag(tag) {
        this.currentTag = tag;
        await this.loadTasks();
    }

    async renderTasks() {
        const columns = ['todo', 'in_progress', 'pending', 'done'];
        
        for (const status of columns) {
            const list = document.getElementById(`${status}-list`);
            const tasks = this.tasks.filter(task => task.status === status);
            
            const taskHTMLPromises = tasks.map(task => this.createTaskHTML(task));
            const taskHTMLs = await Promise.all(taskHTMLPromises);
            list.innerHTML = taskHTMLs.join('');
            
            // Update task count
            const countElement = document.querySelector(`[data-status="${status}"] .task-count`);
            countElement.textContent = tasks.length;
        }
    }

    setupMobileUI() {
        const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
        const bottomBar = document.getElementById('mobileBottomBar');
        const fab = document.getElementById('mobileFab');
        if (isMobile) {
            document.body.setAttribute('data-mobile-column', this.mobileColumn);
            if (bottomBar) bottomBar.style.display = 'flex';
            if (fab) fab.style.display = 'block';
            this.updateMobileSegments();
        } else {
            if (bottomBar) bottomBar.style.display = 'none';
            if (fab) fab.style.display = 'none';
            document.body.removeAttribute('data-mobile-column');
        }

        window.addEventListener('resize', () => {
            const mobileNow = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
            if (mobileNow) {
                document.body.setAttribute('data-mobile-column', this.mobileColumn);
                if (bottomBar) bottomBar.style.display = 'flex';
                if (fab) fab.style.display = 'block';
                this.updateMobileSegments();
            } else {
                if (bottomBar) bottomBar.style.display = 'none';
                if (fab) fab.style.display = 'none';
                document.body.removeAttribute('data-mobile-column');
            }
        });
    }

    setMobileColumn(col) {
        this.mobileColumn = col;
        document.body.setAttribute('data-mobile-column', this.mobileColumn);
        this.updateMobileSegments();
        this.renderTasks();
    }

    updateMobileSegments() {
        const segments = document.querySelectorAll('.mobile-segment');
        segments.forEach(btn => {
            if (btn.dataset.col === this.mobileColumn) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    async createTaskHTML(task) {
        const createdDate = new Date(task.created_at).toLocaleDateString();
        const priorityClass = `priority-${task.priority || 'medium'}`;
        const priorityLabel = this.getPriorityLabel(task.priority || 'medium');
        
        // Make URLs clickable and highlight search terms
        let title = this.makeUrlsClickable(task.title);
        let description = this.makeUrlsClickable(task.description || '');
        
        if (this.currentSearch) {
            const searchRegex = new RegExp(`(${this.escapeRegex(this.currentSearch)})`, 'gi');
            title = title.replace(searchRegex, '<span class="search-highlight">$1</span>');
            description = description.replace(searchRegex, '<span class="search-highlight">$1</span>');
        }
        
        // Render tags
        const tagsHTML = (task.tags && task.tags.length > 0) ? 
            `<div class="task-tags">
                ${task.tags.map(tag => `<span class="task-tag">${this.escapeHtml(tag)}</span>`).join('')}
            </div>` : '';
        
        // Render pending reason if task is pending
        const pendingReasonHTML = (task.status === 'pending' && task.pending_on) ?
            `<div class="pending-reason">
                <strong>Pending on:</strong> ${this.escapeHtml(task.pending_on)}
            </div>` : '';
        
        // Get sub-tasks for this task
        const subtasksHTML = await this.renderSubtasks(task.id);
        
        return `
            <div class="task-card ${priorityClass}" draggable="true" data-task-id="${task.id}">
                <div class="task-header">
                    <div class="task-title">${title}</div>
                    <div class="priority-badge priority-${task.priority || 'medium'}" onclick="app.showPriorityDropdown(event, ${task.id}, '${task.priority || 'medium'}')" title="Click to change priority">${priorityLabel}</div>
                </div>
                <div class="task-description">${description}</div>
                ${tagsHTML}
                ${pendingReasonHTML}
                ${subtasksHTML}
                <div class="task-meta">
                    <span>${createdDate}</span>
                    <div class="task-actions">
                        <button class="notes-btn" onclick="app.openNotesModal(${task.id})" title="Notes">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                                <polyline points="14,2 14,8 20,8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10,9 9,9 8,9"></polyline>
                            </svg>
                        </button>
                        <button class="edit-btn" onclick="app.editTask(${task.id})" title="Edit">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="delete-btn" onclick="app.deleteTask(${task.id})" title="Delete">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"></polyline>
                                <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    async renderSubtasks(taskId) {
        try {
            const subtasks = await window.dataService.getSubtasks(taskId);
            const completedCount = subtasks.filter(st => st.completed).length;
            const totalCount = subtasks.length;
            
            return `
                <div class="subtasks-section">
                    <div class="subtasks-header" onclick="app.toggleSubtasksVisibility(${taskId})">
                        <span class="subtasks-progress">${totalCount > 0 ? `${completedCount}/${totalCount} subtasks` : 'Sub-tasks'}</span>
                        <button class="toggle-subtasks-btn" title="Toggle subtasks">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6,9 12,15 18,9"></polyline>
                            </svg>
                        </button>
                    </div>
                    <div class="subtasks-list" id="subtasks-${taskId}" style="display: block;">
                        ${subtasks.map(subtask => `
                            <div class="subtask-item ${subtask.completed ? 'completed' : ''}">
                                <input type="checkbox" ${subtask.completed ? 'checked' : ''} 
                                       onchange="app.toggleSubtask(${subtask.id})" />
                                <span class="subtask-title" ondblclick="app.editSubtask(${subtask.id}, '${this.escapeHtml(subtask.title).replace(/'/g, "\\'")}')">
                                    ${this.makeUrlsClickable(subtask.title)}
                                </span>
                                <button class="delete-subtask-btn" onclick="app.deleteSubtask(${subtask.id})" title="Delete">×</button>
                            </div>
                        `).join('')}
                        <div class="add-subtask">
                            <input type="text" id="new-subtask-${taskId}" placeholder="Add sub-task... (or drag & drop files)" 
                                   onkeypress="if(event.key==='Enter') app.addSubtaskFromInput(${taskId})">
                            <button onclick="app.addSubtaskFromInput(${taskId})" class="add-subtask-btn">Add</button>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error rendering subtasks:', error);
            return '';
        }
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    getPriorityLabel(priority) {
        const labels = {
            'urgent': 'Urgent',
            'high': 'High',
            'medium': 'Medium',
            'low': 'Low'
        };
        return labels[priority] || 'Medium';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    makeUrlsClickable(text) {
        if (!text) return text;
        
        // First escape HTML to prevent XSS
        const escapedText = this.escapeHtml(text);
        
        // Process file attachments FIRST to avoid URL regex interference
        const fileRegex = /\[File: ([^\]]+)\]\((file:[^)]+)\)/g;
        let result = escapedText.replace(fileRegex, (match, fileName, fileUri) => {
            console.log('Processing file link:', { match, fileName, fileUri });
            // Clean up the file URI if it has extra text
            const cleanUri = fileUri.replace(/^[^f]*file:\/\//, 'file://');
            console.log('Cleaned URI:', cleanUri);
            const linkHtml = `<a href="#" onclick="app.openFile('${cleanUri}', '${fileName}'); return false;" style="color: #667eea; text-decoration: underline; cursor: pointer;">📎 ${fileName}</a>`;
            console.log('Generated link HTML:', linkHtml);
            return linkHtml;
        });
        
        // Then detect URLs and make them clickable (but avoid already processed file links)
        const urlRegex = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s<>"']*)/g;
        result = result.replace(urlRegex, (url) => {
            // Skip if this is already part of a file link
            if (result.includes(`📎 ${url}`) || result.includes(`onclick="app.openFile`)) {
                return url;
            }
            let href = url;
            if (!url.startsWith('http')) {
                href = 'https://' + url;
            }
            return `<a href="${href}" target="_blank" rel="noopener" style="color: #667eea; text-decoration: underline;">${url}</a>`;
        });
        
        return result;
    }

    async arrayBufferToBase64(buffer) {
        return new Promise((resolve, reject) => {
            const blob = new Blob([buffer]);
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1]; // Remove data:application/octet-stream;base64, prefix
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const result = reader.result || '';
                    const base64 = String(result).split(',')[1] || '';
                    resolve(base64);
                } catch (e) {
                    reject(e);
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async openFile(fileUri, fileName) {
        try {
            console.log('=== OPEN FILE CALLED ===');
            console.log('Attempting to open file:', { fileUri, fileName });
            console.log('Capacitor available:', !!window.Capacitor);
            console.log('App plugin available:', !!(window.Capacitor && window.Capacitor.Plugins.App));
            console.log('FileViewer plugin available:', !!(window.Capacitor && window.Capacitor.Plugins.FileViewer));
            
            if (window.Capacitor && window.Capacitor.Plugins.App) {
                console.log('App plugin methods:', Object.keys(window.Capacitor.Plugins.App));
            }
            
            // Try using window.open first (most reliable for file:// URLs on Mac)
            console.log('Using window.open to open:', fileUri);
            window.open(fileUri, '_blank');
            this.showNotification(`Opening ${fileName}...`, 'success');
            
            // Also try FileViewer as backup
            if (window.Capacitor && window.Capacitor.Plugins.FileViewer) {
                console.log('Using FileViewer plugin to open:', fileUri);
                await window.Capacitor.Plugins.FileViewer.openDocumentFromLocalPath({ path: fileUri });
                this.showNotification(`Opening ${fileName}...`, 'success');
            } else if (window.Capacitor && window.Capacitor.Plugins.FileOpener) {
                // Try File Opener plugin with just the filename
                const fileNameOnly = fileUri.split('/').pop();
                console.log('Using FileOpener plugin to open filename:', fileNameOnly);
                await window.Capacitor.Plugins.FileOpener.openFile({ path: fileNameOnly });
                this.showNotification(`Opening ${fileName}...`, 'success');
            } else {
                // Fallback to window.open
                console.log('Using window.open to open:', fileUri);
                window.open(fileUri, '_blank');
                this.showNotification(`Opening ${fileName}...`, 'success');
            }
        } catch (error) {
            console.error('Error opening file:', error);
            this.showNotification(`Could not open ${fileName}: ${error.message}`, 'error');
        }
    }

    setupEventListeners() {
        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTask();
        });

        // Handle status change to show/hide pending reason
        document.getElementById('taskStatus').addEventListener('change', (e) => {
            this.togglePendingReason(e.target.value);
        });

        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeTaskModal();
                this.closeNotesModal();
                this.closePendingReasonModal();
            }
        });
    }

    togglePendingReason(status) {
        const pendingReasonGroup = document.getElementById('pendingReasonGroup');
        if (status === 'pending') {
            pendingReasonGroup.style.display = 'block';
        } else {
            pendingReasonGroup.style.display = 'none';
            document.getElementById('pendingReason').value = '';
        }
    }

    setupDragAndDrop() {
        document.addEventListener('dragstart', (e) => {
            const card = e.target.closest('.task-card');
            if (card) {
                card.classList.add('dragging');
                try { e.dataTransfer.effectAllowed = 'move'; } catch (_) {}
                e.dataTransfer.setData('text/plain', card.dataset.taskId);
                this.isDragging = true;
                document.body.classList.add('no-text-select');
            }
        });

        document.addEventListener('dragend', (e) => {
            const card = e.target.closest('.task-card');
            if (card) {
                card.classList.remove('dragging');
                this.isDragging = false;
                document.body.classList.remove('no-text-select');
            }
        });

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
            const column = e.target.closest('.column');
            if (column) {
                const taskList = column.querySelector('.task-list');
                if (taskList) taskList.classList.add('drag-over');
            }
        });

        document.addEventListener('dragleave', (e) => {
            const column = e.target.closest('.column');
            if (column && !column.contains(e.relatedTarget)) {
                const taskList = column.querySelector('.task-list');
                if (taskList) taskList.classList.remove('drag-over');
            }
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            const column = e.target.closest('.column');
            if (column) {
                const taskList = column.querySelector('.task-list');
                if (taskList) taskList.classList.remove('drag-over');
                const taskId = e.dataTransfer.getData('text/plain');
                const newStatus = column.dataset.status;
                
                // If dropping into pending column, ask for reason
                if (newStatus === 'pending') {
                    this.showPendingReasonModal(taskId);
                } else {
                    this.updateTaskStatus(taskId, newStatus);
                }
            }
        });

        document.addEventListener('selectstart', (e) => {
            if (this.isDragging) e.preventDefault();
        });
    }

    setupTouchGestures() {
        document.addEventListener('touchstart', (e) => {
            const taskCard = e.target.closest('.task-card');
            if (!taskCard) return;

            this.touchStartX = e.touches[0].clientX;
            this.touchStartY = e.touches[0].clientY;
            this.isSwiping = false;
            
            taskCard.classList.add('touch-active');
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            const taskCard = e.target.closest('.task-card');
            if (!taskCard) return;

            this.touchEndX = e.touches[0].clientX;
            this.touchEndY = e.touches[0].clientY;

            const deltaX = this.touchEndX - this.touchStartX;
            const deltaY = this.touchEndY - this.touchStartY;

            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
                this.isSwiping = true;
                e.preventDefault();
                
                const swipeProgress = Math.min(Math.abs(deltaX) / 100, 1);
                const direction = deltaX > 0 ? 'right' : 'left';
                
                taskCard.style.transform = `translateX(${deltaX * 0.3}px)`;
                taskCard.style.opacity = 1 - (swipeProgress * 0.3);
                
                taskCard.classList.remove('swiping-left', 'swiping-right');
                taskCard.classList.add(`swiping-${direction}`);
            }
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            const taskCard = e.target.closest('.task-card');
            if (!taskCard) return;

            taskCard.classList.remove('touch-active', 'swiping-left', 'swiping-right');
            
            taskCard.style.transform = '';
            taskCard.style.opacity = '';

            if (this.isSwiping) {
                const deltaX = this.touchEndX - this.touchStartX;
                const deltaY = this.touchEndY - this.touchStartY;

                if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > this.swipeThreshold) {
                    const taskId = taskCard.dataset.taskId;
                    const currentTask = this.tasks.find(t => t.id == taskId);
                    
                    if (currentTask) {
                        const newStatus = this.getNextStatus(currentTask.status, deltaX > 0);
                        if (newStatus !== currentTask.status) {
                            this.showSwipeAnimation(taskCard, deltaX > 0);
                            
                            if (newStatus === 'pending') {
                                this.showPendingReasonModal(taskId);
                            } else {
                                this.updateTaskStatus(taskId, newStatus);
                            }
                        }
                    }
                }
            }

            this.isSwiping = false;
        }, { passive: true });
    }

    getNextStatus(currentStatus, swipeRight) {
        const statusFlow = ['todo', 'in_progress', 'pending', 'done'];
        const currentIndex = statusFlow.indexOf(currentStatus);
        
        if (swipeRight) {
            return currentIndex < statusFlow.length - 1 ? statusFlow[currentIndex + 1] : currentStatus;
        } else {
            return currentIndex > 0 ? statusFlow[currentIndex - 1] : currentStatus;
        }
    }

    showSwipeAnimation(taskCard, swipeRight) {
        const direction = swipeRight ? 'right' : 'left';
        taskCard.classList.add(`swipe-${direction}`);
        
        this.showSwipeFeedback(taskCard, swipeRight);
        
        setTimeout(() => {
            taskCard.classList.remove(`swipe-${direction}`);
        }, 300);
    }

    showSwipeFeedback(taskCard, swipeRight) {
        const currentTask = this.tasks.find(t => t.id == taskCard.dataset.taskId);
        if (!currentTask) return;
        
        const newStatus = this.getNextStatus(currentTask.status, swipeRight);
        const statusLabels = {
            'todo': 'To Do',
            'in_progress': 'In Progress',
            'pending': 'Pending',
            'done': 'Done'
        };
        
        if (newStatus !== currentTask.status) {
            const feedback = document.createElement('div');
            feedback.className = 'swipe-feedback';
            feedback.textContent = `Moved to ${statusLabels[newStatus]}`;
            
            taskCard.appendChild(feedback);
            
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.parentNode.removeChild(feedback);
                }
            }, 2000);
        }
    }

    async updateTaskStatus(taskId, newStatus, pendingReason = null) {
        try {
            await window.dataService.updateTaskStatus(taskId, newStatus, pendingReason);
            await this.loadTasks();
        } catch (error) {
            console.error('Error updating task status:', error);
        }
    }

    showPendingReasonModal(taskId) {
        this.pendingTaskId = taskId;
        const modal = document.getElementById('pendingReasonModal');
        const input = document.getElementById('pendingReasonInput');
        
        input.value = '';
        modal.style.display = 'block';
        setTimeout(() => input.focus(), 100);
        
        const handleEnter = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.savePendingReason();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.closePendingReasonModal();
            }
        };
        
        input.addEventListener('keydown', handleEnter);
        input._enterHandler = handleEnter;
    }

    closePendingReasonModal() {
        const modal = document.getElementById('pendingReasonModal');
        const input = document.getElementById('pendingReasonInput');
        
        if (input._enterHandler) {
            input.removeEventListener('keydown', input._enterHandler);
            delete input._enterHandler;
        }
        
        modal.style.display = 'none';
        this.pendingTaskId = null;
    }

    savePendingReason() {
        const input = document.getElementById('pendingReasonInput');
        const reason = input.value.trim();
        
        if (!reason) {
            alert('Please provide a reason why this task is pending.');
            input.focus();
            return;
        }
        
        if (this.pendingTaskId) {
            this.updateTaskStatus(this.pendingTaskId, 'pending', reason);
            this.closePendingReasonModal();
        }
    }

    openTaskModal(taskId = null) {
        this.currentTaskId = taskId;
        const modal = document.getElementById('taskModal');
        const title = document.getElementById('modalTitle');
        const form = document.getElementById('taskForm');
        
        if (taskId) {
            const task = this.tasks.find(t => t.id === taskId);
            title.textContent = 'Edit Task';
            document.getElementById('taskTitle').value = task.title;
            document.getElementById('taskDescription').value = task.description || '';
            document.getElementById('taskPriority').value = task.priority || 'medium';
            document.getElementById('taskStatus').value = task.status || 'todo';
            document.getElementById('pendingReason').value = task.pending_on || '';
            this.currentTaskTags = task.tags || [];
            this.togglePendingReason(task.status);
        } else {
            title.textContent = 'Add New Task';
            form.reset();
            document.getElementById('taskPriority').value = 'medium';
            document.getElementById('taskStatus').value = 'todo';
            this.currentTaskTags = [];
            this.togglePendingReason('todo');
        }
        
        this.renderTaskTags();
        modal.style.display = 'block';
        document.getElementById('taskTitle').focus();
    }

    setupTagsInput() {
        const tagsInput = document.getElementById('taskTags');
        if (!tagsInput) return;
        
        tagsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                const tag = tagsInput.value.trim().toLowerCase();
                if (tag && !this.currentTaskTags.includes(tag)) {
                    this.currentTaskTags.push(tag);
                    this.renderTaskTags();
                    tagsInput.value = '';
                }
            }
        });
    }

    renderTaskTags() {
        const tagsDisplay = document.getElementById('tagsDisplay');
        if (!tagsDisplay) return;
        
        tagsDisplay.innerHTML = this.currentTaskTags.map(tag => `
            <div class="tag-item">
                ${this.escapeHtml(tag)}
                <button class="remove-tag" onclick="app.removeTag('${tag}')" type="button">×</button>
            </div>
        `).join('');
    }

    removeTag(tagToRemove) {
        this.currentTaskTags = this.currentTaskTags.filter(tag => tag !== tagToRemove);
        this.renderTaskTags();
    }

    closeTaskModal() {
        document.getElementById('taskModal').style.display = 'none';
        this.currentTaskId = null;
    }

    async saveTask() {
        const title = document.getElementById('taskTitle').value.trim();
        const description = document.getElementById('taskDescription').value.trim();
        const priority = document.getElementById('taskPriority').value;
        const status = document.getElementById('taskStatus').value;
        const pendingReason = document.getElementById('pendingReason').value.trim();
        const tags = this.currentTaskTags;

        if (!title) return;

        if (status === 'pending' && !pendingReason) {
            alert('Please provide a reason why this task is pending.');
            document.getElementById('pendingReason').focus();
            return;
        }

        const taskData = {
            title,
            description,
            priority,
            status,
            tags,
            pending_on: status === 'pending' ? pendingReason : null
        };

        try {
            if (this.currentTaskId) {
                await window.dataService.updateTask(this.currentTaskId, taskData);
            } else {
                await window.dataService.createTask(taskData);
            }

            await this.loadTags();
            await this.loadTasks();
            this.closeTaskModal();
        } catch (error) {
            console.error('Error saving task:', error);
        }
    }

    async filterByPriority(priority) {
        this.currentPriority = priority;
        await this.loadTasks();
    }

    async sortTasks(sortBy) {
        this.currentSortBy = sortBy;
        await this.loadTasks();
    }

    editTask(taskId) {
        this.openTaskModal(taskId);
    }

    async deleteTask(taskId) {
        if (!confirm('Are you sure you want to delete this task?')) return;

        try {
            await window.dataService.deleteTask(taskId);
            await this.loadTasks();
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    }

    showPriorityDropdown(event, taskId, currentPriority) {
        event.stopPropagation();
        
        this.closePriorityDropdown();
        
        const badge = event.target;
        const dropdown = document.createElement('div');
        dropdown.className = 'priority-dropdown';
        dropdown.id = 'priority-dropdown';
        
        const priorities = [
            { value: 'urgent', label: 'Urgent', color: '#e53e3e' },
            { value: 'high', label: 'High', color: '#f39c12' },
            { value: 'medium', label: 'Medium', color: '#667eea' },
            { value: 'low', label: 'Low', color: '#38a169' }
        ];
        
        dropdown.innerHTML = priorities.map(priority => `
            <div class="priority-option ${priority.value === currentPriority ? 'selected' : ''}" 
                 onclick="app.changePriority(${taskId}, '${priority.value}')"
                 data-priority="${priority.value}">
                <span class="priority-color" style="background-color: ${priority.color}"></span>
                ${priority.label}
            </div>
        `).join('');
        
        const rect = badge.getBoundingClientRect();
        dropdown.style.position = 'absolute';
        dropdown.style.top = (rect.bottom + window.scrollY + 5) + 'px';
        dropdown.style.left = (rect.left + window.scrollX) + 'px';
        dropdown.style.zIndex = '1000';
        
        document.body.appendChild(dropdown);
        
        setTimeout(() => {
            document.addEventListener('click', this.closePriorityDropdown.bind(this), { once: true });
        }, 0);
    }
    
    closePriorityDropdown() {
        const dropdown = document.getElementById('priority-dropdown');
        if (dropdown) {
            dropdown.remove();
        }
    }
    
    async changePriority(taskId, newPriority) {
        this.closePriorityDropdown();
        
        try {
            await window.dataService.updateTaskPriority(taskId, newPriority);
            await this.loadTasks();
        } catch (error) {
            console.error('Error updating task priority:', error);
        }
    }

    async openNotesModal(taskId) {
        this.currentTaskId = taskId;
        const modal = document.getElementById('notesModal');
        modal.style.display = 'block';
        await this.loadNotes(taskId);
    }

    closeNotesModal() {
        document.getElementById('notesModal').style.display = 'none';
        this.currentTaskId = null;
    }

    async loadNotes(taskId) {
        try {
            const notes = await window.dataService.getNotes(taskId);
            this.renderNotes(notes);
        } catch (error) {
            console.error('Error loading notes:', error);
        }
    }

    renderNotes(notes) {
        const notesList = document.getElementById('notesList');
        notesList.innerHTML = notes.map(note => `
            <div class="note-item" data-note-id="${note.id}">
                <div class="note-content" id="note-content-${note.id}">${this.makeUrlsClickable(note.content)}</div>
                <div class="note-meta">
                    <span>${new Date(note.created_at).toLocaleDateString()}</span>
                    <div class="note-actions">
                        <button class="edit-note-btn" onclick="app.editNote(${note.id})" title="Edit">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="delete-note-btn" onclick="app.deleteNote(${note.id})" title="Delete">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"></polyline>
                                <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async addNote() {
        const textarea = document.getElementById('newNote');
        const content = textarea.value.trim();
        
        if (!content || !this.currentTaskId) return;
        
        try {
            await window.dataService.createNote(this.currentTaskId, content);
            textarea.value = '';
            await this.loadNotes(this.currentTaskId);
        } catch (error) {
            console.error('Error adding note:', error);
        }
    }

    async handleFileDrop(file, targetElement) {
        try {
            console.log('File dropped:', { name: file.name, type: file.type, size: file.size });
            
            if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.Filesystem) {
                console.warn('Filesystem plugin not available');
                return null;
            }
            const { Filesystem } = window.Capacitor.Plugins;

            // Generate unique filename in app sandbox
            const fileName = `attachment-${Date.now()}-${file.name}`;

            // Convert to base64 using FileReader directly on File (most reliable for binary)
            const base64Data = await this.fileToBase64(file);

            // Save to Documents with base64 and recursive
            await Filesystem.writeFile({
                path: fileName,
                data: base64Data,
                directory: 'DOCUMENTS',
                encoding: 'base64',
                recursive: true
            });

            // Resolve a URI we can open later
            const uriResult = await Filesystem.getUri({
                path: fileName,
                directory: 'DOCUMENTS'
            });

            console.log('File saved successfully:', {
                fileName: file.name,
                uri: uriResult.uri,
                size: file.size,
                type: file.type
            });

            // Insert link into target element
            const fileLink = `[File: ${file.name}](${uriResult.uri})`;
            if (targetElement.tagName === 'TEXTAREA') {
                const textarea = targetElement;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const text = textarea.value;
                const before = text.substring(0, start);
                const after = text.substring(end);
                textarea.value = before + fileLink + after;
                textarea.selectionStart = textarea.selectionEnd = start + fileLink.length;
            } else if (targetElement.tagName === 'INPUT') {
                const input = targetElement;
                const start = input.selectionStart;
                const end = input.selectionEnd;
                const text = input.value;
                const before = text.substring(0, start);
                const after = text.substring(end);
                input.value = before + fileLink + after;
                input.selectionStart = input.selectionEnd = start + fileLink.length;
            }

            // Trigger input event to update UI
            targetElement.dispatchEvent(new Event('input', { bubbles: true }));
            this.showNotification(`File "${file.name}" attached successfully!`, 'success');

            return {
                fileName: file.name,
                uri: uriResult.uri,
                size: file.size,
                type: file.type
            };
        } catch (error) {
            console.error('Error handling file drop:', error);
            this.showNotification(`Error attaching file: ${error.message}`, 'error');
            return null;
        }
    }

    setupFileDragAndDrop() {
        // Setup file drag and drop for notes
        const noteTextarea = document.getElementById('newNote');
        if (noteTextarea) {
            noteTextarea.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                noteTextarea.style.borderColor = '#667eea';
                noteTextarea.style.backgroundColor = '#f0f4ff';
            });

            noteTextarea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                noteTextarea.style.borderColor = '';
                noteTextarea.style.backgroundColor = '';
            });

            noteTextarea.addEventListener('drop', async (e) => {
                e.preventDefault();
                noteTextarea.style.borderColor = '';
                noteTextarea.style.backgroundColor = '';
                
                // Prefer original Finder URI if provided (no copying)
                const uriList = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
                if (uriList) {
                    const firstUri = uriList.split('\n')[0].trim();
                    if (firstUri.startsWith('file:')) {
                        const decodedName = decodeURIComponent(firstUri.split('/').pop() || 'file');
                        const fileLink = `[File: ${decodedName}](${firstUri})`;
                        const currentText = noteTextarea.value;
                        noteTextarea.value = currentText + (currentText ? '\n' : '') + fileLink;
                        noteTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                        this.showNotification(`Linked file "${decodedName}"`, 'success');
                        return;
                    }
                }

                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    const file = files[0];
                    const fileInfo = await this.handleFileDrop(file, noteTextarea);
                    
                    if (fileInfo) {
                        const currentText = noteTextarea.value;
                        const fileLink = `[File: ${fileInfo.fileName}](${fileInfo.uri})`;
                        console.log('Generated file link:', fileLink);
                        noteTextarea.value = currentText + (currentText ? '\n' : '') + fileLink;
                        this.showNotification(`File "${fileInfo.fileName}" attached successfully!`, 'success');
                    } else {
                        this.showNotification('Failed to attach file', 'error');
                    }
                }
            });
        }

        // Setup file drag and drop for subtasks
        document.addEventListener('dragover', (e) => {
            const subtaskInput = e.target.closest('input[id^="new-subtask-"]');
            if (subtaskInput) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                subtaskInput.style.borderColor = '#667eea';
                subtaskInput.style.backgroundColor = '#f0f4ff';
            }
        });

        document.addEventListener('dragleave', (e) => {
            const subtaskInput = e.target.closest('input[id^="new-subtask-"]');
            if (subtaskInput) {
                e.preventDefault();
                subtaskInput.style.borderColor = '';
                subtaskInput.style.backgroundColor = '';
            }
        });

        document.addEventListener('drop', async (e) => {
            const subtaskInput = e.target.closest('input[id^="new-subtask-"]');
            if (subtaskInput) {
                e.preventDefault();
                subtaskInput.style.borderColor = '';
                subtaskInput.style.backgroundColor = '';
                
                // Prefer original Finder URI if provided (no copying)
                const uriList = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
                if (uriList) {
                    const firstUri = uriList.split('\n')[0].trim();
                    if (firstUri.startsWith('file:')) {
                        const decodedName = decodeURIComponent(firstUri.split('/').pop() || 'file');
                        const fileLink = `[File: ${decodedName}](${firstUri})`;
                        const currentText = subtaskInput.value;
                        subtaskInput.value = currentText + (currentText ? ' ' : '') + fileLink;
                        subtaskInput.dispatchEvent(new Event('input', { bubbles: true }));
                        this.showNotification(`Linked file "${decodedName}"`, 'success');
                        return;
                    }
                }

                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    const file = files[0];
                    const fileInfo = await this.handleFileDrop(file, subtaskInput);
                    
                    if (fileInfo) {
                        const currentText = subtaskInput.value;
                        const fileLink = `[File: ${fileInfo.fileName}](${fileInfo.uri})`;
                        subtaskInput.value = currentText + (currentText ? ' ' : '') + fileLink;
                        this.showNotification(`File "${fileInfo.fileName}" attached successfully!`, 'success');
                    } else {
                        this.showNotification('Failed to attach file', 'error');
                    }
                }
            }
        });
    }

    async editNote(noteId) {
        const noteContent = document.getElementById(`note-content-${noteId}`);
        const currentText = noteContent.textContent;
        
        const textarea = document.createElement('textarea');
        textarea.value = currentText;
        textarea.className = 'edit-note-textarea';
        textarea.rows = 3;
        
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.className = 'save-note-btn';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'cancel-note-btn';
        
        const actions = document.createElement('div');
        actions.className = 'edit-note-actions';
        actions.appendChild(saveBtn);
        actions.appendChild(cancelBtn);
        
        noteContent.innerHTML = '';
        noteContent.appendChild(textarea);
        noteContent.appendChild(actions);
        
        textarea.focus();
        
        saveBtn.onclick = async () => {
            const newContent = textarea.value.trim();
            if (newContent) {
                try {
                    await window.dataService.updateNote(noteId, newContent);
                    await this.loadNotes(this.currentTaskId);
                } catch (error) {
                    console.error('Error updating note:', error);
                }
            }
        };
        
        cancelBtn.onclick = () => {
            noteContent.textContent = currentText;
        };
    }

    async deleteNote(noteId) {
        if (!confirm('Are you sure you want to delete this note?')) return;
        
        try {
            await window.dataService.deleteNote(noteId);
            await this.loadNotes(this.currentTaskId);
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    }

    toggleSubtasksVisibility(taskId) {
        const subtasksList = document.getElementById(`subtasks-${taskId}`);
        const toggleBtn = subtasksList.parentElement.querySelector('.toggle-subtasks-btn svg');
        
        if (subtasksList.style.display === 'none') {
            subtasksList.style.display = 'block';
            toggleBtn.style.transform = 'rotate(0deg)';
        } else {
            subtasksList.style.display = 'none';
            toggleBtn.style.transform = 'rotate(-90deg)';
        }
    }

    async addSubtaskFromInput(taskId) {
        const input = document.getElementById(`new-subtask-${taskId}`);
        const title = input.value.trim();
        
        if (!title) return;
        
        try {
            await window.dataService.createSubtask(taskId, title);
            input.value = '';
            await this.loadTasks(); // Refresh to show new subtask
        } catch (error) {
            console.error('Error adding subtask:', error);
        }
    }

    async toggleSubtask(subtaskId) {
        try {
            await window.dataService.toggleSubtask(subtaskId);
            await this.loadTasks(); // Refresh to show updated state
        } catch (error) {
            console.error('Error toggling subtask:', error);
        }
    }

    async editSubtask(subtaskId, currentTitle) {
        const newTitle = prompt('Edit subtask:', currentTitle);
        if (newTitle && newTitle.trim() !== currentTitle) {
            try {
                await window.dataService.updateSubtask(subtaskId, { title: newTitle.trim() });
                await this.loadTasks();
            } catch (error) {
                console.error('Error updating subtask:', error);
            }
        }
    }

    async deleteSubtask(subtaskId) {
        if (!confirm('Are you sure you want to delete this subtask?')) return;
        
        try {
            await window.dataService.deleteSubtask(subtaskId);
            await this.loadTasks();
        } catch (error) {
            console.error('Error deleting subtask:', error);
        }
    }

    async openNotesModal(taskId) {
        this.currentTaskId = taskId;
        const modal = document.getElementById('notesModal');
        modal.style.display = 'block';
        await this.loadNotes(taskId);
    }

    closeNotesModal() {
        document.getElementById('notesModal').style.display = 'none';
        this.currentTaskId = null;
    }

    async loadNotes(taskId) {
        try {
            const notes = await window.dataService.getNotes(taskId);
            this.renderNotes(notes);
        } catch (error) {
            console.error('Error loading notes:', error);
        }
    }

    renderNotes(notes) {
        const notesList = document.getElementById('notesList');
        notesList.innerHTML = notes.map(note => `
            <div class="note-item" data-note-id="${note.id}">
                <div class="note-content" id="note-content-${note.id}">${this.makeUrlsClickable(note.content)}</div>
                <div class="note-meta">
                    <span class="note-date">${new Date(note.created_at).toLocaleString()}</span>
                    <div class="note-actions">
                        <button class="note-edit-btn" onclick="app.editNote(${note.id}, '${this.escapeHtml(note.content).replace(/'/g, "\\'")}')">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="note-delete-btn" onclick="app.deleteNote(${note.id})">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"></polyline>
                                <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async addNote() {
        const content = document.getElementById('newNote').value.trim();
        if (!content || !this.currentTaskId) return;

        try {
            await window.dataService.createNote(this.currentTaskId, content);
            document.getElementById('newNote').value = '';
            await this.loadNotes(this.currentTaskId);
        } catch (error) {
            console.error('Error adding note:', error);
        }
    }

    async editNote(noteId, currentContent) {
        const newContent = prompt('Edit note:', currentContent);
        if (newContent === null || newContent.trim() === currentContent) return;

        try {
            await window.dataService.updateNote(noteId, newContent.trim());
            await this.loadNotes(this.currentTaskId);
        } catch (error) {
            console.error('Error updating note:', error);
        }
    }

    async deleteNote(noteId) {
        if (!confirm('Delete this note?')) return;

        try {
            await window.dataService.deleteNote(noteId);
            await this.loadNotes(this.currentTaskId);
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    }

    // Subtask methods
    toggleSubtasksVisibility(taskId) {
        const subtasksList = document.getElementById(`subtasks-${taskId}`);
        const toggleBtn = subtasksList.parentElement.querySelector('.toggle-subtasks-btn svg');
        
        if (subtasksList.style.display === 'none' || subtasksList.style.display === '') {
            subtasksList.style.display = 'block';
            toggleBtn.style.transform = 'rotate(180deg)';
        } else {
            subtasksList.style.display = 'none';
            toggleBtn.style.transform = 'rotate(0deg)';
        }
    }

    async addSubtask(taskId) {
        const title = prompt('Enter subtask title:');
        if (!title || !title.trim()) return;

        try {
            await window.dataService.createSubtask(taskId, title.trim());
            await this.loadTasks();
        } catch (error) {
            console.error('Error adding subtask:', error);
        }
    }

    async addSubtaskFromInput(taskId) {
        const input = document.getElementById(`new-subtask-${taskId}`);
        const title = input.value.trim();
        
        if (!title) return;

        try {
            await window.dataService.createSubtask(taskId, title);
            input.value = '';
            await this.loadTasks();
        } catch (error) {
            console.error('Error adding subtask:', error);
        }
    }

    async toggleSubtask(subtaskId) {
        try {
            await window.dataService.toggleSubtask(subtaskId);
            await this.loadTasks();
        } catch (error) {
            console.error('Error toggling subtask:', error);
        }
    }

    async editSubtask(subtaskId, currentTitle) {
        const newTitle = prompt('Edit subtask:', currentTitle);
        if (newTitle === null || newTitle.trim() === currentTitle) return;

        try {
            await window.dataService.updateSubtask(subtaskId, { title: newTitle.trim() });
            await this.loadTasks();
        } catch (error) {
            console.error('Error updating subtask:', error);
        }
    }

    async deleteSubtask(subtaskId) {
        if (!confirm('Delete this subtask?')) return;

        try {
            await window.dataService.deleteSubtask(subtaskId);
            await this.loadTasks();
        } catch (error) {
            console.error('Error deleting subtask:', error);
        }
    }

    // Import/Export methods
    async exportData() {
        try {
            const exportData = await window.dataService.exportData();
            
            // For Capacitor, we'll use the Filesystem API to save the file
            if (window.Capacitor && window.Capacitor.Plugins.Filesystem) {
                const { Filesystem, Share, App } = window.Capacitor.Plugins;
                
                const fileName = `kanban-export-${new Date().toISOString().split('T')[0]}.json`;
                const data = JSON.stringify(exportData, null, 2);
                
                const isMac = /Macintosh/.test(navigator.userAgent);

                try {
                    // Write file to Documents (iOS and Mac)
                    await Filesystem.writeFile({
                        path: fileName,
                        data: data,
                        directory: 'DOCUMENTS',
                        encoding: 'utf8',
                        // ensure dirs (safety even though using root Documents)
                        recursive: true
                    });

                    // On Mac (Catalyst), skip Share and force a download prompt so user selects location
                    // Resolve URI
                    try {
                        const uriResult = await Filesystem.getUri({
                            path: fileName,
                            directory: 'DOCUMENTS'
                        });
                        if (uriResult && uriResult.uri) {
                            console.log('[Export] Saved file URI:', uriResult.uri);
                            if (isMac && App && App.openUrl) {
                                // Open in Finder on Mac
                                try {
                                    await App.openUrl({ url: uriResult.uri });
                                } catch (e) {
                                    console.warn('[Export] App.openUrl failed, showing alert instead:', e);
                                    try { alert(`Exported file:\n${uriResult.uri}`); } catch (_) {}
                                }
                            } else if (Share && Share.share) {
                                // iPhone/iPad: Share sheet
                                await Share.share({
                                    title: 'Export Kanban Data',
                                    url: uriResult.uri,
                                    dialogTitle: 'Share export'
                                });
                            }
                        } else {
                            console.log('[Export] Saved to Documents with file name:', fileName);
                            try { alert(`Exported file in Documents:\n${fileName}`); } catch (_) {}
                        }
                    } catch (resolveErr) {
                        console.error('[Export] getUri/openUrl failed, fallback to download:', resolveErr);
                        this.downloadFile(exportData, fileName);
                    }
                    this.showNotification(`Exported. You can also find it in Documents/${fileName}`, 'success');
                } catch (error) {
                    console.error('[Export] Error during write/share:', error);
                    try { this.showNotification('Export failed: ' + (error?.message || JSON.stringify(error) || 'Unknown'), 'error'); } catch (_) {}
                    // Fallback to download
                    this.downloadFile(exportData, fileName);
                }
            } else {
                // Fallback to browser download
                const fileName = `kanban-export-${new Date().toISOString().split('T')[0]}.json`;
                this.downloadFile(exportData, fileName);
            }
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('Failed to export data: ' + error.message, 'error');
        }
    }

    downloadFile(data, fileName) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('Data exported successfully!', 'success');
    }

    openImportModal() {
        const modal = document.getElementById('importModal');
        modal.style.display = 'block';
        this.setupFileUpload();
    }

    closeImportModal() {
        const modal = document.getElementById('importModal');
        modal.style.display = 'none';
        this.resetImportForm();
    }

    setupFileUpload() {
        const fileUploadArea = document.getElementById('fileUploadArea');
        const fileInput = document.getElementById('importFile');
        
        // Remove existing listeners to avoid duplicates
        const newFileUploadArea = fileUploadArea.cloneNode(true);
        fileUploadArea.parentNode.replaceChild(newFileUploadArea, fileUploadArea);
        
        // Click to select file
        newFileUploadArea.addEventListener('click', () => {
            fileInput.click();
        });
        
        // File selection
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelection(e.target.files[0]);
            }
        });
        
        // Drag and drop
        newFileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            newFileUploadArea.classList.add('drag-over');
        });
        
        newFileUploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            newFileUploadArea.classList.remove('drag-over');
        });
        
        newFileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            newFileUploadArea.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelection(files[0]);
            }
        });
    }

    async handleFileSelection(file) {
        if (!file.name.toLowerCase().endsWith('.json')) {
            this.showNotification('Please select a JSON file', 'error');
            return;
        }
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            // Validate file format - support both PostgreSQL and iOS formats
            const hasPostgresFormat = data.database && data.database.tasks;
            const hasIOSFormat = data.data && data.data.tasks;
            
            if (!hasPostgresFormat && !hasIOSFormat) {
                throw new Error('Invalid file format. Expected PostgreSQL or iOS export format.');
            }
            
            // Show selected file
            this.showSelectedFile(file.name);
            
            // Show preview
            this.showImportPreview(data);
            
            // Store data for import
            this.importData = data;
            
            // Enable import button
            document.getElementById('importBtn').disabled = false;
            
        } catch (error) {
            console.error('File parsing error:', error);
            this.showNotification('Invalid JSON file or format', 'error');
        }
    }

    showSelectedFile(fileName) {
        const selectedFile = document.getElementById('selectedFile');
        const fileNameSpan = selectedFile.querySelector('.file-name');
        
        fileNameSpan.textContent = fileName;
        selectedFile.style.display = 'block';
        
        document.getElementById('fileUploadArea').style.display = 'none';
    }

    removeSelectedFile() {
        document.getElementById('selectedFile').style.display = 'none';
        document.getElementById('fileUploadArea').style.display = 'block';
        document.getElementById('importPreview').style.display = 'none';
        document.getElementById('importBtn').disabled = true;
        document.getElementById('importFile').value = '';
        this.importData = null;
    }

    showImportPreview(data) {
        const preview = document.getElementById('importPreview');
        
        // Support both formats
        let tasksCount, notesCount, subtasksCount;
        
        if (data.database) {
            // PostgreSQL format
            tasksCount = data.database.tasks ? data.database.tasks.length : 0;
            notesCount = data.database.notes ? data.database.notes.length : 0;
            subtasksCount = data.database.subTasks ? data.database.subTasks.length : 0;
        } else if (data.data) {
            // iOS format
            tasksCount = data.data.tasks ? data.data.tasks.length : 0;
            notesCount = data.data.notes ? data.data.notes.length : 0;
            subtasksCount = data.data.subtasks ? data.data.subtasks.length : 0;
        } else {
            tasksCount = notesCount = subtasksCount = 0;
        }
        
        document.getElementById('previewTasks').textContent = tasksCount;
        document.getElementById('previewNotes').textContent = notesCount;
        document.getElementById('previewSubtasks').textContent = subtasksCount;
        
        preview.style.display = 'block';
    }

    async performImport() {
        if (!this.importData) {
            this.showNotification('No file selected', 'error');
            return;
        }
        
        const clearExisting = document.getElementById('clearExisting').checked;
        const importBtn = document.getElementById('importBtn');
        
        try {
            importBtn.disabled = true;
            importBtn.textContent = 'Importing...';
            
            const result = await window.dataService.importData(this.importData, { clearExisting });
            
            // Show success message with stats
            this.showImportResult(result);
            
            // Reload tasks
            await this.loadTasks();
            
            // Close modal after a delay
            setTimeout(() => {
                this.closeImportModal();
            }, 3000);
            
        } catch (error) {
            console.error('Import error:', error);
            this.showNotification('Failed to import data: ' + error.message, 'error');
        } finally {
            importBtn.disabled = false;
            importBtn.textContent = 'Import Data';
        }
    }

    showImportResult(result) {
        const container = document.querySelector('.import-container');
        const existingMessage = container.querySelector('.import-message');
        
        if (existingMessage) {
            existingMessage.remove();
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `import-message ${result.success ? 'success' : 'error'}`;
        
        if (result.success) {
            messageDiv.innerHTML = `
                <div>${result.message}</div>
                <div class="import-stats">
                    <h5>Import Statistics:</h5>
                    <div class="stats-grid">
                        <div class="stat-row">
                            <span>Tasks:</span>
                            <span>${result.stats.tasks.imported} imported, ${result.stats.tasks.errors} errors</span>
                        </div>
                        <div class="stat-row">
                            <span>Notes:</span>
                            <span>${result.stats.notes.imported} imported, ${result.stats.notes.errors} errors</span>
                        </div>
                        <div class="stat-row">
                            <span>Subtasks:</span>
                            <span>${result.stats.subtasks.imported} imported, ${result.stats.subtasks.errors} errors</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            messageDiv.textContent = result.message || 'Import failed';
        }
        
        container.insertBefore(messageDiv, container.firstChild);
    }

    resetImportForm() {
        document.getElementById('clearExisting').checked = false;
        document.getElementById('importFile').value = '';
        document.getElementById('selectedFile').style.display = 'none';
        document.getElementById('fileUploadArea').style.display = 'block';
        document.getElementById('importPreview').style.display = 'none';
        document.getElementById('importBtn').disabled = true;
        
        const existingMessage = document.querySelector('.import-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        this.importData = null;
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            zIndex: '10000',
            maxWidth: '300px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease'
        });
        
        // Set background color based on type
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#3b82f6',
            warning: '#f59e0b'
        };
        notification.style.backgroundColor = colors[type] || colors.info;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after delay
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    // Manual sync method
    async manualSync() {
        try {
            this.showNotification('Syncing with iCloud...', 'info');
            await window.dataService.manualSync();
            this.showNotification('Sync completed successfully!', 'success');
        } catch (error) {
            console.error('Error during manual sync:', error);
            this.showNotification('Sync failed. Please try again.', 'error');
        }
    }
}

// Global functions for HTML onclick handlers
function openTaskModal(taskId = null) {
    if (window.app) {
        app.openTaskModal(taskId);
    }
}

function closeTaskModal() {
    app.closeTaskModal();
}

function closeNotesModal() {
    app.closeNotesModal();
}

function closePendingReasonModal() {
    app.closePendingReasonModal();
}

function addNote() {
    app.addNote();
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        window.app = new TodoApp();
        await window.app.init();
    } catch (error) {
        console.error('Error initializing app:', error);
    }
});