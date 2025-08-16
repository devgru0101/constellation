# Constellation IDE

**Enterprise-Grade AI-Powered Development Platform** combining modern IDE capabilities with Claude Code integration, designed for scalability and production deployment.

## 🏗️ Architecture Overview

Constellation IDE is built as a **microservices architecture** using Docker containers with enterprise-grade orchestration, monitoring, and security features.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Traefik (Reverse Proxy)                    │
│                  SSL Termination • Load Balancing              │
└─────────────────────┬───────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  Frontend   │ │   API       │ │   Claude    │
│  Service    │ │  Gateway    │ │  Service    │
│ React+Nginx │ │ Node.js     │ │ AI/Chat     │
└─────────────┘ └─────────────┘ └─────────────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  Project    │ │  Workspace  │ │  Database   │
│  Service    │ │  Service    │ │  Cluster    │
│ CRUD/Mgmt   │ │ Container   │ │ MongoDB +   │
│             │ │ Management  │ │ Redis       │
└─────────────┘ └─────────────┘ └─────────────┘
```

## 🚀 Tech Stack

### **Frontend Layer**
- **React 18** + **TypeScript** - Modern UI framework with type safety
- **Monaco Editor** - VS Code editor with full language support
- **Tailwind CSS** + **shadcn/ui** - Utility-first styling with component library
- **Valtio** - Reactive state management
- **React Query** - Server state management and caching
- **Nginx** - Production web server with optimizations

### **Backend Services** 
- **Node.js** + **Express** - Microservices runtime
- **API Gateway** - Central routing, authentication, rate limiting
- **Project Service** - Project CRUD, templates, metadata
- **Claude Service** - AI integration, chat, code generation
- **Workspace Service** - Docker container management

### **Data Layer**
- **MongoDB Replica Set** - Primary database with high availability
- **Redis Cluster** - Caching, sessions, pub/sub messaging
- **Persistent Volumes** - Data persistence across deployments

### **Infrastructure & Orchestration**
- **Docker** + **Docker Compose** - Containerization and orchestration
- **Traefik** - Reverse proxy, load balancer, SSL termination
- **Let's Encrypt** - Automatic SSL certificate management
- **Prometheus** + **Grafana** - Metrics collection and monitoring
- **Winston** - Structured logging across services

### **AI Integration**
- **Claude Code API** - Anthropic's AI for code generation
- **Multi-agent System** - Specialized AI agents for different tasks
- **Context Management** - Project-aware AI responses
- **Knowledge Base** - Project requirements and constraints

### **Development & Deployment**
- **Git** - Version control with automated workflows
- **Make** - Build automation and task management
- **Multi-stage Builds** - Optimized Docker images
- **Health Checks** - Service monitoring and auto-healing
- **Horizontal Scaling** - Load balancing across service replicas

## 🎯 Features

- 🤖 **Multi-agent AI code generation** with specialized agents
- 💬 **Context-aware chat interface** with project memory
- 🔧 **Full IDE capabilities** powered by Monaco Editor
- 🐳 **Docker container management** for project isolation
- 📊 **Knowledge Base validation** for compliance
- 🚀 **One-click deployment** with enterprise orchestration
- 🔒 **Enterprise security** with SSL, authentication, RBAC
- 📈 **Monitoring & observability** with metrics and logging
- ⚡ **High availability** with service replicas and health checks
- 🌐 **Production ready** with proper data persistence

## 🏃‍♂️ Quick Start

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+
- Make (optional, for convenience)

### Development Setup

```bash
# Clone repository
git clone <repository>
cd constellation-project

# Copy environment configuration
cp .env.example .env
# Edit .env with your values (API keys, etc.)

# Start all services (includes automatic database initialization)
docker-compose up -d

# Check service health
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Access the application
# Frontend: http://localhost (via Traefik)
# Traefik Dashboard: http://localhost:8080
```

### Alternative Management (with Make)

```bash
# Setup environment and generate SSL certificates
make dev-setup
make ssl-generate

# Start services with make commands
make up
make health
```

### Access Points

- **Main Application**: https://constellation.local
- **API Gateway**: https://api.constellation.local  
- **Traefik Dashboard**: http://localhost:8080
- **Grafana Monitoring**: http://localhost:3001 (admin/admin)
- **Prometheus Metrics**: http://localhost:9090

## 🔧 Development

### Service Management

```bash
# Start services
make up                 # Start all services
make up-dev            # Start with logs

