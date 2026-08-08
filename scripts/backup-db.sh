#!/usr/bin/env bash
# KasirGo — SQLite backup script
# Usage: bash scripts/backup-db.sh [backup_dir]
# Default: ./backups/
# Cron: 0 2 * * * cd /path/to/KasirGO && bash scripts/backup-db.sh

set -euo pipefail

DB_PATH="${DB_PATH:-backend/db/kasirgo.sqlite}"
BACKUP_DIR="${1:-backups}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
BACKUP_FILE="${BACKUP_DIR}/kasirgo-backup-${TIMESTAMP}.sqlite"

if [ ! -f "$DB_PATH" ]; then
  echo "❌ Database not found: $DB_PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# SQLite online backup via VACUUM INTO (consistent snapshot, no lock needed)
sqlite3 "$DB_PATH" "VACUUM INTO '${BACKUP_FILE}';" 2>/dev/null \
  || bun -e "
    import Database from 'bun:sqlite';
    const db = new Database('${DB_PATH}');
    db.exec(\"VACUUM INTO '${BACKUP_FILE}'\");
    db.close();
  "

# Verify file was created
if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Backup failed: $BACKUP_FILE not created" >&2
  exit 1
fi

SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null || echo "?")
echo "✅ Backup: $BACKUP_FILE ($SIZE bytes)"

# Retention: keep last 30 backups
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/kasirgo-backup-*.sqlite 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 30 ]; then
  ls -1t "$BACKUP_DIR"/kasirgo-backup-*.sqlite | tail -n +31 | xargs rm -f
  echo "🗑️  Cleaned old backups (kept 30 most recent)"
fi
