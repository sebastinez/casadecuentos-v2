#!/usr/bin/env bash
# Rebuild and restart the storefront after pulling new code. Run as root on the
# box:  sudo /opt/casadecuentos/deploy/update.sh
set -euo pipefail

APP_DIR=/opt/casadecuentos
cd "$APP_DIR"

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Installing deps + building"
pnpm install --frozen-lockfile
pnpm build

# New pb_migrations/*.js only apply when PocketBase restarts on boot/serve.
echo "==> Restarting services"
systemctl restart pocketbase
systemctl restart casadecuentos

echo "==> Done. Status:"
systemctl --no-pager --lines=0 status pocketbase casadecuentos | grep -E 'Active:|●'
