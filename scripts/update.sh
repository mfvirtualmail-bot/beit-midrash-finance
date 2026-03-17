#!/bin/bash
set -e

# ============================================================
# Beit Midrash Finance — Update Script
# Pulls latest code and rebuilds the app container
# Usage: bash scripts/update.sh
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "Pulling latest code..."
git pull origin main

echo "Rebuilding app..."
docker compose up -d --build app

echo ""
echo "✓ Update complete! App is running at http://localhost:3000"
