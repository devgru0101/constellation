# Constellation IDE

AI-Powered Development Platform combining CodeSandbox IDE with Claude Code integration for seamless development workflows.

## 🌟 Overview

Constellation IDE is a modern, AI-enhanced development environment that combines the power of Monaco Editor with advanced AI agents powered by Claude Code. It provides developers with an intelligent coding assistant that can generate, explain, and refactor code while maintaining full IDE capabilities.

## ✨ Features

- 🤖 **Multi-agent AI System**: Intelligent agents for different development tasks
- 💬 **Context-aware Chat**: AI assistant with project context understanding
- 🔧 **Full IDE Capabilities**: Monaco Editor with syntax highlighting and IntelliSense
- 🐳 **Container Management**: Integrated Docker environment management
- 📊 **Knowledge Base**: Project-specific knowledge validation and compliance
- 🚀 **One-click Deployment**: Streamlined deployment workflows
- 🎨 **Modern UI**: Dark theme with gradient accents inspired by Leap.new
- 📁 **File Explorer**: Sandpack-based file management system
- 🔍 **Preview Panel**: Live preview with multi-device testing
- 📈 **Encore Dashboard**: Built-in dashboard for Encore.ts applications

## 🏗️ Architecture

### Frontend
- **React 18** with TypeScript for type safety
- **Monaco Editor** (CodeSandbox fork) for advanced code editing
- **Tailwind CSS + shadcn/ui** for modern, accessible components
- **Valtio** for reactive state management
- **React Query** for efficient server state management
- **Framer Motion** for smooth animations

### Backend Integration
- **Encore.ts** microservices support
- **PostgreSQL + Redis** database integration
- **WebSocket** for real-time collaboration
- **Docker** containerization support

### AI System
- **Claude Code API** integration
- **Multi-agent coordination** for specialized tasks
- **Knowledge Base validation** system
- **Context-aware responses** with project understanding

## 🚀 Quick Start

### Automatic Installation

Use our installation script for the easiest setup:

```bash
# Download and run the installation script
curl -fsSL https://raw.githubusercontent.com/devgru0101/constellation/master/install.sh | bash

# Or download first and inspect:
wget https://raw.githubusercontent.com/devgru0101/constellation/master/install.sh
chmod +x install.sh
./install.sh
```

### Manual Installation

#### Prerequisites

- **Node.js** 18+ and npm
- **Git** for version control
- **Docker** (optional, for container management)
- **Claude Code** CLI tool (optional, for AI features)

#### Step-by-step Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/devgru0101/constellation.git
   cd constellation
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment** (optional)
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Open http://localhost:3000 in your browser
   - The IDE will be ready for use

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run preview      # Preview production build locally

# Code Quality
npm run lint         # Run ESLint code analysis
npm run typecheck    # Run TypeScript type checking
npm run test         # Run unit tests with Vitest
npm run test:e2e     # Run end-to-end tests with Playwright

# Utilities
npm run clean        # Clean build artifacts and node_modules
```

### Project Structure

```
constellation/
├── src/
│   ├── components/          # React components
│   │   ├── chat/           # Chat interface components
│   │   ├── features/       # Feature-specific components
│   │   ├── git/           # Git integration components
│   │   ├── project/       # Project management components
│   │   ├── system/        # System-level components
│   │   └── ui/            # Reusable UI components
│   ├── services/           # Business logic and API services
│   ├── stores/            # State management
│   ├── types/             # TypeScript type definitions
│   ├── lib/               # Utility libraries
│   └── tests/             # Test files
├── public/                # Static assets
├── backend/               # Node.js backend services
└── scripts/               # Build and deployment scripts
```

## 🤖 Agent System

Constellation IDE features a sophisticated multi-agent AI system:

### Core Agents

- **Master Orchestrator**: Coordinates all agent activities and manages workflows
- **Encore Backend Agent**: Specializes in generating Encore.ts microservices
- **Frontend Agent**: Creates and maintains React components and UI elements
- **Database Architect**: Designs database schemas and handles data modeling
- **KB Validator**: Ensures code compliance with project knowledge base
- **Code Explainer**: Provides detailed code explanations and documentation

### Agent Capabilities

- **Code Generation**: Generate complete services, components, and features
- **Code Review**: Automated code quality assessment and suggestions
- **Refactoring**: Intelligent code restructuring and optimization
- **Documentation**: Automatic documentation generation and maintenance
- **Testing**: Generate and maintain comprehensive test suites

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Claude Code API Configuration
CLAUDE_API_KEY=your_claude_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Development Configuration
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws

# Container Configuration
DOCKER_REGISTRY_URL=your_registry_url
CONTAINER_TIMEOUT=300000

# Feature Flags
VITE_ENABLE_AI_FEATURES=true
VITE_ENABLE_CONTAINER_MANAGEMENT=true
VITE_ENABLE_GIT_INTEGRATION=true
```

