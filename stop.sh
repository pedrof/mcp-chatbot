#!/bin/bash

# MCP Chatbot - Stop Script

echo "🛑 Stopping MCP Chatbot..."

podman-compose down

echo "✅ All services stopped"
echo ""
echo "💡 To remove all data (including database):"
echo "   podman-compose down -v"
