#!/bin/bash

# Constellation IDE - Auto Installation Script
# This script automatically installs all dependencies, configures the environment, and builds the application

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
CONSTELLATION_REPO="https://github.com/devgru0101/constellation.git"
DEFAULT_INSTALL_DIR="constellation"
NODE_MIN_VERSION="18"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# Print banner
print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                    Constellation IDE                          ║"
    echo "║              Auto Installation Script                         ║"
    echo "║                                                               ║"
    echo "║    AI-Powered Development Platform with Claude Code           ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check system requirements
check_system_requirements() {
    log_step "Checking system requirements..."
    
    # Check operating system
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        log_info "Detected Linux system"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        log_info "Detected macOS system"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
        log_info "Detected Windows system (WSL/Git Bash)"
    else
        log_warning "Unknown operating system: $OSTYPE"
    fi
    
    # Check available memory
    if command_exists free; then
        MEMORY_GB=$(free -g | awk '/^Mem:/{print $2}')
        if [[ $MEMORY_GB -lt 4 ]]; then
            log_warning "System has less than 4GB RAM. Performance may be affected."
        fi
    fi
    
    # Check disk space
    if command_exists df; then
        AVAILABLE_SPACE=$(df . | tail -1 | awk '{print $4}')
        if [[ $AVAILABLE_SPACE -lt 2097152 ]]; then  # 2GB in KB
            log_warning "Less than 2GB disk space available. Installation may fail."
        fi
    fi
}

# Install Node.js if not present or version is too old
install_nodejs() {
    if command_exists node; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ $NODE_VERSION -ge $NODE_MIN_VERSION ]]; then
            log_success "Node.js v$(node -v) is already installed"
            return
        else
            log_warning "Node.js version $(node -v) is too old. Minimum required: v${NODE_MIN_VERSION}"
        fi
    fi
    
    log_step "Installing Node.js..."
    
    # Install Node.js using NodeSource repository for Linux
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command_exists curl; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
        elif command_exists wget; then
            wget -qO- https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
        else
            log_error "Neither curl nor wget is available. Please install Node.js manually."
            exit 1
        fi
    # Install Node.js using Homebrew for macOS
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        if command_exists brew; then
            brew install node
        else
            log_error "Homebrew not found. Please install Node.js manually from https://nodejs.org"
            exit 1
        fi
    else
        log_error "Automatic Node.js installation not supported for your system."
        log_info "Please install Node.js v${NODE_MIN_VERSION}+ manually from https://nodejs.org"
        exit 1
    fi
    
    # Verify installation
    if command_exists node; then
        log_success "Node.js v$(node -v) installed successfully"
    else
        log_error "Node.js installation failed"
        exit 1
    fi
}

# Install Git if not present
install_git() {
    if command_exists git; then
        log_success "Git is already installed ($(git --version))"
        return
    fi
    
    log_step "Installing Git..."
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command_exists apt-get; then
            sudo apt-get update
            sudo apt-get install -y git
        elif command_exists yum; then
            sudo yum install -y git
        elif command_exists dnf; then
            sudo dnf install -y git
        else
            log_error "Package manager not found. Please install Git manually."
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        if command_exists brew; then
            brew install git
        else
            log_info "Git should be available via Xcode Command Line Tools"
            xcode-select --install
        fi
    fi
    
    # Verify installation
    if command_exists git; then
        log_success "Git installed successfully ($(git --version))"
    else
        log_error "Git installation failed"
        exit 1
    fi
}

# Install Docker (optional)
install_docker() {
    if command_exists docker; then
        log_success "Docker is already installed ($(docker --version))"
        return
    fi
    
    read -p "Do you want to install Docker for container management? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Skipping Docker installation"
        return
    fi
    
    log_step "Installing Docker..."
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Install Docker using official script
        if command_exists curl; then
            curl -fsSL https://get.docker.com -o get-docker.sh
            sudo sh get-docker.sh
            sudo usermod -aG docker $USER
            rm get-docker.sh
        else
            log_error "curl not found. Please install Docker manually."
            return
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        if command_exists brew; then
            brew install --cask docker
        else
            log_info "Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
            return
        fi
    fi
    
    log_success "Docker installed successfully"
    log_warning "You may need to restart your terminal or log out/in for Docker permissions to take effect"
}

# Install Claude Code CLI (optional)
install_claude_code() {
    if command_exists claude; then
        log_success "Claude Code CLI is already installed ($(claude --version))"
        return
    fi
    
    read -p "Do you want to install Claude Code CLI for AI features? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Skipping Claude Code CLI installation"
        log_warning "Some AI features will not be available without Claude Code CLI"
        return
    fi
    
    log_step "Installing Claude Code CLI..."
    
    if command_exists npm; then
        npm install -g @anthropic-ai/claude-code
    else
        log_error "npm not found. Cannot install Claude Code CLI."
        return
    fi
    
    # Verify installation
    if command_exists claude; then
        log_success "Claude Code CLI installed successfully ($(claude --version))"
        log_info "You can configure Claude Code CLI later with: claude login"
    else
        log_warning "Claude Code CLI installation may have failed"
    fi
}

