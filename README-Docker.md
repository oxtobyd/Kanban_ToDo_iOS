# Docker Setup for Todo Kanban Board

## Development Setup (Hot Reload)

### Prerequisites
- Docker and Docker Compose installed
- Port 3012 and 5432 available

### Quick Start

**Option 1: With Docker PostgreSQL (Port 5433)**
```bash
# Start development environment with Docker PostgreSQL
docker-compose up -d

# View logs
docker-compose logs -f todo-app

# Stop services
docker-compose down
```

**Option 2: Use Your Existing PostgreSQL (Recommended for your setup)**
```bash
# First, setup the database using your existing PostgreSQL
npm run setup-db

# Then start only the app container
docker-compose -f docker-compose.local-db.yml up -d

# View logs
docker-compose -f docker-compose.local-db.yml logs -f todo-app

# Stop services
docker-compose -f docker-compose.local-db.yml down
```

### Access Points
- **Local**: http://localhost:3012
- **Network**: http://[YOUR_LOCAL_IP]:3012
- **Database (Docker)**: localhost:5433
- **Database (Local)**: localhost:5432

### Development Features
- ✅ Hot reload - changes reflect immediately
- ✅ PostgreSQL database included
- ✅ Sample data pre-loaded
- ✅ Network accessible
- ✅ Mobile-friendly UI

## Production Setup

```bash
# Build and start production environment
docker-compose -f docker-compose.prod.yml up -d

# Or build manually
docker build -f Dockerfile.prod -t todo-app-prod .
docker run -p 3012:3012 todo-app-prod
```

## Network Access

### Find Your Local IP
```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig | findstr "IPv4"
```

### Access from Mobile/Other Devices
1. Connect devices to same WiFi network
2. Use your computer's local IP: `http://192.168.1.XXX:3012`

## Cloudflare Tunnel Setup

### Install Cloudflare Tunnel
```bash
# macOS
brew install cloudflared

# Linux
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

### Create Tunnel
```bash
# Login to Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create todo-app

# Configure tunnel (create config.yml)
cloudflared tunnel route dns todo-app your-domain.com

# Run tunnel
cloudflared tunnel run todo-app
```

### Sample config.yml
```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /path/to/credentials.json

ingress:
  - hostname: your-domain.com
    service: http://localhost:3012
  - service: http_status:404
```

## Troubleshooting

### Container Issues
```bash
# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check container status
docker-compose ps

# View specific service logs
docker-compose logs todo-app
docker-compose logs postgres
```

### Database Issues

**Docker PostgreSQL:**
```bash
# Reset database
docker-compose down -v
docker-compose up -d

# Connect to database
docker-compose exec postgres psql -U postgres -d todo_app
```

**Local PostgreSQL:**
```bash
# Connect to your local database
psql -U postgres -d todo_app

# Reset database manually
npm run setup-db
```

### Network Issues
```bash
# Check if ports are available
lsof -i :3012
lsof -i :5432

# Test local access
curl http://localhost:3012

# Test network access (replace with your actual IP)
curl http://192.168.1.100:3012
```

## Environment Variables

Create `.env.docker` for custom settings:
```env
PORT=3012
DB_HOST=postgres
DB_PORT=5432
DB_NAME=todo_app
DB_USER=postgres
DB_PASSWORD=your_secure_password
```

## Mobile Optimization

The app includes:
- ✅ Responsive design for all screen sizes
- ✅ Touch-friendly buttons (44px minimum)
- ✅ Prevents zoom on form inputs (iOS)
- ✅ Optimized drag and drop for mobile
- ✅ Progressive Web App features
- ✅ Fast loading and smooth animations

## Security Notes

For production:
- Change default database password
- Use environment variables for secrets
- Enable HTTPS with Cloudflare
- Consider adding authentication
- Regularly update dependencies