#!/bin/bash

# ── Khabar Setup Script ──────────────────────────────────────
echo ""
echo "🇳🇵  Khabar — Nepal News Aggregator"
echo "──────────────────────────────────────"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌  Node.js is not installed."
  echo "    Download it from: https://nodejs.org (v18 or newer)"
  exit 1
fi

NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo "❌  Node.js v18+ required. You have $(node -v)"
  echo "    Download: https://nodejs.org"
  exit 1
fi

echo "✅  Node.js $(node -v) detected"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo ""
  echo "📦  Installing dependencies..."
  npm install
  if [ $? -ne 0 ]; then
    echo "❌  npm install failed. Check your internet connection."
    exit 1
  fi
  echo "✅  Dependencies installed"
fi

echo ""
echo "🚀  Starting Khabar server..."
echo "    Open your browser at: http://localhost:3000"
echo "    Press Ctrl+C to stop"
echo ""

node server.js
