# Deployment runbook — Casa de Cuentos (Debian 13 + Caddy)

Simple, cheap, durable hosting on **one Hetzner VPS** running **Debian 13
(Trixie)**: PocketBase + SvelteKit (`node build`) as **systemd services** behind
**Caddy** (automatic HTTPS). Secrets live in root-only env files. Backups use
PocketBase's built-in scheduled backup-to-S3.

Config artifacts live in [`deploy/`](../deploy): two systemd units, the
`Caddyfile`, two `*.env.example` templates, and `update.sh`.

---

## Topology

```
                         Internet
                            │
          ┌─────────────────┼──────────────────┐
   casadecuentos.ch   www.casadecuentos.ch   pb.casadecuentos.ch
          │               (301→apex)            │
          ▼                                     ▼
        ┌──────────────────── Caddy (TLS, :443) ───────────────────┐
        │  reverse_proxy 127.0.0.1:3000        reverse_proxy 8090  │
        └───────────┬───────────────────────────────┬─────────────┘
                    ▼                                 ▼
            SvelteKit BFF (:3000)             PocketBase (:8090)
            node build, ORIGIN set            data.db + image storage
                    │                                 ▲
                    └── POCKETBASE_URL=https://pb.… ───┘
                        (pinned to 127.0.0.1 in /etc/hosts → no public hairpin)
```

**Why PocketBase is public** (`pb.<domain>`): the storefront mints every book
cover and OG image URL from the PocketBase files endpoint
(`pb.files.getURL → /api/files/...`). Those are loaded directly by browsers and
by the WhatsApp/Instagram link-preview crawlers, so the files endpoint must be
publicly reachable. We give PocketBase its own subdomain and point
`POCKETBASE_URL` at it. On the box, an `/etc/hosts` entry pins `pb.<domain>` to
`127.0.0.1`, so the BFF's own PocketBase calls stay local (over Caddy's valid
cert) while the public DNS record serves everyone else.

> Consequence: the PocketBase **REST API and admin UI are internet-facing.**
> This is PocketBase's normal deployment mode, but it makes your collection
> **API rules** the security boundary — see step 9.

Replace `casadecuentos.ch` with your real domain throughout (in the `Caddyfile`,
both `.env` files, and `/etc/hosts`).

---

## 1. Create the VPS + first login

- **Type:** CX22 (Intel, 2 vCPU/4 GB) or CPX21 (AMD) — both fine. Avoid the ARM
  CAX line only if you'd download the wrong PocketBase/Node arch; if you *do*
  use CAX, swap `linux_amd64` → `linux_arm64` for the PocketBase binary and use
  the arm64 Node — everything else is identical.
- **Image:** Debian 13.
- **SSH key:** add yours.
- Note the **public IPv4 + IPv6**, then log in as `root`.

Basic hardening:

```sh
apt update && apt -y upgrade
apt -y install ufw
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

## 2. DNS records

**Preview first (recommended):** point only the two subdomains at the box and
leave the apex + `www` on your current host (e.g. Shopify). Subdomain records
are independent, and Caddy issues a cert per hostname via HTTP-01 — the apex
never has to point here. This runs a fully working preview while the live store
stays put.

| Type | Name      | Value           |
| ---- | --------- | --------------- |
| A    | `pb`      | `<server IPv4>` |
| A    | `preview` | `<server IPv4>` |
| AAAA | `pb`      | `<server IPv6>` *(optional — only if the box's IPv6 works)* |
| AAAA | `preview` | `<server IPv6>` *(optional)* |

A-records alone suffice. The committed [`Caddyfile`](../deploy/Caddyfile) and
`ORIGIN` are preconfigured for `preview.casadecuentos.ch`.

**Go live later:** add `@` + `www` A/AAAA → the box, uncomment the apex/www
blocks in the `Caddyfile`, switch `ORIGIN` to `https://casadecuentos.ch`, point
the Stripe webhook at the apex, and `systemctl reload caddy && systemctl restart
casadecuentos`.

Wait for propagation: `dig +short preview.casadecuentos.ch`.

## 3. Install packages

```sh
# Node.js 22 (NodeSource) + pnpm via corepack
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt -y install nodejs git unzip
corepack enable
corepack prepare pnpm@10.15.1 --activate

# Caddy (official apt repo)
apt -y install debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt -y install caddy
```

## 4. Create the service user + directories

```sh
useradd --system --home /opt/casadecuentos --shell /usr/sbin/nologin casadecuentos || true
mkdir -p /opt/casadecuentos /var/lib/pocketbase/pb_data /etc/casadecuentos
chown -R casadecuentos:casadecuentos /var/lib/pocketbase
```

