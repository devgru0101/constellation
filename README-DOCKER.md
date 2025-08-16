# Constellation IDE - Enterprise Docker Architecture

## Overview

This document describes the enterprise-grade Docker architecture for Constellation IDE, designed for scalability, security, and maintainability.

## Architecture Components

### 🌐 **Reverse Proxy (Traefik)**
- **Purpose**: SSL termination, load balancing, service discovery
- **Features**: Automatic SSL certificates, rate limiting, middleware
- **Access**: Port 80/443 (HTTP/HTTPS), Dashboard on 8080

### 🗄️ **Database Layer**
- **MongoDB Replica Set**: Primary database with high availability
- **Redis Cache**: Session storage, caching, pub/sub
- **Persistent Volumes**: Data persistence across container restarts

### 🔧 **Microservices**

#### API Gateway (Port 8000)
- Central entry point for all API requests
- Authentication and authorization
- Rate limiting and request validation
- Service proxy and load balancing

#### Project Service (Port 8002)
- Project CRUD operations
- Project metadata management
- Template management
- File system integration

#### Claude Service (Port 8001)
- AI chat functionality
- Code generation
- Integration with Anthropic API
- Context management

#### Workspace Service (Port 8003)
- Docker container management
- Workspace isolation
- File system operations
- Container lifecycle management

### 🖥️ **Frontend Service**
- React application with Nginx
- Static asset serving
- Client-side routing
- Production optimizations

### 📊 **Monitoring Stack**
- **Prometheus**: Metrics collection
- **Grafana**: Dashboards and visualization
- **Winston**: Structured logging
- **Health checks**: Service availability monitoring

## Quick Start

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+
- Make (optional, for convenience commands)

### Development Setup

1. **Clone and setup environment**:
   ```bash
   git clone <repository>
   cd constellation-project
   make dev-setup
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Generate SSL certificates** (for local development):
   ```bash
   make ssl-generate
   ```

4. **Start services**:
   ```bash
   make up
   ```

5. **Initialize database**:
   ```bash
   make db-init
   ```

6. **Check status**:
   ```bash
   make status
   make health
   ```

### Access Points

- **Main Application**: https://constellation.local
- **API Gateway**: https://api.constellation.local
- **Traefik Dashboard**: http://localhost:8080
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090

## Service Configuration

### Environment Variables

Key environment variables in `.env`:

```bash
# Database
MONGODB_ROOT_PASSWORD=secure_password_here
REDIS_PASSWORD=secure_redis_password

# Authentication
JWT_SECRET=your_jwt_secret_32_chars_minimum

# External APIs
ANTHROPIC_API_KEY=your_anthropic_key

# Production (optional)
DOMAIN=constellation.yourdomain.com
ACME_EMAIL=your-email@domain.com
```

### Volume Mappings

**Development**:
- `mongodb-data`: Database persistence
- `redis-data`: Cache persistence
- `project-workspaces`: User project files
- `./config`: Configuration files

**Production**:
- `/opt/constellation/data/*`: Persistent data
- `/opt/constellation/workspaces`: User workspaces
- `/opt/constellation/config`: Configuration

## Service Details

### MongoDB Configuration
- **Replica Set**: `rs0` for high availability
- **Users**: Application-specific users with minimal permissions
- **Indexes**: Optimized for query performance
- **Backup**: Automated with `make db-backup`

### Traefik Configuration
- **SSL**: Automatic Let's Encrypt certificates
- **Middleware**: Security headers, rate limiting, compression
- **Service Discovery**: Automatic service registration
- **Load Balancing**: Round-robin across service replicas

### Security Features
- **Non-root containers**: All services run as non-root users
- **Network isolation**: Internal networks for database access
- **Security headers**: HSTS, CSP, XSS protection
- **Secret management**: Environment-based secrets
- **Health checks**: Automatic restart on failure

## Development Commands

```bash
# Basic operations
make up              # Start all services
make down            # Stop all services
make restart         # Restart all services
make rebuild         # Rebuild and restart

# Development
make up-dev          # Start with logs
make logs            # Show all logs
make logs-api        # Show API logs only
make logs-db         # Show database logs

# Database operations
make db-init         # Initialize database
make db-backup       # Create backup
make db-restore BACKUP_DIR=./backups/mongodb-20231201_120000

# Monitoring
make health          # Check service health
make monitor         # Open monitoring dashboards

# Maintenance
make clean           # Clean Docker resources
make clean-all       # Full cleanup (destroys data!)
make update          # Update to latest images
```

## Production Deployment

### Prerequisites
- Linux server with Docker
- Domain name with DNS pointing to server
- SSL certificates (automatic with Let's Encrypt)

### Deployment Steps

1. **Prepare server**:
   ```bash
   # Create directory structure
   sudo mkdir -p /opt/constellation/{data,config,workspaces}
   sudo chown -R $USER:$USER /opt/constellation
   
   # Clone repository
   git clone <repository> /opt/constellation/app
   cd /opt/constellation/app
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with production values
   export NODE_ENV=production
   ```

3. **Deploy**:
   ```bash
   make prod-deploy
   ```

4. **Verify deployment**:
   ```bash
   make health
   make logs
   ```

### Production Scaling

The architecture supports horizontal scaling:

```bash
# Scale specific services
docker-compose up -d --scale api-gateway=3
docker-compose up -d --scale project-service=2
docker-compose up -d --scale claude-service=2
```

### Backup Strategy

**Automated backups**:
```bash
# Daily backup cron job
0 2 * * * cd /opt/constellation/app && make db-backup
```

**Disaster recovery**:
```bash
# Restore from backup
make db-restore BACKUP_DIR=/path/to/backup
```

## Monitoring and Alerting

### Prometheus Metrics
- Service health and uptime
- Request rates and latency
- Database performance
- Container resource usage

### Grafana Dashboards
- Service overview
- Database metrics
- User activity
- System performance

### Log Management
- Structured JSON logging
- Centralized log collection
- Error alerting
- Audit trails

## Security Considerations

### Network Security
- Internal networks for database access
- Service mesh with mTLS (future enhancement)
- Firewall rules and port restrictions

### Data Security
- Encrypted data at rest
- Encrypted data in transit (TLS)
- Secret management
- Regular security updates

### Access Control
- Role-based access control (RBAC)
- JWT-based authentication
- API rate limiting
- Audit logging

## Troubleshooting

### Common Issues

**Services not starting**:
```bash
make logs              # Check logs
docker-compose ps      # Check service status
make health           # Test health endpoints
```

**Database connection issues**:
```bash
make logs-db          # Check MongoDB logs
docker-compose exec mongodb-primary mongosh  # Connect directly
```

**SSL certificate issues**:
```bash
# Check Traefik logs
docker-compose logs traefik

# Regenerate certificates
rm -rf data/ssl/acme.json
make restart
```

### Performance Optimization

**Database tuning**:
- Monitor slow queries
- Optimize indexes
- Adjust connection pools

**Service scaling**:
- Monitor resource usage
- Scale services based on load
- Implement auto-scaling (Kubernetes)

**Caching strategy**:
- Redis for session data
- CDN for static assets
- Application-level caching

## Future Enhancements

### Kubernetes Migration
- Container orchestration
- Auto-scaling
- Service mesh (Istio)
- Advanced monitoring

### Advanced Security
- OAuth2/OIDC integration
- Secrets management (Vault)
- Network policies
- Pod security policies

### Performance
- CDN integration
- Multi-region deployment
- Database sharding
- Caching layers

## Support

For issues and questions:
1. Check logs with `make logs`
2. Verify health with `make health`
3. Review this documentation
4. Open GitHub issue with logs and configuration