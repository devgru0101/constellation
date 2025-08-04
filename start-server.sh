#!/bin/bash

# Constellation IDE Development Server
# This script starts the development server accessible from Windows host

echo "🚀 Starting Constellation IDE..."
echo ""

# Get WSL IP address
WSL_IP=$(ip addr show eth0 | grep "inet " | awk '{print $2}' | cut -d/ -f1)

echo "📍 Network Information:"
echo "   WSL IP: $WSL_IP"
echo "   Port: 3000"
echo ""

echo "🌐 Access URLs:"
echo "   From WSL/Linux: http://localhost:3000"
echo "   From Windows:   http://$WSL_IP:3000"
echo ""

echo "💡 If you can't access from Windows:"
echo "   1. Check Windows Firewall settings"
echo "   2. Try: curl http://$WSL_IP:3000 (from Windows)"
echo "   3. Ensure no antivirus is blocking the connection"
echo ""

echo "🔄 Starting server (Ctrl+C to stop)..."
echo ""

# Start the development server
npm run dev