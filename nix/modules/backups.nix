{ config, pkgs, lib, ... }:

let
  # ── Edit these to match your Hetzner Object Storage bucket ──────────────────
  s3Endpoint = "https://fsn1.your-objectstorage.com"; # region subdomain
  s3Region = "fsn1";
  s3Bucket = "casadecuentos";

  pbData = "/var/lib/pocketbase/pb_data";
in
{
  # ── Litestream: continuous streaming of the PocketBase SQLite DB ────────────
  # Covers data.db (the catalog/orders/etc.). Restores to any point; lowest RPO.
  services.litestream = {
    enable = true;
    # AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY for the bucket (sops-rendered).
    environmentFile = config.sops.templates."backup-s3.env".path;
    settings = {
      dbs = [
        {
          path = "${pbData}/data.db";
          replicas = [
            {
              type = "s3";
              endpoint = s3Endpoint;
              region = s3Region;
              bucket = s3Bucket;
              path = "litestream/data.db";
              "force-path-style" = true;
            }
          ];
        }
      ];
    };
  };
  # The litestream module defaults to its own `litestream` user, which cannot
  # read PocketBase's 0750 state dir. Run it as the `pocketbase` user (defined
  # in web.nix) so it can read the db and write its shadow WAL. (restic runs as
  # root by default, so it can read the image dir as-is.)
  systemd.services.litestream.serviceConfig = {
    User = lib.mkForce "pocketbase";
    Group = lib.mkForce "pocketbase";
  };

  # ── restic: periodic snapshots of uploaded images (cover art, banners) ──────
  # SQLite streaming doesn't cover the file storage dir, so snapshot it too.
  services.restic.backups.images = {
    paths = [ "${pbData}/storage" ];
    repository = "s3:${s3Endpoint}/${s3Bucket}/restic-images";
    passwordFile = config.sops.secrets.restic_password.path;
    environmentFile = config.sops.templates."backup-s3.env".path;
    initialize = true;
    timerConfig = {
      OnCalendar = "*-*-* 03:30:00"; # nightly 03:30 Europe/Zurich
      Persistent = true;
    };
    pruneOpts = [
      "--keep-daily 7"
      "--keep-weekly 4"
      "--keep-monthly 6"
    ];
  };

  environment.systemPackages = [
    pkgs.litestream
    pkgs.restic
  ];
}