### IDE Settings

Customize your IDE experience by modifying `src/config/ide.ts`:

```typescript
export const ideConfig = {
  editor: {
    theme: 'constellation-dark',
    fontSize: 14,
    fontFamily: 'JetBrains Mono, monospace',
    tabSize: 2,
    wordWrap: 'on'
  },
  ai: {
    autoSuggestions: true,
    contextAware: true,
    maxHistoryLength: 100
  }
}
```

## 🧪 Testing

### Running Tests

```bash
# Unit tests
npm run test

# End-to-end tests
npm run test:e2e

# Test coverage
npm run test:coverage

# Test specific files
npm run test -- --grep "specific test"
```

### Test Structure

- **Unit Tests**: Located in `src/tests/` with `.test.ts` extension
- **Integration Tests**: Testing component interactions and API calls
- **E2E Tests**: Full application workflow testing with Playwright

## 📚 API Documentation

### Chat API

```typescript
// Send message to AI agent
const response = await chatService.sendMessage({
  content: "Generate a user authentication service",
  type: "generation",
  context: {
    projectId: "current-project",
    file: "src/services/auth.ts"
  }
})
```

### Project Management API

```typescript
// Create new project
const project = await projectService.create({
  name: "My App",
  type: "fullstack-ts",
  description: "Full-stack TypeScript application"
})

// Get project status
const status = await projectService.getStatus(project.id)
```

## 🐳 Docker Support

### Development with Docker

```bash
# Build development image
docker build -t constellation-dev .

# Run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f constellation
```

### Production Deployment

```bash
# Build production image
docker build -t constellation:latest -f Dockerfile.prod .

# Run production container
docker run -p 3000:3000 constellation:latest
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Run the test suite (`npm run test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Code Standards

- **TypeScript**: All code must be properly typed
- **ESLint**: Follow the project's linting rules
- **Prettier**: Code formatting is automated
- **Tests**: New features must include tests
- **Documentation**: Update docs for API changes

## 🐛 Troubleshooting

### Common Issues

**Port 3000 already in use**
```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9

# Or use a different port
npm run dev -- --port 3001
```

**TypeScript compilation errors**
```bash
# Clean TypeScript cache
npx tsc --build --clean

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**Docker issues**
```bash
# Clean Docker cache
docker system prune -f

# Rebuild containers
docker-compose down
docker-compose up --build
```

### Getting Help

- 📖 [Documentation](https://constellation-ide.dev/docs)
- 💬 [Discord Community](https://discord.gg/constellation)
- 🐛 [Issue Tracker](https://github.com/devgru0101/constellation/issues)
- 📧 [Support Email](mailto:support@constellation-ide.dev)

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Monaco Editor** team for the excellent code editor
- **Anthropic** for Claude AI capabilities
- **Encore.ts** for the backend framework inspiration
- **React** and **Vite** communities for the development tools
- **Tailwind CSS** for the utility-first CSS framework

---

<div align="center">
  <strong>Built with ❤️ by the Constellation team</strong>
</div>