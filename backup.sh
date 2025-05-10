#!/bin/bash

# Get current date in YYYY-MM-DD format
DATE=$(date +%F)

# Backup PostgreSQL database, excluding the large static 'cards' table
docker exec mtg-db pg_dump -U mtguser mtgdb --exclude-table=public.cards > backup/mtgdb_${DATE}.sql
echo "[+] DB backup written to backup/mtgdb_${DATE}.sql"

# Archive the data directory (Scryfall JSON, etc.)
tar -czf backup/data_${DATE}.tar.gz inference-backend/data
echo "[+] Data archive written to backup/data_${DATE}.tar.gz"

# Done
echo "[✓] Backup complete (${DATE})"