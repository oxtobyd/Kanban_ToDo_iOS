class TodoApp {
    constructor() {
        this.tasks = [];
        this.currentTaskId = null;
        this.currentPriority = '';
        this.currentSortBy = 'priority';
        this.currentSearch = '';
        this.currentIncludeTags = [];
        this.currentExcludeTags = [];
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
        this.swipeThreshold = 50; // Minimum distance for swipe
        this.swipeTimeout = null;
        // Mobile drag and drop properties
        this.isDragging = false;
        this.draggedTask = null;
        this.dragPreview = null;
        this.longPressTimer = null;
        this.longPressThreshold = 500; // 500ms for long press
        // Individual task expansion state
        this.expandedTasks = new Set();
        this.init();
    }

    async init() {
        console.log('TodoApp initializing...');
        
        // Check if import/export buttons exist
        const exportBtn = document.querySelector('.export-btn');
        const importBtn = document.querySelector('.import-btn');
        console.log('Export button found:', !!exportBtn);
        console.log('Import button found:', !!importBtn);
        
        await this.loadTags();
        await this.loadTasks();
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.setupTouchGestures();
        this.setupTagsInput();
        this.syncUIState();
        
        console.log('TodoApp initialized successfully');
    }

    async loadTasks(priority = null, sortBy = null, search = null, includeTags = null, excludeTags = null) {
        try {
            // Use provided values or keep current state
            if (priority !== null) this.currentPriority = priority;
            if (sortBy !== null) this.currentSortBy = sortBy;
            if (search !== null) this.currentSearch = search;
            if (includeTags !== null) this.currentIncludeTags = Array.isArray(includeTags) ? includeTags : (includeTags ? [includeTags] : []);
            if (excludeTags !== null) this.currentExcludeTags = Array.isArray(excludeTags) ? excludeTags : (excludeTags ? [excludeTags] : []);
            
            // Sync UI dropdowns with current state
            this.syncUIState();
            
            let url = '/api/tasks';
            const params = new URLSearchParams();
            
            if (this.currentPriority) params.append('priority', this.currentPriority);
            if (this.currentSortBy) params.append('sortBy', this.currentSortBy);
            if (this.currentSearch) params.append('search', this.currentSearch);
            if (this.currentIncludeTags && this.currentIncludeTags.length > 0) params.append('tags', this.currentIncludeTags.join(','));
            if (this.currentExcludeTags && this.currentExcludeTags.length > 0) params.append('excludeTags', this.currentExcludeTags.join(','));
            
            if (params.toString()) {
                url += '?' + params.toString();
            }
            
            const response = await fetch(url);
            this.tasks = await response.json();
            this.renderTasks();
        } catch (error) {
            console.error('Error loading tasks:', error);
        }
    }

    async loadTags() {
        try {
            const response = await fetch('/api/tags');
            this.availableTags = await response.json();
            this.updateTagFilter();
        } catch (error) {
            console.error('Error loading tags:', error);
        }
    }

    syncUIState() {
        // Update dropdown values to match current state
        const priorityFilter = document.getElementById('priorityFilter');
        const sortBy = document.getElementById('sortBy');
        const includeTagsFilter = document.getElementById('includeTagsFilter');
        const excludeTagsFilter = document.getElementById('excludeTagsFilter');
        const searchInput = document.getElementById('searchInput');
        const clearSearch = document.getElementById('clearSearch');
        
        if (priorityFilter) {
            priorityFilter.value = this.currentPriority;
            priorityFilter.classList.toggle('filter-active', !!this.currentPriority);
        }
        if (sortBy) sortBy.value = this.currentSortBy;
        if (includeTagsFilter) {
            // Sync options selection
            Array.from(includeTagsFilter.options).forEach(opt => {
                opt.selected = this.currentIncludeTags.includes(opt.value);
            });
            includeTagsFilter.classList.toggle('filter-active', this.currentIncludeTags.length > 0);
        }
        if (excludeTagsFilter) {
            Array.from(excludeTagsFilter.options).forEach(opt => {
                opt.selected = this.currentExcludeTags.includes(opt.value);
            });
            excludeTagsFilter.classList.toggle('filter-active', this.currentExcludeTags.length > 0);
        }
        if (searchInput) {
            searchInput.value = this.currentSearch;
            if (clearSearch) {
                clearSearch.style.display = this.currentSearch ? 'block' : 'none';
            }
        }
    }

    updateTagFilter() {
        const includeTagsFilter = document.getElementById('includeTagsFilter');
        const excludeTagsFilter = document.getElementById('excludeTagsFilter');
        if (!includeTagsFilter || !excludeTagsFilter) return;
        
        // Preserve current selections
        const prevInclude = new Set(this.currentIncludeTags);
        const prevExclude = new Set(this.currentExcludeTags);
        
        // Clear and rebuild include filter
        includeTagsFilter.innerHTML = '<option value="">Include tags…</option>';
        this.availableTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            option.selected = prevInclude.has(tag);
            includeTagsFilter.appendChild(option);
        });
        
        // Clear and rebuild exclude filter
        excludeTagsFilter.innerHTML = '<option value="">Exclude tags…</option>';
        this.availableTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            option.selected = prevExclude.has(tag);
            excludeTagsFilter.appendChild(option);
        });
    }

    handleSearch(searchTerm) {
        // Clear existing timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        
        // Debounce search to avoid too many API calls
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

    async filterByIncludeTags(tags) {
        this.currentIncludeTags = (Array.isArray(tags) ? tags : []).filter(Boolean);
        await this.loadTasks();
    }

    async filterByExcludeTags(tags) {
        this.currentExcludeTags = (Array.isArray(tags) ? tags : []).filter(Boolean);
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

    async createTaskHTML(task) {
        const createdDate = new Date(task.created_at).toLocaleDateString();
        const priorityClass = `priority-${task.priority || 'medium'}`;
        const priorityLabel = this.getPriorityLabel(task.priority || 'medium');
        
        // Highlight search terms
        let title = this.escapeHtml(task.title);
        let description = this.escapeHtml(task.description || '');
        
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
                    <div class="task-title" onclick="app.toggleTaskExpansion(${task.id})" title="Click to expand/collapse task details">${title}</div>
                    <div class="task-header-actions">
                        <div class="priority-badge priority-${task.priority || 'medium'}" onclick="app.showPriorityDropdown(event, ${task.id}, '${task.priority || 'medium'}')" title="Click to change priority">${priorityLabel}</div>
                        <div class="drag-handle">⋮⋮</div>
                    </div>
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
            if (e.target.classList.contains('task-card')) {
                e.target.classList.add('dragging');
                e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
                
                // Prevent text selection during drag
                document.body.style.userSelect = 'none';
                document.body.style.webkitUserSelect = 'none';
            }
        });

        document.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('task-card')) {
                e.target.classList.remove('dragging');
                
                // Re-enable text selection after drag
                document.body.style.userSelect = '';
                document.body.style.webkitUserSelect = '';
            }
        });

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            const taskList = e.target.closest('.task-list');
            if (taskList) {
                taskList.classList.add('drag-over');
            }
        });

        document.addEventListener('dragleave', (e) => {
            const taskList = e.target.closest('.task-list');
            if (taskList && !taskList.contains(e.relatedTarget)) {
                taskList.classList.remove('drag-over');
            }
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            const taskList = e.target.closest('.task-list');
            if (taskList) {
                taskList.classList.remove('drag-over');
                const taskId = e.dataTransfer.getData('text/plain');
                const newStatus = taskList.closest('.column').dataset.status;
                
                // If dropping into pending column, ask for reason
                if (newStatus === 'pending') {
                    this.showPendingReasonModal(taskId);
                } else {
                    this.updateTaskStatus(taskId, newStatus);
                }
            }
        });
    }

    setupTouchGestures() {
        document.addEventListener('touchstart', (e) => {
            const taskCard = e.target.closest('.task-card');
            if (!taskCard) return;

            this.touchStartX = e.touches[0].clientX;
            this.touchStartY = e.touches[0].clientY;
            this.touchEndX = this.touchStartX;
            this.touchEndY = this.touchStartY;
            this.isSwiping = false;
            
            // Long press detection for drag mode
            this.longPressTimer = setTimeout(() => {
                if (!this.isSwiping && !this.isDragging) {
                    this.enterDragMode(taskCard, e.touches[0]);
                }
            }, this.longPressThreshold);
            
            // Add visual feedback
            taskCard.classList.add('touch-active');
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            const taskCard = e.target.closest('.task-card');
            if (!taskCard) return;

            this.touchEndX = e.touches[0].clientX;
            this.touchEndY = e.touches[0].clientY;

            // Handle drag mode
            if (this.isDragging) {
                e.preventDefault();
                this.updateDragPosition(e.touches[0]);
                return;
            }

            const deltaX = this.touchEndX - this.touchStartX;
            const deltaY = this.touchEndY - this.touchStartY;

            // Cancel long press if user starts moving
            if (this.longPressTimer && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }

            // Check if this is a horizontal swipe (not vertical scroll)
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
                this.isSwiping = true;
                e.preventDefault(); // Prevent scrolling during swipe
                
                // Visual feedback during swipe
                const swipeProgress = Math.min(Math.abs(deltaX) / 100, 1);
                const direction = deltaX > 0 ? 'right' : 'left';
                
                taskCard.style.transform = `translateX(${deltaX * 0.3}px)`;
                taskCard.style.opacity = 1 - (swipeProgress * 0.3);
                
                // Add swipe direction class for visual feedback
                taskCard.classList.remove('swiping-left', 'swiping-right');
                taskCard.classList.add(`swiping-${direction}`);
            }
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            const taskCard = e.target.closest('.task-card');
            if (!taskCard) return;

            // Clear long press timer
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }

            // Handle drag end
            if (this.isDragging) {
                this.endDragMode(e);
                return;
            }

            taskCard.classList.remove('touch-active', 'swiping-left', 'swiping-right');
            
            // Reset visual state
            taskCard.style.transform = '';
            taskCard.style.opacity = '';

            if (this.isSwiping) {
                const deltaX = this.touchEndX - this.touchStartX;
                const deltaY = this.touchEndY - this.touchStartY;

                // Only process swipe if it's primarily horizontal and meets threshold
                if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > this.swipeThreshold) {
                    const taskId = taskCard.dataset.taskId;
                    const currentTask = this.tasks.find(t => t.id == taskId);
                    
                    if (currentTask) {
                        const newStatus = this.getNextStatus(currentTask.status, deltaX > 0);
                        if (newStatus !== currentTask.status) {
                            this.showSwipeAnimation(taskCard, deltaX > 0);
                            
                            // If swiping to pending, ask for reason
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
            // Swipe right: move forward in workflow
            return currentIndex < statusFlow.length - 1 ? statusFlow[currentIndex + 1] : currentStatus;
        } else {
            // Swipe left: move backward in workflow
            return currentIndex > 0 ? statusFlow[currentIndex - 1] : currentStatus;
        }
    }

    // Mobile drag and drop methods
    enterDragMode(taskCard, touch) {
        this.isDragging = true;
        this.draggedTask = taskCard;
        
        // Add haptic feedback if available
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
        
        // Create drag preview
        this.createDragPreview(taskCard, touch);
        
        // Add visual feedback
        taskCard.classList.add('mobile-dragging');
        
        // Highlight drop zones
        this.highlightDropZones();
        
        // Prevent scrolling
        document.body.style.overflow = 'hidden';
    }

    createDragPreview(taskCard, touch) {
        // Create a floating preview of the task
        this.dragPreview = taskCard.cloneNode(true);
        this.dragPreview.classList.add('drag-preview');
        this.dragPreview.style.position = 'fixed';
        this.dragPreview.style.pointerEvents = 'none';
        this.dragPreview.style.zIndex = '9999';
        this.dragPreview.style.transform = 'scale(1.1)';
        this.dragPreview.style.opacity = '0.9';
        this.dragPreview.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3)';
        
        // Position at touch point
        this.updateDragPreviewPosition(touch);
        
        document.body.appendChild(this.dragPreview);
        
        // Make original task semi-transparent
        taskCard.style.opacity = '0.3';
    }

    updateDragPosition(touch) {
        if (this.dragPreview) {
            this.updateDragPreviewPosition(touch);
            this.updateDropZoneHighlight(touch);
        }
    }

    updateDragPreviewPosition(touch) {
        if (this.dragPreview) {
            const rect = this.dragPreview.getBoundingClientRect();
            this.dragPreview.style.left = (touch.clientX - rect.width / 2) + 'px';
            this.dragPreview.style.top = (touch.clientY - rect.height / 2) + 'px';
        }
    }

    updateDropZoneHighlight(touch) {
        // Find which column the touch is over
        const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        const column = elementBelow?.closest('.column');
        
        // Remove previous highlights
        document.querySelectorAll('.column').forEach(col => {
            col.classList.remove('drag-over');
        });
        
        // Highlight current column if it's different from source
        if (column && column !== this.draggedTask.closest('.column')) {
            column.classList.add('drag-over');
        }
    }

    highlightDropZones() {
        // Add visual indicators to all columns except the source
        const sourceColumn = this.draggedTask.closest('.column');
        document.querySelectorAll('.column').forEach(column => {
            if (column !== sourceColumn) {
                column.classList.add('drop-zone-active');
            }
        });
    }

    endDragMode(touchEvent) {
        if (!this.isDragging) return;
        
        // Find drop target
        const elementBelow = document.elementFromPoint(this.touchEndX, this.touchEndY);
        const targetColumn = elementBelow?.closest('.column');
        
        // Check if dropped on a valid target
        if (targetColumn && targetColumn !== this.draggedTask.closest('.column')) {
            const taskId = this.draggedTask.dataset.taskId;
            const newStatus = targetColumn.dataset.status;
            
            // If dropping into pending column, ask for reason
            if (newStatus === 'pending') {
                this.showPendingReasonModal(taskId);
            } else {
                this.updateTaskStatus(taskId, newStatus);
            }
        }
        
        // Clean up drag mode
        this.cleanupDragMode();
    }

    cleanupDragMode() {
        // Remove drag preview
        if (this.dragPreview) {
            this.dragPreview.remove();
            this.dragPreview = null;
        }
        
        // Reset original task
        if (this.draggedTask) {
            this.draggedTask.classList.remove('mobile-dragging');
            this.draggedTask.style.opacity = '';
            this.draggedTask = null;
        }
        
        // Remove drop zone highlights
        document.querySelectorAll('.column').forEach(column => {
            column.classList.remove('drag-over', 'drop-zone-active');
        });
        
        // Re-enable scrolling
        document.body.style.overflow = '';
        
        // Reset drag state
        this.isDragging = false;
    }

    showSwipeAnimation(taskCard, swipeRight) {
        const direction = swipeRight ? 'right' : 'left';
        taskCard.classList.add(`swipe-${direction}`);
        
        // Show feedback message
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
            const response = await fetch(`/api/tasks/${taskId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    status: newStatus,
                    pending_on: pendingReason
                }),
            });

            if (response.ok) {
                await this.loadTasks();
            }
        } catch (error) {
            console.error('Error updating task status:', error);
        }
    }

    showPendingReasonModal(taskId) {
        this.pendingTaskId = taskId;
        const modal = document.getElementById('pendingReasonModal');
        const input = document.getElementById('pendingReasonInput');
        
        // Clear previous input
        input.value = '';
        
        // Show modal and focus input
        modal.style.display = 'block';
        setTimeout(() => input.focus(), 100);
        
        // Handle Enter key to save
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
        
        // Store the handler so we can remove it later
        input._enterHandler = handleEnter;
    }

    closePendingReasonModal() {
        const modal = document.getElementById('pendingReasonModal');
        const input = document.getElementById('pendingReasonInput');
        
        // Remove event listener
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

        // Validate pending reason if status is pending
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
            let response;
            if (this.currentTaskId) {
                response = await fetch(`/api/tasks/${this.currentTaskId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(taskData),
                });
            } else {
                response = await fetch('/api/tasks', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(taskData),
                });
            }

            if (response.ok) {
                await this.loadTags(); // Refresh available tags
                await this.loadTasks();
                this.closeTaskModal();
            }
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
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                await this.loadTasks();
            }
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    }

    toggleTaskExpansion(taskId) {
        const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
        const expandBtn = taskCard.querySelector('.task-expand-btn');
        
        if (this.expandedTasks.has(taskId)) {
            // Collapse the task
            this.expandedTasks.delete(taskId);
            taskCard.classList.remove('expanded');
            expandBtn.classList.remove('expanded');
        } else {
            // Expand the task
            this.expandedTasks.add(taskId);
            taskCard.classList.add('expanded');
            expandBtn.classList.add('expanded');
        }
    }

    showPriorityDropdown(event, taskId, currentPriority) {
        event.stopPropagation();
        
        // Remove any existing dropdown
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
        
        // Position dropdown
        const rect = badge.getBoundingClientRect();
        dropdown.style.position = 'absolute';
        dropdown.style.top = (rect.bottom + window.scrollY + 5) + 'px';
        dropdown.style.left = (rect.left + window.scrollX) + 'px';
        dropdown.style.zIndex = '1000';
        
        document.body.appendChild(dropdown);
        
        // Close dropdown when clicking outside
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
            const response = await fetch(`/api/tasks/${taskId}/priority`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ priority: newPriority }),
            });

            if (response.ok) {
                await this.loadTasks();
            } else {
                console.error('Failed to update priority:', response.status, response.statusText);
            }
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
            const response = await fetch(`/api/tasks/${taskId}/notes`);
            const notes = await response.json();
            this.renderNotes(notes);
        } catch (error) {
            console.error('Error loading notes:', error);
        }
    }

    renderNotes(notes) {
        const notesList = document.getElementById('notesList');
        notesList.innerHTML = notes.map(note => `
            <div class="note-item" data-note-id="${note.id}">
                <div class="note-content" id="note-content-${note.id}">${this.escapeHtml(note.content)}</div>
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
            const response = await fetch(`/api/tasks/${this.currentTaskId}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content }),
            });

            if (response.ok) {
                document.getElementById('newNote').value = '';
                await this.loadNotes(this.currentTaskId);
            }
        } catch (error) {
            console.error('Error adding note:', error);
        }
    }

    editNote(noteId, currentContent) {
        // If already editing a note, save it first
        if (this.editingNoteId && this.editingNoteId !== noteId) {
            this.saveNote(this.editingNoteId);
        }

        this.editingNoteId = noteId;
        const contentDiv = document.getElementById(`note-content-${noteId}`);
        const noteItem = document.querySelector(`[data-note-id="${noteId}"]`);
        
        // Replace content with textarea
        contentDiv.innerHTML = `
            <textarea class="note-edit-textarea" id="note-edit-${noteId}" rows="3">${currentContent}</textarea>
            <div class="note-edit-actions">
                <button class="note-save-btn" onclick="app.saveNote(${noteId})">Save</button>
                <button class="note-cancel-btn" onclick="app.cancelEditNote(${noteId}, '${currentContent.replace(/'/g, "\\'")}')">Cancel</button>
            </div>
        `;
        
        // Focus the textarea
        const textarea = document.getElementById(`note-edit-${noteId}`);
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        
        // Add editing class for styling
        noteItem.classList.add('editing');
        
        // Handle Enter key to save (Shift+Enter for new line)
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.saveNote(noteId);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelEditNote(noteId, currentContent);
            }
        });
    }

    async saveNote(noteId) {
        const textarea = document.getElementById(`note-edit-${noteId}`);
        const newContent = textarea.value.trim();
        
        if (!newContent) {
            alert('Note content cannot be empty');
            return;
        }

        try {
            const response = await fetch(`/api/notes/${noteId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: newContent }),
            });

            if (response.ok) {
                this.editingNoteId = null;
                await this.loadNotes(this.currentTaskId);
            } else {
                alert('Failed to update note');
            }
        } catch (error) {
            console.error('Error updating note:', error);
            alert('Error updating note');
        }
    }

    cancelEditNote(noteId, originalContent) {
        this.editingNoteId = null;
        const contentDiv = document.getElementById(`note-content-${noteId}`);
        const noteItem = document.querySelector(`[data-note-id="${noteId}"]`);
        
        // Restore original content
        contentDiv.innerHTML = this.escapeHtml(originalContent);
        noteItem.classList.remove('editing');
    }

    async deleteNote(noteId) {
        if (!confirm('Are you sure you want to delete this note?')) return;

        try {
            const response = await fetch(`/api/notes/${noteId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                await this.loadNotes(this.currentTaskId);
            } else {
                alert('Failed to delete note');
            }
        } catch (error) {
            console.error('Error deleting note:', error);
            alert('Error deleting note');
        }
    }

    // Sub-tasks functionality
    async renderSubtasks(taskId) {
        try {
            const response = await fetch(`/api/tasks/${taskId}/subtasks`);
            const subtasks = await response.json();
            
            const completedCount = subtasks.filter(st => st.completed).length;
            const totalCount = subtasks.length;
            
            const subtasksListHTML = subtasks.map(subtask => `
                <div class="subtask-item" data-subtask-id="${subtask.id}">
                    <div class="subtask-checkbox ${subtask.completed ? 'completed' : ''}" 
                         onclick="app.toggleSubtask(${subtask.id})">
                        ${subtask.completed ? '✓' : ''}
                    </div>
                    <div class="subtask-text ${subtask.completed ? 'completed' : ''}" 
                         id="subtask-text-${subtask.id}">${this.escapeHtml(subtask.title)}</div>
                    <div class="subtask-actions">
                        <button class="subtask-edit-btn" onclick="app.editSubtask(${subtask.id}, '${this.escapeHtml(subtask.title).replace(/'/g, "\\'")}')">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="subtask-delete-btn" onclick="app.deleteSubtask(${subtask.id})">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            `).join('');
            
            // Always show the sub-tasks section, even if empty
            const summaryHTML = totalCount > 0 ? `<div class="subtasks-summary">${completedCount}/${totalCount}</div>` : '';
            
            const html = `
                <div class="subtasks-section">
                    <div class="subtasks-header" onclick="app.toggleSubtasksList(${taskId})">
                        <div class="subtasks-toggle" id="subtasks-toggle-${taskId}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9,18 15,12 9,6"></polyline>
                            </svg>
                            Sub-tasks
                        </div>
                        ${summaryHTML}
                    </div>
                    <div class="subtasks-list expanded" id="subtasks-list-${taskId}">
                        ${subtasksListHTML}
                        <div class="add-subtask">
                            <input type="text" id="new-subtask-${taskId}" placeholder="Add sub-task..." 
                                   onkeypress="if(event.key==='Enter') app.addSubtask(${taskId})">
                            <button onclick="app.addSubtask(${taskId})">Add</button>
                        </div>
                    </div>
                </div>
            `;
            
            // Auto-expand the toggle icon
            setTimeout(() => {
                const toggle = document.getElementById(`subtasks-toggle-${taskId}`);
                if (toggle) toggle.classList.add('expanded');
            }, 50);
            
            return html;
        } catch (error) {
            console.error('Error loading subtasks:', error);
            return '';
        }
    }

    toggleSubtasksList(taskId) {
        const toggle = document.getElementById(`subtasks-toggle-${taskId}`);
        const list = document.getElementById(`subtasks-list-${taskId}`);
        
        if (list.classList.contains('expanded')) {
            list.classList.remove('expanded');
            toggle.classList.remove('expanded');
        } else {
            list.classList.add('expanded');
            toggle.classList.add('expanded');
        }
    }

    // Auto-expand sub-tasks section after rendering
    autoExpandSubtasks(taskId) {
        setTimeout(() => {
            const toggle = document.getElementById(`subtasks-toggle-${taskId}`);
            const list = document.getElementById(`subtasks-list-${taskId}`);
            
            if (toggle && list) {
                list.classList.add('expanded');
                toggle.classList.add('expanded');
            }
        }, 100);
    }

    async addSubtask(taskId) {
        const input = document.getElementById(`new-subtask-${taskId}`);
        const title = input.value.trim();
        
        if (!title) return;
        
        try {
            const response = await fetch(`/api/tasks/${taskId}/subtasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title }),
            });
            
            if (response.ok) {
                input.value = '';
                await this.loadTasks(); // Refresh to update subtasks
            }
        } catch (error) {
            console.error('Error adding subtask:', error);
        }
    }

    async toggleSubtask(subtaskId) {
        try {
            const response = await fetch(`/api/subtasks/${subtaskId}/toggle`, {
                method: 'PATCH',
            });
            
            if (response.ok) {
                await this.loadTasks(); // Refresh to update subtasks
            }
        } catch (error) {
            console.error('Error toggling subtask:', error);
        }
    }

    editSubtask(subtaskId, currentTitle) {
        const textElement = document.getElementById(`subtask-text-${subtaskId}`);
        const originalHTML = textElement.innerHTML;
        
        textElement.innerHTML = `
            <input type="text" class="subtask-edit-input" value="${currentTitle}" 
                   onblur="app.saveSubtaskEdit(${subtaskId}, this.value, '${originalHTML}')"
                   onkeypress="if(event.key==='Enter') this.blur(); if(event.key==='Escape') app.cancelSubtaskEdit(${subtaskId}, '${originalHTML}')"
                   autofocus>
        `;
        
        const input = textElement.querySelector('input');
        input.focus();
        input.select();
    }

    async saveSubtaskEdit(subtaskId, newTitle, originalHTML) {
        const textElement = document.getElementById(`subtask-text-${subtaskId}`);
        const title = newTitle.trim();
        
        if (!title) {
            textElement.innerHTML = originalHTML;
            return;
        }
        
        try {
            const response = await fetch(`/api/subtasks/${subtaskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title, completed: false }),
            });
            
            if (response.ok) {
                await this.loadTasks(); // Refresh to update subtasks
            } else {
                textElement.innerHTML = originalHTML;
            }
        } catch (error) {
            console.error('Error updating subtask:', error);
            textElement.innerHTML = originalHTML;
        }
    }

    cancelSubtaskEdit(subtaskId, originalHTML) {
        const textElement = document.getElementById(`subtask-text-${subtaskId}`);
        textElement.innerHTML = originalHTML;
    }

    async deleteSubtask(subtaskId) {
        if (!confirm('Are you sure you want to delete this sub-task?')) return;
        
        try {
            const response = await fetch(`/api/subtasks/${subtaskId}`, {
                method: 'DELETE',
            });
            
            if (response.ok) {
                await this.loadTasks(); // Refresh to update subtasks
            }
        } catch (error) {
            console.error('Error deleting subtask:', error);
        }
    }

    // Import/Export methods
    async exportData() {
        try {
            let exportData;
            
            if (window.dataService) {
                // Client-side export (Capacitor/localStorage)
                exportData = await window.dataService.exportData();
            } else {
                // Server-side export
                const response = await fetch('/api/export');
                if (!response.ok) {
                    throw new Error('Failed to export data');
                }
                exportData = await response.json();
            }
            
            // Create and download file
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
                type: 'application/json' 
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `kanban-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showNotification('Data exported successfully!', 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('Failed to export data: ' + error.message, 'error');
        }
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
            
            let result;
            
            if (window.dataService) {
                // Client-side import (Capacitor/localStorage)
                result = await window.dataService.importData(this.importData, { clearExisting });
            } else {
                // Server-side import
                const response = await fetch('/api/import', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        data: this.importData.data,
                        options: { clearExisting }
                    }),
                });
                
                if (!response.ok) {
                    throw new Error('Failed to import data');
                }
                
                result = await response.json();
            }
            
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

    openPrintModal() {
        const modal = document.getElementById('printModal');
        if (modal) modal.style.display = 'block';
    }

    closePrintModal() {
        const modal = document.getElementById('printModal');
        if (modal) modal.style.display = 'none';
    }

    async previewSelected() {
        const columns = ['todo', 'in_progress', 'pending', 'done'];
        const include = columns.filter(c => {
            const cb = document.getElementById(`print-col-${c}`);
            return cb ? cb.checked : false;
        });
        const compact = !!document.getElementById('print-compact')?.checked;
        this.closePrintModal();
        await this.generateAndPrint(include, compact);
    }

    async exportPdfSelected() {
        const columns = ['todo', 'in_progress', 'pending', 'done'];
        const include = columns.filter(c => document.getElementById(`print-col-${c}`)?.checked);
        const compact = !!document.getElementById('print-compact')?.checked;
        this.closePrintModal();
        await this.generatePdf(include, compact);
    }

    async generateAndPrint(includeStatuses, compact = false) {
        if (!includeStatuses || includeStatuses.length === 0) {
            this.showNotification('Please select at least one column to print.', 'warning');
            return;
        }
        // Build a printable document in-place (better for iOS WebView)
        const printable = document.createElement('div');
        printable.id = 'print-root';
        printable.style.padding = '24px';
        printable.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
        printable.innerHTML = `
            <style>
                @media print {
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    body * { visibility: hidden !important; }
                    #print-root, #print-root * { visibility: visible !important; }
                    #print-root { position: absolute; left: 0; top: 0; width: 100%; }
                }
                .pr-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
                .pr-title { font-size:20px; font-weight:700; }
                .pr-sub { color:#64748b; font-size:12px; }
                .pr-columns { display:grid; grid-template-columns: repeat(auto-fit, minmax(${compact ? '220' : '260'}px, 1fr)); gap:${compact ? '10' : '16'}px; }
                .pr-col { border:1px solid #e5e7eb; border-radius:8px; padding:${compact ? '8' : '12'}px; background:#fff; }
                .pr-col h3 { margin:0 0 ${compact ? '6' : '8'}px; font-size:${compact ? '12' : '13'}px; text-transform:uppercase; letter-spacing:.04em; color:#475569; }
                .pr-task { border:1px solid #e5e7eb; border-radius:8px; padding:${compact ? '8' : '10'}px; margin:${compact ? '6' : '8'}px 0; background:#fff; }
                .pr-task .pr-title { font-size:${compact ? '12.5' : '14'}px; font-weight:600; }
                .pr-desc { color:#334155; font-size:${compact ? '11' : '12'}px; margin-top:${compact ? '2' : '4'}px; white-space:pre-wrap; }
                .pr-tags { margin-top:6px; display:flex; flex-wrap:wrap; gap:6px; }
                .pr-tag { border:1px solid #c7d2fe; color:#4f46e5; border-radius:999px; padding:${compact ? '1' : '2'}px ${compact ? '4' : '6'}px; font-size:${compact ? '9' : '10'}px; }
                .pr-subtasks { margin-top:${compact ? '6' : '8'}px; }
                .pr-subtasks .pr-subtitle { font-size:${compact ? '11' : '12'}px; font-weight:600; margin-bottom:${compact ? '2' : '4'}px; }
                .pr-subtasks ul { margin:0; padding-left:16px; }
                .pr-subtasks li { font-size:${compact ? '11' : '12'}px; margin:${compact ? '1' : '2'}px 0; }
                .pr-meta { margin-top:${compact ? '4' : '6'}px; color:#64748b; font-size:${compact ? '9' : '10'}px; }
            </style>
        `;

        const header = document.createElement('div');
        header.className = 'pr-header';
        header.innerHTML = `<div class="pr-title">Kanban Tasks</div><div class="pr-sub">Printed ${new Date().toLocaleString()}</div>`;
        printable.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'pr-columns';

        for (const status of includeStatuses) {
            const colDiv = document.createElement('div');
            colDiv.className = 'pr-col';
            const statusLabelMap = { todo: 'To Do', in_progress: 'In Progress', pending: 'Pending', done: 'Done' };
            colDiv.innerHTML = `<h3>${statusLabelMap[status] || status}</h3>`;

            const tasks = this.tasks.filter(t => t.status === status);
            // For subtasks, we need to fetch them. We'll inline fetch sequentionally to keep it simple.
            for (const task of tasks) {
                const taskDiv = document.createElement('div');
                taskDiv.className = 'pr-task';
                const created = new Date(task.created_at).toLocaleDateString();
                const tagsHTML = (task.tags || []).map(t => `<span class="pr-tag">${this.escapeHtml(t)}</span>`).join('');
                let subtasksHTML = '';
                try {
                    const resp = await fetch(`/api/tasks/${task.id}/subtasks`);
                    const subtasks = await resp.json();
                    if (Array.isArray(subtasks) && subtasks.length) {
                        subtasksHTML = `
                            <div class="pr-subtasks">
                                <div class="pr-subtitle">Sub-tasks</div>
                                <ul>
                                    ${subtasks.map(st => `<li>${st.completed ? '✅ ' : '⬜️ '}${this.escapeHtml(st.title)}</li>`).join('')}
                                </ul>
                            </div>`;
                    }
                } catch(_) {}

                taskDiv.innerHTML = `
                    <div class="pr-title">${this.escapeHtml(task.title)}</div>
                    ${task.description ? `<div class="pr-desc">${this.escapeHtml(task.description)}</div>` : ''}
                    ${(task.tags && task.tags.length) ? `<div class="pr-tags">${tagsHTML}</div>` : ''}
                    ${subtasksHTML}
                    <div class="pr-meta">Priority: ${this.escapeHtml(task.priority || 'medium')} • Created: ${created}</div>
                `;
                colDiv.appendChild(taskDiv);
            }

            grid.appendChild(colDiv);
        }

        printable.appendChild(grid);

        // Inject and print
        document.body.appendChild(printable);
        setTimeout(() => {
            try { window.print(); } finally {
                setTimeout(() => { if (printable && printable.parentNode) printable.parentNode.removeChild(printable); }, 300);
            }
        }, 50);
    }

    async generatePdf(includeStatuses, compact = false) {
        if (!includeStatuses || includeStatuses.length === 0) {
            this.showNotification('Please select at least one column to export.', 'warning');
            return;
        }
        // Reuse the on-page print DOM for consistent layout
        await this.generateAndPrint(includeStatuses, compact);
        const printable = document.getElementById('print-root');
        if (!printable) return;
        try {
            const canvas = await html2canvas(printable, { scale: 2, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'pt', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = pageWidth - 40; // margins
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let y = 20;
            if (imgHeight < pageHeight - 40) {
                pdf.addImage(imgData, 'JPEG', 20, y, imgWidth, imgHeight);
            } else {
                // Split across pages
                let position = 0;
                const sliceHeight = (canvas.width * (pageHeight - 40)) / imgWidth;
                while (position < canvas.height) {
                    const sliceCanvas = document.createElement('canvas');
                    sliceCanvas.width = canvas.width;
                    sliceCanvas.height = Math.min(sliceHeight, canvas.height - position);
                    const ctx = sliceCanvas.getContext('2d');
                    ctx.drawImage(canvas, 0, position, canvas.width, sliceCanvas.height, 0, 0, sliceCanvas.width, sliceCanvas.height);
                    const sliceImg = sliceCanvas.toDataURL('image/jpeg', 0.95);
                    if (position > 0) pdf.addPage();
                    pdf.addImage(sliceImg, 'JPEG', 20, 20, imgWidth, (sliceCanvas.height * imgWidth) / sliceCanvas.width);
                    position += sliceHeight;
                }
            }
            // Cleanup print DOM before saving
            if (printable && printable.parentNode) printable.parentNode.removeChild(printable);
            pdf.save(`kanban-tasks-${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (e) {
            console.error('PDF export failed:', e);
            this.showNotification('PDF export failed', 'error');
        }
    }
}

// Global functions for HTML onclick handlers
function openTaskModal() {
    app.openTaskModal();
}

function closeTaskModal() {
    app.closeTaskModal();
}

function closeNotesModal() {
    app.closeNotesModal();
}

function addNote() {
    app.addNote();
}

function closePendingReasonModal() {
    app.closePendingReasonModal();
}

function savePendingReason() {
    app.savePendingReason();
}

// Initialize the app
const app = new TodoApp();