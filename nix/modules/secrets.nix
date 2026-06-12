{ config, ... }:

{
  # Secrets live encrypted in secrets/secrets.yaml and are decrypted at boot
  # using the host's SSH ed25519 key (converted to an age key by sops-nix).
  # Nothing secret ever lands in the world-readable /nix/store.
  sops.defaultSopsFile = ../secrets/secrets.yaml;
  sops.age.sshKeyPaths = [ "/etc/ssh/ssh_host_ed25519_key" ];

  sops.secrets = {
    stripe_secret_key = { };
    stripe_webhook_secret = { };
    pocketbase_admin_email = { };
    pocketbase_admin_password = { };
    resend_api_key = { };
    # Backups (Hetzner Object Storage S3 creds + restic repo password)
    s3_access_key_id = { };
    s3_secret_access_key = { };
    restic_password = { };
  };

  # Rendered env files (per service). systemd reads EnvironmentFile as root
  # before dropping to each unit's DynamicUser, so the default 0400 root-owned
  # template files are exactly right. Each service gets ONLY the keys it needs.
  sops.templates."sveltekit.env".content = ''
    STRIPE_SECRET_KEY=${config.sops.placeholder.stripe_secret_key}
    STRIPE_WEBHOOK_SECRET=${config.sops.placeholder.stripe_webhook_secret}
    POCKETBASE_ADMIN_EMAIL=${config.sops.placeholder.pocketbase_admin_email}
    POCKETBASE_ADMIN_PASSWORD=${config.sops.placeholder.pocketbase_admin_password}
    RESEND_API_KEY=${config.sops.placeholder.resend_api_key}
  '';

  # The Goja shipped-email hook only needs the Resend key (MAIL_FROM is set as a
  # plain env var in web.nix — it is not a secret).
  sops.templates."pocketbase.env".content = ''
    RESEND_API_KEY=${config.sops.placeholder.resend_api_key}
  '';

  # S3 credentials shared by Litestream and restic. Both tools read the AWS_*
  # names; Litestream also accepts the LITESTREAM_* aliases.
  sops.templates."backup-s3.env".content = ''
    AWS_ACCESS_KEY_ID=${config.sops.placeholder.s3_access_key_id}
    AWS_SECRET_ACCESS_KEY=${config.sops.placeholder.s3_secret_access_key}
    LITESTREAM_ACCESS_KEY_ID=${config.sops.placeholder.s3_access_key_id}
    LITESTREAM_SECRET_ACCESS_KEY=${config.sops.placeholder.s3_secret_access_key}
  '';
}
