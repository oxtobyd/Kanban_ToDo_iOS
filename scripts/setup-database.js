const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: 'postgres', // Connect to default database first
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || undefined, // Handle empty password
});

async function setupDatabase() {
  try {
    // Create database if it doesn't exist
    await pool.query(`CREATE DATABASE ${process.env.DB_NAME}`);
    console.log(`Database ${process.env.DB_NAME} created successfully`);
  } catch (error) {
    if (error.code === '42P04') {
      console.log(`Database ${process.env.DB_NAME} already exists`);
    } else {
      console.error('Error creating database:', error);
    }
  }

  // Connect to the todo_app database
  const appPool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || undefined, // Handle empty password
  });

  try {
    // Create tasks table
    await appPool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
        priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add priority column to existing tables if it doesn't exist
    await appPool.query(`
      ALTER TABLE tasks 
      ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium' 
      CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
    `);

    // Add tags column to existing tables if it doesn't exist
    await appPool.query(`
      ALTER TABLE tasks 
      ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'
    `);

    // Create notes table
    await appPool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Tables created successfully');
    
    // Insert sample data
    await appPool.query(`
      INSERT INTO tasks (title, description, status, priority, tags) VALUES
      ('Setup project structure', 'Create the basic folder structure and configuration files', 'done', 'high', '{"setup", "backend"}'),
      ('Design database schema', 'Plan the database tables and relationships', 'done', 'high', '{"database", "planning"}'),
      ('Build frontend UI', 'Create a modern and clean user interface', 'in_progress', 'urgent', '{"frontend", "ui", "design"}'),
      ('Add drag and drop functionality', 'Implement task movement between columns', 'todo', 'medium', '{"frontend", "feature"}'),
      ('Write documentation', 'Create user guide and API documentation', 'todo', 'low', '{"documentation", "guide"}')
      ON CONFLICT DO NOTHING
    `);

    console.log('Sample data inserted successfully');
    
  } catch (error) {
    console.error('Error setting up tables:', error);
  } finally {
    await appPool.end();
    await pool.end();
  }
}

setupDatabase();