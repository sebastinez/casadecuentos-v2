# Deployment runbook — Casa de Cuentos (Phase 12: ops / launch)

Reproducible, cheap, durable hosting for the storefront on **one Hetzner VPS**
running **NixOS**: PocketBase + SvelteKit + Caddy as systemd services, secrets
via **sops-nix**, automatic HTTPS, and automated backups.

All declarative config lives in [`nix/`](../nix). This runbook covers the steps
that can't be expressed in Nix: provisioning the box, DNS, secrets, email
authentication, and verification.

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
(`pb.files.getURL → /api/files/...`). Those URLs are loaded directly by browsers
and by the WhatsApp/Instagram link-preview crawlers, so the files endpoint must
be publicly reachable. We give PocketBase its own subdomain and point
`POCKETBASE_URL` at it. On the box, `networking.hosts` pins `pb.<domain>` to
`127.0.0.1`, so the BFF's own PocketBase calls stay local (over Caddy's valid
cert) while the public DNS record serves everyone else.

> Consequence: the PocketBase **REST API and admin UI are internet-facing.**
> This is PocketBase's normal deployment mode, but it makes your collection
> **API rules** the security boundary — see step 9.

---

## 0. Prerequisites (on your laptop)

- Nix with flakes (`nix --version`)
- `sops`, `age`, `ssh-to-age` (`nix shell nixpkgs#sops nixpkgs#age nixpkgs#ssh-to-age`)
- A Hetzner Cloud account and an SSH keypair
- **The repo must be git-tracked.** The flake lives at the repo root, and Nix
  copies the flake's source tree into `/nix/store` to evaluate it. In a
  **non-git** directory Nix copies *everything* — including `.env` (real
  secrets), `pb_data`, `node_modules` — which is slow and leaks secrets into the
  world-readable store. With a git tree, Nix honours `.gitignore` (which already
  excludes those). This repo uses **jj**, so colocate a git backing once:

  ```sh
  jj git init --colocate     # adds a .git backing; .gitignore now filters the flake
  ```

  (Plain `git init` works too.) New/edited files must be snapshotted before they
  are visible to the flake — `jj` auto-snapshots the working copy; with plain
  git, `git add -A` first. Verify nothing sensitive is included:
  `nix flake archive --json | …` or simply `git status --ignored`.

---

## 1. Provision the Hetzner VPS and install NixOS

This runbook uses the **build-on-the-box** model: you install NixOS on the
server yourself, then build the flake natively on it (`x86_64-linux`), so your
Mac never has to cross-build and there's no `nixos-anywhere`/kexec.

Create a server in the Hetzner Cloud console:

