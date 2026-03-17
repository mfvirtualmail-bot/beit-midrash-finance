#!/bin/bash
set -e

# ============================================================
# Beit Midrash Finance — Database Backup
# Usage: bash scripts/backup.sh
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="backup_${TIMESTAMP}.sql"

echo "Creating database backup..."
docker compose exec -T postgres pg_dump -U postgres beit_midrash > "$BACKUP_FILE"

echo "✓ Backup saved to: $BACKUP_FILE"
echo "  Size: $(du -h "$BACKUP_FILE" | cut -f1)"
