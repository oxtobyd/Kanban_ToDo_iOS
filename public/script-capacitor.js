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
        this.columnStates = this.loadColumnStates();
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
        // Mobile drag and drop properties
        this.draggedTask = null;
        this.dragPreview = null;
        this.longPressTimer = null;
        this.longPressThreshold = 500; // 500ms for long press
        this.hasMoved = false;
        this.initialTouch = null;
        // Individual task expansion state
        this.expandedTasks = new Set();
    }

    setupNotesInteractions() {
        const list = document.getElementById('notesList');
        if (!list) return;
        list.addEventListener('click', (e) => {
            const editBtn = e.target.closest && (e.target.closest('.edit-note-btn') || e.target.closest('.note-edit-btn'));
            if (editBtn) {
                const item = e.target.closest('.note-item');
                if (!item) return;
                const noteId = parseInt(item.getAttribute('data-note-id'), 10);
                if (!Number.isFinite(noteId)) return;
                // Prefer inline edit UI if available; fallback to prompt-based version
                if (typeof this.editNote === 'function' && this.editNote.length === 1) {
                    this.editNote(noteId);
                } else {
                    const contentEl = item.querySelector(`#note-content-${noteId}`);
                    const current = contentEl ? contentEl.textContent : '';
                    this.editNote(noteId, current);
                }
            }
        });
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

        // Prepare Haptics plugin if present
        this.haptics = (window.Capacitor && (window.Capacitor.Plugins && (window.Capacitor.Plugins.Haptics || window.Capacitor.Plugins.HapticsPlugin))) || null;

        // Initialize data service
        await window.dataService.init();
        // Bust any cached assets by appending a cache-busting param to fetches if needed
        
        // Apply saved theme
        try {
            const savedTheme = localStorage.getItem('ui-theme');
            if (savedTheme === 'dark' || savedTheme === 'light') {
                document.body.setAttribute('data-theme', savedTheme);
            }
        } catch (_) {}

        await this.loadTags();
        await this.loadTasks();
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.setupTouchGestures();
        this.setupTagsInput();
        this.setupFileDragAndDrop();
        this.setupNotesInteractions();
        this.applyColumnStates();
        this.syncUIState();
        this.setupMobileUI();
        this.updateThemeToggleVisual();
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

    toggleTheme() {
        const current = document.body.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', next);
        try { localStorage.setItem('ui-theme', next); } catch (_) {}
        this.updateThemeToggleVisual();
        this.hapticImpact('light');
    }

    updateThemeToggleVisual() {
        const btn = document.getElementById('themeToggleBtn');
        if (!btn) return;
        const theme = document.body.getAttribute('data-theme') || 'light';
        btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
        btn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    }

    async hapticImpact(style = 'medium') {
        try {
            const H = (this.haptics || (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics));
            if (!H) return;
            if (H.impact) {
                await H.impact({ style: style.toUpperCase() });
            } else if (H.selectionChanged) {
                await H.selectionChanged();
            }
        } catch (_) {}
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

            // Delegate to centralized data service manual sync, which uses the proper iCloud plugin
            if (window.dataService && window.dataService.manualSync) {
                await window.dataService.manualSync();
            } else {
                console.error('Data service manualSync not available');
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

    async loadTasks(priority = null, sortBy = null, search = null, includeTags = null, excludeTags = null, forceRefresh = false) {
        try {
            // Check if user is actively typing in an input field
            const activeElement = document.activeElement;
            const isTypingInInput = activeElement && (
                activeElement.tagName === 'INPUT' || 
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.contentEditable === 'true'
            );
            
            // If user is typing and this isn't a forced refresh, skip the refresh
            if (isTypingInInput && !forceRefresh) {
                console.log('Skipping UI refresh - user is typing in input field');
                return;
            }
            
            // Use provided values or keep current state
            if (priority !== null) this.currentPriority = priority;
            if (sortBy !== null) this.currentSortBy = sortBy;
            if (search !== null) this.currentSearch = search;
            if (includeTags !== null) this.currentIncludeTags = Array.isArray(includeTags) ? includeTags : (includeTags ? [includeTags] : []);
            if (excludeTags !== null) this.currentExcludeTags = Array.isArray(excludeTags) ? excludeTags : (excludeTags ? [excludeTags] : []);
            
            // Sync UI dropdowns with current state
            this.syncUIState();
            
            const filters = {
                priority: this.currentPriority || undefined,
                sortBy: this.currentSortBy,
                search: this.currentSearch || undefined,
                includeTags: this.currentIncludeTags,
                excludeTags: this.currentExcludeTags
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
        const prevInclude = new Set(this.currentIncludeTags || []);
        const prevExclude = new Set(this.currentExcludeTags || []);
        includeTagsFilter.innerHTML = '<option value="">Include tags…</option>';
        this.availableTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            option.selected = prevInclude.has(tag);
            includeTagsFilter.appendChild(option);
        });
        excludeTagsFilter.innerHTML = '<option value="">Exclude tags…</option>';
        this.availableTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            option.selected = prevExclude.has(tag);
            excludeTagsFilter.appendChild(option);
        });
        
        // Update floating tag filter if it exists and is visible
        if (this.isDesktop()) {
            const floatingFilter = document.getElementById('floatingTagFilter');
            if (floatingFilter && floatingFilter.style.display !== 'none') {
                this.updateFloatingTagFilter();
            }
        }
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
        const isExpanded = this.expandedTasks && this.expandedTasks.has(task.id);
        
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
            <div class="task-card ${priorityClass} ${isExpanded ? 'expanded' : ''}" draggable="true" data-task-id="${task.id}">
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
            // Escape, then inline onclick so the anchor itself is clickable anywhere
            const safeText = this.escapeHtml(fileName).replace(/"/g, '&quot;');
            const safeUri = this.escapeHtml(cleanUri).replace(/"/g, '&quot;');
            const linkHtml = `<a class="file-link" href="#" title="${safeText}" onclick="app.openFile('${safeUri}','${safeText}'); return false;">📎 ${safeText}</a>`;
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
            return `<a class="file-link" href="${href}" target="_blank" rel="noopener">${url}</a>`;
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

    getMimeTypeFromFileName(fileName) {
        const ext = (fileName || '').split('.').pop().toLowerCase();
        const map = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'ppt': 'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'txt': 'text/plain',
            'rtf': 'application/rtf',
            'csv': 'text/csv',
            'json': 'application/json',
            'zip': 'application/zip',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'heic': 'image/heic',
            'svg': 'image/svg+xml',
            'md': 'text/markdown'
        };
        return map[ext] || '';
    }

    async openFile(fileUri, fileName) {
        try {
            // Debounce to avoid double-invocation on Mac Catalyst
            if (this._openingFile) {
                return;
            }
            this._openingFile = true;
            const decodedUri = decodeURIComponent(String(fileUri || ''));
            const nameFromUri = decodedUri.split('/').pop() || fileName || 'file';
            const contentType = this.getMimeTypeFromFileName(nameFromUri);
            const plugins = (window.Capacitor && window.Capacitor.Plugins) || {};
            const isCatalyst = !!(window.Capacitor && typeof window.Capacitor.getPlatform === 'function' && window.Capacitor.getPlatform() === 'ios' && /Macintosh/.test(navigator.userAgent));

            // If we saved under Documents, prefer resolving via Filesystem to ensure sandbox-safe URL
            const fileNameOnly = nameFromUri;
            if (plugins.Filesystem) {
                try {
                    const { uri } = await plugins.Filesystem.getUri({ path: fileNameOnly, directory: 'DOCUMENTS' });
                    if (plugins.App && plugins.App.openUrl) {
                        await plugins.App.openUrl({ url: uri });
                        this.showNotification(`Opening ${fileNameOnly}...`, 'success');
                        return;
                    }
                    if (isCatalyst) {
                        try { window.open(uri, '_blank'); return; } catch(_) {}
                    }
                } catch (_) {}
            }

            // FileViewer expects a local filesystem path (no file:// scheme)
            if (!isCatalyst && plugins.FileViewer && plugins.FileViewer.openDocumentFromLocalPath) {
                try {
                    const localPath = decodedUri.startsWith('file://') ? decodedUri.replace(/^file:\/\//, '') : decodedUri;
                    await plugins.FileViewer.openDocumentFromLocalPath({ path: localPath, mimeType: contentType || undefined });
                    this.showNotification(`Opening ${nameFromUri}...`, 'success');
                    return;
                } catch (_) {}
            }

            // Try FileOpener with explicit contentType and full URI
            if (!isCatalyst && plugins.FileOpener && plugins.FileOpener.openFile) {
                try {
                    await plugins.FileOpener.openFile({ path: decodedUri, contentType: contentType || undefined });
                    this.showNotification(`Opening ${nameFromUri}...`, 'success');
                    return;
                } catch (_) {}
            }

            // (Share dialog intentionally disabled to open directly in app)

            // Last fallback: browser open
            try { window.open(decodedUri, '_blank'); } catch(_) {}
            this.showNotification(`Opening ${nameFromUri}...`, 'success');
        } catch (error) {
            console.error('Error opening file:', error);
            this.showNotification(`Could not open ${fileName}: ${error.message}`, 'error');
        } finally {
            setTimeout(() => { this._openingFile = false; }, 500);
        }
    }

    handleDescriptionLinkClick(event) {
        try {
            const anchor = event.target.closest('a.file-link');
            if (!anchor) return;
            event.preventDefault();
            const uri = anchor.getAttribute('data-file-uri') || anchor.getAttribute('href');
            const name = anchor.getAttribute('data-file-name') || anchor.textContent || 'file';
            if (uri && uri.startsWith('file:')) {
                this.openFile(uri, name);
            }
        } catch (_) {}
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

        // Setup collapse/expand toggle listeners
        document.querySelectorAll('.collapse-toggle').forEach(button => {
            button.addEventListener('click', (e) => {
                const status = e.target.closest('.collapse-toggle').dataset.status;
                this.toggleColumnCollapse(status);
            });
        });

        // Global Escape-to-close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeTaskModal();
                this.closeNotesModal();
                this.closePendingReasonModal();
                this.closePrintModal && this.closePrintModal();
                const mobileSearch = document.getElementById('mobileSearch');
                if (mobileSearch && mobileSearch.style.display !== 'none') {
                    this.toggleMobileSearch();
                }
            }
            // Arrow key navigation for bottom tabs on mobile
            if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
                const order = ['todo','in_progress','pending','done'];
                const idx = order.indexOf(this.mobileColumn);
                if (e.key === 'ArrowRight') {
                    const next = order[(idx + 1) % order.length];
                    this.setMobileColumn(next);
                } else if (e.key === 'ArrowLeft') {
                    const prev = order[(idx - 1 + order.length) % order.length];
                    this.setMobileColumn(prev);
                }
            }
        });

        // Tab semantics for mobile bottom bar
        const tabList = document.getElementById('mobileBottomBar');
        if (tabList) {
            tabList.addEventListener('click', (e) => {
                const btn = e.target.closest('.mobile-segment');
                if (!btn) return;
                const col = btn.getAttribute('data-col');
                this.setMobileColumn(col);
                this.updateAriaForTabs();
            });
        }

        // Initialize ARIA selected states
        this.updateAriaForTabs();
    }

    updateAriaForTabs() {
        const tabs = document.querySelectorAll('.mobile-segment[role="tab"]');
        tabs.forEach(tab => {
            const selected = tab.getAttribute('data-col') === this.mobileColumn;
            tab.setAttribute('aria-selected', selected ? 'true' : 'false');
            tab.tabIndex = selected ? 0 : -1;
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

    // Column collapse/expand functionality
    loadColumnStates() {
        try {
            const saved = localStorage.getItem('kanban-column-states');
            return saved ? JSON.parse(saved) : {
                todo: false,
                in_progress: false,
                pending: false,
                done: false
            };
        } catch (error) {
            console.error('Error loading column states:', error);
            return {
                todo: false,
                in_progress: false,
                pending: false,
                done: false
            };
        }
    }

    saveColumnStates() {
        try {
            localStorage.setItem('kanban-column-states', JSON.stringify(this.columnStates));
        } catch (error) {
            console.error('Error saving column states:', error);
        }
    }

    toggleColumnCollapse(status) {
        this.columnStates[status] = !this.columnStates[status];
        this.updateColumnCollapseState(status);
        this.saveColumnStates();
    }

    updateColumnCollapseState(status) {
        const column = document.querySelector(`[data-status="${status}"]`);
        const toggleButton = document.querySelector(`[data-status="${status}"].collapse-toggle`);
        
        if (this.columnStates[status]) {
            column.classList.add('collapsed');
            toggleButton.classList.add('collapsed');
        } else {
            column.classList.remove('collapsed');
            toggleButton.classList.remove('collapsed');
        }
    }

    applyColumnStates() {
        Object.keys(this.columnStates).forEach(status => {
            this.updateColumnCollapseState(status);
        });
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
                
                // Additional text selection prevention
                document.body.style.userSelect = 'none';
                document.body.style.webkitUserSelect = 'none';
            }
        });

        document.addEventListener('dragend', (e) => {
            const card = e.target.closest('.task-card');
            if (card) {
                card.classList.remove('dragging');
                this.isDragging = false;
                document.body.classList.remove('no-text-select');
                
                // Re-enable text selection after drag
                document.body.style.userSelect = '';
                document.body.style.webkitUserSelect = '';
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
            this.touchEndX = this.touchStartX;
            this.touchEndY = this.touchStartY;
            this.isSwiping = false;
            this.hasMoved = false;
            
            // Store the initial touch for drag mode detection
            this.initialTouch = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
                time: Date.now()
            };
            
            taskCard.classList.add('touch-active');
        }, { passive: false });

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
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            // Mark as moved if distance is significant
            if (distance > 5) {
                this.hasMoved = true;
            }

            // Check for drag mode activation (hold + move)
            if (this.initialTouch && !this.isDragging && !this.isSwiping) {
                const timeHeld = Date.now() - this.initialTouch.time;
                const distanceMoved = Math.sqrt(
                    Math.pow(e.touches[0].clientX - this.initialTouch.x, 2) + 
                    Math.pow(e.touches[0].clientY - this.initialTouch.y, 2)
                );
                
                // If held for 300ms and moved more than 10px, enter drag mode
                if (timeHeld > 300 && distanceMoved > 10) {
                    e.preventDefault();
                    this.enterDragMode(taskCard, e.touches[0]);
                    return;
                }
            }

            // Handle horizontal swipes
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

            // Handle drag end
            if (this.isDragging) {
                this.endDragMode(e);
                return;
            }

            // Check for tap-and-hold without movement (alternative drag activation)
            if (this.initialTouch && !this.hasMoved && !this.isSwiping) {
                const timeHeld = Date.now() - this.initialTouch.time;
                if (timeHeld > 800) { // 800ms hold without movement
                    this.enterDragMode(taskCard, e.changedTouches[0]);
                    return;
                }
            }

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

            // Reset touch state
            this.isSwiping = false;
            this.hasMoved = false;
            this.initialTouch = null;
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
            await this.loadTasks(null, null, null, null, null, true); // Force refresh after status change
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
            await this.loadTasks(null, null, null, null, null, true); // Force refresh after task save
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
        // Optimistic delete with undo snackbar
        try {
            const task = await window.dataService.getTask(taskId);
            await window.dataService.deleteTask(taskId);
            await this.loadTasks();
            this.hapticImpact('light');
            this.showUndoToast('Task deleted', async () => {
                try {
                    await window.dataService.createTask(task);
                    await this.loadTasks();
                } catch (_) {}
            });
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    }

    toggleTaskExpansion(taskId) {
        const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
        const expandBtn = taskCard ? taskCard.querySelector('.task-expand-btn') : null;
        
        if (this.expandedTasks.has(taskId)) {
            // Collapse the task
            this.expandedTasks.delete(taskId);
            if (taskCard) taskCard.classList.remove('expanded');
            if (expandBtn) expandBtn.classList.remove('expanded');
        } else {
            // Expand the task
            this.expandedTasks.add(taskId);
            if (taskCard) taskCard.classList.add('expanded');
            if (expandBtn) expandBtn.classList.add('expanded');
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

            // Save to Documents. On iOS/Catalyst, omit encoding flag (prevents rare corruption);
            // on other platforms, keep encoding: 'base64'.
            const isApple = typeof window.Capacitor?.getPlatform === 'function' && window.Capacitor.getPlatform() === 'ios';
            const writeOptions = {
                path: fileName,
                data: base64Data,
                directory: 'DOCUMENTS',
                recursive: true
            };
            if (!isApple) {
                writeOptions.encoding = 'base64';
            }
            await Filesystem.writeFile(writeOptions);

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
            // Auto-decode on input as a fallback where 'paste' may not fire
            noteTextarea.addEventListener('input', () => {
                this.maybeAutoDecodeTextareaValue(noteTextarea);
            });
            // Decode percent-encoded text on paste (e.g., subject:%20RE%3A...)
            noteTextarea.addEventListener('paste', (e) => {
                try {
                    const preValue = noteTextarea.value;
                    const preStart = noteTextarea.selectionStart;
                    const preEnd = noteTextarea.selectionEnd;
                    const clipboard = (e.clipboardData && e.clipboardData.getData) ? e.clipboardData.getData('text/plain') : '';
                    if (clipboard) {
                        const decoded = this.safeDecodeIfEncoded(clipboard);
                        if (decoded !== clipboard) {
                            e.preventDefault();
                            const before = preValue.substring(0, preStart);
                            const after = preValue.substring(preEnd);
                            noteTextarea.value = before + decoded + after;
                            const caret = preStart + decoded.length;
                            noteTextarea.selectionStart = noteTextarea.selectionEnd = caret;
                            noteTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                            return;
                        }
                    }
                    // Fallback: let paste happen, then decode the newly inserted segment
                    setTimeout(() => {
                        try {
                            const postValue = noteTextarea.value;
                            const postCaret = noteTextarea.selectionStart;
                            // Estimate inserted range
                            const insertedEnd = postCaret;
                            const insertedStart = Math.min(insertedEnd, preStart + Math.max(0, postValue.length - (preValue.length - (preEnd - preStart))));
                            const before = postValue.substring(0, insertedStart);
                            const inserted = postValue.substring(insertedStart, insertedEnd);
                            const after = postValue.substring(insertedEnd);
                            const decodedInserted = this.safeDecodeIfEncoded(inserted);
                            if (decodedInserted !== inserted) {
                                noteTextarea.value = before + decodedInserted + after;
                                const caret = before.length + decodedInserted.length;
                                noteTextarea.selectionStart = noteTextarea.selectionEnd = caret;
                                noteTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                            }
                        } catch (_) {}
                    }, 0);
                } catch (_) {}
            });
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
                        // handleFileDrop already inserts the link; avoid duplicating
                        console.log('Attachment saved:', fileInfo);
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
                        // handleFileDrop already inserts the link; avoid duplicating
                        console.log('Attachment saved:', fileInfo);
                    } else {
                        this.showNotification('Failed to attach file', 'error');
                    }
                }
            }
        });

        // Setup file drag and drop for task description in the Task modal
        const descTextarea = document.getElementById('taskDescription');
        if (descTextarea) {
            descTextarea.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                descTextarea.style.borderColor = '#667eea';
                descTextarea.style.backgroundColor = '#f0f4ff';
            });
            descTextarea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                descTextarea.style.borderColor = '';
                descTextarea.style.backgroundColor = '';
            });
            descTextarea.addEventListener('drop', async (e) => {
                e.preventDefault();
                descTextarea.style.borderColor = '';
                descTextarea.style.backgroundColor = '';
                const uriList = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
                if (uriList) {
                    const firstUri = uriList.split('\n')[0].trim();
                    if (firstUri.startsWith('file:')) {
                        const decodedName = decodeURIComponent(firstUri.split('/').pop() || 'file');
                        const fileLink = `[File: ${decodedName}](${firstUri})`;
                        const current = descTextarea.value;
                        descTextarea.value = current + (current ? '\n' : '') + fileLink;
                        descTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                        this.showNotification(`Linked file "${decodedName}"`, 'success');
                        return;
                    }
                }
                const files = e.dataTransfer.files;
                if (files && files.length) {
                    const file = files[0];
                    const info = await this.handleFileDrop(file, descTextarea);
                    if (!info) this.showNotification('Failed to attach file', 'error');
                }
            });
        }

        // Also handle paste for dynamically created edit note textareas
        document.addEventListener('paste', (e) => {
            const target = e.target;
            if (!target || target.tagName !== 'TEXTAREA') return;
            if (!(target.id === 'newNote' || (target.classList && target.classList.contains('edit-note-textarea')))) return;
            try {
                const preValue = target.value;
                const preStart = target.selectionStart;
                const preEnd = target.selectionEnd;
                const clipboard = (e.clipboardData && e.clipboardData.getData) ? e.clipboardData.getData('text/plain') : '';
                if (clipboard) {
                    const decoded = this.safeDecodeIfEncoded(clipboard);
                    if (decoded !== clipboard) {
                        e.preventDefault();
                        const before = preValue.substring(0, preStart);
                        const after = preValue.substring(preEnd);
                        target.value = before + decoded + after;
                        const caret = preStart + decoded.length;
                        target.selectionStart = target.selectionEnd = caret;
                        target.dispatchEvent(new Event('input', { bubbles: true }));
                        return;
                    }
                }
                // Fallback for environments without clipboardData
                setTimeout(() => {
                    try {
                        const postValue = target.value;
                        const postCaret = target.selectionStart;
                        const insertedEnd = postCaret;
                        const insertedStart = Math.min(insertedEnd, preStart + Math.max(0, postValue.length - (preValue.length - (preEnd - preStart))));
                        const before = postValue.substring(0, insertedStart);
                        const inserted = postValue.substring(insertedStart, insertedEnd);
                        const after = postValue.substring(insertedEnd);
                        const decodedInserted = this.safeDecodeIfEncoded(inserted);
                        if (decodedInserted !== inserted) {
                            target.value = before + decodedInserted + after;
                            const caret = before.length + decodedInserted.length;
                            target.selectionStart = target.selectionEnd = caret;
                            target.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    } catch (_) {}
                }, 0);
            } catch (_) {}
        });

        // Delegated input handler for decoding when paste events are unavailable
        document.addEventListener('input', (e) => {
            const target = e.target;
            if (!target || target.tagName !== 'TEXTAREA') return;
            if (!(target.id === 'newNote' || (target.classList && target.classList.contains('edit-note-textarea')))) return;
            this.maybeAutoDecodeTextareaValue(target);
        });
    }

    // Try to detect and decode percent-encoded plain text safely
    safeDecodeIfEncoded(text) {
        // Quick reject for typical plain text without percent-encoding
        if (!/%[0-9A-Fa-f]{2}/.test(text) && text.indexOf('+') === -1) return text;
        try {
            // Replace '+' with space for x-www-form-urlencoded style pastes
            const candidate = text.replace(/\+/g, ' ');
            const decoded = decodeURIComponent(candidate);
            // Heuristic: only accept if decoding increases whitespace or removes % sequences
            const pctCountBefore = (text.match(/%[0-9A-Fa-f]{2}/g) || []).length;
            const pctCountAfter = (decoded.match(/%[0-9A-Fa-f]{2}/g) || []).length;
            if (pctCountAfter < pctCountBefore) return decoded;
            // Also accept if the decoded version contains common separators/spaces that were encoded
            if (/\s/.test(decoded) && decoded.length <= text.length + 10) return decoded;
            return text;
        } catch (_) {
            return text;
        }
    }

    // Decode whole textarea value if it appears to be a URL-encoded blob (e.g., mail subject)
    maybeAutoDecodeTextareaValue(target) {
        try {
            const value = String(target.value || '');
            if (!/%[0-9A-Fa-f]{2}/.test(value)) return;
            const pctCount = (value.match(/%[0-9A-Fa-f]{2}/g) || []).length;
            const looksEncoded = pctCount >= 3 || /%20|%0A|%3A|%2D/.test(value) || /^subject:/i.test(value);
            if (!looksEncoded) return;
            const decoded = this.safeDecodeIfEncoded(value);
            if (decoded !== value) {
                const caret = target.selectionStart;
                const offsetFromEnd = value.length - caret;
                target.value = decoded;
                // Try to preserve caret relative to end
                const newCaret = Math.max(0, decoded.length - offsetFromEnd);
                target.selectionStart = target.selectionEnd = newCaret;
                target.dispatchEvent(new Event('input', { bubbles: true }));
            }
        } catch (_) {}
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


    async toggleSubtask(subtaskId) {
        try {
            await window.dataService.toggleSubtask(subtaskId);
            await this.loadTasks(null, null, null, null, null, true); // Force refresh to show updated state
        } catch (error) {
            console.error('Error toggling subtask:', error);
        }
    }

    async editSubtask(subtaskId, currentTitle) {
        const newTitle = prompt('Edit subtask:', currentTitle);
        if (newTitle && newTitle.trim() !== currentTitle) {
        try {
            await window.dataService.updateSubtask(subtaskId, { title: newTitle.trim() });
            await this.loadTasks(null, null, null, null, null, true); // Force refresh after edit
        } catch (error) {
            console.error('Error updating subtask:', error);
        }
        }
    }

    async deleteSubtask(subtaskId) {
        if (!confirm('Are you sure you want to delete this subtask?')) return;
        
        try {
            await window.dataService.deleteSubtask(subtaskId);
            await this.loadTasks(null, null, null, null, null, true); // Force refresh after delete
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
            await this.loadTasks(null, null, null, null, null, true); // Force refresh after adding
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
            // Clear focus from input to allow refresh
            input.blur();
            await this.loadTasks(null, null, null, null, null, true); // Force refresh to show new subtask
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
            await this.loadTasks(null, null, null, null, null, true); // Force refresh after edit
        } catch (error) {
            console.error('Error updating subtask:', error);
        }
    }

    async deleteSubtask(subtaskId) {
        if (!confirm('Delete this subtask?')) return;

        try {
            await window.dataService.deleteSubtask(subtaskId);
            await this.loadTasks(null, null, null, null, null, true); // Force refresh after delete
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

    showUndoToast(message, onUndo) {
        const toast = document.createElement('div');
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.style.position = 'fixed';
        toast.style.bottom = `calc(16px + env(safe-area-inset-bottom))`;
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.background = '#111827';
        toast.style.color = '#fff';
        toast.style.padding = '12px 16px';
        toast.style.borderRadius = '9999px';
        toast.style.boxShadow = '0 8px 20px rgba(0,0,0,0.25)';
        toast.style.zIndex = '10000';
        toast.style.display = 'flex';
        toast.style.alignItems = 'center';
        toast.style.gap = '12px';
        const text = document.createElement('span');
        text.textContent = message;
        const btn = document.createElement('button');
        btn.textContent = 'Undo';
        btn.style.background = '#2563eb';
        btn.style.color = '#fff';
        btn.style.border = 'none';
        btn.style.borderRadius = '9999px';
        btn.style.padding = '8px 12px';
        btn.style.fontWeight = '600';
        btn.style.cursor = 'pointer';
        btn.addEventListener('click', async () => {
            try { await onUndo?.(); } catch(_) {}
            if (toast.parentNode) toast.parentNode.removeChild(toast);
            this.hapticImpact('medium');
        });
        toast.appendChild(text);
        toast.appendChild(btn);
        document.body.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
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
        this.closePrintModal();
        const compact = !!document.getElementById('print-compact')?.checked;
        // Prefer native flow on Capacitor
        await this.exportAndOpenPrintable(include, compact);
    }

    async exportPdfSelected() {
        const columns = ['todo', 'in_progress', 'pending', 'done'];
        const include = columns.filter(c => document.getElementById(`print-col-${c}`)?.checked);
        const compact = !!document.getElementById('print-compact')?.checked;
        this.closePrintModal();
        // Build printable HTML and export using the same path as the overlay's Export PDF
        const tasksByStatus = { todo: [], in_progress: [], pending: [], done: [] };
        for (const t of this.tasks) {
            if (!tasksByStatus[t.status]) tasksByStatus[t.status] = [];
            try {
                const subtasks = await window.dataService.getSubtasks(t.id);
                t.__subtasks = subtasks || [];
            } catch(_) { t.__subtasks = []; }
            tasksByStatus[t.status].push(t);
        }
        const html = this.buildPrintableHTML(include, tasksByStatus, compact);
        await this.exportPdfFromHtml(html);
    }

    async generateAndPrint(includeStatuses) {
        if (!includeStatuses || includeStatuses.length === 0) {
            this.showNotification('Please select at least one column to print.', 'warning');
            return;
        }
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
                .pr-columns { display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:16px; }
                .pr-col { border:1px solid #e5e7eb; border-radius:8px; padding:12px; background:#fff; }
                .pr-col h3 { margin:0 0 8px; font-size:13px; text-transform:uppercase; letter-spacing:.04em; color:#475569; }
                .pr-task { border:1px solid #e5e7eb; border-radius:8px; padding:10px; margin:8px 0; background:#fff; }
                .pr-task .pr-title { font-size:14px; font-weight:600; }
                .pr-desc { color:#334155; font-size:12px; margin-top:4px; white-space:pre-wrap; }
                .pr-tags { margin-top:6px; display:flex; flex-wrap:wrap; gap:6px; }
                .pr-tag { border:1px solid #c7d2fe; color:#4f46e5; border-radius:999px; padding:2px 6px; font-size:10px; }
                .pr-subtasks { margin-top:8px; }
                .pr-subtasks .pr-subtitle { font-size:12px; font-weight:600; margin-bottom:4px; }
                .pr-subtasks ul { margin:0; padding-left:16px; }
                .pr-subtasks li { font-size:12px; margin:2px 0; }
                .pr-meta { margin-top:6px; color:#64748b; font-size:10px; }
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
            for (const task of tasks) {
                const taskDiv = document.createElement('div');
                taskDiv.className = 'pr-task';
                const created = new Date(task.created_at).toLocaleDateString();
                const tagsHTML = (task.tags || []).map(t => `<span class=\"pr-tag\">${this.escapeHtml(t)}</span>`).join('');
                let subtasksHTML = '';
                try {
                    const subtasks = await window.dataService.getSubtasks(task.id);
                    if (Array.isArray(subtasks) && subtasks.length) {
                        subtasksHTML = `
                            <div class=\"pr-subtasks\">
                                <div class=\"pr-subtitle\">Sub-tasks</div>
                                <ul>
                                    ${subtasks.map(st => `<li>${st.completed ? '✅ ' : '⬜️ '}${this.escapeHtml(st.title)}</li>`).join('')}
                                </ul>
                            </div>`;
                    }
                } catch(_) {}

                taskDiv.innerHTML = `
                    <div class=\"pr-title\">${this.escapeHtml(task.title)}</div>
                    ${task.description ? `<div class=\"pr-desc\">${this.escapeHtml(task.description)}</div>` : ''}
                    ${(task.tags && task.tags.length) ? `<div class=\"pr-tags\">${tagsHTML}</div>` : ''}
                    ${subtasksHTML}
                    <div class=\"pr-meta\">Priority: ${this.escapeHtml(task.priority || 'medium')} • Created: ${created}</div>
                `;
                colDiv.appendChild(taskDiv);
            }

            grid.appendChild(colDiv);
        }

        printable.appendChild(grid);

        document.body.appendChild(printable);
        setTimeout(() => {
            try { window.print(); } finally {
                setTimeout(() => { if (printable && printable.parentNode) printable.parentNode.removeChild(printable); }, 300);
            }
        }, 50);
    }

    buildPrintableHTML(includeStatuses, tasksByStatus, compact = false) {
        const style = `
            <style>
                @media print {
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
                body { margin: 0; padding: 24px; font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
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
            </style>`;
        const statusLabelMap = { todo: 'To Do', in_progress: 'In Progress', pending: 'Pending', done: 'Done' };
        let columnsHTML = '';
        for (const status of includeStatuses) {
            const tasks = tasksByStatus[status] || [];
            const colTasks = tasks.map(task => {
                const created = new Date(task.created_at).toLocaleDateString();
                const tagsHTML = (task.tags || []).map(t => `<span class="pr-tag">${this.escapeHtml(t)}</span>`).join('');
                const subtasks = task.__subtasks || [];
                const subtasksHTML = subtasks.length ? `
                    <div class="pr-subtasks">
                        <div class="pr-subtitle">Sub-tasks</div>
                        <ul>
                            ${subtasks.map(st => `<li>${st.completed ? '✅ ' : '⬜️ '}${this.escapeHtml(st.title)}</li>`).join('')}
                        </ul>
                    </div>` : '';
                return `
                    <div class="pr-task">
                        <div class="pr-title">${this.escapeHtml(task.title)}</div>
                        ${task.description ? `<div class="pr-desc">${this.escapeHtml(task.description)}</div>` : ''}
                        ${(task.tags && task.tags.length) ? `<div class="pr-tags">${tagsHTML}</div>` : ''}
                        ${subtasksHTML}
                        <div class="pr-meta">Priority: ${this.escapeHtml(task.priority || 'medium')} • Created: ${created}</div>
                    </div>`;
            }).join('');
            columnsHTML += `<div class="pr-col"><h3>${statusLabelMap[status] || status}</h3>${colTasks || '<div class="pr-empty">No tasks</div>'}</div>`;
        }
        const header = `<div class="pr-header"><div class="pr-title">Kanban Tasks</div><div class="pr-sub">Printed ${new Date().toLocaleString()}</div></div>`;
        const helper = `<script>(function(){try{window.addEventListener('message',function(e){try{var d=e&&e.data;var should=(d==="print")||(d&&d.type==="print");if(should){try{window.focus&&window.focus();}catch(_){} setTimeout(function(){try{window.print&&window.print();}catch(_){ }},50);}}catch(_){}});}catch(_){}})();</script>`;
        return `<!doctype html><html><head><meta charset="utf-8">${style}<title>Kanban Tasks</title></head><body>${header}<div class="pr-columns">${columnsHTML}</div>${helper}</body></html>`;
    }

    async exportAndOpenPrintable(includeStatuses, compact = false) {
        try {
            // Collect tasks and their subtasks
            const tasksByStatus = { todo: [], in_progress: [], pending: [], done: [] };
            for (const t of this.tasks) {
                if (!tasksByStatus[t.status]) tasksByStatus[t.status] = [];
                // fetch subtasks
                try {
                    const subtasks = await window.dataService.getSubtasks(t.id);
                    t.__subtasks = subtasks || [];
                } catch(_) { t.__subtasks = []; }
                tasksByStatus[t.status].push(t);
            }

            const html = this.buildPrintableHTML(includeStatuses, tasksByStatus, compact);

            // Detect Mac Catalyst (Capacitor platform ios + Mac user agent)
            const isCatalyst = !!(window.Capacitor && typeof window.Capacitor.getPlatform === 'function' && window.Capacitor.getPlatform() === 'ios' && /Macintosh/.test(navigator.userAgent));
            if (isCatalyst) {
                // Use in-app overlay iframe instead of window.open (blocked in WKWebView/Catalyst)
                this.openPreviewOverlay(html);
                return;
            }
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
                const { Filesystem, App, Share } = window.Capacitor.Plugins;
                const fileName = `kanban-print-${new Date().toISOString().replace(/[:T]/g,'-').split('.')[0]}.html`;
                await Filesystem.writeFile({ path: fileName, data: html, directory: 'DOCUMENTS', encoding: 'utf8' });
                try {
                    const { uri } = await Filesystem.getUri({ path: fileName, directory: 'DOCUMENTS' });
                    // Prefer opening the HTML directly so user can use iOS native print/share in the viewer
                    if (App && App.openUrl) {
                        await App.openUrl({ url: uri });
                    } else if (Share && Share.share) {
                        await Share.share({ title: 'Kanban Tasks', url: uri, dialogTitle: 'Share/Print tasks' });
                    }
                } catch (e) {
                    // As a fallback, show a download via data URI
                    const blob = new Blob([html], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }
            } else {
                // Fallback to web print
                await this.generateAndPrint(includeStatuses);
            }
        } catch (error) {
            console.error('Export printable failed:', error);
            this.showNotification('Failed to prepare printable version', 'error');
        }
    }

    async exportPdfNative(includeStatuses, compact = false) {
        try {
            // Prefer native Print plugin with HTML content for reliable PDF/Preview
            const tasksByStatus = { todo: [], in_progress: [], pending: [], done: [] };
            for (const t of this.tasks) {
                if (!tasksByStatus[t.status]) tasksByStatus[t.status] = [];
                try { t.__subtasks = await window.dataService.getSubtasks(t.id); } catch(_) { t.__subtasks = []; }
                tasksByStatus[t.status].push(t);
            }
            const html = this.buildPrintableHTML(includeStatuses, tasksByStatus, compact);
            const isCatalyst = !!(window.Capacitor && typeof window.Capacitor.getPlatform === 'function' && window.Capacitor.getPlatform() === 'ios' && /Macintosh/.test(navigator.userAgent));
            const Print = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Print;
            if (isCatalyst) {
                // Mac Catalyst: no reliable print dialog; present overlay instead
                this.openPreviewOverlay(html);
                return;
            }
            // iOS device: let the native print controller handle HTML → PDF reliably
            if (Print && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
                const { Filesystem } = window.Capacitor.Plugins;
                const fileName = `kanban-print-${Date.now()}.html`;
                await Filesystem.writeFile({ path: fileName, data: html, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true });
                const { uri } = await Filesystem.getUri({ path: fileName, directory: 'DOCUMENTS' });
                await Print.print({ url: uri });
                return;
            }
            // Fallbacks for Mac Catalyst / Simulator: save HTML then try multiple open paths
            const { Filesystem, App, Share } = window.Capacitor.Plugins || {};
            if (Filesystem) {
                const fileName = `kanban-print-${Date.now()}.html`;
                await Filesystem.writeFile({ path: fileName, data: html, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true });
                const { uri } = await Filesystem.getUri({ path: fileName, directory: 'DOCUMENTS' });
                let opened = false;
                try {
                    if (App && App.openUrl) {
                        await App.openUrl({ url: uri });
                        opened = true;
                    }
                } catch (_) {}
                if (!opened) {
                    try {
                        if (Share && Share.share) {
                            await Share.share({ title: 'Kanban Tasks', url: uri, dialogTitle: 'Share/Print' });
                            opened = true;
                        }
                    } catch (_) {}
                }
                if (!opened) {
                    try {
                        const blob = new Blob([html], { type: 'text/html' });
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank');
                        opened = true;
                    } catch (_) {}
                }
                if (opened) return;
            }
            // Last resort: web preview
            await this.generateAndPrint(includeStatuses, compact);
        } catch (e) {
            console.error('Native PDF export failed:', e);
            this.showNotification('PDF export failed', 'error');
        }
    }

    openPreviewOverlay(html) {
        try {
            // Remove any existing overlay
            const existing = document.getElementById('preview-overlay');
            if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

            const overlay = document.createElement('div');
            overlay.id = 'preview-overlay';
            overlay.style.position = 'fixed';
            overlay.style.inset = '0';
            overlay.style.background = 'rgba(15, 23, 42, 0.65)';
            overlay.style.zIndex = '9999';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';

            const frameWrap = document.createElement('div');
            frameWrap.style.width = 'min(1100px, 94vw)';
            frameWrap.style.height = 'min(80vh, 900px)';
            frameWrap.style.borderRadius = '12px';
            frameWrap.style.overflow = 'hidden';
            frameWrap.style.boxShadow = '0 15px 35px rgba(0,0,0,0.35)';
            frameWrap.style.background = '#fff';
            frameWrap.style.position = 'relative';

            const controls = document.createElement('div');
            controls.style.position = 'absolute';
            controls.style.top = '8px';
            controls.style.right = '8px';
            controls.style.display = 'flex';
            controls.style.gap = '8px';

            const btnClose = document.createElement('button');
            btnClose.textContent = 'Close';
            btnClose.style.padding = '6px 10px';
            btnClose.style.border = '1px solid #e2e8f0';
            btnClose.style.borderRadius = '8px';
            btnClose.style.background = '#fff';
            btnClose.onclick = () => overlay.parentNode && overlay.parentNode.removeChild(overlay);

            const btnPdf = document.createElement('button');
            btnPdf.textContent = 'Export PDF…';
            btnPdf.style.padding = '6px 10px';
            btnPdf.style.border = '1px solid #e2e8f0';
            btnPdf.style.borderRadius = '8px';
            btnPdf.style.background = '#fff';
            btnPdf.onclick = async () => {
                try {
                    // Ensure iframe is ready
                    const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
                    if (!doc || !doc.body) { return; }
                    const target = doc.body;
                    // Render to canvas and build paginated PDF
                    const canvas = await html2canvas(target, { scale: 2, backgroundColor: '#ffffff' });
                    const { jsPDF } = window.jspdf || {};
                    if (!jsPDF) { return; }
                    const pdf = new jsPDF('p', 'pt', 'a4');
                    const pageWidth = pdf.internal.pageSize.getWidth();
                    const pageHeight = pdf.internal.pageSize.getHeight();
                    const imgWidth = pageWidth - 40;
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;
                    const sliceHeight = (canvas.width * (pageHeight - 40)) / imgWidth;
                    let position = 0;
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
                    // Save to Documents via Capacitor and open
                    const blob = pdf.output('blob');
                    const base64 = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                            try { resolve(String(reader.result).split(',')[1] || ''); } catch (e) { reject(e); }
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                    const plugins = (window.Capacitor && window.Capacitor.Plugins) || {};
                    const { Filesystem, App, Share } = plugins;
                    if (Filesystem) {
                        const fileName = `kanban-tasks-${new Date().toISOString().split('T')[0]}.pdf`;
                        // Write as base64 without encoding flag so native decodes to binary
                        await Filesystem.writeFile({ path: fileName, data: base64, directory: 'DOCUMENTS', recursive: true });
                        const { uri } = await Filesystem.getUri({ path: fileName, directory: 'DOCUMENTS' });
                        let opened = false;
                        try { if (App && App.openUrl) { await App.openUrl({ url: uri }); opened = true; } } catch (_) {}
                        if (!opened) {
                            try { if (Share && Share.share) { await Share.share({ title: 'Kanban Tasks PDF', url: uri, dialogTitle: 'Share/Print PDF' }); opened = true; } } catch (_) {}
                        }
                        if (!opened) {
                            // Fallback to in-memory open
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank');
                        }
                    } else {
                        // Last resort: in-memory open
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank');
                    }
                } catch (e) { console.error('PDF export failed', e); }
            };

            controls.appendChild(btnPdf);
            controls.appendChild(btnClose);

            const iframe = document.createElement('iframe');
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = '0';
            // Use srcdoc so the iframe is same-origin for messaging
            iframe.srcdoc = html;

            frameWrap.appendChild(iframe);
            frameWrap.appendChild(controls);
            overlay.appendChild(frameWrap);
            document.body.appendChild(overlay);
        } catch (e) {
            console.error('Preview overlay failed:', e);
            // Last resort: data URI open attempt
            try {
                const blob = new Blob([html], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                window.location.href = url;
            } catch(_) {}
        }
    }

    // Floating Tag Filter Methods
    isDesktop() {
        return window.matchMedia && window.matchMedia('(min-width: 1024px)').matches;
    }

    toggleFloatingTagFilter() {
        if (!this.isDesktop()) return;
        
        const floatingFilter = document.getElementById('floatingTagFilter');
        const isVisible = floatingFilter.style.display !== 'none';
        
        if (isVisible) {
            this.closeFloatingTagFilter();
        } else {
            this.openFloatingTagFilter();
        }
    }

    openFloatingTagFilter() {
        if (!this.isDesktop()) return;
        
        const floatingFilter = document.getElementById('floatingTagFilter');
        floatingFilter.style.display = 'block';
        
        // Restore saved position
        this.restoreFloatingFilterPosition();
        
        this.updateFloatingTagFilter();
        this.makeDraggable();
    }

    closeFloatingTagFilter() {
        const floatingFilter = document.getElementById('floatingTagFilter');
        floatingFilter.style.display = 'none';
        floatingFilter.classList.remove('minimized');
        
        // Save current position before closing
        this.saveFloatingFilterPosition();
    }

    minimizeFloatingTagFilter() {
        const floatingFilter = document.getElementById('floatingTagFilter');
        floatingFilter.classList.toggle('minimized');
    }

    updateFloatingTagFilter() {
        if (!this.isDesktop()) return;
        
        // Update priority grid
        this.updateFloatingPriorityGrid();
        
        // Update tag grid
        const tagGrid = document.getElementById('floatingTagGrid');
        if (!tagGrid) return;
        
        // Clear existing tags
        tagGrid.innerHTML = '';
        
        // Create clickable tag buttons
        this.availableTags.forEach(tag => {
            const tagElement = document.createElement('div');
            tagElement.className = 'floating-tag-item';
            tagElement.textContent = tag;
            
            // Determine current state and styling
            if (this.currentIncludeTags.includes(tag)) {
                tagElement.classList.add('include');
                tagElement.title = `Click to remove from include filters`;
            } else if (this.currentExcludeTags.includes(tag)) {
                tagElement.classList.add('exclude');
                tagElement.title = `Click to remove from exclude filters`;
            } else {
                tagElement.classList.add('neutral');
                tagElement.title = `Click to include this tag`;
            }
            
            // Add click handler
            tagElement.addEventListener('click', () => {
                this.toggleFloatingTag(tag);
            });
            
            tagGrid.appendChild(tagElement);
        });
    }
    
    updateFloatingPriorityGrid() {
        const priorityGrid = document.getElementById('floatingPriorityGrid');
        if (!priorityGrid) return;
        
        // Clear existing priorities
        priorityGrid.innerHTML = '';
        
        const priorities = [
            { value: '', label: 'All' },
            { value: 'urgent', label: 'Urgent' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' }
        ];
        
        // Create clickable priority buttons
        priorities.forEach(priority => {
            const priorityElement = document.createElement('div');
            priorityElement.className = 'floating-priority-item';
            priorityElement.textContent = priority.label;
            
            // Add priority-specific class for styling
            if (priority.value) {
                priorityElement.classList.add(priority.value);
            }
            
            // Check if this priority is currently selected
            if (this.currentPriority === priority.value) {
                priorityElement.classList.add('active');
                priorityElement.title = `Click to clear priority filter`;
            } else {
                priorityElement.title = `Click to filter by ${priority.label.toLowerCase()} priority`;
            }
            
            // Add click handler
            priorityElement.addEventListener('click', () => {
                this.toggleFloatingPriority(priority.value);
            });
            
            priorityGrid.appendChild(priorityElement);
        });
    }
    
    toggleFloatingTag(tag) {
        const isIncluded = this.currentIncludeTags.includes(tag);
        const isExcluded = this.currentExcludeTags.includes(tag);
        
        if (isIncluded) {
            // Remove from include, add to exclude
            const index = this.currentIncludeTags.indexOf(tag);
            this.currentIncludeTags.splice(index, 1);
            this.currentExcludeTags.push(tag);
        } else if (isExcluded) {
            // Remove from exclude (back to neutral)
            const index = this.currentExcludeTags.indexOf(tag);
            this.currentExcludeTags.splice(index, 1);
        } else {
            // Add to include (remove from exclude if it was there)
            const excludeIndex = this.currentExcludeTags.indexOf(tag);
            if (excludeIndex > -1) {
                this.currentExcludeTags.splice(excludeIndex, 1);
            }
            this.currentIncludeTags.push(tag);
        }
        
        // Update UI and refresh tasks
        this.updateFloatingTagFilter();
        this.syncUIState();
        this.loadTasks();
    }

    toggleFloatingPriority(priority) {
        // Toggle priority - if same priority clicked, clear it
        if (this.currentPriority === priority) {
            this.currentPriority = '';
        } else {
            this.currentPriority = priority;
        }
        
        // Update UI and refresh tasks
        this.updateFloatingTagFilter();
        this.syncUIState();
        this.loadTasks();
    }

    clearAllFilters() {
        this.currentIncludeTags = [];
        this.currentExcludeTags = [];
        this.currentPriority = '';
        this.updateFloatingTagFilter();
        this.syncUIState();
        this.loadTasks();
    }

    saveFloatingFilterPosition() {
        const floatingFilter = document.getElementById('floatingTagFilter');
        if (!floatingFilter) return;
        
        // Get current position from transform or default position
        const transform = floatingFilter.style.transform;
        let x = 0, y = 0;
        
        if (transform && transform !== 'none') {
            const matches = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
            if (matches) {
                x = parseInt(matches[1]) || 0;
                y = parseInt(matches[2]) || 0;
            }
        }
        
        // Save to localStorage
        try {
            localStorage.setItem('floatingFilterPosition', JSON.stringify({ x, y }));
        } catch (error) {
            console.warn('Could not save floating filter position:', error);
        }
    }

    restoreFloatingFilterPosition() {
        const floatingFilter = document.getElementById('floatingTagFilter');
        if (!floatingFilter) return;
        
        try {
            const saved = localStorage.getItem('floatingFilterPosition');
            if (saved) {
                const { x, y } = JSON.parse(saved);
                
                // Validate position is within bounds
                const maxX = window.innerWidth - floatingFilter.offsetWidth;
                const maxY = window.innerHeight - floatingFilter.offsetHeight;
                const minY = 20;
                
                const validX = Math.max(0, Math.min(x, maxX));
                const validY = Math.max(minY, Math.min(y, maxY));
                
                floatingFilter.style.transform = `translate(${validX}px, ${validY}px)`;
            }
        } catch (error) {
            console.warn('Could not restore floating filter position:', error);
        }
    }

    makeDraggable() {
        const floatingFilter = document.getElementById('floatingTagFilter');
        if (!floatingFilter) return;
        
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;
        
        const header = floatingFilter.querySelector('.floating-tag-filter-header');
        
        // Mouse events
        header.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
        
        // Touch events
        header.addEventListener('touchstart', dragStart, { passive: false });
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('touchend', dragEnd);
        
        function dragStart(e) {
            // Prevent text selection
            e.preventDefault();
            e.stopPropagation();
            
            // Get coordinates from mouse or touch
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            
            // Only start dragging if clicking/touching on the header (not buttons)
            if (e.target === header || (header.contains(e.target) && !e.target.closest('button'))) {
                isDragging = true;
                floatingFilter.classList.add('dragging');
                
                // Prevent text selection globally during drag
                document.body.style.userSelect = 'none';
                document.body.style.webkitUserSelect = 'none';
                
                initialX = clientX - xOffset;
                initialY = clientY - yOffset;
            }
        }
        
        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                e.stopPropagation();
                
                // Get coordinates from mouse or touch
                const clientX = e.clientX || (e.touches && e.touches[0].clientX);
                const clientY = e.clientY || (e.touches && e.touches[0].clientY);
                
                currentX = clientX - initialX;
                currentY = clientY - initialY;
                
                xOffset = currentX;
                yOffset = currentY;
                
                // Keep window within viewport bounds
                const maxX = window.innerWidth - floatingFilter.offsetWidth;
                const maxY = window.innerHeight - floatingFilter.offsetHeight;
                const minY = 20; // Keep at least 20px from top of screen
                
                currentX = Math.max(0, Math.min(currentX, maxX));
                currentY = Math.max(minY, Math.min(currentY, maxY));
                
                floatingFilter.style.transform = `translate(${currentX}px, ${currentY}px)`;
            }
        }
        
        function dragEnd() {
            if (isDragging) {
                initialX = currentX;
                initialY = currentY;
                isDragging = false;
                
                // Remove dragging class and restore text selection
                floatingFilter.classList.remove('dragging');
                document.body.style.userSelect = '';
                document.body.style.webkitUserSelect = '';
                
                // Save position after dragging stops
                app.saveFloatingFilterPosition();
            }
        }
        
        // Also save position on window resize to keep it valid
        window.addEventListener('resize', () => {
            app.saveFloatingFilterPosition();
        });
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

// Floating Tag Filter Functions
function toggleFloatingTagFilter() {
    if (window.app) {
        app.toggleFloatingTagFilter();
    }
}

function minimizeFloatingTagFilter() {
    if (window.app) {
        app.minimizeFloatingTagFilter();
    }
}

function closeFloatingTagFilter() {
    if (window.app) {
        app.closeFloatingTagFilter();
    }
}

function clearAllFilters() {
    if (window.app) {
        app.clearAllFilters();
    }
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