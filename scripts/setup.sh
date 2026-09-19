#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
command -v openssl >/dev/null 2>&1 || { echo 'OpenSSL is required to generate local credentials.' >&2; exit 1; }
if [ -f .env ]; then
  if ! grep -q '^JWT_SECRET=' .env; then
    printf '\nJWT_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env
    echo 'Added the Milestone 2 signing secret; existing settings preserved.'
  else
    echo '.env already exists; leaving it unchanged.'
  fi
  exit 0
fi
umask 077
# Noclobber avoids replacing a file created by another setup process.
set -C
cat > .env <<ENV
POSTGRES_PASSWORD=$(openssl rand -hex 24)
INTERNAL_API_KEY=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
DEMO_EMAIL=alex@taskflow.local
DEMO_PASSWORD=taskflow-local-demo
FRONTEND_PORT=3000
ENV
echo 'Created .env with local credentials. Run docker compose up --build --wait.'
