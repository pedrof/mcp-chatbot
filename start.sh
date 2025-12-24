#!/bin/bash

# MCP Chatbot - Quick Start Script

set -e

echo "🚀 MCP Chatbot - Starting with Podman..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Creating from .env.example..."
    cp .env.example .env
    echo ""
    echo "❗ IMPORTANT: Edit .env and set a secure APP_SECRET (at least 32 characters)"
    echo "   Run: nano .env"
    echo ""
    exit 1
fi

# Check if APP_SECRET looks like default
if grep -q "change-this" .env 2>/dev/null; then
    echo "⚠️  WARNING: APP_SECRET appears to be the default value!"
    echo "   Please edit .env and set a secure random string"
    echo ""
    read -p "Continue anyway? (not recommended) [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create data directory
mkdir -p backend/data

echo "📦 Building containers..."
podman-compose build

echo ""
echo "🎬 Starting services..."
podman-compose up -d

echo ""
echo "✅ MCP Chatbot is starting!"
echo ""
echo "📊 Access points:"
echo "   Frontend:  http://localhost:5173"
echo "   Backend:   http://localhost:3000"
echo "   Health:    http://localhost:3000/api/health"
echo ""
echo "📝 View logs:"
echo "   podman-compose logs -f"
echo ""
echo "🛑 Stop services:"
echo "   podman-compose down"
echo ""
echo "⏳ Waiting for services to start..."
sleep 5

# Check health
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy!"
else
    echo "⚠️  Backend may still be starting... check logs if issues persist"
fi

echo ""
echo "🎉 Ready! Open http://localhost:5173 in your browser"
