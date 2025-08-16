# Constellation IDE - Enterprise Docker Environment
SHELL := /bin/bash
.DEFAULT_GOAL := help

# Load environment variables
include .env
export

# Colors for output
BLUE := \033[34m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
RESET := \033[0m

## Help
help: ## Show this help message
	@echo "$(BLUE)Constellation IDE - Enterprise Docker Environment$(RESET)"
	@echo ""
	@echo "$(YELLOW)Available commands:$(RESET)"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  $(GREEN)%-20s$(RESET) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

## Development
.env: ## Create environment file from template
	@if [ ! -f .env ]; then \
		echo "$(YELLOW)Creating .env file from template...$(RESET)"; \
		cp .env.example .env; \
		echo "$(GREEN)✓ .env file created. Please update with your values.$(RESET)"; \
	else \
		echo "$(YELLOW).env file already exists$(RESET)"; \
	fi

dev-setup: .env ## Setup development environment
	@echo "$(BLUE)Setting up development environment...$(RESET)"
	@mkdir -p data/{mongodb,redis,grafana,prometheus,ssl}
	@mkdir -p logs
	@chmod 600 .env
	@echo "$(GREEN)✓ Development environment setup complete$(RESET)"

## Docker Operations
build: ## Build all Docker images
	@echo "$(BLUE)Building Docker images...$(RESET)"
	docker-compose build --parallel
	@echo "$(GREEN)✓ Build complete$(RESET)"

up: ## Start all services
	@echo "$(BLUE)Starting Constellation IDE services...$(RESET)"
	docker-compose up -d
	@echo "$(GREEN)✓ Services started$(RESET)"
	@make status

up-dev: ## Start services in development mode with logs
	@echo "$(BLUE)Starting Constellation IDE in development mode...$(RESET)"
	docker-compose up

down: ## Stop all services
	@echo "$(BLUE)Stopping services...$(RESET)"
	docker-compose down
	@echo "$(GREEN)✓ Services stopped$(RESET)"

restart: down up ## Restart all services

rebuild: down ## Rebuild and restart all services
	@echo "$(BLUE)Rebuilding and restarting services...$(RESET)"
	docker-compose build --no-cache
	docker-compose up -d
	@echo "$(GREEN)✓ Rebuild complete$(RESET)"

## Service Management
status: ## Show service status
	@echo "$(BLUE)Service Status:$(RESET)"
	@docker-compose ps

logs: ## Show logs for all services
	docker-compose logs -f

logs-api: ## Show API Gateway logs
	docker-compose logs -f api-gateway

logs-db: ## Show database logs
	docker-compose logs -f mongodb-primary

logs-frontend: ## Show frontend logs
	docker-compose logs -f frontend

health: ## Check health of all services
	@echo "$(BLUE)Checking service health...$(RESET)"
	@echo "Frontend: $$(curl -s -o /dev/null -w "%{http_code}" http://localhost:80/health || echo "DOWN")"
	@echo "API Gateway: $$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health || echo "DOWN")"
	@echo "Traefik: $$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/ping || echo "DOWN")"

## Database Operations
db-init: ## Initialize MongoDB replica set
	@echo "$(BLUE)Initializing MongoDB replica set...$(RESET)"
	docker-compose exec mongodb-primary mongosh --eval "load('/docker-entrypoint-initdb.d/init-replica-set.js')"
	@echo "$(GREEN)✓ Database initialized$(RESET)"

db-backup: ## Backup database
	@echo "$(BLUE)Creating database backup...$(RESET)"
	@mkdir -p backups
	docker-compose exec mongodb-primary mongodump --out /tmp/backup
	docker cp $$(docker-compose ps -q mongodb-primary):/tmp/backup ./backups/mongodb-$$(date +%Y%m%d_%H%M%S)
	@echo "$(GREEN)✓ Database backup complete$(RESET)"

db-restore: ## Restore database from backup (requires BACKUP_DIR)
	@if [ -z "$(BACKUP_DIR)" ]; then \
		echo "$(RED)Error: Please specify BACKUP_DIR=path/to/backup$(RESET)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Restoring database from $(BACKUP_DIR)...$(RESET)"
	docker cp $(BACKUP_DIR) $$(docker-compose ps -q mongodb-primary):/tmp/restore
	docker-compose exec mongodb-primary mongorestore /tmp/restore
	@echo "$(GREEN)✓ Database restore complete$(RESET)"

## Security
ssl-generate: ## Generate self-signed SSL certificates for development
	@echo "$(BLUE)Generating SSL certificates...$(RESET)"
	@mkdir -p data/ssl
	@openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
		-keyout data/ssl/default.key \
		-out data/ssl/default.crt \
		-subj "/C=US/ST=State/L=City/O=Organization/CN=constellation.local"
	@echo "$(GREEN)✓ SSL certificates generated$(RESET)"

security-scan: ## Run security scan on Docker images
	@echo "$(BLUE)Running security scan...$(RESET)"
	@if command -v trivy >/dev/null 2>&1; then \
		trivy image constellation-frontend; \
		trivy image constellation-api-gateway; \
	else \
		echo "$(YELLOW)Trivy not installed. Install with: brew install trivy$(RESET)"; \
	fi

## Monitoring
monitor: ## Open monitoring dashboards
	@echo "$(BLUE)Opening monitoring dashboards...$(RESET)"
	@echo "Traefik Dashboard: http://localhost:8080"
	@echo "Grafana: http://localhost:3001 (admin/admin)"
	@echo "Prometheus: http://localhost:9090"

## Maintenance
clean: ## Clean up Docker resources
	@echo "$(BLUE)Cleaning up Docker resources...$(RESET)"
	docker-compose down -v --remove-orphans
	docker system prune -f
	@echo "$(GREEN)✓ Cleanup complete$(RESET)"

clean-all: ## Clean up everything including volumes
	@echo "$(RED)Warning: This will delete all data!$(RESET)"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ]
	docker-compose down -v --remove-orphans
	docker volume prune -f
	docker image prune -a -f
	@echo "$(GREEN)✓ Full cleanup complete$(RESET)"

update: ## Update all services to latest versions
	@echo "$(BLUE)Updating services...$(RESET)"
	docker-compose pull
	docker-compose up -d
	@echo "$(GREEN)✓ Update complete$(RESET)"

## Testing
test: ## Run all tests
	@echo "$(BLUE)Running tests...$(RESET)"
	@echo "$(YELLOW)Integration tests not implemented yet$(RESET)"

test-e2e: ## Run end-to-end tests
	@echo "$(BLUE)Running E2E tests...$(RESET)"
	@echo "$(YELLOW)E2E tests not implemented yet$(RESET)"

## Production
prod-deploy: ## Deploy to production (requires proper environment setup)
	@echo "$(BLUE)Deploying to production...$(RESET)"
	@if [ "$(NODE_ENV)" != "production" ]; then \
		echo "$(RED)Error: NODE_ENV must be set to 'production'$(RESET)"; \
		exit 1; \
	fi
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
	@echo "$(GREEN)✓ Production deployment complete$(RESET)"

.PHONY: help dev-setup build up up-dev down restart rebuild status logs logs-api logs-db logs-frontend health db-init db-backup db-restore ssl-generate security-scan monitor clean clean-all update test test-e2e prod-deploy