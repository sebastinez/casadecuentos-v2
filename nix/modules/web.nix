{
  config,
  pkgs,
  lib,
  appSrc,
  ...
}:

let
  cfg = config.casadecuentos;

  sveltekit = pkgs.callPackage ../pkgs/sveltekit.nix { src = appSrc; };
  pocketbase = pkgs.callPackage ../pkgs/pocketbase.nix { };

  # Migrations and the Goja shipped-email hook ship from the repo into the Nix
  # store (read-only, reproducible). New migrations only apply on `serve` boot,
  # which a nixos-rebuild restart of this unit provides.
  pbMigrations = ../../pb_migrations;
  pbHooks = ../../pb_hooks;
in
{
  # Static system user shared by the PocketBase service and the litestream
  # backup service (which must read the SQLite db/WAL).
  users.users.pocketbase = {
    isSystemUser = true;
    group = "pocketbase";
  };
  users.groups.pocketbase = { };

  # ── PocketBase: data + admin, loopback-only behind Caddy ────────────────────
  systemd.services.pocketbase = {
    description = "PocketBase (Casa de Cuentos data/admin backend)";
    after = [ "network.target" ];
    wantedBy = [ "multi-user.target" ];

    # MAIL_FROM is not a secret; the Resend key arrives via EnvironmentFile.
    environment.MAIL_FROM = "Casa de Cuentos <pedidos@${cfg.domain}>";

    serviceConfig = {
      # The shipped-email hook reads RESEND_API_KEY + MAIL_FROM via $os.getenv,
      # so they must reach THIS process (not the SvelteKit one).
      EnvironmentFile = [ config.sops.templates."pocketbase.env".path ];

      ExecStart = lib.concatStringsSep " " [
        "${pocketbase}/bin/pocketbase serve"
        "--dir=/var/lib/pocketbase/pb_data"
        "--migrationsDir=${pbMigrations}"
        "--hooksDir=${pbHooks}"
        "--http=127.0.0.1:8090"
      ];

      # Static user (not DynamicUser) so the litestream backup service can run
      # as the same user and read/write the SQLite db + WAL.
      User = "pocketbase";
      Group = "pocketbase";
      StateDirectory = "pocketbase"; # /var/lib/pocketbase (db + uploaded images)
      WorkingDirectory = "/var/lib/pocketbase";
      Restart = "on-failure";
      RestartSec = 5;

      # Hardening
      NoNewPrivileges = true;
      ProtectSystem = "strict";
      ProtectHome = true;
      PrivateTmp = true;
    };
  };

  # ── SvelteKit (adapter-node BFF), loopback-only behind Caddy ────────────────
  systemd.services.sveltekit = {
    description = "SvelteKit storefront (Casa de Cuentos BFF)";
    after = [
      "network.target"
      "pocketbase.service"
    ];
    wants = [ "pocketbase.service" ];
    wantedBy = [ "multi-user.target" ];

    environment = {
      HOST = "127.0.0.1";
      PORT = "3000";
      # adapter-node trusts these so url.origin (canonical/og:url) is the public
      # HTTPS apex rather than http://127.0.0.1 behind the proxy.
      ORIGIN = "https://${cfg.domain}";
      # Single source of truth for PocketBase. Public host (resolved to loopback
      # on the box) so pb.files.getURL() mints publicly-fetchable cover/OG URLs.
      POCKETBASE_URL = "https://pb.${cfg.domain}";
      NODE_ENV = "production";
      # Non-secret app config (the confirmation email needs MAIL_FROM too).
      MAIL_FROM = "Casa de Cuentos <pedidos@${cfg.domain}>";
      SHIPPING_RATE_CHF = "8";
    };

    serviceConfig = {
      EnvironmentFile = [ config.sops.templates."sveltekit.env".path ];
      ExecStart = "${pkgs.nodejs_22}/bin/node ${sveltekit}/lib/casadecuentos/build";
      DynamicUser = true;
      Restart = "on-failure";
      RestartSec = 5;

      NoNewPrivileges = true;
      ProtectSystem = "strict";
      ProtectHome = true;
      PrivateTmp = true;
    };
  };
}
