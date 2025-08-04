# Constellation IDE

AI-Powered Development Platform combining CodeSandbox IDE with Claude Code integration.

## Architecture

- **Frontend**: React with Monaco Editor (CodeSandbox-based)
- **Backend**: Encore.ts microservices 
- **AI System**: Multi-agent Claude Code integration
- **UI**: Leap.new-inspired dark theme with gradient accents

## Features

- 🤖 Multi-agent AI code generation
- 💬 Context-aware chat interface
- 🔧 Full IDE capabilities (Monaco Editor)
- 🐳 Docker container management
- 📊 Knowledge Base validation
- 🚀 One-click deployment

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Agent System

- **Master Orchestrator**: Coordinates all agents
- **Encore Backend Agent**: Generates Encore.ts services
- **Frontend Agent**: Creates React components
- **Database Architect**: Designs schemas
- **KB Validator**: Ensures compliance
- **Code Explainer**: Answers questions

## Stack

### Frontend
- React 18 + TypeScript
- Monaco Editor (CodeSandbox fork)
- Tailwind CSS + shadcn/ui
- Valtio (state management)
- React Query (server state)

### Backend  
- Encore.ts microservices
- PostgreSQL + Redis
- WebSocket (real-time)
- Docker containers

### AI Integration
- Claude Code API
- Multi-agent coordination
- Knowledge Base system
- Context-aware responses