# Clone repository
clone_repository() {
    log_step "Cloning Constellation repository..."
    
    # Ask for installation directory
    read -p "Enter installation directory (default: ${DEFAULT_INSTALL_DIR}): " INSTALL_DIR
    INSTALL_DIR=${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}
    
    if [[ -d "$INSTALL_DIR" ]]; then
        log_warning "Directory $INSTALL_DIR already exists"
        read -p "Do you want to remove it and continue? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$INSTALL_DIR"
        else
            log_error "Installation cancelled"
            exit 1
        fi
    fi
    
    if git clone "$CONSTELLATION_REPO" "$INSTALL_DIR"; then
        log_success "Repository cloned successfully"
        cd "$INSTALL_DIR"
    else
        log_error "Failed to clone repository"
        exit 1
    fi
}

# Install dependencies
install_dependencies() {
    log_step "Installing project dependencies..."
    
    # Update npm to latest version
    log_info "Updating npm to latest version..."
    npm install -g npm@latest
    
    # Clear npm cache
    npm cache clean --force
    
    # Install dependencies
    if npm install; then
        log_success "Dependencies installed successfully"
    else
        log_error "Failed to install dependencies"
        log_info "Trying with --legacy-peer-deps flag..."
        if npm install --legacy-peer-deps; then
            log_success "Dependencies installed with legacy peer deps"
        else
            log_error "Failed to install dependencies even with legacy peer deps"
            exit 1
        fi
    fi
    
    # Install backend dependencies if present
    if [[ -d "backend" && -f "backend/package.json" ]]; then
        log_info "Installing backend dependencies..."
        cd backend
        npm install
        cd ..
    fi
}

# Setup environment
setup_environment() {
    log_step "Setting up environment configuration..."
    
    # Create .env file if it doesn't exist
    if [[ ! -f ".env" ]]; then
        if [[ -f ".env.example" ]]; then
            cp .env.example .env
            log_success "Created .env file from .env.example"
        else
            # Create basic .env file
            cat > .env << EOF
# Claude Code API Configuration
CLAUDE_API_KEY=your_claude_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Development Configuration
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws

# Container Configuration
DOCKER_REGISTRY_URL=
CONTAINER_TIMEOUT=300000

# Feature Flags
VITE_ENABLE_AI_FEATURES=true
VITE_ENABLE_CONTAINER_MANAGEMENT=true
VITE_ENABLE_GIT_INTEGRATION=true
EOF
            log_success "Created basic .env file"
        fi
        
        log_warning "Please edit .env file to add your API keys and configuration"
    else
        log_info ".env file already exists"
    fi
    
    # Setup git hooks if directory is a git repository
    if [[ -d ".git" ]]; then
        log_info "Setting up git hooks..."
        if [[ -d ".githooks" ]]; then
            git config core.hooksPath .githooks
            chmod +x .githooks/*
            log_success "Git hooks configured"
        fi
    fi
}

# Build application
build_application() {
    log_step "Building application..."
    
    # Type check first
    log_info "Running TypeScript type check..."
    if npm run typecheck; then
        log_success "TypeScript type check passed"
    else
        log_warning "TypeScript type check failed, but continuing with build..."
    fi
    
    # Build for production
    if npm run build; then
        log_success "Application built successfully"
    else
        log_error "Build failed"
        log_info "Trying to build with warnings ignored..."
        if npm run build -- --mode production; then
            log_success "Application built successfully (with warnings)"
        else
            log_error "Build failed completely"
            exit 1
        fi
    fi
}

# Run tests
run_tests() {
    read -p "Do you want to run tests? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Skipping tests"
        return
    fi
    
    log_step "Running tests..."
    
    if npm run test; then
        log_success "All tests passed"
    else
        log_warning "Some tests failed, but installation continues"
    fi
}

# Start development server
start_dev_server() {
    read -p "Do you want to start the development server now? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Skipping development server startup"
        return
    fi
    
    log_step "Starting development server..."
    log_info "Server will start at http://localhost:3000"
    log_info "Press Ctrl+C to stop the server"
    
    # Start server in background and show output
    npm run dev
}

# Print completion message
print_completion() {
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                   Installation Complete!                     ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    log_success "Constellation IDE has been installed successfully!"
    echo
    log_info "Next steps:"
    echo "  1. Edit the .env file to configure your API keys"
    echo "  2. Start the development server: npm run dev"
    echo "  3. Open http://localhost:3000 in your browser"
    echo "  4. (Optional) Configure Claude Code CLI: claude login"
    echo
    log_info "Available commands:"
    echo "  npm run dev          - Start development server"
    echo "  npm run build        - Build for production"
    echo "  npm run test         - Run tests"
    echo "  npm run lint         - Run code linting"
    echo "  npm run typecheck    - Run TypeScript type checking"
    echo
    log_info "Documentation: https://github.com/devgru0101/constellation/blob/main/README.md"
    log_info "Issues: https://github.com/devgru0101/constellation/issues"
}

# Main installation flow
main() {
    print_banner
    
    log_info "Starting Constellation IDE installation..."
    echo
    
    # Check system requirements
    check_system_requirements
    echo
    
    # Install required tools
    install_nodejs
    echo
    
    install_git
    echo
    
    install_docker
    echo
    
    install_claude_code
    echo
    
    # Clone and setup project
    clone_repository
    echo
    
    install_dependencies
    echo
    
    setup_environment
    echo
    
    build_application
    echo
    
    run_tests
    echo
    
    # Completion
    print_completion
    echo
    
    start_dev_server
}

# Handle interruption
trap 'log_error "Installation interrupted"; exit 1' INT TERM

# Run main installation
main "$@"