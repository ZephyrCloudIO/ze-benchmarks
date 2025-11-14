#!/bin/bash

# Start Development Environment for Zephyr Benchmarks
# This script starts both the worker and dashboard in parallel

set -e

echo "🚀 Starting Zephyr Benchmarks Development Environment"
echo ""

# Check if worker directory exists
if [ ! -d "apps/worker" ]; then
  echo "❌ Error: apps/worker directory not found"
  exit 1
fi

# Check if benchmark-report directory exists
if [ ! -d "apps/benchmark-report" ]; then
  echo "❌ Error: apps/benchmark-report directory not found"
  exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
  echo "⚠️  Warning: .env file not found"
  echo "   Creating .env from .env.example..."
  cp .env.example .env
  echo "   ✅ Created .env file"
  echo "   Please edit .env and add your API keys"
  echo ""
fi

# Initialize D1 database if needed
echo "📊 Checking D1 database..."
if [ ! -f "apps/worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject" ]; then
  echo "   Initializing D1 database..."
  cd apps/worker
  pnpm db:push:local
  cd ../..
  echo "   ✅ D1 database initialized"
else
  echo "   ✅ D1 database already initialized"
fi

echo ""
echo "Starting services..."
echo "  - Worker API: http://localhost:8787"
echo "  - Dashboard: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Function to cleanup background processes
cleanup() {
  echo ""
  echo "🛑 Stopping services..."
  kill $(jobs -p) 2>/dev/null || true
  exit 0
}

trap cleanup INT TERM

# Start worker in background
(
  cd apps/worker
  echo "🔧 Starting Worker..."
  pnpm dev
) &

# Wait a bit for worker to start
sleep 3

# Start dashboard in background
(
  cd apps/benchmark-report
  echo "🎨 Starting Dashboard..."
  pnpm dev
) &

# Wait for all background jobs
wait