## 5. Get the code onto the box

Push this repo to a (private) GitHub repo, then clone it. The app dir stays
owned by `root` (the service only needs to *read* it):

```sh
git clone https://github.com/<you>/casadecuentos-v2 /opt/casadecuentos
cd /opt/casadecuentos
```

(No remote? `rsync -a --exclude node_modules --exclude .svelte-kit --exclude build \
--exclude pb_data --exclude .bin --exclude .jj --exclude .env ./ root@<ip>:/opt/casadecuentos/`
from your laptop instead.)

## 6. PocketBase

```sh
# Binary (pinned 0.39.1 — the version the migrations + Goja hook were built for)
curl -fsSL -o /tmp/pb.zip \
  https://github.com/pocketbase/pocketbase/releases/download/v0.39.1/pocketbase_0.39.1_linux_amd64.zip
unzip -o /tmp/pb.zip pocketbase -d /usr/local/bin/
chmod +x /usr/local/bin/pocketbase

# Env file (Resend key for the shipped-email hook)
cp /opt/casadecuentos/deploy/pocketbase.env.example /etc/casadecuentos/pocketbase.env
$EDITOR /etc/casadecuentos/pocketbase.env
chmod 600 /etc/casadecuentos/pocketbase.env

# systemd unit
cp /opt/casadecuentos/deploy/pocketbase.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now pocketbase
journalctl -u pocketbase -n 20 --no-pager      # should log the applied migrations + loaded hook
```

The unit runs PocketBase on `127.0.0.1:8090`, reading migrations/hooks from the
cloned repo and storing data in `/var/lib/pocketbase/pb_data`.

## 7. SvelteKit (build + run)

```sh
cd /opt/casadecuentos
pnpm install --frozen-lockfile
pnpm build                                     # produces ./build (adapter-node)

# Env file (PocketBase URL, ORIGIN, Stripe/Resend/PB-admin keys)
cp deploy/sveltekit.env.example /etc/casadecuentos/sveltekit.env
$EDITOR /etc/casadecuentos/sveltekit.env
chmod 600 /etc/casadecuentos/sveltekit.env

# systemd unit
cp deploy/casadecuentos.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now casadecuentos
journalctl -u casadecuentos -n 20 --no-pager   # "Listening on http://127.0.0.1:3000"
```

> The app reads env vars at **runtime** (`$env/dynamic/private`), so the build
> needs no secrets — only the running service does, via the env file.

## 8. Caddy + the /etc/hosts pin

```sh
# Pin the PocketBase subdomain to loopback so the BFF reaches it locally
echo "127.0.0.1 pb.casadecuentos.ch" >> /etc/hosts

# Install the Caddyfile (edit domain + ACME email first)
cp /opt/casadecuentos/deploy/Caddyfile /etc/caddy/Caddyfile
$EDITOR /etc/caddy/Caddyfile
systemctl reload caddy
```

Verify it's all up:

```sh
systemctl status pocketbase casadecuentos caddy --no-pager
curl -I https://preview.casadecuentos.ch          # 200, valid cert
curl -I https://pb.casadecuentos.ch/api/files/     # public file endpoint reachable
# OG image must resolve to a public PB URL and load in a browser:
curl -s https://preview.casadecuentos.ch/libros/<slug> | grep og:image
```

## 9. PocketBase post-install

The `Caddyfile` keeps the admin UI **off the public internet** (only
`/api/files/*` is public). Reach it from your laptop via an SSH tunnel:

```sh
ssh -L 8090:127.0.0.1:8090 <user>@<vps-ip>      # then open http://localhost:8090/_/
```

Then:

1. Create the **superuser** — use the **same** email/password you put in
   `sveltekit.env` (`POCKETBASE_ADMIN_EMAIL` / `_PASSWORD`), since the BFF
   authenticates as that user. (Or, right on the box:
   `pocketbase superuser upsert <email> <pw> --dir=/var/lib/pocketbase/pb_data`.)
2. **Settings → Application:** set the Application URL to `https://pb.<domain>`.
3. **Settings → trusted proxy:** trust the `X-Forwarded-For` header (Caddy is in
   front) so logs/rate-limits see the real client IP.
4. **Audit collection API rules** (defense in depth — the collections API isn't
   public under the hardened `Caddyfile`, but keep this correct): `orders`,
   `rsvps`, `contact_messages` must require the superuser; public read-only are
   `books`, `genres`, `publishers`, `book_languages`, `banners`,
   `featured_books`, `events`.

## 10. Stripe production webhook + smoke test

