#!/bin/bash

# Test script for Garmin MCP Server
# This script tests the MCP server using direct HTTP requests

set -e  # Exit on error

echo "🔧 Testing Garmin MCP Server"
echo "================================"
echo ""

# Try multiple URLs
MCP_URLS=(
  "http://host.containers.internal:8080/mcp"
  "http://localhost:8080/mcp"
  "http://127.0.0.1:8080/mcp"
)

MCP_URL=""
for url in "${MCP_URLS[@]}"; do
  echo "🔍 Trying to connect to: $url"
  if curl -s -f -m 2 "$url" > /dev/null 2>&1 || curl -s -f -m 2 -X POST "$url" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":0,"method":"ping"}' > /dev/null 2>&1; then
    MCP_URL="$url"
    echo "✅ Connected to: $url"
    break
  else
    echo "❌ Failed to connect to: $url"
  fi
done

if [ -z "$MCP_URL" ]; then
  echo ""
  echo "❌ ERROR: Could not connect to any MCP server URL"
  echo ""
  echo "Tried:"
  for url in "${MCP_URLS[@]}"; do
    echo "  - $url"
  done
  echo ""
  echo "Please ensure:"
  echo "1. The Garmin MCP server is running"
  echo "2. It's listening on port 8080"
  echo "3. The network connection is working"
  echo ""
  exit 1
fi

echo ""

# Get today's date in YYYY-MM-DD format
TODAY=$(date +%Y-%m-%d)

echo "📅 Using date: $TODAY"
echo ""

# Function to test a command and handle errors
test_mcp_command() {
  local test_name="$1"
  local request_data="$2"

  echo "$test_name"
  echo "$(printf '=%.0s' {1..80})"

  response=$(curl -s -X POST "$MCP_URL" \
    -H "Content-Type: application/json" \
    -d "$request_data")

  # Check if jq is available
  if command -v jq &> /dev/null; then
    echo "$response" | jq '.'
  else
    echo "$response"
  fi

  # Check for errors in response
  if echo "$response" | grep -q '"error"'; then
    echo ""
    echo "⚠️  Response contains an error!"
  fi

  echo ""
  echo ""
}

# Test 1: List available tools
test_mcp_command \
  "Test 1: List available tools" \
  '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'

# Test 2: Call get_steps_data with today's date
test_mcp_command \
  "Test 2: Call get_steps_data for $TODAY" \
  "{
    \"jsonrpc\": \"2.0\",
    \"id\": 2,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"get_steps_data\",
      \"arguments\": {
        \"date\": \"$TODAY\"
      }
    }
  }"

# Test 3: Call get_steps_data with a past date
test_mcp_command \
  "Test 3: Call get_steps_data for 2024-12-20" \
  '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "get_steps_data",
      "arguments": {
        "date": "2024-12-20"
      }
    }
  }'

# Test 4: Call get_steps_data with yesterday
YESTERDAY=$(date -d "yesterday" +%Y-%m-%d 2>/dev/null || date -v-1d +%Y-%m-%d 2>/dev/null || echo "2024-12-23")
test_mcp_command \
  "Test 4: Call get_steps_data for $YESTERDAY (yesterday)" \
  "{
    \"jsonrpc\": \"2.0\",
    \"id\": 4,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"get_steps_data\",
      \"arguments\": {
        \"date\": \"$YESTERDAY\"
      }
    }
  }"

echo "✅ Tests complete"
echo ""
echo "📋 Summary:"
echo "  Server URL: $MCP_URL"
echo "  Dates tested: $TODAY, $YESTERDAY, 2024-12-20"
echo ""
echo "If all tools returned empty data [], the Garmin server has a bug."
echo "It should return: {\"content\": [{\"type\": \"text\", \"text\": \"...\"}]}"
