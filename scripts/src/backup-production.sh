#!/usr/bin/env bash
# Run this ON THE SERVER, from the same directory as docker-compose.yml
# (so `docker compose exec` resolves the right project). Intended to be
# called from cron, e.g. daily at 3am:
#   0 3 * * * cd /path/to/lhrith && ./scripts-backup/backup-production.sh >> /var/log/le7rithe-backup.log 2>&1
#
# Backs up:
#   1. The Postgres app database (pg_dump, custom format, inside the app-db container)
#   2. The object storage volume (tar of /data/objects, via the running app container)
# and deletes backups older than RETENTION_DAYS.
#
# Required env (set in the shell, or a .env file sourced before this script):
#   APP_PG_PASS   - same value docker-compose.yml uses for the app Postgres user
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

echo "[$TIMESTAMP] Starting backup..."

# 1. Database dump (custom format: compressed, restorable with pg_restore).
DB_DUMP="$BACKUP_DIR/db-$TIMESTAMP.dump"
docker compose exec -T app-db pg_dump -U app -d pg4amfin -F custom > "$DB_DUMP"
echo "  DB dump:      $DB_DUMP ($(du -h "$DB_DUMP" | cut -f1))"

# 2. Object storage archive (images/payment proofs/banners).
OBJECTS_ARCHIVE="$BACKUP_DIR/objects-$TIMESTAMP.tar.gz"
docker compose exec -T app tar -czf - -C /data/objects . > "$OBJECTS_ARCHIVE"
echo "  Objects archive: $OBJECTS_ARCHIVE ($(du -h "$OBJECTS_ARCHIVE" | cut -f1))"

# 3. Retention cleanup.
find "$BACKUP_DIR" -maxdepth 1 -name 'db-*.dump' -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -maxdepth 1 -name 'objects-*.tar.gz' -mtime "+$RETENTION_DAYS" -delete

echo "[$TIMESTAMP] Backup complete. Retaining last $RETENTION_DAYS days in $BACKUP_DIR."
echo ""
echo "To restore the DB on a fresh instance:"
echo "  docker compose exec -T app-db pg_restore -U app -d pg4amfin --clean --if-exists < $DB_DUMP"
echo "To restore objects:"
echo "  docker compose exec -T app tar -xzf - -C /data/objects < $OBJECTS_ARCHIVE"
