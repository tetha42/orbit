#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:-backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/orbit_db_${TIMESTAMP}.sql"
CONTAINER="${DB_CONTAINER:-orbit-db}"
USER="${POSTGRES_USER:-orbit}"
DB="${POSTGRES_DB:-orbit}"

echo "📦 [Database Backup] Creating SQL dump: $BACKUP_FILE"
docker exec -t "$CONTAINER" pg_dump -U "$USER" -d "$DB" > "$BACKUP_FILE"
echo "✅ [Database Backup] Saved successfully (${BACKUP_FILE})"
