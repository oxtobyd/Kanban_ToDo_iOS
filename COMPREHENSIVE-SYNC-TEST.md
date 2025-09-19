# Comprehensive Sync & CRUD Test Plan

## Critical Test Scenarios That Must Pass

### **Create Operations**
- [ ] Create task on Device A → appears on Device B within 5 seconds
- [ ] Create note on Device A → appears on Device B 
- [ ] Create subtask on Device A → appears on Device B
- [ ] Create multiple items rapidly → all sync without conflicts
- [ ] Create while offline → syncs when back online

### **Read Operations**
- [ ] All items load correctly on app startup
- [ ] Filtering works without data loss
- [ ] Search works across synced data
- [ ] Pagination/sorting maintains data integrity

### **Update Operations**
- [ ] Edit task on Device A → updates on Device B
- [ ] Edit same task on both devices → newer change wins
- [ ] Update task status → syncs correctly
- [ ] Update priority → syncs correctly
- [ ] Update tags → syncs correctly
- [ ] Toggle subtask completion → syncs correctly

### **Delete Operations** (Previously Broken)
- [ ] Delete task on Device A → disappears on Device B
- [ ] Delete note on Device A → disappears on Device B  
- [ ] Delete subtask on Device A → disappears on Device B
- [ ] Delete task with notes/subtasks → all related items deleted
- [ ] Deleted items stay deleted (no resurrection)

### **Conflict Resolution**
- [ ] Same item edited on both devices → newer wins
- [ ] Item deleted on A, edited on B → deletion wins
- [ ] Item created with same content → no duplicates
- [ ] Rapid changes → all changes preserved correctly

### **Edge Cases**
- [ ] App killed during sync → data integrity maintained
- [ ] Network interruption during sync → recovers correctly
- [ ] iCloud unavailable → graceful degradation
- [ ] Large datasets → performance acceptable
- [ ] Clock skew between devices → timestamps handled correctly

### **Data Integrity**
- [ ] No duplicate IDs after sync
- [ ] No orphaned notes/subtasks
- [ ] ID sequences don't conflict
- [ ] All relationships maintained

## What I Need to Verify in Code

1. **Tombstone deletion logic** - Does it actually work?
2. **Merge algorithm** - Handles all edge cases?
3. **Timestamp comparison** - Accounts for clock differences?
4. **ID generation** - Prevents conflicts across devices?
5. **Error handling** - Recovers from all failure modes?

## Honest Assessment

**I cannot guarantee 100% robustness without:**
- Multi-device testing with real iCloud sync
- Network interruption testing
- Concurrent operation testing
- Large dataset testing
- Clock skew testing

The deletion bug I missed proves that **code review alone is insufficient** for sync systems.