# Kanban Todo Board

A modern, responsive Kanban-style todo application built with Node.js, Express, PostgreSQL, and vanilla JavaScript. Features drag-and-drop functionality, mobile touch gestures, task prioritization, tagging system, and a pending workflow with reason tracking.

![Kanban Todo Board](https://img.shields.io/badge/Status-Active-green) ![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13+-blue)

## 📸 Screenshot

![Kanban Board Interface](docs/images/kanban-board-screenshot.png)

*The Kanban board showing tasks organized across four columns with priority indicators, tags, and pending workflow*

## ✨ Features

### 🎯 Core Functionality
- **Kanban Board Layout**: Four columns - To Do, In Progress, Pending, Done
- **Drag & Drop**: Move tasks between columns with smooth animations
- **Mobile Touch Gestures**: Swipe tasks left/right to change status on mobile devices
- **Task Management**: Create, edit, delete tasks with rich descriptions

### 🏷️ Organization & Filtering
- **Priority System**: Urgent, High, Medium, Low with visual indicators
- **Tagging System**: Add multiple tags to tasks for better organization
- **Search Functionality**: Real-time search across task titles and descriptions
- **Smart Filtering**: Filter by priority, tags, or search terms
- **Sorting Options**: Sort by priority, date, or title

### 📝 Advanced Features
- **Pending Workflow**: Special pending column with required reason tracking
- **Notes System**: Add, edit, and delete notes on individual tasks
- **Status Management**: Set task status directly when creating/editing
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile

### 🎨 User Experience
- **Modern UI**: Clean, professional design with smooth animations
- **Visual Feedback**: Priority badges, swipe indicators, and status colors
- **Keyboard Shortcuts**: Enter to save, Escape to cancel in modals
- **Touch-Friendly**: Optimized for mobile interaction

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL 13+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/oxtobyd/Kanban_ToDo.git
   cd Kanban_ToDo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your database credentials:
   ```env
   PORT=3012
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=todo_app
   DB_USER=your_postgres_username
   DB_PASSWORD=your_postgres_password
   ```

4. **Set up PostgreSQL database**
   
   Create the database and user:
   ```sql
   -- Connect to PostgreSQL as superuser
   sudo -u postgres psql
   
   -- Create database and user
   CREATE DATABASE todo_app;
   CREATE USER your_username WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE todo_app TO your_username;
   \q
   ```

5. **Initialize the database**
   ```bash
   node scripts/setup-database.js
   ```

6. **Start the application**
   ```bash
   npm start
   ```

7. **Open your browser**
   Navigate to `http://localhost:3012`

## 🐳 Docker Setup

For a containerized setup with Docker:

### Option 1: With Docker PostgreSQL
```bash
docker-compose up -d
```

### Option 2: With Local PostgreSQL
```bash
docker-compose -f docker-compose.local-db.yml up -d
```

The application will be available at `http://localhost:3012`

## 📱 Usage Guide

### Creating Tasks
1. Click the "Add Task" button
2. Fill in title, description, priority, and tags
3. Set initial status (To Do, In Progress, Pending, Done)
4. If setting to Pending, provide a reason

### Moving Tasks
- **Desktop**: Drag and drop between columns
- **Mobile**: Swipe left (backward) or right (forward) to change status
- **Pending**: When moving to Pending, you'll be prompted for a reason

### Task Management
- **Edit**: Click the edit icon on any task
- **Delete**: Click the delete icon (with confirmation)
- **Notes**: Click the notes icon to add/edit task notes

### Filtering & Search
- Use the search box for real-time filtering
- Filter by priority using the priority dropdown
- Filter by tags using the tags dropdown
- Sort by priority, date, or title

## 🏗️ Project Structure

```
Kanban_ToDo/
├── config/
│   └── database.js          # Database connection configuration
├── public/
│   ├── index.html          # Main HTML file
│   ├── script.js           # Frontend JavaScript
│   ├── styles.css          # CSS styles
│   ├── logo.svg            # Application logo
│   └── favicon.svg         # Favicon
├── routes/
│   └── tasks.js            # API routes for tasks and notes
├── scripts/
│   └── setup-database.js   # Database initialization script
├── docker-compose.yml      # Docker configuration
├── Dockerfile             # Docker image definition
├── init-db.sql           # SQL schema for Docker setup
├── server.js             # Express server
└── package.json          # Node.js dependencies
```

## 🔧 API Endpoints

### Tasks
- `GET /api/tasks` - Get all tasks (with filtering)
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `PATCH /api/tasks/:id/status` - Update task status
- `DELETE /api/tasks/:id` - Delete task

### Notes
- `GET /api/tasks/:id/notes` - Get task notes
- `POST /api/tasks/:id/notes` - Add note to task
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note

### Tags
- `GET /api/tags` - Get all unique tags

## 🎨 Customization

### Styling
The application uses CSS custom properties for easy theming. Main colors can be modified in `public/styles.css`:

```css
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --success-color: #38a169;
  --warning-color: #f39c12;
  --danger-color: #e53e3e;
}
```

### Database Schema
The database schema supports:
- Tasks with status, priority, tags, and pending reasons
- Notes linked to tasks
- Timestamps for creation and updates

## 🔒 Security Notes

- Environment variables are used for sensitive configuration
- Input validation on both frontend and backend
- SQL injection protection through parameterized queries
- CORS enabled for cross-origin requests

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🐛 Troubleshooting

### Common Issues

**Database Connection Error**
- Verify PostgreSQL is running
- Check database credentials in `.env`
- Ensure database exists and user has proper permissions

**Port Already in Use**
- Change the PORT in `.env` to an available port
- Kill any process using port 3012: `lsof -ti:3012 | xargs kill -9`

**Docker Issues**
- Ensure Docker is running
- Try `docker-compose down` then `docker-compose up -d`
- Check logs: `docker-compose logs`

## 📞 Support

If you encounter any issues or have questions:
1. Check the troubleshooting section above
2. Search existing [GitHub Issues](https://github.com/oxtobyd/Kanban_ToDo/issues)
3. Create a new issue with detailed information

## 🙏 Acknowledgments

- Built with modern web technologies
- Inspired by popular Kanban tools like Trello and Jira
- Icons and design patterns follow modern UI/UX principles

---

**Made with ❤️ for productivity enthusiasts**