// Debug script to check offline data loading
console.log('=== OFFLINE DATA DEBUG ===');

// Check localStorage directly
console.log('1. Checking localStorage directly:');
const localTasks = localStorage.getItem('kanban_tasks');
const localNotes = localStorage.getItem('kanban_notes');
const localSubtasks = localStorage.getItem('kanban_subtasks');

console.log('localStorage kanban_tasks:', localTasks ? JSON.parse(localTasks).length + ' tasks' : 'No data');
console.log('localStorage kanban_notes:', localNotes ? JSON.parse(localNotes).length + ' notes' : 'No data');
console.log('localStorage kanban_subtasks:', localSubtasks ? JSON.parse(localSubtasks).length + ' subtasks' : 'No data');

// Check RobustDataService
console.log('\n2. Checking RobustDataService:');
if (window.RobustDataService) {
    console.log('RobustDataService exists');
    console.log('Tasks in service:', window.RobustDataService.tasks?.length || 0);
    console.log('Notes in service:', window.RobustDataService.notes?.length || 0);
    console.log('Subtasks in service:', window.RobustDataService.subtasks?.length || 0);
    
    // Test getTasks method
    try {
        const tasks = window.RobustDataService.getTasks();
        console.log('getTasks() returned:', tasks?.length || 0, 'tasks');
        if (tasks && tasks.length > 0) {
            console.log('First task:', tasks[0]);
        }
    } catch (error) {
        console.error('Error calling getTasks():', error);
    }
} else {
    console.log('RobustDataService not available');
}

// Check if app is initialized
console.log('\n3. Checking app state:');
if (window.app) {
    console.log('App exists');
    console.log('App tasks:', window.app.tasks?.length || 0);
} else {
    console.log('App not available');
}

// Check network status
console.log('\n4. Network status:');
console.log('navigator.onLine:', navigator.onLine);

// Check sync provider
console.log('\n5. Sync provider:');
if (window.RobustiCloudSync) {
    console.log('RobustiCloudSync exists');
} else {
    console.log('RobustiCloudSync not available');
}

console.log('=== DEBUG COMPLETE ===');