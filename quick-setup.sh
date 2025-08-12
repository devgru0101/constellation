#!/bin/bash

# Constellation IDE - Quick Setup Script
# For when you already have the dependencies and just want to set up the project

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Constellation IDE - Quick Setup${NC}"
echo "=================================="

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    echo -e "${YELLOW}Warning: package.json not found. Make sure you're in the project directory.${NC}"
    exit 1
fi

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
npm install

# Create .env file if it doesn't exist
if [[ ! -f ".env" && -f ".env.example" ]]; then
    echo -e "${BLUE}Creating .env file...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}Please edit .env file to add your API keys${NC}"
fi

# Build the application
echo -e "${BLUE}Building application...${NC}"
npm run build

echo -e "${GREEN}✓ Quick setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Edit .env file if needed"
echo "2. Run: npm run dev"
echo "3. Open http://localhost:3000"