1. Stripe dashboard → **Developers → Webhooks → Add endpoint**:
   `https://preview.casadecuentos.ch/api/webhooks/stripe`, event
   `checkout.session.completed`. (At go-live, change this to the apex — or add a
   second endpoint — and update `STRIPE_WEBHOOK_SECRET`.)
2. Copy the endpoint's **Signing secret** (`whsec_…`) into
   `/etc/casadecuentos/sveltekit.env` (`STRIPE_WEBHOOK_SECRET`), then
   `systemctl restart casadecuentos`. (The local `stripe listen` secret does
   **not** work in prod.)
3. **Smoke test with a real UI checkout** (not `stripe trigger` — the signature
   path needs a genuine session): add a book to the cart on the live site, pay
   with a Stripe **test card**, then confirm in the admin that the order flipped
   `pending → paid`, stock decremented, and the confirmation email sent.

## 11. Email authentication (Resend, dedicated subdomain)

In Resend, add a sending domain — use a **dedicated subdomain** (e.g.
`mail.casadecuentos.ch`) so the storefront's reputation is isolated. Add the DNS
records Resend shows:

- **SPF** — `TXT` on the subdomain: `v=spf1 include:_spf.resend.com ~all`
- **DKIM** — the `CNAME`/`TXT` record(s) Resend gives (its public key)
- **DMARC** — `TXT` at `_dmarc.<domain>`:
  `v=DMARC1; p=quarantine; rua=mailto:dmarc@<domain>`

Set `MAIL_FROM` (in **both** env files) to an address on that verified domain.
Verify with a test order: Gmail "Show original" or
[mail-tester.com](https://www.mail-tester.com) should show SPF/DKIM/DMARC pass.

## 12. Backups — PocketBase backup-to-S3 (+ verify a restore)

Create a Hetzner **Object Storage** bucket (S3-compatible). In the PocketBase
admin → **Settings → Backups**:

- Set the **S3 storage** endpoint, region, bucket, access key + secret.
- Enable a **cron schedule** (e.g. `0 3 * * *` — nightly 03:00). PocketBase zips
  the database **and** the uploaded images into one archive and uploads it.

**Verify a restore (required — don't skip):** download the latest backup from
the bucket and confirm it restores. Either use the admin's **"restore backup"**
on a throwaway instance, or:

```sh
# fetch a backup zip from the bucket (s3cmd/rclone/aws), then:
unzip -o backup.zip -d /tmp/pb-restore
sqlite3 /tmp/pb-restore/data.db '.tables'      # should list the collections
ls /tmp/pb-restore/storage                      # uploaded images present
```

> Want continuous (sub-second-RPO) DB backup instead? Install the `litestream`
> binary + a systemd unit streaming `/var/lib/pocketbase/pb_data/data.db` to S3.
> PocketBase's built-in scheduled backup is simpler and covers images too — fine
> for this store.

## 13. Updates + ongoing operations

- **Deploy a code change:** push to GitHub, then on the box
  `sudo /opt/casadecuentos/deploy/update.sh` (pulls, `pnpm install`, `pnpm
  build`, restarts both services — see [`deploy/update.sh`](../deploy/update.sh)).
  New `pb_migrations/*.js` apply on the PocketBase restart it does.
- **Change a secret:** edit `/etc/casadecuentos/*.env`, then `systemctl restart
  casadecuentos` (and/or `pocketbase`).
- **Logs:** `journalctl -u casadecuentos -f` / `-u pocketbase -f` / `-u caddy -f`.
- **Owner's daily loop** stays entirely in `https://pb.<domain>/_/` (catalog,
  featured, banners, events, RSVPs, contact messages, order fulfillment).

---

## Acceptance-criteria mapping (Phase 12)

| Criterion                                                | Where                                            |
| -------------------------------------------------------- | ------------------------------------------------ |
| PB + SvelteKit + Caddy as systemd services on one VPS    | `deploy/*.service`, `deploy/Caddyfile`, steps 6–8 |
| Domain A/AAAA → VPS; automatic HTTPS                     | step 2 + Caddy (ACME)                            |
| Secrets injected at runtime, not world-readable          | `/etc/casadecuentos/*.env` (chmod 600), steps 6–7 |
| Stripe webhook at a stable public HTTPS URL              | Caddy apex proxy + step 10                       |
| Automated DB + image backups, restore-verified           | step 12 (PocketBase backup-to-S3)                |
| SPF + DKIM + DMARC from a dedicated subdomain            | step 11                                          |
| Owner operates everything from PocketBase admin          | step 9 (public `pb.<domain>/_/`)                 |
