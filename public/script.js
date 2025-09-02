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
        this.swipeThreshold = 50; // Minimum distance for swipe
        this.swipeTimeout = null;
        this.init();
    }

    async init() {
        await this.loadTags();
        await this.loadTasks();
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.setupTouchGestures();
        this.setupTagsInput();
        this.syncUIState();
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
            
            let url = '/api/tasks';
            const params = new URLSearchParams();
            
            if (this.currentPriority) params.append('priority', this.currentPriority);
            if (this.currentSortBy) params.append('sortBy', this.currentSortBy);
            if (this.currentSearch) params.append('search', this.currentSearch);
            if (this.currentTag) params.append('tag', this.currentTag);
            
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
            }
        });

        document.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('task-card')) {
                e.target.classList.remove('dragging');
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
            this.isSwiping = false;
            
            // Add visual feedback
            taskCard.classList.add('touch-active');
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            const taskCard = e.target.closest('.task-card');
            if (!taskCard) return;

            this.touchEndX = e.touches[0].clientX;
            this.touchEndY = e.touches[0].clientY;

            const deltaX = this.touchEndX - this.touchStartX;
            const deltaY = this.touchEndY - this.touchStartY;

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