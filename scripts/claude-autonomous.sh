#!/bin/bash

# Constellation IDE - Autonomous Claude Code Launcher
# This script launches Claude Code with parameters that minimize user prompts

# Set autonomous operation parameters
PERMISSION_MODE="bypassPermissions"
OUTPUT_FORMAT="text"

# Launch Claude Code with minimal prompts
echo "🚀 Starting Claude Code in autonomous mode..."
echo "📍 Working directory: $(pwd)"
echo "🔧 Permission mode: $PERMISSION_MODE"
echo "💡 Tip: Claude will now operate with minimal user input required"
echo ""

# Execute Claude Code with autonomous settings
exec claude \
  --permission-mode "$PERMISSION_MODE" \
  --output-format "$OUTPUT_FORMAT" \
  "$@"