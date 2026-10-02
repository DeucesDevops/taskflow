#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
command -v openssl >/dev/null 2>&1 || { echo 'OpenSSL is required to generate local credentials.' >&2; exit 1; }
if [ -f .env ]; then
  changed=false
  if ! grep -q '^JWT_SECRET=' .env; then
    printf '\nJWT_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env
    changed=true
  fi
  if ! grep -q '^RABBITMQ_PASSWORD=' .env; then
    printf '\nRABBITMQ_PASSWORD=%s\n' "$(openssl rand -hex 24)" >> .env
    changed=true
  fi
  if [ "$changed" = true ]; then
    echo 'Added missing local credentials; existing settings preserved.'
  else
    echo '.env already contains the required credentials; leaving it unchanged.'
  fi
  exit 0
fi
umask 077
# Noclobber avoids replacing a file created by another setup process.
set -C
cat > .env <<ENV
POSTGRES_PASSWORD=$(openssl rand -hex 24)
RABBITMQ_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 32)
DEMO_EMAIL=alex@taskflow.local
DEMO_PASSWORD=taskflow-local-demo
FRONTEND_PORT=3000
ENV
echo 'Created .env with local credentials. Run docker compose up --build --wait.'