# Monitoring
make status            # Service status
make health            # Health checks
make logs             # All service logs
make logs-api         # API Gateway logs only

# Database operations
make db-backup        # Create backup
make db-restore BACKUP_DIR=./backups/mongodb-20231201

# Maintenance
make restart          # Restart services
make rebuild          # Rebuild and restart
make clean            # Clean Docker resources
```

### Service Architecture

Each microservice follows a consistent **BaseService pattern** with:
- **Centralized configuration** via `src/config/api.ts`
- **Environment detection** (Docker vs localhost development)
- **Health checks** for automatic recovery
- **Resource limits** for stability
- **Structured logging** for observability
- **Graceful shutdown** for reliability
- **Non-root execution** for security

#### Configuration Management

The system uses intelligent configuration management:
- **API_CONFIG**: Automatically detects Docker vs localhost environment
- **Dynamic endpoints**: URLs adapt based on deployment context
- **Legacy compatibility**: Maintains backward compatibility
- **Type safety**: Full TypeScript support with proper environment types

## 🏢 Production Deployment

### Enterprise Features

- **High Availability**: MongoDB replica sets, service replicas
- **Auto-scaling**: Horizontal scaling based on load
- **SSL/TLS**: Automatic certificate management
- **Security**: Network isolation, secret management, RBAC
- **Monitoring**: Prometheus metrics, Grafana dashboards
- **Backup**: Automated database backups
- **Load Balancing**: Traefik with health-aware routing

### Deployment

```bash
# Production deployment
export NODE_ENV=production
make prod-deploy

# Scale services
docker-compose up -d --scale api-gateway=3
docker-compose up -d --scale project-service=2
```

See [README-DOCKER.md](./README-DOCKER.md) for complete deployment documentation.

## 🤖 Agent System

The AI system consists of specialized agents:

- **Master Orchestrator**: Coordinates all agents and delegates tasks
- **Project Service Agent**: Manages project lifecycle and templates  
- **Claude Integration Agent**: Handles AI chat and code generation
- **Workspace Agent**: Manages Docker containers and isolation
- **Knowledge Base Agent**: Validates against requirements and constraints
- **Code Explainer Agent**: Provides explanations and documentation

## 📊 Monitoring & Observability

### Metrics Collection
- Service health and uptime monitoring
- Request rates, latency, and error rates
- Database performance and connection pools
- Container resource usage and scaling metrics

### Dashboards
- **Service Overview**: Health status across all services
- **Performance**: Response times and throughput
- **Infrastructure**: Resource utilization and capacity
- **Business**: User activity and feature usage

### Logging
- **Structured JSON logs** across all services
- **Centralized collection** with correlation IDs
- **Error tracking** with stack traces and context
- **Audit trails** for security and compliance

## 🔒 Security

### Network Security
- **Internal networks** for database access isolation
- **TLS encryption** for all inter-service communication
- **Rate limiting** to prevent abuse
- **CORS policies** for cross-origin protection

### Data Security
- **Encryption at rest** for database storage
- **Secret management** for API keys and passwords
- **User authentication** with JWT tokens
- **Role-based access control** for features and data

### Container Security
- **Non-root containers** for all services
- **Security scanning** with vulnerability detection
- **Resource limits** to prevent resource exhaustion
- **Network policies** for service isolation

## 🛠️ Development Architecture

### Microservices Benefits
- **Service isolation**: Independent development and deployment
- **Technology diversity**: Best tool for each service
- **Scalability**: Scale services based on demand
- **Fault tolerance**: Service failures don't affect others
- **Team autonomy**: Teams can work independently

### Container Orchestration
- **Docker Compose**: Local development and testing
- **Traefik**: Service discovery and load balancing
- **Health checks**: Automatic service recovery
- **Volume management**: Data persistence across restarts

### CI/CD Ready
- **Multi-stage builds**: Optimized production images
- **Environment configuration**: Dev/staging/production configs
- **Database migrations**: Schema versioning and updates
- **Zero-downtime deployment**: Rolling updates with health checks

## 📚 Documentation

- [**Docker Architecture**](./README-DOCKER.md) - Complete Docker setup and deployment
- [**API Documentation**](./docs/api.md) - Service APIs and endpoints  
- [**Development Guide**](./docs/development.md) - Local development setup
- [**Production Guide**](./docs/production.md) - Production deployment and scaling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with proper tests
4. Update documentation
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

**Built with ❤️ for enterprise-grade AI-powered development**
