#!/bin/bash

# Kanban Todo Board - Quick Setup Script
# This script helps you get started quickly with the application

set -e  # Exit on any error

echo "🚀 Kanban Todo Board - Quick Setup"
echo "===================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install PostgreSQL 13+ first."
    echo "   Visit: https://www.postgresql.org/download/"
    exit 1
fi

echo "✅ PostgreSQL detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "⚙️  Creating environment configuration..."
    cp .env.example .env
    echo "📝 Please edit .env file with your database credentials"
    echo "   Default values are set for local development"
else
    echo "✅ .env file already exists"
fi

# Ask user if they want to set up the database
echo ""
read -p "🗄️  Do you want to set up the database now? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔧 Setting up database..."
    
    # Ask for database credentials
    read -p "Enter PostgreSQL username (default: postgres): " DB_USER
    DB_USER=${DB_USER:-postgres}
    
    read -s -p "Enter PostgreSQL password: " DB_PASSWORD
    echo ""
    
    read -p "Enter database name (default: todo_app): " DB_NAME
    DB_NAME=${DB_NAME:-todo_app}
    
    # Update .env file
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/DB_USER=.*/DB_USER=$DB_USER/" .env
        sed -i '' "s/DB_PASSWORD=.*/DB_PASSWORD=$DB_PASSWORD/" .env
        sed -i '' "s/DB_NAME=.*/DB_NAME=$DB_NAME/" .env
    else
        # Linux
        sed -i "s/DB_USER=.*/DB_USER=$DB_USER/" .env
        sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=$DB_PASSWORD/" .env
        sed -i "s/DB_NAME=.*/DB_NAME=$DB_NAME/" .env
    fi
    
    # Try to create database and initialize
    echo "🏗️  Creating database..."
    if PGPASSWORD=$DB_PASSWORD createdb -U $DB_USER -h localhost $DB_NAME 2>/dev/null; then
        echo "✅ Database '$DB_NAME' created successfully"
    else
        echo "ℹ️  Database '$DB_NAME' might already exist, continuing..."
    fi
    
    echo "🔄 Initializing database schema..."
    if node scripts/setup-database.js; then
        echo "✅ Database initialized successfully"
    else
        echo "❌ Database initialization failed. Please check your credentials and try again."
        exit 1
    fi
else
    echo "⏭️  Skipping database setup. You can run 'node scripts/setup-database.js' later."
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your database credentials (if not done already)"
echo "2. Run 'node scripts/setup-database.js' to initialize the database (if not done already)"
echo "3. Run 'npm start' to start the application"
echo "4. Open http://localhost:3012 in your browser"
echo ""
echo "For development with auto-reload, use: npm run dev"
echo ""
echo "📚 Documentation:"
echo "   - README.md - Main documentation"
echo "   - README-Docker.md - Docker deployment guide"
echo "   - CONTRIBUTING.md - How to contribute"
echo ""
echo "🐛 Issues or questions? Visit: https://github.com/oxtobyd/Kanban_ToDo/issues"
echo ""
echo "Happy task managing! 📋✨"