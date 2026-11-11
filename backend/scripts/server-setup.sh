#!/usr/bin/env bash
# One-time server setup for the release that added backups, notifications and email reset.
# Run it on the server, from anywhere, after pulling the new code:
#
#   bash ~/daty/backend/scripts/server-setup.sh "<command that restarts the API>"
#   e.g. bash backend/scripts/server-setup.sh "pm2 restart daty-api"
#
# It is safe to run again: every step checks what is already there. It never changes a value that
# is already in .env, and it saves a database dump before migrating.
set -euo pipefail

RESTART_COMMAND="${1:-}"
cd "$(dirname "$0")/.."
step() { printf '\n== %s\n' "$1"; }

[ -f .env ] || { echo "backend/.env is missing; run this in the server's checkout"; exit 1; }

step "1/6 Dependencies"
npm install --no-audit --no-fund

step "2/6 Database dump before migrating (kept in ~/daty-pre-migrate.dump)"
CONTAINER="${BACKUP_DB_CONTAINER-date_app_postgres}"
DB_URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"' | sed 's/?.*//')"
if [ -n "$CONTAINER" ] && docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  # Inside the container the database listens on its own port, whatever the host maps it to.
  docker exec "$CONTAINER" pg_dump --dbname="$(echo "$DB_URL" | sed -E 's#@[^/]+/#@localhost:5432/#')" -Fc --no-owner > ~/daty-pre-migrate.dump
else
  pg_dump --dbname="$DB_URL" -Fc --no-owner > ~/daty-pre-migrate.dump
fi
ls -lh ~/daty-pre-migrate.dump

step "3/6 Migrations"
npx prisma migrate deploy

step "4/6 Notification keys in .env"
if grep -qE '^VAPID_PUBLIC_KEY=.+' .env; then
  echo "already set"
else
  cp .env ".env.before-setup"
  KEYS="$(npx web-push generate-vapid-keys --json)"
  sed -i -E '/^VAPID_(PUBLIC_KEY|PRIVATE_KEY|SUBJECT)=$/d' .env
  {
    echo
    echo "VAPID_PUBLIC_KEY=$(node -pe 'JSON.parse(process.argv[1]).publicKey' "$KEYS")"
    echo "VAPID_PRIVATE_KEY=$(node -pe 'JSON.parse(process.argv[1]).privateKey' "$KEYS")"
    grep -qE '^VAPID_SUBJECT=.+' .env || echo "VAPID_SUBJECT=${VAPID_SUBJECT:-mailto:admin@ourdaty.com}"
  } >> .env
  echo "added (previous file saved as .env.before-setup)"
fi

step "5/6 Daily backup to R2"
if node --env-file=.env scripts/backup.mjs; then
  LINE="15 4 * * * cd $(pwd) && $(command -v node) --env-file=.env scripts/backup.mjs >> \$HOME/daty-backup.log 2>&1"
  if ! command -v crontab >/dev/null; then
    echo "!! crontab is not installed, so the daily schedule was not added. Add this line to whatever runs scheduled jobs here:"
    echo "$LINE"
  elif crontab -l 2>/dev/null | grep -q 'scripts/backup.mjs'; then
    echo "cron entry already there"
  else
    { crontab -l 2>/dev/null || true; echo "$LINE"; } | crontab -
    echo "cron entry added: every day at 04:15"
  fi
else
  echo "!! The backup did not work, so no cron entry was added. Fix the message above and run this script again."
fi

step "6/6 Build and restart"
# The 1GB server: keep the compiler's heap small and let swap take the rest.
NODE_OPTIONS=--max-old-space-size=600 npm run build
if [ -n "$RESTART_COMMAND" ]; then
  bash -c "$RESTART_COMMAND"
  sleep 3
  PORT="$(grep -E '^PORT=' .env | cut -d= -f2 || true)"
  curl -fsS "http://127.0.0.1:${PORT:-4000}/health" && echo
else
  echo "No restart command given. Restart the API the way you usually do, then check: curl 127.0.0.1:4000/health"
fi

printf '\nDone. Still by hand, if you want them: RESEND_API_KEY / MAIL_FROM / APP_URL in .env for password reset by email.\n'
