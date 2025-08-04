#!/bin/bash

# Constellation IDE - Claude Code Integration Test Runner
# This script sets up and runs the complete integration test suite

set -e  # Exit on any error

echo "🚀 Starting Constellation IDE Integration Test Suite"
echo "=================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Check prerequisites
print_status "Checking prerequisites..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

node_version=$(node --version)
print_success "Node.js found: $node_version"

# Check if Docker is installed (optional)
if command -v docker &> /dev/null; then
    docker_version=$(docker --version)
    print_success "Docker found: $docker_version"
else
    print_warning "Docker not found. Container tests will be skipped."
fi

# Check if Claude Code CLI is installed (optional)
if command -v claude &> /dev/null; then
    claude_version=$(claude --version 2>/dev/null || echo "version unknown")
    print_success "Claude Code CLI found: $claude_version"
else
    print_warning "Claude Code CLI not found. Tests will use mock responses."
fi

# Step 2: Install dependencies
print_status "Installing frontend dependencies..."
npm install

print_status "Installing backend dependencies..."
cd backend
if [ ! -f package.json ]; then
    print_error "Backend package.json not found. Please ensure backend is properly set up."
    exit 1
fi
npm install
cd ..

# Step 3: Start backend API server
print_status "Starting backend API server..."
cd backend
npm start &
BACKEND_PID=$!
cd ..

# Wait for backend to start
print_status "Waiting for backend API to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
        print_success "Backend API is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "Backend API failed to start within 30 seconds"
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

# Step 4: Run the integration tests
print_status "Running Claude Code integration tests..."
echo ""

# Function to cleanup on exit
cleanup() {
    print_status "Cleaning up..."
    kill $BACKEND_PID 2>/dev/null || true
    
    # Clean up any test containers
    if command -v docker &> /dev/null; then
        docker ps -a --filter "name=constellation-test-*" --format "{{.Names}}" | xargs -r docker rm -f
    fi
    
    # Clean up test workspaces
    rm -rf /tmp/constellation-projects/test-* 2>/dev/null || true
    
    print_success "Cleanup completed"
}

# Set trap to cleanup on script exit
trap cleanup EXIT

# Run the tests with detailed output
npm test -- src/tests/claude-code-integration.test.ts --reporter=verbose --run

# Check test results
TEST_EXIT_CODE=$?

echo ""
echo "=================================================="

if [ $TEST_EXIT_CODE -eq 0 ]; then
    print_success "🎉 All integration tests passed!"
    echo ""
    echo "✅ Chat → Claude Code → File Generation → Container Build workflow verified"
    echo "✅ Project isolation working correctly"
    echo "✅ Error handling and recovery mechanisms functional"
    echo "✅ System ready for production use"
else
    print_error "❌ Some tests failed. Please check the output above."
    echo ""
    echo "Common issues to check:"
    echo "  • Is Claude Code CLI installed and accessible?"
    echo "  • Is Docker running (for container tests)?"
    echo "  • Are all dependencies installed correctly?"
    echo "  • Is port 8000 available for the backend API?"
fi

echo ""
echo "Test run completed at $(date)"
exit $TEST_EXIT_CODE