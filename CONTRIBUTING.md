# Contributing to Kanban Todo Board

Thank you for your interest in contributing to the Kanban Todo Board! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- Git
- Basic knowledge of JavaScript, HTML, CSS, and SQL

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Kanban_ToDo.git
   cd Kanban_ToDo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up your development environment**
   ```bash
   cp .env.example .env
   # Edit .env with your local database credentials
   ```

4. **Initialize the database**
   ```bash
   node scripts/setup-database.js
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

## 📋 How to Contribute

### Reporting Bugs

1. **Check existing issues** first to avoid duplicates
2. **Use the bug report template** when creating new issues
3. **Include detailed information**:
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser/OS information
   - Screenshots if applicable

### Suggesting Features

1. **Check existing feature requests** to avoid duplicates
2. **Use the feature request template**
3. **Provide clear use cases** and benefits
4. **Consider implementation complexity**

### Code Contributions

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the existing code style
   - Add comments for complex logic
   - Update documentation if needed

3. **Test your changes**
   - Test on different browsers
   - Test responsive design on mobile
   - Verify database operations work correctly

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push and create a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

## 🎯 Development Guidelines

### Code Style

- **JavaScript**: Use ES6+ features, consistent indentation (2 spaces)
- **CSS**: Use meaningful class names, group related styles
- **HTML**: Semantic markup, proper accessibility attributes
- **SQL**: Use uppercase for keywords, proper indentation

### Commit Messages

Use conventional commit format:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `style:` for formatting changes
- `refactor:` for code refactoring
- `test:` for adding tests
- `chore:` for maintenance tasks

Examples:
```
feat: add task filtering by date range
fix: resolve drag and drop issue on mobile
docs: update installation instructions
```

## 🧪 Testing

### Manual Testing Checklist

- [ ] Task creation, editing, deletion
- [ ] Drag and drop functionality
- [ ] Mobile swipe gestures
- [ ] Search and filtering
- [ ] Notes system
- [ ] Pending workflow with reasons
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Cross-browser compatibility

### Browser Support

Test on:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🤝 Community Guidelines

- Be respectful and constructive in discussions
- Help others learn and grow
- Focus on the code, not the person
- Celebrate contributions of all sizes

## 📞 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Code Review**: Ask questions in PR comments

---

Thank you for contributing to making this project better! 🎉