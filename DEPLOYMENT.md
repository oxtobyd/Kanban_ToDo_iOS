# Deployment Guide

This guide covers different deployment options for the Kanban Todo Board application.

## 🚀 Production Deployment Options

### 1. Traditional Server Deployment

#### Prerequisites
- Ubuntu/CentOS server with sudo access
- Node.js 18+ installed
- PostgreSQL 13+ installed
- Nginx (recommended for reverse proxy)
- PM2 (for process management)

#### Steps

1. **Clone and setup the application**
   ```bash
   git clone https://github.com/oxtobyd/Kanban_ToDo.git
   cd Kanban_ToDo
   npm install --production
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with production values
   ```

3. **Setup database**
   ```bash
   sudo -u postgres createdb todo_app
   sudo -u postgres createuser todo_user
   sudo -u postgres psql -c "ALTER USER todo_user WITH PASSWORD 'secure_password';"
   sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE todo_app TO todo_user;"
   
   # Initialize database
   npm run setup-db
   ```

4. **Install PM2 and start application**
   ```bash
   npm install -g pm2
   pm2 start server.js --name "kanban-todo"
   pm2 startup
   pm2 save
   ```

5. **Configure Nginx reverse proxy**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3012;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

### 2. Docker Deployment

#### Using Docker Compose (Recommended)

1. **Clone repository**
   ```bash
   git clone https://github.com/oxtobyd/Kanban_ToDo.git
   cd Kanban_ToDo
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with production values
   ```

3. **Deploy with Docker Compose**
   ```bash
   docker-compose up -d
   ```

#### Using Docker with external database

1. **Build and run container**
   ```bash
   docker build -t kanban-todo .
   docker run -d \
     --name kanban-todo \
     -p 3012:3012 \
     -e DB_HOST=your-db-host \
     -e DB_USER=your-db-user \
     -e DB_PASSWORD=your-db-password \
     -e DB_NAME=todo_app \
     kanban-todo
   ```

### 3. Cloud Platform Deployment

#### Heroku

1. **Install Heroku CLI and login**
   ```bash
   heroku login
   ```

2. **Create Heroku app**
   ```bash
   heroku create your-app-name
   ```

3. **Add PostgreSQL addon**
   ```bash
   heroku addons:create heroku-postgresql:hobby-dev
   ```

4. **Set environment variables**
   ```bash
   heroku config:set NODE_ENV=production
   # Database URL is automatically set by Heroku PostgreSQL addon
   ```

5. **Deploy**
   ```bash
   git push heroku main
   ```

6. **Initialize database**
   ```bash
   heroku run npm run setup-db
   ```

#### Railway

1. **Connect GitHub repository to Railway**
2. **Add PostgreSQL service**
3. **Set environment variables**
4. **Deploy automatically on push**

## 🔧 Production Configuration

### Environment Variables

```env
# Production environment
NODE_ENV=production
PORT=3012

# Database (use connection string for cloud databases)
DATABASE_URL=postgresql://user:password@host:port/database
# OR individual variables
DB_HOST=your-production-db-host
DB_PORT=5432
DB_NAME=todo_app
DB_USER=todo_user
DB_PASSWORD=secure_password
```

### Security Considerations

1. **Use HTTPS in production**
2. **Set secure database passwords**
3. **Configure firewall rules**
4. **Regular security updates**
5. **Monitor application logs**

### Monitoring and Logging

1. **PM2 monitoring**
   ```bash
   pm2 monit
   pm2 logs kanban-todo
   ```

2. **Database monitoring**
   ```sql
   -- Check active connections
   SELECT count(*) FROM pg_stat_activity;
   
   -- Check database size
   SELECT pg_size_pretty(pg_database_size('todo_app'));
   ```

## 🔄 Updates and Maintenance

### Updating the Application

1. **Pull latest changes**
   ```bash
   git pull origin main
   npm install --production
   ```

2. **Run database migrations (if any)**
   ```bash
   npm run setup-db
   ```

3. **Restart application**
   ```bash
   pm2 restart kanban-todo
   ```

## 🚨 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   lsof -ti:3012 | xargs kill -9
   ```

2. **Database connection issues**
   - Check database credentials
   - Verify database is running
   - Check firewall rules

3. **Memory issues**
   ```bash
   # Check memory usage
   free -h
   # Restart application
   pm2 restart kanban-todo
   ```

---

**Need help with deployment? Create an issue on GitHub!**