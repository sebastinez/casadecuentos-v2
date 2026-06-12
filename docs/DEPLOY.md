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

## 1. Provision the Hetzner VPS

Create a server in the Hetzner Cloud console:

- **Type:** confirm which "cpx22" you meant — it isn't a real Hetzner type:
  - **CX22** — Intel, 2 vCPU / 4 GB / **40 GB** disk (cheapest that fits)
  - **CPX21** — AMD, 3 vCPU / 4 GB / **80 GB** disk
  Either works; the Nix config targets `x86_64-linux` for both. The
  [`disko`](../nix/disko.nix) layout just fills the disk, so 40 GB or 80 GB is
  fine. (Avoid the ARM **CAX** line — it's `aarch64`, which this config is not
  built for.)
- **Image:** any (Ubuntu) — it gets wiped by `nixos-anywhere`.
- **SSH key:** add yours so you can reach the rescue/installer.
- Note the server's **public IPv4 and IPv6**.

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

## 4. Keys: your age key + a pre-generated host key

sops-nix needs `secrets.yaml` to exist (and decrypt to the server's host key) at
**eval** time — but the host key normally only exists *after* install. Break
that circular dependency by **pre-generating the host key locally**, so you can
encrypt to it before the box exists and have nixos-anywhere install it.

```sh
# Your personal (admin) age key — lets you edit secrets:
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt        # prints your PUBLIC key: age1...

# The server's future SSH host key, generated locally:
cd nix
mkdir -p secrets/hostkey
ssh-keygen -t ed25519 -N "" -C casadecuentos-host \
  -f secrets/hostkey/ssh_host_ed25519_key
ssh-to-age -i secrets/hostkey/ssh_host_ed25519_key.pub   # prints the host age1...
```

Put the **admin** public key as `&admin` and the **host** `age1...` as `&host`
in [`nix/.sops.yaml`](../nix/.sops.yaml).

> ⚠️ `secrets/hostkey/` is a **private key** — it's already git-ignored; never
> commit it. (The *encrypted* `secrets.yaml` is safe to commit; that's the point
> of sops.)

## 5. Encrypt the secrets (now possible — both recipients are known)

```sh
cd nix
cp secrets/secrets.example.yaml secrets/secrets.yaml
sops secrets/secrets.yaml     # $EDITOR opens; fill REAL values; save → encrypted
```

You can leave `stripe_webhook_secret` as a placeholder for now — you mint the
real one in step 10 and re-`sops` it then. See
[`secrets.example.yaml`](../nix/secrets/secrets.example.yaml) for the full key
list (Stripe, PocketBase admin, Resend, S3, restic password).

## 6. Install NixOS with nixos-anywhere

This kexecs into the NixOS installer, partitions the disk per `disko.nix`, and
installs the flake — wiping the box.

> **The golden rule: connect as `root` over SSH *key* auth.** nixos-anywhere
> runs non-interactively and **cannot answer password prompts**:
>
> - A **non-root** user would need **passwordless** (`NOPASSWD`) sudo — an extra
>   hurdle. Just use `root`.
> - If your SSH **key** isn't accepted at any stage, SSH falls back to asking
>   for a password and the run aborts with
>   *"a terminal is required to read the password."*
>
> These are exactly the two failures to avoid: the root run that "needs a
> password" = key not accepted; the `nixos` run that "needs sudo" = non-root
> without passwordless sudo.

### 6a. Get a known-good root environment (recommended: Rescue mode)

The most reliable source environment on Hetzner Cloud is **Rescue mode** — a
clean Debian with root + your SSH key, kexec-capable, free of the default
image's cloud-init password/expiry quirks:

1. Hetzner console → your server → **Rescue** → type **linux64**, select your
   SSH key → **Enable rescue & power cycle** (Reset).
2. The server reboots into rescue with passwordless root key login.

(You may skip rescue and target the freshly-created server directly **iff**
passwordless root SSH already works — verify in 6b.)

### 6b. Pre-flight: prove passwordless root SSH works

This one check predicts success. From your laptop:

```sh
ssh-keygen -R <server-ip>                        # clear any stale host key
ssh -i ~/.ssh/<your-key> root@<server-ip> true && echo "OK passwordless root"
```

If it prints `OK` with **no** password prompt, nixos-anywhere will connect
cleanly. If it asks for a password, fix that first (wrong `-i` key path, key not
attached to the server, or key auth disabled on the default image — use Rescue).

### 6c. Run the installer

The flake ships a Hetzner-Cloud [`hardware.nix`](../nix/hardware.nix) (virtio),
so no on-target hardware generation is needed.

**Load your key into ssh-agent first** so the passphrase is asked **once**, not
on every connection nixos-anywhere opens (this is why you saw repeated passphrase
prompts — see the note below):

```sh
eval "$(ssh-agent -s)"
ssh-add --apple-use-keychain ~/.ssh/<your-key>   # macOS; drop the flag on Linux
```

Stage the pre-generated host key so the box boots already holding it (sops can
then decrypt secrets on first boot), then run from the **repo root** (the flake
lives there, not in `nix/`):

```sh
# Place the host key generated in step 4 onto the target's /etc/ssh:
install -d -m700 extra-files/etc/ssh
install -m600 nix/secrets/hostkey/ssh_host_ed25519_key     extra-files/etc/ssh/
install -m644 nix/secrets/hostkey/ssh_host_ed25519_key.pub extra-files/etc/ssh/

nix run github:nix-community/nixos-anywhere -- \
  --flake .#casadecuentos \
  --target-host root@<server-ip> \
  -i ~/.ssh/<your-key> \
  --extra-files extra-files \
  --build-on-remote            # REQUIRED on a macOS laptop — see note
```

- **`--extra-files`** copies your pre-generated `/etc/ssh/ssh_host_ed25519_key`
  onto the box, so its host key matches the `&host` recipient you encrypted to —
  secrets decrypt on first boot, no second deploy needed. (`extra-files/` is
  git-ignored.)
- **`--build-on-remote` (macOS):** the storefront package is `x86_64-linux`; a
  **darwin laptop cannot build it**, so let the target build its own closure.
  (On a Linux laptop you can omit this.) Alternatively add the box as a remote
  builder and build locally — `--build-on-remote` is simpler.
- Add `--debug` if it fails — it prints the exact phase (kexec / disko /
  install) and the command that stopped.
- RAM note: kexec mounts the Nix store as **tmpfs** and wants **≥4 GB**.
  CX22/CPX21 have exactly 4 GB — fine, but if the installer OOMs mid-copy add
  `--no-substitute-on-destination`.

> The first run **fails on the `pnpmDeps` TOFU hash** (the PocketBase hash is
> already pinned). Read `got: sha256-…` from the error, paste it into
> [`pkgs/sveltekit.nix`](../nix/pkgs/sveltekit.nix), and re-run — see step 7.

### Troubleshooting matrix

| Symptom | Cause | Fix |
| --- | --- | --- |
| Prompts for a password as `root` | SSH key not offered/accepted | pass `-i ~/.ssh/<key>`; verify with 5b; `ssh-keygen -R <ip>` for a stale host key |
| `a terminal is required to read the password` | non-root user with password-prompt sudo | use `root` (or give the user `NOPASSWD` sudo on the **source** image) |
| `Permission denied (publickey)` | wrong key, or key not on the box | attach your key at creation / in Rescue; pass the matching `-i` |
| `Host key verification failed` | stale `~/.ssh/known_hosts` from a prior wipe | `ssh-keygen -R <ip>` |
| Hangs / unreachable right after `kexec` | installer lost network, or < 4 GB RAM | use Rescue (6a); ensure ≥ 4 GB; retry |
| Repeated **passphrase** prompts | key passphrase asked per SSH connection | load it into `ssh-agent` once (see 6c) — keep the passphrase |

If you truly have **no key** on the box and must use a password:

```sh
SSHPASS='<password>' nix run github:nix-community/nixos-anywhere -- \
  --flake .#casadecuentos --target-host root@<ip> --env-password
```

After it finishes the box reboots into NixOS holding the pre-generated host key,
so sops decrypts the secrets on first boot — no second deploy needed.

## 7. Fill in the `pnpmDeps` hash

The PocketBase hash is already pinned in
[`pkgs/pocketbase.nix`](../nix/pkgs/pocketbase.nix). The one remaining
fixed-output hash is the SvelteKit `pnpmDeps`. Because it's an `x86_64-linux`
build (and pnpm can pull platform-specific optional deps), **compute it on
Linux, not on your Mac** — easiest is to let step 6's `--build-on-remote`
surface it: the install build fails with `pnpmDeps … got: sha256-…`; paste that
into [`pkgs/sveltekit.nix`](../nix/pkgs/sveltekit.nix) and re-run step 6c.

(If you've added the box as a remote builder you can instead run
`nix build .#sveltekit` from the repo root and read the same hash.)

## 8. Deploying updates

Once installed, push config changes from the **repo root**. As a macOS laptop
can't build the `x86_64-linux` closure, build on the box too:

```sh
nixos-rebuild switch --flake .#casadecuentos \
  --target-host root@<server-ip> \
  --build-host root@<server-ip>          # build on the box (omit on a Linux laptop)
```

Check it came up:

```sh
ssh root@<server-ip> 'systemctl status pocketbase sveltekit caddy --no-pager'
curl -I https://casadecuentos.ch        # 200, valid cert
curl -I https://pb.casadecuentos.ch/api/health
```

> **ORIGIN / OG tags:** `ORIGIN=https://<domain>` and
> `POCKETBASE_URL=https://pb.<domain>` are already set in
> [`web.nix`](../nix/modules/web.nix). Verify a product page's `og:image`
> resolves publicly:
> `curl -s https://casadecuentos.ch/libros/<slug> | grep og:image` → the URL
> should be `https://pb.<domain>/api/files/...` and load in a browser.

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

- **Deploy changes:** snapshot/commit, then (from the repo root)
  `nixos-rebuild switch --flake .#casadecuentos --target-host root@<ip> --build-host root@<ip>`
  (drop `--build-host` on a Linux laptop). A new `pb_migrations/*.js` only
  applies when the `pocketbase` unit restarts — the rebuild restarts it, so
  migrations land on deploy.
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
| Secrets via sops-nix, never in `/nix/store`              | `nix/modules/secrets.nix`, `.sops.yaml`, steps 4–6   |
| Stripe webhook at a stable public HTTPS URL              | `caddy.nix` apex proxy + step 10                     |
| Automated DB backups + image snapshots, restore-verified | `nix/modules/backups.nix` + step 12                  |
| SPF + DKIM + DMARC from a dedicated subdomain            | step 11                                              |
| Owner operates everything from PocketBase admin          | step 9 (public `pb.<domain>/_/`)                     |
