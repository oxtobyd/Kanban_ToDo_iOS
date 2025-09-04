const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Get all tasks
router.get('/tasks', async (req, res) => {
  try {
    const { priority, sortBy = 'created_at', sortOrder = 'DESC', search, tag } = req.query;
    let query = 'SELECT * FROM tasks';
    let whereConditions = [];
    let params = [];
    let paramCount = 0;
    
    if (priority) {
      paramCount++;
      whereConditions.push(`priority = $${paramCount}`);
      params.push(priority);
    }
    
    if (search) {
      paramCount++;
      whereConditions.push(`(title ILIKE $${paramCount} OR description ILIKE $${paramCount})`);
      params.push(`%${search}%`);
    }
    
    if (tag) {
      paramCount++;
      whereConditions.push(`$${paramCount} = ANY(tags)`);
      params.push(tag);
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    // Priority order: urgent > high > medium > low (highest first)
    if (sortBy === 'priority') {
      query += ` ORDER BY 
        CASE priority 
          WHEN 'urgent' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
        END ASC, created_at DESC`;
    } else {
      query += ` ORDER BY ${sortBy} ${sortOrder}`;
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new task
router.post('/tasks', async (req, res) => {
  const { title, description, priority = 'medium', status = 'todo', tags = [], pending_on } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO tasks (title, description, priority, status, tags, pending_on) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [title, description, priority, status, tags, pending_on || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update task status
router.patch('/tasks/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, pending_on } = req.body;
  try {
    const result = await pool.query(
      'UPDATE tasks SET status = $1, pending_on = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [status, pending_on || null, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update task priority
router.patch('/tasks/:id/priority', async (req, res) => {
  const { id } = req.params;
  const { priority } = req.body;
  try {
    const result = await pool.query(
      'UPDATE tasks SET priority = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [priority, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update task
router.put('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, priority, status, tags = [], pending_on } = req.body;
  try {
    const result = await pool.query(
      'UPDATE tasks SET title = $1, description = $2, priority = $3, status = $4, tags = $5, pending_on = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING *',
      [title, description, priority, status, tags, pending_on || null, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete task
router.delete('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get notes for a task
router.get('/tasks/:id/notes', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM notes WHERE task_id = $1 ORDER BY created_at DESC',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add note to task
router.post('/tasks/:id/notes', async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO notes (task_id, content) VALUES ($1, $2) RETURNING *',
      [id, content]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update note
router.put('/notes/:id', async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  try {
    const result = await pool.query(
      'UPDATE notes SET content = $1 WHERE id = $2 RETURNING *',
      [content, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete note
router.delete('/notes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM notes WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all unique tags
router.get('/tags', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT unnest(tags) as tag FROM tasks WHERE tags IS NOT NULL AND array_length(tags, 1) > 0 ORDER BY tag'
    );
    res.json(result.rows.map(row => row.tag));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get sub-tasks for a task
router.get('/tasks/:id/subtasks', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM sub_tasks WHERE task_id = $1 ORDER BY created_at ASC',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add sub-task to task
router.post('/tasks/:id/subtasks', async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO sub_tasks (task_id, title) VALUES ($1, $2) RETURNING *',
      [id, title]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update sub-task
router.put('/subtasks/:id', async (req, res) => {
  const { id } = req.params;
  const { title, completed } = req.body;
  try {
    const result = await pool.query(
      'UPDATE sub_tasks SET title = $1, completed = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [title, completed, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sub-task not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle sub-task completion
router.patch('/subtasks/:id/toggle', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE sub_tasks SET completed = NOT completed, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sub-task not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete sub-task
router.delete('/subtasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM sub_tasks WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sub-task not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export data
router.get('/export', async (req, res) => {
  try {
    // Get all tasks
    const tasksResult = await pool.query('SELECT * FROM tasks ORDER BY created_at ASC');
    const tasks = tasksResult.rows;
    
    // Get all notes
    const notesResult = await pool.query('SELECT * FROM notes ORDER BY created_at ASC');
    const notes = notesResult.rows;
    
    // Get all subtasks
    const subtasksResult = await pool.query('SELECT * FROM sub_tasks ORDER BY created_at ASC');
    const subtasks = subtasksResult.rows;
    
    // Get all unique tags
    const tagsResult = await pool.query(
      'SELECT DISTINCT unnest(tags) as tag FROM tasks WHERE tags IS NOT NULL AND array_length(tags, 1) > 0 ORDER BY tag'
    );
    
    // Create export data in PostgreSQL format for compatibility
    const exportData = {
      exportDate: new Date().toISOString(),
      version: "1.0",
      database: {
        tasks,
        notes,
        subTasks: subtasks,
        tags: tagsResult.rows.map(row => row.tag)
      },
      metadata: {
        totalTasks: tasks.length,
        totalNotes: notes.length,
        totalSubTasks: subtasks.length,
        totalTags: tagsResult.rows.length
      },
      // Also include the iOS format for backward compatibility
      data: {
        tasks,
        notes,
        subtasks
      },
      exported_at: new Date().toISOString(),
      app_name: "Kanban Todo Board"
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="kanban-export-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(exportData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import data
router.post('/import', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Support both formats: { data: {...} } and { database: {...} }
    const importBody = req.body;
    let data, options = {};
    
    // Detect format and extract data
    if (importBody.database) {
      // PostgreSQL format
      data = {
        tasks: importBody.database.tasks || [],
        notes: importBody.database.notes || [],
        subtasks: importBody.database.subTasks || [] // Note: subTasks vs subtasks
      };
      options.clearExisting = importBody.clearExisting || false;
    } else if (importBody.data) {
      // iOS format
      data = importBody.data;
      options = importBody.options || {};
    } else {
      return res.status(400).json({ error: 'Invalid import data format. Expected "data" or "database" property.' });
    }
    
    if (!data.tasks || !Array.isArray(data.tasks)) {
      return res.status(400).json({ error: 'Invalid import data format. Expected tasks array.' });
    }
    
    let importStats = {
      tasks: { imported: 0, skipped: 0, errors: 0 },
      notes: { imported: 0, skipped: 0, errors: 0 },
      subtasks: { imported: 0, skipped: 0, errors: 0 }
    };
    
    // Clear existing data if requested
    if (options.clearExisting) {
      await client.query('DELETE FROM sub_tasks');
      await client.query('DELETE FROM notes');
      await client.query('DELETE FROM tasks');
      
      // Reset sequences
      await client.query('ALTER SEQUENCE tasks_id_seq RESTART WITH 1');
      await client.query('ALTER SEQUENCE notes_id_seq RESTART WITH 1');
      await client.query('ALTER SEQUENCE sub_tasks_id_seq RESTART WITH 1');
    }
    
    // Create ID mapping for tasks (old ID -> new ID)
    const taskIdMapping = {};
    
    // Import tasks
    for (const task of data.tasks) {
      try {
        const result = await client.query(
          'INSERT INTO tasks (title, description, priority, status, tags, pending_on, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
          [
            task.title,
            task.description || '',
            task.priority || 'medium',
            task.status || 'todo',
            task.tags || [],
            task.pending_on || null,
            task.created_at || new Date().toISOString(),
            task.updated_at || new Date().toISOString()
          ]
        );
        
        taskIdMapping[task.id] = result.rows[0].id;
        importStats.tasks.imported++;
      } catch (error) {
        console.error('Error importing task:', error);
        importStats.tasks.errors++;
      }
    }
    
    // Import notes
    if (data.notes && Array.isArray(data.notes)) {
      for (const note of data.notes) {
        try {
          const newTaskId = taskIdMapping[note.task_id];
          if (newTaskId) {
            await client.query(
              'INSERT INTO notes (task_id, content, created_at) VALUES ($1, $2, $3)',
              [
                newTaskId,
                note.content,
                note.created_at || new Date().toISOString()
              ]
            );
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
            await client.query(
              'INSERT INTO sub_tasks (task_id, title, completed, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
              [
                newTaskId,
                subtask.title,
                subtask.completed || false,
                subtask.created_at || new Date().toISOString(),
                subtask.updated_at || new Date().toISOString()
              ]
            );
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
    
    await client.query('COMMIT');
    
    // Return response in format compatible with both versions
    const response = {
      success: true,
      message: 'Data imported successfully',
      stats: importStats,
      // Also include PostgreSQL format for compatibility
      results: {
        tasks: importStats.tasks,
        notes: importStats.notes,
        subTasks: importStats.subtasks
      },
      summary: {
        totalImported: importStats.tasks.imported + importStats.notes.imported + importStats.subtasks.imported,
        totalErrors: importStats.tasks.errors + importStats.notes.errors + importStats.subtasks.errors
      }
    };
    
    res.json(response);
    
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;