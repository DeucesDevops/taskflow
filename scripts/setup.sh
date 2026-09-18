#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ -f .env ]; then
  echo '.env already exists; leaving it unchanged.'
  exit 0
fi
command -v openssl >/dev/null 2>&1 || { echo 'OpenSSL is required to generate local credentials.' >&2; exit 1; }
umask 077
# Noclobber avoids replacing a file created by another setup process.
set -C
cat > .env <<ENV
POSTGRES_PASSWORD=$(openssl rand -hex 24)
INTERNAL_API_KEY=$(openssl rand -hex 32)
DEMO_EMAIL=alex@taskflow.local
DEMO_PASSWORD=taskflow-local-demo
FRONTEND_PORT=3000
ENV
echo 'Created .env with local credentials. Run docker compose up --build --wait.'