- **Type:** confirm which "cpx22" you meant — it isn't a real Hetzner type:
  - **CX22** — Intel, 2 vCPU / 4 GB / **40 GB** disk (cheapest that fits)
  - **CPX21** — AMD, 3 vCPU / 4 GB / **80 GB** disk
  Either works; the Nix config targets `x86_64-linux` for both. (Avoid the ARM
  **CAX** line — it's `aarch64`, which this config is not built for.)
- **SSH key:** add yours so you can log in.
- Note the server's **public IPv4 and IPv6**.

**Install NixOS** using whichever path you've chosen — a Hetzner NixOS image, or
mounting the NixOS ISO via the console and installing manually (`parted` →
`nixos-generate-config` → `nixos-install`). The result you need before
continuing: you can `ssh` into a running NixOS box, and it has a generated
`/etc/nixos/hardware-configuration.nix`.

> 4 GB RAM is enough to build this closure but it's tight. If a build OOMs, add
> swap — set `zramSwap.enable = true;` (already cheap to add to
> `configuration.nix`) or a `swapDevices` entry, and retry.

## 2. DNS records

Point the domain at the box (do this early so ACME can issue certs):

| Type | Name  | Value             |
| ---- | ----- | ----------------- |
| A    | `@`   | `<server IPv4>`   |
| AAAA | `@`   | `<server IPv6>`   |
| A    | `www` | `<server IPv4>`   |
| AAAA | `www` | `<server IPv6>`   |
| A    | `pb`  | `<server IPv4>`   |
| AAAA | `pb`  | `<server IPv6>`   |

Wait for propagation (`dig +short casadecuentos.ch`).

## 3. Set your apex domain + SSH key in the config

Edit [`nix/configuration.nix`](../nix/configuration.nix):

- `casadecuentos.domain` → your real apex domain
- `casadecuentos.acmeEmail` → your email
- `users.users.root.openssh.authorizedKeys.keys` → your SSH **public** key

Edit [`nix/modules/backups.nix`](../nix/modules/backups.nix) → `s3Endpoint`,
`s3Region`, `s3Bucket` for your Hetzner Object Storage bucket.

## 4. Bring the box's hardware config + bootloader into the flake

The NixOS installer generated the box's real disk/hardware config. Copy it into
the flake (which imports `nix/hardware-configuration.nix`):

```sh
scp root@<server-ip>:/etc/nixos/hardware-configuration.nix nix/hardware-configuration.nix
```

Set the **bootloader** in [`nix/configuration.nix`](../nix/configuration.nix) to
match how the box boots — check on the box:

```sh
ssh root@<server-ip> '[ -d /sys/firmware/efi ] && echo UEFI || echo BIOS; lsblk'
```

- **BIOS** (typical Hetzner) → keep the `boot.loader.grub` block; set `device`
  to the boot disk from `lsblk` (usually `/dev/sda`).
- **UEFI** → comment grub out and enable systemd-boot (snippet is in the file).

## 5. Encrypt the secrets to the host

The box already has its own SSH host key (generated at install), so there's no
pre-generation or circular-dependency dance:

```sh
# Your personal (admin) age key — lets you edit secrets:
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt        # prints your PUBLIC key: age1...

# The box's host key → age recipient:
ssh root@<server-ip> 'cat /etc/ssh/ssh_host_ed25519_key.pub' | ssh-to-age
```

Put the **admin** key as `&admin` and the **host** `age1...` as `&host` in
[`nix/.sops.yaml`](../nix/.sops.yaml), then create the encrypted file:

```sh
cd nix
cp secrets/secrets.example.yaml secrets/secrets.yaml
sops secrets/secrets.yaml     # $EDITOR opens; fill REAL values; save → encrypted
```

Leave `stripe_webhook_secret` as a placeholder for now — you mint the real one
in step 10 and re-`sops` it then. The encrypted `secrets.yaml` **is** safe to
commit (that's the point of sops). See
[`secrets.example.yaml`](../nix/secrets/secrets.example.yaml) for the full key
list (Stripe, PocketBase admin, Resend, S3, restic password).

## 6. Get the flake onto the box and build it

Commit everything first (domain edits, `hardware-configuration.nix`, the
encrypted `secrets.yaml`). The box builds the closure **natively** — your Mac
never cross-builds.

**Option A — git (recommended; clean updates):** push to a private GitHub repo,
then on the box:

```sh
ssh root@<server-ip>
git clone https://github.com/<you>/casadecuentos-v2 /root/casadecuentos
cd /root/casadecuentos
```

**Option B — rsync (no remote):** copy the tree from your laptop and make it a
git repo on the box (flakes only see git-tracked files):

```sh
rsync -a --exclude node_modules --exclude build --exclude .svelte-kit \
  --exclude pb_data --exclude .bin --exclude .jj --exclude .env \
  ./ root@<server-ip>:/root/casadecuentos/
ssh root@<server-ip> 'cd /root/casadecuentos && git init -q && git add -A && \
  git -c user.email=a@b -c user.name=deploy commit -qm deploy'
```

Then build + switch **on the box** (native `x86_64-linux`):

```sh
cd /root/casadecuentos
nixos-rebuild switch --flake .#casadecuentos \
  --extra-experimental-features 'nix-command flakes'   # first run only
```

(After the first switch, flakes are enabled system-wide and you can drop that
flag. Run as root, or `sudo nixos-rebuild …`.)

> First build **fails on the `pnpmDeps` TOFU hash** (the PocketBase hash is
> already pinned). Read `got: sha256-…`, paste it into
> [`pkgs/sveltekit.nix`](../nix/pkgs/sveltekit.nix), commit/re-sync, rebuild.
> If the build OOMs on 4 GB RAM, add swap (`zramSwap.enable = true;` in
> `configuration.nix`) and retry.

## 7. Verify it came up

```sh
systemctl status pocketbase sveltekit caddy --no-pager   # on the box
curl -I https://casadecuentos.ch          # 200, valid cert
curl -I https://pb.casadecuentos.ch/api/health
```

> **ORIGIN / OG tags:** `ORIGIN=https://<domain>` and
> `POCKETBASE_URL=https://pb.<domain>` are already set in
> [`web.nix`](../nix/modules/web.nix). Verify a product page's `og:image`
> resolves publicly:
> `curl -s https://casadecuentos.ch/libros/<slug> | grep og:image` → the URL
> should be `https://pb.<domain>/api/files/...` and load in a browser.

## 8. Deploying updates

- **git:** push from your laptop, then on the box
  `cd /root/casadecuentos && git pull && nixos-rebuild switch --flake .#casadecuentos`.
- **rsync:** re-sync the tree, re-commit on the box, then `nixos-rebuild switch`.

A new `pb_migrations/*.js` only applies when the `pocketbase` unit restarts — the
rebuild restarts it, so migrations land on deploy.

## 9. PocketBase post-install

Open `https://pb.<domain>/_/` and:

1. Create the **superuser** — use the **same** email/password you put in
   `secrets.yaml` (`pocketbase_admin_email` / `..._password`), since the BFF
   authenticates as that user. (Or create via SSH:
   `pocketbase superuser upsert <email> <pw> --dir=/var/lib/pocketbase/pb_data`.)
2. **Settings → Application:** set the Application URL to `https://pb.<domain>`.
3. **Settings → trusted proxy:** set it to trust the `X-Forwarded-For` header
   (Caddy is in front), so rate-limits/logs see the real client IP.
4. **Audit collection API rules** (the API is now public): confirm
   `orders`, `rsvps`, and `contact_messages` are **not** publicly listable/
   readable — list/view/update rules should require the superuser. Public
   collections should be only `books`, `genres`, `publishers`,
   `book_languages`, `banners`, `featured_books`, `events` (read-only).

## 10. Stripe production webhook + smoke test

The local `stripe listen` secret does **not** work in prod.

1. Stripe dashboard → **Developers → Webhooks → Add endpoint**:
   `https://<domain>/api/webhooks/stripe`, event
   `checkout.session.completed`.
2. Copy the endpoint's **Signing secret** (`whsec_…`) into `secrets.yaml`
   (`stripe_webhook_secret`), re-deploy (step 8).
3. **Smoke test with a real UI checkout** (not `stripe trigger` — the signature
   path needs a genuine session): add a book to the cart on the live site, pay
   with a Stripe **test card**, then confirm in PocketBase admin that the order
   flipped `pending → paid`, stock decremented, and the confirmation email sent.

## 11. Email authentication (Resend, dedicated subdomain)

In Resend, add a sending domain — use a **dedicated subdomain** (e.g.
`mail.casadecuentos.ch` / `send.casadecuentos.ch`) so the storefront's
reputation is isolated. Resend gives you DNS records to add:

- **SPF** — `TXT` on the subdomain: `v=spf1 include:_spf.resend.com ~all`
- **DKIM** — the `CNAME`/`TXT` record(s) Resend shows (its public key)
- **DMARC** — `TXT` at `_dmarc.<domain>`:
  `v=DMARC1; p=quarantine; rua=mailto:dmarc@<domain>`

Set `MAIL_FROM` to an address **on that verified domain** — it's currently
`Casa de Cuentos <pedidos@<domain>>` in [`web.nix`](../nix/modules/web.nix);
change the local part/subdomain to match Resend. Verify with a test order and
check the message passes SPF/DKIM/DMARC (Gmail "Show original", or
[mail-tester.com](https://www.mail-tester.com)).

## 12. Backups — and verify a restore

Create a Hetzner **Object Storage** bucket (or any S3-compatible target), put
its credentials in `secrets.yaml` (`s3_access_key_id`, `s3_secret_access_key`)
and set the bucket/endpoint in `backups.nix`.

- **Litestream** streams `data.db` continuously (`systemctl status litestream`).
- **restic** snapshots the image dir nightly at 03:30
  (`systemctl status restic-backups-images.timer`).

**Verify restore (required — don't skip):**

```sh
# DB: restore the streamed SQLite to a scratch path and open it
litestream restore -o /tmp/restore-test.db \
  s3://casadecuentos-backups/litestream/data.db
sqlite3 /tmp/restore-test.db '.tables'        # should list the collections

# Images: list + restore a restic snapshot to a scratch dir
restic -r s3:<endpoint>/<bucket>/restic-images snapshots
restic -r s3:<endpoint>/<bucket>/restic-images restore latest --target /tmp/img-test
```

(Run on the box where the S3 env + restic password are present, e.g. via
`systemd-run --pty --property=EnvironmentFile=...` or by sourcing the rendered
env files under `/run/secrets-rendered/`.)

## 13. Ongoing operations

- **Deploy changes:** commit/push (or re-sync), then **on the box**
  `cd /root/casadecuentos && git pull && nixos-rebuild switch --flake .#casadecuentos`.
  A new `pb_migrations/*.js` only applies when the `pocketbase` unit restarts —
  the rebuild restarts it, so migrations land on deploy.
- **Rotate a secret:** `cd nix && sops secrets/secrets.yaml`, edit, save, re-deploy.
- **Rotate recipients:** edit `nix/.sops.yaml`, then (from `nix/`)
  `sops updatekeys secrets/secrets.yaml`.
- **Owner's daily loop** stays entirely in `https://pb.<domain>/_/` (catalog,
  featured, banners, events, RSVPs, contact messages, order fulfillment).

---

## Acceptance-criteria mapping (Phase 12)

| Criterion                                                | Where                                                |
| -------------------------------------------------------- | ---------------------------------------------------- |
| NixOS stands up PB + SvelteKit + Caddy as systemd units  | `nix/modules/web.nix`, `nix/modules/caddy.nix`       |
| Domain A/AAAA → VPS; automatic HTTPS                      | step 2 + `services.caddy` (ACME)                     |
| Secrets via sops-nix, never in `/nix/store`              | `nix/modules/secrets.nix`, `.sops.yaml`, step 5      |
| Stripe webhook at a stable public HTTPS URL              | `caddy.nix` apex proxy + step 10                     |
| Automated DB backups + image snapshots, restore-verified | `nix/modules/backups.nix` + step 12                  |
| SPF + DKIM + DMARC from a dedicated subdomain            | step 11                                              |
| Owner operates everything from PocketBase admin          | step 9 (public `pb.<domain>/_/`)                     |
