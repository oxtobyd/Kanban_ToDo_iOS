# Import/Export Compatibility Guide

This document explains the import/export functionality and cross-version compatibility between the PostgreSQL and iOS versions of the Kanban Todo Board app.

## Overview

The app now supports importing and exporting data in two formats:
1. **PostgreSQL Format** - Used by the server-based PostgreSQL version
2. **iOS Format** - Used by the Capacitor/localStorage version

Both versions can import and export data in either format, ensuring full compatibility.

## Export Formats

### PostgreSQL Format
```json
{
  "exportDate": "2025-01-09T10:30:00.000Z",
  "version": "1.0",
  "database": {
    "tasks": [...],
    "notes": [...],
    "subTasks": [...],
    "tags": [...]
  },
  "metadata": {
    "totalTasks": 2,
    "totalNotes": 2,
    "totalSubTasks": 2,
    "totalTags": 2
  }
}
```

### iOS Format
```json
{
  "version": "1.0",
  "exported_at": "2025-01-09T10:30:00.000Z",
  "app_name": "Kanban Todo Board",
  "data": {
    "tasks": [...],
    "notes": [...],
    "subtasks": [...]
  }
}
```

## Key Differences

| Feature | PostgreSQL Format | iOS Format |
|---------|------------------|------------|
| Root structure | `database` | `data` |
| Subtasks key | `subTasks` | `subtasks` |
| Date field | `exportDate` | `exported_at` |
| Metadata | Included | Not included |
| Tags array | Separate array | Extracted from tasks |

## Compatibility Features

### Automatic Format Detection
Both versions automatically detect the import format:
- Checks for `database.tasks` (PostgreSQL format)
- Falls back to `data.tasks` (iOS format)
- Shows appropriate error if neither format is found

### Dual Format Export
When exporting, both versions now create files that include both formats:
```json
{
  "exportDate": "2025-01-09T10:30:00.000Z",
  "version": "1.0",
  "database": {
    "tasks": [...],
    "notes": [...],
    "subTasks": [...],
    "tags": [...]
  },
  "metadata": {...},
  "data": {
    "tasks": [...],
    "notes": [...],
    "subtasks": [...]
  },
  "exported_at": "2025-01-09T10:30:00.000Z",
  "app_name": "Kanban Todo Board"
}
```

### Field Mapping
The import process handles field name differences:
- `subTasks` ↔ `subtasks`
- `exportDate` ↔ `exported_at`
- Automatic ID remapping to prevent conflicts

## Usage

### Exporting Data
1. Click the **Export** button in the app header
2. File is automatically downloaded as `kanban-export-YYYY-MM-DD.json`
3. File contains data in both formats for maximum compatibility

### Importing Data
1. Click the **Import** button in the app header
2. Select a JSON file (either format supported)
3. Preview shows data statistics
4. Choose whether to clear existing data
5. Click **Import Data** to complete

### Cross-Version Migration
You can seamlessly migrate data between versions:

**PostgreSQL → iOS:**
1. Export from PostgreSQL version
2. Import into iOS version
3. Data is automatically converted and stored in iCloud/localStorage

**iOS → PostgreSQL:**
1. Export from iOS version
2. Import into PostgreSQL version
3. Data is automatically converted and stored in database

## Import Options

### Clear Existing Data
- **Checked**: Removes all existing tasks, notes, and subtasks before import
- **Unchecked**: Adds imported data to existing data (IDs are automatically remapped)

### Error Handling
- Invalid JSON files are rejected
- Missing required fields are handled gracefully
- Import statistics show successful imports vs errors
- Partial imports are supported (continues on individual item errors)

## Data Integrity

### ID Remapping
- Original IDs are mapped to new sequential IDs
- Relationships between tasks, notes, and subtasks are preserved
- No ID conflicts occur when importing into existing data

### Validation
- Required fields are validated
- Invalid status/priority values are corrected to defaults
- Malformed dates are replaced with current timestamp
- Empty arrays are handled properly

## Testing

Two test files are included:
- `test-postgres-export.json` - PostgreSQL format example
- `test-ios-export.json` - iOS format example

Use these to test import functionality and verify compatibility.

## Troubleshooting

### Common Issues

**"Invalid file format" error:**
- Ensure the file is valid JSON
- Check that it contains either `database.tasks` or `data.tasks`
- Verify the file wasn't corrupted during transfer

**Import shows 0 items:**
- Check that the tasks array isn't empty
- Verify the file structure matches expected format
- Look at browser console for detailed error messages

**Missing relationships:**
- Notes/subtasks without matching task IDs are skipped
- Check import statistics for skipped items
- Ensure task data is imported before related data

### Support

For issues or questions about import/export functionality:
1. Check browser console for detailed error messages
2. Verify file format using the test files
3. Try importing with "Clear existing data" option
4. Check the import statistics for specific error counts